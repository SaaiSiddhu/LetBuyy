#!/usr/bin/env node

export const REQUIRED_SHARED_ENV_SECRETS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'AUTH_SECRET',
  'CSRF_SECRET',
  'INTERNAL_API_SECRET',
  'LETBUYY_INTERNAL_API_SECRET',
  'PREVIEW_SIGNING_KEY',
  'STORE_ACCESS_SIGNING_KEY',
  'PAYMENT_CONFIG_ENCRYPTION_KEY',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
];

export const REQUIRED_SHARED_ENV_EVIDENCE_FLAGS = [
  'RATE_LIMIT_BACKEND_READY',
  'RUNTIME_TELEMETRY_READY',
  'MONEY_LEDGER_RECONCILIATION_ALERT_READY',
];

function configuredValue(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('SKIP_NEEDS_HUMAN_')) return false;
  if (trimmed === 'replace-with-worker-secret') return false;
  if (trimmed === 'replace-with-provider-secret') return false;
  return true;
}

function enabledFlag(value) {
  return ['1', 'true', 'yes', 'on', 'ready'].includes(String(value || '').trim().toLowerCase());
}

function sharedEnvironment(env) {
  return String(env.DEPLOYMENT_ENV || env.ENVIRONMENT || env.APP_ENV || '').trim().toLowerCase();
}

export function evaluateProductionSafetyPreflight(env = process.env) {
  const issues = [];
  const deploymentEnv = sharedEnvironment(env);

  if (!['staging', 'production'].includes(deploymentEnv)) {
    issues.push({
      code: 'SHARED_ENV_REQUIRED',
      key: 'DEPLOYMENT_ENV',
      message: 'Production safety preflight only applies to staging or production shared environments.',
    });
  }

  for (const key of REQUIRED_SHARED_ENV_SECRETS) {
    if (!configuredValue(env[key])) {
      issues.push({
        code: 'SECRET_NOT_READY',
        key,
        message: `${key} must be configured in the provider secret store and must not be a SKIP_NEEDS_HUMAN sentinel.`,
      });
    }
  }

  for (const key of REQUIRED_SHARED_ENV_EVIDENCE_FLAGS) {
    if (!enabledFlag(env[key])) {
      issues.push({
        code: 'EVIDENCE_NOT_READY',
        key,
        message: `${key} must be true/ready before shared-env Wave 1 cutovers run.`,
      });
    }
  }

  return {
    ok: issues.length === 0,
    environment: deploymentEnv || 'unknown',
    issues,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = evaluateProductionSafetyPreflight();
  if (!result.ok) {
    console.error(`Production safety preflight failed for ${result.environment}.`);
    for (const issue of result.issues) {
      console.error(`- ${issue.code}: ${issue.key} — ${issue.message}`);
    }
    process.exit(1);
  }

  console.log(`Production safety preflight passed for ${result.environment}.`);
}
