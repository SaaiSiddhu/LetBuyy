#!/usr/bin/env node
import { dockerComposeArgs, ensureDockerAvailable, run } from "./common.mjs";

const endpoints = [
  ["provider-sandbox", "http://localhost:8088/health"],
  ["mail-sandbox", "http://localhost:8025/api/v1/info"],
  ["feature-flags", "http://localhost:8081/health"],
  ["replay-runtime", "http://localhost:8091/health"],
  ["otel-collector", "http://localhost:13133"],
  ["prometheus", "http://localhost:9090/-/ready"],
  ["grafana", "http://localhost:3009/api/health"],
  ["loki", "http://localhost:3100/ready"],
  ["tempo", "http://localhost:3200/ready"],
];

ensureDockerAvailable();
run("docker", dockerComposeArgs(["ps"]));

for (const [name, url] of endpoints) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${name} health check failed: ${url} returned ${response.status}`);
  }
  console.log(`[local-health] ${name} ${response.status}`);
}

console.log("[local-health] local lifecycle stack is healthy");
