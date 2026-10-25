from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,zipfile,hashlib,struct
R=Path(__file__).resolve().parent.parent
scenes=json.loads((R/'scenes.json').read_text())
fontpath=R/'assets/inter-600.ttf'
f=ImageFont.truetype(str(fontpath),24);small=ImageFont.truetype(str(R/'assets/inter-400.ttf'),18)
for s in scenes:
 ims=[]
 for device in ['desktop','tablet','mobile']:
  im=Image.open(R/'images'/f'{s["id"]}-{device}.png').convert('RGB');im=im.resize((round(im.width*.625),round(im.height*.625)),Image.Resampling.LANCZOS);ims.append((device,im))
 h=max(im.height for _,im in ims)+168
 board=Image.new('RGB',(1800,h),'#e7eaf7');d=ImageDraw.Draw(board);d.text((38,24),'MADEYOURS  /  '+s['id']+'  /  '+s['title'],font=f,fill='#23243e')
 x=38
 for device,im in ims:
  d.text((x,76),device.upper()+'  '+{'desktop':'1440 × 1000','tablet':'834 × 1112','mobile':'390 × 844'}[device],font=small,fill='#484b8b');board.paste(im,(x,110));x+=im.width+28
 d.text((38,h-34),'Independent CSS viewports · DPR 1 · Full-page images shown at 62.5% · Visual proposal / fictional fixtures',font=small,fill='#595d7d')
 board.save(R/'boards'/f'{s["id"]}.png',optimize=True)
with zipfile.ZipFile(R/'MadeYours-45-mockups.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted((R/'images').glob('*.png')):z.write(p,p.name)
cards=[]
for s in scenes:
 cards.append(f'<article class="gallery-card" id="{s["id"]}"><a href="boards/{s["id"]}.png"><img src="boards/{s["id"]}.png" alt="{s["title"]} three-device board" loading="lazy"></a><div><span class="eyebrow">{s["id"]}</span><h2>{s["title"]}</h2><p class="small">{s["description"]}</p><div class="row" style="margin-top:20px">'+''.join(f'<a href="images/{s["id"]}-{d}.png">{d.title()} PNG</a>' for d in ['desktop','tablet','mobile'])+f'<a href="{s["source"]}">Source</a></div></div></article>')
(R/'index.html').write_text('''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MadeYours · 45 responsive design targets</title><link rel="stylesheet" href="source/styles.css"></head><body><main class="wrap section"><span class="eyebrow">NOVA / MadeYours / Milestone 1 / Design v1</span><h1>Choose. Specify. Review.</h1><p style="margin-top:24px;max-width:760px">45 independent PNGs across 15 connected scenes, plus 15 three-device boards. Bounded text personalization with an authoritative configuration retained through cart and order. Visual references with fictional fixtures; no production integration or transaction is claimed.</p><div class="review-nav"><a class="button" href="MadeYours-45-mockups.zip">Download 45 PNGs</a><a class="button secondary" href="prototype-index.html">Responsive sources</a><a class="button secondary" href="comparisons/index.html">Research comparisons</a><a class="button secondary" href="comparisons/neutral.html">Neutral structures</a><a class="button secondary" href="README.md">Design handoff</a></div><label class="field" style="max-width:500px">Jump to scene<select id="scene-selector"><option value="">Choose a scene</option>'''+''.join(f'<option value="{s["id"]}">{s["id"]} · {s["title"]}</option>' for s in scenes)+'''</select></label><p class="small" style="margin:24px 0">Desktop 1440 × 1000 · Tablet 834 × 1112 · Mobile 390 × 844 · DPR 1 · Full-page heights vary. Open a device PNG for readable full size.</p><div class="gallery-grid">'''+''.join(cards)+'''</div><section class="section stack"><h2>Evidence and dependencies</h2><div class="row" style="flex-wrap:wrap"><a class="textlink" href="responsive-audit.json">Viewport audit</a><a class="textlink" href="exports.json">Export hashes</a><a class="textlink" href="validation.json">Validation</a><a class="textlink" href="capabilities.json">A–E capability map</a><a class="textlink" href="generation-prompts.json">Asset prompts</a></div><p class="small">Home scenes 01–02 form one homepage. PDP scenes 04–06 form one product route and its states. Account/identity/checkout remain canonical shared systems. Supplementary stress/reference images are excluded from the 45-image ZIP.</p></section></main><script>document.getElementById('scene-selector').addEventListener('change',e=>{const el=document.getElementById(e.target.value);if(el)el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});});</script></body></html>''')
contact=Image.new('RGB',(1050,15*330),'#e7eaf7');draw=ImageDraw.Draw(contact);label=ImageFont.truetype(str(R/'assets/inter-600.ttf'),18)
for row,scene in enumerate(scenes):
 for col,device in enumerate(['desktop','tablet','mobile']):
  im=Image.open(R/'images'/f'{scene['id']}-{device}.png').convert('RGB');im.thumbnail((330,100000));contact.paste(im.crop((0,0,im.width,min(im.height,290))),(col*350+10,row*330+30));draw.text((col*350+10,row*330+6),f"{scene['id']} {device}",font=label,fill='#23243e')
contact.save(R/'comparisons/qa-overview.png')
print('Packaged 15 boards, gallery, QA overview and ZIP')
