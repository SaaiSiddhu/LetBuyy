import importlib.util,json,os,shutil,subprocess
from pathlib import Path
import tempfile,unittest,time
from unittest.mock import patch

spec=importlib.util.spec_from_file_location('ci',Path(__file__).with_name('ci_lifecycle.py'))
ci=importlib.util.module_from_spec(spec);spec.loader.exec_module(ci)

class Tests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
  self.base=Path(self.tmp.name).resolve();self.project=self.base/'checkout';self.temp=self.base/'runner'
  self.project.mkdir();self.temp.mkdir()
  self.env={'GITHUB_REPOSITORY':'synthetic/project','GITHUB_RUN_ID':'123','GITHUB_RUN_ATTEMPT':'1','GITHUB_JOB':'build','GITHUB_SHA':'synthetic'}
 def begin(self,**kw):return ci.begin(self.project,self.temp,self.env,**kw)
 def apk(self):
  p=self.project/'apps/mobile/build/app/outputs/apk/release/app.apk';p.parent.mkdir(parents=True);p.write_bytes(b'synthetic compiled APK');return p
 def ack(self,d):return ci.acknowledge(d['scope'],'42','a'*64,self.env)
 def test_scope_ownership_and_job_isolation(self):
  a=self.begin();b=self.begin();self.assertNotEqual(a['scope'],b['scope']);self.assertEqual(a['workspace'],b['workspace'])
 def test_source_and_unsafe_roots_refused(self):
  with self.assertRaises(ValueError):ci.begin(self.project,self.project,self.env)
  alias=self.base/'alias';alias.symlink_to(self.temp)
  with self.assertRaises(ValueError):ci.begin(self.project,alias,self.env)
 def test_missing_job_identity_refuses_setup(self):
  with self.assertRaises(ValueError):ci.begin(self.project,self.temp,{})
 def test_foreign_scope_job_refused(self):
  d=self.begin();env=dict(self.env,GITHUB_JOB='other')
  with self.assertRaises(ValueError):ci.snapshot(d['scope'],'success',env)
 def test_snapshot_copies_only_build_outputs_and_keeps_original(self):
  apk=self.apk();(self.project/'.env').write_text('SYNTHETIC_SECRET=not-uploaded')
  d=self.begin();ci.snapshot(d['scope'],'success',self.env)
  payload=Path(d['payload']);self.assertEqual(len(list(payload.glob('*.apk'))),1)
  self.assertFalse((payload/'.env').exists());self.assertEqual(apk.read_bytes(),b'synthetic compiled APK')
 def test_no_upload_acknowledgement_defers_all_cleanup(self):
  d=self.begin();ci.snapshot(d['scope'],'success',self.env)
  r=ci.finalize(d['scope'],self.env,guard=lambda p:None)
  self.assertFalse(r['artifact_upload_confirmed']);self.assertIn('Upload',r['cleanup_deferred'])
  self.assertTrue(Path(d['scope']).exists())
 def test_release_symbols_and_mappings_preserved_but_source_and_keys_excluded(self):
  self.apk();mapping=self.project/'apps/mobile/build/app/outputs/mapping/release/mapping.txt'
  mapping.parent.mkdir(parents=True);mapping.write_text('synthetic release mapping')
  (mapping.parent/'signing.key').write_text('synthetic never upload')
  (self.project/'source.symbols').write_text('source never upload')
  symbols=self.project/'build/native/app.android-arm64.symbols';symbols.parent.mkdir(parents=True);symbols.write_text('synthetic symbols')
  d=self.begin();ci.snapshot(d['scope'],'success',self.env)
  manifest=json.loads((Path(d['payload'])/'manifest.json').read_text())
  names=[x['source'] for x in manifest['build_outputs']]
  self.assertIn(str(mapping.relative_to(self.project)),names);self.assertIn(str(symbols.relative_to(self.project)),names)
  self.assertFalse(any(x.endswith(('signing.key','source.symbols')) for x in names))
 def test_valid_archive_receipt_allows_only_managed_cleanup(self):
  self.apk();d=self.begin();ci.snapshot(d['scope'],'success',self.env);self.ack(d)
  r=ci.finalize(d['scope'],self.env,guard=lambda p:None)
  self.assertTrue(r['artifact_upload_confirmed']);self.assertEqual(r['pins'],[])
  self.assertTrue(Path(d['payload']).exists())
 def test_failed_runs_and_release_outputs_are_pinned(self):
  d=self.begin();ci.snapshot(d['scope'],'failure',self.env,release=True);self.ack(d)
  r=ci.finalize(d['scope'],self.env,guard=lambda p:None)
  self.assertTrue(any('failure' in x for x in r['pins']));self.assertTrue(any('release' in x for x in r['pins']))
 def test_tampered_payload_refuses_archive_confirmation(self):
  d=self.begin();ci.snapshot(d['scope'],'success',self.env)
  (Path(d['payload'])/'manifest.json').write_text('{}')
  with self.assertRaises(RuntimeError):self.ack(d)
 def test_invalid_archive_receipt_refused(self):
  d=self.begin();ci.snapshot(d['scope'],'success',self.env)
  with self.assertRaises(ValueError):ci.acknowledge(d['scope'],'','bad',self.env)
 def test_other_active_job_is_not_finalized_or_removed(self):
  a=self.begin();b=self.begin();ci.snapshot(a['scope'],'success',self.env);self.ack(a)
  ci.finalize(a['scope'],self.env,guard=lambda p:None)
  w=ci.engine.Workspace(self.project,a['workspace']);x=next(x for x in w.items() if w.path(x['path'])==Path(b['scope']))
  self.assertEqual(x['state'],'active');self.assertTrue(Path(b['scope']).exists())
 def test_audit_only_host_never_deletes(self):
  d=self.begin(audit_only=True);ci.snapshot(d['scope'],'success',self.env);self.ack(d)
  r=ci.finalize(d['scope'],self.env,guard=lambda p:self.fail('audit host must not delete'))
  self.assertTrue(r['audit_only']);self.assertTrue(Path(d['scope']).exists())
 def test_bundle_with_external_symlink_or_credentials_is_not_uploaded(self):
  app=self.project/'build/Products/App.app';app.mkdir(parents=True)
  (app/'key.pem').write_text('synthetic private key')
  self.assertFalse(ci.safe_binary(app));(app/'key.pem').unlink();(app/'escape').symlink_to(self.project/'.env')
  self.assertFalse(ci.safe_binary(app))
 def test_bundle_archives_keep_signed_bytes_and_modes(self):
  app=self.project/'build/Products/App.app';app.mkdir(parents=True);(app/'App').write_bytes(b'compiled signed bytes');(app/'App').chmod(0o755)
  d=self.begin();ci.snapshot(d['scope'],'success',self.env)
  archives=list(Path(d['payload']).glob('*.tar'));self.assertEqual(len(archives),1)
  with ci.tarfile.open(archives[0]) as t:
   self.assertEqual(t.extractfile('App.app/App').read(),b'compiled signed bytes');self.assertEqual(t.getmember('App.app/App').mode,0o755)
 def test_callback_is_idempotent_after_finalization(self):
  d=self.begin();ci.snapshot(d['scope'],'success',self.env);self.ack(d);ci.finalize(d['scope'],self.env,guard=lambda p:None)
  self.assertTrue(ci.finalize(d['scope'],self.env)['already_finalized'])
 def test_javascript_action_runs_in_an_esmodule_repository_and_preserves_on_failed_upload(self):
  action=self.project/'.project-cleanup/ci';action.mkdir(parents=True)
  for name in ('action.cjs','post.cjs','ci_lifecycle.py','engine.py'):
   shutil.copy2(Path(__file__).with_name(name),action/name)
  (self.project/'package.json').write_text('{"type":"module"}')
  output=self.base/'output';state=self.base/'state';environment=self.base/'environment'
  for p in (output,state,environment):p.write_text('')
  env=dict(os.environ,**self.env,GITHUB_WORKSPACE=str(self.project),RUNNER_TEMP=str(self.temp),
           GITHUB_OUTPUT=str(output),GITHUB_STATE=str(state),GITHUB_ENV=str(environment),PYTHONDONTWRITEBYTECODE='1')
  r=subprocess.run(['node',str(action/'action.cjs')],capture_output=True,text=True,env=env)
  self.assertEqual(r.returncode,0,r.stderr);self.assertIn('enabled=true',output.read_text())
  scope=next(x.split('=',1)[1] for x in state.read_text().splitlines() if x.startswith('scope='))
  r=subprocess.run(['node',str(action/'post.cjs')],capture_output=True,text=True,env=dict(env,STATE_scope=scope))
  self.assertEqual(r.returncode,0,r.stderr)
  record=json.loads((Path(scope)/'ci-job.json').read_text())
  self.assertIn('artifact upload not confirmed; preserve all local evidence',record['protection'])
 def test_javascript_snapshot_and_archive_phases_report_readiness(self):
  self.apk();d=self.begin();output=self.base/'output';output.write_text('')
  action=Path(__file__).with_name('action.cjs')
  env=dict(os.environ,**self.env,GITHUB_OUTPUT=str(output),PROJECT_CLEANUP_CI_SCOPE=d['scope'],
           PROJECT_CLEANUP_JOB_STATUS='success',INPUT_PHASE='snapshot',PYTHONDONTWRITEBYTECODE='1')
  r=subprocess.run(['node',str(action)],capture_output=True,text=True,env=env)
  self.assertEqual(r.returncode,0,r.stderr);self.assertIn('ready=true',output.read_text())
  output.write_text('')
  r=subprocess.run(['node',str(action)],capture_output=True,text=True,env=dict(env,INPUT_PHASE='archive',
                   PROJECT_CLEANUP_ARTIFACT_ID='42',PROJECT_CLEANUP_ARTIFACT_DIGEST='a'*64))
  self.assertEqual(r.returncode,0,r.stderr);self.assertIn('ready=true',output.read_text())

if __name__=='__main__':unittest.main(verbosity=2)
