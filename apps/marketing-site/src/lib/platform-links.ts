import {
    getAccountsUrl,
    getAppMarketplaceUrl,
    getDeveloperPortalUrl,
    getMarketingSiteUrl,
    getThemeMarketplaceUrl,
} from './public-urls'

export type PlatformNavigationLink = {
    description: string
    href: string
    label: string
    sitemapHref?: string
}

export function getPlatformNavigationLinks(): PlatformNavigationLink[] {
    return [
        {
            label: 'LetBuyy',
            href: getMarketingSiteUrl('/'),
            sitemapHref: getMarketingSiteUrl('/sitemap.xml'),
            description: 'Commerce platform overview, pricing, and launch paths.',
        },
        {
            label: 'Pricing',
            href: getMarketingSiteUrl('/pricing'),
            description: 'Plans for stores, creators, and growing merchant teams.',
        },
        {
            label: 'Themes',
            href: getThemeMarketplaceUrl('/themes'),
            sitemapHref: getThemeMarketplaceUrl('/sitemap.xml'),
            description: 'Theme marketplace for stores, portfolios, resumes, blogs, and landing pages.',
        },
        {
            label: 'Apps',
            href: getAppMarketplaceUrl('/'),
            sitemapHref: getAppMarketplaceUrl('/sitemap.xml'),
            description: 'App marketplace for payments, shipping, marketing, analytics, and extensions.',
        },
        {
            label: 'Developers',
            href: getDeveloperPortalUrl('/docs'),
            sitemapHref: getDeveloperPortalUrl('/sitemap.xml'),
            description: 'API docs, SDKs, OAuth, webhooks, and app extension guidance.',
        },
        {
            label: 'Log in',
            href: getAccountsUrl('/lookup'),
            description: 'Merchant account lookup and sign-in.',
        },
    ]
}

export function getPlatformSitemapUrls(): string[] {
    return getPlatformNavigationLinks()
        .map((link) => link.sitemapHref)
        .filter((href): href is string => Boolean(href))
}
