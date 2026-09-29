#!/usr/bin/env node
import { spawnSync } from "node:child_process";

const command = process.argv[2] || "start";
const container = process.env.LETBUYY_EXECUTABLE_PG_CONTAINER || "letbuyy-executable-pg";
const database = process.env.LETBUYY_EXECUTABLE_PG_DATABASE || "letbuyy_executable";
const image = process.env.LETBUYY_EXECUTABLE_PG_IMAGE || "postgres:16-alpine";

function run(cmd, args, options = {}) {
  const result = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: options.stdio || "pipe",
    input: options.input,
  });
  if (options.allowFailure) return result;
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed\n${result.stderr || result.stdout}`);
  }
  return result;
}

function containerExists() {
  return run("docker", ["inspect", container], { allowFailure: true }).status === 0;
}

function isRunning() {
  const result = run("docker", ["inspect", "-f", "{{.State.Running}}", container], { allowFailure: true });
  return result.status === 0 && result.stdout.trim() === "true";
}

// The postgres image initialises through a temporary server that listens on the unix socket only,
// stops it, then starts the real one, so a socket `pg_isready` can answer while the temporary server
// is still up and the next query can hit its shutdown. The TCP probe is true only for the final
// server; the query then confirms it end to end (see executable-pg-fixture.mjs for the measurement).
function waitReady() {
  const started = Date.now();
  while (Date.now() - started < 30_000) {
    const tcp = run("docker", ["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres", "-d", database], { allowFailure: true });
    if (tcp.status === 0) {
      const query = run("docker", ["exec", container, "psql", "-U", "postgres", "-d", "postgres", "-qAt", "-c", "select 1"], { allowFailure: true });
      if (query.status === 0 && query.stdout.trim() === "1") return;
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error(`Postgres fixture did not become ready in ${container}`);
}

function databaseExists() {
  const result = run("docker", ["exec", container, "psql", "-U", "postgres", "-d", database, "-c", "SELECT 1;"], { allowFailure: true });
  return result.status === 0;
}

function ensureDatabase() {
  if (databaseExists()) return;
  const sql = `SELECT 'CREATE DATABASE ${database}' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${database}')\\gexec\n`;
  run("docker", ["exec", "-i", container, "psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=0"], {
    input: sql,
    allowFailure: true,
  });
}

function start() {
  if (!containerExists()) {
    run("docker", [
      "run",
      "--name",
      container,
      "-e",
      "POSTGRES_PASSWORD=postgres",
      "-e",
      `POSTGRES_DB=${database}`,
      "-d",
      image,
    ]);
  } else if (!isRunning()) {
    run("docker", ["start", container]);
  }
  waitReady();
  ensureDatabase();
  console.log(`Postgres fixture ready: container=${container} database=${database}`);
}

function stop() {
  if (containerExists() && isRunning()) {
    run("docker", ["stop", container], { stdio: "inherit" });
  }
  console.log(`Postgres fixture stopped: container=${container}`);
}

function status() {
  if (!containerExists()) {
    console.log(`missing: ${container}`);
    process.exit(1);
  }
  console.log(`${container}: ${isRunning() ? "running" : "stopped"}`);
}

try {
  if (command === "start") start();
  else if (command === "stop") stop();
  else if (command === "status") status();
  else {
    throw new Error(`Unknown command: ${command}. Expected start, stop, or status.`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
