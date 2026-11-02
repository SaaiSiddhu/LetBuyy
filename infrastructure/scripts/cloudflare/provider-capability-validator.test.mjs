import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const validator = fileURLToPath(new URL("./provider-capability-validator.mjs", import.meta.url));

function check(mode, environment = "staging", approved = false) {
  const directory = mkdtempSync(path.join(tmpdir(), "letbuyy-provider-capability-"));
  try {
    const executable = path.join(directory, "pnpm");
    writeFileSync(executable, `#!${process.execPath}
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '-v') console.log('10.6.2');
else if (args.at(-1) === '--version') console.log('4.100.0');
else if (args.at(-2) === 'whoami' && args.at(-1) === '--json') {
  if (process.env.CAPABILITY_FIXTURE_MODE === 'unavailable') process.exit(1);
  if (process.env.CAPABILITY_FIXTURE_MODE === 'malformed') console.log('upstream unavailable');
  else console.log(JSON.stringify({loggedIn:process.env.CAPABILITY_FIXTURE_MODE !== 'logged-out',accounts:[{id:process.env.CAPABILITY_FIXTURE_MODE === 'wrong-account' ? 'other-account' : 'owned-account'}]}));
} else { console.error('Optional membership display must not be requested'); process.exit(87); }
`, { mode: 0o700 });
    return spawnSync(process.execPath, [validator, `--environment=${environment}`, "--execute"], {
      encoding: "utf8",
      timeout: 10_000,
      env: {
        ...process.env,
        PATH: directory + path.delimiter + process.env.PATH,
        CLOUDFLARE_API_TOKEN: "synthetic-fixture-only",
        CLOUDFLARE_ACCOUNT_ID: "owned-account",
        CAPABILITY_FIXTURE_MODE: mode,
        LETBUYY_PROVIDER_MUTATION_APPROVED: String(approved),
      },
    });
  } finally {
    rmSync(directory, { recursive: true });
  }
}

test("authenticated staging account passes without optional membership display", () => {
  const result = check("valid");
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /staging capabilities passed/);
});

for (const mode of ["wrong-account", "logged-out", "malformed", "unavailable"]) {
  test(`provider admission rejects ${mode}`, () => {
    const result = check(mode);
    assert.equal(result.status, 1);
    assert.doesNotMatch(result.stdout, /capabilities passed/);
  });
}

test("production still requires explicit provider mutation approval", () => {
  assert.equal(check("valid", "production").status, 1);
  assert.equal(check("valid", "production", true).status, 0);
});
