import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = join(testDir, '..', '..', '..');
const appRoot = join(repoRoot, 'apps', 'theme-marketplace');
const appSrcRoot = join(appRoot, 'src');
const sampleSeedPath = join(repoRoot, 'database', 'supabase', 'seeds', 'theme-marketplace-sample-catalog.sql');
const urbanSeedPath = join(repoRoot, 'database', 'supabase', 'seeds', 'urban-kicks-theme.sql');
const previewRoot = join(appRoot, 'public', 'previews');

const sampleSlugs = [
    'commerce-canvas',
    'bazaar-minimal',
    'market-luxe',
    'portfolio-studio',
    'creator-grid',
    'case-study-pro',
    'resume-slate',
    'cv-focus',
    'profile-brief',
    'launch-landing',
    'event-splash',
    'lead-magnet',
    'saas-console',
    'app-startup',
    'product-docs',
];
const previewSlugs = [...sampleSlugs, 'urban-kicks'];

function walkSource(dir) {
    return readdirSync(dir).flatMap((entry) => {
        const fullPath = join(dir, entry);
        const stat = statSync(fullPath);
        if (stat.isDirectory()) return walkSource(fullPath);
        return /\.(ts|tsx|js|jsx)$/.test(entry) ? [fullPath] : [];
    });
}

function pngSize(path) {
    const file = readFileSync(path);
    assert.deepEqual([...file.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], `${path} is not a PNG`);
    return {
        width: file.readUInt32BE(16),
        height: file.readUInt32BE(20),
        bytes: file.byteLength,
    };
}

test('GA sample catalog is richer, measured, multi-author, and free of old placeholder markers', () => {
    const sampleSeed = readFileSync(sampleSeedPath, 'utf8');
    const urbanSeed = readFileSync(urbanSeedPath, 'utf8');
    const combinedSeeds = `${sampleSeed}\n${urbanSeed}`;

    for (const slug of sampleSlugs) {
        assert.match(sampleSeed, new RegExp(`'${slug}'`), `${slug} should be seeded`);
    }
    assert.match(sampleSeed, /'letbuyy-samples'/);
    assert.match(sampleSeed, /'letbuyy-labs'/);
    assert.match(combinedSeeds, /'lighthouse_performance'/);
    assert.match(combinedSeeds, /'lighthouse_accessibility'/);
    assert.match(combinedSeeds, /'serious_violations', 0/);
    assert.match(combinedSeeds, /'critical_violations', 0/);

    const forbidden = [
        /measurement_required_in_ci/i,
        /Not yet measured/i,
        /Measurement awaits/i,
        /dev_default/i,
        /'\/previews\/[^']+\.svg'/i,
        /\/images\/banners\/new-arrivals-1\.png/i,
        /\/store\/urban-kicks-demo/i,
    ];
    for (const pattern of forbidden) {
        assert.doesNotMatch(combinedSeeds, pattern);
    }

    const sectionSignatures = new Set();
    for (const line of sampleSeed.split('\n')) {
        if (!line.trimStart().startsWith("('")) continue;
        const arrays = [...line.matchAll(/ARRAY\[(.*?)\]::text\[\]/g)].map((match) => match[1]);
        if (arrays.length >= 4) sectionSignatures.add(arrays[3]);
    }
    assert.equal(sectionSignatures.size, sampleSlugs.length, 'sample themes should not share identical section signatures');
});

test('GA preview assets are real per-theme PNG files with catalog and detail dimensions', () => {
    for (const slug of previewSlugs) {
        const cardPath = join(previewRoot, `${slug}-card.png`);
        const detailPath = join(previewRoot, `${slug}-detail.png`);

        assert.equal(existsSync(cardPath), true, `${relative(repoRoot, cardPath)} missing`);
        assert.equal(existsSync(detailPath), true, `${relative(repoRoot, detailPath)} missing`);

        assert.deepEqual(pngSize(cardPath), { width: 1280, height: 720, bytes: statSync(cardPath).size });
        assert.deepEqual(pngSize(detailPath), { width: 1440, height: 1800, bytes: statSync(detailPath).size });
    }
});

test('GA theme app source no longer references SVG previews or unmeasured quality copy', () => {
    const forbidden = [
        ['SVG preview reference', /\/previews\/[^'")\s]+\.svg/i],
        ['unmeasured score copy', /Not yet measured|Measurement awaits/i],
        ['low contrast white caption', /text-white\/50/],
    ];
    const failures = [];

    for (const file of walkSource(appSrcRoot)) {
        const source = readFileSync(file, 'utf8');
        for (const [label, pattern] of forbidden) {
            if (pattern.test(source)) {
                failures.push(`${relative(repoRoot, file)}: ${label}`);
            }
        }
    }

    assert.deepEqual(failures, []);
});
