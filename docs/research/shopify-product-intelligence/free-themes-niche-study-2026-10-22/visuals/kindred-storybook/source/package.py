from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import json,zipfile,hashlib,re,struct,collections
from html.parser import HTMLParser
R=Path(__file__).resolve().parent.parent
scenes=json.loads((R/'scenes.json').read_text())
font='/System/Library/Fonts/Supplemental/Arial.ttf'
def f(s):return ImageFont.truetype(font,s)
def label(canvas,xy,text,size=24,color='#342c2c'):ImageDraw.Draw(canvas).text(xy,text,font=f(size),fill=color)
boards=[]
for scene in scenes:
 ims=[]
 for device,w in [('desktop',720),('tablet',417),('mobile',195)]:
  im=Image.open(R/'images'/f'{scene["id"]}-{device}.png').convert('RGB');h=round(im.height*w/im.width);ims.append((device,im.resize((w,h),Image.Resampling.LANCZOS)))
 width=sum(im.width for d,im in ims)+96;height=max(im.height for d,im in ims)+150
 b=Image.new('RGB',(width,height),'#eee8e2');label(b,(24,16),scene['id']+' · '+scene['title'],26)
 x=24
 for d,im in ims:
  label(b,(x,64),d.upper()+' · '+str({'desktop':1440,'tablet':834,'mobile':390}[d])+' CSS px',15);b.paste(im,(x,100));x+=im.width+24
 file='boards/'+scene['id']+'-devices.png';b.save(R/file);boards.append({'scene':scene['id'],'file':file,'width':width,'height':height,'note':'Full independent screenshots, scaled only inside this additional review board. Source PNGs retain their native dimensions.'})
(R/'boards/manifest.json').write_text(json.dumps(boards,indent=2))
with zipfile.ZipFile(R/'Kindred-45-mockups.zip','w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted((R/'images').glob('*.png')):z.write(p,p.name)
# Original saved reference screenshots remain research evidence only.
research=R.parent.parent
references=[('craft','collection',research/'evidence/craft-collection-desktop.jpg','03-collection','https://theme-craft-demo.myshopify.com/collections/bundles','Large curated set cards and category-first navigation','Retain complete-object media and familiar catalog controls. Kindred adds independent occasion, recipient and budget choices plus fixed contents and packaging context.','C: typed gift facets and safe query hydration'),('taste','product',research/'evidence/taste-product-desktop.jpg','05-product-contents','https://theme-taste-demo.myshopify.com/products/green-bundle-1','Named fixed bundle contents below a conventional purchase area','Retain explicit contents. Kindred brings countable contents into a dedicated open/closed box decision area; no nutrition claims, configurable bundle or gifting-message feature is inferred.','C: bounded gift contents; A: media; A/B: real packaging SKU')]
refmeta=[]
for name,state,src,scene,url,observed,difference,contract in references:
 orig=Image.open(src).convert('RGB');target=Image.open(R/'images'/f'{scene}-desktop.png').convert('RGB');w=720;h=500
 b=Image.new('RGB',(1488,660),'#f4f1ed');label(b,(18,14),name.title()+' reference / Kindred 1.0 design · desktop 1440×1000 CSS px',23)
 for x,im,title in [(16,orig,name.title()+' · '+state+' · saved 22 Oct 2026'),(752,target,'Kindred · '+scene+' · current design')]:
  label(b,(x,56),title,16);crop=im.crop((0,0,min(1440,im.width),min(1000,im.height))).resize((w,h),Image.Resampling.LANCZOS);b.paste(crop,(x,92))
 label(b,(18,612),'Comparable opening viewport crops. No reference photo, logo or copy is used in Kindred UI.',16)
 file='comparisons/'+name+'-side-by-side.png';b.save(R/file)
 refmeta.append({'reference':name.title(),'url':url,'savedCaptureDate':'2026-10-22','viewport':{'width':1440,'height':1000,'dpr':1},'state':state,'referenceImage':str(src.relative_to(research)),'comparison':file,'kindredScene':scene,'observed':observed,'retainedConvention':observed,'deliberateDifference':difference,'requiredContract':contract,'limits':'Saved reference screenshot inspected. Taste selected capture has blank main media; this is an incomplete load, not a proposed layout. Public web text rechecked 22 Oct 2026; crawl freshness varies. No transaction or filter-combination certification.'})
(R/'comparisons/references.json').write_text(json.dumps(refmeta,indent=2))
# Gallery with full PNG and source links.
css='''body{margin:0;background:#fffaf4;color:#342c2c;font:16px/1.55 Lato,Arial}header,main{max-width:1240px;margin:auto;padding:30px}h1,h2{font-family:Playfair Display,Georgia;font-weight:400}h1{font-size:48px}h2{font-size:29px}a{color:#662e42}nav{display:flex;flex-wrap:wrap;gap:15px;margin:25px 0}.scene{border-top:1px solid #cbbab4;padding:30px 0}.screens{display:grid;grid-template-columns:1.6fr 1fr .6fr;gap:22px}.screens figure{margin:0;min-width:0}.screens img{width:100%;height:420px;object-fit:cover;object-position:top;border:1px solid #cbbab4;border-radius:5px}.screens figcaption{margin:10px 0;font-size:14px}.desc{max-width:80ch}button{font:inherit}select{padding:12px;max-width:100%}section>a{display:inline-block;margin:12px 16px 10px 0}details{margin:20px 0}summary{cursor:pointer}details img{width:100%;height:auto}.badge{font-size:13px;border:1px solid #8a716b;border-radius:20px;padding:5px 12px;display:inline-block}@media(max-width:700px){header,main{padding:23px}h1{font-size:38px}.screens{grid-template-columns:1fr}.screens img{height:auto;max-height:650px;object-fit:contain;object-position:top}.screens figure{border-bottom:1px solid #cbbab4}.screens figcaption{font-size:16px}}'''
rows=''
for s in scenes:
 rows+=f'<section class="scene" id="{s["id"]}"><h2>{s["id"]} · {s["title"]}</h2><p class="desc">{s["description"]}</p><a href="{s["source"]}">Open responsive source</a><a href="boards/{s["id"]}-devices.png">Three-device board</a><div class="screens">'+''.join(f'<figure><a href="images/{s["id"]}-{d}.png"><img src="images/{s["id"]}-{d}.png" loading="lazy" alt="{s["title"]} on {d}"></a><figcaption>{d.title()} · {w} CSS px · <a href="images/{s["id"]}-{d}.png">Full PNG</a></figcaption></figure>' for d,w in [('desktop',1440),('tablet',834),('mobile',390)])+'</div></section>'
(R/'index.html').write_text('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kindred · 45 responsive mockups</title><link rel="stylesheet" href="source/fonts.css"><style>'+css+'</style></head><body><header><span class="badge">Milestone 1 · Visual reference · Fictional fixtures</span><h1>Kindred.<br>A thoughtful way to find a gift.</h1><p class="desc">15 connected scenes. 45 independent PNGs. 15 additional device boards. Native text and one responsive presentation source. Ready-made sets with occasion, recipient and budget discovery.</p><nav><a href="Kindred-45-mockups.zip">Download 45 PNGs</a><a href="prototype-index.html">Editable prototype</a><a href="README.md">Design handoff</a><a href="comparisons/index.html">Research & structural comparisons</a><a href="validation.json">Validation</a></nav><label>Jump to scene <select onchange="location.hash=this.value">'+''.join(f'<option value="{s["id"]}">{s["id"]} · {s["title"]}</option>'for s in scenes)+'</select></label><details><summary>Evidence and implementation limits</summary><p>Actual viewports: desktop1440×1000, tablet834×1112, mobile390×844, DPR1. Full-page images may be taller. These are design references, not live stores, identity or payments. Filters, facts, packaging selection, account data and checkout require canonical implementation contracts. No gift-message control is offered. Unknown-industry fallback remains neutral.</p></details></header><main>'+rows+'</main></body></html>')
# Whole-pack overview must reflect the current identity boards too.
overview=Image.new('RGB',(1800,3400),'#eee8e2')
for i,p in enumerate(sorted((R/'boards').glob('*.png'))):
 im=Image.open(p).convert('RGB');im.thumbnail((570,610));x=(i%3)*600+15;y=(i//3)*680+40;overview.paste(im,(x,y));label(overview,(x,y-25),p.name,20)
overview.save(R/'comparisons/all-scenes-overview.png')
print('Packaged',len(boards),'boards and 45-PNG ZIP; gallery written')
