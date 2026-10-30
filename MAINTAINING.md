# Maintaining the site

How this site is built, edited, checked and published. The visitor-facing overview is in [README.md](README.md).

## How it works

- All text, project content and personal details live in `content/site.json`. `assets/js/render.js` renders every page from it; `assets/css/site.css` styles them. The site sets no cookies and loads no analytics or third-party scripts.
- `index.html`, `applied-thinking/`, `how-these-were-built/` and `projects/*/` hold generated snapshots of each page, so the pages read without JavaScript and show correctly in link previews. Regenerate them with `node scripts/render_static.mjs` after any content or layout change (Node 18+).
- `scripts/build_visuals.py` generates every figure in `assets/visuals/` (wide, narrow, card and tile layouts, light and dark), including the tiles and before/after banners in `scripts/marketing_visuals.py`, and records their sizes in `content/site.json`. Run it before `render_static.mjs` after changing figure data or layout (Python 3.9+, no dependencies). Data sources and design rules are in [`assets/visuals/README.md`](assets/visuals/README.md).

## Personal details

Contact details live in the `owner` section of `content/site.json`. A field with a value is shown; a field that is `null` or `false` is hidden. The site never shows placeholders, so you can fill fields in one at a time.

To leave them out:

```json
"name": false,
"email": false,
"resume": false,
"otherLinks": false,
```

To show them:

```json
"name": "Your Full Name",
"email": "you@example.com",
"resume": {"label": "Résumé (PDF)", "url": "assets/resume.pdf"},
"otherLinks": [{"label": "LinkedIn", "url": "https://www.linkedin.com/in/your-profile/"}],
```

- JSON is case-sensitive: write `false` and `null` in lowercase, without quotes.
- `resume.url` can be a file in this repo (upload it to `assets/`) or a full `https://` link. A file committed here stays in the repository history even after it is deleted; an external link can be withdrawn.
- `otherLinks` is a list; each entry becomes a hero button and a Contact link.
- Optional: `intro` (one paragraph), `bio` (a list of paragraphs, which replaces the About text) and `skills` (a list of strings). They are currently `false`.
- `python scripts/check_site.py` lists fields that are still `null` as a reminder, without failing, and fails if any page shows a placeholder.

After editing, run `node scripts/render_static.mjs` and the checks below.

## Search engines

`site.searchIndexing` in `content/site.json` is `false`, which adds `<meta name="robots" content="noindex, nofollow">` to every page so search engines are asked not to list the site. To be findable by search, set it to `true` and run `node scripts/render_static.mjs`. `check_site.py` fails if any page is missing the tag while indexing is off. This covers the website only: the files in this public repository can still be read and searched on GitHub.

## Content model

- `site.hero`: the homepage hero (eyebrow, title, lede, primary button, before/after banner). Résumé, email, LinkedIn and GitHub buttons come from the `owner` fields.
- `site.howIWork`: the homepage tiles, each naming the project it links to and the principle it illustrates.
- `site.work`, `site.experience`, `site.about`: homepage sections. Experience reuses `owner.professionalExperience` verbatim; `site.about.aiTools` lists the AI tools used.
- `site.process`: the "How these were built" page, linked from the footer and from each case study's "My role" section.
- `site.disclosure`: the one-line disclosure in every page's footer.
- `projects[].card`: the homepage card's kicker and one-line outcome.
- `projects[].story`: each case study (headline, lede, facts, banner, situation, 2–4 decisions, result, next steps, technical notes). A decision can carry a tile whose principle must be approved for that project.
- `appliedThinking.principles[]`: the eight principles. Each has a tile (`visual`) and the project its scene comes from, which must be approved for that principle; P3 is conceptual and uses no project data.
- `appliedThinking.academicFoundations.rows[]`: the coursework table. A row can set `principle` and use `{principle}` in its text to link to that principle's card.
- `owner.projectStatements` and `owner.professionalExperience`: the owner's own words, reused verbatim.

## Checks

```bash
python scripts/build_visuals.py --check   # figures match their generator
node scripts/render_static.mjs --check    # snapshots are current
node scripts/check_renderer.mjs           # rendering, escaping and page structure
python scripts/check_site.py              # links, content rules and voice check
python scripts/check_site.py --release    # also checks publication approvals and search settings
```

`check_site.py` checks local links and fragments, required case-study fields, that each tile's principle is approved for its project, and that retired labels such as "agent-run" or "unverified" don't return.

## Local preview

Run `node scripts/render_static.mjs`, then `python -m http.server 8000` from this directory and open `http://localhost:8000/`.

## Records

The owner authorized publication of Applied Thinking on 2026-10-28 and verified the course list on 2026-10-29. Both are recorded in `appliedThinking.publicationApproval` and `appliedThinking.courseVerification`.

## Deployment

GitHub Pages serves the site from the root of `main` at https://h-yang-26.github.io/. Changes go through pull requests; merging to `main` publishes them within a minute or two. The Python projects run locally from their own repositories; the site doesn't run Python or Streamlit.

## License

No license is currently granted for original material in this repository; a license can be chosen later.
