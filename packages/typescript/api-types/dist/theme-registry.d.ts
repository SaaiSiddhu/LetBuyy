/**
 * Canonical theme schema registry.
 *
 * This package is the cross-surface contract source for editable theme sections
 * until the JSON Schema/Dart generation step consumes the worker registry.
 * Admin Web re-exports these contracts, the worker validates against them, and
 * Flutter receives the same schema through the worker API.
 */
export interface SchemaField {
    type: 'text' | 'textarea' | 'richtext' | 'color' | 'image' | 'select' | 'toggle' | 'range' | 'number' | 'url' | 'radio';
    label: string;
    default?: unknown;
    maxLength?: number;
    options?: string[];
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    info?: string;
    description?: string;
}
export interface BlockSchema {
    name: string;
    fields: Record<string, SchemaField>;
}
export interface SectionSchema {
    name: string;
    type: string;
    description: string;
    defaults: Record<string, unknown>;
    presets?: Array<{
        name: string;
        settings: Record<string, unknown>;
    }>;
    settings_schema: Record<string, SchemaField>;
    blocks_schema?: Record<string, BlockSchema>;
    sample_blocks?: Array<{
        type: string;
        settings: Record<string, unknown>;
    }>;
}
export interface ThemeSettingsGroup {
    label: string;
    description: string;
    fields: Record<string, SchemaField>;
}
export interface ThemeSettingsSchema {
    schema_version: string;
    settings: Record<string, ThemeSettingsGroup>;
}
export interface StorefrontThemeBlockConfig {
    id: string;
    type: string;
    order: number;
    visible: boolean;
    settings: Record<string, unknown>;
}
export interface StorefrontThemeSectionConfig {
    id: string;
    type: string;
    order: number;
    visible: boolean;
    settings: Record<string, unknown>;
    blocks?: StorefrontThemeBlockConfig[];
}
export interface StorefrontThemeTemplateConfig {
    themeId: string;
    themeSettings: Record<string, unknown>;
    sections: {
        header: StorefrontThemeSectionConfig;
        footer: StorefrontThemeSectionConfig;
        template: StorefrontThemeSectionConfig[];
    };
}
export declare const SECTION_SCHEMAS: Record<string, SectionSchema>;
export declare const THEME_SETTINGS_SCHEMA: ThemeSettingsSchema;
/**
 * Get section schemas for a given theme package.
 *
 * The runtime schema registry is database-backed; this static export is kept as
 * the shared fallback contract for older clients and migrations.
 */
export declare function getSectionSchemas(_themeId: string): Record<string, SectionSchema>;
/**
 * Get global theme settings schema for a given theme package.
 */
export declare function getThemeSettingsSchema(_themeId: string): ThemeSettingsSchema;
/**
 * Detect whether a stored theme config contains real storefront sections.
 * Metadata-only records such as `{ themeId, templateId, survey }` must fall
 * back to the package default template instead of rendering a blank store.
 */
export declare function hasRenderableThemeTemplate(value: unknown): boolean;
/**
 * Default production storefront template used when a store has selected a theme
 * but has not yet published a release-backed template snapshot.
 */
export declare function getDefaultStorefrontThemeTemplate(themeId?: string, themeConfig?: Record<string, unknown>): StorefrontThemeTemplateConfig;
//# sourceMappingURL=theme-registry.d.ts.map