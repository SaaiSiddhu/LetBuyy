"""Independent file/evidence audit. Does not certify design or commerce behavior."""
from __future__ import annotations

import argparse
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import struct
from urllib.parse import unquote, urlsplit
import zipfile

PROGRAMME = Path(__file__).resolve().parent
REPO = next(p for p in PROGRAMME.parents if (p / 'pnpm-workspace.yaml').exists())
DEVICES = {'desktop': (1440, 1000), 'tablet': (834, 1112), 'mobile': (390, 844)}
try:
    from PIL import Image
except ImportError:
    Image = None


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.targets = []

    def handle_starttag(self, tag, attrs):
        self.targets.extend(v for k, v in attrs if k in ('src', 'href') and v)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def audit(theme):
    folder = REPO / theme['artifactPath']
    errors = []
    checks = {}

    def require(ok, message):
        if not ok:
            errors.append(message)

    def read(name):
        path = folder / name
        if not path.exists():
            errors.append(f'Missing {name}')
            return None
        try:
            return json.loads(path.read_text())
        except (ValueError, OSError) as error:
            errors.append(f'{name}: {type(error).__name__}')
            return None

    screens = sorted((folder / 'images').glob('*.png'))
    boards = sorted((folder / 'boards').glob('*.png'))
    require(len(screens) == 45, f'Expected 45 screen PNGs, found {len(screens)}')
    require(len(boards) == 15, f'Expected 15 board PNGs, found {len(boards)}')
    combos = set()
    hashes = {}
    for path in screens:
        match = re.fullmatch(r'(\d{2})-.+-(desktop|tablet|mobile)\.png', path.name)
        require(bool(match), f'Invalid scene/device filename: {path.name}')
        if not match:
            continue
        scene, device = int(match[1]), match[2]
        require((scene, device) not in combos, f'Duplicate scene/device {scene}/{device}')
        combos.add((scene, device))
        try:
            raw = path.read_bytes()
            require(raw[:8] == b'\x89PNG\r\n\x1a\n', f'Invalid PNG signature: {path.name}')
            width, height = struct.unpack('>II', raw[16:24])
            target = DEVICES[device]
            require(width == target[0] and height >= target[1], f'Wrong dimensions {path.name}: {width}x{height}')
            if Image:
                with Image.open(path) as im:
                    im.verify()
            sha = hashlib.sha256(raw).hexdigest()
            require(sha not in hashes, f'Duplicate screen bytes: {path.name} / {hashes.get(sha)}')
            hashes[sha] = path.name
        except (ValueError, OSError, struct.error) as error:
            errors.append(f'Invalid image {path.name}: {type(error).__name__}')
    require(combos == {(s, d) for s in range(1, 16) for d in DEVICES}, 'Incomplete 15x3 filename matrix')
    board_scenes = set()
    for path in boards:
        match = re.match(r'(\d{2})-', path.name)
        if match:
            board_scenes.add(int(match[1]))
        try:
            require(path.read_bytes()[:8] == b'\x89PNG\r\n\x1a\n', f'Invalid board PNG: {path.name}')
            if Image:
                with Image.open(path) as im:
                    im.verify()
        except (ValueError, OSError) as error:
            errors.append(f'Invalid board {path.name}: {type(error).__name__}')
    require(board_scenes == set(range(1, 16)), 'Incomplete 15-scene board matrix')
    checks['files'] = {'screens': len(screens), 'boards': len(boards), 'pillowVerified': Image is not None}
    scenes, exports, audits = read('scenes.json'), read('exports.json'), read('responsive-audit.json')
    if isinstance(scenes, list):
        require(len(scenes) == 15 and len({s.get('id') for s in scenes}) == 15, 'Expected 15 unique scene records')
    else:
        require(False, 'scenes.json must list 15 scenes')
    if isinstance(exports, list):
        require(len(exports) == 45, 'Expected 45 export records')
        require(len({(e.get('scene'), e.get('device')) for e in exports}) == 45, 'Export record matrix repeats')
        require(len({e.get('file') for e in exports}) == 45, 'Export file paths repeat')
        if isinstance(scenes, list):
            expected = {(s.get('id'), device) for s in scenes for device in DEVICES}
            require({(e.get('scene'), e.get('device')) for e in exports} == expected, 'Export records do not match scenes')
        for entry in exports:
            device = entry.get('device')
            if device not in DEVICES:
                errors.append('Unknown export device')
                continue
            width, height = DEVICES[device]
            viewport = entry.get('viewport', {})
            require(viewport.get('width') == width and viewport.get('height') == height and viewport.get('dpr') == 1,
                    f'Wrong declared export viewport: {entry.get("file")}')
            name = entry.get('file', '')
            require(bool(name) and (folder / name).is_file(), 'Export file missing')
    else:
        require(False, 'exports.json must list 45 exports')
    if isinstance(audits, list):
        require(len(audits) == 45, 'Expected 45 actual viewport audits')
        require(len({(a.get('scene'), a.get('device')) for a in audits}) == 45, 'Audit matrix repeats')
        if isinstance(scenes, list):
            expected = {(s.get('id'), device) for s in scenes for device in DEVICES}
            require({(a.get('scene'), a.get('device')) for a in audits} == expected, 'Audit records do not match scenes')
        for entry in audits:
            device = entry.get('device')
            if device not in DEVICES:
                errors.append('Unknown audit device')
                continue
            width, height = DEVICES[device]
            require(entry.get('width') == width and entry.get('height') == height and entry.get('dpr') == 1,
                    f'Actual viewport mismatch: {entry.get("scene")}/{device}')
            require(isinstance(entry.get('scrollWidth'), (int, float)) and entry['scrollWidth'] <= width,
                    f'Overflow or missing measurement: {entry.get("scene")}/{device}')
            require(entry.get('brokenImages') == [], f'Broken or unaudited images: {entry.get("scene")}/{device}')
            require(bool(entry.get('fonts')), f'Missing font evidence: {entry.get("scene")}/{device}')
    else:
        require(False, 'responsive-audit.json must list 45 actual measurements')
    for name in ('README.md', 'index.html', 'generation-prompts.json', 'validation.json'):
        require((folder / name).is_file(), f'Missing {name}')
    require((folder / 'source').is_dir() and any((folder / 'source').iterdir()), 'Missing editable source')
    require((folder / 'comparisons').is_dir() and any((folder / 'comparisons').iterdir()), 'Missing research/neutral comparisons')
    for path in folder.rglob('*.json'):
        try:
            json.loads(path.read_text())
        except (ValueError, OSError):
            errors.append(f'Invalid JSON: {path.relative_to(folder)}')
    link_count = 0
    for path in folder.rglob('*.html'):
        parser = Links()
        parser.feed(path.read_text())
        for raw in parser.targets:
            parts = urlsplit(raw)
            if parts.scheme or parts.netloc or not parts.path:
                continue
            link_count += 1
            require((path.parent / unquote(parts.path)).exists(), f'Broken local HTML link in {path.name}: {parts.path}')
    checks['localHtmlLinks'] = link_count
    archive_path = folder / f'{theme["name"]}-45-mockups.zip'
    require(archive_path.exists(), 'Missing mockup ZIP')
    if archive_path.exists():
        try:
            with zipfile.ZipFile(archive_path) as archive:
                pngs = [n for n in archive.namelist() if n.lower().endswith('.png')]
                require(len(pngs) == 45, 'ZIP must contain 45 PNGs')
                require(archive.testzip() is None, 'ZIP CRC failure')
                for path in screens:
                    matches = [n for n in pngs if Path(n).name == path.name]
                    require(len(matches) == 1 and archive.read(matches[0]) == path.read_bytes(), f'ZIP image stale/missing: {path.name}')
        except (OSError, zipfile.BadZipFile):
            errors.append('Unreadable mockup ZIP')
    return {'theme': theme['key'], 'passed': not errors, 'checks': checks, 'errors': errors,
            'visualReview': 'separate_pending', 'productionBehaviorCertified': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--theme', action='append', help='Audit selected theme key; default all nine')
    parser.add_argument('--output', type=Path, help='Save coordinator-owned audit result')
    args = parser.parse_args()
    registry = json.loads((PROGRAMME / 'programme.json').read_text())
    selected = [t for t in registry['themes'] if not args.theme or t['key'] in args.theme]
    results = [audit(t) for t in selected]
    result = {'passed': len(selected) > 0 and all(r['passed'] for r in results), 'themes': results,
              'requiredIndividualPngs': 45 * len(selected), 'requiredBoards': 15 * len(selected)}
    if args.output:
        args.output.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
    raise SystemExit(0 if result['passed'] else 1)
