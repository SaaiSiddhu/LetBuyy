from pathlib import Path
import subprocess,sys,json,hashlib,datetime,os
ROOT=Path(__file__).resolve().parents[4]
E=Path(__file__).resolve().parent

def snapshot():
    raw=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=ROOT).decode().split('\0')
    files={p:hashlib.sha256((ROOT/p).read_bytes()).hexdigest() for p in sorted(set(raw)) if p and (ROOT/p).is_file() and not p.startswith(('docs/','.codex/','.agents/'))}
    return {'basis':'Git tracked plus unignored untracked existing regular files excluding docs/.codex/.agents; ignored build outputs excluded','files':files,'sha256':hashlib.sha256(json.dumps(files,sort_keys=True,separators=(',',':')).encode()).hexdigest(),'entries':len(files)}
def write(path,data): path.write_text(json.dumps(data,indent=2)+'\n')
if __name__=='__main__':
    action,name,*args=sys.argv[1:]
    if action=='capture':
        path=E/(name+'.source.json')
        if path.exists(): raise RuntimeError('Existing source manifest must not be overwritten')
        s=snapshot();write(path,s);print(json.dumps({'sha256':s['sha256'],'entries':s['entries']}))
    elif action=='verify':
        old=json.loads((E/(name+'.source.json')).read_text());now=snapshot()
        changed=[p for p in set(old['files'])|set(now['files']) if old['files'].get(p)!=now['files'].get(p)]
        result={'matches':not changed,'changed':sorted(changed),'sha256':now['sha256'],'entries':now['entries']}
        write(E/(name+'.readback.json'),result);print(json.dumps(result));sys.exit(bool(changed))
    elif action=='run':
        source=json.loads((E/(name+'.source.json')).read_text());before=snapshot()
        if before['files']!=source['files']: raise RuntimeError('Source changed before qualification')
        label,*command=args
        report=E/(label+'.terminal.json')
        if report.exists(): raise RuntimeError('Existing terminal must not be overwritten')
        state={'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'supervisor_pid':os.getpid(),'source':name,'source_sha256':source['sha256'],'command':command,'status':'RUNNING'}
        write(E/(label+'.active.json'),state)
        cwd=ROOT/'apps/merchant/mobile'
        if label.startswith('uikit-'): cwd=ROOT/'packages/dart/ui_kit'
        with (E/(label+'.log')).open('w') as log:
            proc=subprocess.Popen(command,cwd=cwd,stdout=log,stderr=subprocess.STDOUT)
            state['child_pid']=proc.pid;write(E/(label+'.active.json'),state);exitcode=proc.wait()
        after=snapshot()
        state.update({'status':'TERMINAL','exit_code':exitcode,'finished_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source_unchanged':source['files']==after['files'],'source_readback_sha256':after['sha256']})
        write(report,state);print(json.dumps(state));sys.exit(exitcode if state['source_unchanged'] else 99)
