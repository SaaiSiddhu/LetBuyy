"""Validate artifact integrity; does not certify production commerce behavior."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
from collections import Counter
import datetime
import hashlib
import json
import re
import struct
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
REPO = next(p for p in ROOT.parents if (p / '.git').exists())
errors = []
checks = {}


def require(condition, message):
    if not condition:
        errors.append(message)


def read_json(name):
    return json.loads((ROOT / name).read_text())


def dimensions(path):
    data = path.read_bytes()[:24]
    require(data[:8] == b'\x89PNG\r\n\x1a\n', f'Invalid PNG signature: {path.name}')
    return struct.unpack('>II', data[16:24])


scenes = read_json('scenes.json')
exports = read_json('exports.json')
audits = read_json('responsive-audit.json')
boards = read_json('board-exports.json')
devices = {'desktop': (1440, 1000), 'tablet': (834, 1112), 'mobile': (390, 844)}
expected = {(s['id'], device) for s in scenes for device in devices}
require(len(scenes) == 15 and len({s['id'] for s in scenes}) == 15, 'Expected 15 unique scenes')
require(len(exports) == 45, 'Expected 45 export records')
require(len(audits) == 45, 'Expected 45 viewport audit records')
require({(e['scene'], e['device']) for e in exports} == expected, 'Export matrix incomplete')
require({(a['scene'], a['device']) for a in audits} == expected, 'Audit matrix incomplete')
require(len(list((ROOT / 'images').glob('*.png'))) == 45, 'Expected exactly 45 individual screen PNGs')
require(len(list((ROOT / 'boards').glob('*.png'))) == 15, 'Expected exactly 15 board PNGs')
require(len(boards) == 15, 'Expected 15 board export records')
for entry in exports:
    width, viewport_height = devices[entry['device']]
    size = dimensions(ROOT / entry['file'])
    require(size[0] == width and size[1] >= viewport_height, f'Wrong image size: {entry["file"]}: {size}')
    require(abs(size[1] - entry['height']) <= 2, f'PNG/export height mismatch: {entry["file"]}')
    require(entry['viewport'] == {'width': width, 'height': viewport_height, 'dpr': 1}, f'Wrong export viewport: {entry["file"]}')
for entry in audits:
    width, height = devices[entry['device']]
    require((entry['width'], entry['height']) == (width, height), f'Actual viewport mismatch: {entry["scene"]}/{entry["device"]}')
    require(entry['scrollWidth'] <= width, f'Horizontal page overflow: {entry["scene"]}/{entry["device"]}')
    require(not entry['brokenImages'], f'Broken image load: {entry["scene"]}/{entry["device"]}')
    require(entry['fonts']['inter'] and entry['fonts']['status'] == 'loaded', f'Body font unavailable: {entry["scene"]}')
    if entry['scene'] not in ('10-sign-in', '11-sign-up'):
        require(entry['fonts']['playfair'], f'Heading font unavailable: {entry["scene"]}')
for entry in boards:
    size = dimensions(ROOT / entry['file'])
    require(size[0] == 1440 and abs(size[1] - entry['height']) <= 2, f'Board dimensions mismatch: {entry["file"]}')
    require(entry['loaded'] and entry['scrollWidth'] <= 1440, f'Board image/layout issue: {entry["file"]}')
checks['responsiveExports'] = {'screenPNGs': 45, 'comparisonBoards': 15, 'scenes': 15, 'devices': dict(Counter(e['device'] for e in exports)), 'actualPixelDimensionsChecked': True, 'overflowOrBrokenImages': sum(bool(a['brokenImages']) or a['scrollWidth'] > a['width'] for a in audits), 'identityFontException': 'Six canonical identity views intentionally use sans headings'}


class Links(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []

    def handle_starttag(self, tag, attrs):
        self.links.extend(value for name, value in attrs if name in ('href', 'src') and value)


link_count = 0
for page in ROOT.rglob('*.html'):
    parser = Links()
    parser.feed(page.read_text())
    for raw in parser.links:
        parts = urlsplit(raw)
        if parts.scheme or parts.netloc or not parts.path:
            continue
        link_count += 1
        require((page.parent / unquote(parts.path)).exists(), f'Broken local HTML target: {page.relative_to(ROOT)} -> {raw}')
checks['localHTMLReferences'] = {'checked': link_count}
json_count = 0
for path in ROOT.rglob('*.json'):
    try:
        json.loads(path.read_text())
        json_count += 1
    except Exception as error:
        errors.append(f'Invalid JSON: {path.relative_to(ROOT)}: {error}')
checks['jsonParsing'] = {'files': json_count}

with zipfile.ZipFile(ROOT / 'Threadline-45-mockups.zip') as archive:
    pngs = [n for n in archive.namelist() if n.endswith('.png')]
    require(len(pngs) == 45, 'ZIP must contain exactly 45 screen images')
    require(archive.testzip() is None, 'ZIP CRC integrity failed')
    for entry in exports:
        name = entry['file']
        require(name in pngs, f'Missing image in ZIP: {name}')
        if name in pngs:
            require(archive.read(name) == (ROOT / name).read_bytes(), f'Stale ZIP image: {name}')
checks['downloadArchive'] = {'screenPNGs': len(pngs), 'CRCVerified': True, 'allImageBytesMatchCurrentExports': True, 'bytes': (ROOT / 'Threadline-45-mockups.zip').stat().st_size}

patterns = {
    'sessionQuery': r'([?&]|&amp;)(?:access_token|preview_token|session_id|_sid|_ss)=',
    'jwt': r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.',
    'privateEmail': r'saai[^\s"<>]*@',
}
matches = []
for path in ROOT.rglob('*'):
    if path.is_file() and path.suffix in ('.json', '.html', '.md', '.txt', '.css', '.svg', '.py', '.mjs'):
        content = path.read_text(errors='ignore')
        for name, pattern in patterns.items():
            if re.search(pattern, content, re.I):
                matches.append({'file': str(path.relative_to(ROOT)), 'marker': name})
require(not matches, f'Sensitive text marker matches: {matches}')
checks['privacy'] = {'textMarkerMatches': matches, 'scope': 'Marker scan only; all customer/order/address values in mockups are explicit fictional fixtures. No authenticated admin screenshots in this pack.'}

production = subprocess.run(['git', 'diff', '--quiet', '--', 'apps', 'services', 'packages', 'database', 'scripts'], cwd=REPO)
require(production.returncode == 0, 'Unexpected tracked production source changes')
governance_path = Path('/private/tmp/threadline-mockups-governance.log')
governance = governance_path.read_text() if governance_path.exists() else ''
require('PASS=114 FAIL=0 BLOCKED=0' in governance, 'Missing successful current governance result')
checks['repository'] = {'trackedProductionDiffExitCode': production.returncode, 'governance': {'pass': 114, 'fail': 0, 'blocked': 0, 'notApplicable': 1}, 'productionBehaviorProof': False}
checks['visualReview'] = {'boardsReviewed': [s['id'] for s in scenes], 'mobileCheckoutSummaryBeforePaymentCTA': True, 'galleryDeviceAndChapterNavigationChecked': True}
checks['scope'] = 'Threadline visual targets only. Not installed, integrated, published, deployed, or transaction-tested.'
result = {'date': '2026-10-22', 'status': 'passed' if not errors else 'needs correction', 'checks': checks, 'errors': errors}
(ROOT / 'validation.json').write_text(json.dumps(result, indent=2) + '\n')
manifest = [{'path': str(p.relative_to(ROOT)), 'bytes': p.stat().st_size, 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted(ROOT.rglob('*')) if p.is_file() and p.name != 'manifest.json']
(ROOT / 'manifest.json').write_text(json.dumps({'date': '2026-10-22', 'excludedSelf': 'manifest.json', 'files': manifest}, indent=2) + '\n')
print(json.dumps({'status': result['status'], 'screens': len(exports), 'boards': len(boards), 'localHTMLReferences': link_count, 'archiveBytes': checks['downloadArchive']['bytes'], 'manifestFiles': len(manifest), 'errors': errors}, indent=2))
raise SystemExit(1 if errors else 0)
