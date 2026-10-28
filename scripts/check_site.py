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
    pages = sorted(ROOT.glob("index.html")) + sorted(ROOT.glob("projects/*/index.html")) + ([academic_page] if academic_page.is_file() else [])
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
    if noindex_pages:
        print(f"Draft robots noindex tag on {len(noindex_pages)} pages")

    if release:
        problems += [f"open item: {p}" for p in pending]
        problems += [f"{p}: draft robots noindex tag still present" for p in noindex_pages]

    for problem in problems:
        print(f"FAIL  {problem}")
    print("RESULT:", "FAIL" if problems else "PASS", "(release gate)" if release else "(draft check)")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())

