// F-INFRA-1 — a monorepo lane must report on EVERY package, not stop at the first casualty.
//
// turbo cancels a failing task's dependents. Without --continue, one package's failure silently
// removes every downstream package from the run: @letbuyy/infrastructure's type errors meant
// @letbuyy/api-gateway — the canonical backend — was never typechecked at all, through every gate
// run, while the lane reported a single already-attributed red. That is how an import of a function
// defined in no commit sat on develop with the gateway refusing to compile (GW-1).
//
// The failure mode is not "a red was ignored". It is "the red was load-bearing": it suppressed the
// checking, and the suppression looked exactly like the familiar failure.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync("package.json", "utf8"));

// Every root script that fans a task across the workspace. A lane added here later without
// --continue reintroduces the blindness, which is the whole point of pinning it.
const FANNED_OUT_LANES = ["typecheck", "lint", "build"];

test("every root turbo lane runs --continue, so one package cannot cancel the rest", () => {
  for (const lane of FANNED_OUT_LANES) {
    const script = pkg.scripts[lane];
    assert.ok(script, `package.json should define a ${lane} script`);
    assert.match(
      script,
      /(^|\s)turbo\s/,
      `${lane} is expected to fan out through turbo; if it no longer does, this contract needs rewriting rather than deleting`,
    );
    assert.match(
      script,
      /\s--continue(\s|=|$)/,
      `root "${lane}" must pass --continue. Without it a failing package cancels its dependents and they are never checked — the lane then reports one red while whole runtimes go unverified (see GW-1).`,
    );
  }
});

test("no root turbo lane silently swallows a failure", () => {
  // --continue must not be paired with anything that makes the lane exit 0 regardless. The lane
  // should run EVERYTHING and still fail; reporting more while failing less would be worse than
  // the blindness it replaces.
  for (const lane of FANNED_OUT_LANES) {
    const script = pkg.scripts[lane];
    assert.doesNotMatch(script, /\|\|\s*(true|exit\s+0)/, `${lane} must not force a zero exit`);
    assert.doesNotMatch(script, /--no-error-on-unmatched|;\s*exit\s+0/, `${lane} must not mask its exit code`);
  }
});

test("the turbo tasks these lanes fan out are declared, so --continue has something to continue past", () => {
  const turbo = JSON.parse(readFileSync("turbo.json", "utf8"));
  const tasks = turbo.tasks || turbo.pipeline || {};
  for (const lane of FANNED_OUT_LANES) {
    assert.ok(tasks[lane], `turbo.json should declare the "${lane}" task`);
  }
});
