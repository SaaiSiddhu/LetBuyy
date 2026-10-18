-- N3.2: one versioned product edit, including its inventory, history, audit and retry receipt.
-- Existing inventory functions and the generic products version trigger remain authoritative.
BEGIN;

CREATE TABLE public.product_edit_receipts (
    idempotency_key uuid PRIMARY KEY,
    operation text NOT NULL CHECK (operation = 'product.update.v1'),
    store_id uuid NOT NULL,
    product_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    expected_version integer NOT NULL CHECK (expected_version > 0),
    mutation jsonb NOT NULL CHECK (jsonb_typeof(mutation) = 'object'),
    response jsonb NOT NULL CHECK (jsonb_typeof(response) = 'object'),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_edit_receipts_product_idx ON public.product_edit_receipts(store_id, product_id, created_at);
ALTER TABLE public.product_edit_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_edit_receipts FORCE ROW LEVEL SECURITY;
-- These are private transaction receipts, never a tenant-readable response cache.
-- No API role has direct table privileges or a permissive RLS policy.
REVOKE ALL ON TABLE public.product_edit_receipts FROM PUBLIC, anon, authenticated, app_tenant, service_role;

CREATE FUNCTION public.guard_product_edit_receipt_v1() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public, pg_temp AS $fn$
BEGIN
    RAISE EXCEPTION 'product edit receipts are immutable' USING ERRCODE = '42501';
END $fn$;
CREATE TRIGGER product_edit_receipts_immutable BEFORE UPDATE OR DELETE ON public.product_edit_receipts
    FOR EACH ROW EXECUTE FUNCTION public.guard_product_edit_receipt_v1();

-- Child writes also invalidate the parent edit token. This includes the canonical
-- variant inventory writers (sales, returns, transfers, stock adjustments), which
-- previously changed inventory_qty without advancing products.version.
CREATE FUNCTION public.bump_product_edit_revision_v1() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $fn$
BEGIN
    IF TG_OP = 'UPDATE' AND (to_jsonb(NEW) - 'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
        RETURN NEW;
    END IF;
    IF TG_OP <> 'INSERT' THEN
        UPDATE public.products SET variants=public.product_edit_snapshot_v1(OLD.product_id)->'variants',
            updated_at = clock_timestamp() WHERE id = OLD.product_id;
    END IF;
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id) THEN
        UPDATE public.products SET variants=public.product_edit_snapshot_v1(NEW.product_id)->'variants',
            updated_at = clock_timestamp() WHERE id = NEW.product_id;
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END $fn$;
CREATE TRIGGER product_variants_edit_revision AFTER INSERT OR UPDATE OR DELETE ON public.product_variants
    FOR EACH ROW EXECUTE FUNCTION public.bump_product_edit_revision_v1();
CREATE TRIGGER product_options_edit_revision AFTER INSERT OR UPDATE OR DELETE ON public.product_options
    FOR EACH ROW EXECUTE FUNCTION public.bump_product_edit_revision_v1();

-- Same owner / active employee and grant vocabulary as the canonical staff guard.
-- Locks keep account deletion, store transfer and staff revocation ordered with effects/replay.
CREATE FUNCTION public.assert_product_edit_actor_v1(p_store_id uuid, p_actor_id uuid, p_permission text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $fn$
DECLARE s public.sites%ROWTYPE; e record; allowed boolean := false;
BEGIN
    IF current_setting('role', true) IS DISTINCT FROM 'app_tenant'
       OR p_store_id IS NULL OR p_actor_id IS NULL OR p_permission NOT IN ('products:read','products:write')
       OR nullif(current_setting('app.site_id', true), '') IS DISTINCT FROM p_store_id::text
       OR nullif(current_setting('app.actor_id', true), '') IS DISTINCT FROM p_actor_id::text THEN
        RAISE EXCEPTION 'PRODUCT_EDIT_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    PERFORM id FROM public.users_custom WHERE id = p_actor_id FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_EDIT_FORBIDDEN' USING ERRCODE = '42501'; END IF;
    SELECT * INTO s FROM public.sites WHERE id = p_store_id AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_EDIT_FORBIDDEN' USING ERRCODE = '42501'; END IF;
    IF coalesce(s.custom_user_id = p_actor_id, false) OR coalesce(s.user_id = p_actor_id, false) THEN RETURN; END IF;
    FOR e IN SELECT permissions FROM public.employees
        WHERE store_id = p_store_id AND user_id = p_actor_id AND status = 'active'
          AND is_active = true AND deleted_at IS NULL FOR SHARE LOOP
        IF jsonb_typeof(e.permissions->'granted') = 'array' AND (
            e.permissions->'granted' ?| ARRAY['*','products:*',p_permission]
            OR (p_permission = 'products:read' AND e.permissions->'granted' ? 'products:write')) THEN
            allowed := true;
        END IF;
    END LOOP;
    IF NOT allowed THEN RAISE EXCEPTION 'PRODUCT_EDIT_FORBIDDEN' USING ERRCODE = '42501'; END IF;
END $fn$;

-- Internal snapshot shared by edit and read. Only guarded entry functions may call it.
CREATE FUNCTION public.product_edit_snapshot_v1(p_product_id uuid) RETURNS jsonb
LANGUAGE sql STABLE SET search_path = pg_catalog, public, pg_temp AS $fn$
    SELECT to_jsonb(p) || jsonb_build_object(
        'product_options', coalesce(o.items, '[]'::jsonb), 'options', coalesce(o.items, '[]'::jsonb),
        'variants', coalesce(v.items, '[]'::jsonb), 'product_variants', coalesce(v.items, '[]'::jsonb))
    FROM public.products p
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(to_jsonb(po) ORDER BY po.position, po.id) AS items,
            array_agg(po.name ORDER BY po.position, po.id) AS names
        FROM public.product_options po WHERE po.product_id = p.id
    ) o ON true
    LEFT JOIN LATERAL (
        SELECT jsonb_agg(jsonb_build_object(
            'id', pv.id, 'product_id', pv.product_id, 'title', pv.title,
            'price', pv.price, 'compare_price', pv.compare_price, 'sku', pv.sku, 'barcode', pv.barcode,
            'stock', pv.inventory_qty, 'inventory_qty', pv.inventory_qty, 'inventory_quantity', pv.inventory_qty,
            'weight', pv.weight, 'weight_unit', pv.weight_unit, 'image_url', pv.image_url, 'position', pv.position,
            'option1', pv.option1, 'option2', pv.option2, 'option3', pv.option3,
            'options', jsonb_strip_nulls(jsonb_build_object(
                coalesce(o.names[1], 'Option 1'), pv.option1,
                coalesce(o.names[2], 'Option 2'), pv.option2,
                coalesce(o.names[3], 'Option 3'), pv.option3))) ORDER BY pv.position, pv.id) AS items
        FROM public.product_variants pv WHERE pv.product_id = p.id
    ) v ON true
    WHERE p.id = p_product_id AND p.deleted_at IS NULL;
$fn$;

CREATE FUNCTION public.read_product_for_edit_v1(p_store_id uuid, p_product_id uuid, p_actor_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $fn$
BEGIN
    PERFORM public.assert_product_edit_actor_v1(p_store_id, p_actor_id, 'products:read');
    PERFORM id FROM public.products WHERE id = p_product_id AND store_id = p_store_id AND deleted_at IS NULL FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_EDIT_NOT_FOUND'; END IF;
    RETURN public.product_edit_snapshot_v1(p_product_id);
END $fn$;

CREATE FUNCTION public.apply_product_edit_v1(
    p_store_id uuid, p_product_id uuid, p_actor_id uuid, p_expected_version integer,
    p_idempotency_key uuid, p_mutation jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $fn$
DECLARE
    p public.products%ROWTYPE; before_product jsonb; receipt public.product_edit_receipts%ROWTYPE;
    fields jsonb; item jsonb; existing public.product_variants%ROWTYPE; v_variant_id uuid;
    retained uuid[] := ARRAY[]::uuid[]; removed uuid[]; option_names text[]; option_values text[];
    idx integer := 0; options jsonb; current_options jsonb; response jsonb; request_id text := nullif(current_setting('app.request_id', true), '');
BEGIN
    -- service_role inherits app_tenant's EXECUTE grant in164. An inherited grant
    -- must not turn the administrative REST role into this tenant transaction.
    IF current_setting('role', true) IS DISTINCT FROM 'app_tenant' THEN
        RAISE EXCEPTION 'PRODUCT_EDIT_FORBIDDEN' USING ERRCODE = '42501';
    END IF;
    IF p_expected_version IS NULL OR p_expected_version <= 0 OR p_idempotency_key IS NULL
       OR p_product_id IS NULL OR jsonb_typeof(p_mutation) IS DISTINCT FROM 'object'
       OR octet_length(p_mutation::text) > 1048576
       OR jsonb_typeof(p_mutation->'fields') IS DISTINCT FROM 'object'
       OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_mutation) k WHERE k NOT IN ('fields','stock','product_options','variants')) THEN
        RAISE EXCEPTION 'PRODUCT_EDIT_INVALID';
    END IF;
    fields := p_mutation->'fields';
    IF fields = '{}'::jsonb AND NOT (p_mutation ?| ARRAY['stock','product_options','variants']) THEN
        RAISE EXCEPTION 'PRODUCT_EDIT_INVALID';
    END IF;
    -- This allowlist is the DB immutability fence for the commerce-core plan. No identity,
    -- tenant, audit, version or raw variants cache column is writable from a mutation payload.
    IF EXISTS (SELECT 1 FROM jsonb_object_keys(fields) k WHERE k NOT IN (
        'name','description','price','compare_price','cost_per_item','images','category','product_type','vendor',
        'track_inventory','sku','barcode','sell_when_oos','is_physical','weight','weight_unit','country_of_origin',
        'importer_details','hs_code','hsn_code','url_handle','seo_title','seo_description','charge_tax',
        'shipping_profile_id','is_active','is_featured','tags','metadata','display_order','status')) THEN
        RAISE EXCEPTION 'PRODUCT_EDIT_INVALID';
    END IF;
    PERFORM public.assert_product_edit_actor_v1(p_store_id, p_actor_id, 'products:write');
    PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:product-edit:' || p_idempotency_key::text, 0));
    -- Match the canonical inventory writer's level -> variant -> parent order.
    -- The decisive version comparison remains on the final locked parent row.
    PERFORM il.id FROM public.inventory_levels il WHERE il.product_id=p_product_id AND il.store_id=p_store_id ORDER BY il.id FOR UPDATE;
    PERFORM pv.id FROM public.product_variants pv JOIN public.products target_product ON target_product.id=pv.product_id
        WHERE pv.product_id=p_product_id AND target_product.store_id=p_store_id ORDER BY pv.id FOR UPDATE OF pv;
    PERFORM po.id FROM public.product_options po JOIN public.products target_product ON target_product.id=po.product_id
        WHERE po.product_id=p_product_id AND target_product.store_id=p_store_id ORDER BY po.id FOR UPDATE OF po;
    SELECT * INTO p FROM public.products WHERE id = p_product_id AND store_id = p_store_id AND deleted_at IS NULL FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_EDIT_NOT_FOUND'; END IF;
    SELECT * INTO receipt FROM public.product_edit_receipts WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
        IF receipt.operation <> 'product.update.v1' OR receipt.actor_id IS DISTINCT FROM p_actor_id
           OR receipt.store_id IS DISTINCT FROM p_store_id OR receipt.product_id IS DISTINCT FROM p_product_id
           OR receipt.expected_version IS DISTINCT FROM p_expected_version OR receipt.mutation IS DISTINCT FROM p_mutation THEN
            RAISE EXCEPTION 'PRODUCT_EDIT_KEY_CONFLICT';
        END IF;
        RETURN receipt.response;
    END IF;
    IF p.version <= 0 OR p.version IS DISTINCT FROM p_expected_version THEN RAISE EXCEPTION 'PRODUCT_EDIT_VERSION_CONFLICT'; END IF;
    before_product := public.product_edit_snapshot_v1(p_product_id);
    IF (fields ? 'status' OR fields ? 'is_active') AND (
        jsonb_typeof(fields->'status') IS DISTINCT FROM 'string'
        OR fields->>'status' NOT IN ('active', 'draft', 'archived')
        OR fields->'is_active' IS DISTINCT FROM to_jsonb((fields->>'status') = 'active')
    ) THEN RAISE EXCEPTION 'PRODUCT_EDIT_INVALID'; END IF;

    -- Typed merge preserves omitted fields. Any later exception rolls this UPDATE back too.
    IF fields <> '{}'::jsonb THEN
        p := jsonb_populate_record(p, fields);
        IF length(btrim(p.name)) = 0 OR p.price < 0 OR
            ((fields ? 'price' OR fields ? 'compare_price') AND p.compare_price IS NOT NULL AND p.compare_price <= p.price) THEN
            RAISE EXCEPTION 'PRODUCT_EDIT_INVALID';
        END IF;
        UPDATE public.products target SET
            name=p.name, description=p.description, price=p.price, compare_price=p.compare_price,
            cost_per_item=p.cost_per_item, images=p.images, category=p.category, product_type=p.product_type,
            vendor=p.vendor, track_inventory=p.track_inventory, sku=p.sku, barcode=p.barcode,
            sell_when_oos=p.sell_when_oos, is_physical=p.is_physical, weight=p.weight, weight_unit=p.weight_unit,
            country_of_origin=p.country_of_origin, importer_details=p.importer_details, hs_code=p.hs_code, hsn_code=p.hsn_code,
            url_handle=p.url_handle, seo_title=p.seo_title, seo_description=p.seo_description, charge_tax=p.charge_tax,
            shipping_profile_id=p.shipping_profile_id, is_active=p.is_active, is_featured=p.is_featured,
            tags=p.tags, metadata=p.metadata, display_order=p.display_order, status=p.status,
            updated_by=p_actor_id, updated_at=clock_timestamp()
        WHERE target.id=p_product_id AND target.store_id=p_store_id;
    END IF;

    IF p_mutation ? 'product_options' THEN
        options := p_mutation->'product_options';
        IF jsonb_typeof(options) IS DISTINCT FROM 'array' OR jsonb_array_length(options)>10
           OR EXISTS (SELECT 1 FROM jsonb_array_elements(options) o WHERE jsonb_typeof(o) <> 'object'
                OR nullif(btrim(o->>'name'),'') IS NULL OR jsonb_typeof(o->'values') IS DISTINCT FROM 'array')
           OR (SELECT count(*) FROM jsonb_array_elements(options)) <>
              (SELECT count(DISTINCT lower(btrim(o->>'name'))) FROM jsonb_array_elements(options) o) THEN
            RAISE EXCEPTION 'PRODUCT_EDIT_INVALID';
        END IF;
        SELECT coalesce(jsonb_agg(jsonb_build_object('name',name,'position',position,'values',values) ORDER BY position,id),'[]'::jsonb)
            INTO current_options FROM public.product_options WHERE product_id=p_product_id;
        SELECT coalesce(jsonb_agg(jsonb_build_object('name',o->>'name','position',n-1,'values',o->'values') ORDER BY n),'[]'::jsonb)
            INTO options FROM jsonb_array_elements(options) WITH ORDINALITY AS entries(o,n);
        -- A full form often resends unchanged options. Replacing them would transiently
        -- invalidate an approved listing's material fingerprint even for a stock-only edit.
        IF current_options IS DISTINCT FROM options THEN
            DELETE FROM public.product_options WHERE product_id=p_product_id;
            INSERT INTO public.product_options(product_id,name,position,values)
                SELECT p_product_id, o->>'name', (n-1)::integer, o->'values'
                FROM jsonb_array_elements(options) WITH ORDINALITY AS entries(o,n);
        END IF;
    END IF;
    SELECT array_agg(name ORDER BY position,id) INTO option_names FROM public.product_options WHERE product_id=p_product_id;

    IF p_mutation ? 'variants' THEN
        IF jsonb_typeof(p_mutation->'variants') IS DISTINCT FROM 'array' OR jsonb_array_length(p_mutation->'variants')>100 THEN
            RAISE EXCEPTION 'PRODUCT_EDIT_INVALID';
        END IF;
        FOR item IN SELECT value FROM jsonb_array_elements(p_mutation->'variants') LOOP
            IF jsonb_typeof(item) IS DISTINCT FROM 'object' OR nullif(btrim(item->>'title'),'') IS NULL
               OR EXISTS (SELECT 1 FROM jsonb_object_keys(item) k WHERE k NOT IN ('id','title','price','price_override','compare_price','sku','barcode','stock','options')) THEN
                RAISE EXCEPTION 'PRODUCT_EDIT_INVALID';
            END IF;
            existing := NULL;
            IF item ? 'id' THEN
                v_variant_id := (item->>'id')::uuid;
                IF v_variant_id IS NULL OR v_variant_id = ANY(retained) THEN RAISE EXCEPTION 'PRODUCT_EDIT_VARIANT_ID'; END IF;
                SELECT * INTO existing FROM public.product_variants WHERE id=v_variant_id AND product_id=p_product_id FOR UPDATE;
                IF NOT FOUND THEN RAISE EXCEPTION 'PRODUCT_EDIT_VARIANT_ID'; END IF;
            ELSE
                v_variant_id := gen_random_uuid();
            END IF;
            retained := array_append(retained,v_variant_id);
            option_values := ARRAY[existing.option1,existing.option2,existing.option3];
            IF item ? 'options' THEN
                IF jsonb_typeof(item->'options') IS DISTINCT FROM 'object' OR
                    (SELECT count(*) FROM jsonb_object_keys(item->'options'))>3 THEN RAISE EXCEPTION 'PRODUCT_EDIT_INVALID'; END IF;
                -- Canonical option positions, including explicit legacy unnamed slots. Do not
                -- depend on JSON key iteration order or truncate additional option dimensions.
                IF option_names IS NULL THEN
                    SELECT array_agg(key ORDER BY key) INTO option_names FROM jsonb_each(item->'options');
                END IF;
                IF EXISTS (SELECT 1 FROM jsonb_object_keys(item->'options') k WHERE NOT k=ANY(coalesce(option_names,ARRAY[]::text[])))
                    OR coalesce(array_length(option_names,1),0)>3 THEN RAISE EXCEPTION 'PRODUCT_EDIT_INVALID'; END IF;
                option_values := ARRAY[item->'options'->>option_names[1],item->'options'->>option_names[2],item->'options'->>option_names[3]];
            END IF;
            IF existing.id IS NULL THEN
                INSERT INTO public.product_variants(id,product_id,title,price,compare_price,sku,barcode,inventory_qty,option1,option2,option3,position)
                    VALUES(v_variant_id,p_product_id,item->>'title',coalesce((item->>'price')::numeric,(item->>'price_override')::numeric,p.price),
                        (item->>'compare_price')::numeric,item->>'sku',item->>'barcode',0,option_values[1],option_values[2],option_values[3],idx);
            ELSE
                UPDATE public.product_variants SET title=item->>'title',
                    price=CASE WHEN item ? 'price' OR item ? 'price_override' THEN coalesce((item->>'price')::numeric,(item->>'price_override')::numeric,p.price) ELSE existing.price END,
                    compare_price=CASE WHEN item ? 'compare_price' THEN (item->>'compare_price')::numeric ELSE existing.compare_price END,
                    sku=CASE WHEN item ? 'sku' THEN item->>'sku' ELSE existing.sku END,
                    barcode=CASE WHEN item ? 'barcode' THEN item->>'barcode' ELSE existing.barcode END,
                    option1=option_values[1], option2=option_values[2], option3=option_values[3], position=idx, updated_at=clock_timestamp()
                    WHERE id=v_variant_id AND product_id=p_product_id;
            END IF;
            IF item ? 'stock' OR existing.id IS NULL THEN
                IF item ? 'stock' AND (jsonb_typeof(item->'stock') <> 'number' OR (item->>'stock') !~ '^[0-9]+$') THEN
                    RAISE EXCEPTION 'PRODUCT_EDIT_INVALID';
                END IF;
                PERFORM public.set_inventory_level_available(p_product_id,v_variant_id,NULL,coalesce((item->>'stock')::integer,0),
                    p_actor_id,'adjustment','product.update',p_idempotency_key::text||':'||v_variant_id::text);
            END IF;
            idx := idx+1;
        END LOOP;
        SELECT array_agg(id) INTO removed FROM public.product_variants WHERE product_id=p_product_id AND NOT id=ANY(retained);
        -- Stable stock/history/reservation references cannot be destroyed by an omitted ID.
        IF EXISTS (SELECT 1 FROM public.inventory_levels WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.product_price_observations WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.inventory_reservations WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.inventory_adjustments WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.inventory_events WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.fulfillment_order_lines WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.inventory_transfer_lines WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.inventory_transfer_receipts WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.purchase_order_lines WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.purchase_order_receipts WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.restock_events WHERE variant_id=ANY(removed))
           OR EXISTS (SELECT 1 FROM public.return_lines WHERE variant_id=ANY(removed)) THEN
            RAISE EXCEPTION 'PRODUCT_EDIT_VARIANT_REMOVAL';
        END IF;
        DELETE FROM public.product_variants WHERE product_id=p_product_id AND id=ANY(removed);
    END IF;
    IF p_mutation ? 'stock' THEN
        IF jsonb_typeof(p_mutation->'stock') <> 'number' OR (p_mutation->>'stock') !~ '^[0-9]+$' THEN RAISE EXCEPTION 'PRODUCT_EDIT_INVALID'; END IF;
        PERFORM public.set_inventory_level_available(p_product_id,NULL,NULL,(p_mutation->>'stock')::integer,
            p_actor_id,'adjustment','product.update',p_idempotency_key::text||':default');
    END IF;
    -- Existing trigger semantics may advance the version several times inside this atomic
    -- transaction. Return the exact final token; a client must never calculate its next version.
    UPDATE public.products SET variants=public.product_edit_snapshot_v1(p_product_id)->'variants',
        updated_by=p_actor_id,updated_at=clock_timestamp() WHERE id=p_product_id AND store_id=p_store_id;
    response := public.product_edit_snapshot_v1(p_product_id);
    INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,payload,idempotency_key,request_id,actor_id,schema_version)
        VALUES(p_store_id,p_store_id,'product',p_product_id::text,'product.updated',
            jsonb_build_object('site_id',p_store_id,'product_id',p_product_id,'handle',coalesce(response->>'url_handle',response->>'slug'),
                'status',coalesce(response->>'status','draft')),
            'product.updated:'||p_idempotency_key::text,request_id,p_actor_id,1);
    INSERT INTO public.audit_activity_events(store_id,actor_id,actor_type,action,resource_type,resource_id,request_id,before_state,after_state,metadata)
        VALUES(p_store_id,p_actor_id,'user','product.updated','product',p_product_id::text,request_id,before_product,response,
            jsonb_build_object('idempotency_key',p_idempotency_key,'expected_version',p_expected_version,'version',response->'version'));
    INSERT INTO public.product_edit_receipts(idempotency_key,operation,store_id,product_id,actor_id,expected_version,mutation,response)
        VALUES(p_idempotency_key,'product.update.v1',p_store_id,p_product_id,p_actor_id,p_expected_version,p_mutation,response);
    RETURN response;
END $fn$;

REVOKE ALL ON FUNCTION public.guard_product_edit_receipt_v1(), public.bump_product_edit_revision_v1(),
    public.assert_product_edit_actor_v1(uuid,uuid,text), public.product_edit_snapshot_v1(uuid),
    public.read_product_for_edit_v1(uuid,uuid,uuid), public.apply_product_edit_v1(uuid,uuid,uuid,integer,uuid,jsonb)
    FROM PUBLIC, anon, authenticated, app_tenant, service_role;
GRANT EXECUTE ON FUNCTION public.read_product_for_edit_v1(uuid,uuid,uuid),
    public.apply_product_edit_v1(uuid,uuid,uuid,integer,uuid,jsonb) TO app_tenant;
COMMIT;
