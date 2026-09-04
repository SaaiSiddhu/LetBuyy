// Marketplace category taxonomy management — operator realm (phase ADM-3; schema: migration 217;
// design: docs/architecture/MARKETPLACE_CHANNEL_MODEL.md §9).
//
// marketplace_categories is a platform-owned table, not a tenant table: it carries no site_id, and
// 217's service_role_marketplace_categories policy (217:44-48) is the only write path — app_tenant
// is explicitly revoked INSERT/UPDATE/DELETE on this table. Operators manage the taxonomy; merchants
// only ever read the active slice through the storefront's public routes. This mirrors ADM-1's
// operator half of the listing state machine a second time: DI factory, requirePermission from
// rbac.ts, the admin client (service_role, no tenant GUC), mounted beside the other operations routes.
//
// No DELETE route: channel_listings.marketplace_category_id (217:104) and marketplace_categories'
// own parent_id (217:32) both reference this table ON DELETE RESTRICT. Deactivation (is_active =
// false) is the only removal path this phase handles; a hard delete needs a phase that measures and
// handles the RESTRICT case, deliberately out of scope here.

import { Hono, type Context } from 'hono';
import type { Env } from '../../index';
import { AppError, ConflictError, ForbiddenError, NotFoundError, formatAppError } from '../../lib/errors';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { validate } from '../../middleware/validation';
import { requirePermission } from '../../middleware/rbac';
import {
    CreateMarketplaceCategorySchema,
    ListMarketplaceCategoriesOperatorQuery,
    UpdateMarketplaceCategorySchema,
    type CreateMarketplaceCategoryInput,
    type ListMarketplaceCategoriesOperatorInput,
    type UpdateMarketplaceCategoryInput,
} from '../../schemas/channel-listing.schema';

type AppContext = Context<{ Bindings: Env }>;

export const MARKETPLACE_CATEGORY_COLUMNS = 'id, slug, name, parent_id, position, is_active, metadata, created_at, updated_at';

export type MarketplaceCategoryRow = {
    id: string;
    slug: string;
    name: string;
    parent_id: string | null;
    position: number;
    is_active: boolean;
    metadata: Record<string, unknown>;
    created_at: string;
    updated_at: string;
};

export interface MarketplaceCategoriesOperationsDependencies {
    listCategories: (c: AppContext, query: ListMarketplaceCategoriesOperatorInput) => Promise<MarketplaceCategoryRow[]>;
    createCategory: (c: AppContext, input: CreateMarketplaceCategoryInput) => Promise<MarketplaceCategoryRow>;
    updateCategory: (c: AppContext, id: string, input: UpdateMarketplaceCategoryInput) => Promise<MarketplaceCategoryRow | null>;
    // Injectable only so unit tests can bypass the permission lookup; production always uses rbac's.
    permission: typeof requirePermission;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function categoryIdParam(c: AppContext): string {
    const id = c.req.param('id') || '';
    if (!UUID.test(id)) throw new AppError('category id must be a UUID', 400, 'VALIDATION_ERROR');
    return id;
}

// A different table from channel_listings, so its own mapper, not a fork of channel-listings.ts's.
export function mapMarketplaceCategoryDatabaseError(error: unknown): AppError | null {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : '';
    if (code === '23505') return new ConflictError('a category with this slug already exists');
    if (code === '23503') return new AppError('parent category not found', 422, 'UNPROCESSABLE');
    if (code === '23514') return new AppError('slug or parent violates the taxonomy\'s format rules', 422, 'UNPROCESSABLE');
    if (code === '42501' || /row-level security/i.test(message)) return new ForbiddenError('Not authorized for this resource');
    return null;
}

function respond(c: AppContext, error: unknown): Response {
    const appError = error instanceof AppError ? error : mapMarketplaceCategoryDatabaseError(error);
    if (!appError) throw error;
    const { body, status } = formatAppError(appError);
    return c.json(body, status as 400);
}

export const defaultMarketplaceCategoriesOperationsDependencies: MarketplaceCategoriesOperationsDependencies = {
    listCategories: async (c, query) => {
        const db = getSupabaseAdmin(c);
        let request = db
            .from('marketplace_categories')
            .select(MARKETPLACE_CATEGORY_COLUMNS)
            .order('parent_id', { ascending: true, nullsFirst: true })
            .order('position', { ascending: true });
        if (query.is_active !== undefined) request = request.eq('is_active', query.is_active);
        if (query.parent_id !== undefined) request = request.eq('parent_id', query.parent_id);
        const { data, error } = await request;
        if (error) throw error;
        return (data || []) as unknown as MarketplaceCategoryRow[];
    },
    createCategory: async (c, input) => {
        const db = getSupabaseAdmin(c);
        const { data, error } = await db
            .from('marketplace_categories')
            .insert({
                slug: input.slug,
                name: input.name,
                parent_id: input.parent_id ?? null,
                position: input.position,
                metadata: input.metadata ?? {},
            })
            .select(MARKETPLACE_CATEGORY_COLUMNS)
            .single();
        if (error) throw error;
        return data as unknown as MarketplaceCategoryRow;
    },
    updateCategory: async (c, id, input) => {
        const db = getSupabaseAdmin(c);
        const patch: Record<string, unknown> = {};
        if (input.name !== undefined) patch.name = input.name;
        if (input.parent_id !== undefined) patch.parent_id = input.parent_id;
        if (input.position !== undefined) patch.position = input.position;
        if (input.is_active !== undefined) patch.is_active = input.is_active;
        if (input.metadata !== undefined) patch.metadata = input.metadata;
        const { data, error } = await db.from('marketplace_categories').update(patch).eq('id', id).select(MARKETPLACE_CATEGORY_COLUMNS).maybeSingle();
        if (error) throw error;
        return (data as unknown as MarketplaceCategoryRow | null) ?? null;
    },
    permission: requirePermission,
};

export function createMarketplaceCategoriesOperationsRouter(
    deps: MarketplaceCategoriesOperationsDependencies = defaultMarketplaceCategoriesOperationsDependencies,
) {
    const router = new Hono<{ Bindings: Env }>();

    // GET /operations/marketplace-categories?is_active=&parent_id= — the full tree, including inactive.
    router.get('/', deps.permission('review:view'), validate('query', ListMarketplaceCategoriesOperatorQuery), async (c) => {
        const query = c.get('validatedQuery') as ListMarketplaceCategoriesOperatorInput;
        try {
            const rows = await deps.listCategories(c, query);
            return c.json(success(rows));
        } catch (error) {
            return respond(c, error);
        }
    });

    // POST /operations/marketplace-categories — create a taxonomy entry.
    router.post('/', deps.permission('review:decide'), validate('json', CreateMarketplaceCategorySchema), async (c) => {
        const body = c.get('validatedBody') as CreateMarketplaceCategoryInput;
        try {
            const row = await deps.createCategory(c, body);
            return c.json(success(row), 201);
        } catch (error) {
            return respond(c, error);
        }
    });

    // PATCH /operations/marketplace-categories/:id — rename / reparent / reposition / activate-deactivate.
    router.patch('/:id', deps.permission('review:decide'), validate('json', UpdateMarketplaceCategorySchema), async (c) => {
        try {
            const id = categoryIdParam(c);
            const body = c.get('validatedBody') as UpdateMarketplaceCategoryInput;
            const row = await deps.updateCategory(c, id, body);
            if (!row) throw new NotFoundError('Category not found');
            return c.json(success(row));
        } catch (error) {
            return respond(c, error);
        }
    });

    return router;
}

const operationsMarketplaceCategoriesRouter = createMarketplaceCategoriesOperationsRouter();
export default operationsMarketplaceCategoriesRouter;
