"""One separately approved preserved-runtime rehearsal. No implicit retry or cleanup."""
from pathlib import Path
import os, sys, json, hashlib, subprocess, time, datetime, signal

def digest(raw): return hashlib.sha256(raw).hexdigest()
def read_bound(path, expected):
 raw=Path(path).read_bytes();assert digest(raw)==expected
 return json.loads(raw)

def main():
 assert len(sys.argv)==5
 command=read_bound(sys.argv[1],sys.argv[2]);approval=read_bound(sys.argv[3],sys.argv[4])
 assert command['kind']=='ORIGINAL210_ONE_FRESH_PRESERVED_REHEARSAL'
 assert approval['status']=='HUMAN_APPROVED_ONE_FRESH_PRESERVED_REHEARSAL'
 assert approval['commandSha256']==sys.argv[2] and approval['monitorSha256']==digest(Path(__file__).read_bytes())
 assert approval['maxAttempts']==1 and approval['wholeParentBudgetSeconds']==600
 assert datetime.datetime.now(datetime.timezone.utc)<datetime.datetime.fromisoformat(approval['expiresAt'])
 assert command['actualSelectedCliPreflightPass'] is True and command['finalSourceIndependentlyReviewed'] is True
 root=Path('/private/tmp/letbuyy-original210-recovery-20261025-01')
 assert command['cwd']==str(root)
 assert command['executable']=='/opt/homebrew/Cellar/node@22/22.23.3_2/bin/node'
 assert command['argv'][:7]==[str(root/'scripts/governance/run-executable-suites.mjs'),'--suite','tests/owned-db/theme-completion-razorpay-browser.manual.ts','--kind','gateway-db','--jobs','1']
 assert '--no-reap' in command['argv'] and '--preserved-phase' in command['argv']
 assert command['argv'][command['argv'].index('--preserved-phase')+1]=='rehearsal'
 assert command['argv'][command['argv'].index('--timeout')+1]=='600'
 assert all('provisional' not in value.lower() for value in command['argv'])
 out=Path(command['outputDirectory'])
 assert out==Path('/Volumes/Projects/LetBuyy/docs/implementation/niche-theme-programme/completion-2026-10-24/original210-recovery-candidate01/future-restore-rehearsal01')
 out.mkdir(parents=True,exist_ok=True)
 attempt=out/'whole-parent-start.json'
 with attempt.open('x') as f:json.dump({'startedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commandSha256':sys.argv[2],'approvalSha256':sys.argv[4],'maxAttempts':1,'wholeParentBudgetSeconds':600,'softStopSeconds':555},f)
 env={key:os.environ[key] for key in ['PATH','HOME','TMPDIR','TMP','TEMP','LANG','LC_ALL'] if key in os.environ}
 env.update(CI='false',LETBUYY_EXECUTABLE_PULL='never',TSX_DISABLE_CACHE='1',LETBUYY_THEME_COMPLETION_RAZORPAY_HOLD='1',LETBUYY_THEME_EDITOR_BROWSER_HOLD='1')
 began=time.monotonic();signals=[]
 supervision_failure=None
 with (out/'whole-parent.log').open('x') as log:
  child=subprocess.Popen([command['executable'],*command['argv']],cwd=root,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT)
  try:
   with (out/'whole-parent-owner.json').open('x') as f:json.dump({'runnerPid':child.pid,'monitorPid':os.getpid(),'commandSha256':sys.argv[2]},f)
   child.wait(timeout=max(0.01,555-(time.monotonic()-began)))
  except subprocess.TimeoutExpired:
   supervision_failure='WORK_DEADLINE_REACHED'
  except BaseException as error:
   supervision_failure=type(error).__name__
  finally:
   # Every operation after Popen is supervised, including owner-receipt IO.
   # Direct unreaped-child ownership prevents PID reuse; never signal a group,
   # original process or container. Canonical checkpoint code owns retention.
   if child.poll() is None:
    try:
     if time.monotonic()-began<600:
      child.send_signal(signal.SIGTERM);signals.append('SIGTERM_EXACT_NEW_CHILD')
      child.wait(timeout=max(0.01,min(45,600-(time.monotonic()-began))))
    except (subprocess.TimeoutExpired,ProcessLookupError):
     pass
    finally:
     if child.poll() is None:
      child.kill();signals.append('SIGKILL_EXACT_NEW_CHILD');child.wait(timeout=5)
  code=child.returncode
  elapsed=time.monotonic()-began
 terminal={'finishedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'runnerPid':child.pid,'terminalExit':code,'wholeParentSeconds':elapsed,'deadlineExceeded':elapsed>600,'supervisionFailureClass':supervision_failure,'maxAttempts':1,'signals':signals,'originalRuntimeActions':0,'cleanup':'Read actual canonical result and durable checkpoint receipt; this monitor never reaps or removes resources. Any failure requires retained protected resources and independent review, never automatic retry.'}
 with (out/'whole-parent-terminal.json').open('x') as f:json.dump(terminal,f,indent=2)
 print(json.dumps(terminal));return code if 0<=code<=125 and not signals and supervision_failure is None else 1

if __name__=='__main__':sys.exit(main())
