-- Keep installed themes, drafts and releases recoverable; retire only catalog discovery.
BEGIN;
UPDATE public.themes SET catalog_visible=false WHERE id IN ('7b669c70-0000-4000-8000-000000000001'::uuid,'7b669c70-0000-4000-8000-000000000002'::uuid,'7b669c70-0000-4000-8000-000000000003'::uuid,'7b669c70-0000-4000-8000-000000000004'::uuid,'7b669c70-0000-4000-8000-000000000005'::uuid,'7b669c70-0000-4000-8000-000000000006'::uuid,'7b669c70-0000-4000-8000-000000000007'::uuid,'7b669c70-0000-4000-8000-000000000008'::uuid,'7b669c70-0000-4000-8000-000000000009'::uuid,'7b669c70-0000-4000-8000-000000000010'::uuid)
 AND owned_by_site_id IS NULL AND NOT is_site_private;
UPDATE public.themes SET catalog_visible=true WHERE slug IN ('letbuyy-core','urban-kicks') AND owned_by_site_id IS NULL AND NOT is_site_private;
COMMIT;
