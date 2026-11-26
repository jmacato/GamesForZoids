import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
FONT = TTFont(ROOT / "site/fonts/Xolonium-Bold.ttf")
GLYPHS = FONT.getGlyphSet()
CMAP = FONT.getBestCmap()
CAP = FONT["OS/2"].sCapHeight

ZOIDS_TRACK = -10
GAMES_SCALE = 0.4
GAMES_TRACK = 150
LINE_GAP = 90
FOUR_SCALE = 0.7
FOUR_GAP = 60


def fmt(value):
    return str(round(value) + 0)


def bounds(name):
    from fontTools.pens.boundsPen import BoundsPen
    pen = BoundsPen(GLYPHS)
    GLYPHS[name].draw(pen)
    return pen.bounds


def run(text, scale, track, x, baseline):
    pen = SVGPathPen(GLYPHS, ntos=fmt)
    for index, char in enumerate(text):
        name = CMAP[ord(char)]
        left = bounds(name)[0]
        if index == 0:
            x -= left * scale
        GLYPHS[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        x += GLYPHS[name].width * scale + track * scale
    last = CMAP[ord(text[-1])]
    return pen.getCommands(), x - track * scale - (GLYPHS[last].width - bounds(last)[2]) * scale


def main():
    four_top = 0
    four_base = four_top + CAP * FOUR_SCALE
    games_base = four_base
    games_top = games_base - CAP * GAMES_SCALE
    zoids_base = games_base + LINE_GAP + CAP
    games, games_right = run("GAMES", GAMES_SCALE, GAMES_TRACK, 0, games_base)
    zoids, zoids_right = run("ZOIDS", 1, ZOIDS_TRACK, 0, zoids_base)
    four, four_right = run("4", FOUR_SCALE, 0, games_right + FOUR_GAP, four_base)
    top = min(games_top, four_top)
    width = max(zoids_right, four_right, games_right)
    height = zoids_base - top
    view = f"0 {fmt(top)} {fmt(width)} {fmt(height)}"
    svg = (
        f'<svg class="logotype" viewBox="{view}" aria-hidden="true" focusable="false">'
        f'<path class="logotype-games" d="{games}"/>'
        f'<path class="logotype-zoids" d="{zoids}"/>'
        f'<path class="logotype-four" d="{four}"/></svg>'
    )
    layer = lambda name, d, fill: f'<g inkscape:groupmode="layer" inkscape:label="{name}" id="{name.lower()}"><path id="{name.lower()}-path" d="{d}" fill="{fill}"/></g>'
    edit = (
        f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" viewBox="{view}" width="{fmt(width / 10)}" height="{fmt(height / 10)}">'
        + layer("ZOIDS", zoids, "#27373e") + layer("GAMES", games, "#27373e") + layer("4", four, "#98540d") + "</svg>\n"
    )
    (ROOT / "art").mkdir(exist_ok=True)
    (ROOT / "art/logotype.svg").write_text(edit)
    if "--page" not in sys.argv:
        return
    page = ROOT / "site/index.html"
    html = page.read_text()
    start = html.index('<svg class="logotype"')
    end = html.index("</svg>", start) + len("</svg>")
    page.write_text(html[:start] + svg + html[end:])


if __name__ == "__main__":
    main()
