from pathlib import Path
import subprocess, time, json

OUT=Path('/private/tmp/letbuyy-storefront-managed-review-20261022')
NAME='letbuyy-storefront-supautils-review-20261022'
IMAGE='public.ecr.aws/supabase/postgres:17.6.1.156'
REPORT={'image':IMAGE,'scope':'Fresh synthetic PG17 cluster with image Supautils policy explicitly included, direct postgres login, no hosted mutations.','checks':[]}
def run(args, text=None, check=True):
    return subprocess.run(args,input=text,text=True,capture_output=True,check=check)
def command(role='postgres'):
    return ['docker','exec','-i',NAME,'psql','-h','/tmp','-X','-U',role,'-d','postgres','-qAt','-v','ON_ERROR_STOP=1']
def sql(s, role='postgres',check=True): return run(command(role),s,check)
def record(name,s,role='postgres'):
    r=sql(s,role,False)
    REPORT['checks'].append({'name':name,'exitCode':r.returncode,'stdout':r.stdout.strip(),'stderr':r.stderr.strip()})
    return r
def barrier(app):
    for _ in range(100):
        if sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='"+app+"' AND wait_event='PgSleep';",'supabase_admin').stdout.strip()=='1':return
        time.sleep(.1)
    raise RuntimeError('barrier failed: '+app)
def race(name,held,contenders):
    app='review-'+name
    p=subprocess.Popen(command(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    p.stdin.write("SET application_name='"+app+"'; BEGIN; "+held+" SELECT pg_sleep(30); ROLLBACK;\n");p.stdin.close()
    barrier(app)
    locks=sql("SELECT jsonb_agg(jsonb_build_object('type',locktype,'mode',mode,'relation',relation::regclass::text,'classid',classid,'objid',objid)) FROM pg_locks WHERE pid=(SELECT pid FROM pg_stat_activity WHERE application_name='"+app+"') AND granted;",'supabase_admin')
    REPORT['checks'].append({'name':name+'_held_locks','locks':json.loads(locks.stdout)})
    for label,stmt in contenders:
        record(name+'_'+label,"SET lock_timeout='500ms'; "+stmt)
    sql("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='"+app+"';",'supabase_admin')
    p.wait(timeout=10)
try:
    boot="initdb -D /tmp/review-pg -U supabase_admin -A trust >/tmp/review-init.log && echo \"include = '/etc/postgresql-custom/supautils.conf'\" >> /tmp/review-pg/postgresql.conf && exec postgres -D /tmp/review-pg -k /tmp -c listen_addresses='' -c session_preload_libraries=supautils -c supautils.superuser=supabase_admin -c max_prepared_transactions=2"
    run(['docker','run','-d','--pull','never','--name',NAME,'--network','none','--label','letbuyy.review.owner=storefront-20261022','--memory','512m','--cpus','1','--pids-limit','128','--user','postgres','--entrypoint','/bin/sh',IMAGE,'-c',boot])
    for _ in range(200):
        ready=sql('SELECT 1;','supabase_admin',False)
        if ready.returncode==0:break
        time.sleep(.1)
    else:raise RuntimeError('readiness: '+ready.stderr)
    sql("CREATE ROLE supabase_privileged_role NOLOGIN; CREATE ROLE postgres NOSUPERUSER CREATEROLE CREATEDB LOGIN REPLICATION BYPASSRLS; GRANT supabase_privileged_role TO postgres; GRANT ALL ON DATABASE postgres TO postgres; GRANT ALL ON SCHEMA public TO postgres; CREATE ROLE anon NOLOGIN; GRANT anon TO postgres WITH ADMIN TRUE;",'supabase_admin')
    record('direct_managed_login_and_settings',"SELECT jsonb_build_object('current_user',current_user,'session_user',session_user,'superuser',current_setting('is_superuser'),'can_set_admin',pg_has_role(current_user,'supabase_admin','SET'),'supautils_superuser',current_setting('supautils.superuser'),'privileged_role',current_setting('supautils.privileged_role')); ")
    record('provider_settings',"SELECT jsonb_agg(jsonb_build_object('name',name,'setting',setting) ORDER BY name) FROM pg_settings WHERE name IN('session_preload_libraries','supautils.privileged_role','supautils.privileged_role_allowed_configs','supautils.reserved_roles','supautils.reserved_memberships','supautils.superuser');",'supabase_admin')
    admission=(OUT/'admission-under-review.sql').read_text()
    record('managed_guard_install',admission)
    record('enable_always_as_managed_owner','ALTER EVENT TRIGGER managed_release_ddl_guard_v1 ENABLE ALWAYS; ALTER EVENT TRIGGER managed_release_ddl_guard_v1 ENABLE;')
    record('function_assign_to_admin','ALTER FUNCTION public.guard_managed_release_ddl_v1() OWNER TO supabase_admin;')
    record('event_assign_to_admin','ALTER EVENT TRIGGER managed_release_ddl_guard_v1 OWNER TO supabase_admin;')
    record('admin_role_switch','SET ROLE supabase_admin;')
    record('guard_current_owners',"SELECT jsonb_build_object('event_owner',e.evtowner::regrole,'function_owner',p.proowner::regrole) FROM pg_event_trigger e JOIN pg_proc p ON p.oid=e.evtfoid WHERE e.evtname='managed_release_ddl_guard_v1';")
    record('reserved_role_change','ALTER ROLE anon LOGIN;')
    record('ordinary_guard_can_be_disabled','ALTER EVENT TRIGGER managed_release_ddl_guard_v1 DISABLE;')
    sql('ALTER EVENT TRIGGER managed_release_ddl_guard_v1 ENABLE;','supabase_admin')
    p=subprocess.Popen(command(),stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    p.stdin.write("SET application_name='review-policy-lease'; SELECT pg_advisory_lock(hashtextextended('letbuyy:managed-schema-release:v1',0)); SELECT pg_sleep(30);\n");p.stdin.close();barrier('review-policy-lease')
    record('transferred_event_normal_ddl_during_lease','CREATE TABLE public.review_blocked(id int);')
    record('transferred_event_replica_bypass',"BEGIN; SET LOCAL session_replication_role='replica'; CREATE TABLE public.review_replica(id int); ROLLBACK;")
    record('event_triggers_setting_bypass','SET event_triggers=false;')
    sql('ALTER EVENT TRIGGER managed_release_ddl_guard_v1 ENABLE ALWAYS;','supabase_admin')
    record('always_event_replica_ddl_during_lease',"BEGIN; SET LOCAL session_replication_role='replica'; CREATE TABLE public.review_always(id int); ROLLBACK;")
    record('always_event_extension_during_lease','BEGIN; CREATE EXTENSION hstore WITH SCHEMA public; ROLLBACK;')
    record('always_event_publication_during_lease','BEGIN; CREATE PUBLICATION review_publication; ROLLBACK;')
    sql("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE application_name='review-policy-lease';",'supabase_admin');p.wait(timeout=10)
    sql("CREATE FUNCTION public.review_protected() RETURNS event_trigger LANGUAGE plpgsql AS 'BEGIN RETURN; END'; CREATE EVENT TRIGGER review_protected ON ddl_command_start EXECUTE FUNCTION public.review_protected();",'supabase_admin')
    for name,stmt in [('protected_event_disable','ALTER EVENT TRIGGER review_protected DISABLE;'),('protected_event_drop','DROP EVENT TRIGGER review_protected;'),('protected_function_replace',"CREATE OR REPLACE FUNCTION public.review_protected() RETURNS event_trigger LANGUAGE plpgsql AS 'BEGIN RETURN; END';"),('protected_function_owner','ALTER FUNCTION public.review_protected() OWNER TO postgres;'),('protected_event_owner','ALTER EVENT TRIGGER review_protected OWNER TO postgres;')]:record(name,stmt)
    record('create_owned_native_targets',"CREATE ROLE review_tenant NOLOGIN; CREATE ROLE review_member NOLOGIN; CREATE ROLE review_parent NOLOGIN; CREATE FUNCTION public.review_target() RETURNS int LANGUAGE sql AS 'SELECT 1';")
    for name,stmt in [('lock_catalog','BEGIN; LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE NOWAIT; ROLLBACK;'),('lock_roles_view','BEGIN; LOCK TABLE pg_catalog.pg_roles IN SHARE ROW EXCLUSIVE MODE NOWAIT; ROLLBACK;'),('lock_proc_row',"BEGIN; SELECT oid FROM pg_proc WHERE oid='public.review_target()'::regprocedure FOR SHARE; ROLLBACK;"),('lock_roles_row',"BEGIN; SELECT oid FROM pg_roles WHERE rolname='review_tenant' FOR SHARE; ROLLBACK;"),('empty_alter_role','ALTER ROLE review_tenant;')]:record(name,stmt)
    race('role_noop','ALTER ROLE review_tenant;', [('alter','ALTER ROLE review_tenant LOGIN;'),('grant','GRANT review_tenant TO review_member;')])
    sql('ALTER ROLE review_tenant NOLOGIN; REVOKE review_tenant FROM review_member;',check=False)
    race('role_comment','COMMENT ON ROLE review_tenant IS NULL;', [('alter','ALTER ROLE review_tenant LOGIN;'),('grant','GRANT review_tenant TO review_member;')])
    sql('ALTER ROLE review_tenant NOLOGIN; REVOKE review_tenant FROM review_member;',check=False)
    race('role_combined','ALTER ROLE review_tenant; COMMENT ON ROLE review_tenant IS NULL;', [('alter','ALTER ROLE review_tenant LOGIN;'),('grant_parent','GRANT review_tenant TO review_member;'),('grant_to_member','GRANT review_parent TO review_tenant;')])
    race('function_noop','ALTER FUNCTION public.review_target() SECURITY INVOKER;', [('alter','ALTER FUNCTION public.review_target() SECURITY DEFINER;'),('drop','DROP FUNCTION public.review_target();')])
    record('admin_transfer_event_back_to_managed','ALTER EVENT TRIGGER managed_release_ddl_guard_v1 OWNER TO postgres;','supabase_admin')
    sql("CREATE FUNCTION public.review_comment_event_fn() RETURNS event_trigger LANGUAGE plpgsql AS 'BEGIN RETURN; END'; CREATE EVENT TRIGGER review_comment_event ON ddl_command_start EXECUTE FUNCTION public.review_comment_event_fn();")
    race('event_comment','COMMENT ON EVENT TRIGGER review_comment_event IS NULL;', [('disable','ALTER EVENT TRIGGER review_comment_event DISABLE;'),('drop','DROP EVENT TRIGGER review_comment_event;')])
    REPORT['completed']=True
finally:
    owned=run(['docker','inspect','-f','{{index .Config.Labels "letbuyy.review.owner"}}',NAME],check=False)
    if owned.returncode==0 and owned.stdout.strip()=='storefront-20261022':
        result=run(['docker','rm','-f',NAME],check=False)
        REPORT['cleanup']={'ownedContainerRemoved':result.returncode==0}
    (OUT/'ownership-results.json').write_text(json.dumps(REPORT,indent=2)+'\n')
print(json.dumps(REPORT,indent=2))
