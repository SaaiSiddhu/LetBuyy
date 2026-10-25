import { LiquidThemePackageBundleSchema } from '../../../../../../packages/theme-engine/src/theme-bundle.ts';

export const before = '{% if section.settings.showDescription and product.description %}';
export const after = '{% if section.settings.showDescription and product.description != blank %}';

/** Private source proposal only; not a package version or immutable capture update. */
export function withSuppliedDescriptionGuard(base) {
  if (base.package.slug !== 'letbuyy-refresh' || base.package.version !== '2.0.0') throw new Error('Review candidate requires the exact frozen Pantry200 source context.');
  const source = base.sections['product-detail'].source;
  if (source.split(before).length !== 2) throw new Error('Description guard source drift; no speculative replacement.');
  const candidate = structuredClone(base);
  candidate.sections['product-detail'].source = source.replace(before, after);
  delete candidate.package.checksum;
  return LiquidThemePackageBundleSchema.parse(candidate);
}
