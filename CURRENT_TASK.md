# Applied Thinking — Phase 3 review build

Implemented against `main` commit `e718aa61d420eb36d3413761f7f3e2a40b6ea8cd` on 2026-10-28.

## Changes

- Added `/applied-thinking/`: nine sections, eight principles grouped four and four, five conceptual connections, six workflow operations, four canonical case-study bridges, and two original static SVG diagrams.
- Added a compact homepage preview after Professional Experience and an Applied Thinking navigation item.
- Added Academic connections sections to all four existing case studies, with links back to the relevant principles.
- Kept content in `content/site.json`. The original site, owner and project values are unchanged; no name, biography, contact or résumé details were added.
- Generated all six pages through the existing renderer so content, navigation, native details and disclosures work without JavaScript. A failed JSON fetch retains the generated page.
- Extended checks for rendered local links and fragments, IDs, canonical slugs, disclosures, static snapshot freshness and publication review state.

## Editorial decisions and deviations

- Shortened the second hero paragraph to meet the approximately 90-word hero budget; the limitations section retains the broader qualification.
- Rendered method and academic concept detail inside native expandable details. Questions, explanations and limitations remain visible.
- Labeled the academic table as unverified areas drawn from résumé drafts, rather than confirmed completed courses. Principle details explicitly distinguish conceptual links from verified titles.
- Deferred detailed unpublished academic-project mentions, following the supplied default. No new academic project pages or links were created.
- Removed literal single-asterisk emphasis around a phrase because the existing inline renderer supports code and bold only; its wording is preserved.
- Added visible draft status and noindex tags to this review build. These are generated from the content review record, not owner approval claims.
- Phase 4 simulations remain outside this build.

## Validation

- JavaScript syntax and renderer regression checks: pass.
- Static snapshots: six current pages.
- Draft site check: pass; 192 local references and anchors; zero personal placeholders or unpublished links.
- Original site, owner and project data: exact structural match to baseline.
- Browser: desktop view; narrow iframe widths of 390 and 320 pixels (content widths 375 and 305 after scrollbars), no horizontal overflow; all eight principles present.
- Keyboard: skip link focuses main; Enter toggles principle details; anchored navigation and case-study return link verified.
- JavaScript-disabled sandbox: static page and native details work.
- Publication gate: expected failure while editorial approvals and course verification remain pending; draft noindex tags remain.

## Open items

No personal-data placeholders were introduced. Publication review remains pending for first-person voice, terminology, exact academic titles, professional boundaries, public-project distinction and authorship. Record actual owner decisions in `appliedThinking.review` and update copy where needed before changing `draftStatus` to `approved`.

This build is for review. Nothing has been merged or deployed.
