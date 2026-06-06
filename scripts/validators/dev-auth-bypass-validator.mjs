import {
  createReporter,
  readFile,
} from "./governance-common.mjs";

const reporter = createReporter("Dev auth bypass validator");

const signupRoute = readFile("apps/identity-platform/src/app/api/auth/signup/route.ts");
const identityTurnstile = readFile("apps/identity-platform/src/lib/turnstile.ts");
const turnstileWidget = readFile("apps/identity-platform/src/components/TurnstileWidget.tsx");
const consoleAuth = readFile("apps/platform-console/src/lib/console-auth-server.ts");
const envTemplate = readFile("config/env/templates/next-app.env.example");
const envSchema = readFile("config/env/schemas/next-app.schema.json");

reporter.assert(
  signupRoute.includes("devOtp") && signupRoute.includes("canUseIdentityDevAuthBypass(process.env)"),
  "identity signup devOtp echo must be gated by canUseIdentityDevAuthBypass(process.env)",
);
reporter.assert(
  !/process\.env\.NODE_ENV !== 'production'[\s\S]{0,140}devOtp/.test(signupRoute),
  "identity signup must not expose devOtp using only NODE_ENV !== production",
);
reporter.assert(
  /token === 'dev-bypass-token'[\s\S]{0,140}canUseIdentityDevAuthBypass\(process\.env\)/.test(identityTurnstile),
  "identity Turnstile dev-bypass-token must require canUseIdentityDevAuthBypass(process.env)",
);
reporter.assert(
  !/TURNSTILE_SECRET_KEY not set[\s\S]{0,180}return true/.test(identityTurnstile),
  "identity Turnstile missing-secret path must fail closed",
);
reporter.assert(
  turnstileWidget.includes("NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS")
    && turnstileWidget.includes("canUseClientDevAuthBypass()")
    && !/if \(!siteKey\) \{\s*onVerifyRef\.current\('dev-bypass-token'\)/.test(turnstileWidget),
  "identity Turnstile widget must emit dev-bypass-token only behind explicit client dev bypass",
);
reporter.assert(
  consoleAuth.includes("canUseConsoleDevMfaBypass()")
    && consoleAuth.includes("LETBUYY_ENABLE_DEV_AUTH_BYPASS")
    && !/process\.env\.NODE_ENV !== 'production' && devCode/.test(consoleAuth),
  "platform console dev MFA code must require explicit development-only bypass",
);
reporter.assert(
  envTemplate.includes("LETBUYY_ENABLE_DEV_AUTH_BYPASS=false")
    && envTemplate.includes("NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS=false"),
  "Next app env template must default dev auth bypass flags to false",
);
reporter.assert(
  envSchema.includes('"LETBUYY_ENABLE_DEV_AUTH_BYPASS"')
    && envSchema.includes('"NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS"'),
  "Next app env schema must document dev auth bypass flags",
);

reporter.finish("identity and console dev auth bypasses checked");
