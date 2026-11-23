"""Optional: re-solve the shipping lab's model to verify `site.hero.decisionLab`.

The homepage decision sheet lets a visitor change the shortage cost and see
which plan is cheaper. Its numbers are not typed in: each plan's container
charge, shortage cost, units shipped and units short come from solving the
inventory lab's `tight_capacity` containers and stock (PuLP + CBC) with the
container choice fixed (Plan A: large only; Plan B: both), at every slider
position. The solver is not needed to build or check the site, so this script
is separate from `check_site.py` and needs PuLP.

Usage, from the repository root, with a checkout of
https://github.com/h-yang-26/inventory-shipping-optimization-lab:

    pip install pulp==3.3.2
    python scripts/verify_decision_lab.py --lab ../inventory-shipping-optimization-lab

It fails if any plan's shipped/short units or cost differ from the content file
at any slider position, or if the lab's published `tight_capacity` and
`high_shortage_penalty` totals (2976 and 8660) are not reproduced.
"""
import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def solve(base, mult, opened):
    """Optimal plan for one fixed container choice. `opened` maps container id -> bool."""
    import pulp
    products, containers = base["products"], base["containers"]
    model = pulp.LpProblem("decision_lab", pulp.LpMinimize)
    x = {(p["id"], c["id"]): pulp.LpVariable(f"x_{p['id']}_{c['id']}", 0, cat="Integer") for p in products for c in containers}
    shipped = {p["id"]: pulp.lpSum(x[p["id"], c["id"]] for c in containers) for p in products}
    fixed = pulp.lpSum(c["fixed_cost"] * int(opened[c["id"]]) for c in containers)
    model += fixed + pulp.lpSum(mult * p["shortage_penalty"] * (p["demand"] - shipped[p["id"]]) for p in products)
    for p in products:
        model += shipped[p["id"]] <= min(p["stock"], p["demand"])
    for c in containers:
        cap = int(opened[c["id"]])
        model += pulp.lpSum(p["unit_mass_kg"] * x[p["id"], c["id"]] for p in products) <= c["capacity_kg"] * cap
        model += pulp.lpSum(p["unit_volume_m3"] * x[p["id"], c["id"]] for p in products) <= c["capacity_m3"] * cap
    model.solve(pulp.PULP_CBC_CMD(msg=0))
    if pulp.LpStatus[model.status] != "Optimal":
        raise SystemExit(f"solver status {pulp.LpStatus[model.status]} at {mult}x")
    ships = {p["id"]: round(sum(x[p["id"], c["id"]].value() for c in containers)) for p in products}
    n = sum(ships.values())
    charge = sum(c["fixed_cost"] for c in containers if opened[c["id"]])
    penalty = sum(p["shortage_penalty"] * (p["demand"] - ships[p["id"]]) for p in products)
    return {"fixed": charge, "shortage_at_1x": penalty, "shipped": n, "short": sum(p["demand"] for p in products) - n,
            "total": charge + mult * penalty}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--lab", required=True, help="path to a checkout of the inventory lab")
    args = parser.parse_args()
    lab = json.loads((ROOT / "content/site.json").read_text(encoding="utf-8"))["site"]["hero"]["decisionLab"]
    scenarios = {s["name"]: s for s in json.loads((Path(args.lab) / "data/scenarios.json").read_text(encoding="utf-8"))["scenarios"]}
    base = scenarios["tight_capacity"]
    large = next(c["id"] for c in base["containers"] if c["capacity_m3"] == max(k["capacity_m3"] for k in base["containers"]))
    opened = {"A": {c["id"]: c["id"] == large for c in base["containers"]}, "B": {c["id"]: True for c in base["containers"]}}
    problems = []
    steps = round((lab["max"] - lab["min"]) / lab["step"])
    for i in range(steps + 1):
        m = round(lab["min"] + i * lab["step"], 6)
        for plan in lab["plans"]:
            got = solve(base, m, opened[plan["id"]])
            want = {"fixed": plan["fixed"], "shortage_at_1x": plan["shortage"], "shipped": plan["shipped"], "short": plan["short"]}
            for key, value in want.items():
                if abs(got[key] - value) > 1e-6:
                    problems.append(f"plan {plan['id']} at {m}x: {key} is {got[key]}, content says {value}")
    # The lab's own published totals.
    for mult, plan, published in ((1, "A", 2976.0), (4, "B", 8660.0)):
        total = solve(base, mult, opened[plan])["total"]
        if abs(total - published) > 1e-6:
            problems.append(f"published total at {mult}x is {published}, solver gives {total}")
    if problems:
        print("\n".join(problems))
        sys.exit(1)
    print(f"PASS: {steps + 1} slider positions x {len(lab['plans'])} plans reproduce the content file and the lab's published totals.")


if __name__ == "__main__":
    main()
