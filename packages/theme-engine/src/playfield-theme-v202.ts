import { LiquidThemePackageBundleSchema, type LiquidThemePackageBundle, type ThemeLiquidSectionFile } from './theme-bundle';
import { createLetbuyyCoreLiquidThemeBundleFixture, isLetbuyyCoreThemeSlug } from './theme-bundle-core';
import { createPlayfieldTheme } from './playfield-theme';
import { createPlayfieldThemeV201 } from './playfield-theme-v201';
import { CONFIGURED_ORDER_HEADING_SOURCE, withConfiguredOrderHeading, withNicheOrderPresentation } from './niche-order-presentation';

const title = '<h2>{{ section.settings.title }}</h2>';
const description = '{% if section.settings.subtitle != blank %}<p>{{ section.settings.subtitle }}</p>{% endif %}';
const savedFacts = '<!-- lb:niche-order-presentation:v1 -->';
const savedFactsStyle = 'data-niche-order-presentation="1"';
const schemaBlock = /\{% schema %\}[\s\S]*?\{% endschema %\}/g;

function body(file: ThemeLiquidSectionFile | undefined): string {
    if (!file || file.source.match(schemaBlock)?.length !== 1) throw new Error('Playfield 2.0.2 requires one canonical section schema outlet.');
    return file.source.replace(schemaBlock, '');
}

function assertField(file: ThemeLiquidSectionFile | undefined, id: string, type: string, fallback: unknown): void {
    const fields = file?.schema.settings.filter(field => field.id === id);
    if (!fields || fields.length !== 1 || fields[0].type !== type || fields[0].default !== fallback) {
        throw new Error(`Playfield 2.0.2 requires the canonical ${id} descriptor.`);
    }
}

function assertFacts(bundle: LiquidThemePackageBundle, reference: LiquidThemePackageBundle): void {
    const product = bundle.sections['product-detail'];
    if (product?.path !== reference.sections['product-detail'].path || body(product) !== body(reference.sections['product-detail'])) {
        throw new Error('Playfield 2.0.2 requires the exact 2.0.1 product facts contract.');
    }
    assertField(product, 'showToyFacts', 'toggle', true);
}

function assertSuccessor(bundle: LiquidThemePackageBundle, reference: LiquidThemePackageBundle): void {
    const related = bundle.sections['featured-products'], order = bundle.sections['customer-order-detail'];
    assertFacts(bundle, reference);
    if (bundle.package.version_number !== 4 || related?.path !== reference.sections['featured-products'].path
        || body(related) !== body(reference.sections['featured-products']).replace(title, title + description)
        || order?.path !== reference.sections['customer-order-detail'].path
        || order.source.split(CONFIGURED_ORDER_HEADING_SOURCE).length !== 2
        || order.source.includes('<h1>Order #{{ order.number }}</h1>')
        || order.source.split(savedFacts).length !== 2 || bundle.layout.theme.source.split(savedFactsStyle).length !== 2) {
        throw new Error('Playfield 2.0.2 requires its subtitle, order identity and saved-facts contract.');
    }
    assertField(related, 'subtitle', 'text', '');
    assertField(order, 'heading', 'text', 'Order');
}

/** Explicit successor only. Saved merchant data never passes through the defaults factory again. */
export function createPlayfieldThemeV202(input: LiquidThemePackageBundle): LiquidThemePackageBundle {
    const base = LiquidThemePackageBundleSchema.parse(structuredClone(input));
    const core = createLetbuyyCoreLiquidThemeBundleFixture();
    const reference = createPlayfieldThemeV201(core);
    if (base.package.slug === 'letbuyy-bloom' && base.package.version === '2.0.2') {
        assertSuccessor(base, reference);
        return base;
    }

    const merchant = base.package.slug === 'letbuyy-bloom' && ['2.0.0', '2.0.1'].includes(base.package.version);
    let source: LiquidThemePackageBundle;
    if (merchant) {
        const expectedNumber = base.package.version === '2.0.0' ? 2 : 3;
        if (base.package.version_number !== expectedNumber) throw new Error('Playfield 2.0.2 requires consistent prior package version metadata.');
        source = base;
        if (base.package.version === '2.0.0') {
            const oldProduct = createPlayfieldTheme(core).sections['product-detail'];
            const product = source.sections['product-detail'];
            if (product?.path !== oldProduct.path || body(product) !== body(oldProduct)) {
                throw new Error('Playfield 2.0.2 cannot replace an unknown 2.0.0 product source.');
            }
            const facts = reference.sections['product-detail'];
            product.source = JSON.stringify(product.schema) === JSON.stringify(facts.schema) ? facts.source
                : facts.source.replace(schemaBlock, `{% schema %}\n${JSON.stringify(product.schema)}\n{% endschema %}`);
        }
    } else {
        if ((!isLetbuyyCoreThemeSlug(base.package.slug) && base.package.slug !== 'letbuyy-bloom')
            || base.package.version !== core.package.version || base.package.version_number !== core.package.version_number) {
            throw new Error('Playfield 2.0.2 requires a canonical Core seed or supported Playfield document.');
        }
        source = createPlayfieldThemeV201(base);
        // Fresh Core starter copy in formerly inert controls is not an explicit merchant edit.
        for (const template of Object.values(source.templates)) for (const section of Object.values(template.sections)) {
            if (section.type === 'featured-products') delete section.settings.subtitle;
            if (section.type === 'customer-order-detail') delete section.settings.heading;
        }
    }

    assertFacts(source, reference);
    const related = source.sections['featured-products'];
    assertField(related, 'subtitle', 'text', '');
    if (related.path !== reference.sections['featured-products'].path || body(related) !== body(reference.sections['featured-products'])
        || related.source.split(title).length !== 2) {
        throw new Error('Playfield 2.0.2 requires the unchanged related-products source contract.');
    }
    related.source = related.source.replace(title, title + description);

    // These canonical helpers must run at their supported prior version, before advancing metadata.
    const successor = withConfiguredOrderHeading(withNicheOrderPresentation(source));
    successor.package = { ...successor.package, version: '2.0.2', version_number: 4 };
    delete successor.package.checksum;
    assertSuccessor(successor, reference);
    return LiquidThemePackageBundleSchema.parse(successor);
}
