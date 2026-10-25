"""Render the proposed design board. Documentation artifact, never runtime tokens."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).parent
PALETTE = {
    'rail': '#1E1A2D', 'primary': '#2C2642', 'hover': '#362C58',
    'link': '#523F97', 'focus': '#6C54C4', 'wash': '#E7E3F7',
    'canvas': '#F6F7F9', 'surface': '#FFFFFF', 'text': '#111827',
    'secondary': '#6B7280', 'divider': '#E5E7EB', 'controlBoundary': '#8F88A9',
}
def luminance(h):
    rgb = [int(h[i:i+2],16)/255 for i in (1,3,5)]
    c = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in rgb]
    return .2126*c[0]+.7152*c[1]+.0722*c[2]
def contrast(a,b):
    x,y=sorted([luminance(a),luminance(b)])
    return (y+.05)/(x+.05)
pairs=[]
for role, fg, bg, threshold in [
    ('body / white',PALETTE['text'],PALETTE['surface'],4.5),
    ('secondary / white',PALETTE['secondary'],PALETTE['surface'],4.5),
    ('secondary / canvas',PALETTE['secondary'],PALETTE['canvas'],4.5),
    ('primary label',PALETTE['surface'],PALETTE['primary'],4.5),
    ('hover label',PALETTE['surface'],PALETTE['hover'],4.5),
    ('rail primary text',PALETTE['surface'],PALETTE['rail'],4.5),
    ('rail secondary text','#C9BFED',PALETTE['rail'],4.5),
    ('link / white',PALETTE['link'],PALETTE['surface'],4.5),
    ('link / lavender wash',PALETTE['link'],PALETTE['wash'],4.5),
    ('focus / white',PALETTE['focus'],PALETTE['surface'],3),
    ('focus / canvas',PALETTE['focus'],PALETTE['canvas'],3),
    ('proposed control boundary / white',PALETTE['controlBoundary'],PALETTE['surface'],3),
    ('proposed control boundary / canvas',PALETTE['controlBoundary'],PALETTE['canvas'],3),
    ('divider / white — decorative only',PALETTE['divider'],PALETTE['surface'],3),
    ('focus / primary — requires white offset',PALETTE['focus'],PALETTE['primary'],3),
]:
    value=contrast(fg,bg)
    pairs.append(dict(role=role,foreground=fg,background=bg,ratio=value,threshold=threshold,meets_pair_threshold=value>=threshold))
(OUT/'contrast-pairs.json').write_text(json.dumps({'method':'WCAG sRGB relative luminance; opaque pairs; no rounding before comparison','scope':'Proposed documentation palette and selected current pairs. Not page conformance.','palette':PALETTE,'pairs':pairs},indent=2)+'\n')

im=Image.new('RGB',(1800,1300),PALETTE['canvas']);d=ImageDraw.Draw(im)
font_path='/System/Library/Fonts/SFNS.ttf'
mono_path='/System/Library/Fonts/SFNSMono.ttf'
def font(n,mono=False):return ImageFont.truetype(mono_path if mono else font_path,n)
def text(x,y,s,n=24,c=None):d.text((x,y),s,font=font(n),fill=c or PALETTE['text'])
def box(b,fill,r=14,outline=None):d.rounded_rectangle(b,radius=r,fill=fill,outline=outline,width=1)
text(60,40,'LetBuyy  /  Premium purple',45)
text(60,105,'PROPOSED VISUAL SYSTEM · 22 OCT 2026 · Existing brandInk family',19,PALETTE['secondary'])
roles=[('Plum rail','rail'),('Primary action','primary'),('Links','link'),('Focus','focus'),('Selection wash','wash'),('Canvas','canvas'),('Work surface','surface')]
for i,(label,key) in enumerate(roles):
    x=60+i*243
    box((x,160,x+222,260),PALETTE[key],12,PALETTE['divider'])
    text(x,277,label,23);text(x,311,PALETTE[key],19,PALETTE['secondary'])

# Original schematic, not an implemented application screenshot.
box((60,380,1740,1120),PALETTE['surface'],20,PALETTE['divider'])
box((60,380,315,1120),PALETTE['rail'],20)
d.rectangle((295,380,315,1120),fill=PALETTE['rail'])
text(92,412,'LETBUYY',28,'#FFFFFF');text(92,458,'Merchant workspace',18,'#C9BFED')
for i,label in enumerate(['Home','Orders','Products','Customers','Analytics','Online Store']):
    y=520+i*67
    if label=='Products':box((78,y-8,298,y+41),'#393447',8)
    text(98,y,label,24,'#FFFFFF' if label=='Products' else '#C9BFED')
text(98,1037,'Settings',23,'#C9BFED')
text(355,417,'Products',35)
text(355,468,'Clear hierarchy. Quiet surfaces. One decisive action.',22,PALETTE['secondary'])
box((1490,414,1698,464),PALETTE['primary'],8);text(1522,425,'Add product',23,'#FFFFFF')
box((355,530,1698,1080),PALETTE['surface'],12,PALETTE['divider'])
text(382,553,'All products',23)
box((382,609,1280,662),PALETTE['surface'],8,PALETTE['controlBoundary'])
text(400,622,'Search the authorized catalog…',21,PALETTE['secondary'])
box((1300,609,1465,662),PALETTE['canvas'],8,PALETTE['controlBoundary']);text(1320,622,'Status',21)
box((1484,609,1667,662),PALETTE['canvas'],8,PALETTE['controlBoundary']);text(1506,622,'Filters',21)
d.rectangle((356,688,1697,740),fill=PALETTE['canvas'])
for x,s in [(382,'Product'),(1040,'Status'),(1270,'Inventory'),(1510,'Price')]:text(x,704,s,20,PALETTE['secondary'])
for i,(title,status,stock,price) in enumerate([('Everyday cotton shirt','Active','24 available','₹1,290'),('Studio ceramic mug','Draft','0 available','₹690'),('Linen cushion cover','Active','12 available','₹890')]):
    y=762+i*88
    text(382,y,title,23)
    fill='#DCFCE7' if status=='Active' else PALETTE['wash'];ink='#166534' if status=='Active' else PALETTE['link']
    box((1036,y-5,1156,y+34),fill,8);text(1052,y,status,20,ink)
    text(1270,y,stock,21);text(1510,y,price,21)
    d.line((382,y+57,1667,y+57),fill=PALETTE['divider'])
text(355,1150,'Illustrative specification · sample records · not a shipped screen',20,PALETTE['secondary'])
text(60,1210,'White / primary  '+format(contrast('#FFFFFF',PALETTE['primary']),'.2f')+':1',23)
text(505,1210,'Link / white  '+format(contrast(PALETTE['link'],'#FFFFFF'),'.2f')+':1',23)
text(925,1210,'Boundary / white  '+format(contrast(PALETTE['controlBoundary'],'#FFFFFF'),'.2f')+':1',23)
text(1370,1210,'Status keeps meaning',23)
im.save(OUT/'premium-purple-board.png')
print(json.dumps({'image':str(OUT/'premium-purple-board.png'),'pairs':len(pairs),'ratios':{p['role']:round(p['ratio'],3) for p in pairs}},indent=2))
