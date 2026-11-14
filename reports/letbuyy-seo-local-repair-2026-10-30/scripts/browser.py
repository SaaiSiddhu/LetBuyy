import sys,pathlib,json,datetime,hashlib,time,re,urllib.parse as U
sys.path.insert(0,'/Users/saai_mithra/.codex/skills/seo/scripts')
from playwright.sync_api import sync_playwright
from url_safety import validate_url_strict,make_safe_playwright_route_handler,new_guarded_context
R=pathlib.Path('reports/letbuyy-seo-local-repair-2026-10-30');BASE='http://127.0.0.1:9007';rows=[]
def local_route_handler():
 remote = make_safe_playwright_route_handler()
 def handler(route,request):
  u=U.urlsplit(request.url)
  if u.scheme=='http' and u.hostname=='127.0.0.1' and u.port==9007:
   validate_url_strict(request.url)
   route.continue_()
  else:remote(route,request)
 return handler
paths=['/in','/in-hi','/in-ta','/in/pricing','/in-hi/pricing','/in-ta/pricing','/in/resources/payments/gst-for-ecommerce-india','/in-hi/resources/ecommerce/how-product-reviews-increase-conversion','/in-ta/resources/platform/merchant-web-guide','/in/support','/in/create','/in/resources/search?q=GST']
with sync_playwright()as pw:
 browser=pw.chromium.launch(headless=True)
 for mobile in [False,True]:
  route=local_route_handler();context=new_guarded_context(browser,route,viewport={'width':375 if mobile else 1366,'height':812 if mobile else 768},reduced_motion='reduce');page=context.new_page();page.route('**/*',route)
  for path in paths:
   validate_url_strict(BASE+path);errors=[];page.on('pageerror',lambda e:errors.append(str(e)[:400]));page.on('console',lambda m:errors.append(m.text[:800])if m.type=='error'and ('hydrated'in m.text.lower()or'hydration'in m.text.lower())else None);res=page.goto(BASE+path,wait_until='networkidle',timeout=30000);page.wait_for_timeout(300);state=page.evaluate('''() => ({lang:document.documentElement.lang,title:document.title,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,h1:[...document.querySelectorAll('h1')].map(x=>x.textContent),pricing:document.querySelector('#pricing')?.innerText,canonical:document.querySelector('link[rel=canonical]')?.href})''');state.update({'path':path,'mobile':mobile,'status':res.status if res else None,'page_errors':list(errors)});state['passed']=state['status']==200 and state['scrollWidth']<=state['width']+1 and not errors
   if 'pricing'in path:state['passed']=state['passed']and'SEO fixture Launch'in (state.get('pricing')or'')and bool(re.search(r'₹\s*31\.25',state.get('pricing')or''))
   if path in ['/in','/in/pricing','/in-hi/resources/ecommerce/how-product-reviews-increase-conversion']:
    filename=f'evidence/browser-{"mobile"if mobile else"desktop"}-{path.replace("/","_")}.png';page.screenshot(path=str(R/filename));state['screenshot']=filename
   rows.append(state)
  context.close()
 (R/'evidence/browser-page-samples.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
 # Normal-motion hydration must also remain stable.
 for path in ['/in', '/in-hi']:
  route=local_route_handler();context=new_guarded_context(browser,route,viewport={'width':1366,'height':768},reduced_motion='no-preference');page=context.new_page();page.route('**/*',route);errors=[];page.on('pageerror',lambda e:errors.append(str(e)[:400]));page.on('console',lambda m:errors.append(m.text[:800])if m.type=='error'and ('hydrated'in m.text.lower()or'hydration'in m.text.lower())else None);res=page.goto(BASE+path,wait_until='networkidle');page.wait_for_timeout(300);row={'path':path,'mobile':False,'motion':'no-preference','status':res.status,'page_errors':list(errors),'passed':res.status==200 and not errors};rows.append(row);context.close()
 # No-JavaScript pricing must contain the same authoritative test plan values.
 route=local_route_handler();context=new_guarded_context(browser,route,java_script_enabled=False,viewport={'width':375,'height':812});page=context.new_page();page.route('**/*',route);page.goto(BASE+'/in/pricing',wait_until='networkidle');text=page.locator('#pricing').inner_text();nojs={'fixture_plan_present':'SEO fixture Launch'in text,'price_present':bool(re.search(r'₹\s*31\.25',text)),'passed':'SEO fixture Launch'in text and bool(re.search(r'₹\s*31\.25',text))};context.close()
 # Mobile navigation and a client-side locale switch without any form submissions.
 route=local_route_handler();context=new_guarded_context(browser,route,viewport={'width':375,'height':812},reduced_motion='reduce');page=context.new_page();page.route('**/*',route);page.goto(BASE+'/in',wait_until='networkidle');button=page.get_by_role('button',name='Open menu',exact=True);button.click();opened=page.locator('.mobile-menu-btn').get_attribute('aria-expanded')=='true';page.keyboard.press('Escape');closed=page.get_by_role('button',name='Open menu',exact=True).get_attribute('aria-expanded')=='false';page.locator('.footer-region-button').click();page.get_by_role('button',name='Hindi',exact=True).click();page.wait_for_url('**/in-hi');page.wait_for_timeout(300);locale={'final_url':page.url,'root_lang':page.locator('html').get_attribute('lang'),'passed':page.url.endswith('/in-hi')and page.locator('html').get_attribute('lang')=='hi'};context.close()
 # Exercise recovery through the actual same-origin retry API, with no public writes.
 mode=pathlib.Path('/tmp/letbuyy-seo-repair-20261030/gateway-mode.txt');mode.write_text('pricing_error')
 route=local_route_handler();context=new_guarded_context(browser,route,viewport={'width':375,'height':812});page=context.new_page();page.route('**/*',route);page.goto(BASE+'/in/pricing',wait_until='networkidle');before='Pricing is temporarily unavailable.'in page.locator('#pricing').inner_text();mode.write_text('ready');page.get_by_role('button',name='Try again',exact=True).click();page.locator('.pricing-plan-name').filter(has_text='SEO fixture Launch').wait_for(state='visible',timeout=15000);after=page.locator('#pricing').inner_text();recovery={'initial_error':before,'plan_after_retry':'SEO fixture Launch'in after,'passed':before and 'SEO fixture Launch'in after};context.close()
 browser.close()
result={'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Isolated production app + synthetic public pricing gateway; no transaction or form submissions','page_samples':len(rows),'rows':rows,'javascript_disabled_pricing':nojs,'mobile_menu':{'opened':opened,'escape_closed':closed,'passed':opened and closed},'client_locale_switch':locale,'pricing_retry_recovery':recovery,'passed':recovery['passed']and all(x['passed']for x in rows)and nojs['passed']and opened and closed and locale['passed']};(R/'evidence/browser-verification.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({'samples':len(rows),'failed':[x for x in rows if not x['passed']],'nojs':nojs,'menu':result['mobile_menu'],'locale':locale,'passed':result['passed']},ensure_ascii=False,indent=2))
