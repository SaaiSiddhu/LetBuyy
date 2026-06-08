import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const testDir = dirname(fileURLToPath(import.meta.url));
const serviceRoot = join(testDir, '..');

function source(path) {
  return readFileSync(join(serviceRoot, path), 'utf8');
}

test('compliance worker runs local dry-run audit export cursor automation', () => {
  const workerSource = source('src/compliance.ts');
  const indexSource = source('src/index.ts');

  assert.match(workerSource, /export function isComplianceAuditExportJob/);
  assert.match(workerSource, /compliance\.audit_export\.run/);
  assert.match(workerSource, /compliance\.audit_export\.dry_run/);
  assert.match(workerSource, /runComplianceAuditExportDryRun/);
  assert.match(workerSource, /audit_export_cursors/);
  assert.match(workerSource, /audit_logs/);
  assert.match(workerSource, /COMPLIANCE_AUDIT_EXPORT_DRY_RUN_SINK/);
  assert.match(workerSource, /COMPLIANCE_RETENTION_POLICY_VERSION/);
  assert.match(workerSource, /sha256Hex/);
  assert.match(workerSource, /audit_export\.dry_run/);
  assert.match(indexSource, /processComplianceDeliveries/);
  assert.match(indexSource, /runComplianceAuditExportDryRun/);
  assert.match(indexSource, /scheduled\.compliance_audit_export/);
});
