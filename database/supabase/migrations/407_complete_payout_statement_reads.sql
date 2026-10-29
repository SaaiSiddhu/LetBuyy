-- Read the existing statement owner in one snapshot. This is not a balance,
-- transfer, bank-settlement observation, new ledger or financial writer.
SET lock_timeout='5s';
SET statement_timeout='60s';
CREATE INDEX payout_statement_read_scope_idx ON public.payout_statements(site_id,provider_mode,created_at DESC,id DESC)
 WHERE deleted_at IS NULL;

CREATE FUNCTION public.read_payout_statement_page_v1(p_site_id uuid,p_mode text,p_limit integer DEFAULT 25,
 p_status text DEFAULT NULL,p_before_created_at timestamptz DEFAULT NULL,p_before_id uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE result jsonb;
BEGIN
 IF p_site_id IS NULL OR p_mode IS NULL OR p_mode NOT IN('sandbox','live') OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 50
  OR (p_status IS NOT NULL AND p_status NOT IN('pending','processing','released','failed'))
  OR (p_before_created_at IS NULL)<>(p_before_id IS NULL) THEN
  RAISE EXCEPTION 'Invalid payout statement read scope' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM public.payout_statements WHERE site_id=p_site_id AND provider_mode=p_mode AND deleted_at IS NULL AND currency<>'INR') THEN
  RAISE EXCEPTION 'Payout statement currency requires review' USING ERRCODE='22023'; END IF;
 WITH all_rows AS MATERIALIZED (
  SELECT * FROM public.payout_statements WHERE site_id=p_site_id AND provider_mode=p_mode AND deleted_at IS NULL
 ), matching AS MATERIALIZED (
  SELECT * FROM all_rows WHERE p_status IS NULL OR status=p_status
 ), page_window AS MATERIALIZED (
  SELECT * FROM matching WHERE p_before_id IS NULL OR (created_at,id)<(p_before_created_at,p_before_id)
  ORDER BY created_at DESC,id DESC LIMIT p_limit+1
 )
 SELECT jsonb_build_object(
  'payouts',coalesce((SELECT jsonb_agg(to_jsonb(p) ORDER BY p.created_at DESC,p.id DESC)
   FROM (SELECT * FROM page_window ORDER BY created_at DESC,id DESC LIMIT p_limit) p),'[]'::jsonb),
  'summary',jsonb_build_object('site_id',p_site_id,'currency','INR','provider_mode',p_mode,
   'scope','all_statements_in_environment','statement_count',(SELECT count(*) FROM all_rows),
   'pending_minor',coalesce((SELECT sum(net_amount_minor) FROM all_rows WHERE status='pending'),0),
   'processing_minor',coalesce((SELECT sum(net_amount_minor) FROM all_rows WHERE status='processing'),0),
   'released_minor',coalesce((SELECT sum(net_amount_minor) FROM all_rows WHERE status='released'),0),
   'failed_minor',coalesce((SELECT sum(net_amount_minor) FROM all_rows WHERE status='failed'),0),
   'bank_settlement','not_observed',
   'next_payout',(SELECT to_jsonb(a) FROM all_rows a WHERE status IN('pending','processing')
    ORDER BY coalesce(available_on::timestamptz,created_at),created_at,id LIMIT 1)),
  'pagination',jsonb_build_object('limit',p_limit,'matching_count',(SELECT count(*) FROM matching),
   'has_more',(SELECT count(*)>p_limit FROM page_window)),
  'next_position',CASE WHEN (SELECT count(*)>p_limit FROM page_window)
   THEN (SELECT jsonb_build_object('created_at',created_at,'id',id) FROM page_window ORDER BY created_at DESC,id DESC OFFSET p_limit-1 LIMIT 1)
   ELSE NULL END) INTO result;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION public.read_payout_statement_page_v1(uuid,text,integer,text,timestamptz,uuid) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.read_payout_statement_page_v1(uuid,text,integer,text,timestamptz,uuid) TO service_role;
NOTIFY pgrst,'reload schema';
