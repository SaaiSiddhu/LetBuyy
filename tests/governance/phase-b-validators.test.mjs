import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const validatorCases = [
  {
    validator: "canonical-ledger-only-validator.mjs",
    fixture: {
      path: "services/api-gateway/src/routes/bad-money.ts",
      text: "db.from('wallet_ledger_entries').insert({ amount_minor: 100 });",
    },
    expected: /canonical ledger|Money mutations/i,
  },
  {
    validator: "canonical-ledger-only-validator.mjs",
    fixture: {
      path: "database/supabase/migrations/999_bad_capture.sql",
      text: "CREATE OR REPLACE FUNCTION public.confirm_order_payment_with_ledger(p_order_id uuid, p_provider text, p_provider_payment_id text, p_provider_order_id text DEFAULT NULL::text, p_provider_event_id text DEFAULT NULL::text, p_request_id text DEFAULT NULL::text, p_idempotency_key text DEFAULT NULL::text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN RETURN jsonb_build_object('capture_posted_to_ledger', true); END; $$;",
    },
    expected: /confirm_order_payment_with_ledger body must contain call-adjacent canonical ledger evidence/i,
  },
  {
    validator: "no-self-custody-rail-validator.mjs",
    fixture: {
      path: "services/api-gateway/src/routes/bad-payout.ts",
      text: "export function rail() { return 'razorpayx'; }",
    },
    expected: /self-custody|razorpayx/i,
  },
  {
    validator: "stepup-crypto-validator.mjs",
    fixture: {
      path: "services/api-gateway/src/routes/bad-stepup.ts",
      text: "export function ok(token) { return token.trim().length > 12; }",
    },
    expected: /step-up|weak string/i,
  },
  {
    validator: "identity-sole-issuer-validator.mjs",
    fixture: {
      path: "services/api-gateway/src/routes/bad-auth.ts",
      text: "export const token = new SignJWT({}).setProtectedHeader({ alg: 'HS256' });",
    },
    expected: /token signing outside apps\/identity-platform/i,
  },
  {
    validator: "no-blanket-service-role-validator.mjs",
    fixture: {
      path: "apps/merchant_web/src/lib/bad.ts",
      text: "export const key = process.env.SUPABASE_SERVICE_ROLE_KEY;",
    },
    expected: /service-role/i,
  },
  {
    validator: "no-public-using-true-validator.mjs",
    fixture: {
      path: "database/supabase/migrations/999_bad.sql",
      text: "CREATE POLICY bad ON public.orders FOR ALL TO public USING (true) WITH CHECK (true);",
    },
    expected: /USING true|fail closed/i,
  },
  {
    validator: "rls-force-coverage-validator.mjs",
    fixture: {
      path: "database/supabase/migrations/999_bad.sql",
      text: "CREATE TABLE public.bad_orders (id uuid primary key, site_id uuid not null); ALTER TABLE public.bad_orders ENABLE ROW LEVEL SECURITY;",
    },
    expected: /FORCE ROW LEVEL SECURITY/i,
  },
  {
    validator: "provider-mode-badge-validator.mjs",
    fixture: {
      path: "services/api-gateway/src/routes/bad-provider.ts",
      text: "export const result = { success: true, provider_mode: 'mock' };",
    },
    expected: /mock provider path/i,
  },
  {
    validator: "one-system-per-domain-validator.mjs",
    fixture: {
      path: "services/api-gateway/src/bad-system.ts",
      text: "export const canonicalMoneySystem = 'wallet-v2';",
    },
    expected: /canonical domain authority/i,
  },
  {
    validator: "no-rejected-package-imports-validator.mjs",
    fixture: {
      path: "services/api-gateway/src/bad-import.ts",
      text: "import { x } from '@letbuyy/runtime-composition';",
    },
    expected: /rejected package/i,
  },
  {
    validator: "no-reserved-service-activation-validator.mjs",
    fixture: {
      path: "services/search-service/src/index.ts",
      text: "export default {};",
    },
    expected: /reserved runtime roots/i,
  },
  {
    validator: "no-new-react-sections-validator.mjs",
    fixture: {
      path: "apps/customer_web/src/components/sections/new-section.tsx",
      text: "export default function NewSection() { return null; }",
    },
    expected: /React section registry is frozen/i,
  },
  {
    validator: "token-source-single-validator.mjs",
    fixture: {
      path: "apps/merchant_web/src/tokens.ts",
      text: "export const tokens = { colors: { primary: '#ffffff' } };",
    },
    expected: /token\/color authority/i,
  },
  {
    validator: "shell-single-validator.mjs",
    fixture: {
      path: "apps/merchant_web/src/components/NewAdminShell.tsx",
      text: "export function AdminShell() { return null; }",
    },
    expected: /shell\/navigation primitives/i,
  },
  {
    validator: "meta-no-theater-validator.mjs",
    fixture: {
      path: "scripts/validate-governance.mjs",
      text: "const validators = [\"distributed-runtime-validator.mjs\"];",
    },
    expected: /theater validator fragment/i,
  },
];

function runValidator(validator, fixture) {
  return spawnSync(process.execPath, [path.join("scripts/validators", validator)], {
    cwd: repoRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      LETBUYY_PHASE_B_EXTRA_FILES_JSON: JSON.stringify([fixture]),
    },
  });
}

test("Phase B validators are wired into the gate lane", () => {
  const gate = fs.readFileSync(path.join(repoRoot, "scripts/validate-governance.mjs"), "utf8");
  for (const { validator } of validatorCases) {
    assert.match(gate, new RegExp(`"${validator.replaceAll(".", "\\.")}"`));
  }
});

for (const { validator, fixture, expected } of validatorCases) {
  test(`${validator} rejects its Phase B fixture`, () => {
    const result = runValidator(validator, fixture);
    const output = `${result.stdout}\n${result.stderr}`;

    assert.notEqual(result.status, 0, output);
    assert.match(output, expected);
  });
}
