"""Render a static, dependency-free gallery of the selected generated images."""
import html
import json
from pathlib import Path

root = Path(__file__).resolve().parent
manifest = json.loads((root / 'mockup-manifest.json').read_text())
cards = []
markdown = ['# LetBuyy responsive mockup gallery', '',
            'Proposed images; each board contains desktop, tablet and mobile. '
            'See [the plan](README.md), [exact purple roles](../03_PREMIUM_PURPLE_SYSTEM.md) '
            'and [review exceptions](VISUAL_REVIEW.md).', '']
for board in manifest['boards']:
    title, image = html.escape(board['title']), html.escape(board['image'])
    states = ''.join(f'<li>{html.escape(state)}</li>' for state in board['required_states'])
    cards.append(f'''<article id="{board['id']}"><h2>{board['id'][:2]} / {title}</h2>
<p class="meta">Desktop 1440 · Tablet 768 · Mobile 390 · {html.escape(board['status'])}</p>
<a class="image-link" href="{image}" target="_blank" rel="noopener" aria-label="Open full board: {title}">
<img src="{image}" alt="{title}: desktop, tablet and mobile proposed views" loading="lazy"></a>
<details><summary>States and implementation contract</summary><ul>{states}</ul>
<p>{' · '.join(board['canonical_patterns'])}</p><a href="{board['prompt']}">Generation brief</a></details></article>''')
    markdown += [f'## {board["id"][:2]} / {board["title"]}', '',
                 f'![{board["title"]}: desktop, tablet and mobile]({board["image"]})', '',
                 f'[Full image]({board["image"]}) · [Brief]({board["prompt"]})', '']
links = ''.join(f'<a href="#{b["id"]}">{b["id"][:2]} {html.escape(b["title"])}</a>' for b in manifest['boards'])
page = '''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LetBuyy responsive mockup catalogue</title><style>
:root{color-scheme:light;--plum:#1e1a2d;--action:#2c2642;--link:#523f97;--focus:#6c54c4;--wash:#e7e3f7;--canvas:#f6f7f9;--text:#111827;--muted:#6b7280;--line:#e5e7eb}
*{box-sizing:border-box}body{margin:0;background:var(--canvas);color:var(--text);font:14px/1.5 system-ui,sans-serif}
header{background:var(--plum);color:white;padding:32px max(24px,calc((100vw - 1500px)/2));}h1{margin:0 0 12px;font-size:28px;line-height:1.25;font-weight:600}header p{max-width:920px;margin:8px 0}header a{color:#c9bfed}
main{max-width:1564px;padding:24px 32px 64px;margin:auto}nav{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:24px}nav a{background:white;border:1px solid var(--line);padding:8px 12px;border-radius:8px;text-decoration:none}
a{color:var(--link)}a:focus-visible,summary:focus-visible{outline:2px solid var(--focus);outline-offset:3px}article{background:white;border:1px solid var(--line);border-radius:12px;margin-bottom:32px;overflow:hidden;scroll-margin-top:16px}
h2{font-size:20px;line-height:28px;margin:20px 24px 4px}.meta{color:var(--muted);margin:0 24px 16px}.image-link{display:block}img{display:block;width:100%;height:auto}details{padding:16px 24px;border-top:1px solid var(--line)}summary{cursor:pointer;font-weight:600;min-height:32px}li{margin:8px 0}footer{padding:24px;text-align:center;color:var(--muted)}
@media(max-width:767px){header{padding:24px 16px}main{padding:16px}h1{font-size:24px}h2{font-size:18px;margin:16px 16px 4px}.meta{margin:0 16px 12px}nav{display:block}nav a{display:block;margin:8px 0;min-height:44px}details{padding:16px}}
</style><header><h1>LetBuyy / Responsive system catalogue</h1>
<p>20 proposed Storybook-style boards. Every board contains desktop, tablet and mobile. Open an image at full size to inspect it.</p>
<p>Generated visual proposals, not shipped UI or end-to-end evidence. Exact tokens, capability and behavior contracts take precedence over incidental raster details.</p>
<p><a href="README.md">Mockup plan</a> · <a href="../03_PREMIUM_PURPLE_SYSTEM.md">Exact purple system</a> · <a href="VISUAL_REVIEW.md">Visual review</a> · <a href="mockup-manifest.json">Manifest</a></p></header><main><nav aria-label="Board index">'''+links+'</nav>'+''.join(cards)+'</main><footer>LetBuyy · 22 October 2026 · No external scripts, fonts, analytics or network dependencies.</footer></html>'
(root / 'index.html').write_text(page)
(root / 'GALLERY.md').write_text('\n'.join(markdown))
print(f'Rendered catalogue for {len(cards)} boards.')
