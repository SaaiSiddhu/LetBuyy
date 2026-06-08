export const DEFAULT_MARKETPLACE_LOCALE = 'en-IN';

export const marketplaceMessages = {
    'marketplace.search.placeholder': 'Search apps, integrations, categories...',
    'marketplace.empty.search': 'Try reviews, shipping, analytics, or browse categories.',
    'marketplace.error.retry': 'Try again',
    'marketplace.breadcrumb.home': 'Home',
    'marketplace.breadcrumb.apps': 'Apps',
    'marketplace.media.videoCaptionsMissing': 'Demo video is hidden until captions are available.',
    'marketplace.install.targetStore': 'The app will be installed to the store attached to your signed-in merchant session.',
    'marketplace.billing.approvalRequired': 'Paid charges require merchant billing approval before activation.',
    'developer.reviewRequirements.policyPending': 'Policy details will be published before submissions are reviewed.',
    'developer.pricing.currencyNotice': 'Prices are displayed in the selected marketplace currency.',
} as const;

export type MarketplaceMessageKey = keyof typeof marketplaceMessages;

export function t(key: MarketplaceMessageKey): string {
    return marketplaceMessages[key];
}
