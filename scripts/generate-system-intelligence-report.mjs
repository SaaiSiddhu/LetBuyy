import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const now = new Date().toISOString();
const reportPath = path.join(root, "docs/architecture/SYSTEM_INTELLIGENCE_REPORT.md");
const validationDir = path.join(root, "docs/architecture/validation");

const ignoreDirs = new Set([
  ".git",
  "node_modules",
  ".next",
  ".turbo",
  ".dart_tool",
  "build",
  "dist",
  ".wrangler",
  ".symlinks",
  "Pods",
  ".idea",
]);

const textExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".tf",
  ".md",
  ".css",
  ".scss",
  ".sql",
  ".dart",
  ".html",
  ".xml",
  ".plist",
  ".kts",
  ".gradle",
  ".properties",
  ".lock",
  ".env",
  ".example",
  ".gitignore",
  ".npmrc",
]);

const sourceExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".dart",
  ".sql",
  ".css",
  ".json",
  ".toml",
  ".yaml",
  ".yml",
  ".tf",
  ".md",
  ".kts",
  ".gradle",
  ".properties",
]);

const generatedOutputFiles = new Set([
  "docs/architecture/SYSTEM_INTELLIGENCE_REPORT.md",
  "docs/architecture/master-system-intelligence.md",
  "docs/architecture/repository-intelligence-report.json",
]);

const appTargets = [
  ["Accounts", "apps/web/consumer/accounts", "Merchant identity, auth, signup, onboarding, store selection."],
  ["Admin", "apps/web/consumer/admin", "Per-store merchant dashboard and CMS/commerce operations."],
  ["Storefront", "apps/web/consumer/storefront", "Public tenant storefront rendering, catalog, cart, checkout, customer account, theme previews."],
  ["Landing", "apps/web/consumer/landing", "Public marketing and pricing application."],
  ["App Store", "apps/web/consumer/app-store", "Extension marketplace and developer app submission UI."],
  ["Theme Marketplace", "apps/web/consumer/theme-marketplace", "Theme catalog, details, acquisition, and marketplace flows."],
  ["Console", "apps/web/administrative/console", "Super-admin platform operations scaffold."],
  ["Team", "apps/web/administrative/team", "Internal employee/support operations scaffold."],
  ["Flutter Builder", "apps/flutter/builder", "Native/mobile store builder and merchant operations."],
  ["Flutter Super Admin", "apps/flutter/super_admin", "Native super-admin scaffold."],
  ["Flutter Team", "apps/flutter/team", "Native employee portal scaffold."],
  ["Merchant Alias", "apps/merchant", "Alias AGENTS target for merchant/admin ownership."],
  ["Storefront Alias", "apps/storefront", "Alias AGENTS target for storefront ownership."],
  ["Internal Alias", "apps/internal", "Alias AGENTS target for administrative apps."],
];

const packageTargets = [
  ["TypeScript UI", "packages/typescript/ui", "Shared web UI components."],
  ["TypeScript Utils", "packages/typescript/utils", "Shared Supabase/API/auth utilities."],
  ["API Types", "packages/typescript/api-types", "Shared TypeScript domain/API contracts."],
  ["Dart Core", "packages/dart/core", "Shared Flutter constants/config/responsive utilities."],
  ["Dart Models", "packages/dart/models", "Shared Dart commerce/domain models."],
  ["Dart Services", "packages/dart/services", "Shared Dart data/payment/analytics/order/auth/storage services."],
  ["Dart UI Kit", "packages/dart/ui_kit", "Shared Flutter widgets/themes/states."],
  ["UI Alias", "packages/ui", "Alias AGENTS target for shared UI."],
  ["DB Alias", "packages/db", "Alias AGENTS target for Supabase schema ownership."],
  ["API Alias", "packages/api", "Alias AGENTS target for Hono API worker ownership."],
  ["Shared Alias", "packages/shared", "Alias AGENTS target for cross-runtime contracts."],
  ["Config Alias", "packages/config", "Alias AGENTS target for workspace/deployment config."],
  ["Auth Alias", "packages/auth", "Alias AGENTS target for shared identity governance."],
  ["Analytics Alias", "packages/analytics", "Alias AGENTS target for analytics contracts."],
  ["Payments Alias", "packages/payments", "Alias AGENTS target for payment governance."],
];

function toPosix(filePath) {
  return filePath.split(path.sep).join("/");
}

function rel(filePath) {
  return toPosix(path.relative(root, filePath));
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoreDirs.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(abs, results);
    else results.push(abs);
  }
  return results;
}

function isTextFile(filePath) {
  const base = path.basename(filePath);
  const ext = path.extname(filePath);
  return textExtensions.has(ext) || textExtensions.has(base);
}

function isSourceFile(file) {
  const ext = path.extname(file);
  const base = path.basename(file);
  return sourceExtensions.has(ext) || sourceExtensions.has(base);
}

function readText(abs) {
  try {
    const stat = fs.statSync(abs);
    if (stat.size > 4_000_000 && !abs.endsWith(".log")) return "";
    return fs.readFileSync(abs, "utf8");
  } catch {
    return "";
  }
}

function safeJson(relPath) {
  try {
    return JSON.parse(readText(path.join(root, relPath)));
  } catch {
    return null;
  }
}

function lineCount(text) {
  return text ? text.split(/\r?\n/).length : 0;
}

function countMatches(text, regex) {
  return [...text.matchAll(regex)].length;
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)));
}

function sha(text) {
  return crypto.createHash("sha1").update(text || "").digest("hex").slice(0, 12);
}

function redact(text) {
  return String(text)
    .replace(/AIza[A-Za-z0-9_-]+/g, "AIza[REDACTED]")
    .replace(/(sk_(?:live|test)_[A-Za-z0-9_=-]+)/g, "sk_[REDACTED]")
    .replace(/(pk_(?:live|test)_[A-Za-z0-9_=-]+)/g, "pk_[REDACTED]")
    .replace(/(whsec_[A-Za-z0-9_=-]+)/g, "whsec_[REDACTED]")
    .replace(/(rzp_(?:live|test)_[A-Za-z0-9_=-]+)/g, "rzp_[REDACTED]")
    .replace(/(Bearer\s+)[A-Za-z0-9._~+/=-]{16,}/gi, "$1[REDACTED]")
    .replace(/((?:secret|token|password|private[_-]?key|service[_-]?role)[A-Z0-9_ .:-]*[=:]\s*)['"]?[^'"\s,}]+['"]?/gi, "$1[REDACTED]")
    .replace(/((?:SUPABASE_SERVICE_ROLE_KEY|UPSTASH_REDIS_REST_TOKEN|RESEND_API_KEY|RAZORPAY_KEY_SECRET|AUTH_SECRET|CSRF_SECRET|CUSTOMER_SESSION_SECRET)\s*[=:]\s*)['"]?[^'"\s,}]+['"]?/g, "$1[REDACTED]")
    .replace(/[ \t]+$/gm, "");
}

function firstNonEmptyLines(text, count = 5) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("//") && !line.startsWith("/*") && !line.startsWith("*"))
    .slice(0, count)
    .map(redact);
}

function routeFromNextAppFile(file) {
  const marker = "/src/app/";
  if (!file.includes(marker)) return null;
  const after = file.split(marker)[1];
  const fileName = path.basename(after);
  if (!["page.tsx", "layout.tsx", "route.ts", "loading.tsx", "error.tsx", "not-found.tsx", "template.tsx"].includes(fileName)) return null;
  const dir = path.dirname(after);
  const segments = dir === "." ? [] : dir.split("/");
  const publicSegments = segments.filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));
  const route = `/${publicSegments.join("/")}`.replace(/\/+/g, "/");
  return { kind: fileName.replace(/\.(tsx|ts)$/, ""), route: route === "/" ? "/" : route.replace(/\/$/, "") };
}

function appRootForFile(file) {
  for (const [, target] of appTargets) {
    if (file === target || file.startsWith(`${target}/`)) return target;
  }
  if (file.startsWith("backend/workers/api/")) return "backend/workers/api";
  if (file.startsWith("backend/workers/webhooks/")) return "backend/workers/webhooks";
  if (file.startsWith("backend/supabase/")) return "backend/supabase";
  if (file.startsWith("infrastructure/")) return "infrastructure";
  if (file.startsWith("docs/")) return "docs";
  if (file.startsWith("memory/")) return "memory";
  if (file.startsWith("tasks/")) return "tasks";
  return ".";
}

function packageRootForFile(file) {
  for (const [, target] of packageTargets) {
    if (file === target || file.startsWith(`${target}/`)) return target;
  }
  return null;
}

function classifyArea(file) {
  const lower = file.toLowerCase();
  if (lower.includes("auth") || lower.includes("login") || lower.includes("signup") || lower.includes("session") || lower.includes("oauth")) return "auth";
  if (lower.includes("payment") || lower.includes("checkout") || lower.includes("razorpay") || lower.includes("stripe") || lower.includes("paypal")) return "payments-checkout";
  if (lower.includes("storefront") || lower.includes("/store/") || lower.includes("subdomain")) return "storefront";
  if (lower.includes("theme")) return "themes";
  if (lower.includes("analytics") || lower.includes("event")) return "analytics";
  if (lower.includes("worker") || lower.includes("wrangler") || lower.includes("hono")) return "workers";
  if (lower.includes("migration") || lower.includes("supabase") || lower.endsWith(".sql")) return "database";
  if (lower.includes("middleware")) return "middleware";
  if (lower.includes("flutter") || lower.endsWith(".dart")) return "flutter";
  if (lower.includes("component") || lower.includes("ui") || lower.includes("globals.css")) return "ui-design";
  if (lower.includes("config") || lower.includes("package.json") || lower.includes("tsconfig") || lower.includes("vercel") || lower.includes("terraform") || lower.endsWith(".toml")) return "config";
  if (lower.includes("api") || lower.includes("route.ts")) return "api";
  return "application";
}

function extractImports(text, ext) {
  const imports = [];
  if ([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"].includes(ext)) {
    for (const match of text.matchAll(/import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g)) imports.push(match[1]);
    for (const match of text.matchAll(/require\(["']([^"']+)["']\)/g)) imports.push(match[1]);
  }
  if (ext === ".dart") {
    for (const match of text.matchAll(/import\s+['"]([^'"]+)['"]/g)) imports.push(match[1]);
  }
  return unique(imports);
}

function extractEnvNames(text) {
  const names = [];
  for (const match of text.matchAll(/process\.env\.([A-Z0-9_]+)/g)) names.push(match[1]);
  for (const match of text.matchAll(/env\.([A-Z0-9_]+)/g)) names.push(match[1]);
  for (const match of text.matchAll(/(?:var|secret|binding)\s*=\s*"([A-Z0-9_]+)"/gi)) names.push(match[1]);
  for (const match of text.matchAll(/\b([A-Z][A-Z0-9_]{3,})\b/g)) {
    if (match[1].includes("_") && /(KEY|SECRET|TOKEN|URL|ID|ENV|DSN|BUCKET|DATABASE|SUPABASE|REDIS|RAZORPAY|STRIPE|PAYPAL|RESEND|TURNSTILE|CLOUDFLARE)/.test(match[1])) names.push(match[1]);
  }
  return unique(names);
}

function extractNextHandlers(text) {
  return unique([...text.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map((match) => match[1]));
}

function extractHonoRoutes(text) {
  const routes = [];
  for (const match of text.matchAll(/(?:app|router|routes|api|storefrontRoutes|authRoutes|adminRoutes|[A-Za-z0-9_]+Routes|[A-Za-z0-9_]+Router)\.(get|post|put|patch|delete|all|options)\(\s*["'`]([^"'`]+)["'`]/gi)) {
    routes.push({ method: match[1].toUpperCase(), path: match[2] });
  }
  return routes;
}

function extractHonoMounts(text) {
  const mounts = [];
  for (const match of text.matchAll(/app\.route\(\s*["'`]([^"'`]+)["'`]\s*,\s*([A-Za-z0-9_]+)/g)) {
    mounts.push({ path: match[1], router: match[2] });
  }
  return mounts;
}

function extractDbRefs(text) {
  const refs = [];
  for (const match of text.matchAll(/\.from\(\s*["'`]([^"'`]+)["'`]\s*\)/g)) refs.push(match[1]);
  for (const match of text.matchAll(/\bfrom\s+([a-zA-Z_][\w."]+)/gi)) refs.push(match[1].replaceAll('"', ""));
  for (const match of text.matchAll(/\bjoin\s+([a-zA-Z_][\w."]+)/gi)) refs.push(match[1].replaceAll('"', ""));
  for (const match of text.matchAll(/\b(?:insert\s+into|update|delete\s+from)\s+([a-zA-Z_][\w."]+)/gi)) refs.push(match[1].replaceAll('"', ""));
  return unique(refs.filter((name) => !["select", "where", "set"].includes(name.toLowerCase())));
}

function extractExports(text) {
  const names = [];
  for (const match of text.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type)\s+([A-Za-z0-9_]+)/g)) names.push(match[1]);
  for (const match of text.matchAll(/class\s+([A-Za-z0-9_]+)/g)) names.push(match[1]);
  return unique(names);
}

function extractColorTokens(text) {
  return unique([
    ...[...text.matchAll(/#[0-9A-Fa-f]{3,8}\b/g)].map((m) => m[0]),
    ...[...text.matchAll(/\b(?:bg|text|border|from|to|via|ring|fill|stroke)-[a-z]+-[0-9]{2,3}\b/g)].map((m) => m[0]),
    ...[...text.matchAll(/\b(?:rgb|rgba|hsl|hsla)\([^)]+\)/g)].map((m) => m[0]),
  ]);
}

function flagsFor(file, text) {
  const flags = [];
  const checks = [
    ["client component", /^["']use client["'];?/m],
    ["server directive", /^["']use server["'];?/m],
    ["uses localStorage", /\blocalStorage\b/],
    ["uses sessionStorage", /\bsessionStorage\b/],
    ["inline React style", /style=\{\{/],
    ["console output", /console\.(log|debug|info|warn|error)|\bprint\(/],
    ["TypeScript any", /\bany\b|as any|: any|Record<string, any>/],
    ["TODO/FIXME/HACK", /\b(TODO|FIXME|HACK|XXX|BUG|DEBT)\b/i],
    ["service role reference", /SERVICE_ROLE|service_role/i],
    ["hardcoded payment key id", /rzp_(?:live|test)_[A-Za-z0-9]+|pk_(?:live|test)_[A-Za-z0-9]+|sk_(?:live|test)_[A-Za-z0-9]+/],
    ["Supabase client", /createClient|supabase\./],
    ["Zod validation", /\bz\./],
    ["tenant/store identifier", /\b(site_id|store_id|subdomain|tenant|storeSlug|store_name)\b/i],
    ["payment provider", /\b(razorpay|stripe|paypal|payment|checkout)\b/i],
    ["auth/session", /\b(jwt|cookie|session|oauth|auth|login|signup|password)\b/i],
    ["cache/revalidate", /\b(cache|revalidate|unstable_cache|Cache-Control|kv|redis)\b/i],
    ["form handling", /\b(form|FormData|useForm|onSubmit|input|textarea|select)\b/i],
    ["table/list UI", /\b(table|DataTable|pagination|filter|search|sort)\b/i],
    ["chart/analytics UI", /\b(chart|analytics|metric|revenue|conversion|fl_chart|recharts)\b/i],
    ["loading state", /\b(loading|skeleton|spinner|isLoading|Loading)\b/],
    ["error state", /\b(error|catch|ErrorBoundary|retry|try\s*\{)\b/],
  ];
  for (const [label, regex] of checks) {
    if (regex.test(text)) flags.push(label);
  }
  if (file.endsWith("/route.ts")) flags.push("Next API route");
  if (file.startsWith("backend/workers/")) flags.push("Cloudflare Worker surface");
  if (file.endsWith(".sql")) flags.push("SQL migration/schema");
  if (file.endsWith(".dart")) flags.push("Dart/Flutter source");
  return unique(flags);
}

function summarizeFile(file) {
  const abs = path.join(root, file);
  const text = readText(abs);
  const ext = path.extname(file) || path.basename(file);
  const stat = fs.statSync(abs);
  const nextRoute = routeFromNextAppFile(file);
  return {
    file,
    ext,
    bytes: stat.size,
    lines: lineCount(text),
    hash: sha(text),
    area: classifyArea(file),
    appRoot: appRootForFile(file),
    packageRoot: packageRootForFile(file),
    imports: extractImports(text, ext),
    envNames: extractEnvNames(text),
    nextRoute,
    nextHandlers: extractNextHandlers(text),
    honoRoutes: extractHonoRoutes(text),
    honoMounts: extractHonoMounts(text),
    dbRefs: extractDbRefs(text),
    exports: extractExports(text),
    colorTokens: extractColorTokens(text),
    flags: flagsFor(file, text),
    leading: firstNonEmptyLines(text),
    counts: {
      todos: countMatches(text, /\b(TODO|FIXME|HACK|XXX|BUG|DEBT)\b/gi),
      any: countMatches(text, /\bany\b|as any|: any|Record<string, any>/g),
      console: countMatches(text, /console\.(log|debug|info|warn|error)|\bprint\(/g),
      inlineStyles: countMatches(text, /style=\{\{/g),
      localStorage: countMatches(text, /\blocalStorage\b/g),
      fetchCalls: countMatches(text, /\bfetch\(/g),
      supabaseFrom: countMatches(text, /\.from\(/g),
      zod: countMatches(text, /\bz\./g),
      colors: extractColorTokens(text).length,
    },
  };
}

function summarizePackage(file) {
  const json = safeJson(file);
  if (!json) return null;
  const deps = {
    dependencies: Object.keys(json.dependencies || {}),
    devDependencies: Object.keys(json.devDependencies || {}),
    peerDependencies: Object.keys(json.peerDependencies || {}),
    optionalDependencies: Object.keys(json.optionalDependencies || {}),
  };
  return {
    file,
    name: json.name || path.dirname(file),
    version: json.version || "none",
    private: Boolean(json.private),
    scripts: Object.keys(json.scripts || {}),
    deps,
    allDeps: unique(Object.values(deps).flat()),
    raw: json,
  };
}

function summarizePubspec(file) {
  const text = readText(path.join(root, file));
  const name = (text.match(/^name:\s*([^\n]+)/m) || [])[1]?.trim() || path.dirname(file);
  const version = (text.match(/^version:\s*([^\n]+)/m) || [])[1]?.trim() || "none";
  const sdk = (text.match(/sdk:\s*['"]?([^'"\n]+)['"]?/m) || [])[1]?.trim() || "not declared";
  const deps = [];
  const pathDeps = [];
  const lines = text.split(/\r?\n/);
  let section = null;
  let currentDep = null;
  for (const line of lines) {
    const top = line.match(/^([a-zA-Z0-9_]+):\s*$/);
    if (top) {
      section = top[1];
      currentDep = null;
      continue;
    }
    if (!["dependencies", "dev_dependencies", "dependency_overrides"].includes(section)) continue;
    const dep = line.match(/^\s{2}([a-zA-Z0-9_]+):(?:\s*(.+))?$/);
    if (dep) {
      currentDep = dep[1];
      deps.push(currentDep);
      continue;
    }
    const depPath = line.match(/^\s{4}path:\s*([^\n]+)/);
    if (depPath && currentDep) {
      pathDeps.push({ name: currentDep, path: depPath[1].trim() });
    }
  }
  return { file, name, version, sdk, deps: unique(deps), pathDeps };
}

function splitSqlColumns(body) {
  const result = [];
  let current = "";
  let depth = 0;
  for (const char of body) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) result.push(current.trim());
  return result;
}

function parseSqlMigrations(migrationFiles) {
  const tables = new Map();
  const indexes = [];
  const policies = [];
  const triggers = [];
  const functions = [];
  const rls = new Set();
  const alters = [];
  const references = [];

  for (const file of migrationFiles) {
    const text = readText(path.join(root, file));
    for (const match of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w."]+)\s*\(([\s\S]*?)\);/gi)) {
      const table = match[1].replaceAll('"', "");
      const body = match[2];
      const fields = [];
      const constraints = [];
      for (const part of splitSqlColumns(body)) {
        const cleaned = part.replace(/\s+/g, " ").trim();
        if (!cleaned) continue;
        if (/^(constraint|primary key|foreign key|unique|check)\b/i.test(cleaned)) {
          constraints.push(redact(cleaned));
          const ref = cleaned.match(/references\s+([\w."]+)/i);
          if (ref) references.push({ table, target: ref[1].replaceAll('"', ""), file, line: cleaned });
          continue;
        }
        const name = (cleaned.match(/^"?([A-Za-z_][\w]*)"?\s+(.+)$/) || [])[1];
        const rest = (cleaned.match(/^"?[A-Za-z_][\w]*"?\s+(.+)$/) || [])[1] || "";
        if (!name) continue;
        const ref = cleaned.match(/references\s+([\w."]+)/i);
        if (ref) references.push({ table, column: name, target: ref[1].replaceAll('"', ""), file });
        fields.push({
          name,
          definition: redact(rest),
          nullable: !/\bnot\s+null\b/i.test(rest) && !/\bprimary\s+key\b/i.test(rest),
          primary: /\bprimary\s+key\b/i.test(rest),
          references: ref ? ref[1].replaceAll('"', "") : null,
        });
      }
      tables.set(table, { name: table, createdIn: file, fields, constraints, alters: [], indexes: [], policies: [], rls: false, triggers: [] });
    }

    for (const match of text.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?([\w."]+)\s+([\s\S]*?);/gi)) {
      const table = match[1].replaceAll('"', "");
      const statement = redact(match[2].replace(/\s+/g, " ").trim());
      alters.push({ table, file, statement });
      if (/enable\s+row\s+level\s+security/i.test(statement)) rls.add(table);
      if (!tables.has(table)) tables.set(table, { name: table, createdIn: "not detected in migrations", fields: [], constraints: [], alters: [], indexes: [], policies: [], rls: false, triggers: [] });
      tables.get(table).alters.push({ file, statement });
    }

    for (const match of text.matchAll(/create\s+(unique\s+)?index\s+(?:if\s+not\s+exists\s+)?([\w"]+)\s+on\s+([\w."]+)\s*([\s\S]*?);/gi)) {
      indexes.push({ unique: Boolean(match[1]), name: match[2].replaceAll('"', ""), table: match[3].replaceAll('"', ""), definition: redact(match[4].replace(/\s+/g, " ").trim()), file });
    }

    for (const match of text.matchAll(/create\s+policy\s+"?([^"\n]+)"?\s+on\s+([\w."]+)([\s\S]*?);/gi)) {
      policies.push({ name: match[1].trim(), table: match[2].replaceAll('"', ""), definition: redact(match[3].replace(/\s+/g, " ").trim()), file });
    }

    for (const match of text.matchAll(/create\s+(?:or\s+replace\s+)?function\s+([\w."]+)/gi)) {
      functions.push({ name: match[1].replaceAll('"', ""), file });
    }

    for (const match of text.matchAll(/create\s+trigger\s+([\w"]+)([\s\S]*?)on\s+([\w."]+)/gi)) {
      triggers.push({ name: match[1].replaceAll('"', ""), table: match[3].replaceAll('"', ""), definition: redact(match[2].replace(/\s+/g, " ").trim()), file });
    }
  }

  for (const table of tables.values()) {
    table.indexes = indexes.filter((index) => index.table === table.name);
    table.policies = policies.filter((policy) => policy.table === table.name);
    table.triggers = triggers.filter((trigger) => trigger.table === table.name);
    table.rls = rls.has(table.name);
  }

  return {
    tables: [...tables.values()].sort((a, b) => a.name.localeCompare(b.name)),
    indexes,
    policies,
    triggers,
    functions: unique(functions.map((fn) => `${fn.name} (${fn.file})`)),
    references,
    alters,
    rlsTables: [...rls].sort(),
  };
}

function localDependencyGraph(packages) {
  const names = new Map(packages.map((pkg) => [pkg.name, pkg.file]));
  return packages.map((pkg) => ({
    name: pkg.name,
    file: pkg.file,
    localDeps: pkg.allDeps.filter((dep) => names.has(dep)),
    externalDeps: pkg.allDeps.filter((dep) => !names.has(dep)),
  }));
}

function buildRouteCatalog(fileSummaries) {
  const next = fileSummaries
    .filter((summary) => summary.nextRoute)
    .map((summary) => ({
      type: summary.file.endsWith("/route.ts") ? "Next API" : "Next screen",
      file: summary.file,
      route: summary.nextRoute.route,
      kind: summary.nextRoute.kind,
      methods: summary.nextHandlers,
      appRoot: summary.appRoot,
      flags: summary.flags,
      dbRefs: summary.dbRefs,
      envNames: summary.envNames,
    }));

  const hono = fileSummaries
    .filter((summary) => summary.honoRoutes.length || summary.honoMounts.length || summary.file === "backend/workers/api/src/index.ts")
    .flatMap((summary) => {
      const routes = summary.honoRoutes.map((route) => ({
        type: "Hono route",
        file: summary.file,
        route: route.path,
        method: route.method,
        appRoot: summary.appRoot,
        flags: summary.flags,
        dbRefs: summary.dbRefs,
        envNames: summary.envNames,
      }));
      const mounts = summary.honoMounts.map((mount) => ({
        type: "Hono mount",
        file: summary.file,
        route: mount.path,
        method: "MOUNT",
        router: mount.router,
        appRoot: summary.appRoot,
        flags: summary.flags,
        dbRefs: summary.dbRefs,
        envNames: summary.envNames,
      }));
      return [...routes, ...mounts];
    });
  return { next, hono };
}

function screenCatalog(fileSummaries) {
  const nextScreens = fileSummaries
    .filter((summary) => summary.nextRoute && summary.file.endsWith("/page.tsx"))
    .map((summary) => ({
      platform: "Next.js",
      file: summary.file,
      route: summary.nextRoute.route,
      appRoot: summary.appRoot,
      purpose: purposeFromPath(summary.file),
      apis: extractApiHints(summary),
      auth: authPosture(summary),
      permissions: permissionPosture(summary),
      forms: summary.flags.includes("form handling"),
      tables: summary.flags.includes("table/list UI"),
      loading: summary.flags.includes("loading state"),
      errors: summary.flags.includes("error state"),
      charts: summary.flags.includes("chart/analytics UI"),
      filtering: /filter|search|sort/i.test(summary.file + summary.leading.join(" ")),
      actions: actionHints(summary),
      design: designPosture(summary),
      performance: performancePosture(summary),
      debt: debtPosture(summary),
    }));

  const flutterScreens = fileSummaries
    .filter((summary) => summary.file.endsWith(".dart") && /\/lib\/(screens|pages)\//.test(summary.file))
    .map((summary) => ({
      platform: "Flutter",
      file: summary.file,
      route: inferFlutterRoute(summary),
      appRoot: summary.appRoot,
      purpose: purposeFromPath(summary.file),
      apis: extractApiHints(summary),
      auth: authPosture(summary),
      permissions: permissionPosture(summary),
      forms: summary.flags.includes("form handling"),
      tables: summary.flags.includes("table/list UI"),
      loading: summary.flags.includes("loading state"),
      errors: summary.flags.includes("error state"),
      charts: summary.flags.includes("chart/analytics UI"),
      filtering: /filter|search|sort/i.test(summary.file + summary.leading.join(" ")),
      actions: actionHints(summary),
      design: designPosture(summary),
      performance: performancePosture(summary),
      debt: debtPosture(summary),
    }));
  return [...nextScreens, ...flutterScreens].sort((a, b) => `${a.platform}:${a.file}`.localeCompare(`${b.platform}:${b.file}`));
}

function purposeFromPath(file) {
  const lower = file.toLowerCase();
  if (lower.includes("checkout")) return "checkout and order payment flow";
  if (lower.includes("cart")) return "cart management flow";
  if (lower.includes("product")) return "product catalog or product management flow";
  if (lower.includes("order")) return "order management or order history flow";
  if (lower.includes("customer")) return "customer account or customer management flow";
  if (lower.includes("analytics")) return "analytics and metrics flow";
  if (lower.includes("theme")) return "theme browsing, preview, or editing flow";
  if (lower.includes("setting")) return "store/account/settings flow";
  if (lower.includes("login")) return "login flow";
  if (lower.includes("signup")) return "signup flow";
  if (lower.includes("onboarding")) return "onboarding flow";
  if (lower.includes("dashboard")) return "dashboard overview flow";
  if (lower.includes("portfolio")) return "portfolio site management flow";
  if (lower.includes("resume")) return "resume site management flow";
  if (lower.includes("blog")) return "blog/content management flow";
  if (lower.includes("inventory")) return "inventory management flow";
  return "application screen inferred from route and imports";
}

function extractApiHints(summary) {
  const hints = [];
  if (summary.counts.fetchCalls) hints.push(`${summary.counts.fetchCalls} fetch() calls`);
  if (summary.counts.supabaseFrom) hints.push(`${summary.counts.supabaseFrom} Supabase table calls`);
  if (summary.dbRefs.length) hints.push(`DB refs: ${summary.dbRefs.join(", ")}`);
  if (summary.imports.some((item) => item.includes("service"))) hints.push(`service imports: ${summary.imports.filter((item) => item.includes("service")).slice(0, 4).join(", ")}`);
  return hints.length ? hints.join("; ") : "no direct API call detected by static scan";
}

function authPosture(summary) {
  if (summary.flags.includes("auth/session")) return "auth/session terms detected in file";
  if (/\/account|\/admin|\/settings|\/orders|\/checkout|\/dashboard/.test(summary.file)) return "route likely requires auth or tenant/session context; verify middleware";
  return "no direct auth/session terms detected";
}

function permissionPosture(summary) {
  if (/permission|role|rbac|admin|employee|super/i.test(summary.file + summary.leading.join(" "))) return "permission/RBAC terms detected";
  if (summary.appRoot.includes("administrative")) return "administrative app route; requires explicit allowlist/RBAC";
  return "no explicit permission terms detected";
}

function actionHints(summary) {
  const terms = [];
  if (/create|new|add/i.test(summary.file)) terms.push("create/add");
  if (/edit|update|settings/i.test(summary.file)) terms.push("edit/update");
  if (/delete|remove/i.test(summary.file + summary.leading.join(" "))) terms.push("delete/remove");
  if (/export|download/i.test(summary.file + summary.leading.join(" "))) terms.push("export/download");
  if (/checkout|payment|pay/i.test(summary.file)) terms.push("pay/checkout");
  return terms.length ? terms.join(", ") : "navigation/read/update actions inferred from component only";
}

function designPosture(summary) {
  const issues = [];
  if (summary.counts.inlineStyles) issues.push(`${summary.counts.inlineStyles} inline styles`);
  if (summary.counts.colors) issues.push(`${summary.counts.colors} hardcoded color tokens`);
  if (summary.file.endsWith(".dart")) issues.push("Flutter Material/design token parity must be checked against web");
  return issues.length ? issues.join("; ") : "no hardcoded style issue detected by static scan";
}

function performancePosture(summary) {
  const concerns = [];
  if (summary.flags.includes("client component")) concerns.push("client component/hydration cost");
  if (summary.counts.fetchCalls > 2) concerns.push(`${summary.counts.fetchCalls} fetch calls`);
  if (summary.counts.supabaseFrom > 2) concerns.push(`${summary.counts.supabaseFrom} direct Supabase table calls`);
  if (!summary.flags.includes("cache/revalidate") && /storefront|product|theme|analytics|orders/i.test(summary.file)) concerns.push("no cache/revalidate term detected");
  return concerns.length ? concerns.join("; ") : "no static performance concern detected";
}

function debtPosture(summary) {
  const debt = [];
  if (summary.counts.todos) debt.push(`${summary.counts.todos} TODO/FIXME markers`);
  if (summary.counts.any) debt.push(`${summary.counts.any} any/cast markers`);
  if (summary.counts.console) debt.push(`${summary.counts.console} console/print calls`);
  if (summary.flags.includes("service role reference")) debt.push("service-role reference");
  if (summary.flags.includes("hardcoded payment key id")) debt.push("hardcoded payment key id");
  return debt.length ? debt.join("; ") : "no static debt marker detected";
}

function inferFlutterRoute(summary) {
  const base = path.basename(summary.file, ".dart").replace(/_screen$/, "").replace(/_page$/, "");
  return `flutter:${summary.appRoot}:${base}`;
}

function riskSeverity(summary) {
  if (summary.flags.includes("service role reference") || summary.flags.includes("hardcoded payment key id")) return "critical";
  if (summary.area === "payments-checkout" && !summary.flags.includes("Zod validation")) return "high";
  if (summary.area === "auth" && !summary.flags.includes("cache/revalidate")) return "high";
  if (summary.counts.any || summary.counts.console || summary.counts.inlineStyles) return "medium";
  if (summary.counts.todos) return "low";
  return "info";
}

function validationLog(name) {
  const file = path.join(validationDir, name);
  return fs.existsSync(file) ? readText(file) : "";
}

function logLineCount(name) {
  return lineCount(validationLog(name));
}

function appendValidationLog(lines, title, name, limit = Infinity) {
  const text = validationLog(name);
  lines.push(`### ${title}`);
  lines.push(`- Artifact: \`docs/architecture/validation/${name}\``);
  lines.push(`- Captured lines: ${lineCount(text)}`);
  lines.push("");
  lines.push("```text");
  const logLines = text.split(/\r?\n/);
  const selected = Number.isFinite(limit) ? logLines.slice(0, limit) : logLines;
  selected.forEach((line, index) => {
    const content = redact(line);
    lines.push(content ? `${String(index + 1).padStart(5, "0")}: ${content}` : `${String(index + 1).padStart(5, "0")}:`);
  });
  if (selected.length < logLines.length) lines.push(`... ${logLines.length - selected.length} additional lines retained in artifact file ...`);
  lines.push("```");
  lines.push("");
}

function depVersionRows(packages) {
  const versions = new Map();
  for (const pkg of packages) {
    for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      for (const [name, version] of Object.entries(pkg.raw[field] || {})) {
        if (!versions.has(name)) versions.set(name, []);
        versions.get(name).push({ package: pkg.name, file: pkg.file, field, version });
      }
    }
  }
  return [...versions.entries()]
    .map(([name, uses]) => ({ name, uses, versions: unique(uses.map((use) => use.version)) }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function packageManagerProblems(packageVersions) {
  return packageVersions.filter((item) => item.versions.length > 1);
}

function pathExistsForPubspec(pubspec) {
  return pubspec.pathDeps.map((dep) => {
    const owner = path.dirname(pubspec.file);
    const resolved = toPosix(path.normalize(path.join(owner, dep.path)));
    return { ...dep, resolved, exists: fs.existsSync(path.join(root, resolved)) };
  });
}

function tableTenantStatus(table) {
  const fieldNames = table.fields.map((field) => field.name);
  const hasTenant = fieldNames.includes("site_id") || fieldNames.includes("store_id") || fieldNames.includes("tenant_id") || table.name === "sites";
  const hasSoftDelete = fieldNames.includes("deleted_at");
  const hasCreated = fieldNames.includes("created_at");
  const hasUpdated = fieldNames.includes("updated_at");
  const audit = fieldNames.includes("created_by") || fieldNames.includes("updated_by");
  return { hasTenant, hasSoftDelete, hasCreated, hasUpdated, audit };
}

function buildFinding(id, severity, area, evidence, impact, recommendation, effort = "medium") {
  return { id, severity, area, evidence, impact, recommendation, effort };
}

const allAbsFiles = walk(root);
const allFiles = allAbsFiles.map(rel).sort();
const textFiles = allFiles.filter((file) => isTextFile(path.join(root, file)));
const sourceFiles = textFiles
  .filter((file) => isSourceFile(file))
  .filter((file) => !generatedOutputFiles.has(file))
  .filter((file) => !file.startsWith("docs/architecture/validation/"));

const fileSummaries = sourceFiles.map(summarizeFile);
const runtimeFileSummaries = fileSummaries.filter((summary) => !summary.file.startsWith("docs/") && !summary.file.startsWith("memory/") && !summary.file.startsWith("tasks/") && !summary.file.endsWith("/AGENTS.md") && summary.file !== "AGENTS.md");
const packageFiles = sourceFiles.filter((file) => file.endsWith("package.json"));
const packages = packageFiles.map(summarizePackage).filter(Boolean);
const pubspecFiles = sourceFiles.filter((file) => file.endsWith("pubspec.yaml"));
const pubspecs = pubspecFiles.map(summarizePubspec);
const migrationFiles = sourceFiles.filter((file) => file.startsWith("backend/supabase/migrations/") && file.endsWith(".sql")).sort();
const sql = parseSqlMigrations(migrationFiles);
const routeCatalog = buildRouteCatalog(fileSummaries);
const screens = screenCatalog(fileSummaries);
const graph = localDependencyGraph(packages);
const packageVersions = depVersionRows(packages);
const conflictingDeps = packageManagerProblems(packageVersions);
const agentFiles = allFiles.filter((file) => file === "AGENTS.md" || file.endsWith("/AGENTS.md")).sort();

const nextApiRoutes = routeCatalog.next.filter((route) => route.type === "Next API");
const nextScreens = screens.filter((screen) => screen.platform === "Next.js");
const flutterScreens = screens.filter((screen) => screen.platform === "Flutter");
const honoRoutes = routeCatalog.hono.filter((route) => route.type === "Hono route");
const honoMounts = routeCatalog.hono.filter((route) => route.type === "Hono mount");

const areaCounts = fileSummaries.reduce((acc, summary) => {
  acc[summary.area] = (acc[summary.area] || 0) + 1;
  return acc;
}, {});

const appStats = appTargets.map(([name, target, purpose]) => {
  const summaries = fileSummaries.filter((summary) => summary.appRoot === target);
  return {
    name,
    target,
    purpose,
    exists: exists(target),
    files: summaries.length,
    routes: summaries.filter((summary) => summary.nextRoute).length,
    screens: screens.filter((screen) => screen.appRoot === target).length,
    apiRoutes: summaries.filter((summary) => summary.file.endsWith("/route.ts")).length,
    flags: unique(summaries.flatMap((summary) => summary.flags)),
    envNames: unique(summaries.flatMap((summary) => summary.envNames)),
    dbRefs: unique(summaries.flatMap((summary) => summary.dbRefs)),
  };
});

const packageStats = packageTargets.map(([name, target, purpose]) => {
  const summaries = fileSummaries.filter((summary) => summary.packageRoot === target || summary.file.startsWith(`${target}/`));
  const pkg = packages.find((item) => item.file === `${target}/package.json`);
  const pubspec = pubspecs.find((item) => item.file === `${target}/pubspec.yaml`);
  return {
    name,
    target,
    purpose,
    exists: exists(target),
    files: summaries.length,
    packageName: pkg?.name || pubspec?.name || "no manifest",
    deps: pkg?.allDeps || pubspec?.deps || [],
    pathDeps: pubspec ? pathExistsForPubspec(pubspec) : [],
    flags: unique(summaries.flatMap((summary) => summary.flags)),
  };
});

const findings = [];
const typeErrors = countMatches(validationLog("typecheck.pnpm.log"), /error TS\d+:/g);
if (typeErrors) {
  findings.push(buildFinding("TS-001", "high", "typecheck", "docs/architecture/validation/typecheck.pnpm.log", "Root typecheck stops in @letbuyy/api before web apps are reached.", "Fix backend/workers/api/src/routes/upload.ts File conversion or narrow through unknown before converting."));
}
if (/Converting circular structure to JSON/.test(validationLog("lint.pnpm.log"))) {
  findings.push(buildFinding("LINT-001", "high", "tooling", "docs/architecture/validation/lint.pnpm.log", "ESLint cannot complete for app-store/theme-marketplace, blocking code-quality enforcement.", "Normalize ESLint 9 flat config or remove circular react config extension in affected apps.", "medium"));
}
for (const table of sql.tables) {
  const tenant = tableTenantStatus(table);
  if (!tenant.hasTenant && !["plans", "themes", "theme_categories", "app_categories", "platform_settings", "schema_migrations"].includes(table.name)) {
    findings.push(buildFinding(`TENANT-${String(findings.length).padStart(3, "0")}`, "high", "tenant-isolation", table.createdIn + " -> " + table.name, `Table ${table.name} has no obvious site_id/store_id/tenant_id column.`, "Classify as global lookup or add tenant ownership/foreign key plus RLS policy.", "medium"));
  }
  if (!tenant.hasSoftDelete && !/(_items|migrations|settings|analytics_events)$/.test(table.name)) {
    findings.push(buildFinding(`SCHEMA-${String(findings.length).padStart(3, "0")}`, "medium", "schema", table.createdIn + " -> " + table.name, `Table ${table.name} has no deleted_at soft-delete column.`, "Add deleted_at or document why hard delete is safe.", "low"));
  }
  if (!table.rls) {
    findings.push(buildFinding(`RLS-${String(findings.length).padStart(3, "0")}`, "high", "database-security", table.createdIn + " -> " + table.name, `Table ${table.name} has no detected ENABLE ROW LEVEL SECURITY statement.`, "Enable RLS and add tenant-scoped policies or document as internal-only.", "medium"));
  }
}
for (const summary of fileSummaries.filter((item) => item.flags.includes("hardcoded payment key id"))) {
  findings.push(buildFinding(`PAYKEY-${String(findings.length).padStart(3, "0")}`, "critical", "payments", summary.file, "Hardcoded payment provider key identifier detected.", "Move provider key IDs to environment/config and keep only publishable IDs client-visible.", "low"));
}
for (const summary of fileSummaries.filter((item) => item.flags.includes("service role reference") && /client|component|page\.tsx/.test(item.file))) {
  findings.push(buildFinding(`SVCROLE-${String(findings.length).padStart(3, "0")}`, "critical", "secrets", summary.file, "Service-role reference is near a UI/page/client surface.", "Verify this is server-only; move service role usage to worker/server utility if not.", "medium"));
}
for (const pubspec of pubspecs) {
  for (const dep of pathExistsForPubspec(pubspec).filter((item) => !item.exists)) {
    findings.push(buildFinding(`DARTPATH-${String(findings.length).padStart(3, "0")}`, "high", "flutter-sync", `${pubspec.file} -> ${dep.path}`, `Flutter path dependency ${dep.name} resolves to missing ${dep.resolved}.`, "Update path to packages/dart/* or move packages to paths expected by pubspec.", "low"));
  }
}
for (const match of validationLog("flutter-analyze.escalated.log").matchAll(/warning • The path '([^']+)' doesn't exist • ([^•]+) • path_does_not_exist/g)) {
  const evidence = `${match[2].trim()} -> ${match[1]}`;
  if (!findings.some((finding) => finding.evidence === evidence)) {
    findings.push(buildFinding(`DARTPATH-${String(findings.length).padStart(3, "0")}`, "high", "flutter-sync", evidence, `Flutter analyzer reports missing path dependency ${match[1]}.`, "Update the path to the canonical packages/dart/* location or create an intentional compatibility package.", "low"));
  }
}
for (const dep of conflictingDeps.filter((item) => ["next", "react", "react-dom", "typescript", "eslint", "@types/react", "supabase_flutter"].includes(item.name) || item.versions.length > 2)) {
  findings.push(buildFinding(`DEP-${String(findings.length).padStart(3, "0")}`, "medium", "dependency-versions", dep.name, `Dependency ${dep.name} has versions ${dep.versions.join(", ")} across manifests.`, "Pin shared runtime dependencies at the workspace level and remove app-specific drift.", "medium"));
}

const tenantFindings = findings.filter((finding) => finding.area.includes("tenant") || finding.id.startsWith("TENANT"));
const permissionFindings = findings.filter((finding) => /permission|auth|rbac|admin/i.test(`${finding.area} ${finding.impact} ${finding.recommendation}`));
const flutterSyncFindings = findings.filter((finding) => finding.area === "flutter-sync");
const securityFindings = findings.filter((finding) => ["critical", "high"].includes(finding.severity) && /security|tenant|secrets|payments|auth|database/.test(finding.area + finding.id));

const lines = [];
function push(...items) {
  lines.push(...items);
}

push(`<!-- GENERATED BY scripts/generate-system-intelligence-report.mjs ON ${now}. Source-derived, command-backed repository intelligence. -->`);
push("# LETBUYY STORE — SYSTEM INTELLIGENCE REPORT");
push("");
push("> This report is generated from the current workspace source files, manifests, migrations, route handlers, middleware, workers, package manifests, Flutter pubspecs, validation command logs, and scan artifacts. It intentionally redacts likely secret values and reports environment variable names only.");
push("");
push("## Generation Scope");
push("");
push(`- Generated at: ${now}`);
push(`- Repository root: \`${root}\``);
push(`- Source/config/docs files scanned: ${sourceFiles.length}`);
push(`- Text files considered: ${textFiles.length}`);
push(`- Package manifests: ${packages.length}`);
push(`- Dart pubspec files: ${pubspecs.length}`);
push(`- Supabase migration files: ${migrationFiles.length}`);
push(`- Parsed database tables: ${sql.tables.length}`);
push(`- Parsed database indexes: ${sql.indexes.length}`);
push(`- Parsed database policies: ${sql.policies.length}`);
push(`- Next routes/pages/layouts/API files: ${routeCatalog.next.length}`);
push(`- Next API route handlers: ${nextApiRoutes.length}`);
push(`- Hono route declarations: ${honoRoutes.length}`);
push(`- Hono mounts: ${honoMounts.length}`);
push(`- Screens documented: ${screens.length}`);
push(`- AGENTS.md files present: ${agentFiles.length}`);
push(`- Validation artifact directory: \`docs/architecture/validation\``);
push("");

push("## SECTION 1 — Executive Repository Overview");
push("");
push("### What LetBuyy Store Actually Is");
push("");
push("- LetBuyy is implemented as a pnpm/Turborepo plus Dart/Flutter workspace for a Shopify-class, multi-tenant commerce and site-builder platform.");
push("- The database-owned tenant entity is `sites`; web routes and merchant UI use `store`, `subdomain`, and `store` route terms.");
push("- The repo contains public/consumer web apps, administrative web apps, Cloudflare Hono workers, Supabase SQL migrations, Terraform DNS infrastructure, and Flutter apps/packages.");
push("- The platform includes storefront rendering, merchant admin, identity/onboarding, app marketplace, theme marketplace, internal console/team scaffolds, Flutter builder surfaces, checkout/payment surfaces, analytics surfaces, and generated repository intelligence docs.");
push("");
push("### Architecture Style Detected From Code");
push("");
push("- Monorepo: `pnpm-workspace.yaml` includes `apps/web/administrative/*`, `apps/web/consumer/*`, `packages/typescript/*`, and `backend/workers/*`.");
push("- Web runtime: Next.js app-router apps using `src/app`, route handlers, middleware files, and per-app Next configs.");
push("- API runtime: Cloudflare Workers using Hono route modules in `backend/workers/api/src/routes` plus a separate `backend/workers/webhooks` worker.");
push("- Data runtime: Supabase Postgres migrations under `backend/supabase/migrations`, Supabase client usage in workers and apps, and RLS policy declarations in SQL.");
push("- Mobile runtime: Flutter/Melos workspace in root `pubspec.yaml`, with apps under `apps/flutter/*` and shared Dart packages under `packages/dart/*`.");
push("- Generated intelligence: root/local `AGENTS.md` files plus topic docs under `docs/` are part of the repo operating model.");
push("");
push("### Major Architectural Issues Currently Detected");
push("");
for (const finding of findings.slice(0, 30)) {
  push(`- **${finding.severity.toUpperCase()} ${finding.id}** (${finding.area}) Evidence: \`${finding.evidence}\`. Impact: ${finding.impact} Recommendation: ${finding.recommendation}`);
}
if (findings.length > 30) push(`- ${findings.length - 30} additional findings are cataloged in Section 16.`);
push("");

push("## SECTION 2 — Complete Tech Stack Discovery");
push("");
push("### Manifest Inventory");
push("");
for (const pkg of packages) {
  push(`#### ${pkg.name}`);
  push(`- Manifest: \`${pkg.file}\``);
  push(`- Version: \`${pkg.version}\``);
  push(`- Private: ${pkg.private}`);
  push(`- Scripts: ${pkg.scripts.length ? pkg.scripts.map((script) => `\`${script}\``).join(", ") : "none"}`);
  push(`- Dependencies (${pkg.deps.dependencies.length}): ${pkg.deps.dependencies.map((dep) => `\`${dep}@${pkg.raw.dependencies?.[dep]}\``).join(", ") || "none"}`);
  push(`- Dev dependencies (${pkg.deps.devDependencies.length}): ${pkg.deps.devDependencies.map((dep) => `\`${dep}@${pkg.raw.devDependencies?.[dep]}\``).join(", ") || "none"}`);
  push(`- Peer dependencies (${pkg.deps.peerDependencies.length}): ${pkg.deps.peerDependencies.map((dep) => `\`${dep}@${pkg.raw.peerDependencies?.[dep]}\``).join(", ") || "none"}`);
  push("");
}
push("### Dart/Flutter Pubspec Inventory");
push("");
for (const pubspec of pubspecs) {
  push(`#### ${pubspec.name}`);
  push(`- Pubspec: \`${pubspec.file}\``);
  push(`- Version: \`${pubspec.version}\``);
  push(`- SDK constraint: \`${pubspec.sdk}\``);
  push(`- Dependencies detected: ${pubspec.deps.map((dep) => `\`${dep}\``).join(", ") || "none"}`);
  const pathDeps = pathExistsForPubspec(pubspec);
  if (pathDeps.length) {
    push("- Path dependencies:");
    for (const dep of pathDeps) push(`  - \`${dep.name}\` -> \`${dep.path}\` resolves to \`${dep.resolved}\` (${dep.exists ? "exists" : "missing"})`);
  }
  push("");
}
push("### Dependency Version Conflicts");
push("");
if (!conflictingDeps.length) push("- No duplicate dependency names with conflicting version ranges detected across package manifests.");
for (const dep of conflictingDeps) {
  push(`- \`${dep.name}\`: ${dep.versions.map((version) => `\`${version}\``).join(", ")}`);
  for (const use of dep.uses) push(`  - ${use.package} (${use.field}) in \`${use.file}\`: \`${use.version}\``);
}
push("");
push("### Full Dependency Graph From Package Manifests");
push("");
for (const node of graph) {
  push(`- \`${node.name}\` from \`${node.file}\``);
  push(`  - Local workspace dependencies: ${node.localDeps.map((dep) => `\`${dep}\``).join(", ") || "none"}`);
  push(`  - External dependencies: ${node.externalDeps.map((dep) => `\`${dep}\``).join(", ") || "none"}`);
}
push("");

push("## SECTION 3 — Full Monorepo Architecture Analysis");
push("");
push("### Workspace Configuration Facts");
push("");
push("- `pnpm-workspace.yaml` includes web apps, TypeScript packages, and Cloudflare worker packages.");
push("- `pnpm-workspace.yaml` does not include `apps/flutter/*` or `packages/dart/*`; Flutter is owned by root `pubspec.yaml` workspace instead.");
push("- `pnpm-workspace.yaml` does not include alias package directories such as `packages/ui`, `packages/db`, `packages/api`, `packages/shared`, `packages/auth`, `packages/payments`, `packages/config`, or app alias directories under `apps/merchant`, `apps/storefront`, `apps/internal`.");
push("- Root `turbo.json` build/lint/typecheck tasks depend on `^build`, which means lint/typecheck can be blocked by build/package errors before app-level checks run.");
push("- Root `package.json` declares `pnpm@10.6.2`, while npm wrappers cannot find local `turbo` without node_modules. This was proven by `docs/architecture/validation/typecheck.log`.");
push("");
push("### Source Area Counts");
push("");
for (const [area, count] of Object.entries(areaCounts).sort((a, b) => b[1] - a[1])) {
  push(`- ${area}: ${count} files`);
}
push("");
push("### App Boundary Inventory");
push("");
for (const app of appStats) {
  push(`#### ${app.name}`);
  push(`- Path: \`${app.target}\``);
  push(`- Exists: ${app.exists}`);
  push(`- Purpose: ${app.purpose}`);
  push(`- Source files scanned: ${app.files}`);
  push(`- Route files detected: ${app.routes}`);
  push(`- Screen files documented: ${app.screens}`);
  push(`- API route handlers in app: ${app.apiRoutes}`);
  push(`- DB refs detected: ${app.dbRefs.join(", ") || "none"}`);
  push(`- Env names detected: ${app.envNames.join(", ") || "none"}`);
  push(`- Static flags: ${app.flags.join(", ") || "none"}`);
  push("");
}
push("### Package Boundary Inventory");
push("");
for (const pkg of packageStats) {
  push(`#### ${pkg.name}`);
  push(`- Path: \`${pkg.target}\``);
  push(`- Exists: ${pkg.exists}`);
  push(`- Purpose: ${pkg.purpose}`);
  push(`- Source files scanned: ${pkg.files}`);
  push(`- Manifest name: \`${pkg.packageName}\``);
  push(`- Dependencies: ${pkg.deps.map((dep) => `\`${dep}\``).join(", ") || "none"}`);
  if (pkg.pathDeps.length) {
    push("- Path dependency resolution:");
    for (const dep of pkg.pathDeps) push(`  - \`${dep.name}\` -> \`${dep.resolved}\` (${dep.exists ? "exists" : "missing"})`);
  }
  push(`- Static flags: ${pkg.flags.join(", ") || "none"}`);
  push("");
}

push("## SECTION 4 — Complete App Inventory");
push("");
for (const app of appStats) {
  const summaries = fileSummaries.filter((summary) => summary.appRoot === app.target);
  const appScreens = screens.filter((screen) => screen.appRoot === app.target);
  const appRoutes = routeCatalog.next.filter((route) => route.appRoot === app.target);
  push(`### ${app.name} — \`${app.target}\``);
  push(`- Purpose: ${app.purpose}`);
  push(`- Target users: ${app.name.includes("Console") ? "platform super admins" : app.name.includes("Team") ? "internal employees/support" : app.name.includes("Storefront") ? "shoppers/customers" : app.name.includes("Landing") ? "prospects/merchants" : app.name.includes("Flutter") ? "mobile operators/merchants/internal users" : "merchants or platform users"}`);
  push(`- Architecture: ${app.target.includes("flutter") ? "Flutter app" : app.target.includes("web") ? "Next.js app-router app" : "alias/governance directory"}`);
  push(`- Routing structure: ${appRoutes.length} Next route files; ${appScreens.length} documented screens.`);
  push(`- APIs consumed: ${unique(summaries.flatMap((summary) => summary.dbRefs)).join(", ") || "no direct DB refs detected"}; fetch calls: ${summaries.reduce((sum, item) => sum + item.counts.fetchCalls, 0)}.`);
  push(`- Auth flow: ${summaries.some((item) => item.flags.includes("auth/session")) ? "auth/session terms detected in source" : "no direct auth/session terms detected by static scan"}.`);
  push(`- Permissions: ${summaries.some((item) => /permission|rbac|role|admin|employee/i.test(item.file + item.leading.join(" "))) ? "permission/RBAC/admin terms detected" : "no explicit permission terms detected by static scan"}.`);
  push(`- Tenant behavior: ${summaries.some((item) => item.flags.includes("tenant/store identifier")) ? "site/store/subdomain/tenant identifiers detected" : "no tenant identifier detected by static scan"}.`);
  push(`- Technical debt markers: ${summaries.reduce((sum, item) => sum + item.counts.todos + item.counts.any + item.counts.console, 0)} total TODO/any/console markers.`);
  push(`- Synchronization quality: ${app.target.includes("flutter") ? "must be reconciled with TypeScript API contracts and package paths; see Section 10" : "web app participates in pnpm/Turbo but may duplicate app-local logic; see route/service file catalog"}.`);
  push(`- Design consistency: hardcoded color tokens ${summaries.reduce((sum, item) => sum + item.counts.colors, 0)}, inline styles ${summaries.reduce((sum, item) => sum + item.counts.inlineStyles, 0)}.`);
  push(`- Performance quality: client components ${summaries.filter((item) => item.flags.includes("client component")).length}; fetch calls ${summaries.reduce((sum, item) => sum + item.counts.fetchCalls, 0)}; cache terms ${summaries.filter((item) => item.flags.includes("cache/revalidate")).length}.`);
  push("");
  push("#### Route and Screen Inventory");
  if (!appRoutes.length && !appScreens.length) push("- No Next route or screen files detected for this target.");
  for (const route of appRoutes) {
    push(`- ${route.type} \`${route.route}\` via \`${route.file}\` (${route.kind}${route.methods?.length ? `; methods ${route.methods.join(", ")}` : ""})`);
  }
  for (const screen of appScreens) {
    push(`- ${screen.platform} screen \`${screen.route}\` via \`${screen.file}\`: ${screen.purpose}; APIs: ${screen.apis}; Auth: ${screen.auth}; Design: ${screen.design}; Debt: ${screen.debt}`);
  }
  push("");
}

push("## SECTION 5 — Database & Schema Analysis");
push("");
push("### Migration Inventory");
push("");
for (const file of migrationFiles) {
  const summary = fileSummaries.find((item) => item.file === file);
  push(`- \`${file}\`: ${summary?.lines || 0} lines; tables ${summary?.dbRefs?.join(", ") || "see parsed table list"}; flags ${summary?.flags.join(", ") || "none"}`);
}
push("");
push("### Tables");
push("");
for (const table of sql.tables) {
  const tenant = tableTenantStatus(table);
  push(`#### Table \`${table.name}\``);
  push(`- Created in: \`${table.createdIn}\``);
  push(`- Fields: ${table.fields.length}`);
  push(`- Indexes: ${table.indexes.length}`);
  push(`- Policies: ${table.policies.length}`);
  push(`- RLS enabled: ${table.rls}`);
  push(`- Tenant isolation field present: ${tenant.hasTenant}`);
  push(`- Soft delete present: ${tenant.hasSoftDelete}`);
  push(`- Audit fields present: ${tenant.audit}`);
  push(`- created_at present: ${tenant.hasCreated}`);
  push(`- updated_at present: ${tenant.hasUpdated}`);
  push(`- Normalization notes: ${table.fields.some((field) => /jsonb/i.test(field.definition)) ? "JSONB fields detected; validate whether this hides queryable relational data." : "no JSONB field detected in create statement."}`);
  push(`- Monetary precision notes: ${table.fields.some((field) => /price|amount|total|subtotal|tax|shipping|discount/i.test(field.name) && /float|real|double/i.test(field.definition)) ? "floating monetary field detected; use integer minor units or numeric precision." : "no floating monetary type detected by static parser."}`);
  push(`- Performance risks: ${table.indexes.length === 0 && tenant.hasTenant ? "tenant table has no detected table-specific index; verify query patterns." : "detected indexes or global table."}`);
  push("- Field catalog:");
  for (const field of table.fields) {
    push(`  - \`${field.name}\`: ${field.definition}; nullable=${field.nullable}; primary=${field.primary}; references=${field.references || "none"}`);
  }
  if (table.constraints.length) {
    push("- Constraints:");
    for (const constraint of table.constraints) push(`  - ${constraint}`);
  }
  if (table.indexes.length) {
    push("- Indexes:");
    for (const index of table.indexes) push(`  - \`${index.name}\` unique=${index.unique}; ${index.definition}; file=\`${index.file}\``);
  }
  if (table.policies.length) {
    push("- Policies:");
    for (const policy of table.policies) push(`  - \`${policy.name}\` in \`${policy.file}\`: ${policy.definition}`);
  }
  if (table.alters.length) {
    push("- Alter statements:");
    for (const alter of table.alters.slice(0, 20)) push(`  - \`${alter.file}\`: ${alter.statement}`);
    if (table.alters.length > 20) push(`  - ${table.alters.length - 20} additional alter statements omitted from table block; see schema validation log.`);
  }
  if (table.triggers.length) {
    push("- Triggers:");
    for (const trigger of table.triggers) push(`  - \`${trigger.name}\` from \`${trigger.file}\`: ${trigger.definition}`);
  }
  push("");
}

push("### Shared Models and Contracts");
push("");
const modelFiles = runtimeFileSummaries.filter((summary) => /models|api-types|types|schema|interface|class/i.test(summary.file) && [".ts", ".tsx", ".dart"].includes(summary.ext));
for (const model of modelFiles) {
  push(`- \`${model.file}\`: exports/classes ${model.exports.join(", ") || "none detected"}; imports ${model.imports.slice(0, 8).join(", ") || "none"}; DB refs ${model.dbRefs.join(", ") || "none"}; flags ${model.flags.join(", ") || "none"}`);
}
push("");

push("## SECTION 6 — Full API Analysis");
push("");
push("### Cloudflare Hono Mounts");
push("");
for (const mount of honoMounts) {
  push(`- Mount \`${mount.route}\` -> \`${mount.router || "unknown"}\` in \`${mount.file}\`; flags ${mount.flags.join(", ") || "none"}`);
}
push("");
push("### Hono Route Declarations");
push("");
for (const route of honoRoutes) {
  push(`#### ${route.method} \`${route.route}\``);
  push(`- File: \`${route.file}\``);
  push(`- Auth: ${route.flags.includes("auth/session") ? "auth/session terms detected" : "no auth/session terms detected in same file"}`);
  push(`- Permissions: ${/permission|role|rbac|admin|employee/i.test(route.file + route.flags.join(" ")) ? "permission/RBAC/admin term detected" : "no explicit permission term detected"}`);
  push(`- Validation: ${route.flags.includes("Zod validation") ? "Zod terms detected" : "no Zod term detected"}`);
  push(`- Tenant isolation: ${route.flags.includes("tenant/store identifier") ? "tenant/store identifiers detected" : "no tenant/store identifier detected"}`);
  push(`- DB queries/tables: ${route.dbRefs.join(", ") || "none detected"}`);
  push(`- Response/cache behavior: ${route.flags.includes("cache/revalidate") ? "cache/revalidate terms detected" : "no cache/revalidate term detected"}`);
  push(`- Security risks: ${riskSeverity(fileSummaries.find((summary) => summary.file === route.file) || { flags: [], counts: {} })}`);
  push("");
}
push("### Next API Route Handlers");
push("");
for (const route of nextApiRoutes) {
  push(`#### ${route.methods.length ? route.methods.join(", ") : "NO METHOD EXPORT DETECTED"} \`${route.route}\``);
  push(`- File: \`${route.file}\``);
  push(`- App root: \`${route.appRoot}\``);
  push(`- Auth: ${route.flags.includes("auth/session") ? "auth/session terms detected" : "no auth/session terms detected in same file"}`);
  push(`- Permissions: ${/permission|role|rbac|admin|employee/i.test(route.file + route.flags.join(" ")) ? "permission/RBAC/admin term detected" : "no explicit permission term detected"}`);
  push(`- Validation: ${route.flags.includes("Zod validation") ? "Zod terms detected" : "no Zod term detected"}`);
  push(`- Tenant isolation: ${route.flags.includes("tenant/store identifier") ? "tenant/store identifiers detected" : "no tenant/store identifier detected"}`);
  push(`- DB queries/tables: ${route.dbRefs.join(", ") || "none detected"}`);
  push(`- Frontend consumers: route exists inside app boundary; direct consumer search is in duplicate-logic scan artifact.`);
  push(`- Cache behavior: ${route.flags.includes("cache/revalidate") ? "cache/revalidate terms detected" : "no cache/revalidate term detected"}`);
  push(`- Contract mismatch risk: ${route.methods.length ? "method export detected" : "route.ts file without detected method export"}`);
  push("");
}

push("## SECTION 7 — Authentication & Permission System Analysis");
push("");
const authFiles = runtimeFileSummaries.filter((summary) => summary.area === "auth" || summary.flags.includes("auth/session"));
push(`- Auth/session-related files detected: ${authFiles.length}`);
push(`- Permission/RBAC middleware files: ${fileSummaries.filter((summary) => /permission|rbac|role/i.test(summary.file)).map((summary) => `\`${summary.file}\``).join(", ") || "none detected"}`);
push(`- Merchant auth evidence: Accounts app files with auth flags: ${authFiles.filter((summary) => summary.file.startsWith("apps/web/consumer/accounts/")).length}`);
push(`- Customer auth evidence: Storefront auth/customer files with auth flags: ${authFiles.filter((summary) => summary.file.startsWith("apps/web/consumer/storefront/")).length}`);
push(`- Admin auth evidence: Admin/console/team auth-flag files: ${authFiles.filter((summary) => /consumer\/admin|administrative/.test(summary.file)).length}`);
push("");
for (const summary of authFiles) {
  push(`- \`${summary.file}\`: flags ${summary.flags.join(", ") || "none"}; env ${summary.envNames.join(", ") || "none"}; DB refs ${summary.dbRefs.join(", ") || "none"}; exports ${summary.exports.join(", ") || "none"}`);
}
push("");

push("## SECTION 8 — Theme Engine & Storefront Rendering Analysis");
push("");
const themeFiles = runtimeFileSummaries.filter((summary) => summary.area === "themes" || summary.area === "storefront" || /theme|section|block|renderer|preview|urban-kicks|storefront/i.test(summary.file));
push(`- Theme/storefront/rendering files detected: ${themeFiles.length}`);
for (const summary of themeFiles) {
  push(`- \`${summary.file}\`: area=${summary.area}; routes=${summary.nextRoute ? `${summary.nextRoute.kind}:${summary.nextRoute.route}` : "none"}; tenant=${summary.flags.includes("tenant/store identifier")}; cache=${summary.flags.includes("cache/revalidate")}; client=${summary.flags.includes("client component")}; DB refs ${summary.dbRefs.join(", ") || "none"}; colors=${summary.counts.colors}; debt=${debtPosture(summary)}`);
}
push("");

push("## SECTION 9 — Checkout & Payment Architecture Analysis");
push("");
const paymentFiles = runtimeFileSummaries.filter((summary) => summary.area === "payments-checkout" || summary.flags.includes("payment provider"));
push(`- Checkout/payment files detected: ${paymentFiles.length}`);
for (const summary of paymentFiles) {
  push(`- \`${summary.file}\`: flags ${summary.flags.join(", ") || "none"}; route=${summary.nextRoute ? summary.nextRoute.route : summary.honoRoutes.map((route) => `${route.method} ${route.path}`).join(", ") || "none"}; validation=${summary.flags.includes("Zod validation")}; tenant=${summary.flags.includes("tenant/store identifier")}; DB refs=${summary.dbRefs.join(", ") || "none"}; env=${summary.envNames.join(", ") || "none"}; risk=${riskSeverity(summary)}`);
}
push("");

push("## SECTION 10 — Flutter ↔ Web Synchronization Audit");
push("");
push("### Contract Parity Evidence");
push("");
const dartModelFiles = runtimeFileSummaries.filter((summary) => summary.file.startsWith("packages/dart/models/") || summary.file.startsWith("packages/dart/services/"));
const tsContractFiles = runtimeFileSummaries.filter((summary) => summary.file.startsWith("packages/typescript/api-types/") || summary.file.startsWith("backend/workers/api/src/schemas/"));
push(`- Dart model/service files: ${dartModelFiles.length}`);
push(`- TypeScript API/schema contract files: ${tsContractFiles.length}`);
push(`- Flutter path dependency failures detected: ${flutterSyncFindings.length}`);
push("");
push("### Dart Contract Files");
for (const summary of dartModelFiles) push(`- \`${summary.file}\`: exports/classes ${summary.exports.join(", ") || "none"}; imports ${summary.imports.join(", ") || "none"}; flags ${summary.flags.join(", ") || "none"}`);
push("");
push("### TypeScript Contract and Zod Schema Files");
for (const summary of tsContractFiles) push(`- \`${summary.file}\`: exports ${summary.exports.join(", ") || "none"}; DB refs ${summary.dbRefs.join(", ") || "none"}; Zod markers ${summary.counts.zod}; flags ${summary.flags.join(", ") || "none"}`);
push("");
push("### Sync Findings");
if (!flutterSyncFindings.length) push("- No missing Flutter path dependency findings detected.");
for (const finding of flutterSyncFindings) push(`- **${finding.severity.toUpperCase()}** ${finding.evidence}: ${finding.impact} Recommendation: ${finding.recommendation}`);
push("");

push("## SECTION 11 — Screen-by-Screen Analysis");
push("");
for (const screen of screens) {
  push(`### ${screen.platform} Screen — \`${screen.route}\``);
  push(`- File: \`${screen.file}\``);
  push(`- App root: \`${screen.appRoot}\``);
  push(`- Purpose: ${screen.purpose}`);
  push(`- APIs used: ${screen.apis}`);
  push(`- Auth behavior: ${screen.auth}`);
  push(`- Permissions: ${screen.permissions}`);
  push(`- Forms: ${screen.forms}`);
  push(`- Tables: ${screen.tables}`);
  push(`- Loading states: ${screen.loading}`);
  push(`- Error handling: ${screen.errors}`);
  push(`- Pagination/filtering/search: ${screen.filtering}`);
  push(`- Charts: ${screen.charts}`);
  push(`- Actions: ${screen.actions}`);
  push(`- Design consistency: ${screen.design}`);
  push(`- Accessibility: static scan cannot prove accessibility; verify labels, focus states, and keyboard flow manually.`);
  push(`- Performance issues: ${screen.performance}`);
  push(`- Technical debt: ${screen.debt}`);
  push("");
}

push("## SECTION 12 — Design System Audit");
push("");
const uiFiles = runtimeFileSummaries.filter((summary) => summary.area === "ui-design" || summary.file.includes("globals.css") || summary.file.includes("theme") || summary.file.includes("ui_kit"));
push(`- UI/design files detected: ${uiFiles.length}`);
push(`- Total hardcoded color tokens in scanned source: ${fileSummaries.reduce((sum, item) => sum + item.counts.colors, 0)}`);
push(`- Total inline React style markers: ${fileSummaries.reduce((sum, item) => sum + item.counts.inlineStyles, 0)}`);
push("");
for (const summary of uiFiles) {
  push(`- \`${summary.file}\`: colors=${summary.counts.colors}; inlineStyles=${summary.counts.inlineStyles}; client=${summary.flags.includes("client component")}; leading=${summary.leading.join(" | ") || "none"}`);
}
push("");

push("## SECTION 13 — Cloudflare & Infrastructure Analysis");
push("");
const infraFiles = runtimeFileSummaries.filter((summary) => /wrangler|worker|cloudflare|terraform|dns|vercel|infrastructure|middleware/i.test(summary.file));
for (const summary of infraFiles) {
  push(`- \`${summary.file}\`: area=${summary.area}; lines=${summary.lines}; env=${summary.envNames.join(", ") || "none"}; Hono=${summary.honoRoutes.map((route) => `${route.method} ${route.path}`).join(", ") || "none"}; mounts=${summary.honoMounts.map((mount) => `${mount.path}->${mount.router}`).join(", ") || "none"}; flags=${summary.flags.join(", ") || "none"}`);
}
push("");

push("## SECTION 14 — Performance Analysis");
push("");
const perfFiles = runtimeFileSummaries.filter((summary) => summary.flags.includes("client component") || summary.counts.fetchCalls > 1 || summary.counts.supabaseFrom > 1 || /cache|revalidate|redis|kv|analytics|product|storefront/i.test(summary.file));
for (const summary of perfFiles) {
  push(`- \`${summary.file}\`: ${performancePosture(summary)}; lines=${summary.lines}; fetch=${summary.counts.fetchCalls}; supabaseFrom=${summary.counts.supabaseFrom}; cacheTerms=${summary.flags.includes("cache/revalidate")}`);
}
push("");

push("## SECTION 15 — Security Audit");
push("");
for (const finding of securityFindings) {
  push(`- **${finding.severity.toUpperCase()} ${finding.id}** (${finding.area}) Evidence: \`${finding.evidence}\`; impact: ${finding.impact}; fix: ${finding.recommendation}`);
}
push("");
push("### Tenant Isolation Audit");
for (const table of sql.tables) {
  const tenant = tableTenantStatus(table);
  push(`- Table \`${table.name}\`: tenantField=${tenant.hasTenant}; RLS=${table.rls}; policies=${table.policies.length}; indexes=${table.indexes.length}; createdIn=\`${table.createdIn}\``);
}
push("");

push("## SECTION 16 — Technical Debt Register");
push("");
for (const finding of findings) {
  push(`### ${finding.id} — ${finding.area}`);
  push(`- Severity: ${finding.severity}`);
  push(`- Impact: ${finding.impact}`);
  push(`- Effort: ${finding.effort}`);
  push(`- Affected evidence: \`${finding.evidence}\``);
  push(`- Recommended fix: ${finding.recommendation}`);
  push(`- Architectural priority: ${finding.severity === "critical" ? "P0" : finding.severity === "high" ? "P1" : finding.severity === "medium" ? "P2" : "P3"}`);
  push("");
}
push("### File-Level Debt Markers");
for (const summary of fileSummaries.filter((item) => item.counts.todos || item.counts.any || item.counts.console || item.counts.inlineStyles || item.flags.includes("hardcoded payment key id") || item.flags.includes("service role reference"))) {
  push(`- \`${summary.file}\`: TODO=${summary.counts.todos}; any=${summary.counts.any}; console=${summary.counts.console}; inlineStyles=${summary.counts.inlineStyles}; hardcodedPayment=${summary.flags.includes("hardcoded payment key id")}; serviceRole=${summary.flags.includes("service role reference")}`);
}
push("");

push("## SECTION 17 — Workspace Restructuring Plan");
push("");
push("### Ideal Monorepo Structure");
push("");
push("```text");
push("apps/");
push("  web/");
push("    accounts/              # merchant identity and onboarding UI");
push("    merchant/              # merchant admin/dashboard UI");
push("    storefront/            # tenant storefront renderer and customer account");
push("    landing/               # marketing only");
push("    app-marketplace/       # app marketplace");
push("    theme-marketplace/     # theme marketplace");
push("    console/               # platform super-admin");
push("    team/                  # internal employee portal");
push("  flutter/");
push("    builder/");
push("    console/");
push("    team/");
push("backend/");
push("  workers/");
push("    api/                   # canonical /v1 API gateway");
push("    webhooks/              # provider webhooks only");
push("  supabase/");
push("packages/");
push("  contracts/               # generated TS + Dart API contracts");
push("  ui-web/                  # React UI tokens/components");
push("  ui-flutter/              # Flutter UI token/component parity");
push("  auth/");
push("  payments/");
push("  analytics/");
push("  config/");
push("docs/");
push("  architecture/");
push("```");
push("");
push("### Refactor Phases");
push("");
push("- Phase 0: freeze new app-local API/auth/payment duplication; fix typecheck/lint blockers; correct Flutter path dependencies.");
push("- Phase 1: centralize API contracts with generated TypeScript and Dart clients from worker Zod/OpenAPI source.");
push("- Phase 2: move business logic out of route handlers into worker services and app server utilities.");
push("- Phase 3: split web UI package into tokens, primitives, commerce components, admin data components, and storefront sections.");
push("- Phase 4: align Flutter models/services to generated contracts and remove Firebase/Firestore-only drift unless intentionally separate.");
push("- Phase 5: migrate alias directories into documentation-only compatibility or remove them after stable canonical paths are adopted.");
push("");

push("## SECTION 18 — AGENTS.md Generation");
push("");
push(`- AGENTS.md files present in current workspace: ${agentFiles.length}`);
push("- This report does not overwrite existing AGENTS.md files because the worktree already contains user-owned generated AGENTS files. It audits and inventories them below.");
push("");
for (const file of agentFiles) {
  const text = readText(path.join(root, file));
  push(`### \`${file}\``);
  push(`- Lines: ${lineCount(text)}`);
  push(`- Hash: ${sha(text)}`);
  push(`- First source-derived instructions: ${firstNonEmptyLines(text, 8).join(" | ") || "none"}`);
  push("");
}
push("### Generated Root AGENTS.md Operating Contract Requirements");
push("- Root AGENTS.md must name LetBuyy as a multi-tenant commerce/site-builder platform.");
push("- Root AGENTS.md must preserve `sites` database naming and `store` UI/URL naming.");
push("- Root AGENTS.md must require tenant isolation through `site_id`, `store_id`, `subdomain`, or explicit ownership checks.");
push("- App-level AGENTS.md files must state route counts, auth boundaries, tenant behavior, risk markers, and canonical ownership.");
push("- Package-level AGENTS.md files must state manifest name, local dependencies, exported contracts, schema ownership, and regeneration rules.");
push("");

push("## SECTION 19 — Future Roadmap");
push("");
push("### Immediate Stabilization Roadmap");
push("- Fix `backend/workers/api/src/routes/upload.ts` type error so root typecheck reaches all apps.");
push("- Fix ESLint 9 config circular failure in app-store and theme-marketplace so lint reaches all apps.");
push("- Correct Flutter path dependencies in `apps/flutter/builder/pubspec.yaml` or create compatibility package paths.");
push("- Resolve tenant/RLS/soft-delete gaps in migrations or document global/system tables explicitly.");
push("- Remove hardcoded payment key identifiers and consolidate payment provider config.");
push("");
push("### Synchronization Roadmap");
push("- Generate an API contract from worker schemas and produce TypeScript and Dart clients from one source.");
push("- Add contract tests comparing worker response shapes, TypeScript API types, and Dart models.");
push("- Move shared commerce state transitions into services with identical tests for web and Flutter clients.");
push("");
push("### Architecture Modernization Roadmap");
push("- Make the Cloudflare worker the canonical API owner for auth-adjacent, payment, order, product, customer, analytics, and tenant mutation flows.");
push("- Keep Next route handlers as BFF/proxy surfaces only where cookies or app-router integration require them.");
push("- Introduce package ownership boundaries for auth, payments, analytics, contracts, config, and UI tokens.");
push("");
push("### Design System Roadmap");
push("- Create shared semantic tokens and export them to CSS variables plus Flutter ThemeData.");
push("- Replace app-local duplicate UI primitives with `packages/typescript/ui` and `packages/dart/ui_kit` parity components.");
push("- Add visual regression coverage for storefront/theme/admin high-traffic screens.");
push("");
push("### Mobile Parity Roadmap");
push("- Fix Dart package paths, then run `flutter analyze` and `flutter test` cleanly.");
push("- Replace hand-maintained Dart models with generated models where possible.");
push("- Align mobile auth/session flow with the canonical merchant/customer auth boundaries.");
push("");
push("### AI Commerce Roadmap");
push("- Put AI features behind tenant-scoped APIs and usage metering.");
push("- Store prompts/results in auditable tenant-owned tables.");
push("- Build merchant-safe product/content generation with moderation, rate limits, and rollback.");
push("");

push("## Appendix A — Complete Source File Intelligence Catalog");
push("");
for (const summary of fileSummaries) {
  push(`### File \`${summary.file}\``);
  push(`- Area: ${summary.area}`);
  push(`- App root: \`${summary.appRoot}\``);
  push(`- Package root: \`${summary.packageRoot || "none"}\``);
  push(`- Extension: \`${summary.ext}\``);
  push(`- Lines: ${summary.lines}`);
  push(`- Bytes: ${summary.bytes}`);
  push(`- Hash: ${summary.hash}`);
  push(`- Next route: ${summary.nextRoute ? `${summary.nextRoute.kind}:${summary.nextRoute.route}` : "none"}`);
  push(`- Next handlers: ${summary.nextHandlers.join(", ") || "none"}`);
  push(`- Hono routes: ${summary.honoRoutes.map((route) => `${route.method} ${route.path}`).join(", ") || "none"}`);
  push(`- Hono mounts: ${summary.honoMounts.map((mount) => `${mount.path}->${mount.router}`).join(", ") || "none"}`);
  push(`- Imports: ${summary.imports.slice(0, 20).join(", ") || "none"}`);
  if (summary.imports.length > 20) push(`- Additional imports omitted in this file block: ${summary.imports.length - 20}`);
  push(`- Exports/classes: ${summary.exports.join(", ") || "none"}`);
  push(`- Env names: ${summary.envNames.join(", ") || "none"}`);
  push(`- DB refs: ${summary.dbRefs.join(", ") || "none"}`);
  push(`- Flags: ${summary.flags.join(", ") || "none"}`);
  push(`- Counts: TODO=${summary.counts.todos}; any=${summary.counts.any}; console=${summary.counts.console}; inlineStyles=${summary.counts.inlineStyles}; localStorage=${summary.counts.localStorage}; fetch=${summary.counts.fetchCalls}; supabaseFrom=${summary.counts.supabaseFrom}; zod=${summary.counts.zod}; colors=${summary.counts.colors}`);
  push(`- Leading code/content signals: ${summary.leading.join(" | ") || "none"}`);
  push(`- Auth posture: ${authPosture(summary)}`);
  push(`- Permission posture: ${permissionPosture(summary)}`);
  push(`- Tenant posture: ${summary.flags.includes("tenant/store identifier") ? "tenant/store identifier term detected" : "no tenant/store identifier term detected"}`);
  push(`- API posture: ${extractApiHints(summary)}`);
  push(`- Design posture: ${designPosture(summary)}`);
  push(`- Performance posture: ${performancePosture(summary)}`);
  push(`- Debt posture: ${debtPosture(summary)}`);
  push(`- Risk severity: ${riskSeverity(summary)}`);
  push("");
}

push("## Appendix B — Validation Command Outputs and Scan Artifacts");
push("");
appendValidationLog(lines, "npm typecheck wrapper output", "typecheck.log");
appendValidationLog(lines, "pnpm typecheck output", "typecheck.pnpm.log");
appendValidationLog(lines, "pnpm lint output", "lint.pnpm.log");
appendValidationLog(lines, "pnpm dependency list output", "dependencies.pnpm.log");
appendValidationLog(lines, "Flutter analyze sandbox failure output", "flutter-analyze.log");
appendValidationLog(lines, "Flutter analyze escalated output", "flutter-analyze.escalated.log");
appendValidationLog(lines, "Route file scan", "route-files.log");
appendValidationLog(lines, "Route analysis scan", "route-analysis.log");
appendValidationLog(lines, "Schema analysis scan", "schema-analysis.log");
appendValidationLog(lines, "TODO/FIXME scan", "todo-fixme-scan.log");
appendValidationLog(lines, "Hardcoded value scan", "hardcoded-values-scan.log");
appendValidationLog(lines, "Hardcoded color scan", "hardcoded-colors-scan.log");
appendValidationLog(lines, "Any/cast scan", "any-cast-scan.log");
appendValidationLog(lines, "Console output scan", "console-log-scan.log");
appendValidationLog(lines, "Dead code candidate scan", "dead-code-candidate-scan.log");
appendValidationLog(lines, "Duplicate logic candidate scan", "duplicate-logic-candidate-scan.log");

push("## Final Machine-Readable Counts");
push("");
push("```json");
push(...JSON.stringify({
  generatedAt: now,
  sourceFiles: sourceFiles.length,
  appsDocumented: appStats.length,
  screensDocumented: screens.length,
  apiRoutesDocumented: nextApiRoutes.length + honoRoutes.length + honoMounts.length,
  dbTablesDocumented: sql.tables.length,
  workersAnalyzed: fileSummaries.filter((summary) => summary.appRoot.startsWith("backend/workers/")).length,
  themeSystemsAnalyzed: themeFiles.length,
  checkoutFlowsAnalyzed: paymentFiles.length,
  securityFindings: securityFindings.length,
  tenantIsolationIssues: tenantFindings.length,
  technicalDebtItems: findings.length,
  contractMismatches: conflictingDeps.length + flutterSyncFindings.length,
  flutterWebSyncIssues: flutterSyncFindings.length,
  permissionGaps: permissionFindings.length,
  agentsMdFilesPresent: agentFiles.length,
  agentsMdFilesCreatedThisRun: 0,
  typeScriptErrorsFound: typeErrors,
  validationLogs: fs.existsSync(validationDir) ? fs.readdirSync(validationDir).filter((name) => name.endsWith(".log")).length : 0,
}, null, 2).split("\n"));
push("```");
push("");

let lineTotal = 0;
push("## Completion Banner");
push("");
push("```text");
push("╔══════════════════════════════════════════════════════════════════════╗");
push("║        LETBUYY STORE — MASTER REPOSITORY INTELLIGENCE COMPLETE     ║");
push("╠══════════════════════════════════════════════════════════════════════╣");
push(`║ Total lines generated:              ${String("PENDING").padEnd(29)}║`);
push(`║ Apps documented:                    ${String(appStats.length).padEnd(29)}║`);
push(`║ Screens documented:                 ${String(screens.length).padEnd(29)}║`);
push(`║ API routes documented:              ${String(nextApiRoutes.length + honoRoutes.length + honoMounts.length).padEnd(29)}║`);
push(`║ DB tables documented:               ${String(sql.tables.length).padEnd(29)}║`);
push(`║ Workers analyzed:                   ${String(fileSummaries.filter((summary) => summary.appRoot.startsWith("backend/workers/")).length).padEnd(29)}║`);
push(`║ Theme systems analyzed:             ${String(themeFiles.length).padEnd(29)}║`);
push(`║ Checkout flows analyzed:            ${String(paymentFiles.length).padEnd(29)}║`);
push(`║ Security findings:                  ${String(securityFindings.length).padEnd(29)}║`);
push(`║ Tenant isolation issues:            ${String(tenantFindings.length).padEnd(29)}║`);
push(`║ Technical debt items:               ${String(findings.length).padEnd(29)}║`);
push(`║ Contract mismatches:                ${String(conflictingDeps.length + flutterSyncFindings.length).padEnd(29)}║`);
push(`║ Flutter/Web sync issues:            ${String(flutterSyncFindings.length).padEnd(29)}║`);
push(`║ Permission gaps:                    ${String(permissionFindings.length).padEnd(29)}║`);
push(`║ AGENTS.md files created:            ${String(0).padEnd(29)}║`);
push(`║ TypeScript errors found:            ${String(typeErrors).padEnd(29)}║`);
push("╚══════════════════════════════════════════════════════════════════════╝");
push("```");
push("");

while (lines.at(-1) === "") lines.pop();

const bannerIndex = lines.findIndex((line) => line.includes("Total lines generated:"));
if (bannerIndex !== -1) {
  const provisional = `${lines.join("\n")}\n`;
  lineTotal = provisional.split("\n").length - 1;
  lines[bannerIndex] = `║ Total lines generated:              ${String(lineTotal).padEnd(29)}║`;
}

fs.mkdirSync(path.dirname(reportPath), { recursive: true });
const finalText = `${lines.join("\n")}\n`;
lineTotal = finalText.split("\n").length - 1;
if (bannerIndex !== -1) {
  lines[bannerIndex] = `║ Total lines generated:              ${String(lineTotal).padEnd(29)}║`;
}
fs.writeFileSync(reportPath, `${lines.join("\n")}\n`);
console.log(`Wrote ${rel(reportPath)} with ${lineTotal} lines`);
console.log(JSON.stringify({
  sourceFiles: sourceFiles.length,
  apps: appStats.length,
  screens: screens.length,
  apiRoutes: nextApiRoutes.length + honoRoutes.length + honoMounts.length,
  tables: sql.tables.length,
  findings: findings.length,
  typeErrors,
}, null, 2));
