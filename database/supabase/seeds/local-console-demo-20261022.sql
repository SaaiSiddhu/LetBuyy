-- Owner-requested, labelled LOCAL DEMO records. Not a migration or a production seed.
-- No passwords, verified identities, realm grants, staff roles, paid receipts or external sends.
-- Orders use the canonical checkout RPC; retained order/audit/inbox evidence stays protected.
-- Wrapper pins the exact local Docker container. Existing business rows are never overwritten.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
SELECT pg_advisory_xact_lock(hashtext('letbuyy:local-console-demo:20261022'));
DO $$ BEGIN
 IF current_database()<>'postgres' OR current_user<>'postgres' OR inet_client_addr() IS NOT NULL
  OR (SELECT rolsuper FROM pg_roles WHERE rolname=current_user)
  OR (SELECT max(version) FROM supabase_migrations.schema_migrations) IS DISTINCT FROM '372' THEN
  RAISE EXCEPTION 'Expected exact local372 database and original non-superuser owner over Docker-local socket';
 END IF;
 IF EXISTS(SELECT 1 FROM pg_event_trigger WHERE evtenabled='D') THEN RAISE EXCEPTION 'Every existing DDL guard must remain enabled';END IF;
 IF EXISTS(SELECT 1 FROM sites WHERE id IN('de202610-2200-4000-8000-000000000201','de202610-2200-4000-8000-000000000202','de202610-2200-4000-8000-000000000203') AND settings->>'local_demo' IS DISTINCT FROM 'console-20261022')
  OR EXISTS(SELECT 1 FROM users_custom WHERE id IN('de202610-2200-4000-8000-000000000101','de202610-2200-4000-8000-000000000102') AND email NOT IN('demo-lotus@example.invalid','demo-crafts@example.invalid')) THEN
  RAISE EXCEPTION 'Demo namespace collides with unrelated data';
 END IF;
END $$;

INSERT INTO users_custom(id,email,full_name) VALUES
 ('de202610-2200-4000-8000-000000000101','demo-lotus@example.invalid','DEMO — Lotus merchant'),
 ('de202610-2200-4000-8000-000000000102','demo-crafts@example.invalid','DEMO — Nilgiri merchant')
ON CONFLICT(id) DO NOTHING;

INSERT INTO sites(id,custom_user_id,name,store_name,site_type,subdomain,status,published,access_mode,currency,locale,
 trial_status,trial_ends_at,description,settings,business_profile,invoice_address,online_payment_enabled,cod_enabled)
VALUES
 ('de202610-2200-4000-8000-000000000201','de202610-2200-4000-8000-000000000101','DEMO — Lotus Apparel','DEMO — Lotus Apparel','store','demo-lotus-apparel','draft',false,'preview_only','INR','en-IN','active',now()+interval '10 days',
  'Local sample only. Apparel catalog, original order snapshots and trial billing.', '{"local_demo":"console-20261022","provider_mode":"mock"}',
  '{"email":"demo-lotus@example.invalid"}','{"line1":"DEMO address only","city":"Bengaluru","state":"Karnataka","zip":"560001","country":"IN"}',false,true),
 ('de202610-2200-4000-8000-000000000202','de202610-2200-4000-8000-000000000101','DEMO — Lotus Home','DEMO — Lotus Home','store','demo-lotus-home','draft',false,'preview_only','INR','en-IN','grace',now()-interval '2 days',
  'Local sample only. Same owner, different store-specific subscription and failed unpaid billing example.', '{"local_demo":"console-20261022","provider_mode":"mock"}',
  '{"email":"demo-lotus@example.invalid"}','{}',false,true),
 ('de202610-2200-4000-8000-000000000203','de202610-2200-4000-8000-000000000102','DEMO — Nilgiri Crafts','DEMO — Nilgiri Crafts','store','demo-nilgiri-crafts','draft',false,'preview_only','INR','en-IN','active',now()+interval '5 days',
  'Local sample only. Craft catalog, COD order and setup checks needing attention.', '{"local_demo":"console-20261022","provider_mode":"mock"}',
  '{"email":"demo-crafts@example.invalid"}','{}',false,true)
ON CONFLICT(id) DO NOTHING;

INSERT INTO subscriptions(id,user_id,site_id,store_id,plan,plan_id,status,current_period_start,current_period_end,amount_paid,dunning_status)
SELECT v.id::uuid,v.owner::uuid,v.site::uuid,v.site::uuid,p.slug,p.id,v.status,now()-interval '4 days',
 CASE WHEN v.status='past_due' THEN now()-interval '1 day' ELSE now()+interval '10 days' END,0,
 CASE WHEN v.status='past_due' THEN 'past_due' ELSE 'none' END
FROM(VALUES
 ('de202610-2200-4000-8000-000000000301','de202610-2200-4000-8000-000000000101','de202610-2200-4000-8000-000000000201','launch','trialing'),
 ('de202610-2200-4000-8000-000000000302','de202610-2200-4000-8000-000000000101','de202610-2200-4000-8000-000000000202','growth','past_due'),
 ('de202610-2200-4000-8000-000000000303','de202610-2200-4000-8000-000000000102','de202610-2200-4000-8000-000000000203','growth','trialing'))v(id,owner,site,plan,status)
JOIN plans p ON p.slug=v.plan AND p.deleted_at IS NULL
ON CONFLICT(id) DO NOTHING;

-- Unpaid illustrative records only: no subscription quote/activation receipt or paid ledger proof is fabricated.
INSERT INTO billing_history(id,user_id,site_id,store_id,invoice_number,description,amount,total_amount,payment_status,billing_period,metadata)
SELECT v.id::uuid,'de202610-2200-4000-8000-000000000101',v.site::uuid,v.site::uuid,v.number,
 'DEMO — unpaid '||v.plan||' example; no provider transaction',p.price_monthly_inr,p.price_monthly_inr,v.status,'monthly',
 '{"local_demo":"console-20261022","provider_mode":"mock","no_provider_transaction":true}'::jsonb
FROM(VALUES
 ('de202610-2200-4000-8000-000000000401','de202610-2200-4000-8000-000000000201','DEMO-LAUNCH-001','launch','pending'),
 ('de202610-2200-4000-8000-000000000402','de202610-2200-4000-8000-000000000202','DEMO-GROWTH-001','growth','failed'))v(id,site,number,plan,status)
JOIN plans p ON p.slug=v.plan AND p.deleted_at IS NULL
ON CONFLICT(id) DO NOTHING;
INSERT INTO merchant_billing_invoices(id,site_id,billing_history_id,invoice_number,status,subtotal_minor,total_minor,metadata)
SELECT v.id::uuid,b.site_id,b.id,b.invoice_number,v.status,b.amount,b.amount,'{"local_demo":"console-20261022","provider_mode":"mock","sample_only":true}'::jsonb
FROM(VALUES
 ('de202610-2200-4000-8000-000000000411','de202610-2200-4000-8000-000000000401','issued'),
 ('de202610-2200-4000-8000-000000000412','de202610-2200-4000-8000-000000000402','payment_failed'))v(id,history,status)
JOIN billing_history b ON b.id=v.history::uuid
ON CONFLICT(id) DO NOTHING;

INSERT INTO inventory_locations(id,store_id,name,is_default,status) VALUES
 ('de202610-2200-4000-8000-000000000501','de202610-2200-4000-8000-000000000201','DEMO sample stock',true,'active'),
 ('de202610-2200-4000-8000-000000000503','de202610-2200-4000-8000-000000000203','DEMO sample stock',true,'active')
ON CONFLICT(id) DO NOTHING;
INSERT INTO products(id,store_id,site_id,name,description,price,sku,status,is_active,metadata) VALUES
 ('de202610-2200-4000-8000-000000000601','de202610-2200-4000-8000-000000000201','de202610-2200-4000-8000-000000000201','DEMO — Classic Cotton Tee','Local sample only. Original order keeps this name and price.',499,'DEMO-TEE-001','active',true,'{"local_demo":"console-20261022"}'),
 ('de202610-2200-4000-8000-000000000602','de202610-2200-4000-8000-000000000201','de202610-2200-4000-8000-000000000201','DEMO — Linen Shirt','Local sample only.',1299,'DEMO-SHIRT-002','active',true,'{"local_demo":"console-20261022"}'),
 ('de202610-2200-4000-8000-000000000603','de202610-2200-4000-8000-000000000201','de202610-2200-4000-8000-000000000201','DEMO — Jacket draft','Local sample draft.',2199,'DEMO-JACKET-003','draft',false,'{"local_demo":"console-20261022"}'),
 ('de202610-2200-4000-8000-000000000604','de202610-2200-4000-8000-000000000202','de202610-2200-4000-8000-000000000202','DEMO — Table Runner','Local sample only.',399,'DEMO-HOME-004','active',true,'{"local_demo":"console-20261022"}'),
 ('de202610-2200-4000-8000-000000000605','de202610-2200-4000-8000-000000000203','de202610-2200-4000-8000-000000000203','DEMO — Handmade Basket','Local sample only.',699,'DEMO-CRAFT-005','active',true,'{"local_demo":"console-20261022"}'),
 ('de202610-2200-4000-8000-000000000606','de202610-2200-4000-8000-000000000203','de202610-2200-4000-8000-000000000203','DEMO — Ceramic Mug draft','Local sample only.',249,'DEMO-CRAFT-006','draft',false,'{"local_demo":"console-20261022"}')
ON CONFLICT(id) DO NOTHING;
INSERT INTO inventory_levels(id,store_id,product_id,location_id,available,reserved,committed_quantity,available_quantity,reserved_quantity,on_hand_quantity)
VALUES
 ('de202610-2200-4000-8000-000000000611','de202610-2200-4000-8000-000000000201','de202610-2200-4000-8000-000000000601','de202610-2200-4000-8000-000000000501',25,0,0,25,0,25),
 ('de202610-2200-4000-8000-000000000615','de202610-2200-4000-8000-000000000203','de202610-2200-4000-8000-000000000605','de202610-2200-4000-8000-000000000503',12,0,0,12,0,12)
ON CONFLICT(id) DO NOTHING;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM checkout_sessions WHERE site_id='de202610-2200-4000-8000-000000000201' AND idempotency_key='local-console-demo-apparel-20261022') THEN
  PERFORM set_config('app.site_id','de202610-2200-4000-8000-000000000201',true);
  PERFORM create_checkout_order('de202610-2200-4000-8000-000000000201','DEMO sample buyer','demo-buyer@example.invalid',NULL,
   '{"line1":"DEMO address only","city":"Bengaluru","state":"Karnataka","state_code":"29","country":"IN","postal_code":"560001"}',
   '[{"product_id":"de202610-2200-4000-8000-000000000601","quantity":1}]','cod','DEMO only — no payment, fulfillment or contact authorized.',NULL,NULL,'standard','local-console-demo-apparel-20261022',NULL,'local-console-demo-20261022');
  UPDATE products SET name='DEMO — Cotton Tee (new catalog name)',price=549 WHERE id='de202610-2200-4000-8000-000000000601';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM checkout_sessions WHERE site_id='de202610-2200-4000-8000-000000000203' AND idempotency_key='local-console-demo-crafts-20261022') THEN
  PERFORM set_config('app.site_id','de202610-2200-4000-8000-000000000203',true);
  PERFORM create_checkout_order('de202610-2200-4000-8000-000000000203','DEMO sample buyer','demo-buyer@example.invalid',NULL,
   '{"line1":"DEMO address only","city":"Bengaluru","state":"Karnataka","state_code":"29","country":"IN","postal_code":"560001"}',
   '[{"product_id":"de202610-2200-4000-8000-000000000605","quantity":2}]','cod','DEMO only — no payment, fulfillment or contact authorized.',NULL,NULL,'standard','local-console-demo-crafts-20261022',NULL,'local-console-demo-20261022');
 END IF;
 PERFORM set_config('app.site_id','',true);
END $$;

INSERT INTO support_tickets(id,ticket_ref,site_id,subject,topic,priority,status,requester_type,requester_user_id,requester_email,channel,metadata,created_at) VALUES
 ('de202610-2200-4000-8000-000000000701','DEMO-SUP-001','de202610-2200-4000-8000-000000000201','DEMO — Help publishing the first theme','themes','high','open','merchant','de202610-2200-4000-8000-000000000101','demo-lotus@example.invalid','in_app','{"local_demo":"console-20261022"}',now()-interval '6 hours'),
 ('de202610-2200-4000-8000-000000000702','DEMO-SUP-002','de202610-2200-4000-8000-000000000202','DEMO — Subscription payment needs review','billing','urgent','pending_internal','merchant','de202610-2200-4000-8000-000000000101','demo-lotus@example.invalid','in_app','{"local_demo":"console-20261022"}',now()-interval '1 day'),
 ('de202610-2200-4000-8000-000000000703','DEMO-SUP-003','de202610-2200-4000-8000-000000000203','DEMO — Waiting for delivery-zone details','onboarding','normal','pending_customer','merchant','de202610-2200-4000-8000-000000000102','demo-crafts@example.invalid','in_app','{"local_demo":"console-20261022"}',now()-interval '2 days')
ON CONFLICT(id) DO NOTHING;
INSERT INTO ticket_messages(id,ticket_id,author_type,author_id,author_email,visibility,body,metadata) VALUES
 ('de202610-2200-4000-8000-000000000711','de202610-2200-4000-8000-000000000701','requester','de202610-2200-4000-8000-000000000101','demo-lotus@example.invalid','public','DEMO request: I added products but need help reviewing my first theme release. This is sample text.','{"local_demo":"console-20261022"}'),
 ('de202610-2200-4000-8000-000000000712','de202610-2200-4000-8000-000000000702','requester','de202610-2200-4000-8000-000000000101','demo-lotus@example.invalid','public','DEMO request: Please explain this unpaid sample record for Lotus Home. Lotus Apparel is a separate store.','{"local_demo":"console-20261022"}'),
 ('de202610-2200-4000-8000-000000000713','de202610-2200-4000-8000-000000000702','system',NULL,NULL,'internal','DEMO internal note: compare the invoice state with payment state. No provider payment occurred. This note is hidden from the merchant projection.','{"local_demo":"console-20261022"}'),
 ('de202610-2200-4000-8000-000000000714','de202610-2200-4000-8000-000000000703','requester','de202610-2200-4000-8000-000000000102','demo-crafts@example.invalid','public','DEMO request: I will share the delivery areas later. The sample resolution clock is paused.','{"local_demo":"console-20261022"}')
ON CONFLICT(id) DO NOTHING;
INSERT INTO ticket_sla_clocks(id,ticket_id,clock_type,due_at,paused,metadata) VALUES
 ('de202610-2200-4000-8000-000000000721','de202610-2200-4000-8000-000000000701','first_response',now()-interval '1 hour',false,'{"local_demo":"console-20261022"}'),
 ('de202610-2200-4000-8000-000000000722','de202610-2200-4000-8000-000000000701','resolution',now()+interval '1 day',false,'{"local_demo":"console-20261022"}'),
 ('de202610-2200-4000-8000-000000000723','de202610-2200-4000-8000-000000000702','resolution',now()-interval '2 hours',false,'{"local_demo":"console-20261022"}'),
 ('de202610-2200-4000-8000-000000000724','de202610-2200-4000-8000-000000000703','resolution',now()+interval '1 day',true,'{"local_demo":"console-20261022"}')
ON CONFLICT(id) DO NOTHING;

-- Explicit synthetic history for two credential-less DEMO owners only. No normal accounts receive a copy.
INSERT INTO merchant_announcements(id,title,body,category,expires_at,audience_mode,target_user_ids,status,revision,published_at,published_count,created_by) VALUES
 ('de202610-2200-4000-8000-000000000801','DEMO — Festive advertising campaign','Sample invitation only. A real notice can explain campaign dates, eligibility and how to participate. No advertising campaign is running and no ad spend is authorized.','ad_campaigns',now()+interval '14 days','selected',ARRAY['de202610-2200-4000-8000-000000000101','de202610-2200-4000-8000-000000000102']::uuid[],'published',2,now(),2,'de202610-2200-4000-8000-000000000101'),
 ('de202610-2200-4000-8000-000000000802','DEMO — Merchant offer preview','Sample offer only. A real offer can include its terms and expiry. No subscription price, discount or billing record has been changed by this notice.','offers',now()+interval '7 days','selected',ARRAY['de202610-2200-4000-8000-000000000101','de202610-2200-4000-8000-000000000102']::uuid[],'published',2,now(),2,'de202610-2200-4000-8000-000000000101'),
 ('de202610-2200-4000-8000-000000000803','DEMO — Regulation update format','Sample compliance notice only. There is no new legal requirement in this example. A real notice should explain the verified change, affected merchants, deadline and required action.','regulations',NULL,'selected',ARRAY['de202610-2200-4000-8000-000000000101','de202610-2200-4000-8000-000000000102']::uuid[],'published',2,now(),2,'de202610-2200-4000-8000-000000000101'),
 ('de202610-2200-4000-8000-000000000804','DEMO — Product update draft','Sample draft for exploring Save draft and Review audience. It has not been published. Keep the selected DEMO accounts when trying the workflow.','platform_updates',NULL,'selected',ARRAY['de202610-2200-4000-8000-000000000101','de202610-2200-4000-8000-000000000102']::uuid[],'draft',1,NULL,0,'de202610-2200-4000-8000-000000000101')
ON CONFLICT(id) DO NOTHING;
INSERT INTO notifications(id,user_id,type,title,message,action_url,data,is_read)
SELECT ('de202610-2200-4000-8000-'||lpad((900+v.a*10+v.u)::text,12,'0'))::uuid,owners.owner,'system',a.title,a.body,NULL,
 jsonb_build_object('source','letbuyy_platform','merchant_announcement_id',a.id,'category',a.category,'expires_at',a.expires_at,'published_at',a.published_at,'local_demo','console-20261022'),v.a=3 AND v.u=1
FROM(VALUES(1,1),(1,2),(2,1),(2,2),(3,1),(3,2))v(a,u)
JOIN(VALUES(1,'de202610-2200-4000-8000-000000000101'::uuid),(2,'de202610-2200-4000-8000-000000000102'::uuid))owners(num,owner)ON owners.num=v.u
JOIN merchant_announcements a ON a.id=('de202610-2200-4000-8000-'||lpad((800+v.a)::text,12,'0'))::uuid
ON CONFLICT DO NOTHING;

SELECT jsonb_build_object('demo_stores',(SELECT count(*) FROM sites WHERE settings->>'local_demo'='console-20261022'),
 'demo_products',(SELECT count(*) FROM products WHERE metadata->>'local_demo'='console-20261022'),
 'demo_orders',(SELECT count(*) FROM checkout_sessions WHERE idempotency_key IN('local-console-demo-apparel-20261022','local-console-demo-crafts-20261022')),
 'demo_support_tickets',(SELECT count(*) FROM support_tickets WHERE metadata->>'local_demo'='console-20261022'),
 'demo_invoices',(SELECT count(*) FROM merchant_billing_invoices WHERE metadata->>'local_demo'='console-20261022'),
 'demo_announcements',(SELECT count(*) FROM merchant_announcements WHERE id BETWEEN 'de202610-2200-4000-8000-000000000801' AND 'de202610-2200-4000-8000-000000000804'),
 'demo_inbox_copies',(SELECT count(*) FROM notifications WHERE data->>'local_demo'='console-20261022'));
COMMIT;
