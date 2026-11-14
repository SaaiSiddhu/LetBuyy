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
import time,urllib.request,urllib.error
with sync_playwright()as pw:
 b=pw.chromium.launch(headless=True);route=local_handler();ctx=new_guarded_context(b,route,viewport={'width':375,'height':812},reduced_motion='reduce');p=ctx.new_page();p.route('**/*',route)
 res=p.goto(BASE+'/in/pricing',wait_until='networkidle',timeout=30000)
 p.get_by_text('Pricing is temporarily unavailable.',exact=True).wait_for()
 unavailable={'status':res.status,'error_visible':True,'plan_cards':p.locator('article.pricing-plan-card').count(),'retry_visible':p.get_by_role('button',name='Try again',exact=True).is_visible()}
 try:
  urllib.request.urlopen(BASE+'/api/founding-pricing',timeout=10);api_status=200
 except urllib.error.HTTPError as e:api_status=e.code
 unavailable['api_status']=api_status
 p.screenshot(path=str(R/'evidence/gateway-outage-mobile.png'))
 pathlib.Path('/tmp/letbuyy-pricing-real-20261030/outage-ready.json').write_text(json.dumps(unavailable))
 ready=False
 for i in range(55):
  try:
   with urllib.request.urlopen('http://127.0.0.1:9010/v1/pricing',timeout=1)as resp: ready=resp.status==200
  except (urllib.error.URLError,TimeoutError):pass
  if ready:break
  time.sleep(1)
 assert ready,'Gateway did not restart within the bounded recovery window'
 p.get_by_role('button',name='Try again',exact=True).click();p.locator('article.pricing-plan-card').first.wait_for(timeout=15000)
 compact=re.sub(r'\s|,','',p.locator('#pricing').inner_text());recovered={'cards':p.locator('article.pricing-plan-card').count(),'launch199':'₹199'in compact,'growth699':'₹699'in compact,'unavailable_message':p.get_by_text('Pricing is temporarily unavailable.',exact=True).count()}
 result={'captured_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'fault':'Only the task-owned gateway9010 process stopped; preserved database and other services stayed running','unavailable':unavailable,'recovered':recovered,'passed':api_status==502 and unavailable['plan_cards']==0 and unavailable['retry_visible']and recovered['cards']==4 and recovered['launch199']and recovered['growth699']and recovered['unavailable_message']==0}
 (R/'evidence/gateway-outage-recovery.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False));ctx.close();b.close()
