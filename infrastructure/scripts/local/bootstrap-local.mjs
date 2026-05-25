#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const template = path.join("config", "env", "templates", "local.env.example");
const target = ".env.local";

if (!fs.existsSync(template)) {
  throw new Error(`Missing local environment template: ${template}`);
}

if (!fs.existsSync(target)) {
  fs.copyFileSync(template, target);
  console.log(`[local-bootstrap] created ${target} from ${template}`);
} else {
  console.log(`[local-bootstrap] ${target} already exists; leaving local values untouched`);
}

for (const dir of ["artifacts/live-certification", ".tmp/local"]) {
  fs.mkdirSync(dir, { recursive: true });
}

console.log("[local-bootstrap] next: npm run local:up && npm run local:seed && npm run local:health");
