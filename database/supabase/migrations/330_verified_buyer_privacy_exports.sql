-- Owner-approved restricted buyer access export; erasure and retention stay gated.
-- Reuse privacy support intake, canonical step-up proof and encrypted DSR artifacts.
BEGIN;
SELECT pg_advisory_xact_lock(hashtextextended('letbuyy:migration:330:buyer-export',0));
ALTER TABLE public.step_up_challenges
 ADD COLUMN IF NOT EXISTS buyer_account_id uuid REFERENCES public.buyer_accounts(id) ON DELETE RESTRICT;
ALTER TABLE public.step_up_challenges ALTER COLUMN site_id DROP NOT NULL;
ALTER TABLE public.step_up_challenges DROP CONSTRAINT IF EXISTS step_up_challenges_action_check;
ALTER TABLE public.step_up_challenges ADD CONSTRAINT step_up_challenges_action_check CHECK(action IN ('refund.approve','payout.release','customer.dsr.export','customer.dsr.erase','buyer.dsr.export'));
ALTER TABLE public.step_up_challenges DROP CONSTRAINT IF EXISTS step_up_challenges_scope_v1_check;
ALTER TABLE public.step_up_challenges ADD CONSTRAINT step_up_challenges_scope_v1_check CHECK(
 (action='buyer.dsr.export' AND site_id IS NULL AND buyer_account_id IS NOT NULL AND actor_id IS NOT NULL AND actor_id=buyer_account_id)
 OR (action<>'buyer.dsr.export' AND site_id IS NOT NULL AND buyer_account_id IS NULL));
CREATE UNIQUE INDEX IF NOT EXISTS buyer_export_proof_key_v1 ON public.step_up_challenges(buyer_account_id,idempotency_key) WHERE action='buyer.dsr.export';
ALTER TABLE public.customer_dsr_exports
 ADD COLUMN IF NOT EXISTS buyer_account_id uuid REFERENCES public.buyer_accounts(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS support_ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS buyer_step_up_id uuid REFERENCES public.step_up_challenges(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS buyer_request_key uuid,
 ADD COLUMN IF NOT EXISTS buyer_session_sha256 text,
 ADD COLUMN IF NOT EXISTS buyer_session_epoch integer,
 ADD COLUMN IF NOT EXISTS buyer_verified_at timestamptz,
 ADD COLUMN IF NOT EXISTS released_at timestamptz;
ALTER TABLE public.customer_dsr_exports ALTER COLUMN site_id DROP NOT NULL;
ALTER TABLE public.customer_dsr_exports DROP CONSTRAINT IF EXISTS customer_dsr_exports_scope_v1_check;
ALTER TABLE public.customer_dsr_exports ADD CONSTRAINT customer_dsr_exports_scope_v1_check CHECK(
 (site_id IS NOT NULL AND buyer_account_id IS NULL AND support_ticket_id IS NULL AND buyer_step_up_id IS NULL AND buyer_request_key IS NULL
  AND buyer_session_sha256 IS NULL AND buyer_session_epoch IS NULL AND buyer_verified_at IS NULL AND released_at IS NULL)
 OR (site_id IS NULL AND buyer_account_id IS NOT NULL AND support_ticket_id IS NOT NULL AND buyer_step_up_id IS NOT NULL
  AND buyer_request_key IS NOT NULL AND buyer_session_sha256 IS NOT NULL AND buyer_session_epoch IS NOT NULL AND buyer_session_sha256 ~ '^[0-9a-f]{64}$' AND buyer_session_epoch>=1 AND buyer_verified_at IS NOT NULL
  AND export_type='access' AND request_id IS NULL AND expires_at>buyer_verified_at AND expires_at<=buyer_verified_at+interval '10 minutes'
  AND ((status='delivered' AND released_at IS NOT NULL) OR (status<>'delivered' AND released_at IS NULL))));
CREATE UNIQUE INDEX IF NOT EXISTS buyer_export_artifact_key_v1 ON public.customer_dsr_exports(buyer_account_id,buyer_request_key) WHERE buyer_account_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.buyer_export_metadata_v1(p_id uuid)
RETURNS jsonb LANGUAGE sql VOLATILE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
 SELECT jsonb_build_object('export_id',id,'request_id',support_ticket_id,'single_use',true,
  'status',CASE WHEN status='ready' AND expires_at<=clock_timestamp() THEN 'expired' ELSE status END,
  'expires_at',expires_at,'verified_at',buyer_verified_at,'released_at',released_at,'created_at',created_at)
 FROM public.customer_dsr_exports WHERE id=p_id AND buyer_account_id IS NOT NULL AND site_id IS NULL AND deleted_at IS NULL;
$fn$;
CREATE OR REPLACE FUNCTION public.begin_buyer_export_proof_v1(p_buyer uuid,p_epoch integer,p_session_sha256 text,p_ticket uuid,p_request_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE b public.buyer_accounts%ROWTYPE;t public.support_tickets%ROWTYPE;x public.step_up_challenges%ROWTYPE;v_attempts integer;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:buyer-export:'||p_buyer::text,0));
 SELECT * INTO b FROM public.buyer_accounts WHERE id=p_buyer FOR UPDATE;
 IF NOT FOUND OR b.status<>'active' OR b.session_epoch IS DISTINCT FROM p_epoch THEN RETURN jsonb_build_object('accepted',false,'code','BUYER_SESSION_INVALID');END IF;
 IF p_session_sha256 IS NULL OR p_session_sha256 !~ '^[0-9a-f]{64}$' OR p_request_key IS NULL THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_INTENT_INVALID');END IF;
 SELECT * INTO t FROM public.support_tickets WHERE id=p_ticket AND requester_type='customer' AND requester_user_id=p_buyer
  AND site_id IS NULL AND topic='privacy' AND metadata->>'privacy_request_type'='access' AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_REQUEST_NOT_FOUND');END IF;
 IF t.status IN ('closed','resolved') AND t.metadata->>'fulfillment_outcome' IS DISTINCT FROM 'fulfilled' THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_REQUEST_CLOSED');END IF;
 SELECT * INTO x FROM public.step_up_challenges WHERE buyer_account_id=p_buyer AND action='buyer.dsr.export' AND idempotency_key=p_request_key::text FOR UPDATE;
 IF FOUND AND (x.metadata->>'support_ticket_id' IS DISTINCT FROM p_ticket::text OR x.metadata->>'session_sha256' IS DISTINCT FROM p_session_sha256
  OR (x.metadata->>'session_epoch')::integer IS DISTINCT FROM p_epoch) THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_IDEMPOTENCY_CONFLICT');END IF;
 IF x.id IS NOT NULL AND (x.status='expired' OR x.expires_at<=clock_timestamp()) THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_EXPIRED');END IF;
 SELECT coalesce(sum((metadata->>'attempts')::integer),0) INTO v_attempts FROM public.step_up_challenges
  WHERE buyer_account_id=p_buyer AND action='buyer.dsr.export' AND created_at>clock_timestamp()-interval '10 minutes';
 IF v_attempts>=5 THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_VERIFICATION_LIMIT');END IF;
 IF x.id IS NULL THEN
  INSERT INTO public.step_up_challenges(site_id,buyer_account_id,actor_id,action,idempotency_key,challenge_token_hash,expires_at,metadata)
   VALUES(NULL,p_buyer,p_buyer,'buyer.dsr.export',p_request_key::text,p_session_sha256,clock_timestamp()+interval '10 minutes',
    jsonb_build_object('support_ticket_id',p_ticket,'session_sha256',p_session_sha256,'session_epoch',p_epoch,'attempts',1,
     'password_sha256',encode(extensions.digest(coalesce(b.password_hash,''),'sha256'),'hex'))) RETURNING * INTO x;
 ELSE UPDATE public.step_up_challenges SET metadata=metadata||jsonb_build_object('attempts',coalesce((metadata->>'attempts')::integer,0)+1) WHERE id=x.id RETURNING * INTO x;END IF;
 RETURN jsonb_build_object('accepted',true,'challenge_id',x.id,'password_hash',b.password_hash);
END $fn$;
CREATE OR REPLACE FUNCTION public.fail_buyer_export_proof_v1(p_buyer uuid,p_id uuid,p_session_sha256 text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
BEGIN
 UPDATE public.step_up_challenges SET status='failed' WHERE id=p_id AND buyer_account_id=p_buyer AND site_id IS NULL AND action='buyer.dsr.export'
  AND metadata->>'session_sha256'=p_session_sha256 AND status IN ('issued','failed');
 RETURN jsonb_build_object('accepted',true);
END $fn$;
CREATE OR REPLACE FUNCTION public.snapshot_buyer_export_v1(p_buyer uuid,p_epoch integer,p_session_sha256 text,p_id uuid,p_password_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE b public.buyer_accounts%ROWTYPE;x public.step_up_challenges%ROWTYPE;v_existing uuid;v_source jsonb;v_complete boolean;v_raw text;v_digest text;v_generated timestamptz;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:buyer-export:'||p_buyer::text,0));
 SELECT * INTO b FROM public.buyer_accounts WHERE id=p_buyer FOR UPDATE;
 IF NOT FOUND OR b.status<>'active' OR b.session_epoch IS DISTINCT FROM p_epoch THEN RETURN jsonb_build_object('accepted',false,'code','BUYER_SESSION_INVALID');END IF;
 SELECT * INTO x FROM public.step_up_challenges WHERE id=p_id AND buyer_account_id=p_buyer AND site_id IS NULL AND action='buyer.dsr.export' FOR UPDATE;
 IF NOT FOUND OR x.metadata->>'session_sha256' IS DISTINCT FROM p_session_sha256 OR (x.metadata->>'session_epoch')::integer IS DISTINCT FROM p_epoch
  OR p_password_hash IS NULL OR p_password_hash IS DISTINCT FROM b.password_hash
  OR x.metadata->>'password_sha256' IS DISTINCT FROM encode(extensions.digest(b.password_hash,'sha256'),'hex') THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_PROOF_CHANGED');END IF;
 IF x.status='expired' OR x.expires_at<=clock_timestamp() THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_EXPIRED');END IF;
 SELECT id INTO v_existing FROM public.customer_dsr_exports WHERE buyer_account_id=p_buyer AND buyer_request_key=x.idempotency_key::uuid AND site_id IS NULL AND deleted_at IS NULL;
 IF FOUND THEN RETURN jsonb_build_object('accepted',true,'export',public.buyer_export_metadata_v1(v_existing),'replayed',true);END IF;
 v_generated:=coalesce((x.metadata->>'source_generated_at')::timestamptz,clock_timestamp());
 -- All included sections, exact ownership joins and completeness counts share
 -- this one statement's snapshot. Named ceilings reject, never truncate success.
 WITH a AS MATERIALIZED (SELECT * FROM public.buyer_addresses WHERE buyer_account_id=p_buyer LIMIT 201),
 t AS MATERIALIZED (SELECT id,ticket_ref,topic,created_at FROM public.support_tickets WHERE requester_type='customer' AND requester_user_id=p_buyer AND deleted_at IS NULL LIMIT 501),
 m AS MATERIALIZED (SELECT z.id,z.ticket_id,z.body,z.created_at FROM public.ticket_messages z JOIN t ON t.id=z.ticket_id WHERE z.author_type='requester' AND z.deleted_at IS NULL LIMIT 10001),
 l AS MATERIALIZED (SELECT order_id FROM public.buyer_order_links WHERE buyer_account_id=p_buyer LIMIT 501),
 o AS MATERIALIZED (SELECT z.id,z.order_number,z.status,z.total,z.currency,z.created_at FROM public.orders z JOIN l ON l.order_id=z.id),
 i AS MATERIALIZED (SELECT z.id,z.order_id,z.name,z.quantity,z.price,z.total FROM public.order_items z JOIN o ON o.id=z.order_id WHERE z.deleted_at IS NULL LIMIT 10001),
 bounds AS (SELECT (SELECT count(*)<=200 FROM a) AND (SELECT count(*)<=500 FROM t) AND (SELECT count(*)<=500 FROM l)
  AND (SELECT count(*) FROM l)=(SELECT count(*) FROM o) AND (SELECT count(*)<=10000 FROM m) AND (SELECT count(*)<=10000 FROM i)
  AND NOT EXISTS(SELECT 1 FROM m GROUP BY ticket_id HAVING count(*)>500) AND NOT EXISTS(SELECT 1 FROM i GROUP BY order_id HAVING count(*)>200)
  AND coalesce((SELECT sum(octet_length(body)) FROM m),0)+coalesce((SELECT sum(octet_length(to_jsonb(a)::text)) FROM a),0)
   +coalesce((SELECT sum(octet_length(to_jsonb(o)::text)) FROM o),0)+coalesce((SELECT sum(octet_length(to_jsonb(i)::text)) FROM i),0)<4194304 AS complete)
 SELECT CASE WHEN (SELECT complete FROM bounds) THEN jsonb_build_object('contractVersion','buyer-restricted-access-v1','requestId',x.metadata->>'support_ticket_id','buyerAccountId',p_buyer,'generatedAt',v_generated,'complete',true,
  'sections',jsonb_build_object(
   'profile',jsonb_build_array(jsonb_build_object('email',b.email,'full_name',b.full_name,'phone',b.phone,'status',b.status,'created_at',b.created_at)),
   'addresses',(SELECT coalesce(jsonb_agg(jsonb_build_object('label',label,'full_name',full_name,'phone',phone,'address_line1',address_line1,'address_line2',address_line2,'city',city,'state',state,'postal_code',postal_code,'country',country,'is_default',is_default) ORDER BY id),'[]'::jsonb) FROM a),
   'authored_requests',(SELECT coalesce(jsonb_agg(jsonb_build_object('ticket_reference',ticket_ref,'topic',topic,'created_at',t.created_at,'authored_messages',
    (SELECT coalesce(jsonb_agg(body ORDER BY created_at,id),'[]'::jsonb) FROM m WHERE m.ticket_id=t.id)) ORDER BY t.created_at,t.id),'[]'::jsonb) FROM t),
   'orders',(SELECT coalesce(jsonb_agg(jsonb_build_object('order_reference',order_number,'status',status,'total',total,'currency',currency,'created_at',o.created_at,'items',
    (SELECT coalesce(jsonb_agg(jsonb_build_object('name',name,'quantity',quantity,'price',price,'total',total) ORDER BY id),'[]'::jsonb) FROM i WHERE i.order_id=o.id)) ORDER BY o.created_at,o.id),'[]'::jsonb) FROM o))) ELSE NULL END,(SELECT complete FROM bounds)
 INTO v_source,v_complete;
 v_raw:=v_source::text;
 IF NOT v_complete OR v_raw IS NULL OR octet_length(v_raw)>5242880 THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_SCOPE_LIMIT');END IF;
 v_digest:=encode(extensions.digest(v_raw,'sha256'),'hex');
 IF x.metadata ? 'source_digest' AND x.metadata->>'source_digest'<>v_digest THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_SOURCE_CHANGED');END IF;
 UPDATE public.step_up_challenges SET status='verified',verified_at=coalesce(verified_at,clock_timestamp()),
  metadata=metadata||jsonb_build_object('source_digest',v_digest,'source_generated_at',v_generated) WHERE id=x.id;
 RETURN jsonb_build_object('accepted',true,'source_json',v_raw,'source_digest',v_digest,'email',b.email,'replayed',false);
END $fn$;
CREATE OR REPLACE FUNCTION public.save_buyer_export_v1(p_buyer uuid,p_epoch integer,p_session_sha256 text,p_id uuid,p_digest text,p_ciphertext text,p_email_hash text,p_encrypted_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE b public.buyer_accounts%ROWTYPE;x public.step_up_challenges%ROWTYPE;t public.support_tickets%ROWTYPE;v_existing public.customer_dsr_exports%ROWTYPE;v_id uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:buyer-export:'||p_buyer::text,0));
 SELECT * INTO b FROM public.buyer_accounts WHERE id=p_buyer FOR UPDATE;
 IF NOT FOUND OR b.status<>'active' OR b.session_epoch IS DISTINCT FROM p_epoch THEN RETURN jsonb_build_object('accepted',false,'code','BUYER_SESSION_INVALID');END IF;
 SELECT * INTO x FROM public.step_up_challenges WHERE id=p_id AND buyer_account_id=p_buyer AND site_id IS NULL AND action='buyer.dsr.export' FOR UPDATE;
 IF NOT FOUND OR x.status<>'verified' OR x.verified_at IS NULL OR x.metadata->>'session_sha256' IS DISTINCT FROM p_session_sha256 OR (x.metadata->>'session_epoch')::integer IS DISTINCT FROM p_epoch
  OR x.metadata->>'password_sha256' IS DISTINCT FROM encode(extensions.digest(coalesce(b.password_hash,''),'sha256'),'hex') THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_PROOF_CHANGED');END IF;
 IF x.expires_at<=clock_timestamp() OR x.verified_at<=clock_timestamp()-interval '10 minutes' THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_EXPIRED');END IF;
 SELECT * INTO t FROM public.support_tickets WHERE id=(x.metadata->>'support_ticket_id')::uuid AND requester_type='customer' AND requester_user_id=p_buyer
  AND site_id IS NULL AND topic='privacy' AND metadata->>'privacy_request_type'='access' AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_REQUEST_NOT_FOUND');END IF;
 SELECT * INTO v_existing FROM public.customer_dsr_exports WHERE buyer_account_id=p_buyer AND buyer_request_key=x.idempotency_key::uuid AND site_id IS NULL;
 IF FOUND THEN RETURN jsonb_build_object('accepted',true,'export',public.buyer_export_metadata_v1(v_existing.id),'replayed',true);END IF;
 IF p_digest IS NULL OR p_digest IS DISTINCT FROM x.metadata->>'source_digest' OR p_email_hash IS DISTINCT FROM encode(extensions.digest(b.email,'sha256'),'hex')
  OR p_ciphertext IS NULL OR length(p_ciphertext) NOT BETWEEN 20 AND 20000000 OR p_encrypted_email IS NULL OR length(p_encrypted_email)<20 THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_SOURCE_CHANGED');END IF;
 IF t.status IN ('closed','resolved') AND t.metadata->>'fulfillment_outcome' IS DISTINCT FROM 'fulfilled' THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_REQUEST_CLOSED');END IF;
 INSERT INTO public.customer_dsr_exports(site_id,buyer_account_id,support_ticket_id,buyer_step_up_id,buyer_request_key,buyer_session_sha256,buyer_session_epoch,buyer_verified_at,
  subject_email_hash,encrypted_subject_email,export_type,encrypted_payload,payload_digest,expires_at,metadata,created_by,updated_by)
 VALUES(NULL,p_buyer,t.id,x.id,x.idempotency_key::uuid,p_session_sha256,p_epoch,x.verified_at,p_email_hash,p_encrypted_email,'access',p_ciphertext,p_digest,
  least(x.expires_at,x.verified_at+interval '10 minutes'),'{"contract_version":"buyer-restricted-access-v1","delivery":"authenticated-single-use"}'::jsonb,p_buyer,p_buyer) RETURNING id INTO v_id;
 INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
 VALUES(p_buyer,'buyer','buyer.privacy.export_prepared','customer_dsr_exports',v_id,jsonb_build_object('request_id',t.id,'payload_digest',p_digest,'single_use',true));
 RETURN jsonb_build_object('accepted',true,'export',public.buyer_export_metadata_v1(v_id),'replayed',false);
END $fn$;
CREATE OR REPLACE FUNCTION public.access_buyer_export_v1(p_operation text,p_buyer uuid,p_epoch integer,p_session_sha256 text,p_ticket uuid,p_export uuid,p_digest text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$
DECLARE b public.buyer_accounts%ROWTYPE;e public.customer_dsr_exports%ROWTYPE;x public.step_up_challenges%ROWTYPE;t public.support_tickets%ROWTYPE;v_items jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:buyer-export:'||p_buyer::text,0));
 SELECT * INTO b FROM public.buyer_accounts WHERE id=p_buyer FOR UPDATE;
 IF NOT FOUND OR b.status<>'active' OR b.session_epoch IS DISTINCT FROM p_epoch THEN RETURN jsonb_build_object('accepted',false,'code','BUYER_SESSION_INVALID');END IF;
 SELECT * INTO t FROM public.support_tickets WHERE id=p_ticket AND requester_type='customer' AND requester_user_id=p_buyer AND site_id IS NULL AND topic='privacy'
  AND metadata->>'privacy_request_type'='access' AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_REQUEST_NOT_FOUND');END IF;
 IF p_operation='list' THEN
  SELECT coalesce(jsonb_agg(public.buyer_export_metadata_v1(id) ORDER BY created_at DESC,id DESC),'[]'::jsonb) INTO v_items FROM
   (SELECT id,created_at FROM public.customer_dsr_exports WHERE buyer_account_id=p_buyer AND support_ticket_id=p_ticket AND site_id IS NULL AND deleted_at IS NULL ORDER BY created_at DESC,id DESC LIMIT 20) q;
  RETURN jsonb_build_object('accepted',true,'items',v_items);
 END IF;
 IF p_operation NOT IN ('inspect','consume') OR p_operation IS NULL THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_INTENT_INVALID');END IF;
 SELECT * INTO e FROM public.customer_dsr_exports WHERE id=p_export AND buyer_account_id=p_buyer AND support_ticket_id=p_ticket AND site_id IS NULL AND deleted_at IS NULL FOR UPDATE;
 IF NOT FOUND THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_NOT_FOUND');END IF;
 IF e.buyer_session_epoch IS DISTINCT FROM p_epoch OR e.buyer_session_sha256 IS DISTINCT FROM p_session_sha256 THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_SESSION_MISMATCH');END IF;
 IF e.status='delivered' THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_ALREADY_RELEASED');END IF;
 IF e.status<>'ready' OR e.expires_at<=clock_timestamp() OR e.buyer_verified_at<=clock_timestamp()-interval '10 minutes' THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_EXPIRED');END IF;
 SELECT * INTO x FROM public.step_up_challenges WHERE id=e.buyer_step_up_id AND buyer_account_id=p_buyer AND action='buyer.dsr.export' AND status='verified' FOR UPDATE;
 IF NOT FOUND OR x.metadata->>'password_sha256' IS DISTINCT FROM encode(extensions.digest(coalesce(b.password_hash,''),'sha256'),'hex')
  OR x.metadata->>'source_digest' IS DISTINCT FROM e.payload_digest OR x.metadata->>'session_sha256' IS DISTINCT FROM p_session_sha256 THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_PROOF_CHANGED');END IF;
 IF p_operation='inspect' THEN RETURN jsonb_build_object('accepted',true,'export',public.buyer_export_metadata_v1(e.id),'encrypted_payload',e.encrypted_payload,'payload_digest',e.payload_digest);END IF;
 IF p_digest IS DISTINCT FROM e.payload_digest THEN RETURN jsonb_build_object('accepted',false,'code','EXPORT_SOURCE_CHANGED');END IF;
 UPDATE public.customer_dsr_exports SET status='delivered',released_at=clock_timestamp(),updated_by=p_buyer WHERE id=e.id;
 UPDATE public.support_tickets SET status='resolved',resolved_at=clock_timestamp(),metadata=metadata||jsonb_build_object('fulfillment_outcome','fulfilled','export_id',e.id,'fulfillment_kind','restricted_access_export_released') WHERE id=t.id;
 INSERT INTO public.audit_logs(actor_id,actor_type,action,resource_type,resource_id,metadata)
 VALUES(p_buyer,'buyer','buyer.privacy.export_released','customer_dsr_exports',e.id,jsonb_build_object('request_id',t.id,'payload_digest',e.payload_digest,'delivery_confirmation','server_release_only'));
 RETURN jsonb_build_object('accepted',true,'export',public.buyer_export_metadata_v1(e.id));
END $fn$;
REVOKE ALL ON FUNCTION public.buyer_export_metadata_v1(uuid),public.begin_buyer_export_proof_v1(uuid,integer,text,uuid,uuid),public.fail_buyer_export_proof_v1(uuid,uuid,text),
 public.snapshot_buyer_export_v1(uuid,integer,text,uuid,text),public.save_buyer_export_v1(uuid,integer,text,uuid,text,text,text,text),public.access_buyer_export_v1(text,uuid,integer,text,uuid,uuid,text) FROM PUBLIC,anon,authenticated,app_tenant;
GRANT EXECUTE ON FUNCTION public.buyer_export_metadata_v1(uuid),public.begin_buyer_export_proof_v1(uuid,integer,text,uuid,uuid),public.fail_buyer_export_proof_v1(uuid,uuid,text),
 public.snapshot_buyer_export_v1(uuid,integer,text,uuid,text),public.save_buyer_export_v1(uuid,integer,text,uuid,text,text,text,text),public.access_buyer_export_v1(text,uuid,integer,text,uuid,uuid,text) TO service_role;
NOTIFY pgrst,'reload schema';
COMMIT;
