-- Complete the existing profile model; no carrier, charge or app platform activation.
BEGIN;
CREATE FUNCTION public.save_shipping_profile_v1(p_site_id uuid,p_actor_id uuid,p_profile_id uuid,
 p_expected_revision timestamptz,p_payload jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE profile public.shipping_profiles; next_default boolean; result jsonb;
BEGIN
 PERFORM 1 FROM public.sites WHERE id=p_site_id AND deleted_at IS NULL
  AND (custom_user_id=p_actor_id OR user_id=p_actor_id) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'SHIPPING_PROFILE_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_payload)<>'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_payload) k
    WHERE k NOT IN('name','handling_fee_minor','cod_enabled','is_default')) THEN
   RAISE EXCEPTION 'SHIPPING_PROFILE_INVALID'; END IF;
 IF p_payload ? 'name' AND (jsonb_typeof(p_payload->'name')<>'string' OR length(btrim(p_payload->>'name')) NOT BETWEEN 1 AND 100)
   OR p_payload ? 'handling_fee_minor' AND (jsonb_typeof(p_payload->'handling_fee_minor')<>'number'
     OR (p_payload->>'handling_fee_minor')::numeric NOT BETWEEN 0 AND 100000000
     OR (p_payload->>'handling_fee_minor')::numeric<>trunc((p_payload->>'handling_fee_minor')::numeric))
   OR p_payload ? 'cod_enabled' AND jsonb_typeof(p_payload->'cod_enabled')<>'boolean'
   OR p_payload ? 'is_default' AND p_payload->'is_default'<>'true'::jsonb THEN
   RAISE EXCEPTION 'SHIPPING_PROFILE_INVALID'; END IF;
 SELECT * INTO profile FROM public.shipping_profiles WHERE id=p_profile_id AND site_id=p_site_id AND deleted_at IS NULL FOR UPDATE;
 IF profile.id IS NULL THEN
   IF p_expected_revision IS NOT NULL OR NOT(p_payload ? 'name') THEN RAISE EXCEPTION 'SHIPPING_PROFILE_CONFLICT'; END IF;
   next_default:=NOT EXISTS(SELECT 1 FROM shipping_profiles WHERE site_id=p_site_id AND is_default AND deleted_at IS NULL);
   INSERT INTO public.shipping_profiles(id,site_id,name,handling_fee_minor,cod_enabled,is_default,created_by,updated_by)
    VALUES(p_profile_id,p_site_id,btrim(p_payload->>'name'),coalesce((p_payload->>'handling_fee_minor')::bigint,0),
      coalesce((p_payload->>'cod_enabled')::boolean,true),next_default,p_actor_id,p_actor_id) RETURNING * INTO profile;
 ELSE
   IF p_expected_revision IS NULL THEN
     -- Same logical create UUID can recover a committed response loss only for identical settings.
     IF profile.name IS DISTINCT FROM btrim(p_payload->>'name')
       OR profile.handling_fee_minor IS DISTINCT FROM coalesce((p_payload->>'handling_fee_minor')::bigint,0)
       OR profile.cod_enabled IS DISTINCT FROM coalesce((p_payload->>'cod_enabled')::boolean,true) THEN
       RAISE EXCEPTION 'SHIPPING_PROFILE_CONFLICT'; END IF;
   ELSE
     IF profile.updated_at IS DISTINCT FROM p_expected_revision THEN RAISE EXCEPTION 'SHIPPING_PROFILE_CONFLICT'; END IF;
     IF p_payload->>'is_default'='true' THEN
       UPDATE public.shipping_profiles SET is_default=false,updated_by=p_actor_id WHERE site_id=p_site_id AND is_default AND id<>p_profile_id AND deleted_at IS NULL;
     END IF;
     UPDATE public.shipping_profiles SET name=coalesce(btrim(p_payload->>'name'),name),
       handling_fee_minor=coalesce((p_payload->>'handling_fee_minor')::bigint,handling_fee_minor),
       cod_enabled=coalesce((p_payload->>'cod_enabled')::boolean,cod_enabled),
       is_default=coalesce((p_payload->>'is_default')::boolean,is_default),updated_by=p_actor_id
       WHERE id=p_profile_id AND site_id=p_site_id RETURNING * INTO profile;
   END IF;
 END IF;
 result:=jsonb_build_object('id',profile.id,'site_id',profile.site_id,'name',profile.name,'is_default',profile.is_default,
  'handling_fee_minor',profile.handling_fee_minor,'cod_enabled',profile.cod_enabled,'updated_at',profile.updated_at);
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.save_shipping_profile_v1(uuid,uuid,uuid,timestamptz,jsonb) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.save_shipping_profile_v1(uuid,uuid,uuid,timestamptz,jsonb) TO service_role;
COMMIT;
