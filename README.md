# Independent Technical Portfolio

Static GitHub Pages site showing four independently constructed fictional demonstrations: data-quality ETL, shipping allocation optimization, product analytics, and conceptual B2B sales systems design.

No personal biography, personal contact address, resume link, or owner-specific first-person statement is published in this release. The associated source repositories are linked from the case studies. All example numbers are synthetic and must not be read as employer outcomes.

## Site files

- `content/site.json` contains text and project descriptions. Personal fields are explicitly omitted (`false`) and can be added later.
- `assets/` contains plain CSS/JavaScript; no analytics or third-party scripts.
- `projects/*/index.html` contains the four case-study shells.
- `scripts/check_site.py --release` verifies the static structure and placeholder state.

## Local preview

Run `python -m http.server 8000` from this directory, then open `http://localhost:8000/`. Opening the HTML directly via `file://` will not load the JSON content.

## Deployment

The intended repository is `h-yang-26/h-yang-26.github.io`, with GitHub Pages deployed from the `main` branch root. The deployment URL is `https://h-yang-26.github.io/`.

The three Python demos execute locally from their respective repositories; the website does not run Python or Streamlit.

## License

No license is currently granted for original material in this repository; a license can be chosen later.
