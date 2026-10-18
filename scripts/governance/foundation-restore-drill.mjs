#!/usr/bin/env node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

class RestoreDrillError extends Error {}

// libpq accepts routing in URI query parameters AND environment/service defaults.
// Keep a small explicit URI subset, then pass the normalized endpoint to the tool
// rather than validating one interpretation and executing the original string.
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
const CONNECTION_OPTIONS = new Set(["application_name", "sslmode", "connect_timeout"]);
const SSL_MODES = new Set(["disable", "allow", "prefer", "require", "verify-ca", "verify-full"]);
const ROUTING_ENV = ["PGHOST", "PGHOSTADDR", "PGPORT", "PGDATABASE", "PGSERVICE", "PGSERVICEFILE", "PGSYSCONFDIR", "PGLOADBALANCEHOSTS", "PGTARGETSESSIONATTRS"];

function localEndpoint(raw) {
  // Reject strings that URL parsers/libpq may trim, decode or interpret differently.
  if (typeof raw !== "string" || /[\u0000-\u0020\u007f\\#]/u.test(raw)) {
    throw new RestoreDrillError("Restore endpoints must be explicit Postgres URLs without whitespace, fragments or control characters.");
  }
  let url;
  try {
    decodeURIComponent(raw);
    url = new URL(raw);
  } catch {
    throw new RestoreDrillError("Restore endpoints must be valid Postgres URLs.");
  }
  if (!["postgres:", "postgresql:"].includes(url.protocol)) {
    throw new RestoreDrillError("Restore endpoints must use a Postgres URL scheme.");
  }
  const parts = raw.match(/^[a-z]+:\/\/([^/?#]*)\/([^?#]*)/iu);
  const authority = parts?.[1];
  // No encoded/socket/multi-host authority, implicit host or ambiguous userinfo.
  const address = authority?.split("@");
  const hostAndPort = address && address.length <= 2 ? address.at(-1) : "";
  if (!hostAndPort || !/^(?:\[[0-9a-f:]+\]|[a-z0-9.]+)(?::[0-9]+)?$/iu.test(hostAndPort)
      || !LOCAL_HOSTS.has(url.hostname.toLowerCase())) {
    throw new RestoreDrillError("Restore drill execution requires localhost, 127.0.0.1 or IPv6 loopback. Shared/staging/prod restores are human SKIP-DEPLOY runbook steps.");
  }
  const port = Number(url.port || "5432");
  if (!Number.isInteger(port) || port < 1 || port > 65535 || hostAndPort.endsWith(":")) {
    throw new RestoreDrillError("Restore endpoints require a valid explicit TCP port or the default port.");
  }
  if (/[\u0000-\u001f\u007f]/u.test(decodeURIComponent(url.username))
      || /[\u0000-\u001f\u007f]/u.test(decodeURIComponent(url.password))) {
    throw new RestoreDrillError("Restore endpoint credentials must not contain control characters.");
  }
  const database = decodeURIComponent(parts?.[2] || "");
  // Named dedicated local databases only; no implicit user-named DB, nested
  // conninfo, path segments, escaped NUL or alternate dbname query parameter.
  if (!/^[a-z0-9_][a-z0-9_.-]*$/iu.test(database) || Buffer.byteLength(database, "utf8") > 63) {
    throw new RestoreDrillError("Restore endpoints require an explicit simple database name in the URL path.");
  }
  const seen = new Set();
  const options = [];
  for (const [key, value] of url.searchParams) {
    if (!CONNECTION_OPTIONS.has(key) || seen.has(key) || /[\u0000-\u001f\u007f]/u.test(value)) {
      throw new RestoreDrillError("Restore URL options may contain only one application_name, sslmode and connect_timeout; routing overrides are not allowed.");
    }
    seen.add(key);
    if ((key === "sslmode" && !SSL_MODES.has(value))
        || (key === "connect_timeout" && (!/^\d+$/u.test(value) || Number(value) < 1 || Number(value) > 2147483647))) {
      throw new RestoreDrillError("Restore URL connection option is invalid.");
    }
    options.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }
  url.protocol = "postgresql:";
  // Pin localhost to the loopback literal: do not let DNS/hosts configuration
  // change the route after validation. IPv6 loopback is normalized by URL.
  url.hostname = url.hostname.toLowerCase() === "localhost" ? "127.0.0.1" : url.hostname;
  url.port = String(port);
  url.pathname = `/${encodeURIComponent(database)}`;
  url.search = options.join("&");
  return { url: url.href, port, database };
}

export function preflightRestore(argv, env) {
  const args = new Set(argv);
  if (args.size !== argv.length || argv.some(arg => !["--plan", "--execute"].includes(arg))
      || (args.has("--plan") && args.has("--execute"))) {
    throw new RestoreDrillError("Choose either --plan or --execute; unsupported or repeated options are refused.");
  }
  if (!args.has("--execute")) return { execute: false };
  if (env.LETBUYY_RESTORE_DRILL_ALLOW_EXECUTE !== "true") {
    throw new RestoreDrillError("Set LETBUYY_RESTORE_DRILL_ALLOW_EXECUTE=true to run a local restore drill.");
  }
  if (!env.LETBUYY_RESTORE_DRILL_SOURCE_URL || !env.LETBUYY_RESTORE_DRILL_TARGET_URL) {
    throw new RestoreDrillError("LETBUYY_RESTORE_DRILL_SOURCE_URL and LETBUYY_RESTORE_DRILL_TARGET_URL are required.");
  }
  if (ROUTING_ENV.some(key => env[key] !== undefined && env[key] !== "")) {
    throw new RestoreDrillError("Unset libpq routing environment variables before executing a local restore drill.");
  }
  const source = localEndpoint(env.LETBUYY_RESTORE_DRILL_SOURCE_URL);
  const target = localEndpoint(env.LETBUYY_RESTORE_DRILL_TARGET_URL);
  // All supported loopback spellings can address the same server. Credentials
  // and query options never make the same port/database a distinct destination.
  if (source.port === target.port && source.database === target.database) {
    throw new RestoreDrillError("Restore source and target must have distinct local port/database identities.");
  }
  return { execute: true, source, target };
}

function run(cmd, cmdArgs, env) {
  let result;
  try {
    // Child diagnostics can contain URLs/passwords; never inherit or print them.
    result = spawnSync(cmd, cmdArgs, { env, stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
  } catch {
    throw new RestoreDrillError(`${cmd} failed. Check local tool availability and database configuration.`);
  }
  if (result.error || result.status !== 0) {
    throw new RestoreDrillError(`${cmd} failed. Check local tool availability and database configuration.`);
  }
}

export function runRestoreDrill(argv = process.argv.slice(2), env = process.env) {
  // Preflight must finish before temp-directory creation or any process dispatch.
  const plan = preflightRestore(argv, env);
  if (!plan.execute) {
    console.log("LetBuyy restore drill plan");
    console.log("- Codex mode: plan only; no production/shared DB action.");
    console.log("- Execute locally with --execute and LETBUYY_RESTORE_DRILL_SOURCE_URL / LETBUYY_RESTORE_DRILL_TARGET_URL.");
    console.log("- Use separately approved, owned, distinct local databases; URLs alone do not establish resource ownership.");
    console.log("- Human shared-env apply remains SKIP-DEPLOY with backup, verify, and rollback evidence.");
    return;
  }

  const dir = mkdtempSync(join(tmpdir(), "letbuyy-restore-drill-"));
  const dumpPath = join(dir, "source.backup");
  try {
    run("pg_dump", ["--format=custom", "--no-owner", "--no-acl", "--file", dumpPath, plan.source.url], env);
    run("pg_restore", ["--clean", "--if-exists", "--no-owner", "--no-acl", "--dbname", plan.target.url, dumpPath], env);
    console.log("Local restore commands completed. Integrity and recovery certification require separate evidence.");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    runRestoreDrill();
  } catch (error) {
    console.error(error instanceof RestoreDrillError ? error.message : "Restore drill failed. Check local resources and tool availability.");
    process.exitCode = 1;
  }
}
