#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";

const requiredSourceChecks = [
  {
    file: "services/webhook-service/src/index.ts",
    patterns: ["RAZORPAY_WEBHOOK_SECRET", "STRIPE_WEBHOOK_SECRET", "timingSafeEqual", "signature_valid: true"],
  },
  {
    file: "services/api-gateway/src/middleware/rateLimit.ts",
    patterns: ["UPSTASH_REDIS_REST_URL", "RATE_LIMIT_UNAVAILABLE", "authRateLimit"],
  },
  {
    file: "services/api-gateway/src/middleware/security.ts",
    patterns: ["Strict-Transport-Security", "Content-Security-Policy", "errorResponseSanitizer"],
  },
  {
    file: "infrastructure/security/production-security-controls.yaml",
    patterns: ["deploymentSigning", "sbom", "secretScan", "mfa"],
  },
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

for (const check of requiredSourceChecks) {
  const text = fs.readFileSync(check.file, "utf8");
  for (const pattern of check.patterns) {
    assert(text.includes(pattern), `${check.file} is missing required security pattern: ${pattern}`);
  }
}

const secretScan = spawnSync("node", ["scripts/validators/environment-validator.mjs"], { stdio: "inherit" });
assert(secretScan.status === 0, "environment validator failed");

console.log("[security-gates] security source gates passed");
