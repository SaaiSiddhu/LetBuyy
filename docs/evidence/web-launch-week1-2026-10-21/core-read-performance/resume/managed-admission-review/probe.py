from pathlib import Path
import subprocess, time, json, hashlib, sys

ROOT=Path('/Volumes/Projects/LetBuyy')
OUT=Path('/private/tmp/letbuyy-storefront-managed-review-20261022')
NAME='letbuyy-storefront-guard-review-20261022'
IMAGE='public.ecr.aws/supabase/postgres:17.6.1.156'
def run(args, sql=None, check=True):
    return subprocess.run(args, input=sql, text=True, capture_output=True, check=check)
def sql(s, check=True):
    return run(['docker','exec','-i',NAME,'psql','-h','/tmp','-X','-U','supabase_admin','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],s,check)
def backend(s):
    return subprocess.Popen(['docker','exec','-i',NAME,'psql','-h','/tmp','-X','-U','supabase_admin','-d','postgres','-qAt','-v','ON_ERROR_STOP=1'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
def active(app):
    for _ in range(100):
        if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='"+app+"' AND wait_event='PgSleep';").stdout.strip()=='1': return
        time.sleep(.1)
    raise RuntimeError('probe barrier missing: '+app)

admission=(ROOT/'database/supabase/deploy/managed-release-admission.sql').read_text()
migration=(ROOT/'database/supabase/migrations/360_subscription_tax_quote_snapshot.sql').read_text()
fence=migration[migration.index('DO $managed_catalog_fence$'):migration.index('END $managed_catalog_fence$;')+len('END $managed_catalog_fence$;')]
(OUT/'admission-under-review.sql').write_text(admission)
(OUT/'fence-under-review.sql').write_text(fence)
report={'scope':'Independent mechanism probe, synthetic empty database; real Supabase PG17 image but not a full hosted privilege-profile rehearsal.', 'qualification':'Uncommitted-guard and transaction-lock tests execute the exact reused fence only, not the entire migration. Full migration 360 separately rejects an already assigned transaction before this fence; rollback347 lacks that initial check. Role/event-trigger changes bypass the shared event guard itself.', 'image':IMAGE, 'sourceSha256':{'admission':hashlib.sha256(admission.encode()).hexdigest(),'migration360':hashlib.sha256(migration.encode()).hexdigest()}, 'checks':[]}
try:
    run(['docker','run','-d','--pull','never','--name',NAME,'--network','none','--label','letbuyy.review.owner=storefront-20261022','--memory','512m','--cpus','1','--pids-limit','128','--user','postgres','--entrypoint','/bin/sh',IMAGE,'-c',"initdb -D /tmp/review-pg -U supabase_admin -A trust >/tmp/review-init.log && exec postgres -D /tmp/review-pg -k /tmp -c listen_addresses='' -c unix_socket_directories=/tmp -c max_prepared_transactions=2"])
    for _ in range(200):
        ready=sql('SELECT 1;',False)
        if ready.returncode==0: break
        time.sleep(.1)
    else: raise RuntimeError('database readiness failed: '+ready.stderr)
    sql('CREATE ROLE postgres SUPERUSER LOGIN; GRANT ALL ON SCHEMA public TO postgres; SET ROLE postgres;\n'+admission)
    sql('ALTER ROLE postgres NOSUPERUSER CREATEROLE CREATEDB REPLICATION BYPASSRLS; CREATE ROLE review_victim NOLOGIN NOBYPASSRLS; GRANT review_victim TO postgres WITH ADMIN TRUE;')
    control=sql("SET ROLE postgres; CREATE TABLE public.review_positive_control(id int); DROP TABLE public.review_positive_control; SELECT pg_advisory_lock(hashtextextended('letbuyy:managed-schema-release:v1',0)); BEGIN;\n"+fence+"\nROLLBACK; SELECT pg_advisory_unlock(hashtextextended('letbuyy:managed-schema-release:v1',0));",False)
    report['checks'].append({'name':'ordinary_ddl_and_committed_guard_positive_control','exitCode':control.returncode,'stdout':control.stdout.strip(),'stderr':control.stderr.strip()})
    holder=backend('')
    holder.stdin.write("SET ROLE postgres; SET application_name='review-lease'; SELECT pg_advisory_lock(hashtextextended('letbuyy:managed-schema-release:v1',0)); SELECT pg_sleep(30);\n")
    holder.stdin.close()
    active('review-lease')
    for name, statement in [
        ('ordinary_table_ddl', 'CREATE TABLE public.review_should_block(id int);'),
        ('role_change', 'ALTER ROLE review_victim LOGIN;'),
        ('event_trigger_disable','ALTER EVENT TRIGGER managed_release_ddl_guard_v1 DISABLE;'),
        ('ordinary_ddl_after_disable','CREATE TABLE public.review_after_disable(id int);')]:
        result=sql('SET ROLE postgres; '+statement,False)
        report['checks'].append({'name':name,'exitCode':result.returncode,'stdout':result.stdout.strip(),'stderr':result.stderr.strip()})
    sql("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='review-lease';")
    holder.wait(timeout=10)
    sql('ALTER EVENT TRIGGER managed_release_ddl_guard_v1 ENABLE;')
    # The source fence calls this a session lease, but a transaction lease has the same pg_locks identity.
    result=sql("SET ROLE postgres; BEGIN; SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:managed-schema-release:v1',0));\n"+fence+"\nROLLBACK;",False)
    report['checks'].append({'name':'transaction_lock_accepted_as_session_lease','exitCode':result.returncode,'stdout':result.stdout.strip(),'stderr':result.stderr.strip()})
    # Recreate the canonical guard in the current uncommitted transaction and ask the exact source fence.
    sql('DROP EVENT TRIGGER managed_release_ddl_guard_v1; DROP FUNCTION public.guard_managed_release_ddl_v1(); ALTER ROLE postgres SUPERUSER;')
    uncommitted=admission.replace('BEGIN;','',1).rsplit('COMMIT;',1)[0]
    holder=backend('')
    holder.stdin.write("SET ROLE postgres; BEGIN; "+uncommitted+"\nSET application_name='review-uncommitted'; SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:managed-schema-release:v1',0)); SELECT pg_sleep(2); SELECT 'CURRENT_ROLE_SUPER='||rolsuper FROM pg_roles WHERE rolname=current_user;\n"+fence+"\nSELECT 'UNCOMMITTED_GUARD_ACCEPTED'; SELECT pg_sleep(20); ROLLBACK;\n")
    holder.stdin.close()
    active('review-uncommitted')
    sql('ALTER ROLE postgres NOSUPERUSER;')
    time.sleep(2.5)
    other=sql('CREATE TABLE public.review_uncommitted_gap(id int);',False)
    report['checks'].append({'name':'foreign_ddl_with_uncommitted_guard','exitCode':other.returncode,'stdout':other.stdout.strip(),'stderr':other.stderr.strip()})
    sql("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='review-uncommitted';")
    holder.wait(timeout=10)
    output=holder.stdout.read(); err=holder.stderr.read()
    report['checks'].append({'name':'uncommitted_guard_admission','accepted':'UNCOMMITTED_GUARD_ACCEPTED' in output,'managedBranchProven':'CURRENT_ROLE_SUPER=false' in output,'stdout':output.strip(),'stderr':err.strip()})
finally:
    inspect=run(['docker','inspect','-f','{{index .Config.Labels "letbuyy.review.owner"}}',NAME],check=False)
    if inspect.returncode==0 and inspect.stdout.strip()=='storefront-20261022':
        removed=run(['docker','rm','-f',NAME],check=False)
        report['cleanup']={'ownedContainerRemoved':removed.returncode==0}
    checks={item['name']:item for item in report['checks']}
    report['blockingFindings']=[name for name in ['role_change','event_trigger_disable','ordinary_ddl_after_disable','foreign_ddl_with_uncommitted_guard'] if checks.get(name,{}).get('exitCode')==0]
    if checks.get('uncommitted_guard_admission',{}).get('accepted'): report['blockingFindings'].append('uncommitted_guard_admission')
    report['status']='REVIEW_BLOCKED' if report['blockingFindings'] else 'REVIEW_REQUIRED'
    (OUT/'probe-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
sys.exit(1 if report['blockingFindings'] else 0)
