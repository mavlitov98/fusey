"""Geometric verification of PDFs produced by tests/pdf-fixtures.js.

Checks, per fixture: page count and physical page size, every expected cut
segment exists at the right position/width/colour (and no duplicates), every
text line starts at the expected origin/baseline with the expected size, and
Cyrillic text is extractable. Usage: python3 tests/verify_pdf.py <dir>
"""
import json
import sys
from pathlib import Path

import pdfplumber

PT = 72 / 25.4  # points per mm
TOL = 0.05      # mm


def mm(v):
    return v / PT


def check(name, spec, pdf_path, errors):
    with pdfplumber.open(pdf_path) as pdf:
        if len(pdf.pages) != len(spec["pages"]):
            errors.append(f"{name}: {len(pdf.pages)} pages, expected {len(spec['pages'])}")
            return
        for pi, (page, exp) in enumerate(zip(pdf.pages, spec["pages"])):
            w, h = mm(float(page.width)), mm(float(page.height))
            if abs(w - spec["page"]["width"]) > TOL or abs(h - spec["page"]["height"]) > TOL:
                errors.append(f"{name} p{pi+1}: size {w:.3f}x{h:.3f} mm")

            # Cut lines: straight segments with the cut colour and width.
            cl = spec["cutLines"]
            if cl["enabled"]:
                want_rgb = tuple(int(cl["color"][i:i + 2], 16) / 255 for i in (1, 3, 5))
                found = []
                for ln in page.lines:
                    col = ln.get("stroking_color")
                    if isinstance(col, (int, float)):
                        col = (col,)
                    if col is not None and len(col) == 1:  # DeviceGray, e.g. "0 G" for black
                        col = (col[0],) * 3
                    if col is None or len(col) != 3:
                        continue
                    if max(abs(a - b) for a, b in zip(col, want_rgb)) > 0.01:
                        continue
                    if abs(mm(ln["linewidth"]) - cl["width"]) > 0.01:
                        continue
                    found.append((mm(ln["x0"]), mm(ln["top"]), mm(ln["x1"]), mm(ln["bottom"]), ln.get("dash")))
                if len(found) != len(exp["cuts"]):
                    errors.append(f"{name} p{pi+1}: {len(found)} cut segments, expected {len(exp['cuts'])}")
                for c in exp["cuts"]:
                    x0, x1 = sorted((c["x1"], c["x2"]))
                    y0, y1 = sorted((c["y1"], c["y2"]))
                    if not any(abs(f[0] - x0) < TOL and abs(f[1] - y0) < TOL and abs(f[2] - x1) < TOL and abs(f[3] - y1) < TOL for f in found):
                        errors.append(f"{name} p{pi+1}: missing cut segment {c}")
                keys = [tuple(round(v, 2) for v in f[:4]) for f in found]
                if len(keys) != len(set(keys)):
                    errors.append(f"{name} p{pi+1}: duplicated cut segments")
                if cl["style"] == "dashed" and found and not all(f[4] and f[4][0] for f in found):
                    errors.append(f"{name} p{pi+1}: cut lines are not dashed")

            # Text: group chars into runs by (baseline, size) and compare origins.
            chars = page.chars
            text = "".join(c["text"] for c in chars)
            for t in exp["texts"]:
                compact = t["text"].replace(" ", "")
                if compact not in text.replace(" ", ""):
                    errors.append(f"{name} p{pi+1}: text {t['text']!r} not extractable")
                first = t["text"].lstrip()[0]
                cand = [c for c in chars if c["text"] == first
                        and abs(mm(c["matrix"][4]) - t["x"]) < TOL
                        and abs(mm(float(page.height) - c["matrix"][5]) - t["baseline"]) < TOL]
                if not cand:
                    errors.append(f"{name} p{pi+1}: line {t['text']!r} not at x={t['x']:.3f} baseline={t['baseline']:.3f}")
                elif not t.get("rotated") and abs(cand[0]["size"] - t["sizePt"]) > 0.01:  # bbox-based size is meaningless when rotated
                    errors.append(f"{name} p{pi+1}: {t['text']!r} size {cand[0]['size']} != {t['sizePt']}")

            # Rotated items: glyph matrix must be a 90° clockwise rotation [0 -1 1 0].
            # (pdfplumber's "upright" flag is unreliable for near-zero floats.)
            rotated_expected = any(t.get("rotated") for t in exp["texts"])
            rotated_chars = [c for c in chars if abs(c["matrix"][0]) < 1e-6 and c["matrix"][1] < 0 and c["matrix"][2] > 0]
            if rotated_expected and not rotated_chars:
                errors.append(f"{name} p{pi+1}: rotated sticker text is not rotated")
            if not rotated_expected and rotated_chars:
                errors.append(f"{name} p{pi+1}: unexpected rotated text")


def main():
    out = Path(sys.argv[1])
    manifest = json.loads((out / "manifest.json").read_text())
    errors = []
    for name, spec in manifest.items():
        before = len(errors)
        check(name, spec, out / f"{name}.pdf", errors)
        n_items = sum(len(p["items"]) for p in spec["pages"])
        n_cuts = sum(len(p["cuts"]) for p in spec["pages"])
        n_text = sum(len(p["texts"]) for p in spec["pages"])
        status = "OK " if len(errors) == before else "FAIL"
        print(f"{status} {name}: {len(spec['pages'])} page(s) {spec['page']['width']}x{spec['page']['height']} mm, "
              f"{n_items} stickers, {n_cuts} cut segments, {n_text} text lines checked")
    for e in errors:
        print("  -", e)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
