// Marketplace home-banner curation — operator realm (phase CAP-FB-BANNERS; schema: migration 228).
//
// marketplace_banners is a platform-owned table, not a tenant table: it carries no site_id, and 228's
// service_role_marketplace_banners policy is the only write path — app_tenant is explicitly revoked
// INSERT/UPDATE/DELETE. Operators curate the strip; everyone else reads the active slice through the
// storefront's public route. Mirrors operations/marketplace-categories.ts exactly: DI factory,
// requirePermission from rbac.ts, the admin client (service_role, no tenant GUC), mounted beside the
// other operations routes.
//
// DELETE exists here and does not on categories, because nothing references a banner: categories are
// the target of channel_listings.marketplace_category_id and their own parent_id, both ON DELETE
// RESTRICT, so a hard delete there needs a phase that handles the RESTRICT case. A banner is a leaf.

import { Hono, type Context } from 'hono';
import type { Env } from '../../index';
import { AppError, ForbiddenError, NotFoundError, formatAppError } from '../../lib/errors';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { validate } from '../../middleware/validation';
import { requirePermission } from '../../middleware/rbac';
import {
    CreateMarketplaceBannerSchema,
    ListMarketplaceBannersOperatorQuery,
    UpdateMarketplaceBannerSchema,
    type CreateMarketplaceBannerInput,
    type ListMarketplaceBannersOperatorInput,
    type UpdateMarketplaceBannerInput,
} from '../../schemas/marketplace-banner.schema';

type AppContext = Context<{ Bindings: Env }>;

export const MARKETPLACE_BANNER_COLUMNS =
    'id, title, subtitle, image_url, icon_name, target_route, color_hex, image_width, image_height, aspect_ratio_type, position, is_active, created_at, updated_at';

export type MarketplaceBannerRow = {
    id: string;
    title: string;
    subtitle: string;
    image_url: string;
    icon_name: string | null;
    target_route: string | null;
    color_hex: string | null;
    image_width: number | null;
    image_height: number | null;
    aspect_ratio_type: string | null;
    position: number;
    is_active: boolean;
    created_at: string;
    updated_at: string;
};

export interface MarketplaceBannersOperationsDependencies {
    listBanners: (c: AppContext, query: ListMarketplaceBannersOperatorInput) => Promise<MarketplaceBannerRow[]>;
    createBanner: (c: AppContext, input: CreateMarketplaceBannerInput) => Promise<MarketplaceBannerRow>;
    updateBanner: (c: AppContext, id: string, input: UpdateMarketplaceBannerInput) => Promise<MarketplaceBannerRow | null>;
    deleteBanner: (c: AppContext, id: string) => Promise<boolean>;
    // Injectable only so unit tests can bypass the permission lookup; production always uses rbac's.
    permission: typeof requirePermission;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function bannerIdParam(c: AppContext): string {
    const id = c.req.param('id') || '';
    if (!UUID.test(id)) throw new AppError('banner id must be a UUID', 400, 'VALIDATION_ERROR');
    return id;
}

// A different table from marketplace_categories, so its own mapper rather than a fork of that file's.
export function mapMarketplaceBannerDatabaseError(error: unknown): AppError | null {
    const message = error instanceof Error ? error.message : String(error ?? '');
    const code = typeof (error as { code?: unknown })?.code === 'string' ? (error as { code: string }).code : '';
    // 228's CHECKs: https image_url, non-blank title, #RRGGBB colour, wide|square|tall, positive
    // dimensions, in-app-or-https target. The edge schema rejects all of these first; reaching here
    // means a path bypassed validation, and it must still be a typed 422, not a 500.
    if (code === '23514') return new AppError('banner violates the marketplace banner format rules', 422, 'UNPROCESSABLE');
    if (code === '23502') return new AppError('a required banner field is missing', 422, 'UNPROCESSABLE');
    if (code === '42501' || /row-level security/i.test(message)) return new ForbiddenError('Not authorized for this resource');
    return null;
}

function respond(c: AppContext, error: unknown): Response {
    const appError = error instanceof AppError ? error : mapMarketplaceBannerDatabaseError(error);
    if (!appError) throw error;
    const { body, status } = formatAppError(appError);
    return c.json(body, status as 400);
}

export const defaultMarketplaceBannersOperationsDependencies: MarketplaceBannersOperationsDependencies = {
    listBanners: async (c, query) => {
        const db = getSupabaseAdmin(c);
        let request = db
            .from('marketplace_banners')
            .select(MARKETPLACE_BANNER_COLUMNS)
            .order('position', { ascending: true })
            // Firestore ordered on priority alone, so equal priorities came back in an order it never
            // promised. created_at is the tiebreak that makes the operator's list match the strip.
            .order('created_at', { ascending: true });
        if (query.is_active !== undefined) request = request.eq('is_active', query.is_active);
        const { data, error } = await request;
        if (error) throw error;
        return (data || []) as unknown as MarketplaceBannerRow[];
    },
    createBanner: async (c, input) => {
        const db = getSupabaseAdmin(c);
        const { data, error } = await db
            .from('marketplace_banners')
            .insert({
                title: input.title,
                subtitle: input.subtitle,
                image_url: input.image_url,
                icon_name: input.icon_name ?? null,
                target_route: input.target_route ?? null,
                color_hex: input.color_hex ?? null,
                image_width: input.image_width ?? null,
                image_height: input.image_height ?? null,
                aspect_ratio_type: input.aspect_ratio_type ?? null,
                position: input.position,
                is_active: input.is_active,
            })
            .select(MARKETPLACE_BANNER_COLUMNS)
            .single();
        if (error) throw error;
        return data as unknown as MarketplaceBannerRow;
    },
    updateBanner: async (c, id, input) => {
        const db = getSupabaseAdmin(c);
        // Built key by key rather than spread: `undefined` means "not sent" and must not be written,
        // while an explicit `null` on a nullable column means "clear it" and must be.
        const patch: Record<string, unknown> = {};
        if (input.title !== undefined) patch.title = input.title;
        if (input.subtitle !== undefined) patch.subtitle = input.subtitle;
        if (input.image_url !== undefined) patch.image_url = input.image_url;
        if (input.icon_name !== undefined) patch.icon_name = input.icon_name;
        if (input.target_route !== undefined) patch.target_route = input.target_route;
        if (input.color_hex !== undefined) patch.color_hex = input.color_hex;
        if (input.image_width !== undefined) patch.image_width = input.image_width;
        if (input.image_height !== undefined) patch.image_height = input.image_height;
        if (input.aspect_ratio_type !== undefined) patch.aspect_ratio_type = input.aspect_ratio_type;
        if (input.position !== undefined) patch.position = input.position;
        if (input.is_active !== undefined) patch.is_active = input.is_active;
        const { data, error } = await db
            .from('marketplace_banners')
            .update(patch)
            .eq('id', id)
            .select(MARKETPLACE_BANNER_COLUMNS)
            .maybeSingle();
        if (error) throw error;
        return (data as unknown as MarketplaceBannerRow | null) ?? null;
    },
    deleteBanner: async (c, id) => {
        const db = getSupabaseAdmin(c);
        // Selecting the deleted row is what separates "deleted" from "was never there": without it a
        // DELETE on a missing id reports success and the operator believes a banner is gone.
        const { data, error } = await db.from('marketplace_banners').delete().eq('id', id).select('id').maybeSingle();
        if (error) throw error;
        return Boolean(data);
    },
    permission: requirePermission,
};

export function createMarketplaceBannersOperationsRouter(
    deps: MarketplaceBannersOperationsDependencies = defaultMarketplaceBannersOperationsDependencies,
) {
    const router = new Hono<{ Bindings: Env }>();

    // GET /operations/marketplace-banners?is_active= — the whole strip, including unpublished work.
    router.get('/', deps.permission('review:view'), validate('query', ListMarketplaceBannersOperatorQuery), async (c) => {
        const query = c.get('validatedQuery') as ListMarketplaceBannersOperatorInput;
        try {
            return c.json(success(await deps.listBanners(c, query)));
        } catch (error) {
            return respond(c, error);
        }
    });

    // POST /operations/marketplace-banners — add a banner to the strip.
    router.post('/', deps.permission('review:decide'), validate('json', CreateMarketplaceBannerSchema), async (c) => {
        const body = c.get('validatedBody') as CreateMarketplaceBannerInput;
        try {
            return c.json(success(await deps.createBanner(c, body)), 201);
        } catch (error) {
            return respond(c, error);
        }
    });

    // PATCH /operations/marketplace-banners/:id — edit / reposition / publish / unpublish.
    router.patch('/:id', deps.permission('review:decide'), validate('json', UpdateMarketplaceBannerSchema), async (c) => {
        try {
            const id = bannerIdParam(c);
            const body = c.get('validatedBody') as UpdateMarketplaceBannerInput;
            const row = await deps.updateBanner(c, id, body);
            if (!row) throw new NotFoundError('Banner not found');
            return c.json(success(row));
        } catch (error) {
            return respond(c, error);
        }
    });

    // DELETE /operations/marketplace-banners/:id — remove it outright.
    router.delete('/:id', deps.permission('review:decide'), async (c) => {
        try {
            const id = bannerIdParam(c);
            if (!(await deps.deleteBanner(c, id))) throw new NotFoundError('Banner not found');
            return c.json(success({ id, deleted: true }));
        } catch (error) {
            return respond(c, error);
        }
    });

    return router;
}

const operationsMarketplaceBannersRouter = createMarketplaceBannersOperationsRouter();
export default operationsMarketplaceBannersRouter;
