from PIL import Image, ImageDraw
from pathlib import Path
import json, math
b=Path(__file__).parent;r=json.load(open(b/'browser-report.json'));names=['circuit-collection','circuit-search','habitat-search','habitat-search-physical','madeyours-search','playfield-search'];can=Image.new('RGB',(1500,1320),'#e5e5e5');d=ImageDraw.Draw(can)
for i,name in enumerate(names):
 for j,width in enumerate([320,768,1440]):
  x=next(x for x in r['records'] if x['scene']==name and x['width']==width);v=x['r01'];o=v['observation'];im=Image.open(b/'screenshots'/v['screenshot']);top=max(0,int(o['rect']['y'])-35);bottom=min(im.height,math.ceil(max(o['rect']['bottom'],o['button']['rect']['bottom']))+35);left=max(0,int(o['rect']['x'])-10);right=min(im.width,math.ceil(max(o['rect']['right'],o['button']['rect']['right']))+15);crop=im.crop((left,top,right,bottom));stitched=crop.width>480
  if stitched:
   a=crop.crop((0,0,300,crop.height));c=crop.crop((crop.width-170,0,crop.width,crop.height));crop=Image.new('RGB',(480,crop.height),'#000');crop.paste(a,(0,0));crop.paste(c,(310,0))
  if crop.height>185:crop.thumbnail((480,185))
  can.paste(crop,(j*500+8,i*220+27));d.text((j*500+8,i*220+7),f'{name} / {width}px'+(' [input / button stitched]' if stitched else ''),fill='black')
can.save(b/'r01-all-widths-contact.png')
# Initial page contacts preserve page aspect ratio; raw full-page PNGs remain authoritative.
for owner,names in [('circuit',['circuit-collection','circuit-search']),('playfield',['playfield-collection','playfield-collection-empty','playfield-search','playfield-search-empty'])]:
 can=Image.new('RGB',(1500,len(names)*700),'#e5e5e5');d=ImageDraw.Draw(can)
 for i,name in enumerate(names):
  for j,width in enumerate([320,768,1440]):
   x=next(x for x in r['records'] if x['scene']==name and x['width']==width);file=x.get('r02',{}).get('openedScreenshot') or x['screenshot'];im=Image.open(b/'screenshots'/file);im.thumbnail((480,665));can.paste(im,(j*500+8,i*700+27));d.text((j*500+8,i*700+7),f'{name} / {width}px / '+('open disclosure' if x.get('r02',{}).get('openedScreenshot') else 'initial'),fill='black')
 can.save(b/f'{owner}-all-widths-contact.png')
