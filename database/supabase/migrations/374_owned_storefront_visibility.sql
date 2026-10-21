BEGIN;
CREATE FUNCTION public.set_owned_storefront_access_v1(p_actor uuid,p_site uuid,p_bound_site uuid,p_mode text,p_message text,p_password_hash text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE s public.sites;next_hash text;
BEGIN
 SELECT * INTO s FROM public.sites WHERE id=p_site AND deleted_at IS NULL FOR UPDATE;
 IF s.id IS NULL OR p_actor IS NULL OR(p_bound_site IS NOT NULL AND p_bound_site<>p_site)
  OR NOT(coalesce(s.custom_user_id=p_actor,false) OR coalesce(s.user_id=p_actor,false)) THEN
  RAISE EXCEPTION 'Store not owned by this actor' USING ERRCODE='42501'; END IF;
 IF p_mode IS NULL OR p_mode NOT IN('public','password','preview_only','offline') OR length(p_message)>1000
  OR(p_password_hash IS NOT NULL AND p_password_hash NOT LIKE '$argon2id$%') THEN
  RAISE EXCEPTION 'Invalid visibility settings' USING ERRCODE='PT400'; END IF;
 next_hash:=CASE WHEN p_mode='password' THEN coalesce(p_password_hash,s.access_password_hash) ELSE NULL END;
 IF p_mode='password' AND next_hash IS NULL THEN RAISE EXCEPTION 'Set a password first' USING ERRCODE='PT400'; END IF;
 UPDATE public.sites SET access_mode=p_mode,access_message=nullif(p_message,''),access_password_hash=next_hash,updated_by=p_actor,updated_at=now() WHERE id=p_site;
 INSERT INTO public.audit_activity_events(store_id,actor_id,actor_type,action,resource_type,resource_id,before_state,after_state)
 VALUES(p_site,p_actor,'user','storefront.visibility.update','store',p_site::text,
  jsonb_build_object('access_mode',s.access_mode),jsonb_build_object('access_mode',p_mode,'has_password',next_hash IS NOT NULL));
 RETURN jsonb_build_object('site_id',p_site,'access_mode',p_mode,'has_password',next_hash IS NOT NULL);
END $fn$;
REVOKE ALL ON FUNCTION public.set_owned_storefront_access_v1(uuid,uuid,uuid,text,text,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.set_owned_storefront_access_v1(uuid,uuid,uuid,text,text,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
