import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { StoreHealthSchema, type StoreHealth } from '@letbuyy/shared-types';
import { AppError, NotFoundError } from '../lib/errors';
import { healthPillar } from '../lib/store-health';
import { paymentConfigProviderMode, type PaymentSettings } from '../lib/store-payment-config';

type Check = StoreHealth['readiness']['checks'][number];
type Status = Check['status'];
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0;
const DAY = 24 * 60 * 60 * 1000;

/** One bounded, read-only health composition shared by merchant and operator routes.
 * It reports setup evidence, never grants permission to publish or accept payment.
 * Domain verification stays in the existing merchant-owned domain workflow.
 */
export class StoreHealthAdapter {
    constructor(private readonly db: SupabaseClient, private readonly paymentEncryptionConfigured: boolean) {}

    async read(siteId: string): Promise<StoreHealth> {
        const site = await this.db.from('sites').select('id,name,store_name,site_type,status,published,subdomain,custom_domain,custom_domain_status,current_theme_release_id,business_profile,invoice_address,cod_enabled,online_payment_enabled,payment_settings')
            .eq('id', siteId).is('deleted_at', null).maybeSingle();
        if (site.error) throw new AppError('Store health is temporarily unavailable.', 503, 'STORE_HEALTH_UNAVAILABLE');
        if (!site.data) throw new NotFoundError('Store not found.');
        const s = site.data, now = new Date(), observed = now.toISOString();
        const [catalog, shipping, releases, domains, verification, orders, reviews] = await Promise.allSettled([
            this.db.from('products').select('id', { head: true, count: 'exact' }).eq('store_id', siteId).eq('status', 'active').eq('is_active', true).is('deleted_at', null),
            this.db.from('shipping_rates').select('id,shipping_zones!inner(store_id,deleted_at)', { head: true, count: 'exact' }).eq('site_id', siteId).eq('shipping_zones.store_id', siteId).is('shipping_zones.deleted_at', null).eq('is_active', true).is('deleted_at', null),
            this.db.from('theme_releases').select('id,release_version').eq('store_id', siteId).eq('is_current', true).eq('release_status', 'published').is('deleted_at', null).order('release_version', { ascending: false }).limit(1),
            this.db.from('site_domains').select('status,ssl_status,last_checked_at').eq('site_id', siteId).eq('domain', s.custom_domain || '').is('deleted_at', null).limit(1),
            this.db.from('site_domain_verifications').select('txt_verified,cname_verified,ssl_active,created_at').eq('site_id', siteId).eq('domain', s.custom_domain || '').in('check_type', ['health', 'verify']).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(1),
            this.db.from('orders').select('id', { head: true, count: 'exact' }).eq('store_id', siteId).in('status', ['pending', 'pending_cod', 'confirmed', 'processing']).is('deleted_at', null),
            this.db.from('product_reviews').select('id', { head: true, count: 'exact' }).eq('store_id', siteId).eq('status', 'pending').is('deleted_at', null),
        ]);
        const checks: Check[] = [];
        const add = (id: string, label: string, status: Status, summary: string, web_path: string, route: string, checked_at: string | null = observed, required = true) => {
            checks.push({ id, label, status, summary, web_path, route, checked_at, required, action_label: status === 'ready' ? 'Review settings' : 'Review and resolve' });
        };
        const profile = object(s.business_profile), address = object(s.invoice_address);
        const businessReady = text(s.store_name || s.name) && (text(profile.email) || text(profile.phone)) && ['line1', 'city', 'state', 'zip', 'country'].every(k => text(address[k]));
        add('business', 'Business details', businessReady ? 'ready' : 'attention', businessReady ? 'Business contact and address are recorded. GST registration is not required by this checklist.' : 'Add a business contact and complete the business address in General settings.', 'settings/general', '/store-details');
        const catalogAvailable = catalog.status === 'fulfilled' && !catalog.value.error && catalog.value.count !== null;
        add('catalog', 'Active catalog', !catalogAvailable ? 'unknown' : catalog.value.count! > 0 ? 'ready' : 'attention', !catalogAvailable ? 'Catalog evidence is unavailable. Retry the check.' : `${catalog.value.count} active product(s). Draft and archived products do not count. Stock and delivery are checked at checkout.`, 'products', '/products');
        const shippingAvailable = shipping.status === 'fulfilled' && !shipping.value.error && shipping.value.count !== null;
        add('shipping', 'Delivery settings', !shippingAvailable ? 'unknown' : shipping.value.count! > 0 ? 'ready' : 'attention', !shippingAvailable ? 'Delivery configuration is unavailable. Retry the check.' : shipping.value.count! > 0 ? 'An active delivery rate is linked to this store. Availability still depends on the buyer address and cart.' : 'Add a delivery zone and an active delivery rate.', 'settings/shipping', '/shipping');
        const settings = object(s.payment_settings) as PaymentSettings;
        const mode = paymentConfigProviderMode({ onlinePaymentEnabled: s.online_payment_enabled, settings });
        const onlineReady = s.online_payment_enabled === true && settings.mode === 'ownAccount' && settings.razorpay?.verified === true && Boolean(settings.razorpay.key_id && settings.razorpay.key_secret_ciphertext) && mode === 'live' && this.paymentEncryptionConfigured;
        const cod = s.cod_enabled === true;
        add('payments', 'Payment acceptance', cod || onlineReady ? 'ready' : 'attention', cod ? `Cash on delivery is enabled. Online payments: ${onlineReady ? 'live credentials configured' : mode === 'sandbox' ? 'sandbox or not configured' : 'need verification'}. Provider delivery is not certified by this check.` : onlineReady ? 'Seller-owned live payment credentials are configured. Provider delivery is not certified by this check.' : 'Enable cash on delivery or connect verified seller-owned live payment credentials. Sandbox/shared settings do not prove live acceptance.', 'settings/payments', '/connect-razorpay');
        const themeAvailable = releases.status === 'fulfilled' && !releases.value.error;
        const release = themeAvailable ? releases.value.data?.[0] : null;
        const themeReady = Boolean(release && release.id === s.current_theme_release_id);
        add('theme', 'Published theme release', !themeAvailable ? 'unknown' : themeReady ? 'ready' : 'attention', !themeAvailable ? 'Published release evidence is unavailable.' : !release ? 'No current published theme release. Open Themes and publish a release.' : !themeReady ? 'The site pointer and current published release disagree. Review Themes before publication.' : `Current published release version ${release.release_version} matches the site pointer.`, 'online-store/themes', '/live-preview');
        const suspended = s.status === 'suspended';
        add('publication', 'Store publication', suspended ? 'blocked' : s.status === 'published' && s.published === true ? 'ready' : 'attention', suspended ? 'The store is suspended. Contact support for review; publication cannot remove a restriction.' : s.status === 'published' && s.published === true ? 'The current publication flags are enabled. This is not an external uptime probe.' : 'The store is not currently published. A historical publication date does not count.', 'online-store/themes', '/main');
        if (!s.custom_domain) {
            add('domain', 'Storefront domain', text(s.subdomain) ? 'ready' : 'attention', text(s.subdomain) ? 'A default LetBuyy subdomain is assigned. A custom domain is optional. This check does not probe public uptime.' : 'A default storefront subdomain is missing. Contact support.', 'settings/domains', '/domain-settings');
        } else {
            const available = domains.status === 'fulfilled' && !domains.value.error && verification.status === 'fulfilled' && !verification.value.error;
            const d = domains.status === 'fulfilled' ? domains.value.data?.[0] : null;
            const v = verification.status === 'fulfilled' ? verification.value.data?.[0] : null;
            const checked = v?.created_at ? Date.parse(v.created_at) : NaN;
            const fresh = Number.isFinite(checked) && checked <= now.getTime() && now.getTime() - checked <= DAY;
            const ready = available && fresh && s.custom_domain_status === 'active' && d?.status === 'active' && d.ssl_status === 'active' && v?.txt_verified === true && v.cname_verified === true && v.ssl_active === true;
            add('domain', 'Custom domain and certificate', !available || !fresh ? 'unknown' : ready ? 'ready' : 'attention', !available ? 'Recorded domain evidence is unavailable.' : !fresh ? 'Domain verification is missing or older than 24 hours. Open Domains and run the existing verification check.' : ready ? 'The last recorded check confirms DNS and certificate readiness. Open Domains to verify again.' : 'DNS, ownership or the certificate needs attention. Open Domains for the exact records and verification action.', 'settings/domains', '/domain-settings', Number.isFinite(checked) ? new Date(checked).toISOString() : null, !text(s.subdomain));
        }
        if (s.custom_domain && text(s.subdomain)) checks[checks.length - 1].summary += ' The default LetBuyy subdomain remains assigned; a custom domain is optional.';
        const unknown = checks.filter(c => c.status === 'unknown').length;
        const complete = checks.filter(c => c.status === 'ready').length;
        const status: Status = checks.some(c => c.status === 'blocked' && c.required) ? 'blocked' : unknown ? 'unknown' : complete === checks.length ? 'ready' : 'attention';
        const pillars = checks.map(c => healthPillar({ id: c.id, label: c.label, score: c.status === 'ready' ? 100 : 0, status: c.status, summary: c.summary, action_label: c.action_label, route: c.route, metrics: { checked_at: c.checked_at, required: c.required } }));
        for (const [id, label, result, route] of [['orders', 'Open orders', orders, '/orders'], ['reviews', 'Review moderation', reviews, '/reviews']] as const) {
            const count = result.status === 'fulfilled' && !result.value.error ? result.value.count : null;
            pillars.push(healthPillar({ id, label, score: count === null ? 0 : count > 0 ? 60 : 100, status: count === null ? 'unknown' : count > 0 ? 'attention' : 'ready', summary: count === null ? `${label} evidence is unavailable.` : `${count} record(s) awaiting action.`, action_label: `Open ${id}`, route }));
        }
        return StoreHealthSchema.parse({ store_id: siteId, generated_at: observed, score: Math.round(complete * 100 / checks.length), readiness: { status, complete, total: checks.length, unknown, checks }, pillars, metadata: { source: 'api-gateway.stores.health', observation: 'persisted configuration; not a live uptime or provider certification', domain_freshness_hours: 24, site_type: s.site_type } });
    }
}
