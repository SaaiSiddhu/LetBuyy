export type MarketplaceCapability =
    | 'appTelemetry'
    | 'featuredRails';

const CAPABILITY_ENV: Record<MarketplaceCapability, string> = {
    appTelemetry: 'NEXT_PUBLIC_MP_TELEMETRY',
    featuredRails: 'NEXT_PUBLIC_MP_FEATURED_RAILS',
};

function isEnabled(value: string | undefined): boolean {
    return value === '1' || value === 'true' || value === 'on';
}

export function marketplaceCapabilityEnabled(capability: MarketplaceCapability): boolean {
    return isEnabled(process.env[CAPABILITY_ENV[capability]]);
}

export const MARKETPLACE_CAPABILITY_ENV = CAPABILITY_ENV;
