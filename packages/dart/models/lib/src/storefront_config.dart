/// Native mirror of packages/shared-types/src/brand.ts.
/// The governance contract checks that the default stays equal across languages.
const defaultStorefrontDomain = 'letbuyy.store';
const storefrontRootDomain = String.fromEnvironment(
  'STORE_ROOT_DOMAIN', defaultValue: defaultStorefrontDomain);
