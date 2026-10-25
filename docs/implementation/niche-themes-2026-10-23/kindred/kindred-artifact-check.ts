import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { createLetbuyyCoreLiquidThemeBundleFixture, createKindredTheme, validateThemeInstall, packageThemeBundle } from '../../../../packages/theme-engine/src/index'

const core = createLetbuyyCoreLiquidThemeBundleFixture()
const theme = createKindredTheme(core)
const install = validateThemeInstall({ bundle: theme, targetSlug: 'letbuyy-summit' })
assert.equal(install.ok, true)
const manifest = packageThemeBundle(theme)
assert.deepEqual(packageThemeBundle(theme), manifest)
const baseWarnings = validateThemeInstall({ bundle: core }).issues.filter(issue => issue.level === 'warn').map(issue => issue.message)
const warnings = install.issues.filter(issue => issue.level === 'warn').map(issue => issue.message)
const result = {
    phase: 'M2 artifact validation only', identity: { slug: theme.package.slug, version: theme.package.version }, install,
    manifest: { contentHash: manifest.contentHash, fileCount: manifest.files.length, totalBytes: manifest.files.reduce((sum, file) => sum + file.sizeBytes, 0), deterministic: true },
    warningComparison: { baseCount: baseWarnings.length, kindredCount: warnings.length, newWarnings: warnings.filter(value => !baseWarnings.includes(value)) },
    notVerified: ['persisted merchant install', 'draft save and publish', 'checkout/order', 'browser responsive QA'],
}
writeFileSync(new URL('artifact-contract.json', import.meta.url), JSON.stringify(result, null, 2) + '\n')
process.stdout.write(JSON.stringify({ manifest: result.manifest, warnings: result.warningComparison }) + '\n')
