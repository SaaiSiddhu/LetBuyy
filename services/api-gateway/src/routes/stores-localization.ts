import { Hono, type Context } from 'hono';
import type { Env } from '../index';
import { resolveCustomUser } from '../lib/auth-user';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { validate } from '../middleware/validation';
import type {
    StoreLocalizationSummary,
    StoreMarket,
    StorefrontLocale,
    StorefrontTranslation,
} from '@letbuyy/shared-types';
import { z } from 'zod';

type StoreRouter = Hono<{ Bindings: Env }>;

const LocaleCodeSchema = z.string().trim().min(2).max(16).transform((value) => value.replace(/_/g, '-'));
const CurrencyCodeSchema = z.string().trim().regex(/^[A-Za-z]{3}$/).transform((value) => value.toUpperCase());
const CountryCodeSchema = z.string().trim().regex(/^[A-Za-z]{2}$/).transform((value) => value.toUpperCase());
const LocalizationMetadataSchema = z.record(z.string(), z.unknown()).default({});

const UpdateStoreLocalizationSchema = z.object({
    default_locale: LocaleCodeSchema.optional(),
    currency: CurrencyCodeSchema.optional(),
    timezone: z.string().trim().min(1).max(80).optional(),
}).strict();

const CreateStoreMarketSchema = z.object({
    name: z.string().trim().min(1).max(120),
    country_code: CountryCodeSchema,
    currency: CurrencyCodeSchema.default('INR'),
    locale: LocaleCodeSchema.default('en-IN'),
    is_primary: z.boolean().optional().default(false),
    is_active: z.boolean().optional().default(true),
    price_adjustment_bps: z.number().int().min(-10000).max(10000).optional().default(0),
    rounding_mode: z.enum(['standard', 'up', 'down', 'none']).optional().default('standard'),
    metadata: LocalizationMetadataSchema.optional(),
}).strict();

const UpdateStoreMarketSchema = CreateStoreMarketSchema.partial().strict();

const CreateStorefrontLocaleSchema = z.object({
    locale: LocaleCodeSchema,
    name: z.string().trim().min(1).max(120),
    status: z.enum(['draft', 'published', 'archived']).optional().default('draft'),
    is_default: z.boolean().optional().default(false),
    metadata: LocalizationMetadataSchema.optional(),
}).strict();

const UpdateStorefrontLocaleSchema = CreateStorefrontLocaleSchema.omit({ locale: true }).partial().strict();

const CreateStorefrontTranslationSchema = z.object({
    locale: LocaleCodeSchema,
    resource_type: z.enum(['store', 'product', 'collection', 'page', 'policy', 'theme', 'navigation']),
    resource_id: z.string().trim().min(1).max(200),
    field: z.string().trim().min(1).max(120),
    source_text: z.string().max(5000).optional().nullable(),
    translated_text: z.string().trim().min(1).max(5000),
    status: z.enum(['draft', 'published', 'needs_review']).optional().default('draft'),
    metadata: LocalizationMetadataSchema.optional(),
}).strict();

const UpdateStorefrontTranslationSchema = CreateStorefrontTranslationSchema
    .pick({ source_text: true, translated_text: true, status: true, metadata: true })
    .partial()
    .strict();

type UpdateStoreLocalizationInput = z.infer<typeof UpdateStoreLocalizationSchema>;
type CreateStoreMarketInput = z.infer<typeof CreateStoreMarketSchema>;
type UpdateStoreMarketInput = z.infer<typeof UpdateStoreMarketSchema>;
type CreateStorefrontLocaleInput = z.infer<typeof CreateStorefrontLocaleSchema>;
type UpdateStorefrontLocaleInput = z.infer<typeof UpdateStorefrontLocaleSchema>;
type CreateStorefrontTranslationInput = z.infer<typeof CreateStorefrontTranslationSchema>;
type UpdateStorefrontTranslationInput = z.infer<typeof UpdateStorefrontTranslationSchema>;

type LocalizationStoreRow = {
    id?: string | null;
    locale?: string | null;
    currency?: string | null;
    timezone?: string | null;
};

type LocalizationError = { code: string; message: string };

type OwnedLocalizationStore =
    | {
        ok: true;
        db: ReturnType<typeof getSupabaseAdmin>;
        actorId: string;
        store: LocalizationStoreRow;
    }
    | {
        ok: false;
        status: 403 | 404 | 500;
        error: LocalizationError;
    };

type StoreMarketRow = StoreMarket;
type StorefrontLocaleRow = StorefrontLocale;
type StorefrontTranslationRow = StorefrontTranslation;

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

function normalizeLocale(value: string | null | undefined): string {
    const normalized = String(value || 'en-IN').trim().replace(/_/g, '-');
    return normalized || 'en-IN';
}

function normalizeCurrency(value: string | null | undefined): string {
    const normalized = String(value || 'INR').trim().toUpperCase();
    return /^[A-Z]{3}$/.test(normalized) ? normalized : 'INR';
}

function normalizeTimezone(value: string | null | undefined): string {
    const normalized = String(value || 'Asia/Kolkata').trim();
    return normalized || 'Asia/Kolkata';
}

function publishTimestamp(status: string | undefined | null): string | null {
    return status === 'published' ? new Date().toISOString() : null;
}

async function resolveOwnedLocalizationStore(
    c: Context<{ Bindings: Env }>,
    storeId: string,
): Promise<OwnedLocalizationStore> {
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
            .select('id,locale,currency,timezone')
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
            error: { code: 'LOCALIZATION_UNAVAILABLE', message: 'Localization settings are temporarily unavailable.' },
        };
    }

    if (!store) {
        return {
            ok: false,
            status: 404,
            error: { code: 'NOT_FOUND', message: 'Store not found' },
        };
    }

    return {
        ok: true,
        db,
        actorId: customUser.id,
        store: store as LocalizationStoreRow,
    };
}

async function loadLocalizationRows<T>(
    db: ReturnType<typeof getSupabaseAdmin>,
    tableName: string,
    storeId: string,
    select: string,
    orderColumn = 'updated_at',
): Promise<{ rows: T[]; schemaReady: boolean; error: { message?: string } | null }> {
    const { data, error } = await db
        .from(tableName)
        .select(select)
        .eq('store_id', storeId)
        .is('deleted_at', null)
        .order(orderColumn, { ascending: false })
        .limit(250);

    if (isMissingTableError(error, tableName)) {
        return { rows: [], schemaReady: false, error: null };
    }

    return { rows: (data || []) as T[], schemaReady: true, error };
}

async function setPrimaryMarket(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    marketId: string,
    actorId: string,
): Promise<void> {
    await db
        .from('store_markets')
        .update({ is_primary: false, updated_by: actorId })
        .eq('store_id', storeId)
        .neq('id', marketId)
        .is('deleted_at', null);
}

async function setDefaultLocale(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    localeId: string,
    locale: string,
    actorId: string,
): Promise<void> {
    await db
        .from('storefront_locales')
        .update({ is_default: false, updated_by: actorId })
        .eq('store_id', storeId)
        .neq('id', localeId)
        .is('deleted_at', null);

    await db
        .from('sites')
        .update({ locale, updated_at: new Date().toISOString() })
        .eq('id', storeId);
}

async function ensureDefaultLocaleRow(
    db: ReturnType<typeof getSupabaseAdmin>,
    storeId: string,
    locale: string,
    actorId: string,
): Promise<void> {
    const normalized = normalizeLocale(locale);
    const { data: existing, error } = await db
        .from('storefront_locales')
        .select('id')
        .eq('store_id', storeId)
        .eq('locale', normalized)
        .is('deleted_at', null)
        .maybeSingle();

    if (isMissingTableError(error, 'storefront_locales')) return;

    if (existing?.id) {
        await db
            .from('storefront_locales')
            .update({
                status: 'published',
                is_default: true,
                published_at: new Date().toISOString(),
                updated_by: actorId,
            })
            .eq('id', existing.id);
        await setDefaultLocale(db, storeId, existing.id, normalized, actorId);
        return;
    }

    const { data: created } = await db
        .from('storefront_locales')
        .insert({
            store_id: storeId,
            locale: normalized,
            name: normalized,
            status: 'published',
            is_default: true,
            published_at: new Date().toISOString(),
            created_by: actorId,
            updated_by: actorId,
        })
        .select('id')
        .single();

    if (created?.id) await setDefaultLocale(db, storeId, created.id, normalized, actorId);
}

async function buildLocalizationSummary(
    db: ReturnType<typeof getSupabaseAdmin>,
    store: LocalizationStoreRow,
): Promise<StoreLocalizationSummary> {
    const storeId = String(store.id);
    const [marketsResult, localesResult, translationsResult] = await Promise.all([
        loadLocalizationRows<StoreMarketRow>(
            db,
            'store_markets',
            storeId,
            'id,store_id,name,country_code,currency,locale,is_primary,is_active,price_adjustment_bps,rounding_mode,created_by,updated_by,deleted_by,created_at,updated_at,deleted_at,metadata',
        ),
        loadLocalizationRows<StorefrontLocaleRow>(
            db,
            'storefront_locales',
            storeId,
            'id,store_id,locale,name,status,is_default,published_at,created_by,updated_by,deleted_by,created_at,updated_at,deleted_at,metadata',
        ),
        loadLocalizationRows<StorefrontTranslationRow>(
            db,
            'storefront_translations',
            storeId,
            'id,store_id,locale,resource_type,resource_id,field,source_text,translated_text,status,published_at,created_by,updated_by,deleted_by,created_at,updated_at,deleted_at,metadata',
        ),
    ]);

    if (marketsResult.error || localesResult.error || translationsResult.error) {
        throw new Error('LOCALIZATION_READ_FAILED');
    }

    return {
        store_id: storeId,
        default_locale: normalizeLocale(store.locale),
        currency: normalizeCurrency(store.currency),
        timezone: normalizeTimezone(store.timezone),
        markets: marketsResult.rows,
        locales: localesResult.rows,
        translations: translationsResult.rows,
        schema_ready: marketsResult.schemaReady && localesResult.schemaReady && translationsResult.schemaReady,
        metadata: { source: 'api-gateway.stores.localization' },
    };
}

export function registerStoreLocalizationRoutes(router: StoreRouter): void {
    router.get('/:id/localization', async (c) => {
        const owned = await resolveOwnedLocalizationStore(c, c.req.param('id'));
        if (!owned.ok) return c.json({ error: owned.error }, owned.status);

        try {
            return c.json(success(await buildLocalizationSummary(owned.db, owned.store)));
        } catch {
            return c.json(
                { error: { code: 'LOCALIZATION_UNAVAILABLE', message: 'Localization settings are temporarily unavailable.' } },
                503
            );
        }
    });

    router.patch('/:id/localization', validate('json', UpdateStoreLocalizationSchema), async (c) => {
        const storeId = c.req.param('id');
        const body = c.get('validatedBody') as UpdateStoreLocalizationInput;
        const owned = await resolveOwnedLocalizationStore(c, storeId);
        if (!owned.ok) return c.json({ error: owned.error }, owned.status);

        const updates: Record<string, unknown> = {};
        if (body.default_locale) updates.locale = normalizeLocale(body.default_locale);
        if (body.currency) updates.currency = normalizeCurrency(body.currency);
        if (body.timezone) updates.timezone = normalizeTimezone(body.timezone);

        if (Object.keys(updates).length === 0) {
            return c.json({ error: { code: 'VALIDATION', message: 'No localization fields supplied.' } }, 400);
        }

        const { data: store, error } = await owned.db
            .from('sites')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', storeId)
            .select('id,locale,currency,timezone')
            .single();

        if (error || !store) {
            return c.json(
                { error: { code: 'LOCALIZATION_UNAVAILABLE', message: 'Localization settings could not be saved.' } },
                503
            );
        }

        if (updates.locale) {
            await ensureDefaultLocaleRow(owned.db, storeId, String(updates.locale), owned.actorId);
        }

        return c.json(success(await buildLocalizationSummary(owned.db, store as LocalizationStoreRow)));
    });

    router.post('/:id/localization/markets', validate('json', CreateStoreMarketSchema), async (c) => {
        const storeId = c.req.param('id');
        const body = c.get('validatedBody') as CreateStoreMarketInput;
        const owned = await resolveOwnedLocalizationStore(c, storeId);
        if (!owned.ok) return c.json({ error: owned.error }, owned.status);

        if (body.is_primary) await setPrimaryMarket(owned.db, storeId, '00000000-0000-0000-0000-000000000000', owned.actorId);

        const { data, error } = await owned.db
            .from('store_markets')
            .insert({
                store_id: storeId,
                name: body.name,
                country_code: body.country_code,
                currency: body.currency,
                locale: normalizeLocale(body.locale),
                is_primary: body.is_primary,
                is_active: body.is_active,
                price_adjustment_bps: body.price_adjustment_bps,
                rounding_mode: body.rounding_mode,
                metadata: body.metadata || {},
                created_by: owned.actorId,
                updated_by: owned.actorId,
            })
            .select()
            .single();

        if (error || !data) {
            return c.json(
                { error: { code: 'LOCALIZATION_UNAVAILABLE', message: 'Market could not be saved.' } },
                503
            );
        }

        return c.json(success(data as StoreMarketRow), 201);
    });

    router.patch('/:id/localization/markets/:marketId', validate('json', UpdateStoreMarketSchema), async (c) => {
        const storeId = c.req.param('id');
        const marketId = c.req.param('marketId');
        const body = c.get('validatedBody') as UpdateStoreMarketInput;
        const owned = await resolveOwnedLocalizationStore(c, storeId);
        if (!owned.ok) return c.json({ error: owned.error }, owned.status);

        const updates: Record<string, unknown> = { updated_by: owned.actorId };
        for (const key of ['name', 'country_code', 'currency', 'is_primary', 'is_active', 'price_adjustment_bps', 'rounding_mode', 'metadata'] as const) {
            if (body[key] !== undefined) updates[key] = body[key];
        }
        if (body.locale !== undefined) updates.locale = normalizeLocale(body.locale);

        if (body.is_primary) await setPrimaryMarket(owned.db, storeId, marketId, owned.actorId);

        const { data, error } = await owned.db
            .from('store_markets')
            .update(updates)
            .eq('id', marketId)
            .eq('store_id', storeId)
            .is('deleted_at', null)
            .select()
            .maybeSingle();

        if (error) {
            return c.json(
                { error: { code: 'LOCALIZATION_UNAVAILABLE', message: 'Market could not be saved.' } },
                503
            );
        }
        if (!data) return c.json({ error: { code: 'NOT_FOUND', message: 'Market not found' } }, 404);

        return c.json(success(data as StoreMarketRow));
    });

    router.delete('/:id/localization/markets/:marketId', async (c) => {
        const storeId = c.req.param('id');
        const marketId = c.req.param('marketId');
        const owned = await resolveOwnedLocalizationStore(c, storeId);
        if (!owned.ok) return c.json({ error: owned.error }, owned.status);

        const { data, error } = await owned.db
            .from('store_markets')
            .update({ deleted_at: new Date().toISOString(), deleted_by: owned.actorId, is_active: false })
            .eq('id', marketId)
            .eq('store_id', storeId)
            .is('deleted_at', null)
            .select('id')
            .maybeSingle();

        if (error) {
            return c.json(
                { error: { code: 'LOCALIZATION_UNAVAILABLE', message: 'Market could not be deleted.' } },
                503
            );
        }
        if (!data) return c.json({ error: { code: 'NOT_FOUND', message: 'Market not found' } }, 404);

        return c.json(success({ id: marketId }));
    });

    router.post('/:id/localization/locales', validate('json', CreateStorefrontLocaleSchema), async (c) => {
        const storeId = c.req.param('id');
        const body = c.get('validatedBody') as CreateStorefrontLocaleInput;
        const owned = await resolveOwnedLocalizationStore(c, storeId);
        if (!owned.ok) return c.json({ error: owned.error }, owned.status);

        if (body.is_default) await setDefaultLocale(owned.db, storeId, '00000000-0000-0000-0000-000000000000', body.locale, owned.actorId);

        const status = body.is_default ? 'published' : body.status;
        const { data, error } = await owned.db
            .from('storefront_locales')
            .insert({
                store_id: storeId,
                locale: normalizeLocale(body.locale),
                name: body.name,
                status,
                is_default: body.is_default,
                published_at: publishTimestamp(status),
                metadata: body.metadata || {},
                created_by: owned.actorId,
                updated_by: owned.actorId,
            })
            .select()
            .single();

        if (error || !data) {
            return c.json(
                { error: { code: 'LOCALIZATION_UNAVAILABLE', message: 'Locale could not be saved.' } },
                503
            );
        }

        if (body.is_default) await setDefaultLocale(owned.db, storeId, data.id, normalizeLocale(body.locale), owned.actorId);

        return c.json(success(data as StorefrontLocaleRow), 201);
    });

    router.patch('/:id/localization/locales/:localeId', validate('json', UpdateStorefrontLocaleSchema), async (c) => {
        const storeId = c.req.param('id');
        const localeId = c.req.param('localeId');
        const body = c.get('validatedBody') as UpdateStorefrontLocaleInput;
        const owned = await resolveOwnedLocalizationStore(c, storeId);
        if (!owned.ok) return c.json({ error: owned.error }, owned.status);

        const updates: Record<string, unknown> = { updated_by: owned.actorId };
        if (body.name !== undefined) updates.name = body.name;
        if (body.status !== undefined) {
            updates.status = body.is_default ? 'published' : body.status;
            if (body.status === 'published') updates.published_at = new Date().toISOString();
        }
        if (body.is_default !== undefined) {
            updates.is_default = body.is_default;
            if (body.is_default) {
                updates.status = 'published';
                updates.published_at = new Date().toISOString();
            }
        }
        if (body.metadata !== undefined) updates.metadata = body.metadata;

        const { data, error } = await owned.db
            .from('storefront_locales')
            .update(updates)
            .eq('id', localeId)
            .eq('store_id', storeId)
            .is('deleted_at', null)
            .select()
            .maybeSingle();

        if (error) {
            return c.json(
                { error: { code: 'LOCALIZATION_UNAVAILABLE', message: 'Locale could not be saved.' } },
                503
            );
        }
        if (!data) return c.json({ error: { code: 'NOT_FOUND', message: 'Locale not found' } }, 404);

        if (body.is_default) await setDefaultLocale(owned.db, storeId, localeId, String(data.locale), owned.actorId);

        return c.json(success(data as StorefrontLocaleRow));
    });

    router.delete('/:id/localization/locales/:localeId', async (c) => {
        const storeId = c.req.param('id');
        const localeId = c.req.param('localeId');
        const owned = await resolveOwnedLocalizationStore(c, storeId);
        if (!owned.ok) return c.json({ error: owned.error }, owned.status);

        const { data: existing } = await owned.db
            .from('storefront_locales')
            .select('id,is_default')
            .eq('id', localeId)
            .eq('store_id', storeId)
            .is('deleted_at', null)
            .maybeSingle();

        if (!existing) return c.json({ error: { code: 'NOT_FOUND', message: 'Locale not found' } }, 404);
        if (existing.is_default) {
            return c.json({ error: { code: 'VALIDATION', message: 'Default locale cannot be deleted.' } }, 400);
        }

        const { error } = await owned.db
            .from('storefront_locales')
            .update({ deleted_at: new Date().toISOString(), deleted_by: owned.actorId, status: 'archived' })
            .eq('id', localeId)
            .eq('store_id', storeId)
            .is('deleted_at', null);

        if (error) {
            return c.json(
                { error: { code: 'LOCALIZATION_UNAVAILABLE', message: 'Locale could not be deleted.' } },
                503
            );
        }

        return c.json(success({ id: localeId }));
    });

    router.post('/:id/localization/translations', validate('json', CreateStorefrontTranslationSchema), async (c) => {
        const storeId = c.req.param('id');
        const body = c.get('validatedBody') as CreateStorefrontTranslationInput;
        const owned = await resolveOwnedLocalizationStore(c, storeId);
        if (!owned.ok) return c.json({ error: owned.error }, owned.status);

        const { data, error } = await owned.db
            .from('storefront_translations')
            .insert({
                store_id: storeId,
                locale: normalizeLocale(body.locale),
                resource_type: body.resource_type,
                resource_id: body.resource_id,
                field: body.field,
                source_text: body.source_text || null,
                translated_text: body.translated_text,
                status: body.status,
                published_at: publishTimestamp(body.status),
                metadata: body.metadata || {},
                created_by: owned.actorId,
                updated_by: owned.actorId,
            })
            .select()
            .single();

        if (error || !data) {
            return c.json(
                { error: { code: 'LOCALIZATION_UNAVAILABLE', message: 'Translation could not be saved.' } },
                503
            );
        }

        return c.json(success(data as StorefrontTranslationRow), 201);
    });

    router.patch('/:id/localization/translations/:translationId', validate('json', UpdateStorefrontTranslationSchema), async (c) => {
        const storeId = c.req.param('id');
        const translationId = c.req.param('translationId');
        const body = c.get('validatedBody') as UpdateStorefrontTranslationInput;
        const owned = await resolveOwnedLocalizationStore(c, storeId);
        if (!owned.ok) return c.json({ error: owned.error }, owned.status);

        const updates: Record<string, unknown> = { updated_by: owned.actorId };
        for (const key of ['source_text', 'translated_text', 'status', 'metadata'] as const) {
            if (body[key] !== undefined) updates[key] = body[key];
        }
        if (body.status === 'published') updates.published_at = new Date().toISOString();

        const { data, error } = await owned.db
            .from('storefront_translations')
            .update(updates)
            .eq('id', translationId)
            .eq('store_id', storeId)
            .is('deleted_at', null)
            .select()
            .maybeSingle();

        if (error) {
            return c.json(
                { error: { code: 'LOCALIZATION_UNAVAILABLE', message: 'Translation could not be saved.' } },
                503
            );
        }
        if (!data) return c.json({ error: { code: 'NOT_FOUND', message: 'Translation not found' } }, 404);

        return c.json(success(data as StorefrontTranslationRow));
    });

    router.delete('/:id/localization/translations/:translationId', async (c) => {
        const storeId = c.req.param('id');
        const translationId = c.req.param('translationId');
        const owned = await resolveOwnedLocalizationStore(c, storeId);
        if (!owned.ok) return c.json({ error: owned.error }, owned.status);

        const { data, error } = await owned.db
            .from('storefront_translations')
            .update({ deleted_at: new Date().toISOString(), deleted_by: owned.actorId })
            .eq('id', translationId)
            .eq('store_id', storeId)
            .is('deleted_at', null)
            .select('id')
            .maybeSingle();

        if (error) {
            return c.json(
                { error: { code: 'LOCALIZATION_UNAVAILABLE', message: 'Translation could not be deleted.' } },
                503
            );
        }
        if (!data) return c.json({ error: { code: 'NOT_FOUND', message: 'Translation not found' } }, 404);

        return c.json(success({ id: translationId }));
    });
}
