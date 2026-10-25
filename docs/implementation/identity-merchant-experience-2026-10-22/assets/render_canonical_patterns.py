"""Original canonical-pattern proposal board; documentation only, not runtime UI."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

O=Path(__file__).parent
im=Image.new('RGB',(1800,1160),'#F6F7F9');d=ImageDraw.Draw(im)
def f(n):return ImageFont.truetype('/System/Library/Fonts/SFNS.ttf',n)
def text(x,y,s,n=22,c='#111827'):d.text((x,y),s,font=f(n),fill=c)
def box(x,y,w,h,c='#FFFFFF',r=12,edge='#E5E7EB'):
 d.rounded_rectangle((x,y,x+w,y+h),radius=r,fill=c,outline=edge,width=1)
text(54,32,'LetBuyy canonical workspace patterns',43)
text(54,92,'PROPOSED · existing shared owners · premium plum + white · no application source changed',20,'#6B7280')
for x,title,context in [(54,'Merchant record','Products  /  Edit product'),(927,'Settings task','Settings  /  General')]:
 box(x,148,819,906)
 box(x,148,819,66,'#1E1A2D',12,'#1E1A2D')
 text(x+22,169,context,22,'#FFFFFF')
 text(x+24,240,title,30)
 text(x+24,285,'One task heading · clear scope · deliberate action hierarchy',18,'#6B7280')
 box(x+24,339,771,500,'#FFFFFF',12)
 text(x+45,361,'Product details' if x==54 else 'Store details',24)
 text(x+45,404,'Meaningful section heading',19,'#6B7280')
 text(x+45,455,'Title' if x==54 else 'Store name',21)
 box(x+45,493,724,50,'#FFFFFF',8,'#8F88A9')
 text(x+59,506,'Cotton sample' if x==54 else 'Research storefront',21)
 text(x+45,564,'Description' if x==54 else 'Business defaults',21)
 box(x+45,602,724,149,'#F6F7F9',8)
 text(x+60,620,'Related fields use shared spacing and control roles',19,'#6B7280')
 text(x+60,664,'Validation, safe input and recovery remain in context',19,'#6B7280')
 text(x+45,779,'Semantic heading + field label + help/error relationship',18,'#6B7280')
 box(x+127,877,568,62,'#1E1A2D',30,'#1E1A2D')
 text(x+147,897,'Unsaved changes',20,'#FFFFFF')
 text(x+387,897,'Discard',19,'#C9BFED')
 box(x+488,889,105,38,'#FFFFFF',19,'#FFFFFF');text(x+516,897,'Save',19,'#2C2642')
 text(x+30,982,'Same dirty contract; placement follows the owning workspace',18,'#6B7280')
text(54,1087,'Required behavior: one main landmark · no invisible focus stops · protected draft · truthful pending/outcome',23)
im.save(O/'canonical-pattern-board.png')
print(O/'canonical-pattern-board.png')
