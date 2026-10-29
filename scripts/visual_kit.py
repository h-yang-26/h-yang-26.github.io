"""Shared colours, contrast checks and SVG helpers for scripts/build_visuals.py.

Light values match the site's light tokens; dark values match its dark surface.
Every (foreground, background) pair in CONTRAST_PAIRS is checked on each build:
4.5:1 for text, 3:1 for meaningful marks (WCAG 1.4.3 and 1.4.11).
"""

FONT = "system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif"
MONO = "ui-monospace,'SF Mono','Cascadia Mono',Menlo,Consolas,monospace"

THEMES = {
    "light": {
        "bg": "#FFFFFF", "text": "#1A1D21", "muted": "#4F5660", "line": "#7D8691",
        "boxFill": "#F4F6F8", "accent": "#1C5785", "accentFill": "#EAF1F7",
        "ok": "#146C67", "okFill": "#E3F2F0", "warn": "#8A5A0C", "warnFill": "#FBF1DE",
        "track": "#E5EAEF", "onMark": "#FFFFFF",
        # marketing tiles and before/after banners
        "opaque": "#1A1D21", "opaqueLine": "#1A1D21", "onOpaque": "#FFFFFF",
        "page": "#F8F7F3", "chrome": "#E9EDF1", "row": "#F4F6F8", "note": "#FFF6D6", "noteLine": "#B8A055",
    },
    "dark": {
        "bg": "#191C1F", "text": "#E9E7E2", "muted": "#A9AEB5", "line": "#848D98",
        "boxFill": "#22272C", "accent": "#8CC0EA", "accentFill": "#1D2A36",
        "ok": "#6FCDC2", "okFill": "#16302D", "warn": "#E6B15C", "warnFill": "#33290F",
        "track": "#2B3137", "onMark": "#101418",
        "opaque": "#07090B", "opaqueLine": "#848D98", "onOpaque": "#E9E7E2",
        "page": "#111315", "chrome": "#2A3036", "row": "#1E2328", "note": "#3A3216", "noteLine": "#8A7834",
    },
}

CONTRAST_PAIRS = [
    (fg, bg, 4.5) for fg in ("text", "muted", "accent", "ok", "warn")
    for bg in ("bg", "boxFill", "accentFill", "okFill", "warnFill", "row")
] + [("onMark", mark, 4.5) for mark in ("accent", "ok", "warn")] + [
    (mark, "bg", 3.0) for mark in ("line", "accent", "ok", "warn")
] + [
    ("onOpaque", "opaque", 4.5), ("opaqueLine", "bg", 3.0),
    ("text", "note", 4.5), ("muted", "chrome", 4.5), ("text", "page", 4.5), ("muted", "page", 4.5),
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


def check_mark(x, y, colour="ok", s=1.0):
    """A tick drawn from (x, y); colour is a theme token."""
    return (f'<path d="M{x:g} {y:g} l{6*s:g} {6*s:g} l{12*s:g} {-13*s:g}" fill="none" stroke="{{{colour}}}" '
            f'stroke-width="{3.2*s:g}" stroke-linecap="round" stroke-linejoin="round"/>')


def cross_mark(x, y, colour="warn", r=9):
    return f'<path d="M{x-r:g} {y-r:g}L{x+r:g} {y+r:g}M{x+r:g} {y-r:g}L{x-r:g} {y+r:g}" stroke="{{{colour}}}" stroke-width="3.2" stroke-linecap="round"/>'
