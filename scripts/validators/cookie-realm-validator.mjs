import path from "node:path";
import {
  createReporter,
  listWorkspaceFiles,
  readFile,
  sourceExtensions,
} from "./governance-common.mjs";

const reporter = createReporter("Cookie realm validator");

const storefrontFiles = listWorkspaceFiles(["apps/storefront-runtime/src"])
  .filter((file) => sourceExtensions.has(path.extname(file)) && !file.endsWith(".d.ts"));
const platformCookieFiles = [
  "apps/identity-platform/src/lib/auth/cookies.ts",
  "apps/merchant-control-plane/src/app/api/auth/logout/route.ts",
];

for (const file of storefrontFiles) {
  const source = readFile(file);
  const writesCookie = /cookies(?:\(\))?\.set|response\.cookies\.set|Set-Cookie/i.test(source);
  reporter.assert(
    !writesCookie || !/\bdomain\s*:/.test(source),
    `${file} must not set a cookie domain; storefront cookies are host-only`,
  );
  reporter.assert(
    !/Domain=\.letbuyy\.(?:store|com)/i.test(source),
    `${file} must not emit a storefront cookie Domain attribute`,
  );
}

for (const file of platformCookieFiles) {
  const source = readFile(file);
  reporter.assert(
    /process\.env\.COOKIE_DOMAIN/.test(source),
    `${file} must read the platform cookie domain from process.env.COOKIE_DOMAIN`,
  );
}

const identityCookieSource = readFile("apps/identity-platform/src/lib/auth/cookies.ts");
reporter.assert(
  !/\.letbuyy\.com/.test(identityCookieSource),
  "identity-platform cookie helper must not hardcode the future platform cookie domain",
);

const authCoreSource = readFile("packages/auth-core/src/storefront-access.ts");
reporter.assert(
  /LETBUYY_STOREFRONT_GATE_COOKIE\s*=\s*['"]__Host-/.test(authCoreSource),
  "auth-core must own a __Host- storefront gate cookie constant",
);

reporter.finish(`${storefrontFiles.length} storefront source files checked for host-only cookie realm`);
