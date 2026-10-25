from pathlib import Path
from PIL import Image,ImageOps,ImageDraw
import json
R=Path('/Volumes/Projects/LetBuyy/docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22'); P=json.loads((R/'evidence/proposed-portfolio.json').read_text());V=R/'visuals'
for page in ['home','collection','product']:
 for device in ['desktop','mobile']:
  cw,ch=(450,600) if device=='desktop' else (260,1000)
  out=Image.new('RGB',(cw*5,ch*2+64),'#f4f3f0');d=ImageDraw.Draw(out);d.text((15,16),f'PROPOSED / {page.upper()} / {device.upper()} / Original annotated hierarchy schematics',fill='#222')
  for i,p in enumerate(P):
   im=Image.open(V/'rendered'/f'{p["id"]}-{page}-{device}.png').convert('RGB');im.thumbnail((cw-16,ch-48));x=(i%5)*cw+8;y=(i//5)*ch+64;out.paste(im,(x,y+24));d.text((x,y),p['name']+' / '+p['id'],fill='#222')
  out.save(V/f'{page}-{device}-comparison.jpg',quality=90)
# Comparable source home screenshots: top viewport only, labelled synthetic.
out=Image.new('RGB',(1800,650),'#eee');d=ImageDraw.Draw(out);d.text((18,14),'CURRENT SOURCE / SAME SYNTHETIC CATALOG / 1440 x 1000 opening crops / not live merchant stores',fill='#222')
for i,p in enumerate(P):
 im=Image.open(R/'evidence'/f'letbuyy-{p["id"]}-source-render-desktop.jpg').convert('RGB');im=im.crop((0,0,1440,min(1000,im.height)));im.thumbnail((346,660));x=(i%5)*360+6;y=(i//5)*290+48;out.paste(im,(x,y+25));d.text((x,y),p['id'],fill='#222')
out.save(V/'current-ten-source-comparison.jpg',quality=90)
# Refresh 23 demo contact sheets so supplementary Heritage cart is reflected.
for rec in json.loads((R/'evidence/authored-theme-profiles.json').read_text()):
 slug=rec['slug'];out=Image.new('RGB',(1440,1080),'#e8e8e8');d=ImageDraw.Draw(out);d.text((20,16),slug.upper()+' / Shopify live demo / opening viewport crops',fill='#222')
 for idx,state in enumerate(['home-desktop','collection-desktop','product-desktop','home-mobile','product-mobile','cart-mobile']):
  f=R/'evidence'/f'{slug}-{state}.jpg';x=(idx%3)*475+20;y=60 if idx<3 else 580;d.text((x,y),state,fill='#333')
  if f.exists():
   im=Image.open(f).convert('RGB');im=im.crop((0,0,min(im.width,1440 if 'desktop'in state else 390),min(im.height,1000 if 'desktop'in state else 844)));im.thumbnail((450,450));out.paste(im,(x,y+25))
  else:d.text((x,y+50),'Separate route not captured; see coverage',fill='#555')
 out.save(V/'inspection-sheets'/f'{slug}.jpg',quality=90)
