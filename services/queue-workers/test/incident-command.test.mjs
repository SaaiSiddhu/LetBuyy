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

test('incident command worker records dry-run paging and postmortem reminder evidence', () => {
  const workerSource = source('src/incident-command.ts');
  const indexSource = source('src/index.ts');

  assert.match(workerSource, /export function isIncidentCommandJob/);
  assert.match(workerSource, /incident\.page\.dry_run/);
  assert.match(workerSource, /incident\.postmortem\.reminder/);
  assert.match(workerSource, /oncall_schedules/);
  assert.match(workerSource, /incident_postmortems/);
  assert.match(workerSource, /production_incident_events/);
  assert.match(workerSource, /audit_logs/);
  assert.match(workerSource, /mode: 'dry_run'/);
  assert.match(workerSource, /runIncidentPostmortemReminders/);
  assert.match(indexSource, /processIncidentCommandDeliveries/);
  assert.match(indexSource, /runIncidentPostmortemReminders/);
  assert.match(indexSource, /incident_command_result/);
  assert.match(indexSource, /scheduled\.incident_postmortem_reminder/);
});
