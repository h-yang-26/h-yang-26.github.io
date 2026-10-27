# Visual sources and accuracy notes

Eight SVG visuals are rendered on the public GitHub Pages site. They use fictional
data and summarize the independent public repositories, **not proprietary
workplace data, code, workflows or deployment architecture**.

| SVGs | Public reference and interpretation |
|---|---|
| data-quality-flow, data-quality-results | `synthetic-data-quality-pipeline/dq_pipeline/` and `outputs/summary.json`: 60 = 37 accepted + 23 rejected; accepted categories 7, 9, 9, 5, 7. |
| inventory-model, inventory-scenarios | `inventory-shipping-optimization-lab/shiplab/model.py` and `results/example_results.json`: five 309-demand scenarios. Mass/volume feasibility only, no 3D packing; costs are scenario-specific fictional units. |
| analytics-pipeline, analytics-funnel | `product-usage-analytics-demo/data/synthetic_events.csv`, `usage_analytics/validation.py`, `usage_analytics/metrics.py`: 5,766 raw rows = 5,735 valid + 10 collapsed + 8 quarantined + 13 rejected. Ordered funnel all modules, Sep 1–28 2026 UTC: 1357 / 844 / 619 sessions. |
| b2b-lifecycle, b2b-quantities | `b2b-sales-systems-case-study/examples/fictional-order-scenario.json` and `docs/system-architecture.md`: 4 quoted, 2 ordered, 1 shipped, 1 open. The 2 unconverted quote units are not committed demand. |

Illustrations are original SVG diagrams. Diagram layouts simplify presentation
and do not claim to be a literal implementation architecture. The display has
no hidden computation or adjustable parameters; interactive demonstrations
would require a separately verified implementation.

To update quantitative figures, rerun the reference projects, review the
resulting synthetic artifacts and update the SVG source accordingly. Never
copy employer datasets or system diagrams into this directory.
