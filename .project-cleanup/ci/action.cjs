const fs = require('node:fs');
const cp = require('node:child_process');
const path = require('node:path');
const python = process.platform === 'win32' ? 'python' : 'python3';
try {
  const phase = process.env.INPUT_PHASE || 'begin';
  if (!['begin', 'snapshot', 'archive'].includes(phase)) throw new Error('invalid phase');
  const result = cp.spawnSync(python, [path.join(__dirname, 'ci_lifecycle.py'), phase], {encoding: 'utf8'});
  if (result.status !== 0) throw new Error('ownership setup unavailable');
  const data = JSON.parse(result.stdout);
  if (phase !== 'begin') {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, 'ready=true\n');
    return;
  }
  if (!data.scope || !data.payload || !data.scratch) throw new Error('incomplete scope');
  for (const value of Object.values(data)) {
    if (typeof value === 'string' && /[\r\n]/.test(value)) throw new Error('invalid environment boundary');
  }
  fs.appendFileSync(process.env.GITHUB_ENV, `PROJECT_CLEANUP_CI_SCOPE=${data.scope}\nTMPDIR=${data.scratch}\n`);
  const suffix = path.basename(data.scope).replace(/[^a-zA-Z0-9_-]/g, '-');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `enabled=true\npayload=${data.payload}\nartifact_name=protected-evidence-${suffix}\n`);
  fs.appendFileSync(process.env.GITHUB_STATE, `scope=${data.scope}\n`);
} catch (_) {
  console.log('::warning::Protected cleanup setup deferred; source, builds and job status unchanged.');
}
