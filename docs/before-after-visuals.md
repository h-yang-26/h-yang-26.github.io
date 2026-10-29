# Split-screen monitor transformation previews (reference-based redesign)

The comparison graphic deliberately adopts the user's single-monitor split-screen visual reference: a raw spreadsheet-style interface on the left, a polished dashboard-style interface on the right, a strong central divider, and prominent BEFORE and AFTER labels above the screen. It is rendered with original HTML/CSS and existing synthetic-data SVG results, not reproduced from the reference image.

## Source honesty

- Every before screen is an **illustrative fictional UI**: sample spreadsheet rows are designed to show the class of problem, NOT copied from employer records or asserted to match the literal committed data rows.
- Every after screen is an **illustrative dashboard shell** around a verified public-demo chart or the checked hypothetical B2B example. It is NOT an employer dashboard screenshot or a record of improvements to a live system.
- Numeric KPI summaries derive from the public project's previously documented synthetic results. Do not add unverified uplift percentages, revenue, or saved-hours claims.
- The site's existing real-professional-work versus simplified-public-demo boundary, tests, technical figures and provenance sections are unchanged.

## Four screen designs

1. Data quality: messy equipment inventory rows → synthetic 60 / 37 / 23 validation report.
2. Shipping: unallocated demand and capacity/cost constraints → fictional 309 requested, five shipping scenarios, 130 tests.
3. Product analytics: noisy raw event logs → synthetic 5,735 valid events, 31 excluded, and the ordered funnel.
4. B2B sales: mixed quotation/order/shipment records → conceptual 4 quoted, 2 ordered, 1 shipped.

## Implementation

`projects[].transformation.beforeHeaders`, `beforeRows`, `afterMetrics`, `screenTitle` etc. in `content/site.json` are the content source. `assets/js/render.js` builds HTML mock UIs and reuses the existing `picture()` chart renderer; `assets/css/site.css` draws the monitor bezel, split screen, stand, dashboard chrome, and responsive stacked mobile view. No new tracking, remote images or third-party code. The static `index.html` and four case study pages are regenerated from the renderer.

## Verification

`node scripts/check_renderer.mjs`; `node scripts/render_static.mjs --check`; `python scripts/build_visuals.py --check`; `python scripts/check_site.py --release`. Verify in real browser at desktop, narrow desktop, 390px and 320px, dark theme, with JS disabled.
