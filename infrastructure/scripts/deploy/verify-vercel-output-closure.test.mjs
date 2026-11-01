import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { inspectVercelOutputClosure } from "./verify-vercel-output-closure.mjs";

function fixture(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "letbuyy-vercel-closure-"));
  const outputDir = path.join(directory, ".vercel/output");
  const func = path.join(outputDir, "functions/index.func");
  fs.mkdirSync(func, { recursive: true });
  fs.writeFileSync(path.join(outputDir, "config.json"), '{"version":3}');
  fs.writeFileSync(path.join(func, "index.js"), "export default {};");
  const configure = (filePathMap = {}, handler = "index.js") => fs.writeFileSync(
    path.join(func, ".vc-config.json"), JSON.stringify({ runtime: "nodejs22.x", handler, filePathMap }),
  );
  configure();
  const inspect = () => inspectVercelOutputClosure({ repoRoot: directory, outputDir });
  try { run({ directory, outputDir, func, configure, inspect }); }
  finally { fs.rmSync(directory, { recursive: true, force: true }); }
}

test("missing generated reference fails even when the saved output exists", () => fixture(({ configure, inspect }) => {
  configure({ "apps/merchant/web/.next/package.json": "apps/merchant/web/.next/package.json" });
  assert.throws(inspect, /Missing artifact reference/);
}));

test("complete artifact includes external bytes and detects post-admission drift", () => fixture(({ directory, configure, inspect }) => {
  const source = path.join(directory, "generated.json");
  fs.writeFileSync(source, '{"qualified":true}');
  configure({ "generated.json": "runtime/generated.json" });
  const before = inspect();
  assert.equal(before.complete, true);
  assert.equal(before.externalReferences.length, 1);
  assert.equal(before.externalReferences[0].bytes, 18);
  fs.writeFileSync(source, '{"qualified":false}');
  assert.notEqual(inspect().closureSha256, before.closureSha256);
}));

test("relative function aliases are included without losing their real configuration", () => fixture(({ outputDir, inspect }) => {
  fs.symlinkSync("index.func", path.join(outputDir, "functions/alias.func"));
  const result = inspect();
  assert.equal(result.functionCount, 1);
  assert.ok(result.outputFiles.some((file) => file.type === "symlink"));
}));

test("missing internal handler fails", () => fixture(({ configure, inspect }) => {
  configure({}, "missing.js");
  assert.throws(inspect, /Missing function handler/);
}));

test("credential file reference fails before it is read", () => fixture(({ configure, inspect }) => {
  configure({ ".env.preview.local": "runtime.json" });
  assert.throws(inspect, /Credential or repository metadata/);
}));

test("destination cannot escape the function directory", () => fixture(({ directory, configure, inspect }) => {
  fs.writeFileSync(path.join(directory, "generated.json"), "{}");
  configure({ "generated.json": "../../../../escape.json" });
  assert.throws(inspect, /escapes its root/);
}));

test("broken output alias fails", () => fixture(({ outputDir, inspect }) => {
  fs.symlinkSync("missing.func", path.join(outputDir, "functions/alias.func"));
  assert.throws(inspect, /Broken artifact symlink/);
}));

test("output symlink cannot import an external private file", () => fixture(({ directory, func, inspect }) => {
  fs.writeFileSync(path.join(directory, "private.txt"), "fixture-only");
  fs.symlinkSync("../../../../private.txt", path.join(func, "unsafe.txt"));
  assert.throws(inspect, /escapes its root/);
}));

test("an external reference cannot escape through a symlinked parent", () => fixture(({ directory, configure, inspect }) => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "letbuyy-closure-outside-"));
  try {
    fs.writeFileSync(path.join(outside, "private.json"), "{}");
    fs.symlinkSync(outside, path.join(directory, "foreign"));
    configure({ "foreign/private.json": "runtime.json" });
    assert.throws(inspect, /escapes its root/);
  } finally { fs.rmSync(outside, { recursive: true, force: true }); }
}));
