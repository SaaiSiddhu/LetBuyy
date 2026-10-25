/** Read-only artifact preflight. Writes only its own readiness record; not an a11y audit. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../../../../../', import.meta.url);
const reportPath = 'docs/implementation/niche-themes-2026-10-23/circuit/discovery/ui-facet-contract/report.json';
const reportBytes = await readFile(new URL(reportPath, root));
const report = JSON.parse(reportBytes);
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inputMismatches = [];
for (const [path, expected] of Object.entries(report.inputs ?? {})) {
  const actual = sha(await readFile(new URL(path, root)));
  if (actual !== expected) inputMismatches.push({ path, expected, actual });
}
const artifacts = [];
for (const row of report.rows ?? []) {
  const mismatches = [];
  for (const [path, expected] of Object.entries(row.sourceHashes ?? {})) {
    const actual = sha(await readFile(new URL(path, root)));
    if (actual !== expected) mismatches.push({ path, expected, actual });
  }
  const path = 'docs/implementation/niche-themes-2026-10-23/circuit/discovery/ui-facet-contract/' + row.html;
  artifacts.push({ slug: row.slug, route: row.route, path, sha256: sha(await readFile(new URL(path, root))), functionalFindingCount: row.findings?.length ?? null, sourceMismatches: mismatches });
}
const expectedSlugs = ['letbuyy-bloom','letbuyy-forge','letbuyy-refresh','letbuyy-craft','letbuyy-summit','letbuyy-nova','letbuyy-aura','letbuyy-ride','letbuyy-dawn'];
const completeCoverage = artifacts.length === 18 && expectedSlugs.every(slug => ['collection','search'].every(route => artifacts.filter(row => row.slug === slug && row.route === route).length === 1));
const currentSnapshotChecksPass = completeCoverage && inputMismatches.length === 0 && artifacts.every(row => row.sourceMismatches.length === 0 && row.functionalFindingCount === 0);
const output = { classification: 'PREPARATION_READINESS_ONLY_NOT_ACCESSIBILITY_REVIEW', reportPath, reportSha256: sha(reportBytes), reportCreatedAt: report.createdAt, completeCoverage, inputMismatches, artifacts, currentSnapshotChecksPass, finalStableOwnerCheckpointConfirmed: false, note: 'A current/green hash snapshot is a preflight check; wait for the requested final Circuit/coordinator checkpoint before final review. HTML is not modified; no query parser, browser, network or database is used.' };
await writeFile(new URL('input-readiness.json', import.meta.url), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ artifacts: artifacts.length, completeCoverage, currentSnapshotChecksPass, inputMismatches: inputMismatches.length, staleArtifacts: artifacts.filter(row => row.sourceMismatches.length).length, functionalFindings: artifacts.reduce((sum,row) => sum + (row.functionalFindingCount ?? 0), 0), finalStableOwnerCheckpointConfirmed: false }));
