// Compatibility transport over the one canonical collections authority.
// Old smart_collections is a sealed migration source, never a live second writer.
import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
    SmartCollectionSchema, SmartCollectionPageSchema, SmartCollectionListQuerySchema,
    SmartCollectionPreviewQuerySchema, CreateSmartCollectionSchema, UpdateSmartCollectionSchema,
    UuidSchema, type CollectionMetadata, type SmartCollection,
    type CreateSmartCollectionInput, type UpdateSmartCollectionInput,
} from '@letbuyy/shared-types';
import type { Env } from '../index';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';
import { resolveCollectionStoreScope } from '../lib/collection-store-scope';
import { validate } from '../middleware/validation';
import { success } from '../lib/supabase';
import { readCollectionMetadata, readCollectionMetadataPage, executeCollectionMetadataCommand, previewCollectionRules } from '../execution/collection-metadata.adapter';

const router = new Hono<{ Bindings: Env }>();
const IdSchema = z.object({ id: UuidSchema }).strict();
router.use('*', async (c, next) => { c.header('Cache-Control', 'private, no-store'); await next(); });

type AppContext = Context<{ Bindings: Env }>;
function selectedStore(c: AppContext, requested?: string): string {
    const selected = requested || c.req.query('store_id') || c.req.header('X-Store-ID') || c.get('auth').user.storeId;
    if (!UuidSchema.safeParse(selected).success) throw new ValidationError('Select a store before continuing.');
    const header = c.req.header('X-Store-ID'), session = c.get('auth').user.storeId;
    if (header && header !== selected || session && session !== selected) throw new ForbiddenError('The selected store changed.');
    return selected!;
}
function key(c: AppContext): string {
    const first = c.req.header('X-Idempotency-Key'), second = c.req.header('Idempotency-Key');
    const value = first || second;
    if (first && second && first !== second || !UuidSchema.safeParse(value).success) {
        throw new ValidationError('Keep the original collection save key.');
    }
    return value!;
}
function projection(value: CollectionMetadata): SmartCollection {
    if (value.collection_type !== 'smart') throw new NotFoundError('Smart collection not found.');
    return SmartCollectionSchema.parse({ id: value.id, store_id: value.store_id, name: value.title, slug: value.slug,
        description: value.description, conditions: value.conditions, match_type: value.match_type, is_active: value.is_active,
        created_at: value.created_at, created_by: value.created_by, updated_by: value.updated_by, version: value.version });
}

router.get('/', validate('query', SmartCollectionListQuerySchema), async c => {
    const query = c.get('validatedQuery') as z.infer<typeof SmartCollectionListQuerySchema>;
    const scope = await resolveCollectionStoreScope(c, selectedStore(c, query.store_id), 'products:read');
    const page = await readCollectionMetadataPage(c.env, scope, 'smart', query.page, query.limit, query.search || '');
    const result = SmartCollectionPageSchema.safeParse({ ...page, data: page.data.map(projection) });
    if (!result.success) throw new AppError('The collection list could not be confirmed. Retry loading it.', 503, 'COLLECTIONS_UNCONFIRMED');
    return c.json(result.data);
});
router.get('/:id/preview', validate('param', IdSchema), validate('query', SmartCollectionPreviewQuerySchema), async c => {
    const scope = await resolveCollectionStoreScope(c, selectedStore(c), 'products:read');
    return c.json(success(await previewCollectionRules(c.env, scope, c.req.param('id'))));
});
router.get('/:id', validate('param', IdSchema), validate('query', SmartCollectionPreviewQuerySchema), async c => {
    const scope = await resolveCollectionStoreScope(c, selectedStore(c), 'products:read');
    return c.json(success(projection(await readCollectionMetadata(c.env, scope, c.req.param('id')))));
});
router.post('/', validate('json', CreateSmartCollectionSchema), async c => {
    const body = c.get('validatedBody') as CreateSmartCollectionInput;
    const scope = await resolveCollectionStoreScope(c, selectedStore(c, body.store_id), 'products:write');
    const receipt = await executeCollectionMetadataCommand(c.env, scope, 'create', null, {
        store_id: scope.siteId, idempotency_key: key(c), collection_type: 'smart', title: body.name,
        slug: body.slug, description: body.description, conditions: body.conditions, match_type: body.match_type,
        is_active: body.is_active,
    });
    return c.json(success(receipt), 201);
});
router.patch('/:id', validate('param', IdSchema), validate('json', UpdateSmartCollectionSchema), async c => {
    const body = c.get('validatedBody') as UpdateSmartCollectionInput;
    const scope = await resolveCollectionStoreScope(c, selectedStore(c), 'products:write');
    const { name, ...fields } = body;
    const receipt = await executeCollectionMetadataCommand(c.env, scope, 'update', c.req.param('id'), {
        ...fields, ...(name !== undefined ? { title: name } : {}), collection_type: 'smart', store_id: scope.siteId, idempotency_key: key(c),
    });
    return c.json(success(receipt));
});
router.delete('/:id', validate('param', IdSchema), validate('json', z.object({ version: z.number().int().positive() }).strict()), async c => {
    const body = c.get('validatedBody') as { version: number };
    const scope = await resolveCollectionStoreScope(c, selectedStore(c), 'products:write');
    const receipt = await executeCollectionMetadataCommand(c.env, scope, 'delete', c.req.param('id'), {
        collection_type: 'smart', store_id: scope.siteId, idempotency_key: key(c), version: body.version,
    });
    return c.json(success(receipt));
});

export default router;
