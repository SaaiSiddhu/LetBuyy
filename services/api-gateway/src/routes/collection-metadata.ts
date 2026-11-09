// Existing manual collection transport; all metadata effects belong to435's
// guarded canonical collections command, including original-key recovery.
import type { Hono, Context } from 'hono';
import { z } from 'zod';
import { CreateCollectionMetadataSchema, UpdateCollectionMetadataSchema, DeleteCollectionMetadataSchema, UuidSchema,
    type CreateCollectionMetadata, type UpdateCollectionMetadata, type DeleteCollectionMetadata } from '@letbuyy/shared-types';
import type { Env } from '../index';
import { ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';
import { resolveCollectionStoreScope } from '../lib/collection-store-scope';
import { validate } from '../middleware/validation';
import { success } from '../lib/supabase';
import { executeCollectionMetadataCommand, readCollectionMetadata } from '../execution/collection-metadata.adapter';

type C = Context<{ Bindings: Env }>;
const Id = z.object({ id: UuidSchema }).strict();
function selected(c: C, bodyStore?: string) {
    const store = bodyStore || c.req.query('store_id') || c.req.header('X-Store-ID') || c.get('auth').user.storeId;
    if (!UuidSchema.safeParse(store).success) throw new ValidationError('Select the collection store.');
    const header = c.req.header('X-Store-ID'), session = c.get('auth').user.storeId;
    if (header && header !== store || session && session !== store) throw new ForbiddenError('The selected store changed.');
    return store!;
}
export function registerCollectionMetadataRoutes(router: Hono<{ Bindings: Env }>) {
    router.get('/collections/:id', validate('param', Id), validate('query', z.object({ store_id: UuidSchema.optional() }).strict()), async c => {
        c.header('Cache-Control', 'private, no-store');
        const scope = await resolveCollectionStoreScope(c, selected(c), 'products:read');
        const value = await readCollectionMetadata(c.env, scope, c.req.param('id'));
        if (value.collection_type !== 'manual') throw new NotFoundError('Manual collection not found.');
        return c.json(success(value));
    });
    async function mutate(c: C, operation: 'create' | 'update' | 'delete') {
        c.header('Cache-Control', 'private, no-store');
        const body = c.get('validatedBody') as CreateCollectionMetadata | UpdateCollectionMetadata | DeleteCollectionMetadata;
        if (body.collection_type !== 'manual') throw new ValidationError('Use the smart collection editor for smart rules.');
        const first = c.req.header('X-Idempotency-Key'), second = c.req.header('Idempotency-Key');
        if (first && second && first !== second || (first || second) !== body.idempotency_key) throw new ValidationError('Keep the original collection save key.');
        const scope = await resolveCollectionStoreScope(c, selected(c, body.store_id), 'products:write');
        return c.json(success(await executeCollectionMetadataCommand(c.env, scope, operation,
            operation === 'create' ? null : c.req.param('id'), body)), operation === 'create' ? 201 : 200);
    }
    router.post('/collections', validate('json', CreateCollectionMetadataSchema), c => mutate(c, 'create'));
    router.patch('/collections/:id', validate('param', Id), validate('json', UpdateCollectionMetadataSchema), c => mutate(c, 'update'));
    router.delete('/collections/:id', validate('param', Id), validate('json', DeleteCollectionMetadataSchema), c => mutate(c, 'delete'));
}
