const cp = require('node:child_process');
const path = require('node:path');
if (process.env.STATE_scope) {
  const python = process.platform === 'win32' ? 'python' : 'python3';
  const result = cp.spawnSync(python, [path.join(__dirname, 'ci_lifecycle.py'), 'finalize'], {
    env: {...process.env, PROJECT_CLEANUP_CI_SCOPE: process.env.STATE_scope}, encoding: 'utf8', timeout: 120000
  });
  if (result.status !== 0) console.log('::warning::Protected cleanup finalization deferred; original job result unchanged.');
}
