function normalizeSettingsSchema(value) {
    const record = asRecord(value);
    const groups = asRecord(record.settings);
    if (Object.keys(groups).length > 0) {
        return {
            schema_version: stringValue(record.schema_version, EMPTY_SETTINGS_SCHEMA.schema_version),
            settings: Object.entries(groups).reduce((acc, [groupKey, groupValue]) => {
                const group = asRecord(groupValue);
                acc[groupKey] = {
                    label: stringValue(group.label, labelFromKey(groupKey)),
                    description: stringValue(group.description),
                    fields: normalizeFields(group.fields),
                };
                return acc;
            }, {}),
        };
    }
    const fields = normalizeFields(Array.isArray(value) ? value : record);
    if (Object.keys(fields).length === 0)
        return EMPTY_SETTINGS_SCHEMA;
    return {
        schema_version: stringValue(record.schema_version, EMPTY_SETTINGS_SCHEMA.schema_version),
        settings: {
            general: {
                label: 'Theme settings',
                description: '',
                fields,
            },
        },
    };
}
function normalizeEditorState(templateConfig, themeId, templateKey, sectionSchemas, settingsSchema) {
    const fallback = getDefaultStorefrontThemeTemplate(themeId);
    const fallbackConfig = fallback;
    const candidate = hasRenderableThemeTemplate(templateConfig) ? asRecord(templateConfig) : fallbackConfig;
    const isLiquid = candidate.rendererEngine === 'liquid' || asRecord(asRecord(candidate.liquidBundle).renderer).engine === 'liquid';
    const root = getSectionRoot(candidate, templateKey);
    const fallbackRoot = getSectionRoot(fallbackConfig, templateKey);
    const templateEntries = Array.isArray(root.template) ? root.template : [];
    const templates = asRecord(candidate.templates);
    // Portable themes own their header/footer and setting defaults. Importing
    // another renderer's fallback fields makes the first draft fail validation.
    const normalizeGroup = (key) => {
        // Liquid templates contain the complete group. The legacy root is only
        // a first-section compatibility projection and cannot describe the group.
        const group = isLiquid && Object.hasOwn(templates, key)
            ? portableTemplateSectionsToArray(asRecord(templates[key])) || []
            : [root[key] || (!isLiquid ? fallbackRoot[key] : null)].filter(Boolean);
        return group.flatMap((section, index) => {
            const normalized = normalizeSection(section, key, `${key}-${index + 1}`, index, sectionSchemas);
            return normalized ? [normalized] : [];
        });
    };
    const header = normalizeGroup('header');
    const footer = normalizeGroup('footer');
    const template = templateEntries.flatMap((section, index) => {
        const normalized = normalizeSection(section, `section_${index + 1}`, `section-${index + 1}`, index + 1, sectionSchemas);
        if (normalized && isFirstPartyCoreBundleSlug(asRecord(asRecord(candidate.liquidBundle).package).slug, asRecord(asRecord(candidate.liquidBundle).package).version)
            && ['categoryGrid', 'category-grid'].includes(normalized.type) && isUnchangedCoreDemoCategoryBlocks(normalized.blocks)) {
            return [{ ...normalized, blocks: [] }];
        }
        return normalized ? [normalized] : [];
    });
    const configSettingsData = asRecord(asRecord(asRecord(candidate.config).settings_data).current);
    const rootSettingsData = asRecord(asRecord(candidate.settings_data).current);
    const legacyExperienceId = asRecord(candidate.themeSettings).experienceId;
    return {
        experienceId: typeof candidate.experienceId === 'string' ? candidate.experienceId : typeof legacyExperienceId === 'string' ? legacyExperienceId : undefined,
        themeSettings: {
            ...defaultThemeSettings(settingsSchema),
            ...(isLiquid ? {} : asRecord(fallback.themeSettings)),
            ...configSettingsData,
            ...rootSettingsData,
            ...asRecord(candidate.themeSettings),
        },
        sections: {
            header,
            footer,
            template: template.sort((left, right) => left.order - right.order),
        },
    };
}
function buildDraftConfig(baseConfig, themeId, state, templateKey = 'index') {
    const config = asRecord(baseConfig.config);
    const rootSettingsData = asRecord(baseConfig.settings_data);
    const templates = asRecord(baseConfig.templates);
    const fallbackTemplate = asRecord(templates.index || templates.home || Object.values(templates)[0]);
    const existingTemplate = asRecord(templates[templateKey] || fallbackTemplate);
    const nextTemplate = {
        ...existingTemplate,
        name: stringValue(existingTemplate.name, templateLabel(templateKey, existingTemplate)),
        sections: Object.fromEntries(state.sections.template.map((section) => [section.id, sectionToPortableRecord(section)])),
        order: state.sections.template.map((section) => section.id),
    };
    const groupTemplate = (key) => ({
        ...asRecord(templates[key]),
        sections: Object.fromEntries(state.sections[key].map(section => [section.id, sectionToPortableRecord(section)])),
        order: state.sections[key].map(section => section.id),
    });
    const nextSettingsData = {
        ...rootSettingsData,
        current: Object.fromEntries(Object.entries(state.themeSettings).filter(([key]) => key !== 'experienceId')),
        presets: presetsFromBaseConfig(baseConfig),
    };
    return {
        ...baseConfig,
        themeId: stringValue(baseConfig.themeId, themeId),
        experienceId: state.experienceId,
        themeSettings: Object.fromEntries(Object.entries(state.themeSettings).filter(([key]) => key !== 'experienceId')),
        // Preserve the established API projection; all group entries are owned
        // by templates, which the canonical compiler consumes in full.
        sections: { template: state.sections.template,
            ...(state.sections.header[0] ? { header: state.sections.header[0] } : {}),
            ...(state.sections.footer[0] ? { footer: state.sections.footer[0] } : {}),
        },
        templates: {
            ...templates,
            [templateKey]: nextTemplate,
            header: groupTemplate('header'),
            footer: groupTemplate('footer'),
        },
        settings_data: nextSettingsData,
        config: {
            ...config,
            settings_data: nextSettingsData,
        },
    };
}
function createSectionFromSchema(type, schemas, order) {
    const schema = schemas[type];
    return {
        id: `section-${crypto.randomUUID()}`,
        type,
        order,
        visible: true,
        settings: {
            ...asRecord(schema?.defaults),
        },
        blocks: sampleBlocksForSchema(schema),
    };
}
function createBlockFromSchema(blockType, blockSchema, order) {
    return {
        id: `block-${crypto.randomUUID()}`,
        type: blockType,
        order,
        visible: true,
        settings: blockSchema ? defaultSettingsForFields(blockSchema.fields) : {},
    };
}
function asRecord(value) {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : {};
}
function stringValue(value, fallback = '') {
    return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}
const EMPTY_SETTINGS_SCHEMA = {
    schema_version: '2026-05-json-contract',
    settings: {},
};
function labelFromKey(key) {
    return key
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function normalizeFields(value) {
    if (Array.isArray(value)) {
        return value.reduce((acc, entry, index) => {
            const record = asRecord(entry);
            const id = stringValue(record.id, `field_${index + 1}`);
            acc[id] = normalizeField(id, record);
            return acc;
        }, {});
    }
    return Object.entries(asRecord(value)).reduce((acc, [key, field]) => {
        acc[key] = normalizeField(key, field);
        return acc;
    }, {});
}
function getSectionRoot(templateConfig, templateKey = 'index') {
    const rootSections = templateConfig.sections;
    const legacyRoot = Array.isArray(rootSections)
        ? { template: rootSections }
        : Object.keys(asRecord(rootSections)).length > 0
            ? asRecord(rootSections)
            : {};
    const templates = asRecord(templateConfig.templates);
    const selectedTemplate = asRecord(templates[templateKey] || templates.index || templates.home || Object.values(templates)[0]);
    const selectedSections = portableTemplateSectionsToArray(selectedTemplate);
    if (selectedSections) {
        return {
            ...legacyRoot,
            template: selectedSections,
        };
    }
    if (Object.keys(legacyRoot).length > 0)
        return legacyRoot;
    const configSections = asRecord(asRecord(templateConfig.config).sections);
    if (Object.keys(configSections).length > 0)
        return configSections;
    const homeTemplate = asRecord(templates.home || templates.index || Object.values(templates)[0]);
    const homeSections = homeTemplate.sections;
    if (Array.isArray(homeSections))
        return { template: homeSections };
    const homeTemplateSections = portableTemplateSectionsToArray(homeTemplate);
    if (homeTemplateSections)
        return { template: homeTemplateSections };
    return asRecord(homeSections);
}
function portableTemplateSectionsToArray(template) {
    if (Array.isArray(template.sections))
        return template.sections;
    if (!template.sections || typeof template.sections !== 'object')
        return null;
    const sections = asRecord(template.sections);
    const order = Array.isArray(template.order)
        ? template.order.filter((sectionId) => typeof sectionId === 'string')
        : Object.keys(sections);
    return order
        .filter((sectionId) => Object.prototype.hasOwnProperty.call(sections, sectionId))
        .map((sectionId, index) => {
        const section = asRecord(sections[sectionId]);
        return {
            id: sectionId,
            order: index * 10,
            ...section,
            blocks: portableBlocksToArray(section),
        };
    });
}
function normalizeSection(value, fallbackType, fallbackId, index, schemas) {
    const record = asRecord(value);
    const type = stringValue(record.type, fallbackType);
    if (!type)
        return null;
    const schema = schemas[type];
    const blocks = Array.isArray(record.blocks)
        ? record.blocks.flatMap((block, blockIndex) => {
            const normalized = normalizeBlock(block, blockIndex, schema?.blocks_schema);
            return normalized ? [normalized] : [];
        })
        : sampleBlocksForSchema(schema);
    return {
        id: stringValue(record.id, fallbackId),
        type,
        order: numberValue(record.order, index * 10),
        visible: record.disabled !== true && record.visible !== false && record.isVisible !== false,
        settings: {
            ...sectionDefaults(type, schemas),
            ...asRecord(record.settings),
        },
        blocks,
    };
}
function defaultThemeSettings(schema) {
    return Object.values(schema.settings).reduce((acc, group) => {
        return { ...acc, ...defaultSettingsForFields(group.fields) };
    }, {});
}
function templateLabel(key, template) {
    const name = stringValue(template?.name);
    if (name)
        return name;
    return DEFAULT_TEMPLATE_OPTIONS.find((option) => option.key === key)?.label || labelFromKey(key);
}
function sectionToPortableRecord(section) {
    const blockEntries = section.blocks.map((block) => [block.id, blockToPortableRecord(block)]);
    return {
        type: section.type,
        visible: section.visible,
        settings: section.settings,
        blocks: Object.fromEntries(blockEntries),
        block_order: section.blocks.map((block) => block.id),
    };
}
function presetsFromBaseConfig(baseConfig) {
    const configSettingsData = asRecord(asRecord(baseConfig.config).settings_data);
    const rootSettingsData = asRecord(baseConfig.settings_data);
    const bundleSettingsData = asRecord(asRecord(asRecord(baseConfig.liquidBundle).config).settings_data);
    return {
        ...asRecord(bundleSettingsData.presets),
        ...asRecord(configSettingsData.presets),
        ...asRecord(rootSettingsData.presets),
    };
}
function sampleBlocksForSchema(schema) {
    const samples = Array.isArray(schema?.sample_blocks) ? schema.sample_blocks : [];
    return samples.map((block, index) => {
        const record = asRecord(block);
        return {
            id: stringValue(record.id, `${stringValue(record.type, 'block')}-${index + 1}`),
            type: stringValue(record.type, `block_${index + 1}`),
            order: index,
            visible: record.visible === false || record.isVisible === false ? false : true,
            settings: asRecord(record.settings),
        };
    });
}
function defaultSettingsForFields(fields) {
    return Object.entries(fields).reduce((acc, [key, field]) => {
        acc[key] = defaultValueForField(field);
        return acc;
    }, {});
}
function normalizeField(key, value) {
    return normalizeEditorSchemaField(value, labelFromKey(key));
}
function portableBlocksToArray(section) {
    const blocks = section.blocks;
    if (Array.isArray(blocks))
        return blocks;
    const blockRecords = asRecord(blocks);
    const blockOrder = Array.isArray(section.block_order)
        ? section.block_order.filter((blockId) => typeof blockId === 'string')
        : Object.keys(blockRecords);
    return blockOrder
        .filter((blockId) => Object.prototype.hasOwnProperty.call(blockRecords, blockId))
        .map((blockId, index) => ({
        id: blockId,
        order: index * 10,
        ...asRecord(blockRecords[blockId]),
    }));
}
function normalizeBlock(value, index, blockSchemas, depth = 1) {
    const record = asRecord(value);
    const type = stringValue(record.type);
    if (!type)
        return null;
    if (depth > MAX_BUNDLE_BLOCK_NESTING_DEPTH)
        throw new Error('This block tree exceeds the supported nesting limit. Your saved document has been kept.');
    const defaults = blockSchemas?.[type]?.fields ? defaultSettingsForFields(blockSchemas[type].fields) : {};
    const children = Array.isArray(record.children) ? record.children : portableBlocksToArray(record);
    return {
        id: stringValue(record.id, `${type}-${index + 1}`),
        type,
        order: numberValue(record.order, index),
        visible: record.disabled !== true && record.visible !== false && record.isVisible !== false,
        settings: {
            ...defaults,
            ...asRecord(record.settings),
        },
        children: children.flatMap((child, childIndex) => {
            const normalized = normalizeBlock(child, childIndex, blockSchemas, depth + 1);
            return normalized ? [normalized] : [];
        }),
    };
}
function numberValue(value, fallback = 0) {
    if (typeof value === 'number' && Number.isFinite(value))
        return value;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}
function sectionDefaults(type, schemas) {
    return asRecord(schemas[type]?.defaults);
}
const DEFAULT_TEMPLATE_OPTIONS = [
    { key: 'index', label: 'Home page', type: 'home' },
    { key: 'product', label: 'Product page', type: 'product' },
    { key: 'collection', label: 'Collection page', type: 'collection' },
    { key: 'page', label: 'Content page', type: 'page' },
    { key: 'cart', label: 'Cart page', type: 'cart' },
    { key: 'blog', label: 'Blog listing', type: 'blog' },
    { key: 'article', label: 'Blog post', type: 'article' },
];
function blockToPortableRecord(block) {
    const children = block.children || [];
    return {
        type: block.type,
        visible: block.visible,
        settings: block.settings,
        blocks: Object.fromEntries(children.map(child => [child.id, blockToPortableRecord(child)])),
        block_order: children.map(child => child.id),
    };
}
function defaultValueForField(field) {
    if (field.type === 'color' && field.default === undefined)
        return letbuyyPrimitiveTokens.color.black;
    return resolveFieldDefault(field);
}
