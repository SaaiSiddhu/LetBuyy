// Detect the merchant's DNS host (registrar / managed-DNS provider) from real NS records.
// This mirrors Shopify's "Managed by <provider>" — it is the host where the MERCHANT
// manages DNS, NOT LetBuyy's edge (which is Vercel). Pure mapping over real NS data.

interface ProviderRule {
    provider: string;
    match: RegExp;
}

const NS_PROVIDER_RULES: ProviderRule[] = [
    { provider: 'Cloudflare', match: /(^|\.)cloudflare\.com$|ns\.cloudflare/i },
    { provider: 'GoDaddy', match: /domaincontrol\.com$|godaddy/i },
    { provider: 'Namecheap', match: /registrar-servers\.com$|namecheap/i },
    { provider: 'Hostinger', match: /hostinger|dns-parking\.com$/i },
    { provider: 'BigRock', match: /bigrock|fastname\.com$/i },
    { provider: 'Squarespace', match: /squarespace(dns)?\.com$|squarespace/i },
    { provider: 'Google Cloud DNS', match: /googledomains\.com$|google\.com$|ns-cloud/i },
    { provider: 'AWS Route 53', match: /awsdns/i },
    { provider: 'Vercel', match: /vercel-dns\.com$/i },
    { provider: 'DigitalOcean', match: /digitalocean\.com$/i },
    { provider: 'Hostgator', match: /hostgator|websitewelcome\.com$/i },
    { provider: 'Hover', match: /hover\.com$/i },
    { provider: 'Name.com', match: /name\.com$/i },
    { provider: 'Gandi', match: /gandi\.net$/i },
    { provider: 'Netlify', match: /nsone\.net$|netlify/i },
];

/** Returns a friendly provider name detected from NS records, or null when unknown. */
export function detectDnsProvider(nsRecords: string[]): string | null {
    for (const ns of nsRecords) {
        const host = (ns || '').trim().toLowerCase();
        if (!host) continue;
        for (const rule of NS_PROVIDER_RULES) {
            if (rule.match.test(host)) return rule.provider;
        }
    }
    return nsRecords.length > 0 ? 'Other' : null;
}
