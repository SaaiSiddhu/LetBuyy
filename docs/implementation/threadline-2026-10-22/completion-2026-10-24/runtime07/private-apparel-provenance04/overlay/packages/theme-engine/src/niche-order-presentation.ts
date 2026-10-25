import { LiquidThemePackageBundleSchema, type LiquidThemePackageBundle } from './theme-bundle';

const approved = new Set(['letbuyy-bloom', 'letbuyy-forge', 'letbuyy-refresh', 'letbuyy-craft', 'letbuyy-summit', 'letbuyy-nova', 'letbuyy-aura', 'letbuyy-ride', 'letbuyy-dawn']);
const marker = '<!-- lb:niche-order-presentation:v1 -->';
const details = `${marker}{% if item.niche_facts_text != blank %}<details class="lb-order-facts"><summary>Saved product details</summary><p class="lb-order-facts__text">{{ item.niche_facts_text }}</p></details>{% else %}<p class="lb-order-facts__missing">Product details were not recorded with this order.</p>{% endif %}`;
const css = '.lb-order-facts{min-width:0;max-width:100%;margin-block:.75rem}.lb-order-facts>summary{min-height:44px;cursor:pointer;padding-block:.5rem}.lb-order-facts__text{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}.lb-order-facts__missing{font-size:.875em;overflow-wrap:anywhere}';

const originalOrderHeading = '<h1>Order #{{ order.number }}</h1>';
export const CONFIGURED_ORDER_HEADING_SOURCE = "<h1>{{ section.settings.heading | strip | default: 'Order' }} #{{ order.number }}</h1>";

/** Explicit successor-builder opt-in. Existing default factories never call this. */
export function withConfiguredOrderHeading(base: LiquidThemePackageBundle): LiquidThemePackageBundle {
    if ((!approved.has(base.package.slug) && base.package.slug !== 'letbuyy-sense')
        || !['2.0.0', '2.0.1'].includes(base.package.version)) {
        throw new Error('Configured order headings require a known first-party successor input.');
    }
    const bundle = structuredClone(base);
    const section = bundle.sections['customer-order-detail'];
    const field = section?.schema.settings.find(setting => setting.id === 'heading');
    if (field?.type !== 'text' || field.default !== 'Order') {
        throw new Error('Configured order headings require the canonical text heading contract.');
    }
    const originalCount = section.source.split(originalOrderHeading).length - 1;
    const configuredCount = section.source.split(CONFIGURED_ORDER_HEADING_SOURCE).length - 1;
    if (originalCount === 1 && configuredCount === 0) {
        section.source = section.source.replace(originalOrderHeading, CONFIGURED_ORDER_HEADING_SOURCE);
    } else if (originalCount !== 0 || configuredCount !== 1) {
        throw new Error('Configured order headings require the exact canonical order identity outlet.');
    }
    return LiquidThemePackageBundleSchema.parse(bundle);
}

/** Explicit successor builder opt-in. Sense requires new2.1.1/version6; frozen inputs stay unchanged. */
export function withNicheOrderPresentation(base: LiquidThemePackageBundle): LiquidThemePackageBundle {
    const threadlineSuccessor = base.package.slug === 'letbuyy-sense' && base.package.version === '2.1.1' && base.package.version_number === 6;
    if (!threadlineSuccessor && ((base.package.version !== '2.0.0' && !(base.package.slug === 'letbuyy-bloom' && base.package.version === '2.0.1')) || !approved.has(base.package.slug))) return base;
    if (base.sections['customer-order-detail']?.source.includes(marker)) return base;
    const bundle = structuredClone(base);
    const section = bundle.sections['customer-order-detail'];
    if (!section) throw new Error('Niche order presentation requires the canonical order detail section.');
    const loop = /\{% for item in order\.line_items %\}([\s\S]*?)\{% endfor %\}/;
    const match = loop.exec(section.source);
    if (!match || !match[1].includes('</li>')) throw new Error('Niche order presentation requires the canonical order line loop.');
    section.source = section.source.replace(loop, (_whole, body: string) => `{% for item in order.line_items %}${body.replace(/<\/li>\s*$/, `${details}</li>`)}{% endfor %}`);
    if (!section.source.includes(marker)) throw new Error('Niche order presentation could not bind the canonical line item.');
    const outlet = '{{ content_for_header | raw }}';
    if (!bundle.layout.theme.source.includes(outlet)) throw new Error('Niche order presentation requires the canonical header outlet.');
    bundle.layout.theme.source = bundle.layout.theme.source.replace(outlet, `${outlet}\n<style data-niche-order-presentation="1">${css}</style>`);
    return LiquidThemePackageBundleSchema.parse(bundle);
}
