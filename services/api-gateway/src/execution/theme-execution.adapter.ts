import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { THEME_APPLICATION_WORKFLOWS, THEME_EXECUTION_PIPELINES, defineRuntimeBridge, ThemeDraftSaveResultSchema, ThemePublishResultSchema, UuidSchema } from '@letbuyy/shared-types';
import {
    asThemeRecord as asRecord,
    collectThemeTemplateValidationIssues,
    hasRenderableThemeTemplate,
    LiquidThemePackageBundleSchema,
    mergeThemeIdentity,
    migrateThemeTemplateSchemasWithRegistry,
    parseLiquidThemePackageBundle,
    parseThemeDocument,
    REGISTERED_SECTION_SCHEMA_MIGRATIONS,
    resolveRenderableThemeTemplateConfig,
    toThemeDocumentV2,
    type LiquidThemePackageBundle,
    type StoreTemplateConfig,
    type ThemeDocument,
    type ThemeDraftSaveResult,
    type ThemePublishResult,
} from '@letbuyy/theme-engine';
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';
import { isMissingSchemaError } from '../lib/supabase';
import type {
    ArchiveSiteThemeInput,
    CreateSiteThemeInput,
    DuplicateSiteThemeInput,
    InstallThemeInput,
    PreviewTokenInput,
    PublishThemeInput,
    RenameSiteThemeInput,
    RollbackThemeReleaseInput,
    SaveThemeDraftInput,
    ReorderThemeDraftInput,
    ValidateThemeDocumentInput,
} from '../schemas/theme.schema';
import { EventExecutionAdapter } from './event-execution.adapter';
import {
    SchemaRegistryExecutionAdapter,
    type ThemePackageRuntime,
    type ThemeRegistryThemeInput,
    type ThemeRuntimeSchema,
} from './schema-registry-execution.adapter';

type DbRecord = Record<string, unknown>;

interface StoreRecord extends DbRecord {
    id: string;
    user_id?: string;
    custom_user_id?: string;
    name?: string;
    subdomain?: string;
    store_name?: string;
    status?: string;
    theme_id?: string;
    template_config?: DbRecord | null;
}

interface ThemeRecord extends DbRecord {
    id: string;
    slug: string;
    name: string;
    description?: string | null;
    is_premium?: boolean;
    letbuyy_pricing_type?: string | null;
    letbuyy_price_inr?: number | string | null;
    supported_site_types?: string[] | null;
    config?: DbRecord | null;
    default_template?: DbRecord | null;
    section_schemas?: DbRecord | null;
    block_schemas?: DbRecord | null;
    settings_schema?: DbRecord | null;
    renderer_manifest?: DbRecord | null;
    renderer_key?: string | null;
    schema_version?: string | null;
    renderer_version?: string | null;
}

interface DraftRecord extends DbRecord {
    id?: string;
    draft_config?: DbRecord | null;
    template_key?: string | null;
    version?: number | null;
    auto_saved_at?: string | null;
}

interface ThemeReleaseRecord extends DbRecord {
    id: string;
    store_id: string;
    theme_id: string;
    release_version: number;
    release_config?: DbRecord | null;
    template_snapshot?: DbRecord | null;
    settings_snapshot?: DbRecord | null;
    release_manifest?: DbRecord | null;
    theme_instance_id?: string | null;
    theme_package_version_id?: string | null;
    published_at?: string;
}

interface ThemeInstanceRecord extends DbRecord {
    id: string;
    theme_package_id: string;
    theme_package_version_id: string;
    active_release_id?: string | null;
    current_draft_id?: string | null;
}

interface PublishThemeReleaseResult {
    release_id: string;
    release_version: number;
    published_at: string;
}

interface PublishReleaseSnapshotInput {
    storeId: string;
    themeId: string;
    releaseConfig: DbRecord;
    runtime?: ThemeRuntimeSchema | null;
    themeInstanceId?: string | null;
    sourceDraftId?: string | null;
    sourceDraftVersion?: number | null;
    publishedBy: string;
    publishMessage?: string | null;
    makeStoreLive: boolean;
    requestId?: string | null;
    rollbackOfReleaseId?: string | null;
}

function isMissingDeletedAtError(
    error: { message?: string } | null | undefined,
    tableName: string
): boolean {
    return Boolean(error?.message?.includes(`${tableName}.deleted_at`) && error.message.includes('does not exist'));
}

function isMissingPublishReleaseFunction(error: { message?: string } | null | undefined): boolean {
    return Boolean(
        error?.message?.includes('publish_theme_release') &&
        error.message.includes('Could not find the function')
    );
}

function isThemeEngineSchemaUnavailable(
    error: { message?: string; details?: string; hint?: string } | null | undefined
): boolean {
    const text = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
    return (
        text.includes('theme_instances') ||
        text.includes('theme_instance_drafts') ||
        text.includes('theme_draft_patches') ||
        text.includes('theme_releases') ||
        text.includes('schema cache') ||
        text.includes('could not find') ||
        text.includes('does not exist') ||
        text.includes('fetch failed') ||
        text.includes('econnrefused') ||
        text.includes('connect')
    );
}

function isMissingColumnError(
    error: { message?: string; details?: string; hint?: string } | null | undefined,
    columnName: string
): boolean {
    const text = [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
    return text.includes(columnName.toLowerCase()) && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

function readPublishedReleaseResult(data: unknown): PublishThemeReleaseResult {
    const row = Array.isArray(data) ? data[0] : data;

    if (!row || typeof row !== 'object') {
        throw new Error('Theme release publish returned no release');
    }

    const record = row as Record<string, unknown>;
    const releaseId = record.release_id;
    const releaseVersion = record.release_version;
    const publishedAt = record.published_at;

    if (typeof releaseId !== 'string' || typeof publishedAt !== 'string') {
        throw new Error('Theme release publish returned an invalid release payload');
    }

    return {
        release_id: releaseId,
        release_version: typeof releaseVersion === 'number' ? releaseVersion : Number(releaseVersion),
        published_at: publishedAt,
    };
}

async function sha256Hex(input: string): Promise<string> {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

function resolveLiquidBundleArtifact(releaseConfig: DbRecord): DbRecord | null {
    const candidate = asRecord(releaseConfig).liquidBundle;
    const result = LiquidThemePackageBundleSchema.safeParse(candidate);
    return result.success ? result.data as unknown as DbRecord : null;
}

const DEFAULT_THEME_TEMPLATE_OPTIONS = [
    { key: 'index', label: 'Home page', type: 'home' },
    { key: 'product', label: 'Product page', type: 'product' },
    { key: 'collection', label: 'Collection page', type: 'collection' },
    { key: 'page', label: 'Content page', type: 'page' },
    { key: 'cart', label: 'Cart page', type: 'cart' },
    { key: 'blog', label: 'Blog post', type: 'blog' },
] as const;

/**
 * The `themes` columns SchemaRegistryExecutionAdapter needs to build a ThemeRegistryThemeInput.
 * Selecting only id/slug/name would make ensureThemePackageRuntime fall back to hardcoded defaults.
 */
// Kept as one `as const` literal: supabase-js parses the select string at the type level, and a
// widened `string` degrades the row type to GenericStringError.
const THEME_REGISTRY_COLUMNS = 'id, slug, name, description, is_premium, letbuyy_pricing_type, letbuyy_price_inr, supported_site_types, config, default_template, section_schemas, block_schemas, settings_schema, renderer_manifest, schema_version, renderer_version' as const;

function normalizeThemeTemplateKey(value: unknown): string {
    const normalized = typeof value === 'string' ? value.trim() : '';
    return /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(normalized) ? normalized : 'index';
}

function labelFromTemplateKey(key: string): string {
    const defaultOption = DEFAULT_THEME_TEMPLATE_OPTIONS.find((option) => option.key === key);
    if (defaultOption) return defaultOption.label;

    return key
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function listThemeTemplateOptions(templateConfig: DbRecord): Array<{ key: string; label: string; type: string }> {
    const templateRecords = asRecord(templateConfig.templates);
    const keys = new Set<string>(DEFAULT_THEME_TEMPLATE_OPTIONS.map((option) => option.key));
    for (const key of Object.keys(templateRecords)) {
        const normalized = normalizeThemeTemplateKey(key);
        keys.add(normalized);
    }

    return Array.from(keys).map((key) => {
        const template = asRecord(templateRecords[key]);
        return {
            key,
            label: typeof template.name === 'string' && template.name.trim() ? template.name.trim() : labelFromTemplateKey(key),
            type: typeof template.type === 'string' && template.type.trim() ? template.type.trim() : key,
        };
    });
}

export function isStaleThemeEditorBaseVersion(currentVersion: number, baseVersion: unknown): boolean {
    return !Number.isInteger(baseVersion) || (baseVersion as number) < 0 || currentVersion !== baseVersion;
}

export class ThemeExecutionAdapter {
    static readonly applicationWorkflows = THEME_APPLICATION_WORKFLOWS;
    static readonly executionPipelines = THEME_EXECUTION_PIPELINES;
    static readonly runtimeBridge = defineRuntimeBridge({
        kind: 'runtime-bridge',
        adapter: 'theme-execution.adapter',
        workflowAuthority: 'theme-application',
        allowedResponsibilities: ['database-rpc', 'response-formatting'],
        forbiddenResponsibilities: ['workflow-ownership', 'business-sequencing', 'query-aggregation', 'provider-sdk', 'ui-rendering'],
    });

    private schemaRegistry: SchemaRegistryExecutionAdapter;

    constructor(private db: SupabaseClient, private boundSiteId?: string) {
        this.schemaRegistry = new SchemaRegistryExecutionAdapter(db);
    }

    private async validateTemplateConfig(templateConfig: DbRecord, theme: ThemeRecord): Promise<ThemeRuntimeSchema> {
        const runtime = await this.schemaRegistry.resolveThemeRuntime(theme);
        const issues = collectThemeTemplateValidationIssues({
            templateConfig,
            runtime,
            themeSlug: theme.slug,
        });

        if (issues.length > 0) {
            if (issues.includes('Theme template exceeds the maximum allowed size')) {
                throw new ValidationError('Theme template exceeds the maximum allowed size', issues);
            }
            throw new ValidationError('Theme template validation failed', issues);
        }

        return runtime;
    }

    async verifyStoreOwner(storeId: string, userId: string): Promise<StoreRecord> {
        const selectStore = (includeDeletedAtFilter: boolean) => {
            const query = this.db
                .from('sites')
                .select('id, user_id, custom_user_id, store_name, subdomain, status, theme_id, template_config')
                .eq('id', storeId)
                .or(`custom_user_id.eq.${userId},user_id.eq.${userId}`);

            return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
        };

        let { data, error } = await selectStore(true).maybeSingle();

        if (isMissingDeletedAtError(error, 'sites')) {
            ({ data, error } = await selectStore(false).maybeSingle());
        }

        if (error || !data) {
            if (error) throw new AppError('Store ownership is temporarily unavailable. Retry this request.', 503, 'THEME_STATE_UNAVAILABLE');
            throw new ForbiddenError('Store not found or not owned by this user');
        }

        return data as StoreRecord;
    }

    async verifyThemeEditorStore(storeId: string, userId: string): Promise<StoreRecord> {
        const { data, error } = await this.db.rpc('theme_draft_actor_site_v1', {
            p_actor: userId, p_site: storeId, p_bound_site: this.boundSiteId || null,
        });
        if (error?.code === '42501') throw new ForbiddenError('Your current account cannot edit this store theme.');
        const store = asRecord(Array.isArray(data) ? data[0] : data);
        if (error || store.id !== storeId) throw new AppError('Theme access is temporarily unavailable.', 503, 'THEME_STATE_UNAVAILABLE');
        return store as StoreRecord;
    }

    async getTheme(slug: string): Promise<ThemeRecord> {
        const { data, error } = await this.db
            .from('themes')
            .select('*')
            .eq('slug', slug)
            .eq('is_active', true)
            .maybeSingle();

        if (!data) {
            if (error) throw new AppError('The theme catalog is temporarily unavailable.', 503, 'THEME_STATE_UNAVAILABLE');
            throw new NotFoundError('Theme not found');
        }

        return data as ThemeRecord;
    }

    async getEditableSchema(slug: string) {
        const theme = await this.getTheme(slug);
        const runtime = await this.schemaRegistry.resolveThemeRuntime(theme);

        return {
            theme: {
                id: theme.id,
                slug: theme.slug,
                name: theme.name,
                renderer_key: theme.renderer_key || theme.slug,
                theme_package_id: runtime.themePackageId || null,
                theme_package_version_id: runtime.themePackageVersionId || null,
                schema_manifest_version: runtime.schemaManifestVersion,
                schema_source: runtime.source,
            },
            schemas: {
                sections: runtime.sectionSchemas,
                blocks: runtime.blockSchemas,
                settings: runtime.settingsSchema,
                templates: runtime.templateSchema,
                layouts: runtime.layoutSchema,
            },
            renderer_manifest: runtime.rendererManifest,
            approved_renderer_keys: runtime.approvedRendererKeys,
        };
    }

    private async ensureThemeInstance(
        storeId: string,
        theme: ThemeRecord,
        runtime: ThemeRuntimeSchema,
        actorId: string,
        installedConfig: DbRecord,
        activate: boolean
    ): Promise<ThemeInstanceRecord | null> {
        if (!runtime.themePackageId || !runtime.themePackageVersionId) return null;

        const now = new Date().toISOString();
        const { data: existing, error: existingError } = await this.db
            .from('theme_instances')
            .select('id, theme_package_id, theme_package_version_id, active_release_id, current_draft_id')
            .eq('store_id', storeId)
            .eq('theme_package_id', runtime.themePackageId)
            .is('deleted_at', null)
            .maybeSingle();

        if (isThemeEngineSchemaUnavailable(existingError)) return null;
        if (existingError) throw new Error(`Theme instance lookup failed: ${existingError.message}`);

        const status = activate ? 'active' : 'installed';
        if (activate) {
            const { error: deactivateError } = await this.db
                .from('theme_instances')
                .update({ instance_status: 'inactive', updated_at: now, updated_by: actorId })
                .eq('store_id', storeId)
                .neq('theme_package_id', runtime.themePackageId)
                .is('deleted_at', null);

            if (isThemeEngineSchemaUnavailable(deactivateError)) return null;
            if (deactivateError) throw new Error(`Theme instance deactivate failed: ${deactivateError.message}`);
        }

        if (existing) {
            const { data, error } = await this.db
                .from('theme_instances')
                .update({
                    theme_package_version_id: runtime.themePackageVersionId,
                    theme_slug: theme.slug,
                    instance_status: status,
                    installed_config: installedConfig,
                    settings: asRecord(installedConfig.themeSettings),
                    activated_at: activate ? now : null,
                    updated_at: now,
                    updated_by: actorId,
                })
                .eq('id', String((existing as DbRecord).id))
                .eq('store_id', storeId)
                .select('id, theme_package_id, theme_package_version_id, active_release_id, current_draft_id')
                .single();

            if (isThemeEngineSchemaUnavailable(error)) return null;
            if (error || !data) throw new Error(`Theme instance update failed: ${error?.message || 'Unknown error'}`);
            return data as ThemeInstanceRecord;
        }

        const { data, error } = await this.db
            .from('theme_instances')
            .insert({
                store_id: storeId,
                theme_package_id: runtime.themePackageId,
                theme_package_version_id: runtime.themePackageVersionId,
                theme_slug: theme.slug,
                instance_status: status,
                installed_config: installedConfig,
                settings: asRecord(installedConfig.themeSettings),
                activated_at: activate ? now : null,
                created_by: actorId,
                updated_by: actorId,
                created_at: now,
                updated_at: now,
            })
            .select('id, theme_package_id, theme_package_version_id, active_release_id, current_draft_id')
            .single();

        if (isThemeEngineSchemaUnavailable(error)) return null;
        if (error || !data) throw new Error(`Theme instance create failed: ${error?.message || 'Unknown error'}`);
        return data as ThemeInstanceRecord;
    }

    private async loadActiveInstanceDraft(
        storeId: string,
        theme: ThemeRecord
    ): Promise<{ id: string; draft_version: number | null } | null> {
        const { data: instance, error: instanceError } = await this.db
            .from('theme_instances')
            .select('id, current_draft_id')
            .eq('store_id', storeId)
            .eq('theme_slug', theme.slug)
            .is('deleted_at', null)
            .maybeSingle();

        if (isThemeEngineSchemaUnavailable(instanceError)) return null;
        if (instanceError) throw new Error(`Theme instance lookup failed: ${instanceError.message}`);

        const instanceRecord = instance as DbRecord | null;
        if (!instanceRecord?.id) return null;

        const currentDraftId = typeof instanceRecord.current_draft_id === 'string'
            ? instanceRecord.current_draft_id
            : null;

        const draftQuery = this.db
            .from('theme_instance_drafts')
            .select('id, draft_version')
            .eq('store_id', storeId)
            .is('deleted_at', null);

        const { data: draft, error: draftError } = currentDraftId
            ? await draftQuery.eq('id', currentDraftId).maybeSingle()
            : await draftQuery
                .eq('theme_instance_id', String(instanceRecord.id))
                .eq('draft_status', 'active')
                .maybeSingle();

        if (isThemeEngineSchemaUnavailable(draftError)) return null;
        if (draftError) throw new Error(`Theme instance draft lookup failed: ${draftError.message}`);

        const draftRecord = draft as DbRecord | null;
        if (!draftRecord?.id) return null;

        return {
            id: String(draftRecord.id),
            draft_version: typeof draftRecord.draft_version === 'number' ? draftRecord.draft_version : null,
        };
    }

    private async finalizeInstanceRelease(
        input: {
            storeId: string;
            themeInstanceId?: string | null;
            releaseId: string;
            actorId: string;
            activate: boolean;
        }
    ): Promise<void> {
        if (!input.themeInstanceId || input.releaseId.startsWith('local-fallback:')) return;

        const now = new Date().toISOString();
        const { error: instanceError } = await this.db
            .from('theme_instances')
            .update({
                active_release_id: input.releaseId,
                instance_status: input.activate ? 'active' : 'installed',
                activated_at: input.activate ? now : null,
                updated_at: now,
                updated_by: input.actorId,
            })
            .eq('id', input.themeInstanceId)
            .eq('store_id', input.storeId);

        if (isThemeEngineSchemaUnavailable(instanceError)) return;
        if (instanceError) throw new Error(`Theme instance release attach failed: ${instanceError.message}`);

    }

    // Phase G / G1 — run the section-schema migration registry over a template config at publish time.
    // Generic so the caller's exact type is preserved. Fast-path: with an EMPTY registry (the honest
    // current state — no real historical field renames) this is an identity function with zero marshaling,
    // so publish behavior is unchanged today. The day a real migration is registered in theme-engine, every
    // publish migrates stored configs forward automatically instead of silently rendering a stale shape.
    private applySectionSchemaMigrations<T extends Record<string, unknown>>(templateConfig: T): T {
        if (REGISTERED_SECTION_SCHEMA_MIGRATIONS.length === 0) return templateConfig;
        const result = migrateThemeTemplateSchemasWithRegistry(templateConfig as unknown as StoreTemplateConfig);
        if (result.warnings.length > 0) {
            console.warn(`[theme-publish] section schema migration warnings: ${result.warnings.join('; ')}`);
        }
        return result.templateConfig as unknown as T;
    }

    private buildReleaseArtifacts(
        input: PublishReleaseSnapshotInput,
        releaseId: string,
        releaseVersion: number
    ): DbRecord {
        const runtime = input.runtime || null;
        const liquidBundle = resolveLiquidBundleArtifact(input.releaseConfig);
        const rendererManifest = asRecord(runtime?.rendererManifest);
        const rendererEngine = liquidBundle
            ? 'liquid'
            : typeof rendererManifest.engine === 'string'
                ? rendererManifest.engine
                : 'json-contract';
        const cacheTags = [
            `store:${input.storeId}`,
            `theme:${input.themeId}`,
            `theme_release:${releaseId}`,
            runtime?.themePackageVersionId ? `theme_package_version:${runtime.themePackageVersionId}` : null,
        ].filter((tag): tag is string => typeof tag === 'string');

        return {
            release_manifest: {
                engine: 'theme-engine-v1',
                store_id: input.storeId,
                theme_id: input.themeId,
                release_id: releaseId,
                release_version: releaseVersion,
                theme_instance_id: input.themeInstanceId || null,
                theme_package_version_id: runtime?.themePackageVersionId || null,
                schema_manifest_version: runtime?.schemaManifestVersion || '1.0.0',
                renderer_version: runtime?.rendererVersion || '1.0.0',
                renderer_engine: rendererEngine,
                liquid_ready: Boolean(liquidBundle) || rendererManifest.liquid_ready === true,
                approved_renderer_keys: runtime?.approvedRendererKeys || [],
                ...(liquidBundle ? {
                    liquidBundle,
                    themeBundle: liquidBundle,
                } : {}),
            },
            template_snapshot: input.releaseConfig,
            settings_snapshot: asRecord(input.releaseConfig.themeSettings),
            asset_manifest: runtime?.assetManifest || {},
            cache_manifest: { tags: cacheTags },
            data_binding_manifest: {},
            schema_manifest_version: runtime?.schemaManifestVersion || '1.0.0',
            engine_version: 'theme-engine-v1',
        };
    }

    private async enrichPublishedReleaseSnapshot(
        input: PublishReleaseSnapshotInput,
        releaseId: string,
        releaseVersion: number
    ): Promise<void> {
        if (releaseId.startsWith('local-fallback:')) return;

        const artifacts = this.buildReleaseArtifacts(input, releaseId, releaseVersion);
        const { error } = await this.db
            .from('theme_releases')
            .update({
                theme_instance_id: input.themeInstanceId || null,
                theme_package_version_id: input.runtime?.themePackageVersionId || null,
                ...artifacts,
            })
            .eq('id', releaseId)
            .eq('store_id', input.storeId);

        if (isThemeEngineSchemaUnavailable(error)) return;
        if (error) throw new Error(`Theme release manifest update failed: ${error.message}`);
    }

    private async publishReleaseSnapshot(
        input: PublishReleaseSnapshotInput
    ): Promise<PublishThemeReleaseResult> {
        const { data, error } = await this.db.rpc('publish_theme_release', {
            p_store_id: input.storeId,
            p_theme_id: input.themeId,
            p_release_config: input.releaseConfig,
            p_source_draft_id: input.sourceDraftId || null,
            p_source_draft_version: input.sourceDraftVersion || null,
            p_published_by: input.publishedBy,
            p_publish_message: input.publishMessage || null,
            p_make_store_live: input.makeStoreLive,
            p_request_id: input.requestId || null,
            p_rollback_of_release_id: input.rollbackOfReleaseId || null,
        });

        if (error) {
            if (isMissingPublishReleaseFunction(error)) {
                return this.publishReleaseSnapshotFallback(input);
            }

            throw new Error(`Theme release publish failed: ${error.message}`);
        }

        const result = readPublishedReleaseResult(data);
        await this.enrichPublishedReleaseSnapshot(input, result.release_id, result.release_version);
        return result;
    }

    private async publishReleaseSnapshotFallback(
        input: PublishReleaseSnapshotInput
    ): Promise<PublishThemeReleaseResult> {
        const publishedAt = new Date().toISOString();
        let releaseVersion = 1;
        const fallbackReleaseId = crypto.randomUUID();
        let releaseId: string | null = fallbackReleaseId;

        const { data: latestRelease } = await this.db
            .from('theme_releases')
            .select('release_version')
            .eq('store_id', input.storeId)
            .order('release_version', { ascending: false })
            .limit(1)
            .maybeSingle();

        const latestVersion = (latestRelease as DbRecord | null)?.release_version;
        if (typeof latestVersion === 'number') {
            releaseVersion = latestVersion + 1;
        } else if (typeof latestVersion === 'string') {
            releaseVersion = Number(latestVersion) + 1;
        }

        const { error: supersededError } = await this.db
            .from('theme_releases')
            .update({
                release_status: 'superseded',
                is_current: false,
                updated_at: publishedAt,
            })
            .eq('store_id', input.storeId)
            .eq('is_current', true);

        // Fail before inserting the new release: if the supersede UPDATE fails and we proceed,
        // the INSERT would create a new is_current=true row while the previous row is still
        // is_current=true, leaving two live releases. Failing here keeps is_current consistent
        // and avoids a manual-repair situation.
        if (supersededError) {
            throw new Error(`Theme release supersede failed: ${supersededError.message}`);
        }

        const { data: release } = await this.db
            .from('theme_releases')
            .insert({
                id: fallbackReleaseId,
                store_id: input.storeId,
                theme_id: input.themeId,
                theme_instance_id: input.themeInstanceId || null,
                theme_package_version_id: input.runtime?.themePackageVersionId || null,
                release_version: releaseVersion,
                release_config: input.releaseConfig,
                ...this.buildReleaseArtifacts(input, fallbackReleaseId, releaseVersion),
                release_status: 'published',
                is_current: true,
                source_draft_id: input.sourceDraftId || null,
                source_draft_version: input.sourceDraftVersion || null,
                rollback_of_release_id: input.rollbackOfReleaseId || null,
                publish_message: input.publishMessage || null,
                published_by: input.publishedBy,
                published_at: publishedAt,
                created_at: publishedAt,
                updated_at: publishedAt,
            })
            .select('id, release_version, published_at')
            .single();

        if (release && typeof (release as DbRecord).id === 'string') {
            releaseId = (release as DbRecord).id as string;
            const insertedVersion = (release as DbRecord).release_version;
            if (typeof insertedVersion === 'number') {
                releaseVersion = insertedVersion;
            } else if (typeof insertedVersion === 'string') {
                releaseVersion = Number(insertedVersion);
            }
        }

        const storeUpdates: DbRecord = {
            theme_id: input.themeId,
            template_config: input.releaseConfig,
            storefront_release_version: releaseVersion,
            updated_at: publishedAt,
        };

        if (releaseId) {
            storeUpdates.current_theme_release_id = releaseId;
        }

        if (input.makeStoreLive) {
            storeUpdates.status = 'published';
            storeUpdates.published_at = publishedAt;
        }

        let { error: storeUpdateError } = await this.db
            .from('sites')
            .update(storeUpdates)
            .eq('id', input.storeId);

        if (storeUpdateError) {
            const minimalUpdates: DbRecord = {
                theme_id: input.themeId,
                template_config: input.releaseConfig,
                updated_at: publishedAt,
            };

            if (input.makeStoreLive) {
                minimalUpdates.status = 'published';
                minimalUpdates.published_at = publishedAt;
            }

            ({ error: storeUpdateError } = await this.db
                .from('sites')
                .update(minimalUpdates)
                .eq('id', input.storeId));
        }

        if (storeUpdateError) {
            throw new Error(`Theme release fallback publish failed: ${storeUpdateError.message}`);
        }

        return {
            release_id: releaseId || `local-fallback:${input.storeId}:${releaseVersion}`,
            release_version: releaseVersion,
            published_at: publishedAt,
        };
    }

    async installTheme(
        slug: string,
        input: InstallThemeInput,
        userId: string,
        requestId?: string | null
    ) {
        const store = await this.verifyStoreOwner(input.store_id, userId);
        const theme = await this.getTheme(slug);

        const pricingType = theme.letbuyy_pricing_type || (theme.is_premium ? 'paid' : 'free');

        if (theme.is_premium || pricingType !== 'free') {
            const { data: purchase } = await this.db
                .from('theme_purchases')
                .select('id')
                .eq('user_id', userId)
                .eq('theme_id', theme.id)
                .eq('status', 'completed')
                .single();

            if (!purchase) {
                throw new ValidationError('This premium theme must be purchased before installation');
            }
        }

        await this.db
            .from('store_themes')
            .update({ is_active: false })
            .eq('store_id', input.store_id);

        const { data: installation, error } = await this.db
            .from('store_themes')
            .upsert(
                {
                    store_id: input.store_id,
                    theme_id: theme.id,
                    is_active: true,
                    config_overrides: input.config_overrides,
                    installed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'store_id,theme_id' }
            )
            .select()
            .single();

        if (error || !installation) {
            throw new Error(`Theme installation failed: ${error?.message || 'Unknown error'}`);
        }

        const templateConfig = resolveRenderableThemeTemplateConfig(store.template_config, theme);
        const runtime = await this.validateTemplateConfig(templateConfig, theme);
        const themeInstance = await this.ensureThemeInstance(
            input.store_id,
            theme,
            runtime,
            userId,
            templateConfig,
            true
        );

        const release = await this.publishReleaseSnapshot({
            storeId: input.store_id,
            themeId: theme.slug,
            releaseConfig: templateConfig,
            runtime,
            themeInstanceId: themeInstance?.id || null,
            publishedBy: userId,
            publishMessage: `Installed ${theme.name}`,
            makeStoreLive: store.status === 'published',
            requestId,
        });
        await this.finalizeInstanceRelease({
            storeId: input.store_id,
            themeInstanceId: themeInstance?.id || null,
            releaseId: release.release_id,
            actorId: userId,
            activate: true,
        });

        const installationId = typeof (installation as DbRecord).id === 'string'
            ? String((installation as DbRecord).id)
            : null;
        if (runtime.themePackageId && runtime.themePackageVersionId && installationId) {
            const events = new EventExecutionAdapter(this.db);
            await events.emitDomainEvent({
                storeId: input.store_id,
                aggregateType: 'theme',
                aggregateId: runtime.themePackageId,
                eventType: 'theme.installed',
                idempotencyKey: `theme.installed:${input.store_id}:${runtime.themePackageId}:${installationId}`,
                requestId,
                actorId: userId,
                payload: {
                    site_id: input.store_id,
                    theme_package_id: runtime.themePackageId,
                    theme_version_id: runtime.themePackageVersionId,
                    installation_id: installationId,
                },
            });
        }

        return {
            installation,
            theme: {
                id: theme.id,
                slug: theme.slug,
                name: theme.name,
            },
            release,
        };
    }

    private async loadEditorDraft(storeId: string, themeSlug: string, templateKey: string): Promise<DraftRecord | null> {
        const selectTemplateDraft = () => this.db
            .from('theme_editor_drafts')
            .select('id, draft_config, template_key, version, auto_saved_at')
            .eq('store_id', storeId)
            .eq('theme_id', themeSlug)
            .eq('template_key', templateKey)
            .maybeSingle();

        let { data, error } = await selectTemplateDraft();

        if (isMissingColumnError(error, 'template_key')) {
            if (templateKey !== 'index') return null;
            ({ data, error } = await this.db
                .from('theme_editor_drafts')
                .select('id, draft_config, version, auto_saved_at')
                .eq('store_id', storeId)
                .eq('theme_id', themeSlug)
                .maybeSingle());
        }

        if (error) {
            if (isMissingSchemaError(error)) return null;
            throw new Error(`Theme draft load failed: ${error.message}`);
        }

        return data as DraftRecord | null;
    }

    private async draftRpc(name: string, params: DbRecord): Promise<DbRecord> {
        const { data, error } = await this.db.rpc(name, params);
        if (error) {
            if (error.code === '42501') throw new ForbiddenError('Your current account cannot edit this store theme.');
            if (error.code === 'PT409') throw new ConflictError('Theme draft changed or this retry key belongs to a different intent. Reload before saving again.');
            if (error.code === 'PT400') throw new ValidationError('A current draft version and stable retry key are required.');
            throw new AppError('Theme state is temporarily unavailable. Retry the same request.', 503, 'THEME_STATE_UNAVAILABLE');
        }
        const result = asRecord(data);
        if (!Number.isInteger(result.version) || Number(result.version) < 0) {
            throw new AppError('The theme service returned no confirmed draft state.', 503, 'THEME_STATE_UNAVAILABLE');
        }
        if (name === 'mutate_owned_theme_draft_v1') {
            const operation = params.p_operation;
            const validReceipt = result.version === Number(params.p_base_version) + 1
                && Number.isInteger(result.current_version) && Number(result.current_version) >= Number(result.version)
                && typeof result.replayed === 'boolean'
                && (operation === 'publish' ? ThemePublishResultSchema.safeParse(result).success
                    : operation === 'discard' ? result.deleted === true
                        : ThemeDraftSaveResultSchema.safeParse(result).success)
                && (operation !== 'reorder' || (Array.isArray(result.section_order) && result.section_order.every(id => typeof id === 'string')));
            if (!validReceipt) throw new AppError('The theme service returned no confirmed receipt. Retry the same request.', 503, 'THEME_STATE_UNAVAILABLE');
        }
        return result;
    }

    private async readOwnedDraft(slug: string, storeId: string, actorId: string, templateKey: string): Promise<DbRecord> {
        const state = await this.draftRpc('read_owned_theme_draft_v1', {
            p_actor_id: actorId, p_store_id: storeId, p_theme_slug: slug,
            p_template_key: templateKey, p_bound_site_id: this.boundSiteId || null,
        });
        const store = asRecord(state.store);
        const hasDraftIdentity = UuidSchema.safeParse(state.theme_instance_draft_id).success || UuidSchema.safeParse(state.legacy_draft_id).success;
        if (typeof store.id !== 'string' || store.id.toLowerCase() !== storeId.toLowerCase()
            || typeof state.has_draft !== 'boolean'
            || (state.has_draft && (!hasDraftIdentity || Number(state.version) < 1 || state.template_config === null
                || typeof state.template_config !== 'object' || Array.isArray(state.template_config)))) {
            throw new AppError('The owned theme state could not be confirmed. Retry loading it.', 503, 'THEME_STATE_UNAVAILABLE');
        }
        return state;
    }

    private draftRuntime(runtime: ThemeRuntimeSchema, client?: string): DbRecord {
        if (!runtime.themePackageId || !runtime.themePackageVersionId) {
            throw new AppError('The canonical theme runtime is unavailable.', 503, 'THEME_STATE_UNAVAILABLE');
        }
        return { theme_package_id: runtime.themePackageId, theme_package_version_id: runtime.themePackageVersionId, client };
    }

    async loadEditor(slug: string, storeId: string, userId: string, templateKeyInput = 'index') {
        const templateKey = normalizeThemeTemplateKey(templateKeyInput);
        const state = await this.readOwnedDraft(slug, storeId, userId, templateKey);
        const store = asRecord(state.store) as StoreRecord;
        const theme = await this.getTheme(slug);
        const draft = state.has_draft ? { draft_config: state.template_config, auto_saved_at: state.saved_at, version: state.version } as DraftRecord : null;

        const selectCurrentRelease = (includeDeletedAtFilter: boolean) => {
            const query = this.db
                .from('theme_releases')
                .select('id, release_version, published_at')
                .eq('store_id', storeId)
                .eq('theme_id', theme.slug)
                .eq('is_current', true);

            return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
        };

        let { data: currentRelease, error: currentReleaseError } = await selectCurrentRelease(true).maybeSingle();

        if (isMissingDeletedAtError(currentReleaseError, 'theme_releases')) {
            ({ data: currentRelease } = await selectCurrentRelease(false).maybeSingle());
        }

        if (state.has_draft && !hasRenderableThemeTemplate(state.template_config)) {
            throw new AppError('The saved theme draft is unavailable. Retry loading it.', 503, 'THEME_STATE_UNAVAILABLE');
        }
        const templateConfig =
            hasRenderableThemeTemplate((draft as DraftRecord | null)?.draft_config)
                ? mergeThemeIdentity(asRecord((draft as DraftRecord).draft_config), theme)
                : resolveRenderableThemeTemplateConfig(store.template_config, theme);

        const runtime = await this.schemaRegistry.resolveThemeRuntime(theme);
        const themeInstanceId = typeof state.theme_instance_id === 'string' ? state.theme_instance_id : null;

        return {
            store: {
                id: store.id,
                name: store.name,
                subdomain: store.subdomain || store.store_name,
                status: store.status,
            },
            theme: {
                id: theme.id,
                slug: theme.slug,
                name: theme.name,
                renderer_key: theme.renderer_key || theme.slug,
                theme_package_id: runtime.themePackageId || null,
                theme_package_version_id: runtime.themePackageVersionId || null,
                theme_instance_id: themeInstanceId,
                schema_manifest_version: runtime.schemaManifestVersion,
                schema_source: runtime.source,
            },
            template_key: templateKey,
            templates: listThemeTemplateOptions(templateConfig),
            template_config: templateConfig,
            draft: {
                exists: Boolean(draft),
                template_key: (draft as DraftRecord | null)?.template_key || templateKey,
                updated_at: (draft as DraftRecord | null)?.auto_saved_at || null,
                version: Number(state.version),
            },
            release: currentRelease
                ? {
                    id: (currentRelease as DbRecord).id,
                    version: (currentRelease as DbRecord).release_version,
                    published_at: (currentRelease as DbRecord).published_at,
                }
                : null,
            schemas: {
                sections: runtime.sectionSchemas,
                blocks: runtime.blockSchemas,
                settings: runtime.settingsSchema,
                templates: runtime.templateSchema,
                layouts: runtime.layoutSchema,
            },
            renderer_manifest: runtime.rendererManifest,
            approved_renderer_keys: runtime.approvedRendererKeys,
            version: Number(state.version),
        };
    }

    async saveDraft(slug: string, input: SaveThemeDraftInput, userId: string, requestId?: string | null): Promise<ThemeDraftSaveResult> {
        const templateKey = normalizeThemeTemplateKey(input.template_key);
        const state = await this.readOwnedDraft(slug, input.store_id, userId, templateKey);
        const theme = await this.getTheme(slug);
        const config = this.applySectionSchemaMigrations(mergeThemeIdentity(input.template_config, theme));
        const runtime = state.version === input.base_version ? await this.validateTemplateConfig(config, theme) : null;
        return await this.draftRpc('mutate_owned_theme_draft_v1', {
            p_actor_id: userId, p_store_id: input.store_id, p_theme_slug: theme.slug,
            p_template_key: templateKey, p_base_version: input.base_version, p_key: input.idempotency_key,
            p_operation: 'save', p_config: config, p_runtime: runtime ? this.draftRuntime(runtime, input.client) : {},
            p_bound_site_id: this.boundSiteId || null, p_request_id: requestId || null,
        }) as unknown as ThemeDraftSaveResult;
    }

    async reorderDraft(slug: string, input: ReorderThemeDraftInput, userId: string, requestId?: string | null): Promise<ThemeDraftSaveResult & { section_order: string[] }> {
        // Send the immutable order intent, not a document reconstructed from a
        // later read. Receipt replay must survive both response loss and edits
        // made after the original reorder committed.
        const loaded = await this.loadEditor(slug, input.store_id, userId, input.template_key);
        const theme = await this.getTheme(slug);
        const runtime = await this.schemaRegistry.resolveThemeRuntime(theme);
        return await this.draftRpc('mutate_owned_theme_draft_v1', {
            p_actor_id: userId, p_store_id: input.store_id, p_theme_slug: theme.slug,
            p_template_key: input.template_key, p_base_version: input.base_version, p_key: input.idempotency_key,
            p_operation: 'reorder', p_config: { section_order: input.section_order },
            p_runtime: { ...this.draftRuntime(runtime, input.client), initial_config: loaded.template_config },
            p_bound_site_id: this.boundSiteId || null, p_request_id: requestId || null,
        }) as unknown as ThemeDraftSaveResult & { section_order: string[] };
    }

    async deleteDraft(slug: string, storeId: string, userId: string, requestId?: string | null,
        templateKeyInput = 'index', intent?: { base_version: number; idempotency_key: string }) {
        if (!intent) throw new ValidationError('A current draft version and retry key are required to discard.');
        return this.draftRpc('mutate_owned_theme_draft_v1', {
            p_actor_id: userId, p_store_id: storeId, p_theme_slug: slug,
            p_template_key: normalizeThemeTemplateKey(templateKeyInput), p_base_version: intent.base_version,
            p_key: intent.idempotency_key, p_operation: 'discard',
            p_bound_site_id: this.boundSiteId || null, p_request_id: requestId || null,
        });
    }

    async publish(slug: string, input: PublishThemeInput, userId: string, requestId?: string | null): Promise<ThemePublishResult> {
        const templateKey = normalizeThemeTemplateKey(input.template_key);
        const state = await this.readOwnedDraft(slug, input.store_id, userId, templateKey);
        const theme = await this.getTheme(slug);
        // The RPC rechecks the version while holding the same lock as saves. A
        // caller-supplied document can only match this saved server document.
        const templateConfig = asRecord(state.template_config);
        const runtime = state.has_draft && state.version === input.base_version
            ? await this.validateTemplateConfig(templateConfig, theme) : null;
        const artifacts = runtime ? this.buildReleaseArtifacts({
            storeId: input.store_id, themeId: theme.slug, releaseConfig: templateConfig, runtime,
            themeInstanceId: typeof state.theme_instance_id === 'string' ? state.theme_instance_id : null,
            publishedBy: userId, makeStoreLive: input.make_store_live,
        }, '', 0) : {};
        // A response-loss replay must reach the receipt even after publication
        // cleared the active draft; the database reauthorizes before replay.
        return await this.draftRpc('mutate_owned_theme_draft_v1', {
            p_actor_id: userId, p_store_id: input.store_id, p_theme_slug: theme.slug,
            p_template_key: templateKey, p_base_version: input.base_version, p_key: input.idempotency_key,
            p_operation: 'publish', p_config: input.template_config || null, p_runtime: artifacts,
            p_bound_site_id: this.boundSiteId || null, p_request_id: requestId || null,
            p_publish_options: { publish_message: input.publish_message || null, make_store_live: input.make_store_live },
        }) as unknown as ThemePublishResult;
    }

    async listReleases(slug: string, storeId: string, userId: string) {
        await this.readOwnedDraft(slug, storeId, userId, 'index');
        const theme = await this.getTheme(slug);

        const selectReleases = (includeDeletedAtFilter: boolean) => {
            const query = this.db
                .from('theme_releases')
                .select('id, theme_id, theme_instance_id, theme_package_version_id, release_version, release_status, is_current, publish_message, published_by, published_at, rollback_of_release_id, schema_manifest_version, engine_version, created_at')
                .eq('store_id', storeId)
                .eq('theme_id', theme.slug);

            return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
        };

        let { data, error } = await selectReleases(true).order('release_version', { ascending: false });

        if (isMissingDeletedAtError(error, 'theme_releases')) {
            ({ data, error } = await selectReleases(false).order('release_version', { ascending: false }));
        }

        if (error) {
            throw new Error(`Theme releases load failed: ${error.message}`);
        }

        return data || [];
    }

    async rollbackRelease(
        slug: string,
        releaseId: string,
        input: RollbackThemeReleaseInput,
        userId: string,
        requestId?: string | null
    ) {
        await this.verifyStoreOwner(input.store_id, userId);
        const theme = await this.getTheme(slug);

        // CAS guard: if the caller supplied expected_current_release_id, verify the current
        // release pointer has not changed since the client listed releases. The query is always
        // scoped by store_id — a different site's is_current row can never match.
        // KNOWN TOCTOU RESIDUAL: this check is TS-level only; two truly concurrent rollbacks
        // both passing this window can both reach publishReleaseSnapshot. Full closure requires
        // adding p_expected_current_release_version to the SECURITY DEFINER RPC (ARB-gated).
        if (input.expected_current_release_id) {
            const { data: currentRelease } = await this.db
                .from('theme_releases')
                .select('id')
                .eq('store_id', input.store_id)
                .eq('is_current', true)
                .is('deleted_at', null)
                .maybeSingle();

            const currentId = (currentRelease as ThemeReleaseRecord | null)?.id;
            if (currentId !== input.expected_current_release_id) {
                throw new ConflictError('Current release has changed since listing');
            }
        }

        const selectRelease = (includeDeletedAtFilter: boolean) => {
            const query = this.db
                .from('theme_releases')
                .select('id, store_id, theme_id, release_version, release_config, template_snapshot, settings_snapshot, release_manifest, theme_instance_id, theme_package_version_id, published_at')
                .eq('id', releaseId)
                .eq('store_id', input.store_id)
                .eq('theme_id', theme.slug);

            return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
        };

        let { data: release, error } = await selectRelease(true).single();

        if (isMissingDeletedAtError(error, 'theme_releases')) {
            ({ data: release, error } = await selectRelease(false).single());
        }

        if (error || !release) {
            throw new NotFoundError('Theme release not found');
        }

        const releaseRecord = release as ThemeReleaseRecord;
        const releaseConfig = mergeThemeIdentity(
            Object.keys(asRecord(releaseRecord.template_snapshot)).length > 0
                ? asRecord(releaseRecord.template_snapshot)
                : asRecord(releaseRecord.release_config),
            theme
        );
        const runtime = await this.validateTemplateConfig(releaseConfig, theme);
        const themeInstance = await this.ensureThemeInstance(
            input.store_id,
            theme,
            runtime,
            userId,
            releaseConfig,
            input.make_store_live
        );

        const rollback = await this.publishReleaseSnapshot({
            storeId: input.store_id,
            themeId: theme.slug,
            releaseConfig,
            runtime,
            themeInstanceId: themeInstance?.id || releaseRecord.theme_instance_id || null,
            publishedBy: userId,
            publishMessage: input.rollback_message || `Rollback to release ${releaseRecord.release_version}`,
            makeStoreLive: input.make_store_live,
            requestId,
            rollbackOfReleaseId: releaseRecord.id,
        });
        await this.finalizeInstanceRelease({
            storeId: input.store_id,
            themeInstanceId: themeInstance?.id || releaseRecord.theme_instance_id || null,
            releaseId: rollback.release_id,
            actorId: userId,
            activate: input.make_store_live,
        });

        const events = new EventExecutionAdapter(this.db);
        await events.emitAuditEvent({
            storeId: input.store_id,
            actorId: userId,
            action: 'theme.rollback',
            resourceType: 'theme_release',
            resourceId: rollback.release_id,
            requestId,
            beforeState: {
                rollback_of_release_id: releaseRecord.id,
                rollback_of_version: releaseRecord.release_version,
            },
            afterState: {
                new_release_id: rollback.release_id,
                new_release_version: rollback.release_version,
            },
        });

        return {
            rollback,
            restored_release: {
                id: releaseRecord.id,
                version: releaseRecord.release_version,
                published_at: releaseRecord.published_at || null,
            },
            theme: {
                id: theme.id,
                slug: theme.slug,
                name: theme.name,
            },
        };
    }

    async validateDocument(
        slug: string,
        input: ValidateThemeDocumentInput,
        userId: string
    ) {
        // Auth: verify the authenticated merchant owns the supplied store_id.
        // site_id is NEVER derived from slug or path — always from the validated body.
        await this.verifyStoreOwner(input.store_id, userId);

        // Validate the ThemeDocument V2 structure. parseThemeDocument throws ValidationError
        // on any structural violation. No DB writes occur in this method.
        const doc = parseThemeDocument(input.theme_document);

        // If an optional Liquid bundle is supplied, enforce the G4 version gate.
        if (input.bundle !== undefined) {
            parseLiquidThemePackageBundle(input.bundle);
        }

        // Fire-and-forget audit trail: emit a lightweight audit event for forensic replay
        // (e.g. repeated validation probing with adversarial bundles). The method remains
        // logically read-only — no await, errors are swallowed intentionally.
        const events = new EventExecutionAdapter(this.db);
        events.emitAuditEvent({
            storeId: input.store_id,
            actorId: userId,
            action: 'theme.document.validate',
            resourceType: 'theme',
            resourceId: slug,
            afterState: {
                schema_version: doc.document_version ?? '2.0',
                bundle_supplied: input.bundle !== undefined,
            },
        }).catch(() => { /* best-effort — validation result is not gated on audit write */ });

        return {
            valid: true,
            schema_version: doc.document_version ?? '2.0',
            issues: [] as string[],
        };
    }

    async createPreviewSession(
        slug: string,
        input: PreviewTokenInput,
        userId: string,
        requestId?: string | null
    ) {
        const templateKey = normalizeThemeTemplateKey(input.template_key);
        const state = await this.readOwnedDraft(slug, input.store_id, userId, templateKey);
        const theme = await this.getTheme(slug);
        const instanceDraft = typeof state.theme_instance_draft_id === 'string'
            ? { id: state.theme_instance_draft_id, draft_version: Number(state.version) } : null;
        const legacyDraftRecord = !instanceDraft && typeof state.legacy_draft_id === 'string'
            ? { id: state.legacy_draft_id, version: Number(state.version) } : null;
        if (!instanceDraft && !legacyDraftRecord) throw new NotFoundError('No saved draft exists for preview');

        const token = `${crypto.randomUUID()}.${crypto.randomUUID()}`;
        const tokenHash = await sha256Hex(token);
        const expiresAt = new Date(Date.now() + input.ttl_seconds * 1000).toISOString();
        const previewPayload: DbRecord = {
            store_id: input.store_id,
            theme_id: theme.slug,
            draft_id: legacyDraftRecord?.id || null,
            theme_instance_draft_id: legacyDraftRecord?.id ? null : instanceDraft?.id || null,
            draft_version: legacyDraftRecord?.version || instanceDraft?.draft_version || 1,
            token_hash: tokenHash,
            expires_at: expiresAt,
            created_by: userId,
        };

        let { data, error } = await this.db
            .from('theme_preview_sessions')
            .insert(previewPayload)
            .select('id, expires_at, draft_version')
            .single();

        if (isMissingColumnError(error, 'theme_instance_draft_id')) {
            const legacyPreviewPayload = { ...previewPayload };
            delete legacyPreviewPayload.theme_instance_draft_id;
            ({ data, error } = await this.db
                .from('theme_preview_sessions')
                .insert(legacyPreviewPayload)
                .select('id, expires_at, draft_version')
                .single());
        }

        if (error || !data) {
            throw new Error(`Theme preview session creation failed: ${error?.message || 'Unknown error'}`);
        }

        const events = new EventExecutionAdapter(this.db);
        await events.emitAuditEvent({
            storeId: input.store_id,
            actorId: userId,
            action: 'theme.preview_session.create',
            resourceType: 'theme_preview_session',
            resourceId: String(data.id),
            requestId,
            afterState: {
                theme_id: theme.slug,
                template_key: templateKey,
                draft_id: legacyDraftRecord?.id || null,
                theme_instance_draft_id: legacyDraftRecord?.id ? null : instanceDraft?.id || null,
                draft_version: data.draft_version,
                expires_at: data.expires_at,
            },
        });

        return {
            preview_session_id: data.id,
            preview_token: token,
            expires_at: data.expires_at,
            draft_version: data.draft_version,
            template_key: templateKey,
        };
    }

    // ─── Phase Q — Theme Library Management ───────────────────────────────────
    // All methods call verifyStoreOwner FIRST (before any theme_instances query)
    // and scope ALL subsequent queries by store_id. Cross-tenant isolation is
    // proven at the logic level in theme-library-q.test.ts.

    /**
     * Materializes the theme_packages + theme_package_versions rows a site-private theme needs before it
     * can own a theme_instance: theme_package_id and theme_package_version_id are both NOT NULL with FKs
     * onto those tables. installTheme() gets them for free via resolveThemeRuntime(); the library
     * create/duplicate paths have no marketplace package to resolve, so they ask for one here.
     *
     * The generated package is forced to status='draft' because theme_packages_public_read exposes
     * status='active' rows to anon — a merchant's private theme, whose name they chose, must never
     * surface there.
     */
    private async provisionSiteThemePackage(theme: ThemeRegistryThemeInput): Promise<ThemePackageRuntime> {
        const runtime = await this.schemaRegistry.ensureThemePackageRuntime(theme);
        if (!runtime) {
            throw new Error('Theme package registry is unavailable; cannot create a theme instance');
        }

        const { error } = await this.db
            .from('theme_packages')
            .update({ status: 'draft', updated_at: new Date().toISOString() })
            .eq('id', runtime.themePackageId);

        if (error) {
            throw new Error(`Theme package visibility update failed: ${error.message}`);
        }

        return runtime;
    }

    /**
     * Unwinds a half-created site-private theme. Without it a failed create/duplicate leaves an orphan
     * `themes` row that appears nowhere in the library (it has no instance) yet holds its slug forever.
     * Best-effort: cleanup errors are swallowed so the original failure is what the caller sees.
     * theme_package_versions and the schema/renderer manifests cascade from theme_packages.
     */
    private async discardSiteThemeScaffold(themeId: string, themePackageId?: string | null) {
        try {
            if (themePackageId) {
                await this.db.from('theme_packages').delete().eq('id', themePackageId);
            }
            await this.db.from('themes').delete().eq('id', themeId);
        } catch {
            // Intentionally ignored — the caller rethrows the real failure.
        }
    }

    async listSiteThemes(storeId: string, userId: string) {
        // Tenancy step 1: verify ownership (throws ForbiddenError if not owner)
        await this.verifyStoreOwner(storeId, userId);

        // Tenancy step 2: get current published theme_id from authenticated store
        const { data: siteData } = await this.db
            .from('sites')
            .select('theme_id')
            .eq('id', storeId)
            .maybeSingle();
        const currentThemeId = (siteData as DbRecord | null)?.theme_id as string | null ?? null;

        // Tenancy step 3: list theme_instances scoped to this store only
        const { data: instances, error: instancesError } = await this.db
            .from('theme_instances')
            .select('id, theme_slug, instance_status, created_at, updated_at, active_release_id, theme_package_version_id')
            .eq('store_id', storeId)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (instancesError) {
            throw new Error(`Theme library load failed: ${instancesError.message}`);
        }

        const instanceList = (instances || []) as DbRecord[];

        // Tenancy step 4: for each instance enrich with theme metadata and release info
        // All sub-queries are also scoped by store_id where applicable
        const themes = await Promise.all(instanceList.map(async (instance) => {
            const themeSlug = String(instance.theme_slug || '');

            // Fetch theme metadata (no is_active filter — site-private themes have is_active=false)
            const { data: themeData } = await this.db
                .from('themes')
                .select('id, name, slug, description, schema_version')
                .eq('slug', themeSlug)
                .maybeSingle();

            // Fetch last published release for this store + theme (scoped by store_id first)
            const { data: lastRelease } = await this.db
                .from('theme_releases')
                .select('published_at, release_version, theme_package_version_id')
                .eq('store_id', storeId)
                .eq('theme_id', themeSlug)
                .eq('is_current', true)
                .maybeSingle();

            // Check if there is any draft for this store + theme (scoped by store_id first)
            const { data: draft } = await this.db
                .from('theme_editor_drafts')
                .select('id')
                .eq('store_id', storeId)
                .eq('theme_id', themeSlug)
                .is('deleted_at', null)
                .maybeSingle();

            const theme = themeData as DbRecord | null;
            const release = lastRelease as DbRecord | null;

            return {
                slug: themeSlug,
                name: (theme?.name as string | null) || themeSlug,
                description: (theme?.description as string | null) || null,
                instance_id: String(instance.id || ''),
                instance_status: String(instance.instance_status || 'installed'),
                installed_at: String(instance.created_at || ''),
                last_published_at: release?.published_at ? String(release.published_at) : null,
                last_modified_at: String(instance.updated_at || instance.created_at || ''),
                hasDraft: Boolean(draft),
                isCurrentlyPublished: currentThemeId === themeSlug,
                updateAvailable: false,
                theme_package_version_id: (release?.theme_package_version_id || instance.theme_package_version_id || null) as string | null,
                active_release_id: (instance.active_release_id || null) as string | null,
            };
        }));

        return { themes };
    }

    async createSiteTheme(
        storeId: string,
        input: CreateSiteThemeInput,
        userId: string,
        requestId?: string | null
    ) {
        // Tenancy step 1: verify ownership
        await this.verifyStoreOwner(storeId, userId);

        const now = new Date().toISOString();
        const newSlug = `site-theme-${crypto.randomUUID()}`;

        // Insert a site-private themes row. is_active=false keeps it out of the public catalog
        // (GET /themes filters by is_active=true). owned_by_site_id scopes ownership.
        // Requires migration 190_theme_library_q.sql to add owned_by_site_id + is_site_private.
        const { data: themeRow, error: themeError } = await this.db
            .from('themes')
            .insert({
                slug: newSlug,
                name: input.name,
                is_active: false,
                is_site_private: true,
                owned_by_site_id: storeId,
                created_at: now,
                updated_at: now,
            })
            .select(THEME_REGISTRY_COLUMNS)
            .single();

        if (themeError || !themeRow) {
            throw new Error(`Theme create failed: ${themeError?.message || 'Unknown error'}`);
        }

        const themeRecord = themeRow as DbRecord;
        let packageRuntime: ThemePackageRuntime | null = null;

        try {
            // theme_instances.theme_package_id / theme_package_version_id are NOT NULL, so a blank
            // site theme needs its own package registry rows before the instance can be inserted.
            packageRuntime = await this.provisionSiteThemePackage(themeRecord as ThemeRegistryThemeInput);

            // Insert theme_instance scoped to this store
            const { data: instanceRow, error: instanceError } = await this.db
                .from('theme_instances')
                .insert({
                    store_id: storeId,
                    theme_package_id: packageRuntime.themePackageId,
                    theme_package_version_id: packageRuntime.themePackageVersionId,
                    theme_slug: newSlug,
                    instance_status: 'installed',
                    created_by: userId,
                    updated_by: userId,
                    created_at: now,
                    updated_at: now,
                })
                .select('id, theme_slug, instance_status, created_at')
                .single();

            if (instanceError || !instanceRow) {
                throw new Error(`Theme instance create failed: ${instanceError?.message || 'Unknown error'}`);
            }

            const events = new EventExecutionAdapter(this.db);
            await events.emitAuditEvent({
                storeId,
                actorId: userId,
                action: 'theme.create',
                resourceType: 'theme_instance',
                resourceId: String((instanceRow as DbRecord).id || ''),
                requestId,
                afterState: {
                    theme_slug: newSlug,
                    name: input.name,
                    template_slug: input.template_slug || null,
                },
            });

            return {
                slug: String(themeRecord.slug),
                name: String(themeRecord.name),
                instance_id: String((instanceRow as DbRecord).id || ''),
                instance_status: 'installed',
                created_at: now,
            };
        } catch (err) {
            await this.discardSiteThemeScaffold(String(themeRecord.id), packageRuntime?.themePackageId);
            throw err;
        }
    }

    async duplicateSiteTheme(
        slug: string,
        storeId: string,
        input: DuplicateSiteThemeInput,
        userId: string,
        requestId?: string | null
    ) {
        // Tenancy step 1: verify ownership
        await this.verifyStoreOwner(storeId, userId);

        // Tenancy step 2: confirm the source theme_instance belongs to this store
        // (cross-tenant: no row returned → 404 not 403 to prevent enumeration)
        const { data: sourceInstance } = await this.db
            .from('theme_instances')
            .select('id, theme_slug, active_release_id')
            .eq('store_id', storeId)
            .eq('theme_slug', slug)
            .is('deleted_at', null)
            .maybeSingle();

        if (!sourceInstance) {
            throw new NotFoundError('Theme not found in your store');
        }

        // Tenancy step 3: get theme metadata for the source
        const { data: sourceTheme } = await this.db
            .from('themes')
            .select('id, slug, name')
            .eq('slug', slug)
            .maybeSingle();

        const sourceThemeRecord = sourceTheme as DbRecord | null;
        const sourceName = (sourceThemeRecord?.name as string | null) || slug;
        const newName = input.name || `Copy of ${sourceName}`;
        const newSlug = `site-theme-${crypto.randomUUID()}`;
        const now = new Date().toISOString();

        // Tenancy step 4: get the release config for cloning (scoped to this store)
        let cloneConfig: DbRecord = {};
        if ((sourceInstance as DbRecord).active_release_id) {
            const { data: releaseData } = await this.db
                .from('theme_releases')
                .select('release_config, template_snapshot')
                .eq('id', String((sourceInstance as DbRecord).active_release_id))
                .eq('store_id', storeId)
                .maybeSingle();
            const release = releaseData as DbRecord | null;
            cloneConfig = (release?.template_snapshot as DbRecord | null) ||
                (release?.release_config as DbRecord | null) || {};
        }

        // Insert site-private themes row (duplicate)
        const { data: themeRow, error: themeError } = await this.db
            .from('themes')
            .insert({
                slug: newSlug,
                name: newName,
                is_active: false,
                is_site_private: true,
                owned_by_site_id: storeId,
                created_at: now,
                updated_at: now,
            })
            .select(THEME_REGISTRY_COLUMNS)
            .single();

        if (themeError || !themeRow) {
            throw new Error(`Theme duplicate (themes row) failed: ${themeError?.message || 'Unknown error'}`);
        }

        const newThemeRecord = themeRow as DbRecord;
        let packageRuntime: ThemePackageRuntime | null = null;

        try {
            // Same NOT NULL package columns as createSiteTheme — the copy needs its own registry rows.
            packageRuntime = await this.provisionSiteThemePackage(newThemeRecord as ThemeRegistryThemeInput);

            // Insert new theme_instance for this store.
            // installed_config is NOT NULL DEFAULT '{}' — send {} rather than null when there is
            // no release to clone from.
            const { data: instanceRow, error: instanceError } = await this.db
                .from('theme_instances')
                .insert({
                    store_id: storeId,
                    theme_package_id: packageRuntime.themePackageId,
                    theme_package_version_id: packageRuntime.themePackageVersionId,
                    theme_slug: newSlug,
                    instance_status: 'installed',
                    installed_config: cloneConfig,
                    created_by: userId,
                    updated_by: userId,
                    created_at: now,
                    updated_at: now,
                })
                .select('id, theme_slug, instance_status, created_at')
                .single();

            if (instanceError || !instanceRow) {
                throw new Error(`Theme duplicate (instance) failed: ${instanceError?.message || 'Unknown error'}`);
            }

            const events = new EventExecutionAdapter(this.db);
            await events.emitAuditEvent({
                storeId,
                actorId: userId,
                action: 'theme.duplicate',
                resourceType: 'theme_instance',
                resourceId: String((instanceRow as DbRecord).id || ''),
                requestId,
                afterState: {
                    source_slug: slug,
                    new_slug: newSlug,
                    new_name: newName,
                },
            });

            return {
                slug: newSlug,
                name: newName,
                source_slug: slug,
                instance_id: String((instanceRow as DbRecord).id || ''),
                instance_status: 'installed',
                created_at: now,
            };
        } catch (err) {
            await this.discardSiteThemeScaffold(String(newThemeRecord.id), packageRuntime?.themePackageId);
            throw err;
        }
    }

    async renameSiteTheme(
        slug: string,
        storeId: string,
        input: RenameSiteThemeInput,
        userId: string,
        requestId?: string | null
    ) {
        // Tenancy step 1: verify ownership
        await this.verifyStoreOwner(storeId, userId);

        // Tenancy step 2: confirm theme_instance belongs to this store
        const { data: instance } = await this.db
            .from('theme_instances')
            .select('id')
            .eq('store_id', storeId)
            .eq('theme_slug', slug)
            .is('deleted_at', null)
            .maybeSingle();

        if (!instance) {
            throw new NotFoundError('Theme not found in your store');
        }

        const now = new Date().toISOString();

        // Tenancy step 3: verify theme is site-owned (not a shared marketplace theme).
        // Marketplace themes (owned_by_site_id IS NULL) cannot be renamed via this path —
        // they are shared catalog rows visible to every tenant. Merchants must duplicate
        // first to create a site-private copy, then rename the copy.
        const { data: themeRow } = await this.db
            .from('themes')
            .select('owned_by_site_id')
            .eq('slug', slug)
            .maybeSingle();

        const ownedBySiteId = (themeRow as DbRecord | null)?.owned_by_site_id as string | null ?? null;
        if (ownedBySiteId === null || ownedBySiteId !== storeId) {
            throw new ForbiddenError(
                'Marketplace themes cannot be renamed. Duplicate the theme first to create a site-owned copy.',
            );
        }

        // Tenancy step 4: UPDATE scoped by owned_by_site_id — belt-and-suspenders guard that
        // ensures the DB-level WHERE clause prevents mutations to shared catalog rows even if
        // the application-level check above were somehow bypassed.
        const { error: renameError } = await this.db
            .from('themes')
            .update({ name: input.name, updated_at: now })
            .eq('slug', slug)
            .eq('owned_by_site_id', storeId);

        if (renameError) {
            throw new Error(`Theme rename failed: ${renameError.message}`);
        }

        const events = new EventExecutionAdapter(this.db);
        await events.emitAuditEvent({
            storeId,
            actorId: userId,
            action: 'theme.rename',
            resourceType: 'theme',
            resourceId: slug,
            requestId,
            afterState: {
                slug,
                name: input.name,
            },
        });

        return { slug, name: input.name };
    }

    async archiveSiteTheme(
        slug: string,
        storeId: string,
        input: ArchiveSiteThemeInput,
        userId: string,
        requestId?: string | null
    ) {
        // Tenancy step 1: verify ownership
        await this.verifyStoreOwner(storeId, userId);

        // Tenancy step 2: load site to check currently published theme (scoped by store_id)
        const { data: siteData } = await this.db
            .from('sites')
            .select('theme_id')
            .eq('id', storeId)
            .maybeSingle();

        const currentThemeId = (siteData as DbRecord | null)?.theme_id as string | null ?? null;

        // SAFETY: block archive if this is the currently-published theme
        if (currentThemeId === slug) {
            throw new ConflictError('THEME_CURRENTLY_PUBLISHED: Cannot archive the currently published theme');
        }

        // Tenancy step 3: confirm theme_instance belongs to this store
        const { data: instance } = await this.db
            .from('theme_instances')
            .select('id, instance_status')
            .eq('store_id', storeId)
            .eq('theme_slug', slug)
            .is('deleted_at', null)
            .maybeSingle();

        if (!instance) {
            throw new NotFoundError('Theme not found in your store');
        }

        const now = new Date().toISOString();

        // Tenancy step 4: update instance_status to 'archived' scoped by store_id AND id
        const { error: archiveError } = await this.db
            .from('theme_instances')
            .update({ instance_status: 'archived', updated_at: now, updated_by: userId })
            .eq('store_id', storeId)
            .eq('id', String((instance as DbRecord).id));

        if (archiveError) {
            throw new Error(`Theme archive failed: ${archiveError.message}`);
        }

        const events = new EventExecutionAdapter(this.db);
        await events.emitAuditEvent({
            storeId,
            actorId: userId,
            action: 'theme.archive',
            resourceType: 'theme_instance',
            resourceId: String((instance as DbRecord).id),
            requestId,
            afterState: { slug, instance_status: 'archived' },
        });

        return { slug, archived: true };
    }

    async deleteUnpublishedSiteTheme(
        slug: string,
        storeId: string,
        userId: string,
        requestId?: string | null
    ) {
        // Tenancy step 1: verify ownership
        await this.verifyStoreOwner(storeId, userId);

        // Tenancy step 2: load site to check currently published theme (scoped by store_id)
        const { data: siteData } = await this.db
            .from('sites')
            .select('theme_id')
            .eq('id', storeId)
            .maybeSingle();

        const currentThemeId = (siteData as DbRecord | null)?.theme_id as string | null ?? null;

        // SAFETY: block delete of the currently-published theme (hard guard)
        if (currentThemeId === slug) {
            throw new ConflictError('CANNOT_DELETE_PUBLISHED_THEME: Cannot delete the currently published theme');
        }

        // Also check theme_releases for any is_current=true release scoped to this store
        const { data: currentRelease } = await this.db
            .from('theme_releases')
            .select('id')
            .eq('store_id', storeId)
            .eq('theme_id', slug)
            .eq('is_current', true)
            .maybeSingle();

        if (currentRelease) {
            throw new ConflictError('CANNOT_DELETE_PUBLISHED_THEME: Cannot delete the currently published theme');
        }

        // Tenancy step 3: confirm theme_instance belongs to this store
        const { data: instance } = await this.db
            .from('theme_instances')
            .select('id')
            .eq('store_id', storeId)
            .eq('theme_slug', slug)
            .is('deleted_at', null)
            .maybeSingle();

        if (!instance) {
            throw new NotFoundError('Theme not found in your store');
        }

        const now = new Date().toISOString();

        // Tenancy step 4: soft-delete — set deleted_at + instance_status='deleted', scoped by store_id AND id
        const { error: deleteError } = await this.db
            .from('theme_instances')
            .update({
                deleted_at: now,
                instance_status: 'deleted',
                updated_at: now,
                updated_by: userId,
            })
            .eq('store_id', storeId)
            .eq('id', String((instance as DbRecord).id));

        if (deleteError) {
            throw new Error(`Theme delete failed: ${deleteError.message}`);
        }

        const events = new EventExecutionAdapter(this.db);
        await events.emitAuditEvent({
            storeId,
            actorId: userId,
            action: 'theme.delete',
            resourceType: 'theme_instance',
            resourceId: String((instance as DbRecord).id),
            requestId,
            afterState: { slug, deleted_at: now },
        });

        return { slug, deleted: true };
    }

    // ── Phase AB — Theme Version Update ────────────────────────────────────────

    /**
     * Load the current (is_current=true) release's Liquid bundle and convert it to a
     * ThemeDocument for use by planThemeSafeUpdate / computeThemeUpdateDiff.
     *
     * TENANCY: query is scoped by store_id + theme_id — a different site's release can
     * never match. Callers must verify ownership BEFORE calling this method.
     */
    async loadCurrentReleaseBundle(
        storeId: string,
        themeSlug: string,
    ): Promise<{
        currentDocument: ThemeDocument;
        currentReleaseConfig: DbRecord;
        currentReleaseId: string;
    }> {
        const { data: release, error } = await this.db
            .from('theme_releases')
            .select('id, release_config')
            .eq('store_id', storeId)
            .eq('theme_id', themeSlug)
            .eq('is_current', true)
            .is('deleted_at', null)
            .maybeSingle();

        if (error || !release) {
            throw new NotFoundError('No current theme release found for this store');
        }

        const releaseRecord = release as ThemeReleaseRecord;
        const releaseConfig = asRecord(releaseRecord.release_config ?? {});
        const bundle = resolveLiquidBundleArtifact(releaseConfig);

        if (!bundle) {
            throw new NotFoundError('Current release does not contain a Liquid bundle');
        }

        // parseLiquidThemePackageBundle validates schema + G4 gate
        const parsedBundle = parseLiquidThemePackageBundle(bundle);
        const currentDocument = toThemeDocumentV2(parsedBundle);

        return {
            currentDocument,
            currentReleaseConfig: releaseConfig,
            currentReleaseId: releaseRecord.id,
        };
    }

    /**
     * Load a specific theme_package_versions row and return its Liquid bundle.
     * Throws ValidationError if the row is missing or the bundle is invalid / has
     * an unsupported schema_version (G4 gate inside parseLiquidThemePackageBundle).
     *
     * NOT tenant-scoped at this layer (package versions are global catalog rows).
     * Callers must verify ownership of the store before calling this method.
     */
    async loadTargetPackageVersionBundle(packageVersionId: string): Promise<LiquidThemePackageBundle> {
        const { data: pkgVersion, error } = await this.db
            .from('theme_package_versions')
            .select('id, package_manifest')
            .eq('id', packageVersionId)
            .maybeSingle();

        if (error || !pkgVersion) {
            throw new NotFoundError('Theme package version not found');
        }

        const manifest = asRecord((pkgVersion as DbRecord).package_manifest ?? {});
        const rawBundle = manifest.liquidBundle;

        if (!rawBundle) {
            throw new ValidationError('Package version does not contain a Liquid bundle');
        }

        try {
            return parseLiquidThemePackageBundle(rawBundle);
        } catch (err) {
            // Convert ZodError / UnsupportedLiquidBundleSchemaVersionError → ValidationError
            // so the route can surface it as a 422 rather than an unhandled 500.
            throw new ValidationError(
                `Target package version has an invalid or unsupported Liquid bundle: ${(err as Error).message}`,
            );
        }
    }

    /**
     * Publish a new theme release with a merged Liquid bundle produced by
     * planThemeSafeUpdate / fromThemeDocumentV2. Includes idempotency pre-check
     * (returns existing release if the same idempotency_key was already used for
     * this store) and post-enrich (persists the key on the new release row).
     *
     * TENANCY: store_id is the FIRST filter in every DB query — cross-tenant
     * collision is structurally impossible.
     * NO-DATA-LOSS LAW: the merged bundle was validated by parseThemeDocument inside
     * planThemeSafeUpdate before being passed here; conflicts are surfaced to the caller
     * via diff.conflicts before this method is invoked.
     */
    async publishVersionUpdateRelease(input: {
        storeId: string;
        themeSlug: string;
        mergedBundle: LiquidThemePackageBundle;
        currentReleaseConfig: DbRecord;
        userId: string;
        idempotencyKey: string;
        publishMessage?: string | null;
        makeStoreLive: boolean;
        requestId?: string | null;
    }): Promise<{ release_id: string; release_version: number; published_at: string; idempotent: boolean }> {
        // Idempotency pre-check — store_id is always the FIRST filter (cross-tenant proof)
        const { data: existingRelease } = await this.db
            .from('theme_releases')
            .select('id, release_version, published_at')
            .eq('store_id', input.storeId)
            .eq('idempotency_key', input.idempotencyKey)
            .is('deleted_at', null)
            .maybeSingle();

        if (existingRelease) {
            const existing = existingRelease as ThemeReleaseRecord;
            return {
                release_id: existing.id,
                release_version: existing.release_version,
                published_at: existing.published_at || new Date().toISOString(),
                idempotent: true,
            };
        }

        // Build release config: inherit all current release fields, replace liquidBundle
        // with the merged bundle produced by planThemeSafeUpdate → fromThemeDocumentV2.
        const releaseConfig: DbRecord = {
            ...input.currentReleaseConfig,
            liquidBundle: input.mergedBundle,
        };

        const release = await this.publishReleaseSnapshot({
            storeId: input.storeId,
            themeId: input.themeSlug,
            releaseConfig,
            publishedBy: input.userId,
            publishMessage:
                input.publishMessage ||
                `Version update to ${String((input.mergedBundle as unknown as DbRecord).schema_version)}`,
            makeStoreLive: input.makeStoreLive,
            requestId: input.requestId,
        });

        // Idempotency post-enrich: persist the caller-supplied key so subsequent retries
        // hit the pre-check above. Both store_id and id are required — always tenant-scoped.
        if (!release.release_id.startsWith('local-fallback:')) {
            await this.db
                .from('theme_releases')
                .update({ idempotency_key: input.idempotencyKey })
                .eq('store_id', input.storeId)
                .eq('id', release.release_id);
        }

        return {
            release_id: release.release_id,
            release_version: release.release_version,
            published_at: release.published_at,
            idempotent: false,
        };
    }
}
