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
            href: '/pricing',
            description: 'Plans for stores, creators, and growing merchant teams.',
        },
        {
            label: 'Themes',
            href: '/resources/platform/how-themes-work',
            sitemapHref: getThemeMarketplaceUrl('/sitemap.xml'),
            description: 'Read how LetBuyy storefront themes work.',
        },
        {
            label: 'Apps',
            href: '/resources/platform/introduction-to-apps',
            sitemapHref: getAppMarketplaceUrl('/sitemap.xml'),
            description: 'Learn about planned app integrations and platform capabilities.',
        },
        {
            label: 'Developers',
            href: '/resources/developers',
            sitemapHref: getDeveloperPortalUrl('/sitemap.xml'),
            description: 'Public guides for APIs, webhooks and integrations.',
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
