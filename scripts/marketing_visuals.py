"""Homepage and Applied Thinking marketing figures, built by scripts/build_visuals.py.

Two families, both with light and dark variants:

  tile-*  "How I work" tiles (440 viewBox, portrait, one layout). Each pairs one
          reasoning principle with a concrete scene from a public demo. Links to
          the projects are HTML next to the tile, never drawn inside it.
  ba-*    before/after banners. wide (1000 viewBox) places the panels side by
          side; narrow (420 viewBox) stacks them for phones and small tablets.
          Headlines are HTML (content/site.json), not part of the image.

Rows and numbers are copied from the public demo repositories; see
assets/visuals/README.md for each source.
"""
from visual_kit import FONT, MONO, check_mark as check, cross_mark as cross, esc


class Canvas:
    """Shapes recorded with {token} colour placeholders, rendered once per theme."""

    def __init__(self, w, h, layout, min_font, background="bg", radius=18):
        self.w, self.h, self.layout, self.min_font = w, h, layout, min_font
        self.background, self.radius, self.parts = background, radius, []

    def raw(self, svg):
        self.parts.append(svg)

    def text(self, x, y, s, size, colour="text", weight=400, anchor="start", mono=False, box=None, spacing=0):
        if size < self.min_font:
            raise ValueError(f"font {size} below the {self.layout} minimum {self.min_font}: {s!r}")
        a = f' font-weight="{weight}"' if weight != 400 else ""
        a += f' text-anchor="{anchor}"' if anchor != "start" else ""
        a += f' font-family="{MONO}"' if mono else ""
        a += f' letter-spacing="{spacing}"' if spacing else ""
        a += ' data-box="{:g},{:g},{:g},{:g}"'.format(*box) if box else ""
        self.parts.append(f'<text x="{x:g}" y="{y:g}" font-size="{size}" fill="{{{colour}}}"{a}>{esc(s)}</text>')

    def render(self, theme_name, title):
        from visual_kit import THEMES
        t = THEMES[theme_name]
        body = "\n".join(p.format(**t) for p in self.parts)
        markers = "".join(
            f'<marker id="{mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
            f'<path d="M0 0L10 5L0 10z" fill="{t[tok]}"/></marker>' for mid, tok in (("ah", "line"), ("aw", "warn")))
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {self.w} {self.h:g}" width="{self.w}" height="{self.h:g}" role="img" aria-labelledby="t">'
                f'<title id="t">{esc(title)}</title><defs>{markers}</defs>'
                f'<rect width="{self.w}" height="{self.h:g}" rx="{self.radius}" fill="{t[self.background]}"/>'
                f'<g font-family="{FONT}">{body}</g></svg>\n')


# =============================================================== tiles
TILE_W, TILE_H, TILE_MIN = 440, 520, 17


class Tile(Canvas):
    def __init__(self):
        super().__init__(TILE_W, TILE_H, "wide", TILE_MIN)

    def frame(self, eyebrow, hook, payoff):
        self.text(28, 46, eyebrow, TILE_MIN, "accent", 800, spacing=1.2)
        y = 92
        for line in hook:
            self.text(28, y, line, 29, "text", 800, box=(24, 60, 392, 80))
            y += 36
        y = 446
        for line in payoff:
            self.text(28, y, line, 18, "muted", box=(24, 424, 392, 86))
            y += 25


def badge(t, x, w, label, tone="ok", y=350):
    t.raw(f'<rect x="{x}" y="{y}" width="{w}" height="52" rx="26" fill="{{{tone}}}"/>')
    t.raw(check(x + 26, y + 26, "onMark", 1.1))
    t.text(x + 56, y + 33, label, 18, "onMark", 800, box=(x, y, w, 52))


def calendar(t, x, y, w, h, month, day, tone="accent", dashed=False):
    dash = ' stroke-dasharray="6 4"' if dashed else ""
    t.raw(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{{{"bg" if dashed else "boxFill"}}}" stroke="{{{tone}}}" stroke-width="2.5"{dash}/>')
    if not dashed:
        t.raw(f'<path d="M{x} {y+12} a12 12 0 0 1 12 -12 h{w-24} a12 12 0 0 1 12 12 v22 h-{w} z" fill="{{{tone}}}"/>')
    t.text(x + w / 2, y + 25, month, TILE_MIN, "onMark" if not dashed else tone, 800, "middle", spacing=1.5)
    t.text(x + w / 2, y + h - 18, day, 40, "text", 800, "middle")


def tile_frameworks():
    t = Tile()
    t.frame("RECOGNIZING FRAMEWORKS", ["“Which containers", "should we open?”"],
            ["Before building anything new, I check", "whether the problem already has a", "trusted method. This one does."])
    t.raw('<rect x="28" y="150" width="172" height="176" rx="14" fill="{boxFill}" stroke="{line}" stroke-width="2"/>')
    for cx, cy, c in [(52, 178, "accent"), (80, 170, "ok"), (110, 182, "warn"), (140, 168, "accent"), (168, 180, "ok")]:
        t.raw(f'<rect x="{cx-10}" y="{cy-10}" width="20" height="20" rx="4" fill="{{{c}}}"/>')
    t.raw('<rect x="40" y="238" width="66" height="62" rx="6" fill="none" stroke="{accent}" stroke-width="2.5"/>')
    t.raw('<rect x="114" y="214" width="74" height="86" rx="6" fill="none" stroke="{accent}" stroke-width="2.5"/>')
    t.text(73, 276, "400", TILE_MIN, "muted", 800, "middle", box=(40, 238, 66, 62))
    t.text(151, 264, "900", TILE_MIN, "muted", 800, "middle", box=(114, 214, 74, 86))
    t.text(114, 318, "opening charges", TILE_MIN, "muted", 400, "middle", box=(28, 150, 172, 176))
    t.raw('<path d="M204 238 L236 238" stroke="{line}" stroke-width="2.5" marker-end="url(#ah)"/>')
    t.raw('<rect x="240" y="150" width="172" height="176" rx="14" fill="{accentFill}" stroke="{accent}" stroke-width="2"/>')
    t.raw('<path d="M262 176 q20 -10 38 0 v32 q-18 -10 -38 0 z M300 176 q18 -10 38 0 v32 q-20 -10 -38 0 z" fill="{bg}" stroke="{accent}" stroke-width="2.2" stroke-linejoin="round"/>')
    t.text(254, 238, "Known problem", TILE_MIN, "accent", 800, box=(240, 150, 172, 176))
    t.text(254, 266, "Fixed-charge", 20, "text", 800, box=(240, 150, 172, 176))
    t.text(254, 290, "allocation", 20, "text", 800, box=(240, 150, 172, 176))
    t.text(254, 314, "PuLP + CBC", TILE_MIN, "muted", 400, box=(240, 150, 172, 176))
    badge(t, 80, 280, "Use a proven method", "ok")
    return t


def tile_ambiguity():
    t = Tile()
    t.frame("NARROWING AMBIGUITY", ["Is a “pressure unit”", "a pump or a sensor?"],
            ["The data can’t decide, so I don’t guess.", "Ambiguous rows go to a person, never", "silently into the system."])
    t.raw('<path d="M146 150 h144 a10 10 0 0 1 10 10 v24 a10 10 0 0 1 -10 10 h-144 l-22 -22 z" fill="{warnFill}" stroke="{warn}" stroke-width="2"/>')
    t.raw('<circle cx="142" cy="172" r="4.5" fill="{bg}" stroke="{warn}" stroke-width="2"/>')
    t.text(225, 179, "pressure unit", 18, "text", 700, "middle", box=(146, 150, 154, 44))
    t.raw('<path d="M176 196 C150 214 120 222 104 238" fill="none" stroke="{line}" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#ah)"/>')
    t.raw('<path d="M252 196 C278 214 308 222 326 238" fill="none" stroke="{line}" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#ah)"/>')
    t.raw('<rect x="40" y="262" width="22" height="16" rx="3" fill="{accentFill}" stroke="{accent}" stroke-width="2"/>')
    t.raw('<circle cx="88" cy="270" r="26" fill="{accentFill}" stroke="{accent}" stroke-width="2.5"/>')
    t.raw('<rect x="80" y="234" width="16" height="12" rx="2" fill="{accentFill}" stroke="{accent}" stroke-width="2"/>')
    t.raw('<g stroke="{accent}" stroke-width="3" stroke-linecap="round"><path d="M88 270 q-4 -14 6 -18"/><path d="M88 270 q14 -2 16 8"/><path d="M88 270 q-10 10 -20 4"/></g>')
    t.raw('<circle cx="88" cy="270" r="4" fill="{accent}"/>')
    t.text(88, 326, "Pump?", 18, "text", 700, "middle")
    t.raw('<circle cx="344" cy="270" r="28" fill="{accentFill}" stroke="{accent}" stroke-width="2.5"/>')
    t.raw('<path d="M324 282 A22 22 0 1 1 364 282" fill="none" stroke="{line}" stroke-width="2" stroke-dasharray="2 5"/>')
    t.raw('<path d="M344 272 L358 254" stroke="{accent}" stroke-width="3" stroke-linecap="round"/><circle cx="344" cy="272" r="4" fill="{accent}"/>')
    t.text(344, 326, "Sensor?", 18, "text", 700, "middle")
    t.text(216, 284, "?", 50, "warn", 800, "middle")
    t.raw('<path d="M216 304 L216 344" stroke="{warn}" stroke-width="2.5" marker-end="url(#aw)"/>')
    t.raw('<rect x="76" y="350" width="280" height="52" rx="26" fill="{warn}"/>')
    t.raw('<circle cx="106" cy="368" r="7" fill="{onMark}"/><path d="M94 390 a12 10 0 0 1 24 0 z" fill="{onMark}"/>')
    t.text(130, 383, "Sent to human review", 18, "onMark", 800, box=(76, 350, 280, 52))
    return t


def tile_decomposition():
    t = Tile()
    t.frame("DECOMPOSING SYSTEMS", ["A quote for 4 is", "not a sale of 4."],
            ["Offers, commitments and shipments are", "different facts. Adding them counts the", "same customer twice."])
    docs = [("Quote", "4 offered", "accent", [("accent", False)] * 4),
            ("Order", "2 committed", "accent", [("accent", False)] * 2 + [("line", True)] * 2),
            ("Shipment", "1 sent", "ok", [("ok", False)] + [("line", True)] * 3)]
    y = 150
    for name, sub, tone, squares in docs:
        t.raw(f'<path d="M28 {y} h172 l16 16 v62 a8 8 0 0 1 -8 8 h-180 a8 8 0 0 1 -8 -8 v-70 a8 8 0 0 1 8 -8 z" fill="{{boxFill}}" stroke="{{{tone}}}" stroke-width="2"/>')
        t.raw(f'<path d="M200 {y} v16 h16" fill="none" stroke="{{{tone}}}" stroke-width="2"/>')
        t.text(40, y + 26, name, 18, "text", 800)
        t.text(40, y + 50, sub, TILE_MIN, "muted")
        for i, (c, dashed) in enumerate(squares):
            if dashed:
                t.raw(f'<rect x="{140 + i*17}" y="{y+56}" width="13" height="13" rx="3" fill="none" stroke="{{line}}" stroke-width="1.5" stroke-dasharray="3 2"/>')
            else:
                t.raw(f'<rect x="{140 + i*17}" y="{y+56}" width="13" height="13" rx="3" fill="{{{c}}}"/>')
        y += 92
    t.raw('<rect x="238" y="168" width="176" height="96" rx="14" fill="{warnFill}" stroke="{warn}" stroke-width="2"/>')
    t.text(326, 204, "4 + 2 = 6", 26, "text", 800, "middle", box=(238, 168, 176, 96))
    t.raw('<path d="M262 196 L392 196" stroke="{warn}" stroke-width="3.5" stroke-linecap="round"/>')
    t.text(326, 240, "units of demand?", TILE_MIN, "warn", 700, "middle", box=(238, 168, 176, 96))
    t.raw(cross(398, 182, r=7))
    t.raw('<rect x="238" y="290" width="176" height="96" rx="14" fill="{okFill}" stroke="{ok}" stroke-width="2"/>')
    t.text(326, 330, "Demand = 2", 26, "text", 800, "middle", box=(238, 290, 176, 96))
    t.text(326, 362, "only orders count", TILE_MIN, "ok", 700, "middle", box=(238, 290, 176, 96))
    return t


def tile_filters():
    t = Tile()
    t.frame("EXAMINING EVIDENCE", ["Change the filters.", "Do the facts change?"],
            ["Filters change what you look at, not", "what is true about the data. Validation", "runs on the whole file first."])
    for x, scope, dates, events in [(28, "All modules", "Sep 1–28", "5,735"), (228, "Catalog only", "Sep 7–13", "480")]:
        box = (x, 146, 184, 190)
        t.raw(f'<rect x="{x}" y="146" width="184" height="190" rx="14" fill="{{boxFill}}" stroke="{{line}}" stroke-width="2"/>')
        t.raw(f'<path d="M{x+14} 160 h12 l-4 6 v8 l-4 3 v-11 z" fill="{{accent}}"/>')
        t.text(x + 34, 172, scope, TILE_MIN, "text", 800, box=box)
        t.text(x + 14, 194, dates, TILE_MIN, "muted", 400, box=box)
        t.text(x + 14, 232, events, 26, "accent", 800, box=box)
        t.text(x + 14, 254, "events in view", TILE_MIN, "muted", 400, box=box)
        inner = (x + 8, 266, 168, 62)
        t.raw(f'<rect x="{x+8}" y="266" width="168" height="62" rx="10" fill="{{warnFill}}"/>')
        t.text(x + 14, 296, "31", 26, "warn", 800, box=inner)
        t.text(x + 50, 296, "rows", TILE_MIN, "text", 700, box=inner)
        t.text(x + 14, 318, "not counted", TILE_MIN, "text", 700, box=inner)
        t.raw(check(x + 140, 296, "ok", 1.0))
    t.raw('<path d="M212 241 L224 241" stroke="{line}" stroke-width="2" marker-end="url(#ah)"/>')
    badge(t, 70, 300, "Same 31, any filter", "ok", y=352)
    return t


def tile_evidence():
    t = Tile()
    t.frame("EXAMINING EVIDENCE", ["Is 03/04/2024 in", "March or April?"],
            ["Read the wrong way, a date moves by", "about a month and nobody notices. Only", "YYYY-MM-DD dates are accepted."])
    t.raw('<rect x="142" y="146" width="156" height="44" rx="22" fill="{warnFill}" stroke="{warn}" stroke-width="2"/>')
    t.text(220, 175, "03/04/2024", 19, "text", 800, "middle", box=(142, 146, 156, 44))
    t.raw('<path d="M180 192 C160 200 136 204 122 212" fill="none" stroke="{line}" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#ah)"/>')
    t.raw('<path d="M260 192 C280 200 304 204 318 212" fill="none" stroke="{line}" stroke-width="2" stroke-dasharray="5 4" marker-end="url(#ah)"/>')
    calendar(t, 56, 216, 112, 94, "MAR", "4")
    calendar(t, 272, 216, 112, 94, "APR", "3")
    t.text(220, 278, "≠", 44, "warn", 800, "middle")
    t.text(112, 334, "US reading", TILE_MIN, "muted", 700, "middle")
    t.text(328, 334, "UK reading", TILE_MIN, "muted", 700, "middle")
    t.raw('<rect x="70" y="352" width="300" height="52" rx="26" fill="{warn}"/>')
    t.raw(cross(98, 378, "onMark", r=8))
    t.text(122, 385, "Rejected, not guessed", 18, "onMark", 800, box=(70, 352, 300, 52))
    return t


def tile_abstraction():
    t = Tile()
    t.frame("SIMPLIFYING RESPONSIBLY", ["100% full on paper.", "Does it really fit?"],
            ["My model keeps weight and volume and", "leaves out 3D packing, so no one", "mistakes it for a loading plan."])
    for i, (label, pct) in enumerate([("Volume", 100), ("Weight", 82)]):
        y = 168 + i * 56
        t.text(28, y, label, TILE_MIN, "text", 800)
        t.text(196, y, f"{pct}%", TILE_MIN, "text", 800, "end")
        t.raw(f'<rect x="28" y="{y+10}" width="168" height="18" rx="9" fill="{{track}}"/>')
        t.raw(f'<rect x="28" y="{y+10}" width="{168*pct/100:.0f}" height="18" rx="9" fill="{{accent}}"/>')
    t.text(28, 300, "3D packing:", TILE_MIN, "warn", 800)
    t.text(28, 322, "not modelled", TILE_MIN, "warn", 800)
    t.raw('<path d="M228 186 V322 H412 V186" fill="none" stroke="{line}" stroke-width="3" stroke-linejoin="round"/>')
    for x, y, w, h, c in [(234, 262, 70, 56, "accent"), (308, 274, 46, 44, "ok"), (358, 252, 50, 66, "accent"),
                          (234, 214, 44, 44, "ok"), (282, 222, 72, 48, "accent")]:
        t.raw(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="4" fill="{{{c}}}"/>')
    t.raw('<path d="M356 150 h52 v26 h-26 v40 h-26 z" fill="{warnFill}" stroke="{warn}" stroke-width="2.5" stroke-dasharray="5 3" stroke-linejoin="round"/>')
    t.text(372, 204, "?", 26, "warn", 800, "middle")
    t.raw('<rect x="40" y="352" width="360" height="52" rx="26" fill="{accent}"/>')
    t.raw('<path d="M64 366 h18 l6 6 v20 h-24 z" fill="none" stroke="{onMark}" stroke-width="2.4" stroke-linejoin="round"/><path d="M69 378 h12 M69 385 h12" stroke="{onMark}" stroke-width="2.2"/>')
    t.text(98, 385, "Limit stated in every output", 18, "onMark", 800, box=(40, 352, 360, 52))
    return t


def tile_invariance():
    t = Tile()
    t.frame("TESTING WHAT REMAINS TRUE", ["Change one input.", "Does the answer hold?"],
            ["I change one assumption at a time and", "watch where the plan changes. When all", "shortages cost under 400, nothing ships."])
    t.text(28, 162, "Scenario", TILE_MIN, "muted", 700)
    t.text(262, 162, "Opened", TILE_MIN, "muted", 700, "middle")
    t.text(412, 162, "Shipped", TILE_MIN, "muted", 700, "end")
    rows = [("Normal", (True, True), "309", "ok"), ("Smaller containers", (False, True), "112", "warn"),
            ("… and penalties ×4", (True, True), "130", "warn"), ("Tiny penalties", (False, False), "0", "warn")]
    y = 176
    for label, (small, large), shipped, tone in rows:
        t.raw(f'<rect x="20" y="{y}" width="400" height="38" rx="8" fill="{{row}}"/>')
        t.text(30, y + 25, label, 18, "text", 700, box=(20, y, 400, 38))
        for x, w, h, used in ((226, 24, 18, small), (258, 32, 26, large)):
            top = y + 19 - h / 2
            if used:
                t.raw(f'<rect x="{x}" y="{top:g}" width="{w}" height="{h}" rx="3" fill="{{accent}}"/>')
            else:
                t.raw(f'<rect x="{x}" y="{top:g}" width="{w}" height="{h}" rx="3" fill="none" stroke="{{line}}" stroke-width="1.6" stroke-dasharray="4 3"/>')
        t.text(404, y + 26, shipped, 20, tone, 800, "end", box=(20, y, 400, 38))
        y += 42
    badge(t, 60, 320, "Where the plan changes", "accent", y=352)
    return t


def tile_uncertainty():
    """Conceptual: no project data (P3 has no published demonstration)."""
    t = Tile()
    t.frame("CHOOSING UNDER UNCERTAINTY", ["A shipment is late.", "Three causes fit."],
            ["The likeliest cause guides the next check,", "but it stays a hypothesis until the", "evidence settles it."])
    t.text(28, 164, "Possible cause", TILE_MIN, "muted", 700)
    t.text(262, 164, "Test that decides", TILE_MIN, "muted", 700)
    rows = [("Supplier shipped late", "ship date"), ("Carrier was slow", "transit time"), ("Wrong date on file", "order history")]
    y = 178
    for cause, test in rows:
        t.raw(f'<rect x="20" y="{y}" width="226" height="44" rx="10" fill="{{warnFill}}" stroke="{{warn}}" stroke-width="1.6" stroke-dasharray="5 3"/>')
        t.text(34, y + 28, cause, TILE_MIN, "text", 700, box=(20, y, 226, 44))
        t.raw(f'<path d="M250 {y+22} L262 {y+22}" stroke="{{line}}" stroke-width="2" marker-end="url(#ah)"/>')
        t.raw(f'<rect x="268" y="{y}" width="152" height="44" rx="10" fill="{{accentFill}}"/>')
        t.text(282, y + 28, test, TILE_MIN, "accent", 700, box=(268, y, 152, 44))
        y += 54
    badge(t, 64, 312, "Run the deciding test", "accent", y=352)
    return t


def tile_opacity():
    t = Tile()
    t.frame("MANAGING OPAQUE SYSTEMS", ["Can’t see every layer?", "Test what it shows."],
            ["Headless tests give the dashboard data", "with known answers and check the", "numbers it shows, not how it draws them."])
    t.raw('<path d="M28 150 h136 l18 18 v40 h-154 z" fill="{boxFill}" stroke="{line}" stroke-width="2" stroke-linejoin="round"/>')
    t.text(40, 178, "Test file", TILE_MIN, "text", 800, box=(28, 150, 154, 58))
    t.text(40, 200, "answers known", TILE_MIN, "muted", 400, box=(28, 150, 154, 58))
    t.raw('<path d="M102 210 L102 226" stroke="{line}" stroke-width="2.5" marker-end="url(#ah)"/>')
    t.raw('<rect x="28" y="232" width="148" height="96" rx="12" fill="{opaque}" stroke="{opaqueLine}" stroke-width="1.5"/>')
    t.raw('<circle cx="78" cy="268" r="14" fill="none" stroke="{onOpaque}" stroke-width="7" stroke-dasharray="4.4 3.9"/><circle cx="78" cy="268" r="5" fill="{onOpaque}"/>')
    t.raw('<circle cx="114" cy="284" r="9" fill="none" stroke="{onOpaque}" stroke-width="6" stroke-dasharray="3.5 3"/><circle cx="114" cy="284" r="3.5" fill="{onOpaque}"/>')
    t.text(102, 318, "DASHBOARD", TILE_MIN, "onOpaque", 800, "middle", box=(28, 232, 148, 96), spacing=1)
    t.raw('<path d="M178 280 L198 280" stroke="{line}" stroke-width="2.5" marker-end="url(#ah)"/>')
    t.raw('<rect x="204" y="150" width="216" height="178" rx="12" fill="{bg}" stroke="{accent}" stroke-width="2"/>')
    t.text(216, 178, "Shown in the app", TILE_MIN, "muted", 700, box=(204, 150, 216, 178))
    y = 214
    for label, value in [("Valid events", "17"), ("Rejected", "6"), ("Quarantined", "2")]:
        t.text(216, y, label, TILE_MIN, "text", 700, box=(204, 150, 216, 178))
        t.text(376, y, value, 20, "accent", 800, "end", box=(204, 150, 216, 178))
        t.raw(check(388, y - 8, "ok", 0.85))
        if label != "Quarantined":
            t.raw(f'<path d="M216 {y+15} H408" stroke="{{track}}" stroke-width="1.5"/>')
        y += 42
    badge(t, 56, 328, "Checked at the interface", "ok", y=352)
    return t


# =============================================================== before/after banners
BA_MIN = 16


class Banner(Canvas):
    def __init__(self, layout):
        w = 1000 if layout == "wide" else 420
        super().__init__(w, 0, layout, BA_MIN, background="page", radius=20)

    def window(self, x, y, w, h, title, tone):
        self.raw(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{{bg}}" stroke="{{{tone}}}" stroke-width="2"/>')
        self.raw(f'<path d="M{x} {y+14} a14 14 0 0 1 14 -14 h{w-28} a14 14 0 0 1 14 14 v22 h-{w} z" fill="{{chrome}}"/>')
        for i in range(3):
            self.raw(f'<circle cx="{x+20+i*16}" cy="{y+18}" r="5" fill="{{line}}" opacity="0.7"/>')
        self.text(x + 76, y + 24, title, BA_MIN, "muted", 600, mono=True)

    def stripe(self, x, y, w, h=34):
        self.raw(f'<rect x="{x+8}" y="{y}" width="{w-16}" height="{h}" rx="4" fill="{{row}}"/>')

    def flag(self, x, y, w, h=26):
        """Amber highlight behind a problem cell."""
        self.raw(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="5" fill="{{warnFill}}" stroke="{{warn}}" stroke-width="1.8"/>')

    def chip(self, x, y, label):
        w = round(len(label) * 8.9 + 26)
        self.raw(f'<rect x="{x}" y="{y}" width="{w}" height="30" rx="15" fill="{{warnFill}}" stroke="{{warn}}" stroke-width="1.5"/>')
        self.text(x + 13, y + 21, label, BA_MIN, "warn", 700, box=(x, y, w, 30))
        return x + w + 8

    def pill(self, x, y, label, tone):
        w = len(label) * 11 + 34
        fill = {"accent": "accentFill", "ok": "okFill", "warn": "warnFill"}[tone]
        self.raw(f'<rect x="{x:g}" y="{y}" width="{w:g}" height="40" rx="20" fill="{{{fill}}}" stroke="{{{tone}}}" stroke-width="1.8"/>')
        self.text(x + 15, y + 27, label, 18, tone, 800, box=(x, y, w, 40))
        return x + w + 10


def compose(layout, titles, taglines, before, after, narrow_heights):
    """Lay out BEFORE and AFTER windows; before/after draw into (b, x, y, w, narrow)."""
    b = Banner(layout)
    if layout == "wide":
        x0, x1, y, w, h = 32, 528, 40, 440, 372
        b.text(x0, 26, "BEFORE", BA_MIN, "warn", 800, spacing=1.5)
        b.text(x1, 26, "AFTER", BA_MIN, "ok", 800, spacing=1.5)
        b.window(x0, y, w, h, titles[0], "warn")
        b.window(x1, y, w, h, titles[1], "ok")
        before(b, x0, y, w, False)
        after(b, x1, y, w, False)
        cx, cy = 500, y + h / 2
        b.raw(f'<circle cx="{cx}" cy="{cy:g}" r="24" fill="{{accent}}"/>')
        b.raw(f'<path d="M{cx-9} {cy:g} h16 M{cx+1} {cy-8:g} l8 8 l-8 8" fill="none" stroke="{{onMark}}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>')
        b.text(x0, 446, taglines[0], 19, "muted", 600)
        b.text(x1, 446, taglines[1], 19, "text", 700)
        b.h = 470
        return b
    hb, ha = narrow_heights
    x, w = 24, 372
    b.text(x, 26, "BEFORE", BA_MIN, "warn", 800, spacing=1.5)
    b.window(x, 40, w, hb, titles[0], "warn")
    before(b, x, 40, w, True)
    ty = 40 + hb + 30
    b.text(x, ty, taglines[0], 18, "muted", 600)
    cx, cy = 210, ty + 42
    b.raw(f'<circle cx="{cx}" cy="{cy}" r="22" fill="{{accent}}"/>')
    b.raw(f'<path d="M{cx} {cy-9} v16 M{cx-8} {cy+1} l8 8 l8 -8" fill="none" stroke="{{onMark}}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>')
    ly = cy + 52
    b.text(x, ly, "AFTER", BA_MIN, "ok", 800, spacing=1.5)
    ay = ly + 14
    b.window(x, ay, w, ha, titles[1], "ok")
    after(b, x, ay, w, True)
    ty2 = ay + ha + 30
    b.text(x, ty2, taglines[1], 18, "text", 700)
    b.h = ty2 + 22
    return b


# ------------------------------------------------------------- data quality
def dq_before(b, x, y, w, narrow):
    head = y + 64
    if narrow:
        cols, widths, heads = [x + 12, x + 92, x + 232], [74, 136, 108], ["ID", "CATEGORY", "RECEIVED"]
        rows = [("", "mtr", "2024-05-24", {0}), ("EQ-0003", "VALVE", "2024-02-30", {2}),
                ("EQ-0008", "Pressure Unit", "2024-07-12", {1}), ("EQ-0005", "VALVE", "2024-02-16", {0})]
        chips = [("blank ID", "Feb 30th?"), ("pump or sensor?", "duplicate ID")]
    else:
        cols, widths, heads = [x + 16, x + 100, x + 252, x + 304], [74, 146, 44, 108], ["ID", "CATEGORY", "QTY", "RECEIVED"]
        rows = [("", "mtr", "132", "2024-05-24", {0}), ("EQ-0003", "VALVE", "117", "2024-02-30", {3}),
                ("EQ-0004", "electric motor", "N/A", "2024-08-17", {2}), ("EQ-0007", "pump", "183", "2024-11-13", set()),
                ("EQ-0008", "Pressure Unit", "156", "2024-07-12", {1}), ("EQ-0005", "VALVE", "154", "2024-02-16", {0})]
        chips = [("blank ID", "Feb 30th?", "N/A"), ("pump or sensor?", "duplicate ID")]
    for c, h in zip(cols, heads):
        b.text(c, head, h, BA_MIN, "muted", 700, mono=True)
    ry = head + 14
    for i, (*values, bad) in enumerate(rows):
        if i % 2 == 0:
            b.stripe(x, ry, w)
        for k in bad:
            b.flag(cols[k] - 5, ry + 4, widths[k])
        for k, val in enumerate(values):
            if val:
                b.text(cols[k], ry + 23, val, BA_MIN, "text", 600 if k in bad else 400, mono=True)
        ry += 34
    cy = ry + 12
    for line in chips:
        cx = x + 16
        for label in line:
            cx = b.chip(cx, cy, label)
        cy += 38


def dq_after(b, x, y, w, narrow):
    head = y + 64
    x1 = x + 16
    cols = [x1 + 30, x1 + 116, x1 + 230]
    for c, h in zip(cols, ["ID", "CATEGORY", "QTY"]):
        b.text(c, head, h, BA_MIN, "muted", 700, mono=True)
    clean = [("EQ-0006", "FILTER", "23"), ("EQ-0007", "PUMP", "183"), ("EQ-0009", "FILTER", "62"), ("EQ-0012", "MOTOR", "45")]
    ry = head + 14
    for i, row in enumerate(clean[:3] if narrow else clean):
        if i % 2 == 0:
            b.stripe(x, ry, w)
        b.raw(check(x1 + 2, ry + 17, "ok", 0.8))
        for c, val in zip(cols, row):
            b.text(c, ry + 23, val, BA_MIN, "text", mono=True)
        ry += 34
    qy = ry + 18
    card = (x + 16, qy, w - 32, 118 if narrow else 372 - (qy - y) - 18)
    b.raw('<rect x="{:g}" y="{:g}" width="{:g}" height="{:g}" rx="12" fill="{{warnFill}}" stroke="{{warn}}" stroke-width="1.8"/>'.format(*card))
    b.raw(f'<circle cx="{x+46}" cy="{qy+26}" r="8" fill="{{warn}}"/><path d="M{x+32} {qy+50} a14 12 0 0 1 28 0 z" fill="{{warn}}"/>')
    b.text(x + 72, qy + 30, "Held for a person" if narrow else "Held for a person to decide", 19, "text", 800, box=card)
    b.text(x + 72, qy + 53, "exceptions.csv, with reasons", BA_MIN, "muted", 400, box=card)
    for k, (row, why) in enumerate((("row 3", "Feb 30th is not a date"), ("row 8", "pump or sensor?"))):
        b.text(x + 72, qy + 80 + k * 22, row, BA_MIN, "warn", 700, mono=True, box=card)
        b.text(x + 142, qy + 80 + k * 22, why, BA_MIN, "text", 400, box=card)


def ba_data(layout):
    return compose(layout, ("sample_input.csv", "outputs/"),
                   ("Errors hiding in plain sight.", "Clean data, and nothing guessed."), dq_before, dq_after, (308, 334))


# ------------------------------------------------------------- usage analytics
DAU = [44, 54, 47, 59, 18, 13, 52, 53, 51, 64, 46, 18, 19, 45, 57, 60, 58, 54, 17, 17, 58, 48, 58, 63, 67, 28, 21, 65]
WEEKEND = [4, 5, 11, 12, 18, 19, 25, 26]  # Sat/Sun indexes from Tue Sep 1, 2026


def usage_before(b, x, y, w, narrow):
    head = y + 64
    cols = [x + 12, x + 96, x + 160, x + 242] if narrow else [x + 16, x + 114, x + 184, x + 274]
    for c, h in zip(cols, ["TIME", "USER", "MODULE", "ACTION"]):
        b.text(c, head, h, BA_MIN, "muted", 700, mono=True)
    rows = [("19:21:50", "U0172", "catalog", "search"), ("19:21:59", "U0150", "orders", "search"),
            ("19:23:36", "U0150", "orders", "detail_view"), ("19:23:54", "U0150", "orders", "export"),
            ("19:24:48", "U0150", "orders", "page_view"), ("19:25:02", "U0006", "orders", "detail_view"),
            ("19:25:57", "U0150", "catalog", "page_view")][:5 if narrow else 7]
    fade_from = 2 if narrow else 3
    ry = head + 14
    for i, row in enumerate(rows):
        if i % 2 == 0:
            b.stripe(x, ry, w, 31)
        b.raw(f'<g opacity="{1 - max(0, i - fade_from) * 0.17:.2f}">')
        for c, val in zip(cols, row):
            b.text(c, ry + 22, val, BA_MIN, "text", mono=True)
        b.raw("</g>")
        ry += 31
    b.text(x + w / 2, ry + 38 if narrow else y + 350, "… 5,766 rows like these", 18, "muted", 700, "middle")


def usage_after(b, x, y, w, narrow):
    tiles = [("175", ["users", "in scope"]), ("1,520", ["sessions"]),
             ("619", ["full-funnel", "sessions"])]
    tw = (w - 48) / 3
    for i, (num, lines) in enumerate(tiles):
        tx = x + 16 + i * (tw + 8)
        box = (tx, y + 52, tw, 102)
        b.raw(f'<rect x="{tx:.1f}" y="{y+52}" width="{tw:.1f}" height="102" rx="10" fill="{{accentFill}}"/>')
        b.text(tx + 12, y + 92, num, 28, "accent", 800, box=box)
        for k, line in enumerate(lines):
            b.text(tx + 12, y + 118 + k * 21, line, BA_MIN, "muted", 600, box=box)
    gx, gy, gw, gh = x + 16, y + 194, w - 32, 110 if narrow else 150
    b.text(gx, gy - 14, "Daily active users, September", BA_MIN, "text", 700)
    step = gw / (len(DAU) - 1)
    for i in WEEKEND:
        b.raw(f'<rect x="{gx + i*step - step/2:.1f}" y="{gy}" width="{step:.1f}" height="{gh}" fill="{{track}}"/>')
    pts = [(gx + i * step, gy + gh - v / 70 * gh) for i, v in enumerate(DAU)]
    d = "M" + " L".join(f"{px:.1f} {py:.1f}" for px, py in pts)
    b.raw(f'<path d="{d} L{gx+gw:.1f} {gy+gh} L{gx} {gy+gh} Z" fill="{{accent}}" opacity="0.14"/>')
    b.raw(f'<path d="{d}" fill="none" stroke="{{accent}}" stroke-width="3" stroke-linejoin="round"/>')
    b.raw(f'<path d="M{gx} {gy+gh} H{gx+gw}" stroke="{{line}}" stroke-width="1.5"/>')
    b.text(gx + gw, gy + gh + 22, "shaded: weekends", BA_MIN, "muted", 400, "end")


def ba_usage(layout):
    return compose(layout, ("synthetic_events.csv", "usage dashboard"),
                   ("Thousands of rows, no answers.", "The questions a manager asks."), usage_before, usage_after, (292, 340))


# ------------------------------------------------------------- business facts
def orders_before(b, x, y, w, narrow):
    nw, step, value_size = (104, 116, 20) if narrow else (120, 138, 22)
    for i, (title, val, rot) in enumerate([("Quote", "4 units", -4), ("Order", "2 units", 3), ("Shipped", "1 unit", -2)]):
        nx, ny = x + 14 + i * step + (8 if not narrow else 0), y + 60 + (12 if i == 1 else 0)
        box = (nx, ny, nw, 104)
        b.raw(f'<g transform="rotate({rot} {nx + nw/2:g} {ny+52})"><rect x="{nx}" y="{ny}" width="{nw}" height="104" rx="4" fill="{{note}}" stroke="{{noteLine}}" stroke-width="1.5"/>'
              f'<rect x="{nx + nw/2 - 20:g}" y="{ny-8}" width="40" height="16" rx="2" fill="{{line}}" opacity="0.35"/>')
        b.text(nx + 14, ny + 38, title, 18, "text", 800, box=box)
        b.text(nx + 14, ny + 72, val, value_size, "text", 800, box=box)
        b.raw("</g>")
    ry, rh = (y + 190, 100) if narrow else (y + 214, 112)
    card = (x + 14 + (8 if not narrow else 0), ry, w - 28 - (16 if not narrow else 0), rh)
    b.raw('<rect x="{:g}" y="{:g}" width="{:g}" height="{:g}" rx="12" fill="{{warnFill}}" stroke="{{warn}}" stroke-width="2"/>'.format(*card))
    b.text(card[0] + 20, ry + 34, "“Total demand this month”", 18, "muted", 600, box=card)
    big = 24 if narrow else 30
    b.text(card[0] + 20, ry + rh - 24, "4 + 2 + 1 = 7 units", big, "text", 800, box=card)
    b.raw(f'<path d="M{card[0]+16:g} {ry + rh - 24 - big*0.33:g} h{big*0.5*19 + 8:g}" stroke="{{warn}}" stroke-width="4" stroke-linecap="round"/>')
    cx, cy = card[0] + card[2] - 34, ry + 32
    b.raw(f'<circle cx="{cx:g}" cy="{cy}" r="18" fill="{{warn}}"/>' + cross(cx, cy, "onMark", r=7))


def orders_after(b, x, y, w, narrow):
    size, gap, sx0, row = (36, 46, x + 150, 64) if narrow else (44, 56, x + 196, 72)
    stages = [("Quoted", "offer", [("accent", 0)] * 4), ("Ordered", "commitment", [("accent", 0)] * 2 + [("line", 1)] * 2),
              ("Shipped", "delivered", [("ok", 0), ("warn", 1)])]
    ry = y + 56
    for name, meaning, squares in stages:
        b.text(x + 20, ry + 26, name, 19, "text", 800)
        b.text(x + 20, ry + 47, meaning, BA_MIN, "muted")
        for i, (c, dashed) in enumerate(squares):
            sx = sx0 + i * gap
            if dashed:
                b.raw(f'<rect x="{sx}" y="{ry+4}" width="{size}" height="{size}" rx="7" fill="none" stroke="{{{c}}}" stroke-width="2" stroke-dasharray="5 4"/>')
            else:
                b.raw(f'<rect x="{sx}" y="{ry+4}" width="{size}" height="{size}" rx="7" fill="{{{c}}}"/>')
        ry += row
    pills = [("Demand 2", "accent"), ("Shipped 1", "ok"), ("Owed 1", "warn")]
    if narrow:
        px = b.pill(x + 20, ry + 8, *pills[0])
        b.pill(px, ry + 8, *pills[1])
        b.pill(x + 20, ry + 58, *pills[2])
    else:
        px = x + 20
        for label, tone in pills:
            px = b.pill(px, y + 286, label, tone)


def ba_orders(layout):
    return compose(layout, ("monthly_report.xlsx", "order timeline"),
                   ("Same order, three numbers.", "Every number means one thing."), orders_before, orders_after, (308, 362))


# name: (draw(layout), layouts, accessible title)
MARKETING = {
    "tile-frameworks": (lambda layout: tile_frameworks(), ("wide",), "Which containers to open is a known fixed-charge allocation problem, solved with a proven method."),
    "tile-ambiguity": (lambda layout: tile_ambiguity(), ("wide",), "Is a pressure unit a pump or a sensor? Ambiguous rows go to human review."),
    "tile-decomposition": (lambda layout: tile_decomposition(), ("wide",), "A quote for 4 is not a sale of 4: committed demand is 2."),
    "tile-filters": (lambda layout: tile_filters(), ("wide",), "Filters change the events in view, but the 31 rows not counted stay the same."),
    "tile-evidence": (lambda layout: tile_evidence(), ("wide",), "03/04/2024 could be March 4 or April 3, so it is rejected rather than guessed."),
    "tile-abstraction": (lambda layout: tile_abstraction(), ("wide",), "A container 100% full by volume may still not pack in 3D; the model states that limit."),
    "tile-invariance": (lambda layout: tile_invariance(), ("wide",), "Changing one input at a time: normal ships 309, smaller containers 112, smaller with penalties times 4 ships 130, tiny penalties ship 0."),
    "tile-uncertainty": (lambda layout: tile_uncertainty(), ("wide",), "A late shipment has three possible causes; each has a test that would decide it."),
    "tile-opacity": (lambda layout: tile_opacity(), ("wide",), "Headless tests feed the dashboard a file with known answers and check the numbers it displays."),
    "ba-data": (ba_data, ("wide", "narrow"), "Before: an inventory export with a blank ID, an impossible date and ambiguous categories. After: clean records plus a review queue with reasons."),
    "ba-usage": (ba_usage, ("wide", "narrow"), "Before: thousands of raw event rows. After: users in scope, sessions, full-funnel sessions and a daily activity chart."),
    "ba-orders": (ba_orders, ("wide", "narrow"), "Before: a report adds quote, order and shipment into one wrong total. After: one order with demand 2, shipped 1, owed 1."),
}
