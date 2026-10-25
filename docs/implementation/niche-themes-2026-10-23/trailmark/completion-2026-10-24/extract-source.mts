// Read-only pure factory/schema extraction. No renderer, server, browser, DB or installed state.
import { writeFileSync } from 'node:fs';
import { createTrailmarkTheme } from '../../../../../packages/theme-engine/src/trailmark-theme.ts';
import { createLetbuyyCoreLiquidThemeBundleFixture } from '../../../../../packages/theme-engine/src/theme-bundle-core.ts';
import { buildLiquidThemePackagePersistencePayload } from '../../../../../packages/theme-engine/src/theme-bundle.ts';

const bundle = createTrailmarkTheme(createLetbuyyCoreLiquidThemeBundleFixture());
const schema = buildLiquidThemePackagePersistencePayload(bundle).schemaManifest;
writeFileSync('/private/tmp/trailmark-source-bundle-20261024.json', JSON.stringify(bundle, null, 2) + '\n');
writeFileSync('/private/tmp/trailmark-source-schema-20261024.json', JSON.stringify(schema, null, 2) + '\n');
process.stdout.write(JSON.stringify({ classification: 'SOURCE_METADATA_ONLY', templates: Object.keys(bundle.templates).length, sectionTypes: Object.keys(bundle.sections).length }) + '\n');
