// Shared by both shadow comparators (legacy-translated and target-backed) so neither imports the
// other. Pure lookup, no I/O.

import { LEGACY_PERMISSION_ALIASES } from '@letbuyy/permission-core';

export function canonicalActionFor(legacyKey: string): string | null {
  return LEGACY_PERMISSION_ALIASES.find((alias) => alias.legacy === legacyKey)?.canonical ?? null;
}
