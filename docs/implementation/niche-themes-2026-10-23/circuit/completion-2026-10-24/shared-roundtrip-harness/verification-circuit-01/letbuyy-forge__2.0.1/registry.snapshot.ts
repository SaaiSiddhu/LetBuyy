import { AppError, ForbiddenError, ConflictError } from '../lib/errors';
import { z } from 'zod';
import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { THEME_APPLICATION_WORKFLOWS, THEME_EXECUTION_PIPELINES, defineRuntimeBridge } from '@letbuyy/shared-types';
import {
    getSectionSchemas,
    getThemeSettingsSchema,
    type SchemaField,
    type SectionSchema,
    type ThemeSettingsSchema,
} from '@letbuyy/api-types';
import {
    buildPortableThemePackagePersistencePayload,
    firstPartyThemeListings,
    parsePortableThemePackageBundle,
    ThemeBundlePackageMetadataSchema,
    ThemeBundleJsonObjectSchema,
    type LiquidThemePackageBundle,
    type PortableThemePackageBundle,
} from '@letbuyy/theme-engine';

type DbRecord = Record<string, unknown>;
type SectionSchemas = Record<string, SectionSchema>;

export interface ThemeRegistryThemeInput extends DbRecord {
    id: string;
    slug: string;
    name: string;
    version?: string | null;
    description?: string | null;
    is_premium?: boolean | null;
    letbuyy_pricing_type?: string | null;
    letbuyy_price_inr?: number | string | null;
    supported_site_types?: string[] | null;
    config?: DbRecord | null;
    default_template?: DbRecord | null;
    section_schemas?: DbRecord | null;
    block_schemas?: DbRecord | null;
    settings_schema?: DbRecord | null;
    renderer_manifest?: DbRecord | null;
    schema_version?: string | null;
    renderer_version?: string | null;
}

export interface ThemePackageRuntime {
    themePackageId: string;
    themePackageVersionId: string;
    schemaVersion: string;
    rendererVersion: string;
}

export interface ThemeRuntimeSchema {
    source: 'database' | 'legacy';
    themePackageId?: string;
    themePackageVersionId?: string;
    schemaManifestVersion: string;
    rendererVersion: string;
    sectionSchemas: SectionSchemas;
    blockSchemas: DbRecord;
    settingsSchema: ThemeSettingsSchema;
    templateSchema: DbRecord;
    layoutSchema: DbRecord;
    rendererManifest: DbRecord;
    approvedRendererKeys: string[];
    assetManifest: DbRecord;
    performanceBudget: DbRecord;
}

function asRecord(value: unknown): DbRecord {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as DbRecord)
        : {};
}

function hasKeys(value: unknown): value is DbRecord {
    return Object.keys(asRecord(value)).length > 0;
}

function isMissingThemeEngineTable(error: { message?: string; details?: string; hint?: string } | null | undefined): boolean {
    const text = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
    return (
        text.includes('theme_packages') ||
        text.includes('theme_package_versions') ||
        text.includes('theme_schema_manifests') ||
        text.includes('theme_renderer_manifests') ||
        text.includes('theme_instances') ||
        text.includes('schema cache') ||
        text.includes('could not find') ||
        text.includes('does not exist') ||
        text.includes('fetch failed') ||
        text.includes('econnrefused') ||
        text.includes('connect')
    );
}

function normalizeThemeSettingsSchema(value: unknown, themeSlug: string): ThemeSettingsSchema {
    const record = asRecord(value);
    const settings = asRecord(record.settings);

    if (hasKeys(settings)) {
        return record as unknown as ThemeSettingsSchema;
    }

    if (hasKeys(record)) {
        return {
            schema_version: typeof record.schema_version === 'string' ? record.schema_version : '1.0',
            settings: {
                general: {
                    label: 'Theme Settings',
                    description: 'Editable theme settings',
                    fields: record as Record<string, SchemaField>,
                },
            },
        };
    }

    return getThemeSettingsSchema(themeSlug);
}

function legacyRuntime(theme: ThemeRegistryThemeInput): ThemeRuntimeSchema {
    const config = asRecord(theme.config);
    const sectionSchemas = hasKeys(theme.section_schemas)
        ? (theme.section_schemas as SectionSchemas)
        : hasKeys(config.section_schemas)
            ? (config.section_schemas as SectionSchemas)
            : getSectionSchemas(theme.slug);

    const settingsSchema = normalizeThemeSettingsSchema(
        hasKeys(theme.settings_schema)
            ? theme.settings_schema
            : hasKeys(config.settings_schema)
                ? config.settings_schema
                : null,
        theme.slug
    );

    return {
        source: 'legacy',
        schemaManifestVersion: theme.schema_version || '1.0.0',
        rendererVersion: theme.renderer_version || '1.0.0',
        sectionSchemas,
        blockSchemas: hasKeys(theme.block_schemas) ? asRecord(theme.block_schemas) : asRecord(config.block_schemas),
        settingsSchema,
        templateSchema: asRecord(config.template_schema),
        layoutSchema: asRecord(config.layout_schema),
        rendererManifest: hasKeys(theme.renderer_manifest) ? asRecord(theme.renderer_manifest) : asRecord(config.renderer_manifest),
        approvedRendererKeys: [theme.slug, 'default'],
        assetManifest: asRecord(config.asset_manifest),
        performanceBudget: asRecord(config.performance_budget),
    };
}

function stringArray(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is string => typeof item === 'string');
}

function readStringSetting(settings: DbRecord, keys: string[], fallback: string): string {
    for (const key of keys) {
        const value = settings[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            return value;
        }
    }

    return fallback;
}

function isLiquidBundle(bundle: PortableThemePackageBundle): bundle is LiquidThemePackageBundle {
    return bundle.renderer.engine === 'liquid';
}

function buildBundleTemplateConfig(bundle: PortableThemePackageBundle): DbRecord {
    const settingsData = asRecord(bundle.config.settings_data);
    const currentSettings = asRecord(settingsData.current);
    const liquid = isLiquidBundle(bundle);

    // Liquid files live once in the immutable bundle. Duplicating section sources,
    // templates and locales at the portable root exceeded the 256KB draft bound.
    if (liquid) return {
        themeId: bundle.package.slug,
        schema_version: bundle.schema_version,
        engineVersion: bundle.renderer.renderer_version,
        rendererEngine: 'liquid',
        liquidBundle: bundle,
        // Keep instance maps (small), but never duplicate Liquid source files.
        // Empty root slots also prevent another installed theme leaking old blocks.
        sections: {},
        templates: bundle.templates,
        themeSettings: currentSettings,
    };

    return {
        themeId: bundle.package.slug,
        schema_version: bundle.schema_version,
        engineVersion: bundle.renderer.renderer_version,
        rendererEngine: liquid ? 'liquid' : 'json-contract',
        config: bundle.config,
        settings_data: bundle.config.settings_data,
        themeSettings: currentSettings,
        sections: bundle.sections,
        blocks: bundle.blocks,
        templates: bundle.templates,
        locales: bundle.locales,
        renderer: bundle.renderer,
        ...(liquid ? {
            layout: bundle.layout,
            liquidBundle: bundle,
        } : {}),
    };
}

function buildBundleCatalogConfig(bundle: PortableThemePackageBundle): DbRecord {
    const settings = asRecord(bundle.config.settings_data.current);
    const liquid = isLiquidBundle(bundle);

    return {
        theme_bundle: true,
        theme_bundle_engine: liquid ? 'liquid' : 'json-contract',
        liquid_ready: liquid,
        colors: {
            primary: readStringSetting(settings, ['primaryColor', 'primary_color', 'primary'], '#00B3B3'),
            secondary: readStringSetting(settings, ['secondaryColor', 'secondary_color', 'secondary'], '#008080'),
            background: readStringSetting(settings, ['backgroundColor', 'background_color', 'background'], '#FFFFFF'),
            text: readStringSetting(settings, ['textColor', 'text_color', 'text'], '#1A1A2E'),
            accent: readStringSetting(settings, ['accentColor', 'accent_color', 'accent'], '#A4E500'),
        },
        fonts: {
            heading: readStringSetting(settings, ['headingFontFamily', 'heading_font_family', 'headingFont'], 'Inter'),
            body: readStringSetting(settings, ['fontFamily', 'font_family', 'bodyFont'], 'Inter'),
        },
        layout: {
            headerStyle: 'sticky',
            footerStyle: 'standard',
            maxWidth: 1280,
        },
        darkMode: settings.isDark === true,
        settings_schema: bundle.config.settings_schema,
        settings_data: bundle.config.settings_data,
        section_schemas: bundle.sections,
        block_schemas: bundle.blocks,
        template_schema: bundle.templates,
        default_template: buildBundleTemplateConfig(bundle),
        renderer_manifest: bundle.renderer,
        locales: bundle.locales,
        ...(liquid ? { liquidBundle: bundle } : {}),
    };
}

function themePricingType(pricingType: PortableThemePackageBundle['package']['pricing_type']): 'free' | 'one_time' | 'subscription' {
    if (pricingType === 'subscription') return 'subscription';
    if (pricingType === 'paid') return 'one_time';
    return 'free';
}

function registryBundle(theme: ThemeRegistryThemeInput): PortableThemePackageBundle | null {
    const config = asRecord(theme.config);
    const source = asRecord(theme.default_template).liquidBundle
        ?? asRecord(config.default_template).liquidBundle ?? config.liquidBundle;
    if (source === undefined) return null;
    try { return parsePortableThemePackageBundle(source); }
    catch { throw new AppError('The catalog package could not be confirmed.', 503, 'THEME_RUNTIME_UNAVAILABLE'); }
}

function registryVersion(theme: ThemeRegistryThemeInput, bundle: PortableThemePackageBundle | null): string {
    // Commerce version, schema format and renderer format are independent identities.
    const candidate = theme.version ?? bundle?.package.version ?? theme.schema_version;
    const parsed = ThemeBundlePackageMetadataSchema.shape.version.safeParse(candidate);
    if (!parsed.success || parsed.data !== parsed.data.trim() || /[\u0000-\u001f\u007f]/.test(parsed.data)
        || (bundle && (bundle.package.version !== parsed.data || bundle.package.release_status !== 'published'))) {
        throw new AppError('The catalog package version could not be confirmed.', 503, 'THEME_RUNTIME_UNAVAILABLE');
    }
    return parsed.data;
}

function stableRegistryJson(value: unknown): string {
    if (Array.isArray(value)) return '[' + value.map(stableRegistryJson).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => JSON.stringify(key) + ':' + stableRegistryJson(item)).join(',') + '}';
    return JSON.stringify(value) ?? 'null';
}

const RegistryValidationCaptureSchema = z.object({
    format: z.enum(['catalog-legacy-slots-v1', 'portable-bundle-v1']),
    schema: z.object({
        manifest_version: ThemeBundlePackageMetadataSchema.shape.version,
        schema_manifest: ThemeBundleJsonObjectSchema, section_schemas: ThemeBundleJsonObjectSchema,
        block_schemas: ThemeBundleJsonObjectSchema, settings_schema: ThemeBundleJsonObjectSchema,
        template_schema: ThemeBundleJsonObjectSchema, layout_schema: ThemeBundleJsonObjectSchema,
        validation_rules: ThemeBundleJsonObjectSchema,
    }).strict(),
    renderer: z.object({ renderer_manifest: ThemeBundleJsonObjectSchema,
        approved_renderer_keys: z.array(z.string().min(1).max(160)).min(1).max(512),
        asset_manifest: ThemeBundleJsonObjectSchema, performance_budget: ThemeBundleJsonObjectSchema }).strict(),
}).strict();
type RegistryValidationCapture = z.infer<typeof RegistryValidationCaptureSchema>;
function parseRegistryValidationCapture(input: unknown): RegistryValidationCapture {
    try {
        // Same bounded document envelope as canonical template validation. No
        // functions, dates, executable values or extra persistence keys survive.
        if (new TextEncoder().encode(JSON.stringify(input)).byteLength > 256_000) throw new Error('Capture too large');
        return RegistryValidationCaptureSchema.parse(input);
    } catch { throw new AppError('The theme validation capture is unavailable.', 503, 'THEME_RUNTIME_UNAVAILABLE'); }
}
function hasHistoricalCatalogSchemaFootprint(theme: ThemeRegistryThemeInput, bundle: PortableThemePackageBundle, document: DbRecord, config: DbRecord): boolean {
    if (theme.is_site_private === true || theme.owned_by_site_id) return false;
    if (theme.slug === 'letbuyy-core') {
        const renderer = asRecord(theme.renderer_manifest), provenance = asRecord(renderer.provenance);
        // The exact public197 Core row predates rendererEngine at the root.
        // Its immutable Liquid bundle and recorded migration identity establish
        // that history; absent flags alone never grant legacy compatibility.
        const historicalRenderer = !Object.hasOwn(document, 'rendererEngine') && renderer.engine === 'theme-engine-v1'
            && provenance.mode === 'insert' && provenance.migration === '197_letbuyy_core_first_class_theme';
        return document.themeId === 'letbuyy-core' && bundle.package.slug === 'letbuyy-core-liquid' && !config.preset_id
            && bundle.renderer.engine === 'liquid' && (document.rendererEngine === 'liquid' || historicalRenderer);
    }
    if (document.rendererEngine !== 'liquid') return false;
    const listing = firstPartyThemeListings().find(item => item.id === theme.id && item.slug === theme.slug);
    return Boolean(listing && config.preset_id === listing.presetId && document.experienceId === listing.presetId
        && document.themeId === listing.slug && bundle.package.slug === listing.slug);
}

function registryValidationCapture(theme: ThemeRegistryThemeInput, bundle: PortableThemePackageBundle | null): RegistryValidationCapture {
    const config = asRecord(theme.config), document = hasKeys(theme.default_template) ? theme.default_template : asRecord(config.default_template);
    const slots = asRecord(document.sections);
    const legacy = !bundle || bundle.package.version === '1.0.0' && config.theme_bundle !== true && !Object.hasOwn(document, 'schema_version')
        && asRecord(slots.header).type === 'header' && asRecord(slots.footer).type === 'footer' && Array.isArray(slots.template)
        && (hasKeys(theme.section_schemas) && hasKeys(theme.settings_schema)
            // Migration372 inherited Core's empty section map. Capture the
            // existing canonical legacyRuntime contract for that exact history;
            // an unmarked arbitrary/private bundle cannot opt into this branch.
            || hasHistoricalCatalogSchemaFootprint(theme, bundle, document, config));
    if (!legacy && bundle) {
        const payload = buildPortableThemePackagePersistencePayload(bundle);
        return parseRegistryValidationCapture({ format: 'portable-bundle-v1', schema: payload.schemaManifest, renderer: payload.rendererManifest });
    }
    const runtime = legacyRuntime(theme);
    return parseRegistryValidationCapture({ format: 'catalog-legacy-slots-v1', schema: {
        manifest_version: runtime.schemaManifestVersion,
        schema_manifest: { source: 'catalog-legacy-slots-v1', theme_slug: theme.slug },
        section_schemas: runtime.sectionSchemas, block_schemas: runtime.blockSchemas, settings_schema: runtime.settingsSchema,
        template_schema: runtime.templateSchema, layout_schema: runtime.layoutSchema, validation_rules: {},
    }, renderer: { renderer_manifest: runtime.rendererManifest, approved_renderer_keys: runtime.approvedRendererKeys,
        asset_manifest: runtime.assetManifest, performance_budget: runtime.performanceBudget } });
}

export class SchemaRegistryExecutionAdapter {
    static readonly applicationWorkflows = THEME_APPLICATION_WORKFLOWS;
    static readonly executionPipelines = THEME_EXECUTION_PIPELINES;
    static readonly runtimeBridge = defineRuntimeBridge({
        kind: 'runtime-bridge',
        adapter: 'schema-registry-execution.adapter',
        workflowAuthority: 'theme-application',
        allowedResponsibilities: ['database-rpc', 'response-formatting'],
        forbiddenResponsibilities: ['workflow-ownership', 'business-sequencing', 'query-aggregation', 'provider-sdk', 'ui-rendering'],
    });

    constructor(private db: SupabaseClient) {}

    async uploadThemePackageBundle(
        input: unknown,
        actorId: string,
        options: { publicationMode?: 'marketplace' | 'private_install'; siteId?: string } = {}
    ) {
        const bundle = parsePortableThemePackageBundle(input);
        const payload = buildPortableThemePackagePersistencePayload(bundle);
        const now = new Date().toISOString();
        const templateConfig = buildBundleTemplateConfig(bundle);
        const catalogConfig = buildBundleCatalogConfig(bundle);
        const firstSiteType = payload.themePackage.site_types[0] || 'store';
        const reviewRequired = options.publicationMode !== 'private_install';
        const packageStatus = 'draft'; // Merchant uploads are never a public catalog approval.
        const versionStatus = reviewRequired ? 'draft' : payload.themePackageVersion.release_status;
        const installable = !reviewRequired && versionStatus === 'published';
        const pricingType = themePricingType(payload.themePackage.pricing_type);

        if (!options.siteId) throw new ForbiddenError('Select an owned store before uploading a theme.');
        const catalog = {
                    slug: payload.themePackage.slug,
                    name: payload.themePackage.name,
                    site_type: firstSiteType,
                    category: firstSiteType,
                    description: payload.themePackage.description,
                    long_description: payload.themePackage.description,
                    preview_url: null,
                    thumbnail_url: '/previews/store.png',
                    is_premium: pricingType !== 'free',
                    price: payload.themePackage.price,
                    config: catalogConfig,
                    default_template: templateConfig,
                    section_schemas: payload.schemaManifest.section_schemas,
                    block_schemas: payload.schemaManifest.block_schemas,
                    settings_schema: payload.schemaManifest.settings_schema,
                    renderer_manifest: payload.rendererManifest.renderer_manifest,
                    schema_version: payload.themePackageVersion.schema_version,
                    renderer_version: payload.themePackageVersion.renderer_version,
                    author: payload.themePackage.author_name,
                    version: payload.themePackageVersion.version,
                    is_active: installable,
                    sort_order: 1000 + payload.themePackageVersion.version_number,
                    letbuyy_pricing_type: pricingType,
                    letbuyy_price_usd: payload.themePackage.currency === 'USD' ? payload.themePackage.price : 0,
                    letbuyy_price_inr: payload.themePackage.currency === 'INR' ? payload.themePackage.price : 0,
                    industry: payload.themePackage.site_types,
                    supported_site_types: payload.themePackage.site_types,
                    supported_platforms: ['letbuyy'],
                    tags: Array.from(new Set([bundle.renderer.engine, 'uploaded', ...payload.themePackage.site_types])),
                    features: isLiquidBundle(bundle)
                        ? [
                            `${Object.keys(bundle.sections).length} Liquid section files`,
                            'Liquid sections and blocks',
                            'Portable theme bundle',
                        ]
                        : [
                            `${Object.keys(bundle.sections).length} sections`,
                            'Schema-driven settings',
                            'Portable theme bundle',
                        ],
                    updated_at: now,
                };
        const { data, error } = await this.db.rpc('upload_owned_theme_package_v1', {
            p_actor: actorId,
            p_site: options.siteId,
            p_mode: options.publicationMode || 'marketplace',
            p_catalog: catalog,
            p_package: { ...payload.themePackage, status: packageStatus },
            p_version: { ...payload.themePackageVersion, release_status: versionStatus },
            p_schema: payload.schemaManifest,
            p_renderer: payload.rendererManifest,
        });
        if (error?.code === '42501') throw new ForbiddenError('This theme name or store is not available to your account.');
        if (error?.code === '23505') throw new ConflictError('This theme version already exists with different content. Upload a new version.');
        if (error) throw new AppError('Theme upload is temporarily unavailable. Retry the same upload.', 503, 'THEME_UPLOAD_UNAVAILABLE');
        return data;
    }

    async resolveThemeRuntime(theme: ThemeRegistryThemeInput): Promise<ThemeRuntimeSchema> {
        const legacy = legacyRuntime(theme);
        const packageRuntime = await this.ensureThemePackageRuntime(theme);
        if (!packageRuntime) return legacy;

        const [{ data: schemaManifest, error: schemaError }, { data: rendererManifest, error: rendererError }] = await Promise.all([
            this.db
                .from('theme_schema_manifests')
                .select('manifest_version, schema_manifest, section_schemas, block_schemas, settings_schema, template_schema, layout_schema, validation_rules')
                .eq('theme_package_version_id', packageRuntime.themePackageVersionId)
                .maybeSingle(),
            this.db
                .from('theme_renderer_manifests')
                .select('renderer_manifest, approved_renderer_keys, asset_manifest, performance_budget')
                .eq('theme_package_version_id', packageRuntime.themePackageVersionId)
                .maybeSingle(),
        ]);

        const schemaRecord = asRecord(schemaManifest);
        const rendererRecord = asRecord(rendererManifest);
        if (schemaError || rendererError || !hasKeys(schemaRecord.section_schemas) || !hasKeys(rendererRecord.renderer_manifest)
            || !schemaRecord.settings_schema || typeof schemaRecord.settings_schema !== 'object' || Array.isArray(schemaRecord.settings_schema)
            || stringArray(rendererRecord.approved_renderer_keys).length === 0) {
            throw new AppError('The immutable theme runtime manifests are unavailable.', 503, 'THEME_RUNTIME_UNAVAILABLE');
        }
        const settingsRecord = asRecord(schemaRecord.settings_schema);
        if (Object.hasOwn(settingsRecord, 'settings') && (!settingsRecord.settings || typeof settingsRecord.settings !== 'object' || Array.isArray(settingsRecord.settings))) {
            throw new AppError('The immutable theme settings manifest is unavailable.', 503, 'THEME_RUNTIME_UNAVAILABLE');
        }
        // An explicitly empty captured settings contract declares no fields. It
        // must not inherit today's app defaults or widen a portable package.
        const settingsSchema = Object.hasOwn(settingsRecord, 'settings') ? settingsRecord as unknown as ThemeSettingsSchema
            : hasKeys(settingsRecord) ? normalizeThemeSettingsSchema(settingsRecord, theme.slug)
                : { schema_version: packageRuntime.schemaVersion, settings: {} };

        return {
            source: 'database',
            themePackageId: packageRuntime.themePackageId,
            themePackageVersionId: packageRuntime.themePackageVersionId,
            schemaManifestVersion:
                typeof schemaRecord.manifest_version === 'string'
                    ? schemaRecord.manifest_version
                    : packageRuntime.schemaVersion,
            rendererVersion: packageRuntime.rendererVersion,
            sectionSchemas: schemaRecord.section_schemas as SectionSchemas,
            blockSchemas: asRecord(schemaRecord.block_schemas),
            settingsSchema,
            templateSchema: asRecord(schemaRecord.template_schema),
            layoutSchema: asRecord(schemaRecord.layout_schema),
            rendererManifest: asRecord(rendererRecord.renderer_manifest),
            approvedRendererKeys: stringArray(rendererRecord.approved_renderer_keys),
            assetManifest: asRecord(rendererRecord.asset_manifest),
            performanceBudget: asRecord(rendererRecord.performance_budget),
        };
    }

    async ensureThemePackageRuntime(theme: ThemeRegistryThemeInput): Promise<ThemePackageRuntime | null> {
        const bundle = registryBundle(theme);
        const commerceVersion = registryVersion(theme, bundle);
        const payload = bundle ? buildPortableThemePackagePersistencePayload(bundle) : null;
        const desiredCapture = registryValidationCapture(theme, bundle);
        let found = await this.findPackageRuntime(theme, commerceVersion, bundle);
        const config = asRecord(theme.config);
        const now = new Date().toISOString();
        const schemaVersion = String(desiredCapture.schema.manifest_version);
        const rendererVersion = payload?.themePackageVersion.renderer_version || theme.renderer_version || '1.0.0';
        let runtime = found?.runtime;

        if (!runtime) {
            const { data: registeredPackage, error: registeredError } = await this.db.from('theme_packages')
                .select('id').or(`slug.eq.${theme.slug},legacy_theme_id.eq.${theme.id}`).is('deleted_at', null).maybeSingle();
            if (isMissingThemeEngineTable(registeredError)) return null;
            if (registeredError) throw new AppError('The theme package could not be confirmed.', 503, 'THEME_RUNTIME_UNAVAILABLE');
            // A registry read may materialize a catalog version, but must never
            // overwrite a previously captured package/version or its manifests.
            if (!registeredPackage) {
                const { error: packageError } = await this.db.from('theme_packages').upsert({
                    slug: theme.slug, name: theme.name, description: theme.description || null,
                    site_types: theme.supported_site_types?.length ? theme.supported_site_types : ['store'],
                    pricing_type: payload?.themePackage.pricing_type || (theme.letbuyy_pricing_type === 'free' || !theme.is_premium ? 'free' : 'paid'),
                    price: Number(theme.letbuyy_price_inr || 0), legacy_theme_id: theme.id,
                    status: 'active', updated_at: now,
                }, { onConflict: 'slug', ignoreDuplicates: true });
                if (isMissingThemeEngineTable(packageError)) return null;
                if (packageError) throw new AppError('The theme package registry is unavailable.', 503, 'THEME_RUNTIME_UNAVAILABLE');
            }
            const { data: themePackage, error: lookupError } = await this.db.from('theme_packages')
                .select('id').or(`slug.eq.${theme.slug},legacy_theme_id.eq.${theme.id}`).is('deleted_at', null).maybeSingle();
            if (lookupError || !themePackage) throw new AppError('The theme package could not be confirmed.', 503, 'THEME_RUNTIME_UNAVAILABLE');
            const packageId = String((themePackage as DbRecord).id);
            const { error: versionError } = await this.db.from('theme_package_versions').upsert({
                ...(payload?.themePackageVersion || {
                    version: commerceVersion, version_number: 1, release_status: 'published',
                    schema_version: schemaVersion, renderer_version: rendererVersion,
                    package_manifest: { source: 'legacy-theme', theme_id: theme.id, theme_slug: theme.slug,
                        default_template: hasKeys(theme.default_template) ? theme.default_template : asRecord(config.default_template) },
                }),
                schema_version: desiredCapture.schema.manifest_version,
                package_manifest: { ...(payload?.themePackageVersion.package_manifest || {
                    source: 'legacy-theme', theme_id: theme.id, theme_slug: theme.slug, default_template: theme.default_template || asRecord(config.default_template),
                }), registry_validation_capture: desiredCapture },
                theme_package_id: packageId, published_at: now, updated_at: now,
            }, { onConflict: 'theme_package_id,version', ignoreDuplicates: true });
            if (isMissingThemeEngineTable(versionError)) return null;
            if (versionError) throw new AppError('The theme package version is unavailable.', 503, 'THEME_RUNTIME_UNAVAILABLE');
            // Also verifies a concurrent materializer selected identical immutable
            // content. A revoked/deleted version is never revived by this path.
            found = await this.findPackageRuntime(theme, commerceVersion, bundle);
            runtime = found?.runtime;
            if (!runtime) throw new AppError('The catalog package version could not be confirmed.', 503, 'THEME_RUNTIME_UNAVAILABLE');
        }

        if (!Object.hasOwn(found?.manifest || {}, 'registry_validation_capture')) {
            // Older published versions may already own immutable manifests. Do
            // not reconstruct a missing historical contract from today's row.
            const [schema, renderer] = await Promise.all([
                this.db.from('theme_schema_manifests').select('theme_package_version_id,section_schemas,settings_schema').eq('theme_package_version_id', runtime.themePackageVersionId).maybeSingle(),
                this.db.from('theme_renderer_manifests').select('theme_package_version_id,renderer_manifest').eq('theme_package_version_id', runtime.themePackageVersionId).maybeSingle(),
            ]);
            if (schema.error || renderer.error || !schema.data || !renderer.data)
                throw new AppError('The historical theme validation capture is unavailable.', 503, 'THEME_RUNTIME_UNAVAILABLE');
            return runtime;
        }
        const captured = parseRegistryValidationCapture(found?.manifest.registry_validation_capture);
        if (stableRegistryJson(captured) !== stableRegistryJson(desiredCapture)) {
            throw new AppError('This immutable theme version has a different validation contract. Publish a new package version.', 409, 'THEME_PACKAGE_VERSION_CONFLICT');
        }
        const capturedSchema = asRecord(captured.schema), capturedRenderer = asRecord(captured.renderer);
        const [schemaResult, rendererResult] = await Promise.all([
            this.db.from('theme_schema_manifests').upsert({
                ...capturedSchema, theme_package_version_id: runtime.themePackageVersionId, updated_at: now,
            }, { onConflict: 'theme_package_version_id', ignoreDuplicates: true }),
            this.db.from('theme_renderer_manifests').upsert({
                ...capturedRenderer, theme_package_version_id: runtime.themePackageVersionId, updated_at: now,
            }, { onConflict: 'theme_package_version_id', ignoreDuplicates: true }),
        ]);
        if (isMissingThemeEngineTable(schemaResult.error) || isMissingThemeEngineTable(rendererResult.error)) return null;
        if (schemaResult.error || rendererResult.error) throw new AppError('The theme manifests are unavailable.', 503, 'THEME_RUNTIME_UNAVAILABLE');
        return runtime;
    }

    private async findPackageRuntime(theme: ThemeRegistryThemeInput, commerceVersion: string, bundle: PortableThemePackageBundle | null): Promise<{ runtime: ThemePackageRuntime; manifest: DbRecord } | null> {
        const { data: themePackage, error: packageError } = await this.db
            .from('theme_packages')
            .select('id')
            .or(`slug.eq.${theme.slug},legacy_theme_id.eq.${theme.id}`)
            .is('deleted_at', null)
            .maybeSingle();

        if (isMissingThemeEngineTable(packageError)) return null;
        if (packageError) throw new Error(`Theme package registry lookup failed: ${packageError.message}`);
        if (!themePackage) return null;

        const themePackageId = String((themePackage as DbRecord).id);
        const { data: version, error: versionError } = await this.db
            .from('theme_package_versions')
            .select('id, version, schema_version, renderer_version, package_manifest')
            .eq('theme_package_id', themePackageId)
            .eq('version', commerceVersion)
            .eq('release_status', 'published')
            .is('deleted_at', null)
            .maybeSingle();

        if (isMissingThemeEngineTable(versionError)) return null;
        if (versionError) throw new Error(`Theme package version lookup failed: ${versionError.message}`);
        if (!version) return null;

        const versionRecord = version as DbRecord;
        const manifest = asRecord(versionRecord.package_manifest);
        const captured = manifest.liquidBundle ?? manifest.themeBundle ?? asRecord(manifest.default_template).liquidBundle;
        if (bundle && captured === undefined) {
            throw new AppError('The immutable theme package capture is unavailable.', 503, 'THEME_RUNTIME_UNAVAILABLE');
        }
        if (bundle && captured !== undefined) {
            let equal = false;
            try { equal = stableRegistryJson(parsePortableThemePackageBundle(captured)) === stableRegistryJson(bundle); } catch { /* invalid capture stays unavailable */ }
            if (!equal) throw new AppError('This immutable theme version has different content. Publish a new package version.', 409, 'THEME_PACKAGE_VERSION_CONFLICT');
        }
        return { manifest, runtime: {
            themePackageId,
            themePackageVersionId: String(versionRecord.id),
            schemaVersion: typeof versionRecord.schema_version === 'string' ? versionRecord.schema_version : '1.0.0',
            rendererVersion: typeof versionRecord.renderer_version === 'string' ? versionRecord.renderer_version : '1.0.0',
        } };
    }
}
