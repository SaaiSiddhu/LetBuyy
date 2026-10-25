// Source-derived evidence only. This neither seeds nor replaces the live catalog.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { firstPartyThemeListings, createFirstPartyCatalogBundle } from '../../../../packages/theme-engine/src/first-party-theme-catalog.ts';

const root = new URL('../../../../', import.meta.url);
const sha = value => createHash('sha256').update(value).digest('hex');
const report = {
    generatedAt: new Date().toISOString(),
    source: 'first-party-theme-catalog.ts factories in the dirty working tree; not persisted catalog or acceptance',
    head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    factorySha256: sha(readFileSync(new URL('packages/theme-engine/src/first-party-theme-catalog.ts', root))),
    themes: firstPartyThemeListings().map(listing => {
        const bundle = createFirstPartyCatalogBundle(listing.slug);
        return {
            slug: listing.slug, presetId: listing.presetId, name: bundle.package.name,
            version: bundle.package.version, pricing: bundle.package.pricing_type,
            artifactSha256: sha(JSON.stringify(bundle)), thumbnail: listing.thumbnail,
            templates: Object.keys(bundle.templates),
            sections: Object.keys(bundle.sections),
            renderer: bundle.renderer,
            qualification: 'IMPLEMENTED_UNVERIFIED; new niche availability follows programme/package evidence, never this inventory alone',
        };
    }),
};
writeFileSync(new URL('catalog-audit.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report.themes.map(({ name, slug, version, templates, artifactSha256 }) => ({ name, slug, version, templates: templates.length, artifactSha256 })), null, 2) + '\n');
