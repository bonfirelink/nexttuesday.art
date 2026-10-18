"""Builds the wordmark's Ξ font and writes it into site/_nts/worlds/embers.css as a data: URI
between the `xi-font` markers. Run from anywhere:
  nix shell --impure --expr 'with import <nixpkgs> {}; python3.withPackages (p: [p.fonttools p.brotli])' --command python3 tools/gen-xi.py

One glyph: U+0045 drawn as three bars, in Archivo's E box at wdth 125, weight 700 (1000 units
per em): advance 865, cap height 687, stroke 137.5, ink 710 wide from 92.5, the middle bar 78%
of the ink, centred. Ascent and descent are Archivo's, so the line box is the same as Archivo's.
Colour, glow and selection are the text's own, since the bars are glyph outlines."""
import base64, io, re
from pathlib import Path
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen

ADV, CAP, STROKE, X0, INK = 865, 687.5, 137.5, 92.5, 710
ASC, DESC = 878, 210

def rect(pen, x0, y0, x1, y1):
    # clockwise, the outer-contour direction of TrueType
    pen.moveTo((round(x0), round(y0))); pen.lineTo((round(x0), round(y1)))
    pen.lineTo((round(x1), round(y1))); pen.lineTo((round(x1), round(y0))); pen.closePath()

pen = TTGlyphPen(None)
mid_w = INK * .78
mid_x = X0 + (INK - mid_w) / 2
rect(pen, X0, 0, X0 + INK, STROKE)
rect(pen, mid_x, (CAP - STROKE) / 2, mid_x + mid_w, (CAP + STROKE) / 2)
rect(pen, X0, CAP - STROKE, X0 + INK, CAP)
xi = pen.glyph()
empty = TTGlyphPen(None).glyph()

fb = FontBuilder(1000, isTTF=True)
fb.setupGlyphOrder([".notdef", "E"])
fb.setupCharacterMap({0x45: "E"})
fb.setupGlyf({".notdef": empty, "E": xi})
fb.setupHorizontalMetrics({".notdef": (ADV, 0), "E": (ADV, 92)})
fb.setupHorizontalHeader(ascent=ASC, descent=-DESC, lineGap=0)
fb.setupNameTable({"familyName": "Nts Xi", "styleName": "Bold"})
fb.setupOS2(sTypoAscender=ASC, sTypoDescender=-DESC, sTypoLineGap=0, usWinAscent=ASC, usWinDescent=DESC, usWeightClass=700)
fb.setupPost()
fb.font.flavor = "woff2"
buf = io.BytesIO()
fb.save(buf)
data = buf.getvalue()

css = Path(__file__).resolve().parent.parent / "site/_nts/worlds/embers.css"
uri = "data:font/woff2;base64," + base64.b64encode(data).decode()
text = css.read_text()
text, n = re.subn(r"(/\* xi-font \*/).*?(/\* /xi-font \*/)",
                  lambda m: m.group(1) + "\n" + '@font-face { font-family: "Nts Xi"; font-weight: 100 900; font-display: block; src: url(' + uri + ') format("woff2"); }' + "\n" + m.group(2),
                  text, flags=re.S)
if n != 1:
    raise SystemExit("xi-font markers not found once in embers.css")
css.write_text(text)
print(len(data), "bytes")
