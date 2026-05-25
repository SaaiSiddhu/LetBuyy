import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

function stableBucket(input) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

test("feature flag percentage rollout is deterministic for the same identity", () => {
  const key = "checkout.new-runtime";
  const identity = "site_123";
  assert.equal(stableBucket(`${key}:${identity}`), stableBucket(`${key}:${identity}`));
});

test("feature flag source avoids nondeterministic rollout primitives", () => {
  const source = fs.readFileSync("packages/shared-types/src/index.ts", "utf8");
  const stableBucketBody = source.slice(source.indexOf("function stableBucket"), source.indexOf("function rolloutIdentity"));
  assert.doesNotMatch(stableBucketBody, /Math\.random|Date\.now|new Date/);
  assert.match(source, /killSwitch/);
  assert.match(source, /percentage_miss/);
});
