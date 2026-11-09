// Root browser/device composition re-exports the single owned-DB provider fixture.
// No production runtime may import this test-only seam.
export * from '../../services/api-gateway/src/__tests__/owned-db/local-turnstile-provider.fixture';
