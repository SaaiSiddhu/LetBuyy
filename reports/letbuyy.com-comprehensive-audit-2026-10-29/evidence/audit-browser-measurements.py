import os,sys,json,pathlib,datetime
os.environ['PLAYWRIGHT_BROWSERS_PATH']=str(pathlib.Path.home()/'Library/Application Support/codex-seo/ms-playwright')
sys.path.insert(0,'/Users/saai_mithra/.codex/skills/seo/scripts')
from url_safety import make_safe_playwright_route_handler,new_guarded_context,validate_url_strict
from playwright.sync_api import sync_playwright
R=pathlib.Path('/Users/saai_mithra/Projects/Start_Up/LetBuyy/reports/letbuyy.com-comprehensive-audit-2026-10-29');rows=[]
INIT='''window.__seoPerf={lcp:[],shifts:[],longtasks:[]}; new PerformanceObserver(l=>{for(const e of l.getEntries())window.__seoPerf.lcp.push({startTime:e.startTime,size:e.size,url:e.url,element:e.element?.tagName,text:e.element?.innerText?.slice(0,100)})}).observe({type:'largest-contentful-paint',buffered:true}); new PerformanceObserver(l=>{for(const e of l.getEntries())if(!e.hadRecentInput)window.__seoPerf.shifts.push({value:e.value,time:e.startTime})}).observe({type:'layout-shift',buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())window.__seoPerf.longtasks.push({startTime:e.startTime,duration:e.duration})}).observe({type:'longtask',buffered:true});'''
with sync_playwright() as p:
 b=p.chromium.launch(headless=True);safe=make_safe_playwright_route_handler()
 def guard(route,req):
  if req.method not in ['GET','HEAD','OPTIONS']:route.abort();return
  safe(route,req)
 for path in ['/in','/in/pricing','/in/resources/payments/gst-for-ecommerce-india']:
  for device in ['mobile','desktop']:
   url='https://www.letbuyy.com'+path;validate_url_strict(url);ctx=new_guarded_context(b,guard,viewport={'width':375,'height':812} if device=='mobile' else {'width':1440,'height':900},device_scale_factor=1);ctx.add_init_script(INIT);pg=ctx.new_page();row={'url':url,'device':device,'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'headless Chromium, unthrottled network/CPU, cold context, six-second observation; diagnostic lab sample, not Lighthouse/CrUX/field CWV'}
   try:
    response=pg.goto(url,wait_until='load',timeout=30000);pg.wait_for_timeout(6000);row['status']=response.status
    row['observations']=pg.evaluate('''() => ({...window.__seoPerf,navigation:performance.getEntriesByType('navigation').map(x=>({responseStart:x.responseStart,domContentLoadedEventEnd:x.domContentLoadedEventEnd,loadEventEnd:x.loadEventEnd,transferSize:x.transferSize,encodedBodySize:x.encodedBodySize,decodedBodySize:x.decodedBodySize})),paints:performance.getEntriesByType('paint').map(x=>({name:x.name,startTime:x.startTime}))})''')
    if path=='/in' and device=='mobile':
     pg.get_by_role('button',name='Open menu',exact=True).click();row['menu_opened']=pg.get_by_role('button',name='Close menu',exact=True).count()>0;row['menu_a11y']=pg.locator('body').aria_snapshot();pg.screenshot(path=str(R/'screenshots/home-mobile-menu.png'));pg.keyboard.press('Escape');row['escape_closes_menu']=pg.get_by_role('button',name='Open menu',exact=True).count()>0
    if path=='/in/pricing':row['prices']=pg.locator('.pricing-plan-price').all_text_contents()
   except Exception as e:row['error']=str(e)[:600]
   rows.append(row);ctx.close();(R/'evidence/browser-performance.json').write_text(json.dumps(rows,indent=2));print(path,device,row.get('error','ok'),flush=True)
 # Inspect contact labels without entering values or submitting.
 ctx=new_guarded_context(b,guard,viewport={'width':375,'height':812});pg=ctx.new_page();pg.goto('https://www.letbuyy.com/in/contact',wait_until='domcontentloaded');pg.locator('#contact-form').scroll_into_view_if_needed();pg.wait_for_timeout(500);contact=pg.evaluate('''() => ({inputs:Array.from(document.querySelectorAll('input,textarea,select')).map(x=>({tag:x.tagName,type:x.type,name:x.name,id:x.id,labels:Array.from(x.labels||[]).map(y=>y.innerText),aria:x.getAttribute('aria-label'),required:x.required})),buttons:Array.from(document.querySelectorAll('#contact-form button')).map(x=>({text:x.innerText,disabled:x.disabled}))})''');(R/'evidence/contact-controls.json').write_text(json.dumps(contact,indent=2));pg.screenshot(path=str(R/'screenshots/contact-mobile-controls.png'));ctx.close();b.close()
