export type {
    BlockSchema,
    SchemaField,
    SectionSchema,
    ThemeSettingsGroup,
    ThemeSettingsSchema,
    // Phase U: extended field type model for Shopify-parity controls
    ExtendedSchemaField,
    ExtendedFieldType,
    AllFieldType,
} from '@letbuyy/theme-engine'

export {
    // Phase U helpers (used by SchemaFormRenderer and control components)
    isUnsafeUrl,
    validateFieldValue,
    isFieldVisible,
    resolveFieldDefault,
} from '@letbuyy/theme-engine'
