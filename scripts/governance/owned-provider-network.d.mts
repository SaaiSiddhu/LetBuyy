export const OWNED_TURNSTILE_KIND: 'turnstile-local-v1';
export interface OwnedProviderFixtureProfile {
  kind: 'turnstile-local-v1';
  origin: string;
  capability: string;
}
export function validateOwnedProviderFixture(value: unknown): Readonly<OwnedProviderFixtureProfile>;
export function createOwnedProviderFetch(fetcher: typeof fetch, profile: unknown, blockedLocalPorts?: readonly number[]): typeof fetch;

export function withOwnedLocalPortDenials(fetcher: typeof fetch, blockedLocalPorts?: readonly number[]): typeof fetch;
