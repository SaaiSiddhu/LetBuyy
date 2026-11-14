"""Prepare the marketing Inter face without changing used glyph geometry.

Run with fonttools==4.60.1 and brotli==1.1.0 in an isolated tool environment.
The retained source face remains authoritative for the full 100-900 range.
"""
from pathlib import Path
import argparse
import hashlib
import json
import fontTools
from fontTools.ttLib import TTFont
from fontTools.pens.recordingPen import DecomposingRecordingPen

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "apps/marketing/web/public/fonts/Inter-Variable-Marketing.woff2"
SOURCE_SHA256 = "fa71e4e77e1eb58e9a5781e102d49b540b0839bb8b0c6b87e7441308ed2347f9"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--proof", type=Path)
    args = parser.parse_args()
    if fontTools.__version__ != "4.60.1":
        raise SystemExit("Use the documented isolated fonttools==4.60.1 runtime.")
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise SystemExit("Source font changed; review this range recipe before regenerating.")
    font = TTFont(SOURCE, recalcTimestamp=False)
    axis = next(x for x in font["fvar"].axes if x.axisTag == "wght")
    assert (axis.minValue, axis.defaultValue, axis.maxValue) == (100, 400, 900)
    removed = 0
    for glyph, variations in font["gvar"].variations.items():
        keep = []
        for variation in variations:
            support = variation.axes.get("wght")
            # These tuples contribute exactly zero throughout weights 400-900.
            # Retain every other tuple verbatim, avoiding instancer rounding.
            if support and support[1] < 0 and support[2] <= 0:
                removed += 1
            else:
                keep.append(variation)
        font["gvar"].variations[glyph] = keep
    axis.minValue = 400
    font["fvar"].instances = [x for x in font["fvar"].instances if x.coordinates.get("wght", 400) >= 400]
    args.output.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = "woff2"
    font.save(args.output)

    original, result = TTFont(SOURCE), TTFont(args.output)
    old_map, new_map = original.getBestCmap(), result.getBestCmap()
    assert old_map.keys() == new_map.keys()
    assert original["name"].compile(original) == result["name"].compile(result)
    samples = 0
    for weight in range(400, 901, 50):
        for optical_size in [14, 16, 20, 24, 32]:
            old = original.getGlyphSet(location={"wght": weight, "opsz": optical_size})
            new = result.getGlyphSet(location={"wght": weight, "opsz": optical_size})
            for codepoint in old_map:
                a, b = old[old_map[codepoint]], new[new_map[codepoint]]
                pa, pb = DecomposingRecordingPen(old), DecomposingRecordingPen(new)
                a.draw(pa)
                b.draw(pb)
                assert a.width == b.width and pa.value == pb.value, (codepoint, weight, optical_size)
                samples += 1
    proof = {"source_sha256": SOURCE_SHA256, "output_sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(),
             "source_bytes": SOURCE.stat().st_size, "output_bytes": args.output.stat().st_size,
             "removed_zero_contribution_tuples": removed, "cmap_codepoints": len(old_map),
             "glyph_samples": samples, "outlines_and_advances_exact": True, "name_table_exact": True,
             "weight_range": [400, 900], "optical_size_range": [14, 32],
             "fonttools": fontTools.__version__}
    if args.proof:
        args.proof.parent.mkdir(parents=True, exist_ok=True)
        args.proof.write_text(json.dumps(proof, indent=2) + "\n")
    print(json.dumps(proof))


if __name__ == "__main__":
    main()
