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

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for name in ("href", "src"):
            if a.get(name):
                self.refs.append(a[name])
        if tag == "body":
            self.body = a
        if tag == "meta" and a.get("name") == "robots" and "noindex" in (a.get("content") or ""):
            self.robots_noindex = True


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

    pages = sorted(ROOT.glob("index.html")) + sorted(ROOT.glob("projects/*/index.html"))
    page_slugs = set()
    noindex_pages = []
    for page in pages:
        parser = RefParser()
        parser.feed(page.read_text(encoding="utf-8"))
        rel = page.relative_to(ROOT).as_posix()
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

    pending = pending_items(content)
    links = [p for p in pending if p.endswith(".repoUrl")]
    print(f"Pages checked: {len(pages)}; projects: {len(slugs)}")
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
