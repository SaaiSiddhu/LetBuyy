from pathlib import Path
import json,html,textwrap
R=Path('/Volumes/Projects/LetBuyy/docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22');P=json.loads((R/'evidence/proposed-portfolio.json').read_text());W=R/'visuals/wireframes';W.mkdir(exist_ok=True)
class Canvas:
 def __init__(self,p,page,mobile,neutral):
  self.p=p;self.id=p['id'];self.mobile=mobile;self.neutral=neutral;self.w=390 if mobile else 1440;self.h=(2200 if page=='collection' else 1750) if mobile else 1800;self.a=[];self.i=0
  c=p['palette'];self.bg='#FAFAFA' if neutral else c[0];self.surface='#FFF' if neutral else c[1];self.soft='#E7E7E7' if neutral else c[2];self.ink='#202020' if neutral else c[3];self.accent='#444' if neutral else c[6];self.border='#888' if neutral else c[5]
  self.a.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}" role="img" aria-labelledby="t d"><title id="t">{html.escape(("Anonymous structure" if neutral else p["name"])+" "+page+(" mobile" if mobile else " desktop"))}</title><desc id="d">Original proposed research schematic. Boxes are annotated content zones, not implemented controls. No transaction functionality.</desc>')
  self.rect(0,0,self.w,self.h,self.bg)
  self.txt(16 if mobile else 40,25,('NEUTRAL STRUCTURE' if neutral else 'LETBUYY · DESIGN PROPOSAL')+' · '+page.upper(),12)
  self.txt(16 if mobile else 40,49,'Schematic / no live data / '+('390 × 844 opening viewport' if mobile else '1440 × 1000 opening viewport'),11)
  self.rect(0,62,self.w,76,self.surface)
  self.txt(16 if mobile else 40,96,('STORE' if neutral else p['name']),21)
  self.txt(16 if mobile else 300,122 if mobile else 97,('Menu   Search   Cart' if mobile else p['nav']),11 if mobile else 16)
 def rect(self,x,y,w,h,fill=None,stroke=None,rx=0):self.a.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill or self.surface}" stroke="{stroke or self.border}" stroke-width="1"/>')
 def txt(self,x,y,text,size=16,color=None,weight=400):self.a.append(f'<text x="{x}" y="{y}" fill="{color or self.ink}" font-family="Arial,sans-serif" font-size="{size}" font-weight="{weight}">{html.escape(str(text))}</text>')
 def box(self,x,y,w,h,title,body='',kind='content'):
  self.i+=1;fill=(self.soft if self.neutral else self.ink) if kind=='dark' else (self.soft if kind=='media' else self.surface)
  self.rect(x,y,w,h,fill,rx=0 if self.neutral else 6)
  pad=12 if self.mobile else 20;size=16 if self.mobile else 23
  self.txt(x+pad,y+pad+size,f'{self.i:02d}  {title}',size,'#FFFFFF' if kind=='dark' and not self.neutral else None,weight=600)
  lines=textwrap.wrap(body,max(12,int((w-2*pad)/(7 if self.mobile else 8))))[:max(1,min(5,int((h-62)/24)))]
  for k,line in enumerate(lines):self.txt(x+pad,y+pad+size+30+k*23,line,13 if self.mobile else 16,'#FFFFFF' if kind=='dark' and not self.neutral else None)
  if kind=='media' and h>160:
   yy=y+h-26;self.a.append(f'<path d="M{x+pad},{yy} L{x+w*.38},{y+h*.52} L{x+w*.58},{y+h*.75} L{x+w-pad},{y+h*.35}" fill="none" stroke="{self.border}" stroke-width="1"/>')
 def cards(self,x,y,w,n,ratio,labels,kind='default',height=None):
  gap=12 if self.mobile else 24;cw=(w-gap*(n-1))/n;ih=height or cw/ratio
  for j in range(n):
   xx=x+j*(cw+gap);self.rect(xx,y,cw,ih,self.soft,rx=0 if self.neutral else 4)
   if not self.neutral:self.a.append(f'<path d="M{xx+cw*.25},{y+ih*.75} L{xx+cw*.5},{y+ih*.24} L{xx+cw*.76},{y+ih*.75} Z" fill="none" stroke="{self.border}"/>')
   self.txt(xx+8,y+24,labels[j%len(labels)],12 if self.mobile else 17,weight=600)
   suffix={'apparel':'Color · Sizes · ₹ price','toy':'Age · Pieces · ₹ price','spec':'Model · W · Port · ₹','pantry':'Net qty · Pack · ₹ / unit','dimensions':'W × D × H · Finish · ₹','gift':'Contents · Occasion · ₹','custom':'Method · Text limit · ₹','care':'Use · Net qty · ₹','equipment':'Activity · Size · Weight · ₹','book':'Author · Format · Language · ₹'}.get(kind,'Name · ₹ price')
   lines=textwrap.wrap(suffix,max(12,int(cw/8)))
   for k,line in enumerate(lines):self.txt(xx+4,y+ih+23+k*20,line,12 if self.mobile else 15)
  return y+ih+70
 def row(self,x,y,w,title,body,imagew=130,h=128):
  self.rect(x,y,w,h,self.surface);self.rect(x+10,y+10,imagew,h-20,self.soft);self.txt(x+imagew+26,y+34,title,15 if self.mobile else 21,weight=600)
  for k,line in enumerate(textwrap.wrap(body,max(15,int((w-imagew-50)/8)))[:3]):self.txt(x+imagew+26,y+60+k*22,line,12 if self.mobile else 16)
 def footer(self):
  line=844 if self.mobile else 1000;self.a.append(f'<path d="M0,{line} H{self.w}" stroke="#555" stroke-dasharray="8 8"/>');self.txt(12,line-8,'Opening viewport boundary',11)
  self.box(16 if self.mobile else 40,self.h-110,self.w-(32 if self.mobile else 80),80,'Research annotation','Hierarchy and facts differ; server cart and hosted checkout stay shared.')
  return ''.join(self.a)+'</svg>'

def home(c):
 id=c.id
 if c.mobile:
  seq={
  'sense':[('Outfit editorial',340,'media'),('Shop silhouettes',120,'content'),('Portrait arrivals',280,'media'),('Outfit links',180,'content'),('Fabric / fit guide',180,'content')],
  'bloom':[('Age + interest chooser',150,'content'),('Play activity bento',260,'media'),('Age / contents toy cards',250,'content'),('Included pieces / dimensions',180,'content'),('Product warnings and care',180,'content')],
  'forge':[('Persistent product search',80,'content'),('Device / task categories',130,'content'),('Compact product specs',400,'content'),('Compatibility explainer',180,'content'),('Support policy',120,'content')],
  'refresh':[('Pantry shelf shortcuts',130,'content'),('Package rows + net quantity',440,'content'),('Ingredients / allergens first',190,'content'),('Recipe links',220,'media'),('Storage guide',120,'content')],
  'craft':[('Room index',100,'content'),('Room panorama',300,'media'),('Large object + dimensions',350,'media'),('Materials + measure guide',240,'content'),('Delivery policy',120,'content')],
  'summit':[('Occasion / recipient / budget',180,'content'),('Occasion tiles',220,'content'),('Ready-made gift + contents',280,'media'),('Packaging facts',180,'content'),('Gift help',130,'content')],
  'nova':[('Choose → specify → review',190,'content'),('Base products + method',290,'media'),('Customization examples / limits',260,'content'),('Production policy',140,'content'),('Help and process',160,'content')],
  'aura':[('Use / routine introduction',230,'media'),('Routine: each product linked',230,'content'),('Ingredients explained',190,'content'),('Named shade categories',230,'media'),('Directions and policy',150,'content')],
  'ride':[('Choose an activity',170,'dark'),('Activity story + facts',250,'media'),('Equipment with two specs',350,'content'),('Selection and care guide',180,'content'),('Support',100,'content')],
  'dawn':[('Search by title / author',80,'content'),('Subject index',130,'content'),('Cover + editorial excerpt',250,'media'),('Bibliographic book rows',420,'content'),('Author spotlight',180,'content')]}
  y=158
  for title,h,k in seq[id]:c.box(16,y,358,h,title,'Purpose: '+title+'. See blueprint for field and behavior contract.',k);y+=h+18
  return
 if id=='sense':
  c.box(40,162,850,480,'Outfit context','Portrait pair with separately named clothing-category links.','media');c.box(918,162,482,480,'Silhouette and fit','Straight / relaxed / fitted. A visible route into actual garment categories.');c.cards(40,730,1360,3,.75,['Arrivals A','Arrivals B','Arrivals C'],'apparel',height=400);c.box(40,1280,1360,260,'One outfit, separate products','Each linked item retains its own price and availability.','media')
 elif id=='bloom':
  c.box(40,162,1360,140,'Adult-facing chooser','Shop by merchant-stated age range and interest. Skip directly to all toys.');c.box(40,330,650,350,'Build / make / imagine','Activity bento with meaningful category labels.','media');c.box(718,330,682,160,'Age range entries','Unknown values are not inferred.');c.box(718,514,682,166,'Interest entries','Art / puzzles / construction based on actual taxonomy.');c.cards(40,770,1360,3,1,['Creative kit','Puzzle','Construction set'],'toy');c.box(40,1330,1360,190,'Contents and dimensions','What is included, merchant warnings and care; no platform certification.')
 elif id=='forge':
  c.box(40,162,1360,100,'Search model, device or accessory','Prominent product retrieval rather than a large lifestyle campaign.');c.box(40,286,260,540,'Categories / tasks','Charge / connect / listen / devices');c.box(324,286,1076,180,'New device range','Model-level feature summary and one restrained product image.','media');c.cards(324,520,1076,4,1,['Model A','Model B','Model C','Model D'],'spec');c.box(40,1050,1360,230,'Compatibility reference','Explicit supported models and source; unconfirmed remains unconfirmed.');c.box(40,1330,1360,200,'Support / returns','Merchant-supplied support policy and actual warranty terms.')
 elif id=='refresh':
  c.box(40,162,740,210,'Seasonal pantry selection','Compact food context; clear link to shelf categories.','media');c.box(808,162,592,210,'Pantry shelves','Staples / condiments / snacks / ingredients');
  for j in range(4):c.row(40,420+j*150,1360,['Packaged staple','Sauce','Ingredient','Snack'][j],'Net quantity · pack size · unit price when valid · choose SKU / add',180,128)
  c.box(40,1100,660,330,'Ingredients and allergens','Visible factual information before purchase.');c.box(728,1100,672,330,'Recipe to product','Related items are individually priced.','media')
 elif id=='craft':
  c.box(40,162,300,540,'Shop rooms','Living / dining / bedroom. Keep navigation outside the photograph.');c.box(368,162,1032,540,'Room-scale panorama','Show scale and the complete object.','media');c.cards(40,790,1360,2,4/3,['Furniture A','Furniture B'],'dimensions',height=360);c.box(40,1300,1360,230,'Measure / materials / delivery','Numeric dimensions, finish information, assembly text and actual shipping policy.')
 elif id=='summit':
  for j,t in enumerate(['Occasion','Recipient preference','Budget']):c.box(40+j*460,162,440,180,t,'Independent choices with clear-all; skip-to-all remains visible.')
  c.box(40,380,1360,230,'Browse occasions','Birthday / thanks / celebration / just because. No personal profiling.');c.cards(40,690,1360,3,4/3,['Gift set A','Gift B','Gift C'],'gift',height=300);c.box(40,1170,650,280,'What arrives in the box','Included items and packaging described truthfully.','media');c.box(718,1170,682,280,'Gift help','Suitability and real shipping policy; no guaranteed arrival date.')
 elif id=='nova':
  for j,t in enumerate(['1 Choose base','2 Specify text','3 Review result']):c.box(40+j*460,162,440,220,t,'Supported method and constraints; purchase after valid reviewed configuration.')
  c.cards(40,470,1360,3,1,['Base object A','Base object B','Base object C'],'custom',height=320);c.box(40,1000,830,350,'Examples with explicit limits','Illustrative preview paired with authoritative text summary.','media');c.box(898,1000,502,350,'Production policy','No upload or proof-approval promise. Launch gated on order persistence.')
 elif id=='aura':
  c.box(40,162,550,440,'Texture and product','Restrained portrait media; no efficacy before/after.','media');c.box(618,162,782,440,'Choose by use','Routine stage, format and named shade. No diagnosis.');c.cards(40,710,1360,3,.8,['Cleanse','Prepare','Moisturize'],'care',height=340);c.box(40,1210,1360,260,'Ingredient explanation','Readable directions, factual ingredient lists and supplied warnings.')
 elif id=='ride':
  c.box(40,162,1360,320,'Choose your activity','Activity pathways above equipment; dark masthead / light facts below.','dark');c.cards(40,550,1360,3,4/3,['Activity equipment A','Activity equipment B','Activity clothing C'],'equipment',height=280);c.box(40,1010,870,330,'Performance / compatibility facts','Actual category-specific specification table, without certification claims.');c.box(938,1010,462,330,'How to choose','Selection and care guide linked to the current activity.')
 elif id=='dawn':
  c.box(40,162,1360,100,'Search title, author or subject','Known-item retrieval remains primary.');c.box(40,290,280,630,'Subject index','Fiction / design / history / art / stationery');c.box(348,290,220,330,'Cover','2:3 contained cover','media');c.box(596,290,804,330,'Editorial reading pick','Title, author, format, short permitted excerpt and explicit product link.');c.cards(348,700,1052,4,2/3,['Book A','Book B','Book C','Book D'],'book',height=280);c.box(40,1160,1360,300,'Author spotlight / stationery by use','Distinct bibliography and paper/size models share product fundamentals.')

def collection(c):
 id=c.id;M=c.mobile
 kinds={'sense':'apparel','bloom':'toy','forge':'spec','refresh':'pantry','craft':'dimensions','summit':'gift','nova':'custom','aura':'care','ride':'equipment','dawn':'book'};kind=kinds[id]
 if M:
  c.box(16,158,358,110,'Collection context','Breadcrumb / name / result count / query');c.box(16,284,358,90,'Filters + sort','Applied state persists; clear one / all.')
  if id in ['forge','refresh','dawn','ride']:
   for j in range(6):c.row(16,400+j*200,358,'Product '+str(j+1),{'spec':'Model / connector / power / ₹','pantry':'Net qty / pack / ₹ per unit','book':'Author / format / language / ₹','equipment':'Activity / model / weight / ₹'}[kind],80,178)
  elif id in ['bloom','aura']:
   for j in range(3):
    c.box(16,400+j*450,358,90,(['Age band / interest group','Next age band','More interests'][j] if id=='bloom' else ['Cleanse stage','Prepare stage','Moisturize stage'][j]),'Independent products; sourced factual labels')
    for k in range(2):c.row(16,510+j*450+k*135,358,'Product '+str(j*2+k+1),'Age / contents / dimensions / ₹' if id=='bloom' else 'Use / net quantity / named shade / ₹',80,120)
  elif id=='summit':
   c.cards(16,410,358,1,4/3,['Curated gift / full contents'],kind,height=270)
   c.box(16,780,358,130,'Why this gift','Merchant suitability note; actual packaging')
   c.cards(16,960,358,2,1,['Alternative A','Alternative B'],kind,height=230)
   c.box(16,1300,358,250,'More occasion choices','Keep recipient/budget editable, with explicit query recovery')
  elif id=='craft':
   for j in range(3):c.cards(16,410+j*480,358,1,4/3,['Room object '+str(j+1)],kind,height=300)
  else:
   for j in range(3):c.cards(16,410+j*440,358,2,.75 if id=='sense' else 1,['Product A','Product B'],kind,height=270)
  c.box(16,1810,358,160,'Pagination and recovery','Actual next page; retain query on back.');return
 c.box(40,160,1360,120,'Collection / category context',c.p['filters'])
 if id in ['forge','ride','dawn']:
  c.box(40,312,270,1080,'Facet / subject rail','Only data-backed attributes; unknown remains explicit.');x=338;w=1062
 else:x=40;w=1360;c.box(40,312,1360,90,{'sense':'Size / color / silhouette','bloom':'Age / interest / type','refresh':'Shelf / dietary fact / price','craft':'Room / material / dimensions','summit':'Occasion / recipient / budget','nova':'Base / method / price','aura':'Use / format / shade'}[id],'Result count, sort and removable applied filters')
 y=440 if x==40 else 312
 if id in ['refresh','dawn']:
  for j in range(6):c.row(x,y+j*176,w,'Item '+str(j+1),('Author / title / format / language / INR price' if id=='dawn' else 'Ingredients summary / net quantity / pack size / INR price / supported quantity'),110 if id=='dawn' else 150,150)
 elif id=='bloom':
  for j in range(2):
   c.box(40,440+j*510,1360,80,['Age band: build and create','Another age band / interest'][j],'Grouping supports adult comparison of contents and suitability')
   c.cards(40,550+j*510,1360,3,1,['Creative kit','Puzzle','Construction set'],kind,height=270)
 elif id=='summit':
  c.box(40,440,300,960,'Occasion finder','Recipient / budget / packaging; independent removable choices')
  c.cards(370,440,1030,2,4/3,['Curated gift A','Curated gift B'],kind,height=310)
  c.box(370,860,1030,140,'Suitability notes','What arrives, who it is for, and actual packaging')
  c.cards(370,1060,1030,2,4/3,['Gift C','Gift D'],kind,height=270)
 elif id=='aura':
  for j,stage in enumerate(['Cleanse','Prepare','Moisturize']):
   xx=40+j*460;c.box(xx,440,440,110,stage,'Each listed product independently purchasable')
   for k in range(3):c.row(xx,590+k*260,440,'Care product '+str(k+1),'Use / format / ingredients supplied / named shade / ₹',110,230)
 elif id=='craft':
  c.cards(x,y,w,2,4/3,['Furniture A','Furniture B'],kind,height=400);c.cards(x,y+560,w,2,4/3,['Furniture C','Furniture D'],kind,height=400)
 else:
  n=4 if id=='forge' else 3
  c.cards(x,y,w,n,.75 if id=='sense' else 1,['Item '+str(j+1) for j in range(n)],kind,height=310);c.cards(x,y+490,w,n,.75 if id=='sense' else 1,['Item '+str(j+5) for j in range(n)],kind,height=310)
 c.box(40,1510,1360,140,'Query / pagination / empty recovery','No infinite hidden dependency; return from product retains selection. Compare is shown only after a working contract.')

def product(c):
 id=c.id;M=c.mobile
 if M:
  seq={
  'sense':[('Outfit / detail gallery',360,'media'),('Name / price / color',110,'content'),('Size + fit measurements',220,'content'),('Valid selection → Add',100,'content'),('Fabric / care / outfit links',350,'content')],
  'bloom':[('Toy and contents images',300,'media'),('Age / dimensions / warnings',220,'content'),('Options / price / add',180,'content'),('Included pieces / care',300,'content')],
  'forge':[('Device model and image',260,'media'),('Compatibility and model choice',240,'content'),('Price / availability / add',150,'content'),('Unit-aware spec table',460,'content')],
  'refresh':[('Pack image + name',260,'media'),('Ingredients / allergen summary',270,'content'),('Pack / net quantity / unit price',220,'content'),('Valid SKU / quantity / add',160,'content'),('Nutrition / storage / use',300,'content')],
  'craft':[('Room + object gallery',380,'media'),('W × D × H / material',230,'content'),('Finish / price / add',180,'content'),('Assembly / shipping policy',340,'content')],
  'summit':[('Open / closed gift box',300,'media'),('Contents + packaging facts',260,'content'),('Supported SKU / price / add',180,'content'),('Gift note only after contract',140,'content'),('Shipping policy / help',180,'content')],
  'nova':[('Base / placement preview',260,'media'),('1 Base variant / 2 Text input',330,'content'),('Inline validation / limits',170,'content'),('3 Review / edit configuration',250,'content'),('Validated total / add',140,'content')],
  'aura':[('Bottle / texture images',300,'media'),('Use / named shade / price',200,'content'),('Ingredients / directions',300,'content'),('Available variant / add',130,'content'),('Factual source / warnings',220,'content')],
  'ride':[('Context + technical image',300,'media'),('Activity / relevant use facts',220,'content'),('Model / size / price / add',220,'content'),('Specs / compatibility / care',350,'content')],
  'dawn':[('Cover + title / author',300,'media'),('Edition / language / format',180,'content'),('Price / availability / add',140,'content'),('Synopsis / permitted excerpt',400,'content'),('Bibliographic facts',220,'content')]}
  y=158
  for t,h,k in seq[id]:c.box(16,y,358,h,t,'Selection and facts follow this sequence. Read blueprint for dependency and recovery.',k);y+=h+18
  return
 if id=='sense':
  c.box(40,162,400,570,'Outfit image','Portrait / full silhouette','media');c.box(464,162,400,570,'Garment detail','Fabric, fit and construction','media');c.box(898,162,502,700,'Fit purchase rail','Name → price → color → size → measurements → valid add');c.box(40,930,1360,450,'Fabric / care / separate outfit products','No automatic outfit bundle. Each item is separately priced.')
 elif id=='bloom':
  c.box(40,162,760,500,'Toy / contents gallery','Whole object, actual included pieces and scale','media');c.box(830,162,570,230,'Age and suitability facts','Merchant age recommendation, source text, warnings');c.box(830,416,570,246,'Options / price / add','No certification inferred from design.');c.box(40,720,1360,200,'What is included','Piece count and labelled contents diagram');c.box(40,980,1360,340,'Dimensions / materials / care','Facts support the adult purchaser before commitment.')
 elif id=='forge':
  c.box(40,162,120,600,'Views','Manual thumbnails');c.box(184,162,610,600,'Product / connector diagram','Contained image does not crop ports','media');c.box(824,162,576,270,'Model + compatibility','Source-supported match; unknown stays unconfirmed');c.box(824,460,576,302,'Price / SKU / add','Server validates chosen model and stock');c.box(40,830,1360,520,'Technical specification table','Unit-aware rows with unknown values; optional compare only after functioning query contract')
 elif id=='refresh':
  c.box(40,162,430,570,'Package and serving photo','Whole pack and labelled preparation context','media');c.box(498,162,430,570,'Ingredients / allergens','Visible summary before purchase; nutrition and storage below');c.box(956,162,444,570,'Pack purchase','Pack count → net quantity → unit price → quantity → add');c.box(40,810,1360,380,'Nutrition / storage / recipe','Merchant-supplied factual content, no made-up freshness promise')
 elif id=='craft':
  c.box(40,162,1360,500,'Panoramic room context','Keep the entire furniture object visible','media');c.box(40,710,850,350,'Dimension diagram with text equivalent','W × D × H; access/assembly guidance; explicit units');c.box(918,710,482,500,'Finish and purchase','Actual variant price, material and shipping policy');c.box(40,1120,850,220,'Assembly and material facts','No automatic delivery-date checker without a contract')
 elif id=='summit':
  c.box(40,162,420,500,'Closed gift box','Actual supplied packaging','media');c.box(484,162,420,500,'Open box','Visible included items','media');c.box(934,162,466,500,'Contents + purchase','Ready-made set / actual variant / price / add');c.box(40,730,850,340,'Packaging and suitability','Explicit contents checklist, actual packaging and recipient guidance');c.box(918,730,482,340,'Supported message','Absent until text limits, cart/order persistence and fulfillment work')
 elif id=='nova':
  c.box(40,162,800,620,'Illustrative placement preview','Authoritative text summary remains available; no upload or proof-approval promise','media');c.box(870,162,530,620,'Configuration steps','1 Base variant → 2 permitted text → validation → 3 review/edit');c.box(40,840,800,330,'Configuration summary','Exact normalized text, placement, method, version and constraints');c.box(870,840,530,330,'Server price and add','Distinct configuration identity; retry-safe write; launch gated on order readback')
 elif id=='aura':
  c.box(40,162,460,620,'Product image','Whole packaging','media');c.box(524,162,300,620,'Texture / shade','Named shade, no automatic efficacy imagery','media');c.box(854,162,546,300,'Use and variant','Format → shade name → price → availability');c.box(854,490,546,292,'Ingredients + add','Factual ingredients/directions visible near purchase');c.box(40,850,1360,350,'Routine and directions','Products independently purchasable; no diagnostic recommendations')
 elif id=='ride':
  c.box(40,162,740,480,'Activity and technical gallery','Purposeful action context plus whole equipment','media');c.box(810,162,590,220,'Relevant use facts','Activity / model / compatibility source');c.box(810,410,590,232,'Model / size / add','Category-specific option scheme');c.box(40,710,940,510,'Specification / condition table','Different facts for equipment and clothing, explicitly measured');c.box(1010,710,390,510,'Selection / care','Guide remains tied to current activity')
 elif id=='dawn':
  c.box(40,162,260,400,'Book cover','2:3; contain image','media');c.box(330,162,650,250,'Title / author / edition','Language, publisher, format and ISBN when supplied');c.box(1010,162,390,400,'Format / price / add','Distinguishable editions and actual stock');c.box(330,450,650,650,'Synopsis / permitted excerpt','Readable measure; licensed excerpt text, no scanned inaccessible reader');c.box(40,1160,1360,230,'Bibliography / stationery facts','Book pages/edition; stationery paper size and weight use a different fact group')

for p in P:
 for page,fn in [('home',home),('collection',collection),('product',product)]:
  for mobile in [False,True]:
   for neutral in [False,True]:
    c=Canvas(p,page,mobile,neutral);fn(c);s=c.footer();(W/f'{p["id"]}-{page}-{"mobile" if mobile else "desktop"}{"-neutral" if neutral else ""}.svg').write_text(s)
# Review gallery: image links originate from these authored artifacts only.
style='body{font:16px/1.5 system-ui;margin:28px;background:#f4f3f0;color:#252525}a{color:#17476e}nav{position:sticky;top:0;background:#fff;padding:12px;z-index:2}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}figure{margin:0;background:white;padding:16px}img{max-width:100%;height:auto}h2{margin-top:60px}.mobile{max-width:390px}.contact{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.contact img{width:100%}summary{padding:12px;cursor:pointer}@media(max-width:800px){.grid{grid-template-columns:1fr}.contact{grid-template-columns:repeat(2,1fr)}}'
parts=['<!doctype html><html lang="en"><meta charset="utf-8"><title>LetBuyy ten niche design review</title><style>'+style+'</style><h1>Ten niche storefront design proposals</h1><p>Original annotated schematics, not implemented stores. Compare structure before colors. Each SVG shows the first viewport boundary and below-fold zones. Facts and controls require the contracts in the blueprints.</p><nav><a href="#neutral">Neutral review</a> · '+ ' · '.join(f'<a href="#{p["id"]}">{p["name"]}</a>' for p in P)+'</nav><h2 id="neutral">Anonymous neutral structural review</h2><p>Same grayscale and type, no logos or campaign photography. Anonymous panels retain task labels so a reviewer can assess the actual content hierarchy; index order follows the portfolio.</p>']
for page in ['home','collection','product']:
 parts.append('<h3>'+page.title()+'</h3><div class="contact">')
 for i,p in enumerate(P,1):parts.append(f'<figure><a href="wireframes/{p["id"]}-{page}-desktop-neutral.svg"><img alt="Anonymous {i:02d} {page} structure" src="wireframes/{p["id"]}-{page}-desktop-neutral.svg"></a><figcaption>Approach {i:02d}</figcaption></figure>')
 parts.append('</div>')
for p in P:
 parts.append(f'<h2 id="{p["id"]}">{p["name"]} · {p["niche"]}</h2><p>{html.escape(p["mission"])}</p>')
 for page in ['home','collection','product']:
  parts.append('<details open><summary>'+page.title()+' · desktop and mobile</summary><div class="grid">')
  for device in ['desktop','mobile']:parts.append(f'<figure><a href="wireframes/{p["id"]}-{page}-{device}.svg"><img alt="{p["name"]} {page} {device} original schematic" class="{device}" src="wireframes/{p["id"]}-{page}-{device}.svg"></a><figcaption>{device} · <a href="wireframes/{p["id"]}-{page}-{device}-neutral.svg">neutral equivalent</a></figcaption></figure>')
  parts.append('</div></details>')
parts.append('</html>');(R/'visuals/design-review.html').write_text(''.join(parts))
