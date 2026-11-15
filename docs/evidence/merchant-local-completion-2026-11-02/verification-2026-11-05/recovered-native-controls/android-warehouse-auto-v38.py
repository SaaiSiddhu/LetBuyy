import json,subprocess,re,time,sys,xml.etree.ElementTree as ET,pathlib,traceback
n=pathlib.Path('/private/tmp/letbuyy-merchant-local-20261102-br1jhgh8');r=json.loads((n/'android-device-receipt-warehouse-v38.json').read_text());root=pathlib.Path(r['run_root']);prefix=[r['sdk_root']+'/platform-tools/adb','-P','15038','-s','emulator-5580']
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
  with(n/'warehouse-v38-adb-timing.jsonl').open('a')as out:out.write(json.dumps({'category':category,'duration_ms':round((time.monotonic()-started)*1000),'ok':ok})+'\n')

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
def inventory():
 tap('Products tab');tap('Show menu');tap('Inventory');observed('Inventory')
def shortcut(text):
 for towards_start in [True,False]:
  for attempt in range(8):
   found=match(text,nodes(),True,True)
   if found:tapnode(found[0]);time.sleep(.4);return
   sc=[bounds(x)for x in nodes()if x.get('package')=='com.letbuyy.store'and x.get('scrollable')=='true'and visible(x)and bounds(x)[2]-bounds(x)[0]>3*(bounds(x)[3]-bounds(x)[1])]
   assert sc,'An observed horizontal warehouse shortcut surface is required'
   box=min(sc,key=lambda box:box[3]-box[1]);y=str((box[1]+box[3])//2);left=str(int(box[0]+(box[2]-box[0])*.15));right=str(int(box[0]+(box[2]-box[0])*.85))
   adb('shell','input','swipe',left if towards_start else right,y,right if towards_start else left,y,'450');time.sleep(.3)
 raise RuntimeError('Warehouse shortcut not visible: '+text)
def reservation_lifetime(text):
 end=min(deadline,time.monotonic()+90)
 while time.monotonic()<end:
  found=[x for x in nodes()if x.get('package')=='com.letbuyy.store'and visible(x)and text in label(x)]
  if found:return found[0]
  time.sleep(.3)
 raise RuntimeError('Current native reservation lifetime unavailable: '+text)

def fill_metadata(kind):
 values=['Synthetic native recovery location','Synthetic native road','Chennai','Tamil Nadu',None,'600001']if kind=='location'else['Synthetic native recovery supplier','Synthetic native contact','synthetic-native-supplier@example.invalid',None,'Synthetic native road']
 observed('New '+kind)
 for index,value in enumerate(values):
  if value is not None:fill(index,value)
 tap('Create '+kind)
def await_no_pending():
 end=time.monotonic()+60
 while time.monotonic()<end:
  if not match('Warehouse request awaiting confirmation',nodes(),prefix=True):return
  time.sleep(.3)
 raise RuntimeError('Original warehouse acknowledgement remains unconfirmed')
def partial_receipt(quantity):
 tap('Receive');observed('Review stock receipt');fill(0,str(quantity));tap('Confirm receipt')
_observed_control = observed

def visible_copy(ns):
 return '\n'.join(label(x)for x in ns if x.get('package')=='com.letbuyy.store'and visible(x))

def observed(text,timeout=90):
 if text not in ['Ordered','Reserved','Shipped','Partially received','Received']:
  return _observed_control(text,timeout)
 end=min(deadline,time.monotonic()+timeout)
 while time.monotonic()<end:
  ns=nodes();titles=[x for x in ns if x.get('package')=='com.letbuyy.store'and visible(x)and re.fullmatch(r'(?:PO|TR)-[0-9]{8}-[A-F0-9]{8}',label(x).split('\n')[0])]
  statuses=[x for x in ns if x.get('package')=='com.letbuyy.store'and visible(x)and text in label(x).splitlines()]
  if len(titles)==1 and statuses:return titles[0]
  time.sleep(.3)
 raise RuntimeError('One current visible warehouse document and exact status unavailable: '+text)

def _scoped_inputs():
 raw=adb('exec-out','uiautomator','dump','/dev/tty').decode(errors='replace');a=raw.find('<?xml');b=raw.find('</hierarchy>')+len('</hierarchy>');tree=ET.fromstring(raw[a:b]);out=[]
 def walk(node,clip):
  rect=bounds(node)
  if len(rect)==4 and node.get('scrollable')=='true':clip=[max(clip[0],rect[0]),max(clip[1],rect[1]),min(clip[2],rect[2]),min(clip[3],rect[3])]
  if node.get('package')=='com.letbuyy.store'and node.get('class')=='android.widget.EditText':out.append((node,clip))
  for child in node:walk(child,clip)
 walk(tree,[0,0,1080,2337]);return out

def fill_stock_value(old,value):
 assert re.fullmatch(r'[0-9]+(?:\.[0-9]{1,2})?',old)and re.fullmatch(r'[0-9]+(?:\.[0-9]{1,2})?',value)
 field=None
 for attempt in range(8):
  matches=[(x,clip)for x,clip in _scoped_inputs()if x.get('text')==old];assert len(matches)==1,'A unique observed stock quantity/cost field is required'
  x,clip=matches[0];b=bounds(x);cx=(b[0]+b[2])//2;cy=(b[1]+b[3])//2
  if clip[0]+5<cx<clip[2]-5and clip[1]+35<cy<clip[3]-35:
   time.sleep(.5);fresh=[(y,c)for y,c in _scoped_inputs()if y.get('text')==old];assert len(fresh)==1
   if bounds(fresh[0][0])==b:field=fresh[0][0];break
   continue
  assert clip[2]>clip[0]and clip[3]>clip[1],'Observed stock-form viewport required'
  sx=str((clip[0]+clip[2])//2);top=int(clip[1]+(clip[3]-clip[1])*.25);bottom=int(clip[1]+(clip[3]-clip[1])*.8)
  adb('shell','input','swipe',sx,str(bottom if cy>=clip[3]-35else top),sx,str(top if cy>=clip[3]-35else bottom),'450');time.sleep(.4)
 assert field is not None,'Stock input must be inside its actual scroll viewport and stable before tapping'
 def focus_record(stage):
  current=[{'text':x.get('text'),'focused':x.get('focused'),'focusable':x.get('focusable'),'clickable':x.get('clickable'),'enabled':x.get('enabled'),'bounds':bounds(x),'clip':clip}for x,clip in _scoped_inputs()]
  # Only current task-owned stock forms; never authentication controls.
  assert all(x.get('package')=='com.letbuyy.store'and x.get('password')!='true'for x,_ in _scoped_inputs())
  with(root/'stock-input-focus-observations.jsonl').open('a')as out:out.write(json.dumps({'stage':stage,'expected_numeric_old':old,'expected_numeric_new':value,'fields':current})+'\n')
 focus_record('before-tap')
 tapnode(field)
 end=time.monotonic()+8;focused=[]
 while time.monotonic()<end:
  focused=[x for x,_ in _scoped_inputs()if x.get('focused')=='true'and x.get('text')==old]
  if len(focused)==1:break
  time.sleep(.3)
 focus_record('after-tap-before-any-typing')
 if len(focused)!=1:
  screen('native-stock-focus-unconfirmed.png')
 assert len(focused)==1,'Only an actually focused stock input may receive numeric text; no scanner/permission action is allowed'
 adb('shell','input','keyevent','KEYCODE_MOVE_END',*(['KEYCODE_DEL']*len(old)));adb('shell','input','text',value)
 current=[x for x,_ in _scoped_inputs()if x.get('focused')=='true'and x.get('text')==value]
 assert len(current)==1,'Focused stock input readback must match the complete intended value';back()

def partial_receipt(quantity,remaining):
 tap('Receive');observed('Review stock receipt');fill_stock_value(str(remaining),str(quantity));tap('Confirm receipt')

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

def staff_ui_review():
 back();tap('More tab');tapnode(scrollto('Users & Permissions, Open Users & Permissions',True));observed('Users & Permissions')
 end=min(deadline,time.monotonic()+90)
 while time.monotonic()<end:
  ns=nodes()
  if match('No staff users',ns):break
  if match('Could not load staff',ns):
   write('staff-ui-observed.json',{'status':'BLOCKED_OWNER_ROSTER_READ','evidence':[screen('native-staff-read-unavailable.png')],'scope':'Unavailable state only; no Staff acceptance, writes, consent or delivery proof'})
   return
  time.sleep(.3)
 else:raise RuntimeError('Staff roster did not settle within its finite read budget')
 before=screen('native-staff-empty-roster.png');tap('Add staff');observed('Send staff invitation');tap('Send staff invitation');observed('Enter an email address.');required=screen('native-staff-required-email.png')
 fields=[x for x in nodes()if x.get('package')=='com.letbuyy.store'and x.get('class')=='android.widget.EditText'and visible(x)]
 assert len(fields)==1,'One observed invitation email field is required';tapnode(fields[0]);adb('shell','input','text','synthetic-ui-draft@example.invalid');ns=nodes()
 assert any(x.get('class')=='android.widget.EditText'and x.get('text')=='synthetic-ui-draft@example.invalid'for x in ns),'Native short-form draft readback must match exactly'
 assert match('Send staff invitation',ns,True),'Invitation action must remain reachable with the keyboard open'
 keyboard=screen('native-staff-email-keyboard.png');back();tap('Cancel');observed('No staff users');tap('Refresh staff');observed('No staff users');after=screen('native-staff-cancelled-roster.png')
 write('staff-ui-observed.json',{'status':'OBSERVED_OWNER_EMPTY_ROSTER_REQUIRED_INPUT_KEYBOARD_CANCEL_FRESH_READ','evidence':[before,required,keyboard,after],'scope':'Actual normal APK and local owner roster read; no invitation submission, staff consent, role/removal effects, web sync, hosted/provider or release acceptance'})
 milestone('New native Staff short form: required input, exact draft, visible keyboard/action, cancellation and fresh roster observed; no staff command submitted.')

def read_saved_document(transfer):
 tap('View transfer'if transfer else'View purchase order')
 observed('Stock transfer'if transfer else'Purchase order')
 expected=['Synthetic cotton tote','Requested: 2 · Shipped: 2 · Received: 2','Not yet received: 0']if transfer else['Synthetic cotton tote','Ordered: 4 · Received: 4 · Remaining: 0','Unit cost: INR 125.50']
 for attempt in range(7):
  copy=visible_copy(nodes())
  if all(text in copy for text in expected):break
  if attempt<6:swipe()
 else:raise RuntimeError('Current saved document quantities/cost/name were not visible')
 path=screen('native-transfer-full-document-read.png'if transfer else'native-po-full-document-read.png')
 back();observed('Received')
 return path

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
 ready=json.loads((root/'journey-ready.json').read_text());assert ready['flow']=='warehouse'and r['verifyStockLifecycle']
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
 observed('Products tab');milestone('Fresh ordinary Accounts login returned automatically to native Products.');write('native-auth-observed.json',{'normal_browser_form':True,'adb_input_only':True,'automatic_return':True,'no_session_injection':True});inventory();shortcut('Locations');tap('New location');fill_metadata('location');observed('Warehouse request awaiting confirmation');a=screen('native-location-original-pending.png')
 adb('shell','am','force-stop','com.letbuyy.store');adb('shell','am','start','-n','com.letbuyy.store/.MainActivity');observed('Products tab');inventory();shortcut('Locations');observed('Warehouse request awaiting confirmation');b=screen('native-location-restart-retained.png');write('release-native-replies.json',{'observation':'Normal metadata pending request visible after app restart'});tap('Retry original');await_no_pending();observed('Synthetic native recovery location');back();shortcut('Suppliers');tap('New supplier');fill_metadata('supplier');observed('Synthetic native recovery supplier');c=screen('native-supplier-created.png');write('journey-done.json',{'steps':['normal-native-browser-accounts-login','normal-inventory-locations-navigation','native-location-create','committed-reply-loss-visible','app-restart-retains-original-request','original-request-retry-confirmed','native-supplier-create'],'evidence':[a,b,c]});milestone('Native warehouse metadata created; restart/exact-original recovery observed.')
 filewait('web-updated.json');tap('Refresh suppliers');observed('Synthetic web recovery supplier');a=screen('native-web-suppliers-read.png');back();shortcut('Locations');observed('Synthetic web recovery location');b=screen('native-web-locations-read.png');back();back();tap('More tab');tapnode(scrollto('Store Details, Open Store Details',True));observed('Store Details');fill(0,'Synthetic warehouse profile');tap('Save');end=time.monotonic()+60
 while time.monotonic()<end:
  if not match('Save',nodes(),True):break
  time.sleep(.3)
 assert not match('Save',nodes(),True);c=screen('native-profile-positive-save.png');write('sync-done.json',{'step':'native-read-web-warehouse-and-profile-save','evidence':c,'additional_evidence':[a,b]});back();milestone('Normal native read of web metadata and strict profile acknowledgement observed.')
 filewait('stock-native-start.json');inventory();shortcut('Purchase orders');tap('New PO');observed('New purchase order');tap('Choose receiving location');tap('Synthetic Default Warehouse (default)');tap('Choose supplier (optional)');tap('Synthetic native recovery supplier');tap('Choose product for line 1');tap('Synthetic cotton tote',prefix=True);fill_stock_value('1','4');fill_stock_value('0','125.50');tapnode(scrollto('Create purchase order',True));observed('Review purchase order');tap('Confirm creation');observed('Ordered');partial_receipt(3,4);observed('Warehouse request awaiting confirmation');a=screen('native-po-partial-original-pending.png')
 adb('shell','am','force-stop','com.letbuyy.store');adb('shell','am','start','-n','com.letbuyy.store/.MainActivity');observed('Products tab');inventory();shortcut('Purchase orders');observed('Warehouse request awaiting confirmation');b=screen('native-po-partial-restart-retained.png');write('stock-release-native-replies.json',{'observation':'Original partial stock receipt remains pending after normal process restart'});tap('Retry original');await_no_pending();observed('Partially received');c=screen('native-po-partial-confirmed.png');back();shortcut('Transfers');tap('New transfer');observed('New transfer');tap('Choose source location');tap('Synthetic Default Warehouse (default)');tap('Choose destination location');tap('Synthetic native recovery location');tap('Choose product for line 1');tap('Synthetic cotton tote',prefix=True);fill_stock_value('1','2');e=screen('native-transfer-quantity-entered-without-scanner.png');tapnode(scrollto('Create transfer',True));observed('Review transfer');tap('Confirm creation');observed('Reserved');back();shortcut('Reservations');reservation_lifetime('Held until shipment');reservation_lifetime('Transfer reference:');held=screen('native-transfer-held-reservation.png');write('stock-native-held-view.json',{'evidence':[held],'steps':['normal-reservation-held-until-shipment-view']});milestone('Actual native held lifetime and readable transfer reference observed; waiting for independent web/database checks.');filewait('stock-web-held-verified.json');milestone('Independent web/database held-state readback acknowledged.');back();shortcut('Transfers');observed('Reserved');tap('Ship');observed('Review stock shipment');tap('Ship stock');observed('Shipped');back();shortcut('Reservations');reservation_lifetime('Committed at shipment');reservation_lifetime('Transfer reference:');committed=screen('native-transfer-committed-reservation.png');back();shortcut('Transfers');observed('Shipped');partial_receipt(1,2);observed('Partially received');d=screen('native-transfer-partial-confirmed.png');write('stock-native-done.json',{'steps':['normal-native-PO-create','partial3-receipt','lost-reply-restart-exact-original-recovery','normal-transfer-reserve2','normal-held-reservation-read','web-held-readback','normal-transfer-ship2','normal-committed-reservation-read','normal-transfer-partial-receive1'],'evidence':[a,b,c,d,e,held,committed]});milestone('Native PO partial receipt and transfer reserve/ship/partial receipt observed; waiting for web completion.')
 filewait('stock-web-completed.json');tap('Refresh transfers');row=observed('Received');assert all(text in visible_copy(nodes()) for text in ['Synthetic Default Warehouse','Synthetic native recovery location','Synthetic cotton tote']),'Current transfer readable names missing';a=screen('native-web-completed-transfer-read.png');transfer_detail=read_saved_document(True);back();shortcut('Purchase orders');row=observed('Received');assert all(text in visible_copy(nodes()) for text in ['Synthetic Default Warehouse','Synthetic cotton tote']),'Current PO readable names missing';b=screen('native-web-completed-po-read.png');po_detail=read_saved_document(False);write('stock-document-native-read.json',{'steps':['normal-native-completed-transfer-document-read','normal-native-completed-PO-document-read','original-list-return-and-query-retention'],'evidence':[transfer_detail,po_detail],'scope':'Existing strict detail readers; normal current completed document UI, exact saved quantities/cost. Fixture has one line per document; multi-line layout covered separately by composed tests. No new backend mutation or complete feature acceptance.'});write('stock-native-web-read.json',{'evidence':[a,b],'steps':['normal-native-refresh-read-web-completed-transfer','normal-native-read-web-completed-PO']});milestone('Native current read of web final receipts observed; independent stock/receipt assertions remain required.')

 filewait('setter-native-start.json');back();back();inventory();fill(0,'Synthetic Default Warehouse')
 def stock_view(free,physical):
  end=min(deadline,time.monotonic()+90);expected={'Synthetic cotton tote','Synthetic Default Warehouse',str(free)+' Low','1 reserved',str(physical)+' on hand'}
  while time.monotonic()<end:
   actual={line for x in nodes()if x.get('package')=='com.letbuyy.store'and visible(x)for line in label(x).split('\n')}
   if expected<=actual:return
   time.sleep(.3)
  raise RuntimeError('Observed current native stock, held subset and physical quantity do not match')
 stock_view(1,2);tap('Adjust');observed('Adjust Synthetic cotton tote')
 dialog_nodes=nodes();title=match('Adjust Synthetic cotton tote',dialog_nodes)[0];reasons=[x for x in dialog_nodes if x.get('package')=='com.letbuyy.store'and x.get('class')=='android.widget.Button'and visible(x)and label(x).split('\n')[0]=='Reason'];assert len(reasons)==1,'Observed unique reason selector required';fields=[x for x in dialog_nodes if x.get('package')=='com.letbuyy.store'and x.get('class')=='android.widget.EditText'and visible(x)and bounds(x)[1]>=bounds(title)[3]and bounds(x)[3]<=bounds(reasons[0])[1]];assert len(fields)==1,'Observed unique quantity input between the stock-dialog heading and reason selector required';assert not any(x.get('password')=='true'for x in dialog_nodes);write('setter-observed-quantity-control.json',{'quantity':dict(fields[0].attrib),'heading_bounds':bounds(title),'reason_bounds':bounds(reasons[0]),'scope':'Observed current synthetic stock dialog only; no credential field or guessed coordinate'});tapnode(fields[0]);adb('shell','input','text','2');fields=[x for x in nodes()if x.get('package')=='com.letbuyy.store'and x.get('class')=='android.widget.EditText'and visible(x)];assert any(x.get('text')=='2'for x in fields),'Normal native delta entry must read back exactly2';keyboard=screen('native-stock-delta-keyboard.png');back();tap('Apply');observed('A stock change needs confirmation');pending=screen('native-stock-original-pending.png')
 adb('shell','am','force-stop','com.letbuyy.store');adb('shell','am','start','-n','com.letbuyy.store/.MainActivity');observed('Products tab');inventory();observed('A stock change needs confirmation');restart=screen('native-stock-restart-retained.png');write('setter-release-native-replies.json',{'observation':'Original delta remains pending after ordinary process restart'});tap('Retry original');fill(0,'Synthetic Default Warehouse');stock_view(3,4);confirmed=screen('native-stock-delta-confirmed-current-free.png');write('setter-native-done.json',{'steps':['normal-native-delta-plus2','real-committed-reply-loss','process-restart-retains-original','retry-original','fresh-read3free-1held-4physical'],'evidence':[keyboard,pending,restart,confirmed]});milestone('Normal native stock delta+2and original recovery observed under a real held unit; waiting for independent web absolute save.')
 filewait('setter-web-updated.json');tap('Refresh inventory');stock_view(4,5);final=screen('native-web-absolute-stock-read.png');staff_ui_review();write('setter-native-web-read.json',{'steps':['normal-native-refresh-after-web-absolute4','4free-1held-5physical'],'evidence':[final]});milestone('Normal native current read of web absolute stock4free/1held/5physical observed; independent no-duplicate and reservation checks still required.')

except Exception as error:
 safe=[]
 try:
  for x in nodes():
   s=label(x)
   if x.get('class')!='android.widget.EditText'and s and not any(v in s for v in ['@','http:','https:','Synthetic-native-catalog-']):safe.append({'package':x.get('package'),'class':x.get('class'),'label':s,'bounds':x.get('bounds'),'clickable':x.get('clickable')})
 except Exception:pass
 try:
  ns=nodes()
  if any(x.get('package')=='com.letbuyy.store'for x in ns)and not any(x.get('class')=='android.widget.EditText'or x.get('password')=='true'or'@'in label(x)for x in ns):screen('native-ui-attention.png')
 except Exception:pass
 root.mkdir(exist_ok=True);(root/'ui-attention.json').write_text(json.dumps({'error':sanitize_error(str(error)),'companion_stderr':sanitize_error(getattr(error,'stderr',b'')),'observedControls':safe},indent=2)+'\n');milestone('Native warehouse companion needs inspection; private ui-attention.json retained.');sys.exit(1)
