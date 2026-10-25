from pathlib import Path
import json,zipfile,hashlib,sys
from PIL import Image,ImageDraw,ImageFont
ROOT=Path(__file__).resolve().parent.parent
scenes=json.loads((ROOT/'scenes.json').read_text())
fontpath='/System/Library/Fonts/Supplemental/Arial.ttf'
font=ImageFont.truetype(fontpath,25)
selected=next((a.split('=',1)[1].split(',') for a in sys.argv if a.startswith('--scenes=')),None)
for scene in scenes:
 if selected and scene['id'] not in selected:continue
 columns=[]
 for device in ['desktop','tablet','mobile']:
  im=Image.open(ROOT/'images'/f'{scene["id"]}-{device}.png').convert('RGB')
  im=im.resize((round(im.width*.8),round(im.height*.8)),Image.Resampling.LANCZOS)
  columns.append((device,im))
 w=sum(im.width for _,im in columns)+104;h=max(im.height for _,im in columns)+116
 board=Image.new('RGB',(w,h),'#e7e2d8');draw=ImageDraw.Draw(board)
 draw.text((26,17),f'PLAYFIELD  /  {scene["title"]}  /  visual reference v1',fill='#29251d',font=font)
 x=26
 for device,im in columns:
  draw.text((x,59),device.upper(),fill='#29251d',font=font)
  board.paste(im,(x,95));x+=im.width+26
 board.save(ROOT/'boards'/f'{scene["id"]}.png',optimize=True)
with zipfile.ZipFile(ROOT/'Playfield-45-mockups.zip','w',zipfile.ZIP_DEFLATED) as z:
 for f in sorted((ROOT/'images').glob('*.png')):z.write(f,'images/'+f.name)
board_records=[]
for f in sorted((ROOT/'boards').glob('*.png')):
 im=Image.open(f);board_records.append({'file':str(f.relative_to(ROOT)),'width':im.width,'height':im.height,'sha256':hashlib.sha256(f.read_bytes()).hexdigest(),'scale':.8,'role':'Additional comparison board; individual device PNGs are unscaled captures'})
(ROOT/'boards/manifest.json').write_text(json.dumps(board_records,indent=2)+'\n')
print('Packaged',len(scenes),'boards and',len(list((ROOT/'images').glob('*.png'))),'screens')
