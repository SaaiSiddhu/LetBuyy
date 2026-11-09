from pathlib import Path
import subprocess,tempfile,os,json,hashlib,sys,datetime,signal,shutil
from qualify import ROOT,E,snapshot,write
platform=sys.argv[1]
assert platform in ('android','ios')
source=json.loads((E/'merchant-recovery-source-v6.source.json').read_text())
if snapshot()['files']!=source['files']: raise RuntimeError('Source changed')
label='merchant-recovery-v6-'+platform+'-compile-v1'
if (E/(label+'.terminal.json')).exists(): raise RuntimeError('Existing result must not be overwritten')
owned=Path(tempfile.mkdtemp(prefix='letbuyy-merchant-recovery-v6-'+platform+'-',dir='/private/tmp'));os.chmod(owned,0o700)
host='10.0.2.2' if platform=='android' else '127.0.0.1'
defines={'ENVIRONMENT':'local','ACCOUNTS_ENVIRONMENT':'development','BFF_BASE_URL':'http://'+host+':54350/v1','API_BASE_URL':'http://'+host+':54350/v1','IDENTITY_BASE_URL':'http://'+host+':54351','ADMIN_BASE_URL':'http://'+host+':54353','STOREFRONT_BASE_URL':'http://'+host+':54354'}
defines_path=E/(label+'-defines.json');write(defines_path,defines)
sdk='/Users/saai_mithra/Library/Developer/flutter/bin/flutter'
commands=[]
if platform=='android':
    import base64
    commands=[
      ([sdk,'build','apk','--debug','--no-pub','--config-only','--target-platform','android-arm64','--dart-define-from-file='+str(defines_path)],ROOT/'apps/merchant/mobile'),
      ([str(ROOT/'apps/merchant/mobile/android/gradlew'),'--offline','--no-daemon','-q','-Ptarget-platform=android-arm64','-Ptarget=lib/main.dart','-Pbase-application-name=android.app.Application','-Pdart-defines='+','.join(base64.b64encode((k+'='+v).encode()).decode() for k,v in defines.items()),'-Pdart-obfuscation=false','-Ptrack-widget-creation=true','-Ptree-shake-icons=false','assembleDebug'],ROOT/'apps/merchant/mobile/android'),
    ]
else:
    commands=[([sdk,'build','ios','--device-id=B907B390-5B08-490F-BC6A-8900667B2D94','--simulator','--debug','--no-codesign','--no-pub','--dart-define-from-file='+str(defines_path)],ROOT/'apps/merchant/mobile')]
state={'build_script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'status':'RUNNING','source_sha256':source['sha256'],'source_inputs':len(source['files']),'supervisor_pid':os.getpid(),'owned_root':str(owned),'platform':platform,'started_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'defines':defines,'steps':[],'scope':'Normal main.dart debug compile/artifact only. No install, launch, sign-in, provider, web-mobile sync, device, hosted or release acceptance.'}
write(E/(label+'.active.json'),state)
env=dict(os.environ)
env['ANDROID_HOME']='/Volumes/Developer Tools/SDKs/android-sdk';env['ANDROID_SDK_ROOT']=env['ANDROID_HOME']
try:
    with (E/(label+'.log')).open('w') as log:
        for command,cwd in commands:
            child=subprocess.Popen(command,cwd=cwd,env=env,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
            state['active_child_pid']=child.pid;write(E/(label+'.active.json'),state)
            try: exitcode=child.wait(timeout=1200)
            except subprocess.TimeoutExpired:
                os.killpg(child.pid,signal.SIGTERM)
                try:child.wait(timeout=10)
                except subprocess.TimeoutExpired:os.killpg(child.pid,signal.SIGKILL);child.wait()
                exitcode=124
            state['steps'].append({'command':command,'cwd':str(cwd),'exit_code':exitcode})
            if exitcode: raise RuntimeError('Compile step failed; inspect retained log')
    if platform=='android':
        src=ROOT/'apps/merchant/mobile/build/app/outputs/flutter-apk/app-debug.apk'
        target=owned/'merchant-local-debug.apk';shutil.copy2(src,target);target.chmod(0o600)
        state['artifact']={'path':str(target),'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'bytes':target.stat().st_size}
    else:
        src=ROOT/'apps/merchant/mobile/build/ios/iphonesimulator/Runner.app'
        target=owned/'Runner.app';shutil.copytree(src,target,symlinks=True)
        files={str(p.relative_to(target)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(target.rglob('*')) if p.is_file()}
        write(E/(label+'-artifact-files.json'),{'files':files})
        state['artifact']={'path':str(target),'files':len(files),'manifest_sha256':hashlib.sha256(json.dumps(files,sort_keys=True,separators=(',',':')).encode()).hexdigest()}
    state['exit_code']=0
except Exception as error:
    state['exit_code']=1;state['error']=str(error)
finally:
    state['status']='TERMINAL';state['finished_at']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    state['source_unchanged']=snapshot()['files']==source['files']
    write(E/(label+'.terminal.json'),state)
    print(json.dumps({'platform':platform,'exit_code':state['exit_code'],'source_unchanged':state['source_unchanged'],'artifact':state.get('artifact'),'error':state.get('error')}))
sys.exit(state['exit_code'] if state['source_unchanged'] else 99)
