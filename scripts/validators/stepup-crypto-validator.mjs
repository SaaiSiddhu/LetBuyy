import {
  assertNoOffenders,
  phaseBEntries,
} from "./phase-b-common.mjs";
import { createReporter } from "./governance-common.mjs";

const reporter = createReporter("Step-up crypto validator");

const weakStepUpPatterns = [
  /step[_-]?up[\w.]*\.length\s*[><=]/i,
  /token\.trim\(\)\.length\s*[><=]/i,
  /typeof\s+token\s*===\s*['"]string['"][\s\S]{0,120}length\s*[><=]/i,
  /verified_at[\s\S]{0,160}Date\.parse[\s\S]{0,160}return\s+\{\s*ok:\s*true/i,
  /recorded-gap-step-up-/i,
];

const authorityEntries = phaseBEntries(["services", "database"]);
// Phase-B mutation fixtures override one actual source without modifying disk.
const source = (file) => authorityEntries.filter((entry) => entry.path === file).at(-1)?.text || "";
const requiredSecurityControls = { text: source("services/api-gateway/src/lib/security-controls.ts") };
const securityRoute = { text: source("services/api-gateway/src/routes/security.ts") };
// Inspect the latest forward definition, including later migrations and Phase-B
// override fixtures, so a subsequent unsafe redefinition cannot hide behind340.
function latestFunctionBody(name) {
  const unique = new Map(authorityEntries.map((entry) => [entry.path, entry]));
  const rank = (file) => Number(file.split('/').at(-1).match(/^(\d+)/)?.[1] || 0);
  const entries = [...unique.values()].filter((entry) => entry.path.startsWith('database/supabase/migrations/') && entry.path.endsWith('.sql'))
    .sort((a, b) => rank(a.path) - rank(b.path) || a.path.localeCompare(b.path));
  const pattern = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${name}\\s*\\([\\s\\S]*?\\bAS\\s*(\\$(?:[A-Za-z_][A-Za-z0-9_]*)?\\$)([\\s\\S]*?)\\1\\s*;`, 'gi');
  let body = '';
  for (const entry of entries) {
    pattern.lastIndex = 0;
    for (const match of entry.text.matchAll(pattern)) body = match[2];
  }
  return body;
}
const challengeSql = latestFunctionBody('issue_merchant_step_up_v1');
const refundSql = latestFunctionBody('complete_owned_order_refund_v1');
const verificationSql = latestFunctionBody('verify_merchant_step_up_v1');
const merchantVerifier = source("services/api-gateway/src/lib/merchant-step-up.ts");

reporter.assert(
  requiredSecurityControls?.text.includes("verifySensitiveActionStepUp"),
  "security-controls must expose the shared sensitive-action step-up verifier",
);
reporter.assert(
  requiredSecurityControls?.text.includes("signSensitiveActionStepUp")
    && requiredSecurityControls?.text.includes("HMAC")
    && requiredSecurityControls?.text.includes("STEP_UP_SIGNING_SECRET_REQUIRED"),
  "security-controls must sign sensitive-action step-up tokens with HMAC evidence",
);
reporter.assert(
  /db\.rpc\(['"]issue_merchant_step_up_v1['"]/.test(securityRoute.text)
    && /INSERT INTO public\.step_up_challenges/.test(challengeSql)
    && /INSERT INTO public\.audit_logs[\s\S]*INSERT INTO public\.outbox_events/.test(challengeSql),
  "step-up challenge route must persist challenge evidence and audit/outbox through its canonical RPC",
);
reporter.assert(
  Boolean(securityRoute?.text.includes("verifyTotpCode") && securityRoute?.text.includes("STEP_UP_SIGNING_SECRET")),
  "step-up challenge route must require TOTP proof and a configured signing secret",
);
reporter.assert(
  !securityRoute?.text.includes("recorded-gap-step-up-")
    && !securityRoute?.text.includes("mock-step-up-")
    && !securityRoute?.text.includes("mode: 'mock'")
    && !securityRoute?.text.includes("mode: 'recorded_gap'"),
  "step-up challenge route must not emit recorded-gap or mock-labelled security evidence",
);

reporter.assert(
  challengeSql.includes("pg_advisory_xact_lock") && challengeSql.includes("custom_user_id=p_actor")
    && challengeSql.includes("status='active'") && challengeSql.includes("x.actor_id IS DISTINCT FROM p_actor")
    && challengeSql.includes("merchant_intent_sha256") && challengeSql.includes("factor_sha256")
    && challengeSql.includes("merchant_result_ciphertext"),
  "merchant challenge custody must bind actor, action and live factor with encrypted durable retries",
);
reporter.assert(
  /await verifySensitiveActionStepUp\(input\)/.test(merchantVerifier)
    && /db\.rpc\(['"]verify_merchant_step_up_v1['"]/.test(merchantVerifier)
    && merchantVerifier.includes("token_sha256"),
  "merchant verifier must compose MAC validation with persisted live proof",
);
reporter.assert(
  verificationSql.includes("FROM public.step_up_challenges") && verificationSql.includes("FROM public.merchant_2fa_factors")
    && verificationSql.includes("challenge_token_hash IS DISTINCT FROM")
    && verificationSql.includes("x.verified_at IS DISTINCT FROM v_verified")
    && verificationSql.includes("x.expires_at IS DISTINCT FROM v_expires")
    && verificationSql.includes("status='active'"),
  "persisted proof must bind token, source timestamps and current active factor",
);
const approvalGuard = refundSql.indexOf("IF NOT public.verify_merchant_step_up_v1(");
reporter.assert(
  approvalGuard >= 0 && refundSql.includes("'status',428")
    && approvalGuard < refundSql.indexOf("v_data:=public.complete_order_refund("),
  "refund completion must bind current persisted approval before its canonical monetary writer",
);
for (const route of ["orders", "returns", "payments", "payouts"]) {
  reporter.assert(
    source(`services/api-gateway/src/routes/${route}.ts`).includes("await verifyMerchantStepUp(db,"),
    `${route} refund route must require the shared merchant MAC and persisted proof verifier`,
  );
}
reporter.assert(
  source("services/api-gateway/src/execution/order-execution.adapter.ts").includes("p_intent: { ...input, _step_up: proof }"),
  "refund command must carry server-derived proof into the private SQL boundary",
);

for (const [name, action, writer] of [
  ['reserve_owned_payment_refund_v1', 'refund.approve', 'r:=public.reserve_payment_refund_attempt('],
  ['claim_owned_payout_release_v1', 'payout.release', 'FROM public.claim_payout_statement_release('],
]) {
  const body = latestFunctionBody(name);
  const guard = body.indexOf(`IF NOT public.verify_merchant_step_up_v1(p_site_id,p_actor_id,'${action}',p_step_up)`);
  reporter.assert(guard >= 0 && body.includes("'status',428") && guard < body.indexOf(writer)
      && body.includes('pg_advisory_xact_lock') && body.includes('MONEY_OWNER_REQUIRED'),
    `${name} must bind current owned proof before its canonical money claim`);
}
reporter.assert(source('services/api-gateway/src/routes/payments.ts').includes("db.rpc('reserve_owned_payment_refund_v1'")
    && source('services/api-gateway/src/routes/payouts.ts').includes("db.rpc('claim_owned_payout_release_v1'"),
  'payment refund and payout routes must use the guarded canonical claim RPCs');

const offenders = [];
for (const entry of phaseBEntries(["apps", "services", "packages"])) {
  for (const pattern of weakStepUpPatterns) {
    if (pattern.test(entry.text)) {
      offenders.push(`${entry.path}:1 weak string/timestamp step-up verification is forbidden`);
    }
  }
}

assertNoOffenders(reporter, offenders, "Sensitive refund/payout step-up must be cryptographic or challenge-backed");
reporter.finish("step-up crypto ratchet checked");
