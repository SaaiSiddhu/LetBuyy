import { getPooledSql, type PooledSqlClient } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { tenantGucSetLocalStatement } from '@letbuyy/tenant-core';
import type { Env } from '../index';
import type { TenantContext, OwnedStoreScope } from './tenant-context';
import { ForbiddenError } from './errors';
import { parseLiquidThemePackageBundle } from '@letbuyy/theme-engine';
import { UuidSchema } from '@letbuyy/shared-types';

interface TransactionFrame { siteId:string; requestId:string; actorId?:string; busy:boolean; poisoned:boolean }
const tenantFrames = new WeakMap<PooledSqlClient,TransactionFrame>();
export class TenantPublicationContextError extends Error {
    constructor(){super('The tenant publication context could not be preserved');this.name='TenantPublicationContextError';}
}
function frameFor(tx:PooledSqlClient,scope:OwnedStoreScope):TransactionFrame {
    const frame=tenantFrames.get(tx);
    if(!frame||frame.poisoned||scope.siteId!==scope.storeId||scope.siteId!==scope.tenant.siteId
        ||frame.siteId!==scope.tenant.siteId||frame.requestId!==scope.tenant.requestId
        ||scope.customUser.id!==scope.tenant.userId||scope.authUser.id!==scope.customUser.id
        ||scope.authUser.storeId&&scope.authUser.storeId!==scope.siteId){if(frame)frame.poisoned=true;throw new TenantPublicationContextError();}
    return frame;
}
async function assertContext(tx:PooledSqlClient,scope:OwnedStoreScope,actorRequired=true){
    const frame=frameFor(tx,scope);
    const rows=await tx.unsafe(`SELECT current_user::text AS role,current_setting('app.site_id',true) AS site_id,
        current_setting('app.request_id',true) AS request_id,current_setting('app.actor_id',true) AS actor_id,
        current_setting('request.jwt.claim.sub',true) AS subject`);
    const row=rows[0];
    if(rows.length!==1||row.role!=='app_tenant'||row.site_id!==scope.siteId||row.request_id!==scope.tenant.requestId
        ||actorRequired&&(frame.actorId!==scope.customUser.id||row.actor_id!==scope.customUser.id||row.subject!==scope.authUser.id)){
        frame.poisoned=true;throw new TenantPublicationContextError();
    }
}
/** Bind only the canonical resolver's verified actor to its already active tenant transaction. */
export async function bindOwnedTenantActor(tx:PooledSqlClient,scope:OwnedStoreScope):Promise<void>{
    const frame=frameFor(tx,scope);try{await assertContext(tx,scope,false);
    if(frame.actorId&&frame.actorId!==scope.customUser.id){frame.poisoned=true;throw new TenantPublicationContextError();}
    await tx.unsafe('SELECT set_config($1,$2,true),set_config($3,$4,true)',
        ['app.actor_id',scope.customUser.id,'request.jwt.claim.sub',scope.authUser.id]);
    frame.actorId=scope.customUser.id;await assertContext(tx,scope);
    }catch(error){frame.poisoned=true;throw error;}
}

const publisherSignature='public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)';
async function publisherProfile(tx:PooledSqlClient){
    const rows=await tx.unsafe(`SELECT jsonb_build_object('row',to_jsonb(p),'defaults',pg_get_expr(p.proargdefaults,0),
        'owner_matches',p.proowner=(SELECT relowner FROM pg_class WHERE oid='public.theme_instances'::regclass),
        'owner_bypass',(SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE oid=p.proowner),
        'body_md5',md5(p.prosrc),'plpgsql',p.prolang=(SELECT oid FROM pg_language WHERE lanname='plpgsql'),
        'abi_valid',p.prorettype='record'::regtype AND p.provariadic=0 AND p.prosupport=0 AND p.probin IS NULL AND p.prosqlbody IS NULL AND p.protrftypes IS NULL
          AND p.proallargtypes=ARRAY['uuid'::regtype::oid,'text'::regtype::oid,'jsonb'::regtype::oid,'uuid'::regtype::oid,'integer'::regtype::oid,'uuid'::regtype::oid,'text'::regtype::oid,'boolean'::regtype::oid,'text'::regtype::oid,'uuid'::regtype::oid,'uuid'::regtype::oid,'integer'::regtype::oid,'timestamptz'::regtype::oid]::oid[]
          AND p.proargmodes=ARRAY['i','i','i','i','i','i','i','i','i','i','t','t','t']::"char"[],
        'allowed_acl',NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
          WHERE a.grantor<>p.proowner OR a.privilege_type<>'EXECUTE' OR a.grantee NOT IN(p.proowner,'service_role'::regrole)
             OR(a.grantee<>p.proowner AND a.is_grantable)),
        'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE'),
        'tenant_execute',has_function_privilege('app_tenant',p.oid,'EXECUTE'),
        'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
        'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
        'shadows',EXISTS(SELECT 1 FROM pg_class c WHERE c.relnamespace=pg_my_temp_schema()
          AND c.relname=ANY(ARRAY['sites','themes','theme_instances','theme_package_versions','theme_releases','store_themes','storefront_cache_tags','outbox_events','audit_activity_events'])),
        'dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_depend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid),
        'shared_dependencies',(SELECT coalesce(jsonb_agg(to_jsonb(d) ORDER BY to_jsonb(d)::text),'[]') FROM pg_shdepend d WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.dbid=(SELECT oid FROM pg_database WHERE datname=current_database())),
        'comment',obj_description(p.oid,'pg_proc')) AS profile FROM pg_proc p WHERE p.oid=$1::regprocedure`,[publisherSignature]);
    const profile=rows[0]?.profile as Record<string,unknown>|undefined;
    const row=profile?.row as Record<string,unknown>|undefined;
    if(rows.length!==1||!profile||!row||profile.body_md5!=='56a6b7b15e8a7ec159341fe0331ac593'||!profile.owner_matches||!profile.owner_bypass||!profile.plpgsql
        ||profile.abi_valid!==true||!profile.allowed_acl||!profile.service_execute||profile.tenant_execute!==false||profile.anon_execute!==false||profile.authenticated_execute!==false||profile.shadows!==false
        ||row.prosecdef!==true||row.prokind!=='f'||row.pronargs!==10||row.pronargdefaults!==7||row.proretset!==true
        ||row.provolatile!=='v'||row.proparallel!=='u'||row.proisstrict!==false||row.proleakproof!==false||row.procost!==100||row.prorows!==1000
        ||JSON.stringify(row.proconfig)!==JSON.stringify(['search_path=public'])
        ||profile.defaults!=='NULL::uuid, NULL::integer, NULL::uuid, NULL::text, true, NULL::text, NULL::uuid'
        ||JSON.stringify(row.proargnames)!==JSON.stringify(['p_store_id','p_theme_id','p_release_config','p_source_draft_id','p_source_draft_version','p_published_by','p_publish_message','p_make_store_live','p_request_id','p_rollback_of_release_id','release_id','release_version','published_at']))throw new TenantPublicationContextError();
    return profile;
}

/** Fixed catalogue selector for an already resolved owner. Callers cannot supply SQL or a role. */
export async function readThemeUpdateTargetInTenantTx(tx:PooledSqlClient,scope:OwnedStoreScope,packageVersionId:string,lock=false):Promise<Record<string,unknown>[]>{
    const frame=frameFor(tx,scope);
    if(frame.busy){frame.poisoned=true;throw new TenantPublicationContextError();}
    frame.busy=true;
    try{
        await assertContext(tx,scope);
        if(!UuidSchema.safeParse(packageVersionId).success||typeof lock!=='boolean')throw new TenantPublicationContextError();
        const owner=await tx.unsafe(`SELECT id FROM public.sites WHERE id=$1::uuid AND deleted_at IS NULL
            AND(custom_user_id=$2::uuid OR user_id=$2::uuid) FOR SHARE`,[scope.siteId,scope.customUser.id]);
        if(owner.length!==1)throw new ForbiddenError('Your access to this store changed');
        const before=await publisherProfile(tx);
        await tx.unsafe('SAVEPOINT tenant_theme_catalog_read');
        let rows:Record<string,unknown>[];
        try{
            await tx.unsafe('SET LOCAL ROLE service_role');
            rows=await tx.unsafe(`SELECT to_jsonb(v) AS version,to_jsonb(p) AS package,to_jsonb(t) AS catalog
                FROM public.theme_package_versions v JOIN public.theme_packages p ON p.id=v.theme_package_id
                JOIN public.themes t ON t.id=p.legacy_theme_id WHERE v.id=$1::uuid
                AND v.release_status='published' AND v.deleted_at IS NULL${lock?' FOR SHARE OF v,p,t':''}`,[packageVersionId]);
            if(rows.length>1)throw new TenantPublicationContextError();
            if(rows.length){
                const catalog=rows[0].catalog;
                if(!catalog||typeof catalog!=='object'||Array.isArray(catalog))throw new TenantPublicationContextError();
                const record=catalog as Record<string,unknown>;
                if(record.is_site_private===true&&record.owned_by_site_id!==scope.siteId
                    ||record.owned_by_site_id!=null&&record.owned_by_site_id!==scope.siteId)throw new ForbiddenError('This theme is not available to this store');
            }
            await tx.unsafe('SET LOCAL ROLE app_tenant');
        }catch(error){
            await tx.unsafe('ROLLBACK TO SAVEPOINT tenant_theme_catalog_read');
            await tx.unsafe('SET LOCAL ROLE app_tenant');
            await assertContext(tx,scope);throw error;
        }
        await assertContext(tx,scope);
        if(JSON.stringify(await publisherProfile(tx))!==JSON.stringify(before))throw new TenantPublicationContextError();
        await tx.unsafe('RELEASE SAVEPOINT tenant_theme_catalog_read');
        return rows;
    }catch(error){frame.poisoned=true;throw error;}finally{frame.busy=false;}
}

/** Fixed existing publisher only. No SQL/role/function/callback supplied by callers. */
export async function publishThemeReleaseInTenantTx(tx:PooledSqlClient,scope:OwnedStoreScope,intent:{
    themeSlug:string;releaseConfig:Record<string,unknown>;targetPackageVersionId:string;priorReleaseId:string;requestHash:string;
    makeStoreLive:boolean;publishMessage?:string|null;
}):Promise<{release_id:string;release_version:number;published_at:string|Date}>{
    const frame=frameFor(tx,scope);if(frame.busy){frame.poisoned=true;throw new TenantPublicationContextError();}
    frame.busy=true;
    try{
    await assertContext(tx,scope);
    const owner=await tx.unsafe(`SELECT id FROM public.sites WHERE id=$1::uuid AND deleted_at IS NULL
        AND(custom_user_id=$2::uuid OR user_id=$2::uuid) FOR UPDATE`,[scope.siteId,scope.customUser.id]);
    if(owner.length!==1)throw new ForbiddenError('Your access to this store changed');
    const bundle=parseLiquidThemePackageBundle(intent.releaseConfig.liquidBundle);
    if(bundle.package.slug!==intent.themeSlug||!UuidSchema.safeParse(intent.targetPackageVersionId).success||!UuidSchema.safeParse(intent.priorReleaseId).success
        ||!/^[a-f0-9]{64}$/.test(intent.requestHash))throw new TenantPublicationContextError();
    const selectedSql=`SELECT i.id FROM public.theme_instances i JOIN public.theme_package_versions v ON v.id=i.theme_package_version_id
        JOIN public.theme_packages p ON p.id=i.theme_package_id JOIN public.themes t ON t.id=p.legacy_theme_id
        WHERE i.store_id=$1::uuid AND i.theme_slug=$2 AND i.deleted_at IS NULL
        AND v.id=$3::uuid AND v.theme_package_id=p.id AND v.version=$4 AND v.version_number=$5::integer
        AND v.schema_version=$6 AND v.renderer_version=$7 AND v.release_status='published' AND v.deleted_at IS NULL
        AND p.slug=$2 AND p.status='active' AND p.deleted_at IS NULL AND t.slug=$2 AND t.is_active
        AND(NOT coalesce(t.is_site_private,false) OR t.owned_by_site_id=$1::uuid)
        AND(t.owned_by_site_id IS NULL OR t.owned_by_site_id=$1::uuid)`;
    const selectedParams=[scope.siteId,intent.themeSlug,intent.targetPackageVersionId,bundle.package.version,bundle.package.version_number,bundle.schema_version,bundle.renderer.renderer_version];
    // The tenant can lock its own instance without reading global capture tables.
    const selected=await tx.unsafe(`SELECT i.id FROM public.theme_instances i
        WHERE i.store_id=$1::uuid AND i.theme_slug=$2 AND i.theme_package_version_id=$3::uuid
        AND i.deleted_at IS NULL FOR SHARE OF i`,[scope.siteId,intent.themeSlug,intent.targetPackageVersionId]);
    if(selected.length!==1)throw new TenantPublicationContextError();
    const priorSql=`SELECT r.theme_package_version_id AS prior_package_version_id FROM public.theme_releases r
        JOIN public.sites s ON s.current_theme_release_id=r.id AND s.id=r.store_id
        WHERE r.store_id=$1::uuid AND r.theme_id=$2 AND r.id=$3::uuid AND r.is_current AND r.deleted_at IS NULL`;
    const priorParams=[scope.siteId,intent.themeSlug,intent.priorReleaseId];
    const before=await publisherProfile(tx);
    let priorPackageVersionId:string|undefined;
        await tx.unsafe('SAVEPOINT tenant_theme_publication');
        let result;
        try{
            await tx.unsafe('SET LOCAL ROLE service_role');
            // Retain global row locks and recheck availability inside the existing
            // fixed capability, after its actor/context/profile checks succeed.
            const lockedSelection=await tx.unsafe(`${selectedSql} FOR SHARE OF v,p,t`,selectedParams);
            const lockedPrior=await tx.unsafe(`${priorSql} FOR SHARE OF r`,priorParams);
            if(lockedSelection.length!==1||lockedSelection[0].id!==selected[0].id
                ||lockedPrior.length!==1||!UuidSchema.safeParse(lockedPrior[0].prior_package_version_id).success)throw new TenantPublicationContextError();
            priorPackageVersionId=lockedPrior[0].prior_package_version_id as string;
            result=await tx.unsafe(`SELECT * FROM public.publish_theme_release($1::uuid,$2,$3::text::jsonb,NULL::uuid,NULL::integer,
                $4::uuid,$5,$6::boolean,$7,NULL::uuid)`,[scope.siteId,intent.themeSlug,JSON.stringify(intent.releaseConfig),scope.customUser.id,
                intent.publishMessage||null,intent.makeStoreLive,scope.tenant.requestId]);
            await tx.unsafe('SET LOCAL ROLE app_tenant');
        }catch(error){
            // A SQL error aborts the statement context: rollback first, then verify restoration.
            await tx.unsafe('ROLLBACK TO SAVEPOINT tenant_theme_publication');
            await tx.unsafe('SET LOCAL ROLE app_tenant');
            await assertContext(tx,scope);throw error;
        }
        await assertContext(tx,scope);
        if(JSON.stringify(await publisherProfile(tx))!==JSON.stringify(before))throw new TenantPublicationContextError();
        const row=result[0];
        if(result.length!==1||typeof row.release_id!=='string'||typeof row.release_version!=='number'||!Number.isSafeInteger(row.release_version)
            ||!(typeof row.published_at==='string'||row.published_at instanceof Date))throw new TenantPublicationContextError();
        const audit=await tx.unsafe(`INSERT INTO public.audit_activity_events(store_id,actor_id,actor_type,action,resource_type,resource_id,request_id,metadata)
            VALUES($1::uuid,$2::uuid,'user','theme.publish.capability_used','theme_release',$3,$4,
                jsonb_build_object('reason','theme.version_update.publish','target_package_version_id',$5::text,'prior_release_id',$6::text,'request_hash',$7::text,'prior_package_version_id',$8::text)) RETURNING id`,
            [scope.siteId,scope.customUser.id,row.release_id,scope.tenant.requestId,intent.targetPackageVersionId,intent.priorReleaseId,intent.requestHash,priorPackageVersionId]);
        if(audit.length!==1)throw new TenantPublicationContextError();
        await assertContext(tx,scope);await tx.unsafe('RELEASE SAVEPOINT tenant_theme_publication');
        return {release_id:row.release_id,release_version:row.release_version,published_at:row.published_at};
    }catch(error){frame.poisoned=true;throw error;}finally{frame.busy=false;}
}

export type TenantTxCallback<T> = (sql: PooledSqlClient) => Promise<T>;

export class TenantTransactionUnavailableError extends Error {
    constructor() {
        super('Tenant transaction requires a pooled SQL connection; refusing to fake SET LOCAL app.site_id over Supabase REST');
        this.name = 'TenantTransactionUnavailableError';
    }
}

export async function withTenantTx<T>(
    env: Env,
    tenant: Pick<TenantContext, 'siteId' | 'requestId'>,
    callback: TenantTxCallback<T>,
): Promise<T> {
    const sql = getPooledSql(env, {
        purpose: 'tenant-transaction',
        maxConnections: 3,
        idleTimeoutSeconds: 10,
        connectTimeoutSeconds: 5,
    });
    if (!sql) throw new TenantTransactionUnavailableError();

    const statement = tenantGucSetLocalStatement(tenant.siteId);
    const result = await sql.begin(async (tx) => {
        await tx.unsafe('SET LOCAL ROLE app_tenant');
        await tx.unsafe(statement.sql, [...statement.values]);
        await tx.unsafe('SELECT set_config($1, $2, true)', ['app.request_id', tenant.requestId]);
        const client=tx as unknown as PooledSqlClient;
        const frame:TransactionFrame={siteId:tenant.siteId,requestId:tenant.requestId,busy:false,poisoned:false};
        tenantFrames.set(client,frame);
        try{const value=await callback(client);if(frame.poisoned)throw new TenantPublicationContextError();return value;}
        finally{tenantFrames.delete(client);}
    });
    return result as T;
}
