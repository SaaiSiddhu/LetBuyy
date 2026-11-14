import sys,pathlib,json,re,datetime,urllib.parse as U
sys.path.insert(0,'/Users/saai_mithra/.codex/skills/seo/scripts')
from playwright.sync_api import sync_playwright
from url_safety import validate_url_strict,make_safe_playwright_route_handler,new_guarded_context
R=pathlib.Path('reports/letbuyy-pricing-local-2026-10-30');BASE='http://127.0.0.1:9006';expected=json.loads((R/'evidence/gateway-pricing.json').read_text())['body']['data'];plans=expected['plans'];program=expected['founding_program'];rows=[]
def local_handler():
 remote=make_safe_playwright_route_handler()
 def handler(route,request):
  u=U.urlsplit(request.url)
  if request.method not in ['GET','HEAD']:route.abort();return
  if u.scheme=='http'and u.hostname in ['127.0.0.1','localhost']and u.port in [9006,9002]:validate_url_strict(request.url);route.continue_()
  else:remote(route,request)
 return handler
with sync_playwright()as pw:
 b=pw.chromium.launch(headless=True)
 for mobile in [False,True]:
  for segment in ['in','in-hi','in-ta']:
   route=local_handler();ctx=new_guarded_context(b,route,viewport={'width':375 if mobile else 1366,'height':812 if mobile else 768},reduced_motion='reduce');p=ctx.new_page();p.route('**/*',route);errors=[];p.on('pageerror',lambda e:errors.append(str(e)[:500]));p.on('console',lambda m:errors.append(m.text[:800])if m.type=='error'and('hydration'in m.text.lower()or'hydrated'in m.text.lower())else None)
   res=p.goto(BASE+'/'+segment+'/pricing',wait_until='networkidle',timeout=30000);p.wait_for_timeout(250);cards=p.locator('article.pricing-plan-card');assert cards.count()==len(plans)
   checks=[]
   for i,plan in enumerate(plans):
    card=cards.nth(i);price=card.locator('.pricing-plan-price').inner_text();links=card.locator('a.pricing-plan-cta');disabled=card.locator('[aria-disabled=true]').count();live=plan['purchasable']and plan['status']!='coming_soon';amount=plan['founding_inr']if program['active']and not program['paused']and program['remaining_slots']>0 and plan['has_founding']else plan['regular_inr'];numeric=re.sub(r'\s|,','',price)
    ok=(f'₹{amount}'in numeric and links.count()==1 and U.urlsplit(links.first.get_attribute('href')).port==9002)if live else links.count()==0 and disabled==1
    checks.append({'slug':plan['slug'],'visible_name':card.locator('.pricing-plan-name').inner_text(),'price_text':price,'expected_rupees':amount if live else None,'signup_links':links.count(),'signup_href':links.first.get_attribute('href')if links.count()else None,'disabled_action_count':disabled,'passed':ok})
   width=p.evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth})');row={'segment':segment,'mobile':mobile,'status':res.status,'root_language':p.locator('html').get_attribute('lang'),'h1_count':p.locator('h1').count(),'cards':checks,'page_errors':list(errors),'viewport':width,'passed':res.status==200 and all(x['passed']for x in checks)and not errors and width['scroll']<=width['width']+1 and p.locator('h1').count()==1};rows.append(row)
   if segment=='in':
    f=f'evidence/pricing-{"mobile"if mobile else"desktop"}.png';p.screenshot(path=str(R/f));row['screenshot']=f
   ctx.close()
 # Real plan data must also be in home/pricing HTML with JavaScript disabled.
 nojs=[]
 for path in ['/in','/in/pricing']:
  route=local_handler();ctx=new_guarded_context(b,route,viewport={'width':375,'height':812},java_script_enabled=False);p=ctx.new_page();p.route('**/*',route);res=p.goto(BASE+path,wait_until='networkidle',timeout=30000);text=p.locator('#pricing').inner_text();compact=re.sub(r'\s|,','',text);nojs.append({'path':path,'status':res.status,'launch199':'₹199'in compact,'growth699':'₹699'in compact,'passed':res.status==200 and'₹199'in compact and'₹699'in compact});ctx.close()
 # Compare controls operate on the actual110-row local catalogue.
 route=local_handler();ctx=new_guarded_context(b,route,viewport={'width':1366,'height':768},reduced_motion='reduce');p=ctx.new_page();p.route('**/*',route);p.goto(BASE+'/in/pricing',wait_until='networkidle');labels=p.locator('.select-plan-compare-feature-label');before=labels.count();p.get_by_role('button',name=re.compile('See all features')).click();expanded='is-expanded'in(p.locator('.select-plan-compare-shell').get_attribute('class')or'');p.locator('.select-plan-switch-label').click();assert p.get_by_role('checkbox',name='Only differences',exact=True).is_checked();diff=labels.count();p.locator('.select-plan-switch-label').click();assert not p.get_by_role('checkbox',name='Only differences',exact=True).is_checked();restored=labels.count();p.get_by_role('button',name='See fewer features',exact=True).click();collapsed='is-collapsed'in(p.locator('.select-plan-compare-shell').get_attribute('class')or'');comparison={'rows_all':before,'rows_differences':diff,'rows_restored':restored,'expanded':expanded,'collapsed':collapsed,'passed':before==sum(len(x['items'])for x in plans[0]['compare_features'])and 0<diff<before and restored==before and expanded and collapsed}
 # Follow a real available-plan link, without entering data or submitting signup.
 card=p.locator('article.pricing-plan-card').filter(has=p.get_by_role('heading',name='Launch',exact=True));href=card.locator('a.pricing-plan-cta').get_attribute('href');card.locator('a.pricing-plan-cta').click();p.wait_for_url('http://localhost:9002/signup',timeout=30000);p.locator('input[type=email]').wait_for(state='visible',timeout=30000);handoff={'href':href,'final_url':p.url,'email_form_visible':p.locator('input[type=email]').is_visible(),'title':p.title(),'submitted':False,'passed':U.urlsplit(p.url).port==9002 and U.urlsplit(p.url).path=='/signup'and p.locator('input[type=email]').is_visible()};p.screenshot(path=str(R/'evidence/signup-handoff.png'));ctx.close();b.close()
result={'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'data_source':'Existing local PostgreSQL -> real local gateway9010 -> marketing9006; no fixture responses or request fulfilment stubs','read_only':'All non-GET/HEAD browser requests blocked. No signup, OTP, checkout or payment submitted.','rows':rows,'no_javascript':nojs,'comparison_controls':comparison,'signup_handoff':handoff,'passed':all(x['passed']for x in rows+nojs)and comparison['passed']and handoff['passed']};(R/'evidence/browser-pricing.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({'samples':len(rows),'failed':[x for x in rows if not x['passed']],'nojs':nojs,'comparison':comparison,'handoff':handoff,'passed':result['passed']},ensure_ascii=False,indent=2))
