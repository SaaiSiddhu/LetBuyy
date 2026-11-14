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
 b=pw.chromium.launch(headless=True);route=local_handler();ctx=new_guarded_context(b,route,viewport={'width':375,'height':812},reduced_motion='reduce');p=ctx.new_page();p.route('**/*',route);p.goto(BASE+'/in/pricing',wait_until='networkidle');label=p.locator('.select-plan-switch-label');label.click();checked=p.get_by_role('checkbox',name='Only differences',exact=True).is_checked();diff=p.locator('.select-plan-compare-feature-label').count();p.get_by_role('button',name=re.compile('See all features')).click();expanded='is-expanded'in p.locator('.select-plan-compare-shell').get_attribute('class');p.get_by_role('button',name='See fewer features',exact=True).click();label.click();cb=p.get_by_role('checkbox',name='Only differences',exact=True);cb.focus();p.keyboard.press('Space');keyboard=cb.is_checked();p.keyboard.press('Space');restored=p.locator('.select-plan-compare-feature-label').count();result={'mobile_pointer_toggle':checked,'difference_rows':diff,'expanded':expanded,'keyboard_space_toggle':keyboard,'restored_rows':restored,'passed':checked and diff==61 and expanded and keyboard and restored==110};(R/'evidence/mobile-comparison.json').write_text(json.dumps(result,indent=2));print(json.dumps(result));ctx.close();b.close()
