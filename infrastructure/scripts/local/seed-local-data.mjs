#!/usr/bin/env node
import { dockerComposeArgs, ensureDockerAvailable, run } from "./common.mjs";

ensureDockerAvailable();
run("docker", dockerComposeArgs([
  "exec",
  "-T",
  "postgres",
  "psql",
  "-U",
  "letbuyy",
  "-d",
  "letbuyy_local",
  "-f",
  "/local-seed/001-local-seed.sql",
]));

console.log("[local-seed] local replay, queue, and feature flag seed data applied");
