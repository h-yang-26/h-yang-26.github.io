"""Static checks for the portfolio site (standard library only).

Usage, from the repository root:
    python scripts/check_site.py            # draft check: lists open placeholders
    python scripts/check_site.py --release  # publication gate: open items are failures

Checks: content/site.json parses; every project has a page and every page a
project; local href/src references in the HTML shells resolve; URLs in the
content use an allowed form. Pending items follow the same rule as
assets/js/render.js: a null value (or a missing per-project owner statement).
"""

import json
import re
import sys
import subprocess
from urllib.parse import urlsplit, unquote
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content" / "site.json"
STATEMENT_KEYS = ("ownerVerification", "contribution", "learned", "professionalContext")

# Voice check. Copy rewritten in the decision-led voice (the homepage hero, the
# site disclosure, every project `story` and the pages those stories render)
# must not bring back the retired defensive labels.
RETIRED_PHRASES = ("agent-run", "unverified", "not verified", "independence statement",
                   "public-demo boundary", "not an export of")
STORY_FIELDS = ("headline", "lede", "facts", "banner", "situation", "decisionsTitle", "decisions", "result", "next", "technical")


def strings(node):
    if isinstance(node, str):
        yield node
    elif isinstance(node, dict):
        for value in node.values():
            yield from strings(value)
    elif isinstance(node, list):
        for value in node:
            yield from strings(value)


def figure_entries(node):
    if isinstance(node, dict):
        if str(node.get("src", "")).startswith("assets/visuals/"):
            yield node
        for value in node.values():
            yield from figure_entries(value)
    elif isinstance(node, list):
        for value in node:
            yield from figure_entries(value)


def retired_in(text):
    low = text.lower()
    return [phrase for phrase in RETIRED_PHRASES if phrase in low]


def walk_pending(node, path, out):
    if node is None:
        out.append(path)
    elif isinstance(node, list):
        for i, item in enumerate(node):
            key = item.get("slug", i) if isinstance(item, dict) else i
            walk_pending(item, f"{path}[{key}]", out)
    elif isinstance(node, dict):
        for key, value in node.items():
            if not key.startswith("_"):
                walk_pending(value, f"{path}.{key}" if path else key, out)


def pending_items(content):
    paths = []
    walk_pending(content, "", paths)
    statements = content["owner"].get("projectStatements") or {}
    for project in content["projects"]:
        own = statements.get(project["slug"]) or {}
        paths += [f"owner.projectStatements.{project['slug']}.{k}" for k in STATEMENT_KEYS if k not in own]
    return paths


class RefParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs, self.body, self.robots_noindex = [], {}, False
        self.ids, self.duplicates, self.main_text = set(), [], []
        self.h1_count, self.imgs, self.scripts = 0, [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if a.get("id"):
            if a["id"] in self.ids:
                self.duplicates.append(a["id"])
            self.ids.add(a["id"])
        if tag == "h1":
            self.h1_count += 1
        if tag == "img":
            self.imgs.append(a)
        if tag == "script":
            self.scripts.append(a.get("src", ""))
        for name in ("href", "src"):
            if a.get(name):
                self.refs.append(a[name])
        if tag == "body":
            self.body = a
        if tag == "meta" and a.get("name") == "robots" and "noindex" in (a.get("content") or ""):
            self.robots_noindex = True

    def handle_data(self, data):
        self.main_text.append(data)


def is_external(ref):
    return re.match(r"^(https?:|mailto:|data:|#)", ref) is not None


def resolve_local(base_dir, ref):
    target = (base_dir / ref.split("#")[0].split("?")[0]).resolve()
    return target / "index.html" if ref.split("#")[0].endswith("/") or target.is_dir() else target


def content_urls(content):
    owner = content["owner"]
    for p in content["projects"]:
        if p.get("repoUrl"):
            yield f"projects[{p['slug']}].repoUrl", p["repoUrl"]
    if isinstance(owner.get("resume"), dict) and owner["resume"].get("url"):
        yield "owner.resume.url", owner["resume"]["url"]
    for i, link in enumerate(owner.get("otherLinks") or []):
        yield f"owner.otherLinks[{i}].url", link.get("url", "")


def main():
    release = "--release" in sys.argv[1:]
    problems = []

    try:
        content = json.loads(CONTENT.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        print(f"FAIL  content/site.json: {exc}")
        return 1

    slugs = [p["slug"] for p in content["projects"]]
    if len(set(slugs)) != len(slugs):
        problems.append("duplicate project slugs in content/site.json")

    academic_page = ROOT / "applied-thinking/index.html"
    process_page = ROOT / "how-these-were-built/index.html"
    pages = sorted(ROOT.glob("index.html")) + sorted(ROOT.glob("projects/*/index.html")) + [p for p in (academic_page, process_page) if p.is_file()]
    page_slugs = set()
    noindex_pages = []
    parsed = {}
    for page in pages:
        parser = RefParser()
        parser.feed(page.read_text(encoding="utf-8"))
        rel = page.relative_to(ROOT).as_posix()
        parsed[page.resolve()] = parser
        problems += [f"{rel}: duplicate HTML ID {id}" for id in parser.duplicates]
        if parser.h1_count != 1:
            problems.append(f"{rel}: expected one static h1, found {parser.h1_count}")
        if any(src != (parser.body.get("data-root", ".") + "/assets/js/render.js").removeprefix("./") for src in parser.scripts):
            problems.append(f"{rel}: unexpected script")
        if parser.robots_noindex:
            noindex_pages.append(rel)
        if parser.body.get("data-page") == "project":
            slug = parser.body.get("data-project")
            page_slugs.add(slug)
            if page.parent.name != slug:
                problems.append(f"{rel}: data-project '{slug}' does not match its folder")
        for ref in parser.refs:
            if not is_external(ref) and not resolve_local(page.parent, ref).exists():
                problems.append(f"{rel}: broken local reference '{ref}'")

    # Check every generated link including same-page and cross-page fragments.
    link_count = 0
    for page, parser in parsed.items():
        for ref in parser.refs:
            parts = urlsplit(ref)
            if parts.scheme in ("https", "http", "mailto", "data"):
                continue
            if parts.scheme or parts.netloc or any(ord(ch) < 32 for ch in ref):
                problems.append(f"{page.relative_to(ROOT)}: unsafe reference {ref!r}")
                continue
            target = resolve_local(page.parent, unquote(parts.path)) if parts.path else page
            if not target.is_relative_to(ROOT):
                problems.append(f"{page.relative_to(ROOT)}: reference escapes site root {ref!r}")
            elif parts.fragment and target in parsed and unquote(parts.fragment) not in parsed[target].ids:
                problems.append(f"{page.relative_to(ROOT)}: missing fragment {ref!r}")
            link_count += 1

    a = content.get("appliedThinking", {})
    if not academic_page.is_file() or not a:
        problems.append("Applied Thinking page or content is missing")
    else:
        academic = parsed[academic_page.resolve()]
        if academic.body.get("data-page") != "applied-thinking" or academic.body.get("data-root") != "..":
            problems.append("Applied Thinking route attributes are incorrect")
        principle_ids = [p["id"] for p in a.get("principles", [])]
        if len(principle_ids) != 8 or len(set(principle_ids)) != 8:
            problems.append("expected exactly eight unique principle IDs")
        if [sum(p.get("discipline") == d for p in a["principles"]) for d in ("structural", "epistemic")] != [4, 4]:
            problems.append("expected two groups of four principles")
        for id in a.get("proposedPageSections", []) + principle_ids:
            if id not in academic.ids:
                problems.append(f"Applied Thinking: missing section or principle {id}")
        if len(a.get("connections", [])) != 5 or len(a.get("workflow", {}).get("steps", [])) != 6:
            problems.append("expected five connections and six workflow steps")
        bridges = a.get("caseStudyBridges", [])
        if len(bridges) != 4 or set(b["slug"] for b in bridges) != set(slugs):
            problems.append("case-study bridges must use all four canonical project slugs exactly once")
        for item in bridges + a.get("connections", []):
            if not set(item.get("principleIds", [])) <= set(principle_ids):
                problems.append("unknown principle in a bridge or connection")
        for p in a["principles"]:
            if not set(p.get("projectSlugs", [])) <= set(slugs):
                problems.append(f"{p['id']}: unknown project slug")
            for field in ("question", "explanation", "method", "limitation", "academicConnections"):
                if not p.get(field):
                    problems.append(f"{p['id']}: missing {field}")
        if a.get("disclosure") not in "".join(academic.main_text):
            problems.append("Applied Thinking disclosure missing or inconsistent")
        for slug in slugs:
            if "academic-connections" not in parsed[(ROOT / "projects" / slug / "index.html").resolve()].ids:
                problems.append(f"{slug}: missing academic backlink section")
        for d in a.get("diagrams", []):
            if not (ROOT / d.get("src", "")).is_file() or not d.get("alt"):
                problems.append("missing Applied Thinking diagram or alt text")
        if a.get("draftStatus") != "approved" and a.get("labels", {}).get("draftTitle") not in "".join(academic.main_text):
            problems.append("unapproved academic copy must be visibly marked as a draft")
        if release:
            if a.get("draftStatus") != "approved":
                problems.append("Applied Thinking copy awaits owner approval")
            required = ("personalVoice", "terminology", "academicTitles", "professionalBoundaries", "publicProjectDistinction", "authorship")
            problems += [f"Applied Thinking review pending: {key}" for key in required if a.get("review", {}).get(key) != "approved"]

    # Prevent a JSON or renderer edit from leaving stale no-script snapshots.
    result = subprocess.run(["node", str(ROOT / "scripts/render_static.mjs"), "--check"], capture_output=True, text=True)
    if result.returncode:
        problems.append("static HTML snapshots are stale: " + result.stderr.strip())

    for slug in slugs:
        if slug not in page_slugs:
            problems.append(f"project '{slug}' has no page at projects/{slug}/index.html")
    for slug in page_slugs - set(slugs):
        problems.append(f"page projects/{slug}/ has no project in content/site.json")

    for path, url in content_urls(content):
        if re.match(r"^https?://", url):
            continue
        if re.match(r"^[a-z][a-z0-9+.-]*:", url, re.I) or url.startswith("//"):
            problems.append(f"{path}: unsupported URL scheme '{url}'")
        elif not (ROOT / url.lstrip("/")).exists():
            problems.append(f"{path}: local file '{url}' does not exist")


    # Generated figures: every listed layout exists in both colour schemes, and
    # the SVGs and their recorded sizes match scripts/build_visuals.py.
    figures = list(figure_entries(content))
    for fig in figures:
        src = fig.get("src", "")
        if "wide" not in fig.get("sizes", {}):
            problems.append(f"{src}: missing generated sizes (run python scripts/build_visuals.py)")
        for layout in fig.get("sizes", {}):
            for dark in ("", "-dark"):
                name = src[:-4] + ("" if layout == "wide" else f"-{layout}") + dark + ".svg"
                if not (ROOT / name).is_file():
                    problems.append(f"missing figure variant {name}")
    result = subprocess.run([sys.executable, str(ROOT / "scripts/build_visuals.py"), "--check"], capture_output=True, text=True)
    if result.returncode:
        problems.append("generated visuals are stale: " + (result.stderr or result.stdout).strip())
    for project in content["projects"]:
        thumb = next((v for v in project.get("visuals", []) if v.get("src") == project.get("thumbnail")), None)
        if not thumb or "card" not in thumb.get("sizes", {}):
            problems.append(f"{project['slug']}: thumbnail must be one of its visuals with a card layout")

    # Approved principle-to-project mapping from Applied Thinking.
    principles = {p["id"]: p for p in a.get("principles", [])}
    bridges = {b["slug"]: b.get("principleIds", []) for b in a.get("caseStudyBridges", [])}
    # Decision-led copy: required story fields, and no retired labels in the new voice.
    voiced = [(f"site.{key}", content["site"].get(key)) for key in ("hero", "disclosure", "howIWork", "work", "experience", "about")]
    voiced += [(f"projects[{p['slug']}].card", p.get("card")) for p in content["projects"]]
    home_page = parsed.get((ROOT / "index.html").resolve())
    if content["site"].get("howIWork") and home_page:
        for phrase in retired_in("".join(home_page.main_text)):
            problems.append(f"index.html: homepage still says '{phrase}'")
    for project in content["projects"]:
        card = project.get("card", {})
        if not card.get("kicker") or not card.get("outcome"):
            problems.append(f"{project['slug']}: card needs a kicker and a one-line outcome")
        if len(card.get("outcome", "")) > 140:
            problems.append(f"{project['slug']}: card outcome should be one line (140 characters or fewer)")
    slugs_set = set(slugs)
    # A tile pairs a principle with a project; the pairing must match the approved
    # Applied Thinking mapping (the principle's projectSlugs or the project's bridge).
    for tile in (content["site"].get("howIWork") or {}).get("tiles", []):
        project, principle = tile.get("project"), tile.get("principle")
        if project not in slugs_set:
            problems.append(f"How I work tile {tile.get('src')} links to unknown project {project!r}")
        if principle not in principles:
            problems.append(f"How I work tile {tile.get('src')} names unknown principle {principle!r}")
        elif project not in principles[principle].get("projectSlugs", []) and principle not in bridges.get(project, []):
            problems.append(f"How I work tile {tile.get('src')}: principle {principle} is not approved for {project}")
    if content["site"].get("hero") and not content["site"].get("disclosure"):
        problems.append("site.disclosure is required once the new hero is used")
    for project in content["projects"]:
        story = project.get("story")
        if not story:
            problems.append(f"{project['slug']}: every project needs a story (the original case-study template was retired)")
            continue
        for decision in story.get("decisions", []):
            visual = decision.get("visual") or {}
            if "/tile-" in visual.get("src", ""):
                principle = visual.get("principle")
                if principle not in principles:
                    problems.append(f"{project['slug']}: decision tile {visual['src']} names unknown principle {principle!r}")
                elif project["slug"] not in principles[principle].get("projectSlugs", []) and principle not in bridges.get(project["slug"], []):
                    problems.append(f"{project['slug']}: decision tile {visual['src']} uses principle {principle}, which is not approved for this project")
        voiced.append((f"projects[{project['slug']}].story", story))
        missing = [f for f in STORY_FIELDS if not story.get(f)]
        if missing:
            problems.append(f"{project['slug']}: story is missing {', '.join(missing)}")
        if not 2 <= len(story.get("decisions", [])) <= 4 or any(not d.get("title") or not d.get("body") for d in story.get("decisions", [])):
            problems.append(f"{project['slug']}: story needs 2-4 decisions, each with a title and body")
        if not 3 <= len(story.get("technical", {}).get("notes", [])) <= 7:
            problems.append(f"{project['slug']}: story needs 3-7 technical notes")
        srcs = {v["src"] for v in project.get("visuals", [])}
        for ref in story.get("result", {}).get("visuals", []) + story.get("technical", {}).get("visuals", []):
            if ref not in srcs:
                problems.append(f"{project['slug']}: story references {ref}, which is not one of its visuals")
        page = parsed.get((ROOT / "projects" / project["slug"] / "index.html").resolve())
        if page:
            for phrase in retired_in("".join(page.main_text)):
                problems.append(f"{project['slug']}: story page still says '{phrase}'")
    # Applied Thinking tiles: one per principle; a tile's scene must come from a project
    # approved for that principle, and a conceptual-only principle shows no project data.
    tile_srcs = []
    for p in a.get("principles", []):
        visual = p.get("visual") or {}
        src, source = visual.get("src", ""), visual.get("project")
        tile_srcs.append(src)
        if not src.startswith("assets/visuals/tile-") or not (ROOT / src).is_file() or not visual.get("alt"):
            problems.append(f"{p['id']}: needs a tile visual with alt text")
        if p.get("supportType") == "conceptual-only":
            if source:
                problems.append(f"{p['id']}: conceptual-only principle must not draw its tile from project {source}")
        elif source not in p.get("projectSlugs", []) and p["id"] not in bridges.get(source, []):
            problems.append(f"{p['id']}: tile scene from {source!r} is not an approved project for this principle")
    if len(set(tile_srcs)) != len(tile_srcs):
        problems.append("Applied Thinking: each principle needs its own tile")
    thinking_page = parsed.get(academic_page.resolve())
    if thinking_page and sum(1 for i in principle_ids if i in thinking_page.ids) != 8:
        problems.append("Applied Thinking: rendered page must show all eight principle cards")

    # Course rows that name a principle must name a real one and place its link.
    for row in a.get("academicFoundations", {}).get("rows", []):
        has_token = "{principle}" in row.get("translation", "")
        if row.get("principle") and (row["principle"] not in principle_ids or not has_token):
            problems.append(f"course row {row.get('title')!r}: principle {row['principle']!r} is unknown or has no {{principle}} placeholder")
        elif has_token and not row.get("principle"):
            problems.append(f"course row {row.get('title')!r}: {{principle}} placeholder without a principle")

    # How these were built: the page exists, renders and keeps the new voice.
    process = content["site"].get("process")
    if process:
        voiced.append(("site.process", process))
        rendered = parsed.get(process_page.resolve())
        if not rendered or rendered.body.get("data-page") != "process" or rendered.body.get("data-root") != "..":
            problems.append("how-these-were-built/index.html is missing or has the wrong route attributes")
        else:
            for section in ("who", "workflow", "boundaries", "this-site", "reading"):
                if section not in rendered.ids:
                    problems.append(f"How these were built: missing section {section}")
            for phrase in retired_in("".join(rendered.main_text)):
                problems.append(f"how-these-were-built: page still says '{phrase}'")
        if process.get("route") != "how-these-were-built/":
            problems.append("site.process.route must be how-these-were-built/")

    # Course titles were verified by the owner on 2026-10-29; the old caveats must not return.
    if a.get("courseVerification"):
        thinking = parsed.get(academic_page.resolve())
        for phrase in retired_in("".join(thinking.main_text) if thinking else ""):
            problems.append(f"applied-thinking: verified coursework page still says '{phrase}'")
    for where, node in voiced:
        for text in strings(node):
            for phrase in retired_in(text):
                problems.append(f"{where}: retired phrase '{phrase}'")

    # Content-managed images are injected at runtime, so the shell parser cannot see them.
    for project in content["projects"]:
        for field in ("thumbnail",):
            ref = project.get(field)
            if ref and not (ROOT / ref).is_file():
                problems.append(f"{project['slug']}: missing {field} image {ref}")
        visuals = project.get("visuals", [])
        if len(visuals) != 2:
            problems.append(f"{project['slug']}: expected exactly two visual entries")
        for visual in visuals:
            ref = visual.get("src", "")
            if not ref.startswith("assets/visuals/") or not (ROOT / ref).is_file():
                problems.append(f"{project['slug']}: missing or invalid visual {ref!r}")
            if not visual.get("alt") or not visual.get("caption"):
                problems.append(f"{project['slug']}: image is missing alt text or caption")

    pending = pending_items(content)
    links = [p for p in pending if p.endswith(".repoUrl")]
    print(f"Pages checked: {len(pages)}; projects: {len(slugs)}")
    print(f"Local references and fragments checked: {link_count}")
    print(f"Open items: {len(pending) - len(links)} placeholders, {len(links)} unpublished links")
    for path in pending:
        print(f"  - {path}")
    unlisted = content["site"].get("searchIndexing") is False
    if unlisted:
        missing = sorted(set(p.relative_to(ROOT).as_posix() for p in pages) - set(noindex_pages))
        problems += [f"{p}: missing robots noindex tag (site.searchIndexing is false)" for p in missing]
        print(f"Search indexing off: robots noindex tag on {len(noindex_pages)} of {len(pages)} pages")
    elif noindex_pages:
        print(f"Draft robots noindex tag on {len(noindex_pages)} pages")

    if release:
        problems += [f"open item: {p}" for p in pending]
        if not unlisted:
            problems += [f"{p}: draft robots noindex tag still present" for p in noindex_pages]

    for problem in problems:
        print(f"FAIL  {problem}")
    print("RESULT:", "FAIL" if problems else "PASS", "(release gate)" if release else "(draft check)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

