"""Assemble uncropped board thumbnails for coordinator visual review, not exports."""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent
repo = next(p for p in root.parents if (p / 'pnpm-workspace.yaml').exists())
parser = argparse.ArgumentParser()
parser.add_argument('themes', nargs='+')
args = parser.parse_args()
registry = json.loads((root / 'programme.json').read_text())
destination = root / 'review-thumbnails'
destination.mkdir(exist_ok=True)
for theme in registry['themes']:
    if theme['key'] not in args.themes:
        continue
    boards = sorted((repo / theme['artifactPath'] / 'boards').glob('*.png'))
    if len(boards) != 15:
        raise SystemExit(f"{theme['key']}: expected all 15 boards")
    sheet = Image.new('RGB', (1536, 5 * 470), '#ececf0')
    draw = ImageDraw.Draw(sheet)
    for index, path in enumerate(boards):
        x, y = (index % 3) * 512, (index // 3) * 470
        draw.text((x + 12, y + 8), f"{theme['name']} / {path.stem}", fill='#181524')
        with Image.open(path) as board:
            board = board.convert('RGB')
            board.thumbnail((488, 430), Image.Resampling.LANCZOS)
            sheet.paste(board, (x + 12, y + 30))
    output = destination / (theme['key'] + '.png')
    sheet.save(output)
    print(output)
