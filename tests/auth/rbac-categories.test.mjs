import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';
import ts from 'typescript';

const AUTH_CORE_SOURCE = 'packages/auth-core/src/index.ts';

function loadAuthCore() {
  const source = readFileSync(AUTH_CORE_SOURCE, 'utf8');
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText;

  const module = { exports: {} };
  const zChain = new Proxy(function zChain() {}, {
    get: () => zChain,
    apply: () => zChain,
  });
  const sandbox = {
    module,
    exports: module.exports,
    require(specifier) {
      if (specifier === 'zod') return { z: { string: () => zChain, object: () => zChain } };
      if (specifier === '@letbuyy/shared-types') return { EmailSchema: zChain };
      throw new Error(`Unexpected test require: ${specifier}`);
    },
    TextEncoder,
    TextDecoder,
    crypto: webcrypto,
    atob: globalThis.atob ?? ((value) => Buffer.from(value, 'base64').toString('binary')),
    btoa: globalThis.btoa ?? ((value) => Buffer.from(value, 'binary').toString('base64')),
    Date,
    Math,
    Number,
    Boolean,
    String,
    RegExp,
    JSON,
    Uint8Array,
    ArrayBuffer,
    Set,
    Map,
  };

  vm.runInNewContext(transpiled, sandbox, { filename: AUTH_CORE_SOURCE });
  return module.exports;
}

const authCore = loadAuthCore();

test('predefined roles normalize to canonical role categories', () => {
  const assignments = authCore.normalizeLetbuyyRoleAssignments([
    'admin',
    'merchandiser',
    'support',
    'developer',
    'ops-reviewer',
  ]);

  assert.deepEqual(JSON.parse(JSON.stringify(assignments)), [
    { name: 'Administrator', category: 'store' },
    { name: 'Merchandiser', category: 'store' },
    { name: 'Support', category: 'organization' },
    { name: 'Partner', category: 'partner' },
    { name: 'Ops-Reviewer', category: 'ops' },
  ]);
  assert.deepEqual(
    JSON.parse(JSON.stringify(authCore.getLetbuyyRoleCategories(assignments))),
    ['ops', 'organization', 'partner', 'store'],
  );
});

test('partner role does not satisfy ops category access', () => {
  const partnerRoles = authCore.normalizeLetbuyyRoleAssignments(['Partner']);
  const opsRoles = authCore.normalizeLetbuyyRoleAssignments(['Ops-Reviewer']);

  assert.equal(authCore.hasLetbuyyRoleCategory(partnerRoles, 'partner'), true);
  assert.equal(authCore.hasLetbuyyRoleCategory(partnerRoles, 'ops'), false);
  assert.equal(authCore.hasAnyLetbuyyRoleCategory(partnerRoles, ['ops']), false);
  assert.equal(authCore.hasAnyLetbuyyRoleCategory(opsRoles, ['ops']), true);
});

test('gateway ops surfaces require ops category before super admin allowlist', () => {
  const rbacSource = readFileSync('services/api-gateway/src/middleware/rbac.ts', 'utf8');
  const operationsSource = readFileSync('services/api-gateway/src/routes/operations.ts', 'utf8');
  const adminSource = readFileSync('services/api-gateway/src/routes/admin.ts', 'utf8');

  assert.match(rbacSource, /export function requireRoleCategory\(\.\.\.categories: RbacRoleCategory\[\]\)/);
  assert.match(rbacSource, /hasAnyLetbuyyRoleCategory\(assignments,\s*categories\)/);
  assert.match(operationsSource, /router\.use\('\*',\s*requireRoleCategory\('ops'\),\s*requireSuperAdmin\)/);
  assert.match(adminSource, /router\.use\('\*',\s*requireRoleCategory\('ops'\),\s*requireSuperAdmin\)/);
});
