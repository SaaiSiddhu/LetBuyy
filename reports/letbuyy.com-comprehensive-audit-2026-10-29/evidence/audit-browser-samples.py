import os,sys,json,time,pathlib,datetime
os.environ['PLAYWRIGHT_BROWSERS_PATH']=str(pathlib.Path.home()/'Library/Application Support/codex-seo/ms-playwright')
sys.path.insert(0,'/Users/saai_mithra/.codex/skills/seo/scripts')
from url_safety import validate_url_strict,make_safe_playwright_route_handler,new_guarded_context
from playwright.sync_api import sync_playwright
R=pathlib.Path('/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy.com-comprehensive-audit-2026-10-29')
work=[('home','/in'),('pricing','/in/pricing'),('resources','/in/resources'),('category','/in/resources/payments'),('article','/in/resources/payments/gst-for-ecommerce-india'),('author','/in/resources/authors/neha-payments'),('tag','/in/resources/tag/gst'),('legal','/in/legal/terms'),('contact','/in/contact'),('support','/in/support'),('create','/in/create'),('demo','/in/demo'),('search','/in/resources/search'),('changelog','/in/resources/changelog'),('releases','/in/resources/releases'),('sitemap','/in/sitemap'),('home-ta','/in-ta'),('home-hi','/in-hi')]
JS='''() => {const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {text:e.innerText?.slice(0,180),x:r.x,y:r.y,width:r.width,height:r.height}};return {title:document.title,lang:document.documentElement.lang,viewport:{width:innerWidth,height:innerHeight},scrollWidth:document.documentElement.scrollWidth,canonical:Array.from(document.querySelectorAll('link[rel="canonical"]')).map(x=>x.href),h1:Array.from(document.querySelectorAll('h1')).map(rect),headings:Array.from(document.querySelectorAll('h1,h2,h3')).map(x=>({tag:x.tagName,text:x.innerText})),plans:Array.from(document.querySelectorAll('.pricing-plan-card')).map(x=>({name:x.querySelector('.pricing-plan-name')?.innerText,price:x.querySelector('.pricing-plan-price')?.innerText,notes:x.querySelector('.pricing-plan-note')?.innerText})),mainText:document.querySelector('main')?.innerText,links:Array.from(document.querySelectorAll('a[href]')).map(x=>({text:x.innerText,href:x.href})),forms:Array.from(document.querySelectorAll('form')).map(x=>({action:x.action,method:x.method,inputs:Array.from(x.querySelectorAll('input,textarea,select')).map(i=>({type:i.type,name:i.name,id:i.id,labels:Array.from(i.labels||[]).map(l=>l.innerText),aria:i.getAttribute('aria-label'),required:i.required}))})),buttons:Array.from(document.querySelectorAll('button')).map(x=>({text:x.innerText,aria:x.getAttribute('aria-label'),expanded:x.getAttribute('aria-expanded')})),images:Array.from(document.images).map(x=>({src:x.currentSrc,alt:x.alt,loading:x.loading,width:x.naturalWidth,height:x.naturalHeight,rect:rect(x),complete:x.complete,srcset:x.srcset})),opengraph:Array.from(document.querySelectorAll('meta[property^="og:"]')).map(x=>({name:x.getAttribute('property'),content:x.content}))}}'''
rows=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 safe=make_safe_playwright_route_handler()
 for idx,(name,path) in enumerate(work):
  for device in (['desktop','mobile'] if name in ['home','pricing','article','contact','support'] else ['desktop']):
   url='https://www.letbuyy.com'+path; validate_url_strict(url)
   blocked=[]
   def guard(route,request):
    if request.method not in ['GET','HEAD','OPTIONS']:
     blocked.append({'method':request.method,'url':request.url.split('?')[0]});route.abort();return
    safe(route,request)
   ctx=new_guarded_context(browser,guard,viewport={'width':375,'height':812} if device=='mobile' else {'width':1440,'height':900},device_scale_factor=1)
   page=ctx.new_page(); errs=[];page.on('pageerror',lambda e:errs.append(str(e)[:300]))
   row={'name':name,'device':device,'url':url,'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat()}
   try:
    resp=page.goto(url,wait_until='domcontentloaded',timeout=30000);page.wait_for_timeout(1500)
    if name in ['home','pricing']:
     try:page.locator('.pricing-plan-card .pricing-plan-price').first.wait_for(timeout=8000)
     except Exception:pass
    row.update({'status':resp.status if resp else None,'final_url':page.url,'dom':page.evaluate(JS),'console_errors':errs,'blocked_non_read_requests':blocked})
    (R/f'evidence/{name}-{device}-rendered.html').write_text(page.content())
    (R/f'evidence/{name}-{device}-a11y.txt').write_text(page.locator('body').aria_snapshot())
    if name in ['pricing','article','contact','support'] or (name in ['home-ta','home-hi']):
     page.screenshot(path=str(R/f'screenshots/{name}-{device}.png'),full_page=False)
    if name=='home' and device=='mobile':
     menu=page.get_by_role('button',name='Open navigation menu',exact=True)
     if menu.count()==0: menu=page.get_by_role('button',name='Menu',exact=True)
     if menu.count():
      menu.click();page.wait_for_timeout(200);row['mobile_menu_after_click']=page.locator('body').aria_snapshot();page.screenshot(path=str(R/'screenshots/home-mobile-menu.png'))
     page.keyboard.press('Escape');page.keyboard.press('Tab');row['keyboard_first_focus']=page.evaluate('''() => ({tag:document.activeElement.tagName,text:document.activeElement.textContent?.slice(0,100),aria:document.activeElement.getAttribute('aria-label')})''')
   except Exception as e:row['error']=str(e)[:1000]
   rows.append(row);ctx.close();(R/'evidence/browser-samples.json').write_text(json.dumps({'complete':False,'samples':rows},ensure_ascii=False,indent=2));print(name,device,row.get('status'),row.get('error',''),flush=True)
 browser.close()
(R/'evidence/browser-samples.json').write_text(json.dumps({'complete':True,'samples':rows},ensure_ascii=False,indent=2))
