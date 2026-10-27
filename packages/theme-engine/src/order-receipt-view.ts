import type { LiquidThemePackageBundle } from './theme-bundle';
import { createFirstPartyCatalogBundle, firstPartyThemeListings } from './first-party-theme-catalog';
import { CONFIGURED_ORDER_HEADING_SOURCE } from './niche-order-presentation';

const known = new Set(firstPartyThemeListings({ designVersion: '2.0.0' }).map(theme => theme.slug));
const sources = new Map<string, { list: string; detail: string }>();
const originalHeading = '<h1>Order #{{ order.number }}</h1>';
const totalOutlet = '<p class="lb-order-detail__total">Total: {{ order.total | money_with_currency: order.currency }}</p>';
const listOutlet = '<span class="lb-orders__total">{{ order.total | money_with_currency: order.currency }}</span>';
const receipt = '<!-- lb:saved-order-receipt:v1 --><dl class="lb-order-detail__amounts">'
    + '{% if order.subtotal != nil %}<div><dt>Subtotal</dt><dd>{{ order.subtotal | money_with_currency: order.currency }}</dd></div>{% endif %}'
    + '{% if order.coupon_code != blank or order.discount_total > 0 %}<div><dt>{% if order.coupon_code != blank %}Coupon ({{ order.coupon_code }}){% else %}Discount{% endif %}</dt><dd>−{{ order.discount_total | money_with_currency: order.currency }}</dd></div>{% endif %}'
    + '{% if order.shipping_total != nil %}<div><dt>Shipping</dt><dd>{{ order.shipping_total | money_with_currency: order.currency }}</dd></div>{% endif %}'
    + '{% if order.tax_total != nil %}<div><dt>Tax</dt><dd>{{ order.tax_total | money_with_currency: order.currency }}</dd></div>{% endif %}'
    + '<div class="lb-order-detail__total"><dt>Final total</dt><dd>{{ order.total | money_with_currency: order.currency }}</dd></div></dl>';

/** Rendering projection for exact shipped first-party account definitions only.
 * Persisted releases, package identity/checksum, settings and custom source remain untouched.
 * This stays in the single Liquid renderer; no React receipt or secondary pricing system. */
export function withSavedOrderReceiptView(base: LiquidThemePackageBundle): LiquidThemePackageBundle {
    if (!known.has(base.package.slug) || !['2.0.0', '2.0.1', '2.0.2', '2.1.0'].includes(base.package.version)) return base;
    let reference = sources.get(base.package.slug);
    if (!reference) {
        const canonical = createFirstPartyCatalogBundle(base.package.slug, { designVersion: '2.0.0' });
        reference = { list: canonical.sections['customer-orders'].source, detail: canonical.sections['customer-order-detail'].source };
        sources.set(base.package.slug, reference);
    }
    const detail = base.sections['customer-order-detail'];
    const list = base.sections['customer-orders'];
    const detailMatches = !!detail && [reference.detail, reference.detail.replace(originalHeading, CONFIGURED_ORDER_HEADING_SOURCE)].includes(detail.source)
        && detail.source.split(totalOutlet).length === 2;
    const listMatches = !!list && list.source === reference.list && list.source.split(listOutlet).length === 2;
    if (!detailMatches && !listMatches) return base;
    const view = structuredClone(base);
    if (detailMatches) view.sections['customer-order-detail'].source = detail.source.replace(totalOutlet, receipt);
    if (listMatches) view.sections['customer-orders'].source = list.source.replace(listOutlet, listOutlet
        + '{% if order.coupon_code != blank %}<span class="lb-orders__coupon">Coupon {{ order.coupon_code }} · Saved {{ order.discount_total | money_with_currency: order.currency }}</span>{% endif %}');
    return view;
}
