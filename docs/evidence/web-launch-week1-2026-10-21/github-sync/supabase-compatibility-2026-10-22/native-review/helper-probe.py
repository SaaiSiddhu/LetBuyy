from pathlib import Path
import subprocess,time,json,hashlib,re

OUT=Path(__file__).resolve().parent
NAME='letbuyy-storefront-native-fence-review-20261022'
IMAGE='public.ecr.aws/supabase/postgres:17.6.1.127'
REPORT={'image':IMAGE,'scope':'Independent native helper mechanism test on a frozen source copy, synthetic provider-image cluster, direct managed postgres login. Administrator used only for synthetic provisioning/retirement, never hosted access.','checks':[]}
def run(args,s=None,check=True):return subprocess.run(args,input=s,text=True,capture_output=True,check=check)
def args(role='postgres',db='postgres'):return ['docker','exec','-i',NAME,'psql','-h','/tmp','-X','-U',role,'-d',db,'-qAt','-v','ON_ERROR_STOP=1']
def sql(s,role='postgres',check=True,db='postgres'):return run(args(role,db),s,check)
def record(name,s,role='postgres',success=None,db='postgres',reason=None):
    r=sql(s,role,False,db)
    entry={'name':name,'exitCode':r.returncode,'stdout':r.stdout.strip(),'stderr':r.stderr.strip()}
    if success is not None:entry['asExpected']=(r.returncode==0)==success
    if reason is not None:entry['asExpected']=entry.get('asExpected',True) and reason in r.stderr
    REPORT['checks'].append(entry);return r
def wait(app):
    for _ in range(100):
        if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='"+app+"' AND wait_event='PgSleep';",'supabase_admin').stdout.strip()=='1':return
        time.sleep(.1)
    raise RuntimeError('barrier missing '+app)
def hold(app,s,role='postgres'):
    p=subprocess.Popen(args(role),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    p.stdin.write("SET application_name='"+app+"'; BEGIN; "+s+" SELECT pg_sleep(30); ROLLBACK;\n");p.stdin.close();wait(app);return p
def release(app,p):
    sql("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='"+app+"';",'supabase_admin');p.wait(timeout=10)

bootstrap=(OUT/'provider-admin-catalog-fence.sql').read_text()
retire=(OUT/'provider-admin-catalog-fence.rollback.sql').read_text()
REPORT['bootstrapFileSha256']=hashlib.sha256(bootstrap.encode()).hexdigest()
try:
    boot="initdb -D /tmp/review-pg -U supabase_admin -A trust >/tmp/review-init.log && echo \"include = '/etc/postgresql-custom/supautils.conf'\" >> /tmp/review-pg/postgresql.conf && exec postgres -D /tmp/review-pg -k /tmp -c listen_addresses='' -c session_preload_libraries=supautils -c supautils.superuser=supabase_admin -c max_prepared_transactions=2"
    run(['docker','run','-d','--pull','never','--name',NAME,'--network','none','--label','letbuyy.review.owner=storefront-20261022','--memory','512m','--cpus','1','--pids-limit','128','--user','postgres','--entrypoint','/bin/sh',IMAGE,'-c',boot])
    for _ in range(200):
        ready=sql('SELECT 1;','supabase_admin',False)
        if ready.returncode==0:break
        time.sleep(.1)
    else:raise RuntimeError('readiness '+ready.stderr)
    sql("CREATE ROLE supabase_privileged_role NOLOGIN; CREATE ROLE postgres NOSUPERUSER CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS; GRANT supabase_privileged_role TO postgres; ALTER DATABASE postgres OWNER TO postgres; ALTER SCHEMA public OWNER TO postgres; CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS; CREATE ROLE app_tenant NOLOGIN; GRANT anon,authenticated,service_role,app_tenant TO postgres WITH ADMIN TRUE;",'supabase_admin')
    sql("CREATE ROLE review_parent NOLOGIN; CREATE TABLE public.review_target(id int); CREATE FUNCTION public.review_target() RETURNS int LANGUAGE sql AS 'SELECT 1'; CREATE FUNCTION public.review_event_fn() RETURNS event_trigger LANGUAGE plpgsql AS 'BEGIN RETURN; END'; CREATE EVENT TRIGGER review_event ON ddl_command_start EXECUTE FUNCTION public.review_event_fn();")
    record('direct_managed_login',"SELECT current_user,session_user,current_setting('is_superuser'),pg_has_role(current_user,'supabase_admin','SET');",success=True)
    record('unassisted_native_catalog_lock_refused','BEGIN; LOCK TABLE pg_catalog.pg_auth_members IN SHARE ROW EXCLUSIVE MODE NOWAIT; ROLLBACK;',success=False)
    record('managed_installer_refused',bootstrap,success=False)
    record('provider_installer_positive_control',bootstrap,'supabase_admin',True)
    record('second_installer_refuses_existing_schema',bootstrap,'supabase_admin',False)
    record('owner_profile',"SELECT jsonb_build_object('schema',n.nspowner::regrole,'function',p.proowner::regrole,'definer',p.prosecdef,'body_sha256',encode(sha256(convert_to(p.prosrc,'UTF8')),'hex')) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.oid='letbuyy_maintenance.lock_catalogs_v1()'::regprocedure;",success=True)
    for role in ['anon','authenticated','service_role','app_tenant']:
        record('application_role_denied_'+role,'SET ROLE '+role+'; SELECT letbuyy_maintenance.lock_catalogs_v1();',success=False)
    record('helper_function_replacement_denied',"CREATE OR REPLACE FUNCTION letbuyy_maintenance.lock_catalogs_v1() RETURNS void LANGUAGE plpgsql AS 'BEGIN RETURN; END';",success=False,reason='permission denied for schema letbuyy_maintenance')
    record('helper_drop_denied','DROP FUNCTION letbuyy_maintenance.lock_catalogs_v1();',success=False)
    record('helper_overload_denied',"CREATE FUNCTION letbuyy_maintenance.lock_catalogs_v1(int) RETURNS int LANGUAGE sql AS 'SELECT 1';",success=False)
    record('caller_identity_and_locks_in_same_backend',"BEGIN; SELECT letbuyy_maintenance.lock_catalogs_v1(); SELECT current_user,session_user,current_setting('is_superuser'); SELECT count(*) FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='relation' AND mode='ShareRowExclusiveLock' AND granted; COMMIT; SELECT count(*) FROM pg_locks WHERE pid=pg_backend_pid() AND locktype='relation' AND mode='ShareRowExclusiveLock' AND granted;",success=True)
    fences=[]
    for source in sorted(OUT.glob('[0-9]*.sql')):
        found=re.search(r'DO \$managed_catalog_fence\$.*?END \$managed_catalog_fence\$;',source.read_text(),re.S)
        if found:fences.append((source.name,found.group(0)))
    REPORT['frozenFenceCount']=len(fences)
    for name,fence in fences:record('wrapper_'+name,'BEGIN; '+fence+' ROLLBACK;',success=True)
    p=hold('review-native-held','SELECT letbuyy_maintenance.lock_catalogs_v1();')
    lockproof=sql("SELECT jsonb_agg(jsonb_build_object('relation',relation::regclass::text,'mode',mode,'database',database) ORDER BY relation::regclass::text) FROM pg_locks WHERE pid=(SELECT pid FROM pg_stat_activity WHERE application_name='review-native-held') AND locktype='relation' AND mode='ShareRowExclusiveLock' AND granted;")
    REPORT['heldNativeLocks']=json.loads(lockproof.stdout)
    for name,stmt in [
        ('role_attributes','ALTER ROLE app_tenant LOGIN;'),
        ('critical_member_grant','GRANT review_parent TO app_tenant;'),
        ('role_creation','CREATE ROLE review_new_role;'),
        ('function_creation',"CREATE FUNCTION public.review_foreign() RETURNS int LANGUAGE sql AS 'SELECT 1';"),
        ('function_replacement','ALTER FUNCTION public.review_target() SECURITY DEFINER;'),
        ('table_creation','CREATE TABLE public.review_foreign(id int);'),
        ('event_disable','ALTER EVENT TRIGGER review_event DISABLE;'),
        ('event_drop','DROP EVENT TRIGGER review_event;'),
        ('extension_creation','CREATE EXTENSION hstore WITH SCHEMA public;'),
        ('publication_creation','CREATE PUBLICATION review_publication;'),
        ('replica_ddl',"SET session_replication_role='replica'; CREATE TABLE public.review_replica(id int);"),
        ('table_acl','GRANT SELECT ON public.review_target TO anon;'),
        ('default_acl','ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO anon;')]:
        record('foreign_'+name,"SET lock_timeout='400ms'; "+stmt,success=False,reason='lock timeout')
    record('cross_database_role_change',"SET lock_timeout='400ms'; ALTER ROLE app_tenant LOGIN;",success=False,db='template1',reason='lock timeout')
    release('review-native-held',p)
    record('unrelated_ddl_after_release','CREATE TABLE public.review_after(id int); DROP TABLE public.review_after;',success=True)
    p=hold('review-existing-ddl',"CREATE FUNCTION public.review_prior() RETURNS int LANGUAGE sql AS 'SELECT 1';")
    record('completed_uncommitted_ddl_does_not_guarantee_relation_lock','SELECT letbuyy_maintenance.lock_catalogs_v1();',success=True)
    maintenance=re.search(r'DO \$maintenance\$.*?END \$maintenance\$;',(OUT/'360_subscription_tax_quote_snapshot.sql').read_text(),re.S).group(0)
    record('full360_assigned_xid_preflight_refuses_prior_ddl','BEGIN; '+maintenance+' ROLLBACK;',success=False,reason='foreign assigned or prepared transactions')
    release('review-existing-ddl',p)
    p=hold('review-native-contention','LOCK TABLE pg_catalog.pg_proc IN ROW EXCLUSIVE MODE;','supabase_admin')
    record('helper_nowait_refuses_existing_conflicting_native_lock','SELECT letbuyy_maintenance.lock_catalogs_v1();',success=False,reason='could not obtain lock')
    release('review-native-contention',p)
    record('helper_succeeds_after_foreign_rollback','BEGIN; SELECT letbuyy_maintenance.lock_catalogs_v1(); ROLLBACK;',success=True)
    record('managed_retirement_refused',retire,success=False)
    record('provider_retirement_positive_control',retire,'supabase_admin',True)
    record('helper_absent_after_retirement',"SELECT to_regnamespace('letbuyy_maintenance') IS NULL;",success=True)
    REPORT['completed']=True
    REPORT['allChecksAsExpected']=all(c.get('asExpected',True) for c in REPORT['checks']) and len(REPORT['heldNativeLocks'])==31 and len(fences)==34
    REPORT['frozenSources']=[{'file':x.name,'sha256':hashlib.sha256(x.read_bytes()).hexdigest()} for x in sorted(OUT.glob('*.sql'))]
finally:
    owned=run(['docker','inspect','-f','{{index .Config.Labels "letbuyy.review.owner"}}',NAME],check=False)
    if owned.returncode==0 and owned.stdout.strip()=='storefront-20261022':REPORT['cleanup']={'ownedContainerRemoved':run(['docker','rm','-f',NAME],check=False).returncode==0}
    (OUT/'helper-results.json').write_text(json.dumps(REPORT,indent=2)+'\n')
print(json.dumps(REPORT,indent=2))
