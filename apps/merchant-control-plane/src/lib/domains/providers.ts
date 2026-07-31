// Domain Center — DNS-provider deep links.
// LetBuyy can't write to a merchant's registrar (no API access, unlike Shopify's
// Cloudflare integration), so the "fast path" is a deep link straight to the
// provider's DNS-management screen for this domain. Best-effort: URLs land on the
// right area; some providers require the merchant to already be signed in.

interface ProviderLink {
    /** Display label for the provider. */
    label: string
    /** Deep link to the DNS-management screen (domain interpolated where supported). */
    url: (domain: string) => string
}

const PROVIDER_LINKS: Record<string, ProviderLink> = {
    Cloudflare: { label: 'Cloudflare', url: (d) => `https://dash.cloudflare.com/?to=/:account/${encodeURIComponent(d)}/dns` },
    GoDaddy: { label: 'GoDaddy', url: (d) => `https://dcc.godaddy.com/control/${encodeURIComponent(d)}/dns` },
    Namecheap: { label: 'Namecheap', url: (d) => `https://ap.www.namecheap.com/domains/domaincontrolpanel/${encodeURIComponent(d)}/advancedns` },
    Hostinger: { label: 'Hostinger', url: () => 'https://hpanel.hostinger.com/domains' },
    BigRock: { label: 'BigRock', url: () => 'https://manage.bigrock.in/' },
    Squarespace: { label: 'Squarespace', url: () => 'https://account.squarespace.com/domains' },
    'Google Cloud DNS': { label: 'Google', url: (d) => `https://domains.google.com/registrar/${encodeURIComponent(d)}/dns` },
    'AWS Route 53': { label: 'AWS Route 53', url: () => 'https://console.aws.amazon.com/route53/v2/hostedzones' },
    DigitalOcean: { label: 'DigitalOcean', url: (d) => `https://cloud.digitalocean.com/networking/domains/${encodeURIComponent(d)}` },
    Hostgator: { label: 'HostGator', url: () => 'https://portal.hostgator.com/' },
    Hover: { label: 'Hover', url: () => 'https://www.hover.com/control_panel/domains' },
    'Name.com': { label: 'Name.com', url: (d) => `https://www.name.com/account/domain/details/${encodeURIComponent(d)}#dns` },
    Gandi: { label: 'Gandi', url: (d) => `https://admin.gandi.net/domain/${encodeURIComponent(d)}/records` },
    Netlify: { label: 'Netlify', url: () => 'https://app.netlify.com/teams/domains' },
}

/** Deep link to the provider's DNS-management screen, or null if unknown. */
export function providerDnsUrl(provider: string | null | undefined, domain: string): string | null {
    if (!provider) return null
    const link = PROVIDER_LINKS[provider]
    return link ? link.url(domain) : null
}

/** True when we recognise the provider well enough to offer a deep link. */
export function hasProviderLink(provider: string | null | undefined): boolean {
    return Boolean(provider && PROVIDER_LINKS[provider])
}
