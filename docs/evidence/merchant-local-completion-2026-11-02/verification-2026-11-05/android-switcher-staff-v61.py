import json,subprocess,re,time,sys,xml.etree.ElementTree as ET,pathlib,traceback
n=pathlib.Path('/private/tmp/letbuyy-merchant-local-20261106-dzfklhx4');r=json.loads((n/'android-device-receipt-switcher-v61.json').read_text());root=pathlib.Path(r['run_root']);prefix=[r['sdk_root']+'/platform-tools/adb','-P','15038','-s','emulator-5580']
assert r['owner']=='merchant-mobile-local-completion'and r['serial']=='emulator-5580'and r['adb_port']==15038
ready=None;deadline=time.monotonic()+1700

def adb(*args):
 category=('hierarchy'if args[:2]==('exec-out','uiautomator')else'screenshot'if args[:2]==('exec-out','screencap')else'input'if args[:2]==('shell','input')else'owned-control')
 started=time.monotonic();ok=False
 try:
  data=subprocess.check_output(prefix+list(args),stderr=subprocess.PIPE,timeout=25);ok=True;return data
 except subprocess.TimeoutExpired:
  raise RuntimeError('Owned emulator '+category+' call exceeded25seconds; no automatic input retry')from None
 finally:
  with(n/'switcher-v61-adb-timing.jsonl').open('a')as out:out.write(json.dumps({'category':category,'duration_ms':round((time.monotonic()-started)*1000),'ok':ok})+'\n')

def nodes():
 raw=adb('exec-out','uiautomator','dump','/dev/tty').decode(errors='replace');a=raw.find('<?xml');b=raw.find('</hierarchy>')+len('</hierarchy>')
 if a<0 or b<a:return[]
 return list(ET.fromstring(raw[a:b]).iter('node'))
def label(x):return x.get('text')or x.get('content-desc')or''
def bounds(x):return list(map(int,re.findall(r'\d+',x.get('bounds',''))))
def visible(x):
 b=bounds(x);return len(b)==4 and b[2]>b[0]and b[3]>b[1]and 0<(b[0]+b[2])/2<1080 and 0<(b[1]+b[3])/2<2337

def match(text,ns,click=False,prefix=False):
 found=[x for x in ns if x.get('package')=='com.letbuyy.store'and visible(x)and(label(x)==text or prefix and label(x).split('\n')[0]==text)and(not click or x.get('clickable')=='true')]
 return sorted(found,key=lambda x:(bounds(x)[2]-bounds(x)[0])*(bounds(x)[3]-bounds(x)[1]))
def wait(text,timeout=90,click=False,prefix=False):
 end=min(deadline,time.monotonic()+timeout)
 while time.monotonic()<end:
  ns=nodes();f=match(text,ns,click,prefix)
  if f:return f[0]
  time.sleep(.2)
 raise RuntimeError('Visible native control unavailable: '+text)
def tapnode(x):
 b=bounds(x);assert visible(x);adb('shell','input','tap',str((b[0]+b[2])//2),str((b[1]+b[3])//2))
def tap(text,timeout=90,prefix=False):tapnode(wait(text,timeout,True,prefix));time.sleep(.3)
def observed(text,timeout=90):return wait(text,timeout,prefix=True)
def back():adb('shell','input','keyevent','KEYCODE_BACK');time.sleep(.3)
def swipe(up=True):
 ns=nodes();sc=[x for x in ns if x.get('package')=='com.letbuyy.store'and x.get('scrollable')=='true'and visible(x)]
 assert sc,'Observed scrollable native surface required';b=max((bounds(x)for x in sc),key=lambda b:(b[2]-b[0])*(b[3]-b[1]));x=(b[0]+b[2])//2;lo=max(b[1]+50,int(b[1]+(b[3]-b[1])*.3));hi=min(b[3]-50,int(b[1]+(b[3]-b[1])*.8));adb('shell','input','swipe',str(x),str(hi if up else lo),str(x),str(lo if up else hi),'450');time.sleep(.3)
def scrollto(text,click=False):
 for _ in range(7):
  f=match(text,nodes(),click,True)
  if f:return f[0]
  swipe()
 raise RuntimeError('Native scroll target unavailable: '+text)
def screen(name):
 ns=nodes();assert any(x.get('package')=='com.letbuyy.store'for x in ns);assert not any(x.get('password')=='true'for x in ns)
 p=root/name;assert not p.exists();p.write_bytes(adb('exec-out','screencap','-p'));p.chmod(0o600);return str(p)
def write(name,body):
 p=root/name;assert not p.exists();p.write_text(json.dumps({'run_id':ready['run_id'],**body},indent=2)+'\n');p.chmod(0o600)
def filewait(name,timeout=420):
 end=min(deadline,time.monotonic()+timeout)
 while time.monotonic()<end:
  p=root/name
  if p.exists():
   d=json.loads(p.read_text());assert d['run_id']==ready['run_id'];return d
  time.sleep(.3)
 raise RuntimeError('Owned paired surface did not acknowledge: '+name)
def ordered(first,second):
 end=time.monotonic()+45
 while time.monotonic()<end:
  ns=nodes();a=[x for x in ns if x.get('package')=='com.letbuyy.store'and visible(x)and re.sub(r'^\d+\. ','',label(x).split('\n')[0])==first];b=[x for x in ns if x.get('package')=='com.letbuyy.store'and visible(x)and re.sub(r'^\d+\. ','',label(x).split('\n')[0])==second]
  if a and b and bounds(a[0])[1]<bounds(b[0])[1]:return
  time.sleep(.3)
 raise RuntimeError('Visible ordered product readback differs')
def collections():
 tap('Products tab');tap('Show menu');tap('Collections');observed('Collections')
def milestone(s):print(s,flush=True)
def screen(name):
 ns=nodes();assert any(x.get('package')=='com.letbuyy.store'for x in ns);assert not any(x.get('password')=='true'for x in ns)
 p=root/name;assert not p.exists();p.write_bytes(adb('exec-out','screencap','-p'));p.chmod(0o600);return str(p)
def write(name,body):
 p=root/name;assert not p.exists();p.write_text(json.dumps({'run_id':ready['run_id'],**body},indent=2)+'\n');p.chmod(0o600)
def filewait(name,timeout=420):
 end=min(deadline,time.monotonic()+timeout)
 while time.monotonic()<end:
  p=root/name
  if p.exists():
   d=json.loads(p.read_text());assert d['run_id']==ready['run_id'];return d
  time.sleep(.3)
 raise RuntimeError('Owned paired surface did not acknowledge: '+name)
def ordered(first,second):
 end=time.monotonic()+45
 while time.monotonic()<end:
  ns=nodes();a=[x for x in ns if x.get('package')=='com.letbuyy.store'and visible(x)and re.sub(r'^\d+\. ','',label(x).split('\n')[0])==first];b=[x for x in ns if x.get('package')=='com.letbuyy.store'and visible(x)and re.sub(r'^\d+\. ','',label(x).split('\n')[0])==second]
  if a and b and bounds(a[0])[1]<bounds(b[0])[1]:return
  time.sleep(.3)
 raise RuntimeError('Visible ordered product readback differs')
def collections():
 tap('Products tab');tap('Show menu');tap('Collections');observed('Collections')
def milestone(s):print(s,flush=True)
def fill(index,value):
 assert re.fullmatch(r'[A-Za-z0-9@.\- ]+',value)
 fs=[x for x in nodes()if x.get('package')=='com.letbuyy.store'and x.get('class')=='android.widget.EditText'and visible(x)];fs.sort(key=lambda x:(bounds(x)[1],bounds(x)[0]));field=fs[index];tapnode(field)
 def focused():
  fs=[x for x in nodes()if x.get('package')=='com.letbuyy.store'and x.get('class')=='android.widget.EditText'and visible(x)and x.get('focused')=='true']
  assert len(fs)==1,'One observed focused synthetic edit field required'
  return fs[0]
 current=focused()
 if current.get('text'):
  b=bounds(current);x=str((b[0]+b[2])//2);y=str((b[1]+b[3])//2);adb('shell','input','swipe',x,y,x,y,'900');tap('Select all');adb('shell','input','keyevent','KEYCODE_DEL')
 assert not focused().get('text'),'Synthetic field must be observed empty before replacement; no blind retry'
 adb('shell','input','text',value.replace(' ','%s'))
 assert focused().get('text')==value,'Observed focused synthetic field must match its complete intended value';back()
def chrome_control(kind,name=None,timeout=120):
 end=min(deadline,time.monotonic()+timeout)
 while time.monotonic()<end:
  ns=[x for x in nodes()if x.get('package')=='com.android.chrome'and visible(x)]
  current=any(label(x)=='Close tab'for x in ns)and any(label(x)=='localhost:9002'for x in ns)
  if current:
   found=[x for x in ns if (x.get('class')=='android.widget.EditText'and x.get('password')==('true'if name=='password'else'false'))if kind=='field']if kind=='field'else[x for x in ns if label(x)==name and x.get('clickable')=='true'and x.get('enabled')=='true']
   if len(found)==1:return found[0]
   if len(found)>1:raise RuntimeError('Multiple current visible Accounts controls; refusing ambiguous input')
  time.sleep(.3)
 raise RuntimeError('Current visible normal Accounts control unavailable: '+kind)
def chrome_fill(name):
 field=chrome_control('field',name);value=ready[name]
 assert isinstance(value,str)and re.fullmatch(r'[A-Za-z0-9@.\-]+',value)
 tapnode(field);old=field.get('text','');assert len(old)<300
 try:
  if old:adb('shell','input','keyevent','KEYCODE_MOVE_END',*(['KEYCODE_DEL']*len(old)))
  adb('shell','input','text',value)
 except Exception:raise RuntimeError('Normal synthetic Accounts input could not be entered')from None
 field=chrome_control('field',name);assert field.get('text')==value,'Actual visible synthetic Accounts input readback mismatch'
 back()
def chrome_signin():
 chrome_fill('email');tapnode(chrome_control('button','Continue with email'));chrome_fill('password');tapnode(chrome_control('button','Log in'))

def sanitize_error(raw):
 text=raw.decode(errors='replace')if isinstance(raw,bytes)else str(raw)
 if ready:
  for key in ['email','password']:
   value=ready.get(key)
   if isinstance(value,str)and value:text=text.replace(value,'[REDACTED]')
 return re.sub(r'https?://[^\s]+','[REDACTED_URL]',text)[-3000:]
try:
 end=time.monotonic()+600
 while time.monotonic()<end:
  if(root/'browser-network-ready.json').exists()and(root/'journey-ready.json').exists():break
  time.sleep(.3)
 ready=json.loads((root/'journey-ready.json').read_text());assert ready['flow']=='warehouse'and r['compiledWorkers']
 adb('shell','input','keyevent','KEYCODE_WAKEUP');adb('shell','am','start','-n','com.letbuyy.store/.MainActivity');milestone('Normal native sign-in entry reached; inspecting retained sign-in state.')
 entry_end=time.monotonic()+60
 while time.monotonic()<entry_end:
  ns=nodes();fresh=match('Log in',ns,True);cancel=match('Cancel and return',ns,True)
  if fresh:tapnode(fresh[0]);break
  recovered=match('Back to Login',ns,True)
  if recovered and match('Sign-in temporarily unavailable',ns):
   assert not(root/'native-retired-saved-signin-recovery.json').exists(),'Observed recovery must leave the old frame; no automatic repeated input'
   before=screen('native-retired-saved-signin-recovery.png');tapnode(recovered[0]);write('native-retired-saved-signin-recovery.json',{'reason':'The previous synthetic backend was retired; used the current visible normal Back to Login action to sign out that retired test session before fresh authentication. No ADB clear-data or global namespace reset.','evidence':[before]});milestone('Retired saved synthetic sign-in returned through the observed normal Back to Login action.');continue
  if cancel:
   before=screen('native-retired-signin-recovery.png');tapnode(cancel[0]);tap('Log in');write('native-retired-auth-cancel.json',{'reason':'Previous local synthetic fixture was retired; used observed normal Cancel and return before fresh authentication','evidence':[before]});milestone('Retired synthetic sign-in cancelled through its normal visible action.');break
  time.sleep(.3)
 else:raise RuntimeError('Normal native sign-in entry or recovery action unavailable')
 chrome_signin();milestone('Synthetic credentials entered and read back through actual visible Android Accounts controls.')
 end=min(deadline,time.monotonic()+90)
 while time.monotonic()<end:
  ns=nodes()
  if match('Choose a store',ns):
   assert match('Synthetic Alpha',ns,prefix=True),'Initial current owned Alpha choice must be observed'
   for _ in range(24):
    options=match('Synthetic Beta',nodes(),True,True)
    if len(options)==1:
     image=screen('native-initial-beta-tail-choice.png');tapnode(options[0]);break
    assert len(options)<2,'Ambiguous initial Staff membership choice'
    swipe()
   else:raise RuntimeError('Real Staff Beta beyond page50 unavailable after bounded current chooser scrolling')
   write('native-initial-picker-observed.json',{'normal_entry':'Choose a store','observed_options':['Synthetic Alpha','Synthetic Beta'],'chosen':'Synthetic Beta','staff_beyond_server_first_page':True,'evidence':[image]});break
  if match('Products tab',ns):break
  time.sleep(.3)
 else:raise RuntimeError('Normal Accounts return did not reach a supported app entry')
 observed('Products tab');milestone('Fresh ordinary Accounts login and normal multi-store selection returned to native Products.');write('native-auth-observed.json',{'normal_browser_form':True,'adb_input_only':True,'automatic_return':True,'no_session_injection':True})
 def selected(name=None):
  end=min(deadline,time.monotonic()+90)
  while time.monotonic()<end:
   found=[x for x in nodes()if x.get('package')=='com.letbuyy.store'and visible(x)and x.get('clickable')=='true'and 'Selected store switcher' in label(x)and(name is None or name in label(x))]
   if len(found)==1:return found[0]
   if len(found)>1:raise RuntimeError('Ambiguous visible selected-store switcher')
   time.sleep(.3)
  raise RuntimeError('Current selected-store trigger unavailable')
 def choose(name,refresh=False):
  tapnode(selected());observed('Switch store')
  if refresh:
   tap('Refresh stores');wait('Refresh stores',click=True)
  for _ in range(24):
   choices=match(name,nodes(),True,True)
   if len(choices)==1:tapnode(choices[0]);break
   assert len(choices)<2,'Ambiguous observed store choice'
   swipe()
  else:raise RuntimeError('Current store choice unavailable after bounded observed membership scrolling')
  selected(name)
 def details():
  tapnode(scrollto('Store Details, Open Store Details',True));observed('Store Details')
 def form_value(value):
  end=min(deadline,time.monotonic()+90)
  while time.monotonic()<end:
   if any(x.get('package')=='com.letbuyy.store'and x.get('class')=='android.widget.EditText'and visible(x)and x.get('text')==value for x in nodes()):return
   time.sleep(.3)
  raise RuntimeError('Saved store name did not appear in the current native field')
 tap('More tab');choose('Synthetic Alpha');a=screen('native-alpha-selected.png');choose('Synthetic Beta');b=screen('native-beta-selected.png');choose('Synthetic Alpha');details();form_value('Synthetic Alpha');fill(0,'Synthetic Alpha mobile');tap('Save')
 end=min(deadline,time.monotonic()+90)
 while time.monotonic()<end:
  if not match('Save',nodes(),True):break
  time.sleep(.3)
 assert not match('Save',nodes(),True),'Owned Alpha save did not reach acknowledged readback'
 form_value('Synthetic Alpha mobile');c=screen('native-alpha-saved.png');back();tapnode(scrollto('Users & Permissions, Open Users & Permissions',True));observed('Users & Permissions');observed('53 loaded staff records');roster=screen('native-owner-roster53.png');write('native-staff-roster-verified.json',{'loaded_records':53,'ordinary_owner_ui':True,'evidence':[roster]});back();details();form_value('Synthetic Alpha mobile');write('native-two-stores.json',{'steps':['normal-native-browser-accounts-login','normal-two-real-membership-selection','native-owned-alpha-store-name-save'],'evidence':[a,b,c]});milestone('Both current memberships selected; legitimate Staff Settings remains available; owned Alpha saved for web readback.')
 filewait('web-alpha-updated.json');back();choose('Synthetic Alpha web',True);details();form_value('Synthetic Alpha web');a=screen('native-web-alpha-read.png');back();choose('Synthetic Beta')
 adb('shell','am','force-stop','com.letbuyy.store');adb('shell','am','start','-n','com.letbuyy.store/.MainActivity');observed('Products tab');tap('More tab');selected('Synthetic Beta');b=screen('native-beta-restart-selection.png')
 def product_editor(name):
  end=min(deadline,time.monotonic()+90);scrolls=0
  while time.monotonic()<end:
   ns=nodes()
   found=[x for x in ns if x.get('package')=='com.letbuyy.store'and visible(x)and x.get('clickable')=='true'and label(x).startswith('Product '+name+',')]
   if len(found)==1:tapnode(found[0]);break
   if len(found)>1:raise RuntimeError('Ambiguous current native product edit control')
   feeds=[x for x in ns if x.get('package')=='com.letbuyy.store'and x.get('scrollable')=='true'and visible(x)]
   if feeds:
    if scrolls>=7:raise RuntimeError('Expected current product absent after bounded observed feed scrolling')
    swipe();scrolls+=1
   else:time.sleep(.3)
  else:raise RuntimeError('Current native product editor entry unavailable')
  observed('Edit Product');form_value(name)
 tap('Products tab');product_editor('Synthetic Beta product');fill(0,'Synthetic Beta mobile product');tap('Update')
 end=min(deadline,time.monotonic()+90)
 while time.monotonic()<end:
  ns=nodes()
  if any(x.get('package')=='com.letbuyy.store'and visible(x)and label(x).startswith('Product Synthetic Beta mobile product,')for x in ns):break
  time.sleep(.3)
 else:raise RuntimeError('Supported native Staff product save did not return to its current catalog')
 c=screen('native-staff-product-saved.png');product_editor('Synthetic Beta mobile product');write('native-beta-web-restart.json',{'steps':['normal-native-web-owner-settings-read','normal-app-restart-restores-beta-selection','supported-native-manager-product-edit'],'evidence':[a,b,c]});milestone('Web Alpha name read; Beta selection restored after restart; supported Staff product save observed before live downgrade.')
 filewait('web-staff-downgraded.json');fill(0,'Synthetic blocked product');tap('Update');observed('Store access changed');a=screen('native-downgrade-denial.png');write('native-downgrade-denied.json',{'steps':['normal-native-stale-role-product-command-denied-and-view-retired'],'evidence':[a]});milestone('Native stale-role product write denied after live Staff downgrade; old editor retired.')
 filewait('web-staff-removed.json');tap('Close');tap('More tab');observed('Settings');tapnode(selected());observed('Switch store');tap('Refresh stores')
 end=min(deadline,time.monotonic()+90)
 while time.monotonic()<end:
  ns=nodes()
  if match('Store access changed. Close this selector and open it again.',ns):
   tap('Close');tapnode(selected('Synthetic Alpha web'));observed('Switch store');break
  if match('Synthetic Alpha web',ns,prefix=True) and not match('Synthetic Beta',ns,prefix=True):break
  time.sleep(.3)
 else:raise RuntimeError('Refreshed global picker did not retire revoked Beta')
 assert not match('Synthetic Beta',nodes(),prefix=True),'Removed staff membership remains selectable'
 observed('Synthetic Alpha web');a=screen('native-revoked-beta-absent.png');tap('Close');selected('Synthetic Alpha web');write('native-revoked-store-retired.json',{'steps':['normal-native-refresh-removes-revoked-beta','remaining-owned-alpha-positive-selection'],'evidence':[a]});milestone('Revoked Beta absent after global discovery refresh; owned Alpha still selectable.')
except Exception as error:
 try:
  current=nodes()
  if root.exists():
   safe=[{'label':sanitize_error(label(x)),'class':x.get('class'),'clickable':x.get('clickable'),'bounds':x.get('bounds')}for x in current if x.get('package')=='com.letbuyy.store'and visible(x)and label(x)and x.get('password')!='true']
   path=root/'native-failure-visible-controls.json';path.write_text(json.dumps({'run_id':None if ready is None else ready['run_id'],'classification':'DIAGNOSTIC_ONLY','controls':safe},indent=2)+'\n');path.chmod(0o600)
   if any(x.get('package')=='com.letbuyy.store'for x in current)and not any(x.get('password')=='true'for x in current):screen('native-failure-state.png')
 except Exception:pass
 diagnostic={'at':time.time(),'status':'NORMAL_UI_COMPANION_FAILED','error':sanitize_error(error),'trace':sanitize_error(traceback.format_exc())}
 if ready:diagnostic['run_id']=ready['run_id']
 if root.exists():
  p=root/'ui-attention.json';p.write_text(json.dumps(diagnostic,indent=2)+'\n');p.chmod(0o600)
 print(json.dumps(diagnostic),flush=True);raise SystemExit(1)
