import json,subprocess,re,time,sys,xml.etree.ElementTree as ET,pathlib,traceback
n=pathlib.Path('/private/tmp/letbuyy-merchant-local-20261102-br1jhgh8');r=json.loads((n/'android-device-receipt-v15.json').read_text());root=pathlib.Path(r['run_root']);prefix=[r['sdk_root']+'/platform-tools/adb','-P','15038','-s','emulator-5580']
assert r['owner']=='merchant-mobile-local-completion'and r['serial']=='emulator-5580'and r['adb_port']==15038
ready=None;deadline=time.monotonic()+1700

def adb(*args):return subprocess.check_output(prefix+list(args),stderr=subprocess.PIPE)
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
try:
 end=time.monotonic()+600
 while time.monotonic()<end:
  if(root/'browser-network-ready.json').exists()and(root/'journey-ready.json').exists():break
  time.sleep(.3)
 ready=json.loads((root/'journey-ready.json').read_text());assert not ready.get('credentials_retired')
 adb('shell','input','keyevent','KEYCODE_WAKEUP');adb('shell','am','start','-n','com.letbuyy.store/.MainActivity');tap('Log in')
 helper=str(n/'android-accounts-ui-v15.mjs')
 for args in [('email',),('click','Continue with email'),('password',),('click','Log in')]:subprocess.run(['node',helper,*args],cwd='/Users/saai_mithra/.codex/worktrees/merchant-mobile-parity/LetBuyy',check=True,stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
 observed('Products tab',90);write('native-auth-observed.json',{'normal_browser_form':True,'adb_input_only':True,'automatic_return':True,'no_code_or_session_injection':True});milestone('Normal native Accounts return observed for retired-selection journey.')
 collections();tap('Show menu');tap('Manage products and order');observed('Collection products');tap('Move Synthetic blue shirt up');ordered('Synthetic blue shirt','Synthetic cotton tote');tap('Save membership');observed('Retry saved membership save');a=screen('native-membership-reply-loss.png');b=screen('native-membership-pending-order.png');write('journey-done.json',{'steps':['normal-native-browser-accounts-login','normal-collections-navigation','ordered-native-selection','committed-reply-loss-visible'],'evidence':[a,b]});milestone('Native membership committed reply loss retained; waiting for normal web deletion.')
 filewait('web-updated.json');back();adb('shell','am','force-stop','com.letbuyy.store');adb('shell','am','start','-n','com.letbuyy.store/.MainActivity');observed('Products tab');collections();observed('Retry saved product selection');a=screen('native-retired-membership-restart-discovered.png');tap('Retry saved product selection');observed('Saved product selection confirmed.');assert not match('Retry saved product selection',nodes(),True);b=screen('native-retired-membership-confirmed.png');tap('New collection');fill(0,'Synthetic recovered selection');fill(1,'synthetic-recovered-selection');tapnode(scrollto('Save collection',True));observed('Collection saved.');c=screen('native-after-retired-membership-new-collection.png');write('sync-done.json',{'step':'native-recovered-retired-membership','evidence':b,'additional_evidence':[a,c]});milestone('Original committed selection discovered after deletion/restart and confirmed; subsequent normal native collection created.')
 filewait('retired-member-web-read.json');tap('Show menu');tap('Manage products and order');observed('Collection products');tap('Add product');tap('Synthetic cotton tote',prefix=True);observed('1 assigned products · revision 1',60);a=screen('native-never-committed-selection-draft.png');write('missing-selection-ready.json',{'evidence':a});filewait('missing-selection-web-deleted.json');tap('Save membership');observed('Collection access changed. Reopen it with the store owner account.',60);back();observed('Discard rejected product selection');adb('shell','am','force-stop','com.letbuyy.store');adb('shell','am','start','-n','com.letbuyy.store/.MainActivity');observed('Products tab');collections();observed('Discard rejected product selection');a=screen('native-missing-selection-restart-retained.png');tap('Discard rejected product selection');tap('Keep saved request');observed('Discard rejected product selection');b=screen('native-missing-selection-cancel-retained.png');tap('Discard rejected product selection');tap('Discard selection request');observed('Rejected product selection request discarded.');assert not match('Retry saved product selection',nodes(),True);wait('New collection',click=True);c=screen('native-missing-selection-explicitly-discarded.png');write('missing-selection-done.json',{'evidence':[a,b,c],'steps':['normal-native-unsaved-selection','normal-web-deletion','canonical-rejection','restart-and-cancel-retain-intent','exact-original-recheck','explicit-no-effect-dismissal']});milestone('Never-committed removed selection survived restart/cancel and was explicitly resolved; independent database assertions remain required.')

except Exception as error:
 safe=[]
 try:
  for x in nodes():
   s=label(x)
   if x.get('class')!='android.widget.EditText'and s and not any(v in s for v in ['@','http:','https:','Synthetic-native-catalog-']):safe.append({'package':x.get('package'),'class':x.get('class'),'label':s,'bounds':x.get('bounds'),'clickable':x.get('clickable')})
 except Exception:pass
 root.mkdir(exist_ok=True);(root/'ui-attention.json').write_text(json.dumps({'error':str(error),'observedControls':safe},indent=2)+'\n');milestone('Native UI companion needs inspection; private ui-attention.json retained.');sys.exit(1)

