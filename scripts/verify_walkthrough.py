"""Optional: check the B2B case study's order walk-through against its source scenario.

`projects[b2b-sales-systems-case-study].story.walkthrough` steps through the
fictional order in the B2B case study's `examples/fictional-order-scenario.json`.
This script compares the steps with that file. It uses only the standard
library but needs a checkout of https://github.com/h-yang-26/b2b-sales-systems-case-study:

    python scripts/verify_walkthrough.py --repo ../b2b-sales-systems-case-study

It checks that the step marked as the scenario snapshot matches
`quantity_summary_at_snapshot`, that the last step matches
`changed_condition_walkthrough.after`, that the on-hand and reserved figures
match `inventory.stock_history` and the walk-through events, and that the
record ids named in each step exist in the scenario.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True, help="path to a checkout of the B2B case study")
    args = parser.parse_args()
    content = json.loads((ROOT / "content/site.json").read_text(encoding="utf-8"))
    project = next(p for p in content["projects"] if p["slug"] == "b2b-sales-systems-case-study")
    steps = project["story"]["walkthrough"]["steps"]
    scenario_text = (Path(args.repo) / "examples/fictional-order-scenario.json").read_text(encoding="utf-8")
    scenario = json.loads(scenario_text)
    problems = []

    def expect(label, got, want):
        if got != want:
            problems.append(f"{label}: walk-through says {got}, scenario says {want}")

    snap = scenario["quantity_summary_at_snapshot"]
    snapshot_step = next(s for s in steps if s.get("badge"))["values"]
    for key, field in (("quoted", "quoted_quantity"), ("ordered", "ordered_quantity"), ("shipped", "shipped_quantity"),
                       ("owed", "remaining_order_quantity"), ("onHand", "on_hand_quantity"), ("reserved", "reserved_quantity_open")):
        expect(f"snapshot {key}", snapshot_step[key], snap[field])
    expect("snapshot committed demand", snapshot_step["committed"], scenario["demand_signals"]["committed_demand_units"])

    after = scenario["changed_condition_walkthrough"]["after"]
    final = steps[-1]["values"]
    for key, field in (("quoted", "quoted_quantity"), ("ordered", "ordered_quantity"), ("shipped", "shipped_quantity"),
                       ("owed", "remaining_order_quantity"), ("onHand", "on_hand_quantity"), ("reserved", "reserved_quantity_open"),
                       ("committed", "committed_demand_units")):
        expect(f"final {key}", final[key], after[field])

    # Stock history: after the quote (on hand 1, nothing reserved), the reservation, and the shipment.
    history = scenario["inventory"]["stock_history"]
    expect("quote step on hand", steps[0]["values"]["onHand"], history[0]["on_hand"])
    expect("quote step reserved", steps[0]["values"]["reserved"], history[0]["reserved"])
    expect("reservation step reserved", steps[2]["values"]["reserved"], history[1]["reserved"])
    expect("shipment step on hand", steps[3]["values"]["onHand"], history[2]["on_hand"])
    events = scenario["changed_condition_walkthrough"]["events"]
    expect("restock step on hand", steps[4]["values"]["onHand"], events[1]["on_hand_after"])
    expect("restock step reserved", steps[4]["values"]["reserved"], events[1]["reserved_after"])

    # Every step is internally consistent, and every record id it names is in the scenario.
    for i, step in enumerate(steps, 1):
        v = step["values"]
        expect(f"step {i} still owed", v["owed"], v["ordered"] - v["shipped"])
        expect(f"step {i} committed demand", v["committed"], v["ordered"])
        expect(f"step {i} added-up row", v["naive"], v["quoted"] + v["ordered"] + v["shipped"])
        for record in step.get("records", []):
            if record not in scenario_text:
                problems.append(f"step {i}: record id {record} is not in the scenario")
    if problems:
        print("\n".join(problems))
        sys.exit(1)
    print(f"PASS: {len(steps)} steps match the scenario's snapshot, stock history and walk-through.")


if __name__ == "__main__":
    main()
