const provider = process.env.CHAOS_PROVIDER || "stripe";
const operation = process.env.CHAOS_OPERATION || "checkout.create-session";

console.info(JSON.stringify({
  level: "info",
  scenario: "provider-outage",
  provider,
  operation,
  expected_validation: [
    "provider circuit breaker opens",
    "checkout runtime enters degraded mode",
    "provider recovery plan is recorded",
    "incident severity is assigned from impact",
  ],
}));
