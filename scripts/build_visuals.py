#!/usr/bin/env python3
"""Generate every SVG in assets/visuals/ from the data and layouts below.

Each figure is drawn in up to three layouts and two colour schemes:

  wide    760 px viewBox, used at 40rem and wider (project pages, tablets)
  narrow  420 px viewBox, a stacked layout used below 40rem (phones)
  card    440 px viewBox, a compact homepage thumbnail (result figures only)

  <name>.svg / <name>-dark.svg, <name>-narrow.svg / <name>-narrow-dark.svg,
  <name>-card.svg / <name>-card-dark.svg

Headline titles live in the HTML (content/site.json), not inside the images, so
the drawing area is spent on data. Minimum font sizes (wide 15, narrow 16,
card 17 viewBox units) keep labels at roughly 12 CSS px or more at the widths
where each layout is used. Colour pairs are checked against WCAG contrast
(4.5:1 for text, 3:1 for marks) every run.

All numbers are fictional and come from the committed outputs of the public
demonstration repositories; see assets/visuals/README.md for each source.

Usage:
  python scripts/build_visuals.py          # write SVGs and update variant sizes in site.json
  python scripts/build_visuals.py --check  # exit 1 if anything is out of date
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "visuals"
CONTENT = ROOT / "content" / "site.json"

FONT = "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
MIN_FONT = {"wide": 15, "narrow": 16, "card": 17}

# Light values match the site's light tokens; dark values match its dark surface.
THEMES = {
    "light": {
        "bg": "#FFFFFF", "text": "#1A1D21", "muted": "#4F5660", "line": "#7D8691",
        "boxFill": "#F4F6F8", "accent": "#1C5785", "accentFill": "#EAF1F7",
        "ok": "#146C67", "okFill": "#E3F2F0", "warn": "#8A5A0C", "warnFill": "#FBF1DE",
        "track": "#E5EAEF", "onMark": "#FFFFFF",
    },
    "dark": {
        "bg": "#191C1F", "text": "#E9E7E2", "muted": "#A9AEB5", "line": "#848D98",
        "boxFill": "#22272C", "accent": "#8CC0EA", "accentFill": "#1D2A36",
        "ok": "#6FCDC2", "okFill": "#16302D", "warn": "#E6B15C", "warnFill": "#33290F",
        "track": "#2B3137", "onMark": "#101418",
    },
}
# (foreground, background, minimum ratio): text 4.5:1, meaningful marks 3:1.
CONTRAST_PAIRS = [
    (fg, bg, 4.5) for fg in ("text", "muted", "accent", "ok", "warn")
    for bg in ("bg", "boxFill", "accentFill", "okFill", "warnFill")
] + [("onMark", mark, 4.5) for mark in ("accent", "ok", "warn")] + [
    (mark, "bg", 3.0) for mark in ("line", "accent", "ok", "warn")
]


def luminance(hex_colour):
    channels = [int(hex_colour[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    lin = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in channels]
    return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2]


def contrast(a, b):
    hi, lo = sorted((luminance(a), luminance(b)), reverse=True)
    return (hi + 0.05) / (lo + 0.05)


def check_contrast():
    problems = []
    for name, theme in THEMES.items():
        for fg, bg, minimum in CONTRAST_PAIRS:
            ratio = contrast(theme[fg], theme[bg])
            if ratio < minimum:
                problems.append(f"{name}: {fg} on {bg} is {ratio:.2f}:1 (needs {minimum}:1)")
    return problems


def esc(text):
    return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


class Fig:
    """A layout recorded with colour token names, rendered once per theme."""

    def __init__(self, w, h, layout):
        self.w, self.h, self.layout, self.items, self.min_font = w, h, layout, [], MIN_FONT[layout]

    def rect(self, x, y, w, h, fill, stroke=None, rx=10, dash=False, sw=1.5):
        self.items.append(("rect", dict(x=x, y=y, w=w, h=h, fill=fill, stroke=stroke, rx=rx, dash=dash, sw=sw)))

    def text(self, x, y, s, size, colour="text", weight=400, anchor="start", box=None):
        if size < self.min_font:
            raise ValueError(f"font {size} below the {self.layout} minimum {self.min_font}: {s!r}")
        self.items.append(("text", dict(x=x, y=y, s=s, size=size, colour=colour, weight=weight, anchor=anchor, box=box)))

    def lines(self, x, y, rows, anchor="start", box=None, gap=1.3):
        """rows: (text, size, colour, weight) tuples; y is the first baseline."""
        for i, (s, size, colour, weight) in enumerate(rows):
            if s:
                self.text(x, y, s, size, colour, weight, anchor, box)
            following = rows[i + 1][1] if i + 1 < len(rows) else size
            y += round(max(size, following) * gap) if s else round(size * 0.6)
        return y

    def arrow(self, points, colour="line", dash=False):
        self.items.append(("arrow", dict(points=points, colour=colour, dash=dash)))

    def box(self, x, y, w, h, title, sub=(), tone="neutral", eyebrow=None, dash=False, pad=14,
            title_size=None, sub_size=None, centre=False):
        fill, stroke = {"neutral": ("boxFill", "line"), "accent": ("accentFill", "accent"),
                        "ok": ("okFill", "ok"), "warn": ("warnFill", "warn")}[tone]
        self.rect(x, y, w, h, fill, stroke, dash=dash)
        title_size = title_size or self.min_font + 3
        sub_size = sub_size or self.min_font
        rows = []
        if eyebrow:
            rows.append((eyebrow, self.min_font, "muted" if tone == "neutral" else stroke, 700))
        rows += [(t, title_size, "text", 700) for t in ([title] if isinstance(title, str) else title)]
        rows += [(t, sub_size, "muted", 400) for t in sub]
        bounds = (x, y, w, h)
        if centre:
            self.lines(x + w / 2, y + pad + title_size * 0.8, rows, anchor="middle", box=bounds)
        else:
            self.lines(x + pad, y + pad + title_size * 0.8, rows, box=bounds)

    def render(self, theme_name, title):
        t = THEMES[theme_name]
        markers = sorted({i[1]["colour"] for i in self.items if i[0] == "arrow"})
        out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h}" width="{self.w}" height="{self.h}" role="img" aria-labelledby="t">',
               f'<title id="t">{esc(title)}</title>', "<defs>"]
        for c in markers:
            out.append(f'<marker id="m-{c}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
                       f'<path d="M0 0L10 5L0 10z" fill="{t[c]}"/></marker>')
        out.append("</defs>")
        out.append(f'<rect width="{self.w}" height="{self.h}" fill="{t["bg"]}"/>')
        out.append(f'<g font-family="{FONT}">')
        for kind, a in self.items:
            if kind == "rect":
                stroke = f' stroke="{t[a["stroke"]]}" stroke-width="{a["sw"]}"' if a["stroke"] else ""
                dash = ' stroke-dasharray="6 4"' if a["dash"] else ""
                out.append(f'<rect x="{a["x"]:g}" y="{a["y"]:g}" width="{a["w"]:g}" height="{a["h"]:g}" rx="{a["rx"]}" fill="{t[a["fill"]]}"{stroke}{dash}/>')
            elif kind == "text":
                weight = f' font-weight="{a["weight"]}"' if a["weight"] != 400 else ""
                anchor = f' text-anchor="{a["anchor"]}"' if a["anchor"] != "start" else ""
                box = ' data-box="{:g},{:g},{:g},{:g}"'.format(*a["box"]) if a["box"] else ""
                out.append(f'<text x="{a["x"]:g}" y="{a["y"]:g}" font-size="{a["size"]}" fill="{t[a["colour"]]}"{weight}{anchor}{box}>{esc(a["s"])}</text>')
            else:
                d = "M" + " L".join(f"{x:g} {y:g}" for x, y in a["points"])
                dash = ' stroke-dasharray="5 4"' if a["dash"] else ""
                out.append(f'<path d="{d}" fill="none" stroke="{t[a["colour"]]}" stroke-width="2"{dash} marker-end="url(#m-{a["colour"]})"/>')
        out.append("</g></svg>")
        return "\n".join(out) + "\n"


def hbar(f, x, y, w, h, value, scale, colour, label=None, label_size=None):
    """A horizontal bar of `value` units; the label sits inside if it fits, else after the bar."""
    length = value * scale
    if length > 0:
        f.rect(x, y, length, h, colour, rx=3)
    if label:
        size = label_size or f.min_font
        fits = len(label) * size * 0.62 + 16 <= length
        if fits:
            f.text(x + length - 8, y + h / 2 + size * 0.35, label, size, "onMark", 700, "end", (x, y, length, h))
        else:
            f.text(x + length + 8, y + h / 2 + size * 0.35, label, size, "text", 700)
    return length


def note(f, x, y, rows, anchor="start"):
    return f.lines(x, y, [(r, f.min_font, "muted", 400) for r in rows], anchor=anchor)


def key(f, x, y, entries):
    """Inline colour key: square swatch + label, matched by words as well as colour."""
    for colour, label, dashed in entries:
        f.rect(x, y - 12, 14, 14, colour if not dashed else "bg", colour if dashed else None, rx=3, dash=dashed)
        f.text(x + 20, y, label, f.min_font, "muted")
        x += 20 + len(label) * f.min_font * 0.56 + 22


# ---------------------------------------------------------------- data
DQ = {"input": 60, "accepted": 37, "rejected": 23, "reasons": [
    ("Duplicate ID", 4), ("Ambiguous category", 3), ("Invalid date", 3), ("Invalid quantity", 3),
    ("Unknown category", 3), ("Missing ID", 2), ("Missing quantity", 2), ("Missing category", 1),
    ("Missing date", 1), ("Missing item name", 1)]}
INV = {"demand": 309, "scenarios": [  # shipped, short, containers opened; ranked by units shipped
    ("Normal", 309, 0, "both containers opened"), ("High shortage penalty", 130, 179, "both containers opened"),
    ("Tight capacity", 112, 197, "large container only"), ("Low shortage penalty", 0, 309, "no container opened"),
    ("No inventory", 0, 309, "no stock to ship")]}
FUNNEL = [("Opened a page", "page_view", 1357), ("Then searched", "search", 844), ("Then viewed a detail", "detail_view", 619)]
EVENTS = {"raw": 5766, "valid": 5735, "collapsed": 10, "quarantined": 8, "rejected": 13}


def pct(n, d):
    return f"{round(100 * n / d)}%"


# ---------------------------------------------------------------- data quality
def dq_flow(layout):
    if layout == "wide":
        f = Fig(760, 300, layout)
        f.box(24, 76, 180, 128, "Source CSV", ["60 fictional rows", "IDs, categories,", "quantities, dates"])
        f.box(262, 60, 214, 160, "Row checks", ["trim whitespace", "exact category aliases", "ID, quantity and", "date rules"], "accent")
        f.box(566, 24, 170, 100, "Accepted", ["37 canonical rows"], "ok")
        f.box(566, 156, 170, 116, "Exceptions", ["23 rows held", "for human review"], "warn")
        f.arrow([(204, 140), (258, 140)])
        f.arrow([(476, 116), (520, 116), (520, 74), (562, 74)], "ok")
        f.arrow([(476, 168), (520, 168), (520, 214), (562, 214)], "warn")
        f.text(498, 62, "pass", 15, "ok", 700, "middle")
        f.text(498, 238, "fail", 15, "warn", 700, "middle")
        note(f, 24, 288, ["No fuzzy matching: an ambiguous category is reviewed, never guessed."])
        return f
    f = Fig(420, 556, layout)
    f.box(24, 20, 372, 92, "Source CSV", ["60 fictional rows: IDs, categories,", "quantities, dates"])
    f.arrow([(210, 112), (210, 140)])
    f.box(24, 144, 372, 136, "Row checks", ["trim whitespace", "exact category aliases", "ID, quantity and date rules"], "accent")
    f.arrow([(120, 280), (120, 336)], "ok")
    f.arrow([(300, 280), (300, 336)], "warn")
    f.text(130, 314, "pass", 16, "ok", 700)
    f.text(310, 314, "fail", 16, "warn", 700)
    f.box(24, 340, 178, 112, "Accepted", ["37 canonical", "rows"], "ok")
    f.box(218, 340, 178, 112, "Exceptions", ["23 rows held", "for review"], "warn")
    note(f, 24, 492, ["No fuzzy matching: an ambiguous", "category is reviewed, never guessed."])
    return f


def dq_results(layout):
    total, acc, rej, reasons = DQ["input"], DQ["accepted"], DQ["rejected"], DQ["reasons"]
    if layout == "card":
        f = Fig(440, 260, layout)
        scale = 392 / total
        f.rect(24, 24, acc * scale, 56, "ok", rx=3)
        f.rect(24 + acc * scale, 24, rej * scale, 56, "warn", rx=3)
        f.text(36, 60, "37 accepted", 19, "onMark", 700)
        f.text(404, 60, "23 to review", 19, "onMark", 700, "end")
        f.text(24, 118, "Most common reasons", 17, "muted", 700)
        y = 136
        for label, n in reasons[:3]:
            f.text(24, y + 20, label, 17, "text")
            hbar(f, 230, y + 4, 0, 22, n, 34, "warn")
            f.text(230 + n * 34 + 8, y + 21, str(n), 17, "text", 700)
            y += 38
        return f
    wide = layout == "wide"
    W = 760 if wide else 420
    label_w = 210 if wide else 168
    bar_x = 24 + label_w + 12
    bar_max = (W - 24 - 44) - bar_x
    row = 34 if wide else 36
    f = Fig(W, 0, layout)
    scale = (W - 48) / total
    f.rect(24, 24, acc * scale, 52, "ok", rx=3)
    f.rect(24 + acc * scale, 24, rej * scale, 52, "warn", rx=3)
    size = 19 if wide else 18
    f.text(38, 57, "37 accepted", size, "onMark", 700)
    f.text(W - 38, 57, "23 to review", size, "onMark", 700, "end")
    y = note(f, 24, 104, [f"37 + 23 = {total}: every input row is accounted for."])
    f.text(24, y + 16, "Why the 23 rows went to review (one code each)" if wide else "Why 23 rows went to review", f.min_font + 1, "text", 700)
    y += 34
    unit = bar_max / max(n for _, n in reasons)
    for label, n in reasons:
        f.text(24 + label_w, y + 18, label, f.min_font, "text", 400, "end")
        f.rect(bar_x, y + 4, n * unit, 20, "warn", rx=3)
        f.text(bar_x + n * unit + 8, y + 19, str(n), f.min_font, "text", 700)
        y += row
    f.h = y + 16
    return f


# ---------------------------------------------------------------- inventory
def inv_model(layout):
    if layout == "wide":
        f = Fig(760, 330, layout)
        f.box(24, 24, 200, 132, "Products", ["stock and demand", "shortage penalty", "unit mass, volume"])
        f.box(24, 178, 200, 106, "Containers", ["mass and volume limits", "fixed opening charge"])
        f.box(264, 64, 254, 180, "Integer program", ["decides units per container,", "short units and which", "containers open", "", "minimizes shortage penalties", "+ opening charges"], "accent")
        f.box(572, 76, 164, 156, "Checker", ["re-verifies limits,", "integers and cost", "", "OPTIMAL only if", "both agree"], "ok")
        f.arrow([(224, 90), (242, 90), (242, 130), (260, 130)])
        f.arrow([(224, 231), (242, 231), (242, 178), (260, 178)])
        f.arrow([(518, 154), (568, 154)])
        f.text(543, 142, "plan", 15, "muted", 700, "middle")
        note(f, 24, 314, ["Mass and volume feasibility only: not a 3D packing or load-restraint plan."])
        return f
    f = Fig(420, 630, layout)
    f.box(24, 20, 178, 128, "Products", ["stock, demand", "shortage penalty", "mass, volume"])
    f.box(218, 20, 178, 128, "Containers", ["mass, volume", "limits; fixed", "opening charge"])
    f.arrow([(113, 148), (113, 172), (190, 172), (190, 192)])
    f.arrow([(307, 148), (307, 172), (230, 172), (230, 192)])
    f.box(24, 196, 372, 168, "Integer program", ["decides units per container, short", "units and which containers open", "", "minimizes shortage penalties", "+ opening charges"], "accent")
    f.arrow([(210, 364), (210, 412)])
    f.text(222, 394, "plan", 16, "muted", 700)
    f.box(24, 416, 372, 112, "Checker", ["re-verifies limits, integers and cost", "", "OPTIMAL only if both agree"], "ok")
    note(f, 24, 566, ["Mass and volume feasibility only: not", "a 3D packing or load-restraint plan."])
    return f


def inv_scenarios(layout):
    demand, rows = INV["demand"], INV["scenarios"]
    if layout == "card":
        f = Fig(440, 260, layout)
        key(f, 24, 30, [("ok", "Shipped", False), ("warn", "Short", False)])
        names = {"High shortage penalty": "High penalty", "Low shortage penalty": "Low penalty", "No inventory": "No stock"}
        scale = 248 / demand
        y = 50
        for name, shipped, short, _ in rows:
            f.text(24, y + 22, names.get(name, name), 17, "text")
            x = 168
            if shipped:
                f.rect(x, y + 6, shipped * scale, 24, "ok", rx=3)
            if short:
                f.rect(x + shipped * scale, y + 6, short * scale, 24, "warn", rx=3)
            y += 41
        return f
    wide = layout == "wide"
    W = 760 if wide else 420
    f = Fig(W, 0, layout)
    key(f, 24, 32, [("ok", "Units shipped", False), ("warn", "Units short", False)])
    y = 56
    if wide:
        bar_x, bar_w = 260, 476
        for name, shipped, short, note_text in rows:
            f.text(24, y + 20, name, 17, "text", 700)
            f.text(24, y + 41, note_text, 15, "muted")
            scale = bar_w / demand
            hbar(f, bar_x, y + 6, 0, 36, shipped, scale, "ok", str(shipped) if shipped else None, 17)
            if short:
                f.rect(bar_x + shipped * scale, y + 6, short * scale, 36, "warn", rx=3)
                f.text(bar_x + bar_w - 10, y + 30, f"{short} short", 17, "onMark", 700, "end", (bar_x + shipped * scale, y + 6, short * scale, 36))
            y += 62
    else:
        bar_w = W - 48
        for name, shipped, short, note_text in rows:
            f.text(24, y + 18, name, 17, "text", 700)
            scale = bar_w / demand
            hbar(f, 24, y + 28, 0, 32, shipped, scale, "ok", str(shipped) if shipped else None, 17)
            if short:
                f.rect(24 + shipped * scale, y + 28, short * scale, 32, "warn", rx=3)
                f.text(W - 34, y + 50, f"{short} short", 17, "onMark", 700, "end", (24 + shipped * scale, y + 28, short * scale, 32))
            y += 74
    y = note(f, 24, y + 14, [f"Each scenario requests {demand} units."]
             if wide else [f"Each scenario requests {demand} units."])
    f.h = y
    return f


# ---------------------------------------------------------------- analytics
def an_pipeline(layout):
    e = EVENTS
    excluded = e["raw"] - e["valid"]
    if layout == "wide":
        f = Fig(760, 330, layout)
        f.box(24, 40, 150, 112, f"{e['raw']:,}", ["raw rows"], title_size=22)
        f.box(208, 40, 160, 112, ["Validate +", "dedupe"], ["whole file"], "accent")
        f.box(402, 40, 150, 112, f"{e['valid']:,}", ["valid events"], "ok", title_size=22)
        f.box(586, 40, 150, 112, "Metrics", ["DAU, volume,", "module share,", "funnel"])
        f.arrow([(174, 96), (204, 96)])
        f.arrow([(368, 96), (398, 96)], "ok")
        f.arrow([(552, 96), (582, 96)])
        f.arrow([(288, 152), (288, 196)], "warn")
        f.box(164, 200, 250, 92, f"{excluded} excluded", [f"{e['collapsed']} identical copies collapsed", f"{e['quarantined']} conflicting, {e['rejected']} invalid"], "warn")
        note(f, 432, 230, ["Date and module filters", "apply only after file-wide", "validation."])
        return f
    f = Fig(420, 600, layout)
    f.box(24, 20, 372, 60, f"{e['raw']:,} raw rows", [])
    f.arrow([(210, 80), (210, 116)])
    f.box(24, 120, 372, 76, "Validate + dedupe", ["whole file, before any filters"], "accent")
    f.arrow([(110, 196), (110, 232)], "ok")
    f.arrow([(310, 196), (310, 232)], "warn")
    f.box(24, 236, 178, 92, f"{e['valid']:,}", ["valid events"], "ok", title_size=21)
    f.box(218, 236, 178, 172, f"{excluded} excluded", [f"{e['collapsed']} identical", "copies", f"{e['quarantined']} conflicting", f"{e['rejected']} invalid"], "warn")
    f.arrow([(113, 328), (113, 360)])
    f.box(24, 364, 178, 136, "Metrics", ["DAU, volume,", "module share,", "funnel"])
    note(f, 24, 540, ["Date and module filters apply only", "after file-wide validation."])
    return f


def an_funnel(layout):
    entry = FUNNEL[0][2]
    if layout == "card":
        f = Fig(440, 260, layout)
        y = 24
        for label, _, n in FUNNEL:
            f.text(24, y + 18, label, 18, "text", 700)
            f.text(416, y + 18, f"{n:,} · {pct(n, entry)}", 18, "text", 700, "end")
            f.rect(24, y + 30, 392, 26, "track", rx=3)
            f.rect(24, y + 30, 392 * n / entry, 26, "accent", rx=3)
            y += 78
        return f
    wide = layout == "wide"
    W = 760 if wide else 420
    f = Fig(W, 0, layout)
    y = 24
    if wide:
        bar_x, bar_w = 262, 340
        for label, code, n in FUNNEL:
            f.text(24, y + 22, label, 18, "text", 700)
            f.text(24, y + 44, code, 15, "muted")
            f.rect(bar_x, y + 6, bar_w, 40, "track", rx=3)
            f.rect(bar_x, y + 6, bar_w * n / entry, 40, "accent", rx=3)
            f.text(bar_x + bar_w + 14, y + 32, f"{n:,} · {pct(n, entry)}", 18, "text", 700)
            y += 70
    else:
        for label, code, n in FUNNEL:
            f.text(24, y + 18, label, 17, "text", 700)
            f.text(W - 24, y + 18, f"{n:,} · {pct(n, entry)}", 17, "text", 700, "end")
            f.rect(24, y + 30, W - 48, 32, "track", rx=3)
            f.rect(24, y + 30, (W - 48) * n / entry, 32, "accent", rx=3)
            y += 82
    y = note(f, 24, y + 12, [f"Share of the {entry:,} sessions that opened a page; each later step must happen afterwards."]
             if wide else [f"Share of the {entry:,} sessions that opened", "a page; each step must come later."])
    f.h = y
    return f


# ---------------------------------------------------------------- B2B
B2B_STEPS = [("CRM", "Opportunity", ["qualified lead"]), ("QUOTATION", "Quote", ["4 units offered"]),
             ("ORDERS", "Sales order", ["2 units committed"]), ("FULFILLMENT", "Shipment", ["1 unit shipped"])]


def b2b_lifecycle(layout):
    if layout == "wide":
        f = Fig(760, 330, layout)
        xs = [24, 212, 400, 588]
        for x, (owner, title, sub) in zip(xs, B2B_STEPS):
            f.box(x, 24, 160, 112, title, sub, "accent", eyebrow=owner)
        for x in xs[:-1]:
            f.arrow([(x + 160, 80), (x + 184, 80)])
        f.arrow([(292, 136), (292, 176)], dash=True)
        f.box(212, 180, 180, 92, "Not converted", ["2 units: a quote", "signal, not demand"], dash=True)
        f.arrow([(480, 136), (480, 176)], dash=True)
        f.box(404, 180, 192, 92, "Still owed", ["2 ordered − 1 shipped", "= 1 unit"], dash=True)
        note(f, 24, 314, ["Small capitals name the module that owns each fact. Dashed: derived or uncommitted."])
        return f
    f = Fig(420, 690, layout)
    y = 20
    for i, (owner, title, sub) in enumerate(B2B_STEPS):
        f.box(24, y, 196, 100, title, sub, "accent", eyebrow=owner)
        if i < 3:
            f.arrow([(122, y + 100), (122, y + 124)])
        if i == 1:
            f.arrow([(220, y + 50), (236, y + 50)], dash=True)
            f.box(240, y - 2, 156, 104, "Not converted", ["2 units: quote", "signal only"], dash=True, title_size=17)
        if i == 2:
            f.arrow([(220, y + 50), (236, y + 50)], dash=True)
            f.box(240, y - 2, 156, 104, "Still owed", ["2 ordered", "− 1 shipped = 1"], dash=True, title_size=17)
        y += 128
    f.h = note(f, 24, y + 20, ["Small capitals name the module that owns", "each fact. Dashed: derived or uncommitted."])
    return f


def b2b_quantities(layout):
    """Unit chart: each square is one centrifuge unit, so the nesting is countable."""
    rows = [("Quoted", [("accent", False)] * 4, "4 units offered"),
            ("Ordered", [("accent", False)] * 2 + [("line", True)] * 2, "2 committed, 2 not converted"),
            ("Shipped", [("ok", False), ("warn", True)], "1 shipped, 1 still owed")]
    if layout == "card":
        f = Fig(440, 260, layout)
        y = 26
        for label, units, _ in rows:
            f.text(24, y + 30, label, 18, "text", 700)
            for i, (colour, dashed) in enumerate(units):
                f.rect(130 + i * 72, y, 62, 46, colour if not dashed else "bg", colour if dashed else None, rx=6, dash=dashed, sw=2)
            y += 66
        key(f, 24, 240, [("ok", "Shipped", False), ("warn", "Owed", True)])
        return f
    wide = layout == "wide"
    W = 760 if wide else 420
    f = Fig(W, 0, layout)
    y = 24
    size = 56 if wide else 60
    step = size + 14
    x0 = 150 if wide else 24
    for label, units, caption in rows:
        if wide:
            f.text(24, y + size / 2 + 7, label, 19, "text", 700)
        else:
            f.text(24, y + 16, label, 18, "text", 700)
            y += 28
        for i, (colour, dashed) in enumerate(units):
            f.rect(x0 + i * step, y, size, size, colour if not dashed else "bg", colour if dashed else None, rx=8, dash=dashed, sw=2)
        if wide:
            f.text(x0 + 4 * step + 10, y + size / 2 + 6, caption, 15, "muted")
            y += size + 22
        else:
            note(f, 24, y + size + 24, [caption])
            y += size + 44
    y = note(f, 24, y + 14, ["One square = one unit. Unconverted quote units are not demand.", "Remaining quantity = ordered − shipped = 1 unit."]
             if wide else ["One square = one unit. Unconverted", "quote units are not demand.", "Remaining = ordered − shipped = 1."])
    f.h = y
    return f


# ---------------------------------------------------------------- Applied Thinking
def thinking_foundations(layout):
    a = ("APPLIED MATHEMATICS", ["What structure", "is present?"], ["variables, relationships,", "constraints"])
    p = ("PHILOSOPHY", ["What justifies", "the conclusion?"], ["assumptions, evidence,", "uncertainty"])
    if layout == "wide":
        f = Fig(760, 330, layout)
        f.box(24, 24, 330, 140, a[1], a[2], "accent", eyebrow=a[0])
        f.box(406, 24, 330, 140, p[1], p[2], "accent", eyebrow=p[0])
        f.arrow([(189, 164), (189, 196), (330, 196), (330, 224)])
        f.arrow([(571, 164), (571, 196), (430, 196), (430, 224)])
        f.box(200, 228, 360, 84, "A practical decision", ["domain knowledge + appropriate evidence"], "ok", centre=True)
        return f
    f = Fig(420, 520, layout)
    f.box(24, 20, 372, 138, a[1], a[2], "accent", eyebrow=a[0])
    f.box(24, 176, 372, 138, p[1], p[2], "accent", eyebrow=p[0])
    f.arrow([(210, 314), (210, 362)])
    f.text(222, 344, "both inform", 16, "muted")
    f.box(24, 366, 372, 104, "A practical decision", ["domain knowledge +", "appropriate evidence"], "ok", centre=True)
    return f


CYCLE = [("01 · CLARIFY", "The decision"), ("02 · LOCATE", "The structure"), ("03 · SEPARATE", "Known vs unresolved"),
         ("04 · INVESTIGATE", "Models and evidence"), ("05 · VALIDATE", "Assumptions, limits"), ("06 · EXPLAIN", "What follows")]


def thinking_cycle(layout):
    if layout == "wide":
        f = Fig(760, 320, layout)
        xs = [24, 272, 520]
        for i, (eyebrow, title) in enumerate(CYCLE):
            x = xs[i] if i < 3 else xs[5 - i]
            y = 24 if i < 3 else 200
            f.box(x, y, 216, 74, title, [], "accent", eyebrow=eyebrow, title_size=17)
        f.arrow([(240, 61), (268, 61)])
        f.arrow([(488, 61), (516, 61)])
        f.arrow([(628, 98), (628, 196)])
        f.arrow([(520, 237), (492, 237)])
        f.arrow([(272, 237), (244, 237)])
        f.arrow([(132, 200), (132, 102)], dash=True)
        f.text(380, 154, "New evidence can reopen any earlier step.", 16, "muted", 400, "middle")
        note(f, 380, 306, ["Reusable operations, not a guaranteed algorithm."], "middle")
        return f
    f = Fig(420, 640, layout)
    y = 20
    for i, (eyebrow, title) in enumerate(CYCLE):
        f.box(70, y, 326, 76, title, [], "accent", eyebrow=eyebrow, title_size=18)
        if i < 5:
            f.arrow([(233, y + 76), (233, y + 92)])
        y += 96
    f.arrow([(70, 534), (40, 534), (40, 58), (66, 58)], dash=True)
    note(f, 24, y + 16, ["Dashed: new evidence can reopen any", "earlier step. Not a guaranteed algorithm."])
    return f


FIGURES = {
    "data-quality-flow": (dq_flow, ("wide", "narrow"), "Fictional CSV rows are checked and routed to accepted records or human review"),
    "data-quality-results": (dq_results, ("wide", "narrow", "card"), "60 fictional rows: 37 accepted, 23 held for review, by reason"),
    "inventory-model": (inv_model, ("wide", "narrow"), "Integer program with an independent checker"),
    "inventory-scenarios": (inv_scenarios, ("wide", "narrow", "card"), "Units shipped and short across five fictional scenarios"),
    "analytics-pipeline": (an_pipeline, ("wide", "narrow"), "Raw events are validated file-wide before metrics"),
    "analytics-funnel": (an_funnel, ("wide", "narrow", "card"), "Ordered session funnel for fictional events"),
    "b2b-lifecycle": (b2b_lifecycle, ("wide", "narrow"), "Each business fact has one owning module"),
    "b2b-quantities": (b2b_quantities, ("wide", "narrow", "card"), "Quoted, ordered and shipped units for one fictional order"),
    "thinking-foundations": (thinking_foundations, ("wide", "narrow"), "Structure and justification inform one decision"),
    "thinking-cycle": (thinking_cycle, ("wide", "narrow"), "Six reusable reasoning operations"),
}


def filename(name, layout, theme):
    parts = [name] + ([layout] if layout != "wide" else []) + (["dark"] if theme == "dark" else [])
    return "-".join(parts) + ".svg"


def build():
    files, sizes = {}, {}
    for name, (draw, layouts, title) in FIGURES.items():
        sizes[name] = {}
        for layout in layouts:
            fig = draw(layout)
            sizes[name][layout] = [fig.w, int(fig.h)]
            for theme in THEMES:
                files[filename(name, layout, theme)] = fig.render(theme, title)
    return files, sizes


def updated_content(sizes):
    raw = CONTENT.read_text(encoding="utf-8")
    content = json.loads(raw)
    for project in content["projects"]:
        for visual in project["visuals"]:
            visual["sizes"] = sizes[Path(visual["src"]).stem]
    for diagram in content["appliedThinking"]["diagrams"]:
        diagram["sizes"] = sizes[Path(diagram["src"]).stem]
    return raw, json.dumps(content, indent=2, ensure_ascii=False) + "\n"


def main():
    check = "--check" in sys.argv[1:]
    problems = check_contrast()
    if problems:
        sys.exit("contrast check failed:\n  " + "\n  ".join(problems))
    files, sizes = build()
    stale = [n for n, svg in files.items() if not (OUT / n).is_file() or (OUT / n).read_text(encoding="utf-8") != svg]
    expected = set(files) | {"README.md"}
    extra = sorted(p.name for p in OUT.iterdir() if p.name not in expected)
    raw, content = updated_content(sizes)
    if check:
        messages = [f"stale or missing: {n}" for n in stale] + [f"not generated by this script: {n}" for n in extra]
        if content != raw:
            messages.append("content/site.json visual sizes are out of date")
        if messages:
            sys.exit("STALE visuals (run python scripts/build_visuals.py):\n  " + "\n  ".join(messages))
        print(f"{len(files)} visuals current.")
        return
    for n in stale:
        (OUT / n).write_text(files[n], encoding="utf-8")
    for n in extra:
        (OUT / n).unlink()
    if content != raw:
        CONTENT.write_text(content, encoding="utf-8")
    print(f"{len(files)} visuals generated ({len(stale)} written, {len(extra)} removed).")


if __name__ == "__main__":
    main()
