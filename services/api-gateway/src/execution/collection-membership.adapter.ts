import {CollectionSummarySchema,CollectionListPageSchema,UuidSchema,type CollectionListPage} from '@letbuyy/shared-types';
import type { Env } from '../index';
import type { OwnedStoreScope } from '../lib/tenant-context';
import { verifySiteOwnership } from '../lib/auth-user';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';
import { withTenantTx, TenantTransactionUnavailableError } from '../lib/tenant-transaction';
import { CollectionMembershipSnapshotSchema, type CollectionMembershipSnapshot } from '@letbuyy/shared-types';
import { ReplaceCollectionMembershipSchema, CollectionListPaginationSchema, type CollectionListPagination, type ReplaceCollectionMembershipInput } from '@letbuyy/commerce-core';

function failure(error: unknown): never {
    if (error instanceof AppError) throw error;
    if (error instanceof TenantTransactionUnavailableError) throw new AppError('Collection saving is temporarily unavailable. Keep this save and retry.', 503, 'COLLECTION_MEMBERSHIP_UNAVAILABLE');
    const code = (error as {code?: string})?.code, message = error instanceof Error ? error.message : '';
    if (message.includes('COLLECTION_MEMBERSHIP_FORBIDDEN') || code === '42501') throw new ForbiddenError('Your access to this store changed.');
    if (message.includes('COLLECTION_MEMBERSHIP_NOT_FOUND')) throw new NotFoundError('Collection not found');
    if (message.includes('COLLECTION_MEMBERSHIP_VERSION_CONFLICT') || code === '40P01' || code === '40001') throw new AppError('Collection membership changed. Your selection is kept; reload the current collection.', 409, 'COLLECTION_MEMBERSHIP_VERSION_CONFLICT');
    if (message.includes('COLLECTION_MEMBERSHIP_LEGACY_KEY')) throw new AppError('This key belongs to an older collection save. Reload the current collection before starting another save.', 409, 'COLLECTION_MEMBERSHIP_LEGACY_KEY');
    if (message.includes('COLLECTION_MEMBERSHIP_KEY_CONFLICT')) throw new AppError('This key belongs to a different collection save. Recover the original save.', 409, 'COLLECTION_MEMBERSHIP_KEY_CONFLICT');
    if (message.includes('COLLECTION_MEMBERSHIP_INVALID') || code === '23503' || code === '23514' || code?.startsWith('22')) throw new ValidationError('Every selected product must be valid and belong to this store. Review your selection.');
    throw new AppError('Collection products could not be confirmed. Retry this request.', 500, 'COLLECTION_MEMBERSHIP_FAILED');
}
export async function readCollectionMembership(scope: OwnedStoreScope, collectionId: string): Promise<CollectionMembershipSnapshot> {
    try {
        // ResolveOwnedStoreScope already verified the selected current owner.
        // Bracket junction/products with the monotonic parent revision. A
        // change (including ABA) across these reads is an explicit conflict.
        const {data: collection, error} = await scope.db.from('collections')
            .select('id, store_id, membership_version').eq('store_id', scope.siteId).eq('id', collectionId).is('deleted_at', null).maybeSingle();
        if (error) throw error;
        if (!collection) throw new NotFoundError('Collection not found');
        const {data: assignments, error: assignedError} = await scope.db.from('collection_products')
            .select('product_id, position, id').eq('collection_id', collectionId).order('position', {ascending: true}).order('id', {ascending: true});
        if (assignedError) throw assignedError;
        const ids = (assignments || []).map(row => row.product_id as string);
        let products: unknown[] = [], unavailableProductIds: string[] = [];
        if (ids.length) {
            const {data, error: productError} = await scope.db.from('products')
                .select('id, name, price, is_active, thumbnail_url').eq('store_id', scope.siteId).in('id', ids).is('deleted_at', null);
            if (productError) throw productError;
            const byId = new Map((data || []).map(row => [row.id, row]));
            unavailableProductIds = ids.filter(id => !byId.has(id));
            products = ids.filter(id => byId.has(id)).map(id => byId.get(id));
        }
        // A live ownership change during the private read never returns the
        // old owner's response. The SQL command repeats this fence under locks.
        if (!await verifySiteOwnership(scope.db, scope.siteId, scope.customUser.id, scope.authUser.storeId)) throw new ForbiddenError('Your access to this store changed.');
        const {data: confirmed, error: confirmError} = await scope.db.from('collections')
            .select('id, store_id, membership_version').eq('store_id', scope.siteId).eq('id', collectionId).is('deleted_at', null).maybeSingle();
        if (confirmError) throw confirmError;
        if (!confirmed || confirmed.membership_version !== collection.membership_version) {
            throw new AppError('Collection membership changed while loading. Retry to read the current collection.', 409, 'COLLECTION_MEMBERSHIP_READ_CONFLICT');
        }
        return CollectionMembershipSnapshotSchema.parse({collection_id: collectionId, store_id: scope.siteId,
            membership_version: collection.membership_version, product_ids: ids, products, unavailable_product_ids: unavailableProductIds});
    } catch (error) { return failure(error); }
}
export async function replaceCollectionMembership(env: Env, scope: OwnedStoreScope, collectionId: string, body: unknown): Promise<CollectionMembershipSnapshot> {
    let input: ReplaceCollectionMembershipInput;
    try { input = ReplaceCollectionMembershipSchema.parse(body); }
    catch { throw new ValidationError('An explicit product list, current membership version and save key are required.'); }
    try {
        const result = await withTenantTx(env, scope.tenant, async sql => {
            await sql.unsafe('SELECT set_config($1,$2,true)', ['app.actor_id', scope.customUser.id]);
            const rows = await sql.unsafe('SELECT public.apply_collection_membership_v1($1::uuid,$2::uuid,$3::uuid,$4::integer,$5::uuid,$6::text::jsonb) AS membership',
                [scope.siteId, collectionId, scope.customUser.id, input.expected_version, input.idempotency_key, JSON.stringify(input.product_ids)]);
            return rows[0]?.membership;
        });
        return CollectionMembershipSnapshotSchema.parse(result);
    } catch (error) { return failure(error); }
}

// Closed read operation: no transaction, callback, SQL, role or ID batch crosses this boundary.
export async function readOwnedCollectionList(env: Env, scope: OwnedStoreScope, intent: CollectionListPagination): Promise<CollectionListPage> {
    const page = CollectionListPaginationSchema.parse(intent);
    const expected = {site:scope.siteId,actor:scope.customUser.id,request:scope.tenant.requestId};
    if (!UuidSchema.safeParse(expected.site).success || !UuidSchema.safeParse(expected.actor).success ||
        scope.storeId!==expected.site || scope.tenant.siteId!==expected.site || scope.tenant.userId!==expected.actor ||
        scope.authUser.id!==expected.actor || scope.authUser.storeId && scope.authUser.storeId!==expected.site) {
        throw new ForbiddenError('Not authorized for this store');
    }
    const started = Date.now();
    try {
        const result = await withTenantTx(env, scope.tenant, async tx => {
            await tx.unsafe('SELECT set_config($1,$2,true),set_config($3,$4,true)',
                ['app.actor_id',expected.actor,'request.jwt.claim.sub',expected.actor]);
            // These closures and the raw client are private to this single awaited operation.
            const context = async (role:'app_tenant'|'service_role', baseline?: Record<string, unknown>) => {
                const rows=await tx.unsafe(`/* collection-list:context */ SELECT current_user::text AS role,
                    current_setting('role',true) AS selected_role,session_user::text AS session_user,pg_backend_pid() AS backend,
                    current_setting('app.site_id',true) AS site,current_setting('app.request_id',true) AS request,
                    current_setting('app.actor_id',true) AS actor,current_setting('request.jwt.claim.sub',true) AS subject`);
                const row=rows[0];
                if(rows.length!==1 || row.role!==role || row.selected_role!==role || row.site!==expected.site ||
                    row.request!==expected.request || row.actor!==expected.actor || row.subject!==expected.actor ||
                    !Number.isSafeInteger(row.backend) || typeof row.session_user!=='string' ||
                    baseline && (row.backend!==baseline.backend || row.session_user!==baseline.session_user)) throw new Error('Collection read context unavailable');
                return row as Record<string,unknown>;
            };
            const baseline=await context('app_tenant');
            const owners=await tx.unsafe(`/* collection-list:owner */ SELECT id FROM public.sites WHERE id=$1::uuid
                AND deleted_at IS NULL AND(custom_user_id=$2::uuid OR user_id=$2::uuid) FOR SHARE`,[expected.site,expected.actor]);
            if(owners.length!==1 || owners[0].id!==expected.site) throw new ForbiddenError('Your access to this store changed.');
            const rows=await tx.unsafe(`/* collection-list:parents */ WITH parent_page AS MATERIALIZED (
                SELECT c.id,c.store_id,c.title,c.description,c.image_url,c.created_at,c.is_active,c.membership_version
                FROM public.collections c WHERE c.store_id=$1::uuid AND c.deleted_at IS NULL
                ORDER BY c.created_at DESC,c.id DESC LIMIT $2::integer OFFSET $3::integer FOR SHARE),
                parent_total AS (SELECT count(*)::integer AS total FROM public.collections WHERE store_id=$1::uuid AND deleted_at IS NULL)
                SELECT (SELECT total FROM parent_total) AS total,
                coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC,p.id DESC) FROM parent_page p),'[]'::jsonb) AS items`,
                [expected.site,page.limit,(page.page-1)*page.limit]);
            if(rows.length!==1 || !Number.isSafeInteger(rows[0].total) || rows[0].total<0 || !Array.isArray(rows[0].items)) throw new Error('Collection parent page unavailable');
            const total=rows[0].total as number;
            const parents=CollectionSummarySchema.omit({product_count:true}).array().max(100).parse(rows[0].items);
            if(parents.some(parent=>parent.store_id!==expected.site) || new Set(parents.map(parent=>parent.id)).size!==parents.length ||
                parents.length!==Math.min(page.limit,Math.max(0,total-(page.page-1)*page.limit))) throw new Error('Collection parent page unavailable');
            const counts=new Map<string,number>();
            if(parents.length) {
                const profile=async()=>{
                    const result=await tx.unsafe(`/* collection-list:profile */ SELECT jsonb_build_object(
                        'oid',c.oid,'parent_oid','public.collections'::regclass::oid,'product_oid','public.products'::regclass::oid,'owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'persistence',c.relpersistence,
                        'acl',to_jsonb(c.relacl),'acl_valid',NOT EXISTS(SELECT 1 FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a WHERE a.grantor<>c.relowner OR a.grantee<>c.relowner AND NOT(a.grantee='service_role'::regrole AND a.privilege_type='SELECT' AND NOT a.is_grantable)),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
                        'service_select',has_table_privilege('service_role',c.oid,'SELECT'),
                        'service_write',has_table_privilege('service_role',c.oid,'INSERT,UPDATE,DELETE,TRUNCATE'),
                        'tenant_select',has_table_privilege('app_tenant',c.oid,'SELECT'),
                        'roles',(SELECT jsonb_agg(to_jsonb(r) ORDER BY r.rolname) FROM pg_roles r WHERE r.rolname IN('app_tenant','service_role')),
                        'policies',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.polname),'[]'::jsonb) FROM pg_policy p WHERE p.polrelid=c.oid),
                        'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,a.atttypid::integer,a.attnotnull,a.attacl) ORDER BY a.attnum) FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
                        'constraints',(SELECT jsonb_agg(jsonb_build_array(k.contype,k.conkey,k.confrelid,k.confkey,k.convalidated) ORDER BY k.oid) FROM pg_constraint k WHERE k.conrelid=c.oid)
                        ) AS profile FROM pg_class c WHERE c.oid='public.collection_products'::regclass`);
                    const value=result[0]?.profile;
                    if(result.length!==1 || !value || typeof value!=='object' || Array.isArray(value)) throw new Error('Collection read profile unavailable');
                    const p=value as Record<string,unknown>;
                    if(p.owner!=='postgres'||p.kind!=='r'||p.persistence!=='p'||p.service_select!==true||p.service_write!==false||p.tenant_select!==false||p.acl_valid!==true||p.rls!==true||
                        !Array.isArray(p.columns)||!Array.isArray(p.constraints)||!Array.isArray(p.roles)||!Array.isArray(p.policies)) throw new Error('Collection read profile unavailable');
                    const columns=p.columns as unknown[][], constraints=p.constraints as unknown[][];
                    const names=['id','collection_id','product_id','position'];
                    if(columns.length!==4 || columns.some((c,i)=>c[0]!==names[i] || c[1]!== (i===3?23:2950) || c[3]!==null || i<3 && c[2]!==true)) throw new Error('Collection read columns unavailable');
                    const has=(kind:string,keys:number[],target?:unknown)=>constraints.some(c=>c[0]===kind&&JSON.stringify(c[1])===JSON.stringify(keys)&&c[4]===true&&(target===undefined||c[2]===target));
                    if(!has('p',[1])||!has('u',[2,3])||!has('f',[2],p.parent_oid)||!has('f',[3],p.product_oid)) throw new Error('Collection read constraints unavailable');
                    const roles=p.roles as Record<string,unknown>[];
                    if(roles.length!==2||!roles.some(r=>r.rolname==='app_tenant')||!roles.some(r=>r.rolname==='service_role')||roles.some(r=>
                        r.rolsuper!==false||r.rolcreaterole!==false||r.rolcreatedb!==false||r.rolreplication!==false||r.rolname==='app_tenant'&&(r.rolbypassrls!==false||r.rolcanlogin!==false))) throw new Error('Collection read roles unavailable');
                    return JSON.stringify(p);
                };
                const before=await profile();
                await context('app_tenant',baseline);
                await tx.unsafe('SAVEPOINT collection_assignment_count');
                try {
                    await tx.unsafe('SET LOCAL ROLE service_role');
                    await context('service_role',baseline);
                    const counted=await tx.unsafe(`/* collection-list:fixed-count */ SELECT c.id,count(cp.id)::integer AS product_count
                        FROM public.collections c LEFT JOIN public.collection_products cp ON cp.collection_id=c.id
                        WHERE c.store_id=$1::uuid AND c.id=ANY($2::uuid[]) AND c.deleted_at IS NULL GROUP BY c.id`,
                        [expected.site,parents.map(parent=>parent.id)]);
                    await tx.unsafe('SET LOCAL ROLE app_tenant');
                    await context('app_tenant',baseline);
                    if(await profile()!==before) throw new Error('Collection read profile changed');
                    const allowed=new Set(parents.map(parent=>parent.id));
                    for(const row of counted) {
                        if(typeof row.id!=='string'||!allowed.has(row.id)||counts.has(row.id)||!Number.isSafeInteger(row.product_count)||row.product_count<0) throw new Error('Collection counts unavailable');
                        counts.set(row.id,row.product_count);
                    }
                    if(counts.size!==parents.length) throw new Error('Collection counts unavailable');
                    const confirmed=await tx.unsafe(`/* collection-list:confirm */ SELECT id,membership_version FROM public.collections
                        WHERE store_id=$1::uuid AND id=ANY($2::uuid[]) AND deleted_at IS NULL ORDER BY id`,[expected.site,parents.map(parent=>parent.id)]);
                    const versions=new Map(parents.map(parent=>[parent.id,parent.membership_version]));
                    if(confirmed.length!==parents.length||new Set(confirmed.map(row=>row.id)).size!==parents.length||confirmed.some(row=>versions.get(row.id)!==row.membership_version)) throw new Error('Collection page changed');
                    await context('app_tenant',baseline);
                    await tx.unsafe('RELEASE SAVEPOINT collection_assignment_count');
                } catch(error) {
                    // A failed statement aborts PostgreSQL's statement context. Restore first; always abort the outer read.
                    await tx.unsafe('ROLLBACK TO SAVEPOINT collection_assignment_count');
                    await tx.unsafe('SET LOCAL ROLE app_tenant');
                    await context('app_tenant',baseline);
                    throw error;
                }
            }
            await context('app_tenant',baseline);
            return CollectionListPageSchema.parse({success:true,data:parents.map(parent=>({...parent,product_count:counts.get(parent.id)})),
                meta:{page:page.page,per_page:page.limit,total,total_pages:Math.ceil(total/page.limit),has_next:page.page<Math.ceil(total/page.limit),has_prev:page.page>1}});
        });
        console.info(JSON.stringify({event:'collection.list.read',outcome:'success',parents:result.data.length,duration_ms:Date.now()-started}));
        return result;
    } catch(error) {
        console.error(JSON.stringify({event:'collection.list.read',outcome:error instanceof ForbiddenError?'forbidden':'unavailable',code:'COLLECTION_LIST_UNAVAILABLE'}));
        if(error instanceof ForbiddenError) throw error;
        throw new AppError('Collections are temporarily unavailable. Retry the read.',503,'COLLECTION_LIST_UNAVAILABLE');
    }
}
