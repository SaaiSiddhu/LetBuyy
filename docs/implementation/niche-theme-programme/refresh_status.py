"""Refresh the programme's presentation from measured files and review registry."""
import html
import json
from pathlib import Path

root = Path(__file__).resolve().parent
repo = next(p for p in root.parents if (p / 'pnpm-workspace.yaml').exists())
registry = json.loads((root / 'programme.json').read_text())
rows = []
cards = []
disk_images = disk_boards = accepted_images = 0
for theme in registry['themes']:
    folder = repo / theme['artifactPath']
    images = len(list((folder / 'images').glob('*.png')))
    boards = len(list((folder / 'boards').glob('*.png')))
    accepted = theme.get('acceptanceMatrix', {}).get('representativeVisualReviewPassed') is True
    disk_images += images
    disk_boards += boards
    accepted_images += 45 if accepted else 0
    if registry['mockupGate']['passed']:
        state = theme.get('implementationProgress', {}).get('label', 'Implementation assigned')
        next_step = theme.get('implementationProgress', {}).get('nextTask', 'Theme modules and shared integration')
    else:
        state = 'Individual review passed; portfolio pending' if accepted else theme['status'].replace('_', ' ')
        next_step = 'Read-only implementation inventory' if accepted else 'Export/final corrections and review'
    rows.append(f"| {theme['name']} | {images} | {boards} | {state} | {next_step} |")
    href = '../../research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/' + theme['key'] + '-storybook/'
    links = [f'<a href="thread://{theme["threadId"]}?hostId=local">Theme chat</a>']
    engineering = repo / 'docs/implementation/niche-themes-2026-10-23' / theme['key']
    if engineering.is_dir():
        report = next((name for name in ['HANDOFF.md', 'ENGINEERING-REPORT.md', 'README.md'] if (engineering / name).is_file()), None)
        if report:
            links.append(f'<a href="../niche-themes-2026-10-23/{theme["key"]}/{report}">Engineering work</a>')
    if (folder / 'index.html').is_file():
        links.append(f'<a href="{href}index.html">Storybook</a>')
    if (folder / (theme['name'] + '-45-mockups.zip')).is_file():
        links.append(f'<a href="{href}{theme["name"]}-45-mockups.zip">45-PNG ZIP</a>')
    cards.append(f'<article><span>{html.escape(theme["presetId"])}</span><h2>{html.escape(theme["name"])}</h2><p>{html.escape(theme["mission"])}</p><p>{" · ".join(links)}</p><p class="state">{images}/45 PNGs · {boards}/15 boards<br>{html.escape(state)}</p><p><strong>Current task:</strong> {html.escape(next_step)}</p></article>')

notice = f'{disk_images}/405 individual PNGs and {disk_boards}/135 boards on disk. {accepted_images} screens have passed individual artifact/design review. The full portfolio gate remains open.'
if registry['mockupGate']['passed']:
    notice = 'All 405 individual PNGs and 135 boards passed the mockup milestone. Controlled implementation is in progress; production acceptance is separate.'
style = '*{box-sizing:border-box}body{margin:0;background:#f7f7fa;color:#24212d;font:16px/1.6 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:48px 24px}h1{font-size:clamp(28px,4vw,48px);line-height:1.1}h2{margin:8px 0;font-size:25px}a{color:#523f97;text-underline-offset:3px}a:focus-visible{outline:3px solid #005fcc;outline-offset:4px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),1fr));gap:20px}article{padding:24px;background:white;border:1px solid #dcd7e4;border-radius:12px}span,.state{font-size:14px;color:#625b6d}.notice{padding:18px 24px;background:#eee8f9;border-left:4px solid #523f97;margin:28px 0}'
document = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LetBuyy theme programme</title><style>' + style + '</style><main><p>LetBuyy · owner-authorized local programme</p><h1>Nine distinct shopping experiences</h1><p>405 responsive mockups, then end-to-end implementation through the canonical Liquid ecosystem.</p><p class="notice">' + notice + '</p><p><a href="README.md">Programme record</a> · <a href="programme.json">Registry</a> · <a href="visual-review.json">Independent review</a> · <a href="../../research/shopify-product-intelligence/free-themes-niche-study-2026-10-22/visuals/threadline-storybook/index.html">Threadline reference</a></p><section class="grid">' + ''.join(cards) + '</section></main></html>'
(root / 'index.html').write_text(document)
status = '# Programme status\n\n' + notice + '\n\n| Theme | PNGs on disk | Boards on disk | Review | Next |\n|---|---:|---:|---|---|\n' + '\n'.join(rows) + '\n\nThreadline continues its owned remaining QA; shared-file/browser/build leases are in capture-schedule.json. Mockups do not certify commerce, accessibility, security or production performance. Hosted deployment is outside the current local mandate.\n'
(root / 'STATUS.md').write_text(status)
print(notice)
