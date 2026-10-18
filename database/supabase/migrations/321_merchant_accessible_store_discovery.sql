-- Merchant navigation is the union of actual ownership and active staff
-- membership. This is a private read of the existing authorities, not a new
-- membership/identity system or activation of the dormant shadow store.
BEGIN;
CREATE OR REPLACE FUNCTION public.list_merchant_accessible_sites_v1(p_actor_id uuid,p_page integer DEFAULT 1,p_limit integer DEFAULT 10,p_site_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $function$
 WITH accessible AS (
  SELECT s.*,(s.custom_user_id=p_actor_id OR s.user_id=p_actor_id) AS actor_owns
  FROM public.sites s WHERE s.deleted_at IS NULL AND(p_site_id IS NULL OR s.id=p_site_id)
   AND EXISTS(SELECT 1 FROM public.users_custom u WHERE u.id=p_actor_id)
   AND(s.custom_user_id=p_actor_id OR s.user_id=p_actor_id OR EXISTS(
    SELECT 1 FROM public.employees e WHERE e.store_id=s.id AND e.user_id=p_actor_id
     AND e.status='active' AND e.is_active=true AND e.deleted_at IS NULL))
 ), page_rows AS (
  SELECT * FROM accessible ORDER BY created_at DESC,id DESC
   LIMIT least(greatest(coalesce(p_limit,10),1),50)
   OFFSET(greatest(coalesce(p_page,1),1)-1)::bigint*least(greatest(coalesce(p_limit,10),1),50)
 )
 SELECT jsonb_build_object('items',coalesce((SELECT jsonb_agg(
  CASE WHEN actor_owns THEN to_jsonb(s)-'actor_owns' ELSE jsonb_build_object(
   'id',s.id,'name',s.name,'store_name',s.store_name,'subdomain',s.subdomain,'site_type',s.site_type,
   'status',s.status,'published',s.published,'created_at',s.created_at,'updated_at',s.updated_at,
   'trial_ends_at',s.trial_ends_at,'trial_status',s.trial_status,'theme_id',s.theme_id,'theme_settings',s.theme_settings,
   'custom_domain',s.custom_domain,'custom_domain_status',s.custom_domain_status) END ORDER BY created_at DESC,id DESC)
  FROM page_rows s),'[]'::jsonb),'total',(SELECT count(*) FROM accessible));
$function$;
REVOKE ALL ON FUNCTION public.list_merchant_accessible_sites_v1(uuid,integer,integer,uuid) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.list_merchant_accessible_sites_v1(uuid,integer,integer,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
