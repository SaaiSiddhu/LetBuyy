import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const hash = (value) => createHash("sha256").update(value).digest("hex");
const inside = (root, name) => name === root || name.startsWith(root + path.sep);

function relativeFile(root, name) {
  if (typeof name !== "string" || !name || path.isAbsolute(name) || name.includes("\\")) {
    throw new Error("Artifact reference must be a relative path");
  }
  const resolved = path.resolve(root, name);
  if (!inside(root, resolved)) throw new Error("Artifact reference escapes its root");
  if (name.split("/").some((part) => /^\.env(?:\.|$)|^\.dev\.vars(?:\.|$)|^\.git$|^\.npmrc$|^\.ssh$/.test(part))) {
    throw new Error("Credential or repository metadata must not enter the artifact");
  }
  return resolved;
}

function describe(root, name) {
  const source = relativeFile(root, name);
  let stat;
  try {
    stat = fs.lstatSync(source);
  } catch {
    throw new Error(`Missing artifact reference: ${name}`);
  }
  if (stat.isSymbolicLink()) {
    let resolved;
    try {
      resolved = fs.realpathSync(source);
    } catch {
      throw new Error(`Broken artifact symlink: ${name}`);
    }
    if (!inside(root, resolved)) throw new Error(`Artifact symlink escapes its root: ${name}`);
    relativeFile(root, path.relative(root, resolved));
    const target = fs.readlinkSync(source);
    if (path.isAbsolute(target)) throw new Error(`Artifact symlink is not portable: ${name}`);
    return { path: name, type: "symlink", target, sha256: hash(target) };
  }
  if (!stat.isFile()) throw new Error(`Artifact reference is not a file: ${name}`);
  const resolved = fs.realpathSync(source);
  if (!inside(root, resolved)) throw new Error(`Artifact reference escapes its root: ${name}`);
  relativeFile(root, path.relative(root, resolved));
  return { path: name, type: "file", bytes: stat.size, sha256: hash(fs.readFileSync(source)) };
}

/** A Vercel function filePathMap can reference files outside .vercel/output. */
export function inspectVercelOutputClosure({ repoRoot, outputDir }) {
  const repo = fs.realpathSync(repoRoot);
  const output = fs.realpathSync(outputDir);
  const config = JSON.parse(fs.readFileSync(path.join(output, "config.json"), "utf8"));
  if (config.version !== 3) throw new Error("Expected Vercel Build Output API version3");
  const files = [];
  const functions = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const location = path.join(directory, entry.name);
      const name = path.relative(output, location).split(path.sep).join("/");
      if (entry.isDirectory()) walk(location);
      else {
        files.push(describe(output, name));
        if (entry.name === ".vc-config.json") functions.push(location);
      }
    }
  }
  walk(output);
  if (!functions.length) throw new Error("Expected at least one real function configuration");
  const references = new Map();
  for (const location of functions) {
    const func = JSON.parse(fs.readFileSync(location, "utf8"));
    const mapped = func.filePathMap ?? {};
    if (typeof mapped !== "object" || mapped === null || Array.isArray(mapped)) {
      throw new Error("Invalid function filePathMap");
    }
    for (const [source, destination] of Object.entries(mapped)) {
      relativeFile(path.dirname(location), destination);
      references.set(source, describe(repo, source));
    }
    const handler = relativeFile(path.dirname(location), func.handler);
    if (!fs.existsSync(handler) && !Object.values(mapped).includes(func.handler)) {
      throw new Error(`Missing function handler: ${func.handler}`);
    }
  }
  const ordered = (rows) => rows.sort((a, b) => a.path.localeCompare(b.path));
  const manifest = {
    schemaVersion: 1,
    outputFiles: ordered(files),
    externalReferences: ordered([...references.values()]),
    functionCount: functions.length,
  };
  return {
    ...manifest,
    closureSha256: hash(JSON.stringify(manifest)),
    complete: true,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const value = (flag) => process.argv.find((arg) => arg.startsWith(flag + "="))?.slice(flag.length + 1);
  try {
    const manifest = inspectVercelOutputClosure({
      repoRoot: value("--repo-root") ?? process.cwd(),
      outputDir: value("--output-dir") ?? path.join(process.cwd(), ".vercel/output"),
    });
    const expected = value("--expected-closure-sha256");
    if (expected && expected !== manifest.closureSha256) throw new Error("Artifact closure changed after admission");
    const report = value("--report-json");
    if (report) fs.writeFileSync(report, JSON.stringify(manifest, null, 2) + "\n", { mode: 0o600 });
    console.log(JSON.stringify({
      complete: true,
      functionCount: manifest.functionCount,
      outputFileCount: manifest.outputFiles.length,
      externalReferenceCount: manifest.externalReferences.length,
      closureSha256: manifest.closureSha256,
    }));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
