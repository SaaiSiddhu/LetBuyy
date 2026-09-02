import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

function read(relativePath: string): string {
  const absolutePath = join(repoRoot, relativePath);
  assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
  return readFileSync(absolutePath, 'utf8');
}

test('gateway returns apex MX warning and UI/mobile surfaces it', () => {
  const route = read('services/api-gateway/src/routes/custom-domains.ts');
  const wizardPath = join(repoRoot, 'apps/merchant_web/src/components/domains/ConnectDomainWizard.tsx');
  const merchant = existsSync(wizardPath) ? readFileSync(wizardPath, 'utf8') : read('apps/merchant_web/src/app/[store]/settings/domains/page.tsx');
  const mobileScreen = read('apps/merchant_app/lib/screens/settings/domain_settings_screen.dart');
  const mobileService = read('apps/merchant_app/lib/services/custom_domains.dart');

  assert.match(route, /apex_mx_warning: dnsSnapshot\.mx\.length > 0/);
  assert.match(merchant, /apex_mx_warning|apexMxWarning/);
  assert.match(merchant, /receives email|Your domain has email \(MX\) records/);
  assert.match(mobileService, /apexMxWarning/);
  assert.match(mobileScreen, /Your domain has email \(MX\) records/);
});
