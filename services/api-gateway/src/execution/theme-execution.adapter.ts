import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { THEME_APPLICATION_WORKFLOWS, THEME_EXECUTION_PIPELINES, defineRuntimeBridge } from '@letbuyy/shared-types';
import {
    asThemeRecord as asRecord,
    collectThemeTemplateValidationIssues,
    hasRenderableThemeTemplate,
    LiquidThemePackageBundleSchema,
    mergeThemeIdentity,
    migrateThemeTemplateSchemasWithRegistry,
    REGISTERED_SECTION_SCHEMA_MIGRATIONS,
    resolveRenderableThemeTemplateConfig,
    type StoreTemplateConfig,
} from '@letbuyy/theme-engine';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';
import type {
    InstallThemeInput,
    PreviewTokenInput,
    PublishThemeInput,
    RollbackThemeReleaseInput,
    SaveThemeDraftInput,
} from '../schemas/theme.schema';
import { EventExecutionAdapter } from './event-execution.adapter';
import { SchemaRegistryExecutionAdapter, type ThemeRuntimeSchema } from './schema-registry-execution.adapter';

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
        text.includes('does not exist')
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
    return typeof baseVersion === 'number' && Number.isFinite(baseVersion) && currentVersion > baseVersion;
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

    constructor(private db: SupabaseClient) {
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

        let { data, error } = await selectStore(true).single();

        if (isMissingDeletedAtError(error, 'sites')) {
            ({ data, error } = await selectStore(false).single());
        }

        if (error || !data) {
            throw new ForbiddenError('Store not found or not owned by this user');
        }

        return data as StoreRecord;
    }

    async getTheme(slug: string): Promise<ThemeRecord> {
        const { data } = await this.db
            .from('themes')
            .select('*')
            .eq('slug', slug)
            .eq('is_active', true)
            .single();

        if (!data) {
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

    private async saveInstanceDraftSnapshot(
        input: {
            storeId: string;
            themeInstanceId?: string | null;
            templateConfig: DbRecord;
            runtime: ThemeRuntimeSchema;
            version: number;
            actorId: string;
            requestId?: string | null;
            baseReleaseId?: string | null;
        }
    ): Promise<string | null> {
        if (!input.themeInstanceId) return null;

        const now = new Date().toISOString();
        const { data: existing, error: existingError } = await this.db
            .from('theme_instance_drafts')
            .select('id, draft_version')
            .eq('theme_instance_id', input.themeInstanceId)
            .eq('draft_status', 'active')
            .is('deleted_at', null)
            .maybeSingle();

        if (isThemeEngineSchemaUnavailable(existingError)) return null;
        if (existingError) throw new Error(`Theme instance draft lookup failed: ${existingError.message}`);

        const existingRecord = existing as DbRecord | null;
        const draftPayload = {
            theme_instance_id: input.themeInstanceId,
            store_id: input.storeId,
            base_release_id: input.baseReleaseId || null,
            draft_status: 'active',
            draft_version: input.version,
            working_manifest: input.templateConfig,
            schema_manifest_version: input.runtime.schemaManifestVersion,
            auto_saved_at: now,
            updated_by: input.actorId,
            updated_at: now,
        };

        const draftResult = existingRecord?.id
            ? await this.db
                .from('theme_instance_drafts')
                .update(draftPayload)
                .eq('id', String(existingRecord.id))
                .select('id')
                .single()
            : await this.db
                .from('theme_instance_drafts')
                .insert({
                    ...draftPayload,
                    created_by: input.actorId,
                    created_at: now,
                })
                .select('id')
                .single();

        if (isThemeEngineSchemaUnavailable(draftResult.error)) return null;
        if (draftResult.error || !draftResult.data) {
            throw new Error(`Theme instance draft save failed: ${draftResult.error?.message || 'Unknown error'}`);
        }

        const draftId = String((draftResult.data as DbRecord).id);
        const patchSequence = input.version;
        const { error: patchError } = await this.db
            .from('theme_draft_patches')
            .insert({
                draft_id: draftId,
                store_id: input.storeId,
                patch_sequence: patchSequence,
                patch_type: 'set',
                operation: { op: 'replace', path: '/', source: 'theme_editor_drafts.compat' },
                path: '/',
                value: input.templateConfig,
                actor_id: input.actorId,
                request_id: input.requestId || null,
                client_revision: input.version,
                server_revision: input.version,
                metadata: { compatibility_snapshot: true },
            });

        if (!patchError) {
            await this.db
                .from('theme_instances')
                .update({ current_draft_id: draftId, updated_at: now, updated_by: input.actorId })
                .eq('id', input.themeInstanceId);
        }

        if (patchError && !isThemeEngineSchemaUnavailable(patchError)) {
            throw new Error(`Theme draft patch append failed: ${patchError.message}`);
        }

        return draftId;
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
            draftId?: string | null;
            activate: boolean;
        }
    ): Promise<void> {
        if (!input.themeInstanceId || input.releaseId.startsWith('local-fallback:')) return;

        const now = new Date().toISOString();
        const { error: instanceError } = await this.db
            .from('theme_instances')
            .update({
                active_release_id: input.releaseId,
                current_draft_id: null,
                instance_status: input.activate ? 'active' : 'installed',
                activated_at: input.activate ? now : null,
                updated_at: now,
                updated_by: input.actorId,
            })
            .eq('id', input.themeInstanceId)
            .eq('store_id', input.storeId);

        if (isThemeEngineSchemaUnavailable(instanceError)) return;
        if (instanceError) throw new Error(`Theme instance release attach failed: ${instanceError.message}`);

        if (input.draftId) {
            const { error: draftError } = await this.db
                .from('theme_instance_drafts')
                .update({ draft_status: 'published', updated_at: now, updated_by: input.actorId })
                .eq('id', input.draftId)
                .eq('store_id', input.storeId);

            if (draftError && !isThemeEngineSchemaUnavailable(draftError)) {
                throw new Error(`Theme instance draft publish failed: ${draftError.message}`);
            }
        }
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

        await this.db
            .from('theme_releases')
            .update({
                release_status: 'superseded',
                is_current: false,
                updated_at: publishedAt,
            })
            .eq('store_id', input.storeId)
            .eq('is_current', true);

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
            throw new Error(`Theme draft load failed: ${error.message}`);
        }

        return data as DraftRecord | null;
    }

    private async loadEditorDraftForWrite(storeId: string, themeSlug: string, templateKey: string): Promise<DraftRecord | null> {
        const { data, error } = await this.db
            .from('theme_editor_drafts')
            .select('id, version, template_key')
            .eq('store_id', storeId)
            .eq('theme_id', themeSlug)
            .eq('template_key', templateKey)
            .maybeSingle();

        if (isMissingColumnError(error, 'template_key')) {
            if (templateKey !== 'index') {
                throw new Error('Template-scoped theme drafts require migration 087_theme_template_drafts.sql before editing non-index templates.');
            }

            const legacy = await this.db
                .from('theme_editor_drafts')
                .select('id, version')
                .eq('store_id', storeId)
                .eq('theme_id', themeSlug)
                .maybeSingle();
            if (legacy.error) throw new Error(`Theme draft lookup failed: ${legacy.error.message}`);
            return legacy.data as DraftRecord | null;
        }

        if (error) throw new Error(`Theme draft lookup failed: ${error.message}`);
        return data as DraftRecord | null;
    }

    private async saveEditorDraftRecord(input: {
        storeId: string;
        themeSlug: string;
        templateKey: string;
        templateConfig: DbRecord;
        version: number;
        savedAt: string;
        actorId: string;
    }): Promise<DraftRecord> {
        const draftPayload = {
            store_id: input.storeId,
            theme_id: input.themeSlug,
            template_key: input.templateKey,
            draft_config: input.templateConfig,
            version: input.version,
            auto_saved_at: input.savedAt,
            updated_at: input.savedAt,
        };

        let { data, error } = await this.db
            .from('theme_editor_drafts')
            .upsert(draftPayload, { onConflict: 'store_id,theme_id,template_key' })
            .select('id, version, auto_saved_at, template_key')
            .single();

        if (isMissingColumnError(error, 'template_key')) {
            if (input.templateKey !== 'index') {
                throw new Error('Template-scoped theme drafts require migration 087_theme_template_drafts.sql before editing non-index templates.');
            }

            const legacyPayload: Record<string, unknown> = { ...draftPayload };
            delete legacyPayload.template_key;
            ({ data, error } = await this.db
                .from('theme_editor_drafts')
                .upsert(legacyPayload, { onConflict: 'store_id,theme_id' })
                .select('id, version, auto_saved_at')
                .single());
        }

        if (error || !data) {
            throw new Error(`Theme draft save failed: ${error?.message || 'Unknown error'}`);
        }

        return data as DraftRecord;
    }

    private async buildTemplateScopedInstanceDraftConfig(input: {
        storeId: string;
        themeSlug: string;
        templateKey: string;
        templateConfig: DbRecord;
    }): Promise<DbRecord> {
        const mergedTemplates: DbRecord = { ...asRecord(input.templateConfig.templates) };
        const applyTemplateFromConfig = (templateKey: string, candidateConfig: unknown) => {
            const candidateTemplate = asRecord(asRecord(candidateConfig).templates)[templateKey];
            if (Object.keys(asRecord(candidateTemplate)).length > 0) {
                mergedTemplates[templateKey] = candidateTemplate;
            }
        };

        const { data, error } = await this.db
            .from('theme_editor_drafts')
            .select('template_key, draft_config')
            .eq('store_id', input.storeId)
            .eq('theme_id', input.themeSlug)
            .is('deleted_at', null);

        if (isMissingColumnError(error, 'template_key')) {
            return input.templateConfig;
        }

        if (error) {
            throw new Error(`Theme draft merge failed: ${error.message}`);
        }

        for (const draft of (data || []) as DraftRecord[]) {
            const templateKey = normalizeThemeTemplateKey(draft.template_key);
            if (templateKey === input.templateKey) continue;
            applyTemplateFromConfig(templateKey, draft.draft_config);
        }

        applyTemplateFromConfig(input.templateKey, input.templateConfig);

        return {
            ...input.templateConfig,
            templates: mergedTemplates,
        };
    }

    async loadEditor(slug: string, storeId: string, userId: string, templateKeyInput = 'index') {
        const templateKey = normalizeThemeTemplateKey(templateKeyInput);
        const store = await this.verifyStoreOwner(storeId, userId);
        const theme = await this.getTheme(slug);

        const draft = await this.loadEditorDraft(storeId, theme.slug, templateKey);

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

        const templateConfig =
            hasRenderableThemeTemplate((draft as DraftRecord | null)?.draft_config)
                ? mergeThemeIdentity(asRecord((draft as DraftRecord).draft_config), theme)
                : resolveRenderableThemeTemplateConfig(store.template_config, theme);

        const runtime = await this.schemaRegistry.resolveThemeRuntime(theme);
        const themeInstance = await this.ensureThemeInstance(
            storeId,
            theme,
            runtime,
            userId,
            templateConfig,
            store.theme_id === theme.slug
        );

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
                theme_instance_id: themeInstance?.id || null,
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
                version: (draft as DraftRecord | null)?.version || 1,
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
            version: (draft as DraftRecord | null)?.version || 1,
        };
    }

    async saveDraft(
        slug: string,
        input: SaveThemeDraftInput,
        userId: string,
        requestId?: string | null
    ) {
        const templateKey = normalizeThemeTemplateKey(input.template_key);
        await this.verifyStoreOwner(input.store_id, userId);
        const theme = await this.getTheme(slug);
        const runtime = await this.validateTemplateConfig(input.template_config, theme);
        const templateConfig = mergeThemeIdentity(input.template_config, theme);
        const themeInstance = await this.ensureThemeInstance(
            input.store_id,
            theme,
            runtime,
            userId,
            templateConfig,
            false
        );

        const existing = await this.loadEditorDraftForWrite(input.store_id, theme.slug, templateKey);

        const existingVersion = (existing?.version || 0);

        if (isStaleThemeEditorBaseVersion(existingVersion, input.base_version)) {
            throw new ConflictError('Theme draft has changed in another session');
        }

        const version = Math.max(existingVersion + 1, 1);
        const savedAt = new Date().toISOString();

        const data = await this.saveEditorDraftRecord({
            storeId: input.store_id,
            themeSlug: theme.slug,
            templateKey,
            templateConfig,
            version,
            savedAt,
            actorId: userId,
        });

        const instanceDraftConfig = await this.buildTemplateScopedInstanceDraftConfig({
            storeId: input.store_id,
            themeSlug: theme.slug,
            templateKey,
            templateConfig,
        });

        const instanceDraftId = await this.saveInstanceDraftSnapshot({
            storeId: input.store_id,
            themeInstanceId: themeInstance?.id || null,
            templateConfig: instanceDraftConfig,
            runtime,
            version,
            actorId: userId,
            requestId,
        });

        const events = new EventExecutionAdapter(this.db);
        await events.emitDomainEvent({
            storeId: input.store_id,
            aggregateType: 'theme_draft',
            aggregateId: String(data.id),
            eventType: 'theme.draft.saved',
            idempotencyKey: `theme.draft.saved:${input.store_id}:${theme.slug}:${templateKey}:${version}`,
            requestId,
            actorId: userId,
            payload: {
                store_id: input.store_id,
                theme_id: theme.slug,
                template_key: templateKey,
                theme_instance_id: themeInstance?.id || null,
                theme_package_version_id: runtime.themePackageVersionId || null,
                theme_instance_draft_id: instanceDraftId,
                draft_id: data.id,
                version,
                client: input.client,
            },
        });

        await events.emitAuditEvent({
            storeId: input.store_id,
            actorId: userId,
            action: 'theme.draft.save',
            resourceType: 'theme_draft',
            resourceId: String(data.id),
            requestId,
            afterState: {
                theme_id: theme.slug,
                template_key: templateKey,
                version,
            },
            metadata: {
                client: input.client,
            },
        });

        return {
            saved_at: savedAt,
            version,
            template_key: templateKey,
            draft: data,
        };
    }

    async deleteDraft(slug: string, storeId: string, userId: string, requestId?: string | null, templateKeyInput = 'index') {
        const templateKey = normalizeThemeTemplateKey(templateKeyInput);
        await this.verifyStoreOwner(storeId, userId);
        const theme = await this.getTheme(slug);

        const draft = await this.loadEditorDraftForWrite(storeId, theme.slug, templateKey);

        const deleteResult = await this.db
            .from('theme_editor_drafts')
            .delete()
            .eq('store_id', storeId)
            .eq('theme_id', theme.slug)
            .eq('template_key', templateKey);

        if (isMissingColumnError(deleteResult.error, 'template_key')) {
            if (templateKey === 'index') {
                await this.db
                    .from('theme_editor_drafts')
                    .delete()
                    .eq('store_id', storeId)
                    .eq('theme_id', theme.slug);
            }
        } else if (deleteResult.error) {
            throw new Error(`Theme draft delete failed: ${deleteResult.error.message}`);
        }

        if (draft) {
            const events = new EventExecutionAdapter(this.db);
            await events.emitDomainEvent({
                storeId,
                aggregateType: 'theme_draft',
                aggregateId: String((draft as DbRecord).id),
                eventType: 'theme.draft.discarded',
                idempotencyKey: `theme.draft.discarded:${storeId}:${theme.slug}:${templateKey}:${(draft as DbRecord).version}`,
                requestId,
                actorId: userId,
                payload: {
                    store_id: storeId,
                    theme_id: theme.slug,
                    template_key: templateKey,
                    draft_id: (draft as DbRecord).id,
                    version: (draft as DbRecord).version,
                },
            });
        }

        return { deleted: true, template_key: templateKey };
    }

    async publish(
        slug: string,
        input: PublishThemeInput,
        userId: string,
        requestId?: string | null
    ) {
        const templateKey = normalizeThemeTemplateKey(input.template_key);
        const store = await this.verifyStoreOwner(input.store_id, userId);
        const theme = await this.getTheme(slug);

        const draftRecord = await this.loadEditorDraft(input.store_id, theme.slug, templateKey);
        const draftVersion = draftRecord?.version || 0;

        if (isStaleThemeEditorBaseVersion(draftVersion, input.base_version)) {
            throw new ConflictError('Theme draft has changed in another session');
        }

        const suppliedPublishConfig = hasRenderableThemeTemplate(input.template_config)
            ? asRecord(input.template_config)
            : null;
        const resolvedTemplateConfig = suppliedPublishConfig
            ? mergeThemeIdentity(suppliedPublishConfig, theme)
            : hasRenderableThemeTemplate(draftRecord?.draft_config)
                ? mergeThemeIdentity(asRecord(draftRecord?.draft_config), theme)
                : resolveRenderableThemeTemplateConfig(store.template_config, theme);
        // Phase G / G1 — migrate stored section schemas forward at publish time so a config authored
        // against an older section shape is snapshotted at the current shape (never silently misrendered).
        const templateConfig = this.applySectionSchemaMigrations(resolvedTemplateConfig);
        const runtime = await this.validateTemplateConfig(templateConfig, theme);
        const themeInstance = await this.ensureThemeInstance(
            input.store_id,
            theme,
            runtime,
            userId,
            templateConfig,
            input.make_store_live
        );

        const release = await this.publishReleaseSnapshot({
            storeId: input.store_id,
            themeId: theme.slug,
            releaseConfig: templateConfig,
            runtime,
            themeInstanceId: themeInstance?.id || null,
            sourceDraftId: draftRecord?.id || null,
            sourceDraftVersion: draftVersion || null,
            publishedBy: userId,
            publishMessage: input.publish_message || null,
            makeStoreLive: input.make_store_live,
            requestId,
        });
        await this.finalizeInstanceRelease({
            storeId: input.store_id,
            themeInstanceId: themeInstance?.id || null,
            releaseId: release.release_id,
            actorId: userId,
            draftId: themeInstance?.current_draft_id || null,
            activate: input.make_store_live,
        });

        await this.deleteDraft(theme.slug, input.store_id, userId, requestId, templateKey);

        const { data: updatedStore } = await this.db
            .from('sites')
            .select('id, status, theme_id, updated_at, current_theme_release_id, storefront_release_version')
            .eq('id', input.store_id)
            .single();

        return {
            store: updatedStore,
            theme: {
                id: theme.id,
                slug: theme.slug,
                name: theme.name,
            },
            release,
            template_key: templateKey,
            published_at: release.published_at,
        };
    }

    async listReleases(slug: string, storeId: string, userId: string) {
        await this.verifyStoreOwner(storeId, userId);
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

    async createPreviewSession(
        slug: string,
        input: PreviewTokenInput,
        userId: string,
        requestId?: string | null
    ) {
        await this.verifyStoreOwner(input.store_id, userId);
        const theme = await this.getTheme(slug);
        const templateKey = normalizeThemeTemplateKey(input.template_key);
        const legacyDraftRecord = await this.loadEditorDraft(input.store_id, theme.slug, templateKey);
        const instanceDraft = legacyDraftRecord?.id ? null : await this.loadActiveInstanceDraft(input.store_id, theme);

        if (!legacyDraftRecord?.id && !instanceDraft?.id) {
            throw new NotFoundError('No saved draft exists for preview');
        }

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
}
