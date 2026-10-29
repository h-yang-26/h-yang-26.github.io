# Independent Technical Portfolio

Static GitHub Pages site showing four independently constructed fictional demonstrations: data-quality ETL, shipping allocation optimization, product analytics, and conceptual B2B sales systems design.

No personal biography, personal contact address, or resume link is published in this release. Approved first-person contribution and professional-experience statements appear in the case studies, distinguishing workplace responsibilities from fictional, independent artifacts. The associated source repositories are linked from the case studies. All example numbers are synthetic and must not be read as employer outcomes.

## Site files

- `content/site.json` contains text and project descriptions. Personal fields are explicitly omitted (`false`) and can be added later.
- `assets/` contains plain CSS/JavaScript; no analytics or third-party scripts.
- `applied-thinking/index.html` explains eight reasoning principles, with static diagrams and case-study connections.
- `index.html`, `applied-thinking/index.html` and `projects/*/index.html` include generated HTML for visitors without JavaScript.
- `scripts/render_static.mjs` generates these snapshots with the shared renderer; run it after editing JSON or layout code (Node 18+).
- `scripts/build_visuals.py` generates every figure in `assets/visuals/` (wide, narrow and card layouts, light and dark), including the tiles and before/after banners in `scripts/marketing_visuals.py`, and records sizes on every figure entry in `content/site.json`; run it before `render_static.mjs` after changing figure data or layout (Python 3.9+, no dependencies).

## Content model for the redesign

- `site.hero`: the homepage positioning hero (eyebrow, title, lede, primary button, headline figure). Résumé, email, LinkedIn and GitHub buttons appear automatically from the `owner` fields that are set; pending or omitted fields add nothing to the hero.
- `site.disclosure`: the single one-line disclosure used on story pages.
- `projects[].story`: a decision-led case study (headline, lede, facts, banner, situation, 2–4 decisions, result, what's next, technical notes). A project with a `story` renders with the new template; projects without one keep the original template until they are migrated. Owner statements (`professionalContext`, `contribution`, `learned`) are reused verbatim.
- `check_site.py` enforces the story fields and a voice check: the hero, the disclosure, every story and every rendered story page must not use retired labels such as "agent-run" or "unverified".
- `scripts/check_site.py --release` verifies the static structure and placeholder state.

## Local preview

Run `node scripts/render_static.mjs`, then `python -m http.server 8000` from this directory and open `http://localhost:8000/`. The generated HTML also remains readable when JavaScript or the JSON fetch is unavailable.

Run `node scripts/check_renderer.mjs` and `python scripts/check_site.py` for draft validation. The checker also verifies that all generated snapshots are current.

The owner authorized publication of Applied Thinking on 2026-10-28. Review status and the publication instruction are recorded in `appliedThinking.review` and `appliedThinking.publicationApproval`. This approves publication of the existing academic-topic caveats; transcript verification is not asserted. Regenerate snapshots after any content or status change.

## Deployment

The intended repository is `h-yang-26/h-yang-26.github.io`, with GitHub Pages deployed from the `main` branch root. The deployment URL is `https://h-yang-26.github.io/`.

The three Python demos execute locally from their respective repositories; the website does not run Python or Streamlit.

## License

No license is currently granted for original material in this repository; a license can be chosen later.

## Technical diagrams and synthetic result images

The homepage cards show each project's result chart; each case study shows a
system diagram and a result chart. All are generated SVGs with phone-sized and
dark-mode variants. Their data sources, fictional data boundaries and design rules
are documented in [`assets/visuals/README.md`](assets/visuals/README.md).
The figures are static; interactive calculators are not part of this release.

