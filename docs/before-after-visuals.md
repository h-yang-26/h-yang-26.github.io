# Before/after: case-study visual template

Each of the four homepage project cards shows a compact input/after diagram; the corresponding case study opens with the large version. Both are generated from content/site.json, share the same HTML/CSS, and work without JavaScript.

**Before** = a clearly labelled schematic input or modelling question (not a screenshot, employer record, production defect or measured baseline). **After** = the project's existing generated public-demo SVG results or checked hypothetical arithmetic, not employer performance. The feature contains a visible project-specific disclosure.

- Data quality: inconsistent source-row types → 37 accepted and 23 flagged (60 fictional rows).
- Inventory: 309 requested units and allocation constraints → five synthetic shipped/short scenarios. Not an operational savings comparison.
- Analytics: 5,766 raw fictional events and validation questions → ordered funnel 1,357 / 844 / 619.
- B2B sales: quoted / ordered / shipped counts → distinct business facts and remaining fulfillment, a conceptual model.

The right-side image uses generated dark/light responsive SVG variants; the left-side graphic is a CSS UI illustration. The compact version is on the homepage, the expanded version at the start of each case study, and existing diagrams still appear in the technical section. On narrow viewports the panels stack vertically.

Verify with `node scripts/check_renderer.mjs`, `node scripts/render_static.mjs --check`, `python scripts/build_visuals.py --check`, and `python scripts/check_site.py --release`. Review light/dark mode, accessibility and 320/390px layouts in a browser before merging.
