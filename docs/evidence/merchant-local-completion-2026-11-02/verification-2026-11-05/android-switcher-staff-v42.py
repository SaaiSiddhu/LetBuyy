import json,subprocess,re,time,sys,xml.etree.ElementTree as ET,pathlib,traceback
n=pathlib.Path('/private/tmp/letbuyy-merchant-local-20261106-25feac2c');r=json.loads((n/'android-device-receipt-switcher-v42.json').read_text());root=pathlib.Path(r['run_root']);prefix=[r['sdk_root']+'/platform-tools/adb','-P','15038','-s','emulator-5580']
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
  with(n/'switcher-v42-adb-timing.jsonl').open('a')as out:out.write(json.dumps({'category':category,'duration_ms':round((time.monotonic()-started)*1000),'ok':ok})+'\n')

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
def fill(index,value):
 assert re.fullmatch(r'[A-Za-z0-9@.\- ]+',value)
 fs=[x for x in nodes()if x.get('package')=='com.letbuyy.store'and x.get('class')=='android.widget.EditText'and visible(x)]
 fs.sort(key=lambda x:(bounds(x)[1],bounds(x)[0]));x=fs[index];tapnode(x);adb('shell','input','keycombination','113','29');adb('shell','input','text',value.replace(' ','%s'))
 fs=[x for x in nodes()if x.get('package')=='com.letbuyy.store'and x.get('class')=='android.widget.EditText'and visible(x)];assert any(x.get('text')==value for x in fs),'Native form readback mismatch';back()
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
 fs=[x for x in nodes()if x.get('package')=='com.letbuyy.store'and x.get('class')=='android.widget.EditText'and visible(x)]
 fs.sort(key=lambda x:(bounds(x)[1],bounds(x)[0]));field=fs[index];tapnode(field)
 if field.get('text'):
  b=bounds(field);x=str((b[0]+b[2])//2);y=str((b[1]+b[3])//2);adb('shell','input','swipe',x,y,x,y,'900');tap('Select all')
 adb('shell','input','text',value.replace(' ','%s'))
 fs=[x for x in nodes()if x.get('package')=='com.letbuyy.store'and x.get('class')=='android.widget.EditText'and visible(x)]
 assert any(x.get('text')==value for x in fs),'Native multiline form readback mismatch';back()
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
 old=field.get('text','');assert len(old)<200
 if old:adb('shell','input','keyevent','KEYCODE_MOVE_END',*(['KEYCODE_DEL']*len(old)))
 adb('shell','input','text',value.replace(' ','%s'));fs=[x for x in nodes()if x.get('package')=='com.letbuyy.store'and x.get('class')=='android.widget.EditText'and visible(x)]
 assert any(x.get('text')==value for x in fs),'Observed synthetic field must match its complete intended value';back()
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
  if cancel:
   before=screen('native-retired-signin-recovery.png');tapnode(cancel[0]);tap('Log in');write('native-retired-auth-cancel.json',{'reason':'Previous local synthetic fixture was retired; used observed normal Cancel and return before fresh authentication','evidence':[before]});milestone('Retired synthetic sign-in cancelled through its normal visible action.');break
  time.sleep(.3)
 else:raise RuntimeError('Normal native sign-in entry or recovery action unavailable')
 chrome_signin();milestone('Synthetic credentials entered and read back through actual visible Android Accounts controls.')
 observed('Products tab');milestone('Fresh ordinary Accounts login returned automatically to native Products.');write('native-auth-observed.json',{'normal_browser_form':True,'adb_input_only':True,'automatic_return':True,'no_session_injection':True})
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
  if refresh:tap('Refresh stores')
  tap(name,prefix=True);selected(name)
 def details():
  tapnode(scrollto('Store Details, Open Store Details',True));observed('Store Details')
 def form_value(value):
  end=min(deadline,time.monotonic()+90)
  while time.monotonic()<end:
   if any(x.get('package')=='com.letbuyy.store'and x.get('class')=='android.widget.EditText'and visible(x)and x.get('text')==value for x in nodes()):return
   time.sleep(.3)
  raise RuntimeError('Saved store name did not appear in the current native field')
 tap('More tab');choose('Synthetic Alpha');a=screen('native-alpha-selected.png');choose('Synthetic Beta');b=screen('native-beta-selected.png');details();form_value('Synthetic Beta');fill(0,'Synthetic Beta mobile');tap('Save')
 end=min(deadline,time.monotonic()+90)
 while time.monotonic()<end:
  if not match('Save',nodes(),True):break
  time.sleep(.3)
 assert not match('Save',nodes(),True),'Native store save did not reach acknowledged readback'
 form_value('Synthetic Beta mobile');c=screen('native-beta-saved.png');write('native-two-stores.json',{'steps':['normal-native-browser-accounts-login','normal-two-real-membership-selection','native-beta-store-name-save'],'evidence':[a,b,c]});milestone('Current normal app selected both actual memberships and saved Beta name; web readback pending.')
 filewait('web-beta-updated.json');back();choose('Synthetic Beta web',True);details();form_value('Synthetic Beta web');a=screen('native-web-beta-read.png');back();selected('Synthetic Beta web')
 adb('shell','am','force-stop','com.letbuyy.store');adb('shell','am','start','-n','com.letbuyy.store/.MainActivity');observed('Products tab');tap('More tab');selected('Synthetic Beta web');b=screen('native-beta-restart-selection.png');details();form_value('Synthetic Beta web');write('native-beta-web-restart.json',{'steps':['normal-native-current-web-update-read','normal-app-restart-restores-beta-selection'],'evidence':[a,b]});milestone('Native current read of the web save and normal app restart selection observed.')
 filewait('web-staff-downgraded.json');fill(0,'Synthetic blocked name');tap('Save');observed('Store access changed');a=screen('native-downgrade-denial.png');write('native-downgrade-denied.json',{'steps':['normal-native-stale-role-command-denied-and-view-retired'],'evidence':[a]});milestone('Actual native settings write after live Staff downgrade was denied; private old view retired.')
 filewait('web-staff-removed.json');tap('Close');observed('Settings');tapnode(selected());observed('Switch store');tap('Refresh stores');observed('Store access changed');tap('Close');tapnode(selected('Synthetic Alpha'));observed('Switch store')
 assert not match('Synthetic Beta web',nodes(),prefix=True),'Removed staff membership remains selectable'
 observed('Synthetic Alpha');a=screen('native-revoked-beta-absent.png');tap('Close');selected('Synthetic Alpha');write('native-revoked-store-retired.json',{'steps':['normal-native-refresh-removes-revoked-membership','remaining-owned-alpha-positive-selection'],'evidence':[a]});milestone('Revoked Beta membership no longer selectable; remaining owned Alpha selection read back.')
except Exception as error:
 diagnostic={'at':time.time(),'status':'NORMAL_UI_COMPANION_FAILED','error':sanitize_error(error),'trace':sanitize_error(traceback.format_exc())}
 if ready:diagnostic['run_id']=ready['run_id']
 if root.exists():
  p=root/'ui-attention.json';p.write_text(json.dumps(diagnostic,indent=2)+'\n');p.chmod(0o600)
 print(json.dumps(diagnostic),flush=True);raise SystemExit(1)
