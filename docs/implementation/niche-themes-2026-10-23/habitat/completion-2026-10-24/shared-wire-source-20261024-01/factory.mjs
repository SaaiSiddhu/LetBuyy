import { createHabitatTheme } from '../../../../../../packages/theme-engine/src/habitat-theme.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../../../../../../packages/theme-engine/src/theme-bundle-core.ts';
export function frozenHabitatSource() { return createHabitatTheme(createLetbuyyCoreLiquidThemeBundleFixture()); }
