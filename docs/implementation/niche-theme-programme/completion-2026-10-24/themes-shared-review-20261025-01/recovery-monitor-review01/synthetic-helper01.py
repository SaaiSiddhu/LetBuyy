from pathlib import Path
import hashlib, json, io, types, datetime, subprocess, signal, contextlib
monitor=Path('/private/tmp/letbuyy-original210-restore-monitor01.py');source=monitor.read_text();source_sha=hashlib.sha256(source.encode()).hexdigest();ROOT='/private/tmp/letbuyy-original210-recovery-20261025-01';OUT='/Volumes/Projects/LetBuyy/docs/implementation/niche-theme-programme/completion-2026-10-24/original210-recovery-candidate01/future-restore-rehearsal01';cases=[]
def run_case(mode,expired=False,wrong_hash=False,prior_attempt=False,owner_write_fault=False):
 files={};events=[];waits=[];signals=[]
 if prior_attempt:files[OUT+'/whole-parent-start.json']='old synthetic only'
 class Handle(io.StringIO):
  def __init__(self,path):super().__init__();self.path=path
  def __exit__(self,*args):files[self.path]=self.getvalue();self.close()
 class P:
  def __init__(self,p):self.p=str(p.p if isinstance(p,P)else p)
  def __str__(self):return self.p
  def __eq__(self,o):return str(o)==self.p
  def __truediv__(self,v):return P(self.p+'/'+str(v))
  def mkdir(self,**kwargs):events.append('fake-mkdir')
  def read_bytes(self):assert self.p==str(monitor);return source.encode()
  def open(self,kind):
   if owner_write_fault and self.p.endswith('/whole-parent-owner.json'):raise OSError('synthetic owner receipt write failure')
   if kind=='x'and self.p in files:raise FileExistsError('synthetic exclusive marker')
   return Handle(self.p)
 class Child:
  pid=123456
  def wait(self,timeout):
   waits.append(timeout)
   if mode=='soft'and len(waits)==1:raise subprocess.TimeoutExpired('synthetic',timeout)
   if mode=='hard'and len(waits)<=2:raise subprocess.TimeoutExpired('synthetic',timeout)
   return 0 if mode=='normal'else -15 if mode=='soft'else -9
  def send_signal(self,s):assert s==signal.SIGTERM;signals.append('TERM_EXACT_SYNTHETIC_CHILD')
  def kill(self):signals.append('KILL_EXACT_SYNTHETIC_CHILD')
 def popen(argv,**kwargs):events.append({'fake-Popen':argv});assert kwargs['cwd']==P(ROOT);return Child()
 ticks=iter([0,10]if mode=='normal'else[0,555,560]if mode=='soft'else[0,555,600.001])
 command={'kind':'ORIGINAL210_ONE_FRESH_PRESERVED_REHEARSAL','actualSelectedCliPreflightPass':True,'finalSourceIndependentlyReviewed':True,'cwd':ROOT,'executable':'/opt/homebrew/Cellar/node@22/22.23.3_2/bin/node','argv':[ROOT+'/scripts/governance/run-executable-suites.mjs','--suite','tests/owned-db/theme-completion-razorpay-browser.manual.ts','--kind','gateway-db','--jobs','1','--no-reap','--preserved-phase','rehearsal','--timeout','600'],'outputDirectory':OUT}
 approval={'status':'HUMAN_APPROVED_ONE_FRESH_PRESERVED_REHEARSAL','commandSha256':('c'if wrong_hash else'a')*64,'monitorSha256':source_sha,'maxAttempts':1,'wholeParentBudgetSeconds':600,'expiresAt':'2000-01-01T00:00:00+00:00'if expired else'2040-01-01T00:00:00+00:00'}
 g={'__name__':'themes_pure_monitor_review','__file__':str(monitor)};exec(compile(source,str(monitor),'exec'),g)
 def bound(path,expected):return command if path=='synthetic-command.json'else approval
 g.update(Path=P,read_bound=bound,subprocess=types.SimpleNamespace(Popen=popen,TimeoutExpired=subprocess.TimeoutExpired,DEVNULL=-3,STDOUT=-2),os=types.SimpleNamespace(environ={},getpid=lambda:333333),sys=types.SimpleNamespace(argv=['synthetic-monitor','synthetic-command.json','a'*64,'synthetic-approval.json','b'*64]),time=types.SimpleNamespace(monotonic=lambda:next(ticks)))
 error=None;result=None
 with contextlib.redirect_stdout(io.StringIO()):
  try:result=g['main']()
  except Exception as ex:error=type(ex).__name__+': '+str(ex)
 return {'mode':mode,'return':result,'error':error,'events':events,'waits':waits,'signals':signals,'terminal':json.loads(files[OUT+'/whole-parent-terminal.json'])if OUT+'/whole-parent-terminal.json'in files else None,'realProcesses':0,'realFilesOrResourcesTouched':0}
for name,kwargs in [('normal',{}),('soft',{'mode':'soft'}),('hard',{'mode':'hard'}),('expired',{'expired':True}),('wrong-command-hash',{'wrong_hash':True}),('prior-attempt',{'prior_attempt':True}),('owner-receipt-write-fault',{'owner_write_fault':True})]:
 r=run_case(**{'mode':'normal',**kwargs});r['name']=name;cases.append(r)
assert cases[0]['return']==0 and cases[0]['waits']==[555]
assert cases[1]['return']==1 and cases[1]['signals']==['TERM_EXACT_SYNTHETIC_CHILD'] and cases[1]['waits']==[555,45]
assert cases[2]['return']==1 and cases[2]['signals']==['TERM_EXACT_SYNTHETIC_CHILD','KILL_EXACT_SYNTHETIC_CHILD']and cases[2]['waits']==[555,45,5]
for row in cases[3:6]:assert row['error']and not any(isinstance(x,dict)for x in row['events'])
fault=cases[-1];assert fault['error']and any(isinstance(x,dict)for x in fault['events'])and fault['signals']==[]and fault['waits']==[]
out={'status':'SOURCE_MONITOR_ONE_VERIFIED_POSTSPAWN_SUPERVISION_GAP','monitor':str(monitor),'sha256':source_sha,'syntheticCases':cases,'finding':'Ownerreceiptopen/write occurs afterPopen butbeforetry; injectedIOException leavesprovednewchildwithoutsignal/wait/deadline supervision. Actualprocesses/resources0.','fix':'MoveallfalliblepostPopenoperations underoutertry/finally; onanyexception immediately stoponlystillownedunreapedchild, boundedbyremaining600s, lettingcanonicalcheckpointhandledata. Recordfailurewithoutretry/reaper/oldPID/groupaction.','scope':'Purefakes/sourceonly. No actualmonitor main process/Docker/DB/Native/app/provider/privateinputs.'}
Path('/private/tmp/themes-monitor-review01-result.json').write_text(json.dumps(out,indent=2)+'\n');print(json.dumps({'monitorSha256':source_sha,'sixNormalRefusalControls':'PASS','faultReproduced':True,'actualProcessesResources':0}))
