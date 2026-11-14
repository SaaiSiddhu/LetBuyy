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
  route=local_handler();ctx=new_guarded_context(b,route,viewport={'width':375 if mobile else 1366,'height':812 if mobile else 768},reduced_motion='reduce');p=ctx.new_page();p.route('**/*',route);p.goto(BASE+'/in/pricing',wait_until='networkidle');p.locator('.pricing-plan-grid').screenshot(path=str(R/f'evidence/real-plan-cards-{"mobile"if mobile else"desktop"}.png'));ctx.close()
 b.close()
