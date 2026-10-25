from pathlib import Path
import html,textwrap
R=Path('/Volumes/Projects/LetBuyy/docs/research/shopify-product-intelligence/free-themes-niche-study-2026-10-22');out=['<svg xmlns="http://www.w3.org/2000/svg" width="1440" height="1500" viewBox="0 0 1440 1500" role="img" aria-labelledby="t"><title id="t">Proposed navigation and cart interaction structures</title><rect width="1440" height="1500" fill="#f7f5f0"/>']
def text(x,y,t,z=20):out.append(f'<text x="{x}" y="{y}" font-family="Arial,sans-serif" font-size="{z}" fill="#242424">{html.escape(t)}</text>')
def panel(x,y,w,h,title,lines):
 out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="8" fill="white" stroke="#666"/>');text(x+20,y+35,title,23)
 yy=y+75
 for para in lines:
  for line in textwrap.wrap(para,int((w-40)/9)):text(x+20,yy,line,17);yy+=25
  yy+=14
text(40,48,'PROPOSED · navigation and cart structures',30);text(40,80,'Annotated interaction specification; unimplemented. All checkout, price and stock authority remains canonical.',17)
panel(40,120,650,430,'Category / guided discovery menu',[
'Fashion: named clothing categories, then collection and fit guide.',
'Toys: age and interest are independent discovery paths; all-products is always reachable.',
'Furniture: room index → product type; gifts: occasion / recipient preference / budget.',
'Beauty: use / routine stage; sports: activity → equipment type.',
'Mobile: open menu → nested category → back. Escape/close returns focus to opener.'])
panel(720,120,680,430,'Search / subject and process navigation',[
'Electronics: persistent search, then device and technical category.',
'Pantry: shelf entry plus basic search; supported filters only.',
'Books: visible title/author search, subject index and explicit stationery branch.',
'Personalization: choose base → specify → review; back/edit retains input.',
'No menu requires hover. Query/selection state survives return from a product.'])
panel(40,600,430,650,'Shared stocked-product cart',[
'Item image / name / actual variant',
'Quantity: decrease | number | increase',
'Server unit price and line total',
'Edit or remove item',
'Pending update → confirmed state OR recoverable error with prior selection',
'Empty: meaningful niche discovery entry',
'Continue shopping / canonical hosted checkout',
'Price or stock change requires explicit truthful acknowledgement.'])
panel(505,600,430,650,'Pantry / ready-made gift cart',[
'Pantry adds visible pack count and net quantity; unit price only with valid data.',
'Ready-made gift adds actual set contents and packaging description.',
'A supported gift note has Edit / length limit / saved readback. No field appears before the contract works.',
'Quantity and stock mechanics are shared. No fast-delivery or configurable-bundle promise.',
'Checkout path and payment methods stay canonical.'])
panel(970,600,430,650,'Personalized configuration cart',[
'GATED: requires CAP-15 before launch.',
'Base product / actual variant',
'Exact normalized text / placement / method / configuration version',
'Illustrative preview + authoritative text summary',
'Edit configuration → validate → server reprice → reviewed line snapshot',
'Two distinct configurations must not merge.',
'Order and merchant fulfillment view read back the same snapshot.'])
text(40,1330,'State sequence for all mutations',24);text(40,1375,'Ready → Pending → Confirmed  |  Validation error → Edit  |  Network failure → Retry without lost choices',19)
text(40,1420,'This visual defines reviewable behavior. It is not evidence that the backend, notes or personalization are implemented.',17)
(R/'visuals/navigation-and-cart.svg').write_text(''.join(out)+'</svg>')
