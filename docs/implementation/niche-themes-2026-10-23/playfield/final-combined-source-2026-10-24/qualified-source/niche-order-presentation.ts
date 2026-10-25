import { LiquidThemePackageBundleSchema, type LiquidThemePackageBundle } from './theme-bundle';

const approved = new Set(['letbuyy-bloom', 'letbuyy-forge', 'letbuyy-refresh', 'letbuyy-craft', 'letbuyy-summit', 'letbuyy-nova', 'letbuyy-aura', 'letbuyy-ride', 'letbuyy-dawn']);
const marker = '<!-- lb:niche-order-presentation:v1 -->';
const details = `${marker}{% if item.niche_facts_text != blank %}<details class="lb-order-facts"><summary>Saved product details</summary><p class="lb-order-facts__text">{{ item.niche_facts_text }}</p></details>{% else %}<p class="lb-order-facts__missing">Product details were not recorded with this order.</p>{% endif %}`;
const css = '.lb-order-facts{min-width:0;max-width:100%;margin-block:.75rem}.lb-order-facts>summary{min-height:44px;cursor:pointer;padding-block:.5rem}.lb-order-facts__text{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}.lb-order-facts__missing{font-size:.875em;overflow-wrap:anywhere}';

/** Explicit first-party v2 builder opt-in; no Core/Threadline or persisted release mutation. */
export function withNicheOrderPresentation(base: LiquidThemePackageBundle): LiquidThemePackageBundle {
    if ((base.package.version !== '2.0.0' && !(base.package.slug === 'letbuyy-bloom' && base.package.version === '2.0.1')) || !approved.has(base.package.slug)) return base;
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
