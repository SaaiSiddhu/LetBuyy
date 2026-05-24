import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { THEME_APPLICATION_WORKFLOWS } from '@letbuyy/application-services';
import {
    getSectionSchemas,
    getThemeSettingsSchema,
    type SchemaField,
    type SectionSchema,
    type ThemeSettingsSchema,
} from '@letbuyy/api-types';

type DbRecord = Record<string, unknown>;
type SectionSchemas = Record<string, SectionSchema>;

export interface ThemeRegistryThemeInput extends DbRecord {
    id: string;
    slug: string;
    name: string;
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
        text.includes('does not exist')
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

export class SchemaRegistryExecutionAdapter {
    static readonly applicationWorkflows = THEME_APPLICATION_WORKFLOWS;

    constructor(private db: SupabaseClient) {}

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

        if (isMissingThemeEngineTable(schemaError) || isMissingThemeEngineTable(rendererError)) return legacy;

        const schemaRecord = asRecord(schemaManifest);
        const rendererRecord = asRecord(rendererManifest);
        const sectionSchemas = hasKeys(schemaRecord.section_schemas)
            ? (schemaRecord.section_schemas as SectionSchemas)
            : legacy.sectionSchemas;

        return {
            source: 'database',
            themePackageId: packageRuntime.themePackageId,
            themePackageVersionId: packageRuntime.themePackageVersionId,
            schemaManifestVersion:
                typeof schemaRecord.manifest_version === 'string'
                    ? schemaRecord.manifest_version
                    : packageRuntime.schemaVersion,
            rendererVersion: packageRuntime.rendererVersion,
            sectionSchemas,
            blockSchemas: hasKeys(schemaRecord.block_schemas) ? asRecord(schemaRecord.block_schemas) : legacy.blockSchemas,
            settingsSchema: hasKeys(schemaRecord.settings_schema)
                ? normalizeThemeSettingsSchema(schemaRecord.settings_schema, theme.slug)
                : legacy.settingsSchema,
            templateSchema: hasKeys(schemaRecord.template_schema) ? asRecord(schemaRecord.template_schema) : legacy.templateSchema,
            layoutSchema: hasKeys(schemaRecord.layout_schema) ? asRecord(schemaRecord.layout_schema) : legacy.layoutSchema,
            rendererManifest: hasKeys(rendererRecord.renderer_manifest) ? asRecord(rendererRecord.renderer_manifest) : legacy.rendererManifest,
            approvedRendererKeys: stringArray(rendererRecord.approved_renderer_keys).length > 0
                ? stringArray(rendererRecord.approved_renderer_keys)
                : legacy.approvedRendererKeys,
            assetManifest: hasKeys(rendererRecord.asset_manifest) ? asRecord(rendererRecord.asset_manifest) : legacy.assetManifest,
            performanceBudget: hasKeys(rendererRecord.performance_budget) ? asRecord(rendererRecord.performance_budget) : legacy.performanceBudget,
        };
    }

    async ensureThemePackageRuntime(theme: ThemeRegistryThemeInput): Promise<ThemePackageRuntime | null> {
        const existing = await this.findPackageRuntime(theme);
        if (existing) return existing;

        const config = asRecord(theme.config);
        const now = new Date().toISOString();
        const siteTypes = Array.isArray(theme.supported_site_types) && theme.supported_site_types.length > 0
            ? theme.supported_site_types
            : ['store'];
        const pricingType = theme.letbuyy_pricing_type || (theme.is_premium ? 'paid' : 'free');

        const { data: themePackage, error: packageError } = await this.db
            .from('theme_packages')
            .upsert(
                {
                    slug: theme.slug,
                    name: theme.name,
                    description: theme.description || null,
                    site_types: siteTypes,
                    pricing_type: pricingType,
                    price: Number(theme.letbuyy_price_inr || 0),
                    legacy_theme_id: theme.id,
                    status: 'active',
                    updated_at: now,
                },
                { onConflict: 'slug' }
            )
            .select('id')
            .single();

        if (isMissingThemeEngineTable(packageError)) return null;
        if (packageError) throw new Error(`Theme package registry upsert failed: ${packageError.message}`);
        if (!themePackage) return null;

        const themePackageId = String((themePackage as DbRecord).id);
        const schemaVersion = theme.schema_version || '1.0.0';
        const rendererVersion = theme.renderer_version || '1.0.0';

        const { data: version, error: versionError } = await this.db
            .from('theme_package_versions')
            .upsert(
                {
                    theme_package_id: themePackageId,
                    version: schemaVersion,
                    version_number: 1,
                    release_status: 'published',
                    schema_version: schemaVersion,
                    renderer_version: rendererVersion,
                    package_manifest: {
                        source: 'legacy-theme',
                        theme_id: theme.id,
                        theme_slug: theme.slug,
                        default_template: hasKeys(theme.default_template)
                            ? theme.default_template
                            : asRecord(config.default_template),
                    },
                    published_at: now,
                    updated_at: now,
                },
                { onConflict: 'theme_package_id,version' }
            )
            .select('id')
            .single();

        if (isMissingThemeEngineTable(versionError)) return null;
        if (versionError) throw new Error(`Theme package version upsert failed: ${versionError.message}`);
        if (!version) return null;

        const themePackageVersionId = String((version as DbRecord).id);

        const [schemaUpsert, rendererUpsert] = await Promise.all([
            this.db
                .from('theme_schema_manifests')
                .upsert(
                    {
                        theme_package_version_id: themePackageVersionId,
                        manifest_version: schemaVersion,
                        schema_manifest: {
                            source: 'legacy-theme',
                            theme_slug: theme.slug,
                            validation: 'schema-registry-v1',
                        },
                        section_schemas: hasKeys(theme.section_schemas)
                            ? theme.section_schemas
                            : asRecord(config.section_schemas),
                        block_schemas: hasKeys(theme.block_schemas)
                            ? theme.block_schemas
                            : asRecord(config.block_schemas),
                        settings_schema: hasKeys(theme.settings_schema)
                            ? theme.settings_schema
                            : asRecord(config.settings_schema),
                        template_schema: asRecord(config.template_schema),
                        layout_schema: asRecord(config.layout_schema),
                        updated_at: now,
                    },
                    { onConflict: 'theme_package_version_id' }
                ),
            this.db
                .from('theme_renderer_manifests')
                .upsert(
                    {
                        theme_package_version_id: themePackageVersionId,
                        renderer_manifest: hasKeys(theme.renderer_manifest)
                            ? theme.renderer_manifest
                            : asRecord(config.renderer_manifest),
                        approved_renderer_keys: [theme.slug, 'default'],
                        asset_manifest: asRecord(config.asset_manifest),
                        performance_budget: asRecord(config.performance_budget),
                        updated_at: now,
                    },
                    { onConflict: 'theme_package_version_id' }
                ),
        ]);

        if (isMissingThemeEngineTable(schemaUpsert.error) || isMissingThemeEngineTable(rendererUpsert.error)) return null;
        if (schemaUpsert.error) throw new Error(`Theme schema manifest upsert failed: ${schemaUpsert.error.message}`);
        if (rendererUpsert.error) throw new Error(`Theme renderer manifest upsert failed: ${rendererUpsert.error.message}`);

        return {
            themePackageId,
            themePackageVersionId,
            schemaVersion,
            rendererVersion,
        };
    }

    private async findPackageRuntime(theme: ThemeRegistryThemeInput): Promise<ThemePackageRuntime | null> {
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
            .select('id, schema_version, renderer_version')
            .eq('theme_package_id', themePackageId)
            .eq('release_status', 'published')
            .is('deleted_at', null)
            .order('version_number', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (isMissingThemeEngineTable(versionError)) return null;
        if (versionError) throw new Error(`Theme package version lookup failed: ${versionError.message}`);
        if (!version) return null;

        const versionRecord = version as DbRecord;
        return {
            themePackageId,
            themePackageVersionId: String(versionRecord.id),
            schemaVersion: typeof versionRecord.schema_version === 'string' ? versionRecord.schema_version : '1.0.0',
            rendererVersion: typeof versionRecord.renderer_version === 'string' ? versionRecord.renderer_version : '1.0.0',
        };
    }
}
