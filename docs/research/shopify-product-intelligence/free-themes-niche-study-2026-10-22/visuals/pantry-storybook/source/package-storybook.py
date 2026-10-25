from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
import json,zipfile,hashlib,sys
R=Path(__file__).resolve().parent.parent;scenes=json.loads((R/'scenes.json').read_text()); devices=['desktop','tablet','mobile']
font=ImageFont.truetype(str(R/'assets/inter-500.ttf'),22); small=ImageFont.truetype(str(R/'assets/inter-400.ttf'),16)
for s in ([x for x in scenes if x['id']=='14-order-detail'] if '--order' in sys.argv else scenes):
 panels=[]
 for device,w in [('desktop',620),('tablet',359),('mobile',240)]:
  im=Image.open(R/f'images/{s["id"]}-{device}.png').convert('RGB');h=round(im.height*w/im.width);im=im.resize((w,h),Image.Resampling.LANCZOS);panels.append((device,im))
 H=max(i.height for _,i in panels)+128;board=Image.new('RGB',(1300,H),'#eee8d8');d=ImageDraw.Draw(board);d.text((24,18),f'PANTRY / {s["id"]} / {s["title"]}',font=font,fill='#262a1d');x=24
 for device,im in panels:
  viewport={'desktop':'1440 × 1000','tablet':'834 × 1112','mobile':'390 × 844'}[device];d.text((x,62),f'{device.capitalize()} · {viewport} · DPR1',font=small,fill='#36533d');board.paste(im,(x,96));x+=im.width+24
 board.save(R/f'boards/{s["id"]}.png',optimize=True)
with zipfile.ZipFile(R/'Pantry-45-mockups.zip','w',zipfile.ZIP_DEFLATED) as z:
 for s in scenes:
  for device in devices:
   p=R/f'images/{s["id"]}-{device}.png';z.write(p,str(p.relative_to(R)))
style='''@font-face{font-family:Inter;src:url(assets/inter-400.ttf)}*{box-sizing:border-box}body{font:16px/1.55 Inter,system-ui;background:#fcf8ef;color:#262a1d;margin:0}a{color:#36533d;text-underline-offset:4px}header{background:#eee8d8;padding:40px max(24px,calc((100vw - 1240px)/2))}h1{font-size:44px;margin:12px 0;letter-spacing:-.04em}nav{display:flex;flex-wrap:wrap;gap:18px;margin:20px 0}main{max-width:1300px;margin:auto;padding:30px 24px}.scene{border-top:1px solid #707858;margin:35px 0;padding-top:20px}h2{font-size:26px;margin:0 0 10px}p{max-width:860px}.jump{display:flex;flex-wrap:wrap;gap:9px}.jump a{display:block;padding:8px 11px;border:1px solid #707858;border-radius:4px;text-decoration:none}.devices{display:grid;grid-template-columns:1.5fr 1fr .7fr;gap:20px;align-items:start;margin:24px 0}figure{margin:0;min-width:0}figure img{width:100%;border:1px solid #707858;display:block}figcaption{font-size:14px;margin-bottom:10px}button{font:inherit;padding:10px 16px;background:#36533d;color:white;border:0;border-radius:5px;cursor:pointer}summary{cursor:pointer;padding:12px}details img{width:100%}.sticky{background:#fcf8ef;padding:10px 0}a:focus-visible,button:focus-visible{outline:2px solid #005fcc;outline-offset:4px}@media(max-width:700px){h1{font-size:34px}.devices{grid-template-columns:1fr}.devices figure img{max-height:650px;object-fit:contain;object-position:top;background:#eee8d8}}'''
html='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pantry · 45 responsive mockups</title><style>'+style+'</style><header><p>PANTRY / REFRESH / VISUAL REFERENCE V1</p><h1>The everyday pantry, clearly considered.</h1><p>15 connected scenes. 45 genuine independently rendered PNGs. 15 additional three-device boards. Shelf-stable food: ingredients, pack count and net quantity before purchase.</p><nav><a href="Pantry-45-mockups.zip">Download 45 PNGs</a><a href="prototype-index.html">Responsive source</a><a href="README.md">Design handoff</a><a href="comparisons/index.html">Research comparison</a><a href="comparisons/neutral-structure.html">Neutral structure</a><a href="validation.json">Validation</a></nav><p>Fictional design fixtures; no live login, order, payment or production implementation. Desktop 1440×1000, tablet 834×1112, mobile 390×844 CSS px, DPR1. Full-page heights vary.</p></header><main><nav class="jump" aria-label="Scenes">'+''.join(f'<a href="#{s["id"]}">{s["id"][:2]}</a>' for s in scenes)+'</nav>'
for s in scenes:
 html+=f'<section class="scene" id="{s["id"]}"><h2>{s["id"][:2]} · {s["title"]}</h2><p>{s["mission"]}</p><nav><a href="{s["source"]}">Open responsive source</a><a href="boards/{s["id"]}.png">Full three-device board</a><a href="#top">Top</a></nav><div class="devices">'
 for device in devices:
  html+=f'<figure><figcaption>{device.capitalize()} · <a href="images/{s["id"]}-{device}.png">Full-size PNG</a></figcaption><a href="images/{s["id"]}-{device}.png"><img loading="lazy" src="images/{s["id"]}-{device}.png" alt="{s["title"]} — {device}"></a></figure>'
 html+=f'</div><details><summary>Three-device board</summary><img loading="lazy" src="boards/{s["id"]}.png" alt="{s["title"]} three-device comparison"></details></section>'
html+='</main></html>';html=html.replace('<header>','<header id="top">',1);(R/'index.html').write_text(html)
print(('Refreshed scene14 board; retained 15 total boards' if '--order' in sys.argv else 'Built 15 boards')+', 45-current-PNG ZIP and navigable gallery')
