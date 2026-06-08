import { Hono, type Context } from 'hono';
import { z } from 'zod';
import type {
    StoreMetafieldDefinition,
    StoreMetafieldOwnerType,
    StoreMetafieldValue,
    StoreMetafieldValueType,
    StoreMetafieldsSummary,
} from '@letbuyy/shared-types';
import type { Env } from '../index';
import { resolveCustomUser } from '../lib/auth-user';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { validate } from '../middleware/validation';

type MetafieldsRouter = Hono<{ Bindings: Env }>;
type MetafieldError = { code: string; message: string };
type JsonValue = string | number | boolean | null | Record<string, unknown> | unknown[];

type OwnedMetafieldStore =
    | {
        ok: true;
        db: ReturnType<typeof getSupabaseAdmin>;
        actorId: string;
        storeId: string;
    }
    | {
        ok: false;
        status: 403 | 404 | 500;
        error: MetafieldError;
    };

const MetafieldOwnerTypeSchema = z.enum(['store', 'product', 'variant', 'collection', 'customer', 'order', 'page', 'theme']);
const MetafieldValueTypeSchema = z.enum([
    'single_line_text',
    'multi_line_text',
    'number_integer',
    'number_decimal',
    'boolean',
    'json',
    'date',
    'url',
]);
const MetafieldMetadataSchema = z.record(z.string(), z.unknown()).default({});
const MetafieldJsonValueSchema = z.unknown().refine((value) => value !== undefined, 'Metafield value is required.');

const CreateMetafieldDefinitionSchema = z.object({
    store_id: z.string().uuid(),
    owner_type: MetafieldOwnerTypeSchema.default('store'),
    namespace: z.string().trim().min(1).max(80).default('custom'),
    key: z.string().trim().min(1).max(120),
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().max(1000).optional().nullable(),
    value_type: MetafieldValueTypeSchema.default('single_line_text'),
    validation_rules: MetafieldMetadataSchema.optional(),
    is_required: z.boolean().optional().default(false),
    is_public: z.boolean().optional().default(false),
    sort_order: z.number().int().min(0).max(100000).optional().default(0),
    metadata: MetafieldMetadataSchema.optional(),
}).strict();

const UpdateMetafieldDefinitionSchema = CreateMetafieldDefinitionSchema
    .omit({ store_id: true })
    .partial()
    .strict();

const UpsertMetafieldValueSchema = z.object({
    store_id: z.string().uuid(),
    definition_id: z.string().uuid(),
    owner_type: MetafieldOwnerTypeSchema,
    owner_id: z.string().trim().min(1).max(160),
    value: MetafieldJsonValueSchema,
    metadata: MetafieldMetadataSchema.optional(),
}).strict();

type CreateMetafieldDefinitionInput = z.infer<typeof CreateMetafieldDefinitionSchema>;
type UpdateMetafieldDefinitionInput = z.infer<typeof UpdateMetafieldDefinitionSchema>;
type UpsertMetafieldValueInput = z.infer<typeof UpsertMetafieldValueSchema>;
type MetafieldDefinitionRow = StoreMetafieldDefinition;
type MetafieldValueRow = StoreMetafieldValue;

const definitionSelect = 'id,store_id,owner_type,namespace,key,name,description,value_type,validation_rules,is_required,is_public,sort_order,created_by,updated_by,deleted_by,created_at,updated_at,deleted_at,metadata';
const valueSelect = 'id,store_id,definition_id,owner_type,owner_id,value,created_by,updated_by,deleted_by,created_at,updated_at,deleted_at,metadata';

function isMissingDeletedAtError(error: { message?: string } | null | undefined): boolean {
    return Boolean(error?.message?.includes('sites.deleted_at') && error.message.includes('does not exist'));
}

function isMissingTableError(error: { message?: string } | null | undefined, tableName: string): boolean {
    const message = String(error?.message || '').toLowerCase();
    return message.includes(tableName.toLowerCase()) && (
        message.includes('does not exist') ||
        message.includes('schema cache') ||
        message.includes('could not find')
    );
}

function normalizeNamespace(value: string | null | undefined): string {
    return String(value || 'custom').trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_') || 'custom';
}

function normalizeKey(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
}

function parseOwnerType(value: string | undefined | null): StoreMetafieldOwnerType | null {
    const parsed = MetafieldOwnerTypeSchema.safeParse(value);
    return parsed.success ? parsed.data : null;
}

function isJsonObject(value: JsonValue): value is Record<string, unknown> {
    return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asJsonValue(value: unknown): JsonValue {
    if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        Array.isArray(value) ||
        (typeof value === 'object' && value !== null)
    ) {
        return value as JsonValue;
    }
    return null;
}

function validateMetafieldValue(value: JsonValue, valueType: StoreMetafieldValueType): string | null {
    switch (valueType) {
        case 'single_line_text':
            return typeof value === 'string' && !value.includes('\n') ? null : 'Use a single line of text.';
        case 'multi_line_text':
            return typeof value === 'string' ? null : 'Use text for this metafield.';
        case 'number_integer':
            return typeof value === 'number' && Number.isInteger(value) ? null : 'Use a whole number.';
        case 'number_decimal':
            return typeof value === 'number' && Number.isFinite(value) ? null : 'Use a decimal number.';
        case 'boolean':
            return typeof value === 'boolean' ? null : 'Use true or false.';
        case 'date':
            return typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? null : 'Use a valid date.';
        case 'url':
            return typeof value === 'string' && /^https?:\/\/\S+$/i.test(value) ? null : 'Use a valid URL.';
        case 'json':
            return value === null || Array.isArray(value) || isJsonObject(value) ? null : 'Use JSON for this metafield.';
        default:
            return 'Unsupported metafield type.';
    }
}

async function resolveOwnedMetafieldStore(
    c: Context<{ Bindings: Env }>,
    storeId: string,
): Promise<OwnedMetafieldStore> {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!customUser) {
        return {
            ok: false,
            status: 403,
            error: { code: 'FORBIDDEN', message: 'User profile not found' },
        };
    }

    const buildStoreQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('id')
            .eq('id', storeId)
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data: store, error } = await buildStoreQuery(true).maybeSingle();
    if (isMissingDeletedAtError(error)) {
        ({ data: store, error } = await buildStoreQuery(false).maybeSingle());
    }

    if (error) {
        return {
            ok: false,
            status: 500,
            error: { code: 'METAFIELDS_UNAVAILABLE', message: 'Custom data is temporarily unavailable.' },
        };
    }

    if (!store) {
        return {
            ok: false,
            status: 404,
            error: { code: 'NOT_FOUND', message: 'Store not found' },
        };
    }

    return { ok: true, db, actorId: customUser.id, storeId };
}

async function loadDefinitions(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    ownerType?: StoreMetafieldOwnerType | null,
): Promise<{ rows: MetafieldDefinitionRow[]; schemaReady: boolean; error: { message?: string } | null }> {
    let query = db
        .from('store_metafield_definitions')
        .select(definitionSelect)
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true })
        .order('updated_at', { ascending: false })
        .limit(250);

    if (ownerType) query = query.eq('owner_type', ownerType);

    const { data, error } = await query;
    if (isMissingTableError(error, 'store_metafield_definitions')) {
        return { rows: [], schemaReady: false, error: null };
    }

    return { rows: (data || []) as MetafieldDefinitionRow[], schemaReady: true, error };
}

async function loadValues(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    ownerType?: StoreMetafieldOwnerType | null,
    ownerId?: string | null,
): Promise<{ rows: MetafieldValueRow[]; schemaReady: boolean; error: { message?: string } | null }> {
    let query = db
        .from('store_metafield_values')
        .select(valueSelect)
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(250);

    if (ownerType) query = query.eq('owner_type', ownerType);
    if (ownerId) query = query.eq('owner_id', ownerId);

    const { data, error } = await query;
    if (isMissingTableError(error, 'store_metafield_values')) {
        return { rows: [], schemaReady: false, error: null };
    }

    return { rows: (data || []) as MetafieldValueRow[], schemaReady: true, error };
}

async function buildMetafieldsSummary(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    ownerType: StoreMetafieldOwnerType,
    ownerId: string,
): Promise<StoreMetafieldsSummary> {
    const [definitionsResult, valuesResult] = await Promise.all([
        loadDefinitions(db, storeId, ownerType),
        loadValues(db, storeId, ownerType, ownerId),
    ]);

    if (definitionsResult.error || valuesResult.error) {
        throw new Error('METAFIELDS_READ_FAILED');
    }

    return {
        store_id: storeId,
        owner_type: ownerType,
        owner_id: ownerId,
        definitions: definitionsResult.rows,
        values: valuesResult.rows,
        schema_ready: definitionsResult.schemaReady && valuesResult.schemaReady,
        metadata: { source: 'api-gateway.metafields' },
    };
}

const router: MetafieldsRouter = new Hono<{ Bindings: Env }>();

router.get('/definitions', async (c) => {
    const storeId = c.req.query('store_id');
    if (!storeId) return c.json({ error: { code: 'VALIDATION', message: 'store_id is required.' } }, 400);

    const ownerType = parseOwnerType(c.req.query('owner_type'));
    const owned = await resolveOwnedMetafieldStore(c, storeId);
    if (!owned.ok) return c.json({ error: owned.error }, owned.status);

    const result = await loadDefinitions(owned.db, owned.storeId, ownerType);
    if (result.error) {
        return c.json({ error: { code: 'METAFIELDS_UNAVAILABLE', message: 'Custom data definitions could not load.' } }, 503);
    }

    return c.json(success(result.rows));
});

router.post('/definitions', validate('json', CreateMetafieldDefinitionSchema), async (c) => {
    const body = c.get('validatedBody') as CreateMetafieldDefinitionInput;
    const owned = await resolveOwnedMetafieldStore(c, body.store_id);
    if (!owned.ok) return c.json({ error: owned.error }, owned.status);

    const { data, error } = await owned.db
        .from('store_metafield_definitions')
        .insert({
            store_id: owned.storeId,
            owner_type: body.owner_type,
            namespace: normalizeNamespace(body.namespace),
            key: normalizeKey(body.key),
            name: body.name,
            description: body.description || null,
            value_type: body.value_type,
            validation_rules: body.validation_rules || {},
            is_required: body.is_required,
            is_public: body.is_public,
            sort_order: body.sort_order,
            metadata: body.metadata || {},
            created_by: owned.actorId,
            updated_by: owned.actorId,
        })
        .select(definitionSelect)
        .single();

    if (error || !data) {
        return c.json({ error: { code: 'METAFIELDS_UNAVAILABLE', message: 'Custom data definition could not be saved.' } }, 503);
    }

    return c.json(success(data as MetafieldDefinitionRow), 201);
});

router.patch('/definitions/:definitionId', validate('json', UpdateMetafieldDefinitionSchema), async (c) => {
    const storeId = c.req.query('store_id');
    if (!storeId) return c.json({ error: { code: 'VALIDATION', message: 'store_id is required.' } }, 400);

    const body = c.get('validatedBody') as UpdateMetafieldDefinitionInput;
    const owned = await resolveOwnedMetafieldStore(c, storeId);
    if (!owned.ok) return c.json({ error: owned.error }, owned.status);

    const updates: Record<string, unknown> = { updated_by: owned.actorId };
    for (const key of ['owner_type', 'name', 'description', 'value_type', 'validation_rules', 'is_required', 'is_public', 'sort_order', 'metadata'] as const) {
        if (body[key] !== undefined) updates[key] = body[key];
    }
    if (body.namespace !== undefined) updates.namespace = normalizeNamespace(body.namespace);
    if (body.key !== undefined) updates.key = normalizeKey(body.key);

    const { data, error } = await owned.db
        .from('store_metafield_definitions')
        .update(updates)
        .eq('id', c.req.param('definitionId'))
        .eq('store_id', owned.storeId)
        .is('deleted_at', null)
        .select(definitionSelect)
        .maybeSingle();

    if (error) {
        return c.json({ error: { code: 'METAFIELDS_UNAVAILABLE', message: 'Custom data definition could not be saved.' } }, 503);
    }
    if (!data) return c.json({ error: { code: 'NOT_FOUND', message: 'Custom data definition not found.' } }, 404);

    return c.json(success(data as MetafieldDefinitionRow));
});

router.delete('/definitions/:definitionId', async (c) => {
    const storeId = c.req.query('store_id');
    if (!storeId) return c.json({ error: { code: 'VALIDATION', message: 'store_id is required.' } }, 400);

    const owned = await resolveOwnedMetafieldStore(c, storeId);
    if (!owned.ok) return c.json({ error: owned.error }, owned.status);

    const { data, error } = await owned.db
        .from('store_metafield_definitions')
        .update({ deleted_at: new Date().toISOString(), deleted_by: owned.actorId })
        .eq('id', c.req.param('definitionId'))
        .eq('store_id', owned.storeId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();

    if (error) {
        return c.json({ error: { code: 'METAFIELDS_UNAVAILABLE', message: 'Custom data definition could not be deleted.' } }, 503);
    }
    if (!data) return c.json({ error: { code: 'NOT_FOUND', message: 'Custom data definition not found.' } }, 404);

    await owned.db
        .from('store_metafield_values')
        .update({ deleted_at: new Date().toISOString(), deleted_by: owned.actorId })
        .eq('definition_id', c.req.param('definitionId'))
        .eq('store_id', owned.storeId)
        .is('deleted_at', null);

    return c.json(success({ id: c.req.param('definitionId') }));
});

router.get('/values', async (c) => {
    const storeId = c.req.query('store_id');
    if (!storeId) return c.json({ error: { code: 'VALIDATION', message: 'store_id is required.' } }, 400);

    const ownerType = parseOwnerType(c.req.query('owner_type')) || 'store';
    const ownerId = c.req.query('owner_id') || storeId;
    const owned = await resolveOwnedMetafieldStore(c, storeId);
    if (!owned.ok) return c.json({ error: owned.error }, owned.status);

    try {
        return c.json(success(await buildMetafieldsSummary(owned.db, owned.storeId, ownerType, ownerId)));
    } catch {
        return c.json({ error: { code: 'METAFIELDS_UNAVAILABLE', message: 'Custom data could not load.' } }, 503);
    }
});

router.put('/values', validate('json', UpsertMetafieldValueSchema), async (c) => {
    const body = c.get('validatedBody') as UpsertMetafieldValueInput;
    const owned = await resolveOwnedMetafieldStore(c, body.store_id);
    if (!owned.ok) return c.json({ error: owned.error }, owned.status);

    const { data: definition, error: definitionError } = await owned.db
        .from('store_metafield_definitions')
        .select('id,owner_type,value_type')
        .eq('id', body.definition_id)
        .eq('store_id', owned.storeId)
        .is('deleted_at', null)
        .maybeSingle();

    if (definitionError) {
        return c.json({ error: { code: 'METAFIELDS_UNAVAILABLE', message: 'Custom data definition could not load.' } }, 503);
    }
    if (!definition) return c.json({ error: { code: 'NOT_FOUND', message: 'Custom data definition not found.' } }, 404);
    if (definition.owner_type !== body.owner_type) {
        return c.json({ error: { code: 'VALIDATION', message: 'Custom data owner type does not match the definition.' } }, 400);
    }

    const value = asJsonValue(body.value);
    const validationError = validateMetafieldValue(value, definition.value_type as StoreMetafieldValueType);
    if (validationError) return c.json({ error: { code: 'VALIDATION', message: validationError } }, 400);

    const { data: existing, error: existingError } = await owned.db
        .from('store_metafield_values')
        .select('id')
        .eq('definition_id', body.definition_id)
        .eq('owner_type', body.owner_type)
        .eq('owner_id', body.owner_id)
        .eq('store_id', owned.storeId)
        .is('deleted_at', null)
        .maybeSingle();

    if (existingError) {
        return c.json({ error: { code: 'METAFIELDS_UNAVAILABLE', message: 'Custom data could not load.' } }, 503);
    }

    const payload = {
        store_id: owned.storeId,
        definition_id: body.definition_id,
        owner_type: body.owner_type,
        owner_id: body.owner_id,
        value,
        metadata: body.metadata || {},
        updated_by: owned.actorId,
    };

    const write = existing?.id
        ? owned.db
            .from('store_metafield_values')
            .update(payload)
            .eq('id', existing.id)
            .eq('store_id', owned.storeId)
            .select(valueSelect)
            .single()
        : owned.db
            .from('store_metafield_values')
            .insert({ ...payload, created_by: owned.actorId })
            .select(valueSelect)
            .single();

    const { data, error } = await write;
    if (error || !data) {
        return c.json({ error: { code: 'METAFIELDS_UNAVAILABLE', message: 'Custom data could not be saved.' } }, 503);
    }

    return c.json(success(data as MetafieldValueRow), existing?.id ? 200 : 201);
});

router.delete('/values/:valueId', async (c) => {
    const storeId = c.req.query('store_id');
    if (!storeId) return c.json({ error: { code: 'VALIDATION', message: 'store_id is required.' } }, 400);

    const owned = await resolveOwnedMetafieldStore(c, storeId);
    if (!owned.ok) return c.json({ error: owned.error }, owned.status);

    const { data, error } = await owned.db
        .from('store_metafield_values')
        .update({ deleted_at: new Date().toISOString(), deleted_by: owned.actorId })
        .eq('id', c.req.param('valueId'))
        .eq('store_id', owned.storeId)
        .is('deleted_at', null)
        .select('id')
        .maybeSingle();

    if (error) {
        return c.json({ error: { code: 'METAFIELDS_UNAVAILABLE', message: 'Custom data could not be deleted.' } }, 503);
    }
    if (!data) return c.json({ error: { code: 'NOT_FOUND', message: 'Custom data value not found.' } }, 404);

    return c.json(success({ id: c.req.param('valueId') }));
});

export default router;
