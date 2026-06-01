#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, cpSync, openSync, closeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const runRoot = join(repoRoot, ".tmp", "federation-stack");
const supabaseProjectRoot = runRoot;
const supabaseConfigDir = join(runRoot, "supabase");
const logsDir = join(runRoot, "logs");
const pidsFile = join(runRoot, "pids.json");
const projectId = "letbuyy-federation-local";

const ports = {
  supabaseApi: 15421,
  supabaseDb: 15422,
  supabaseShadow: 15420,
  supabaseStudio: 15423,
  supabaseInbucket: 15424,
  supabaseSmtp: 15425,
  supabasePop3: 15426,
  supabaseAnalytics: 15427,
  supabasePooler: 15429,
  gateway: 8787,
};

const webApps = [
  { name: "marketing-site", cwd: "apps/marketing-site", url: "http://127.0.0.1:3000" },
  { name: "identity-platform", cwd: "apps/identity-platform", url: "http://127.0.0.1:3001" },
  { name: "merchant-control-plane", cwd: "apps/merchant-control-plane", url: "http://127.0.0.1:3002" },
  { name: "storefront-runtime", cwd: "apps/storefront-runtime", url: "http://127.0.0.1:3003" },
  { name: "app-marketplace", cwd: "apps/app-marketplace", url: "http://127.0.0.1:3004" },
  { name: "theme-marketplace", cwd: "apps/theme-marketplace", url: "http://127.0.0.1:3005" },
  { name: "platform-console", cwd: "apps/platform-console", url: "http://127.0.0.1:3010" },
  { name: "platform-operations-portal", cwd: "apps/platform-operations-portal", url: "http://127.0.0.1:3011" },
];

const localSecrets = {
  AUTH_SECRET: "local-auth-secret-change-me-32-bytes",
  CUSTOMER_SESSION_SECRET: "local-customer-session-secret-32",
  CSRF_SECRET: "local-csrf-secret-change-me-32-bytes",
  INTERNAL_API_SECRET: "local-internal-api-secret-32-bytes",
  PLATFORM_CONSOLE_API_TOKEN: "local-platform-console-token",
  PLATFORM_CONSOLE_SESSION_SECRET: "local-platform-console-session-secret",
  PLATFORM_CONSOLE_ALLOWED_EMAILS: "ops@letbuyy.local,partner@letbuyy.local",
  PLATFORM_CONSOLE_DEV_MFA_CODE: "123456",
  PAYMENT_CONFIG_ENCRYPTION_KEY: "0123456789abcdef0123456789abcdef",
  RAZORPAY_KEY_ID: "rzp_test_local",
  RAZORPAY_KEY_SECRET: "local_razorpay_secret",
  RAZORPAY_WEBHOOK_SECRET: "local_razorpay_webhook_secret",
  STRIPE_SECRET_KEY: "sk_test_local",
  PAYPAL_CLIENT_ID: "local-paypal-client",
  PAYPAL_CLIENT_SECRET: "local-paypal-secret",
  PAYPAL_MODE: "sandbox",
  RESEND_API_KEY: "local-resend-key",
  RESEND_FROM_EMAIL: "noreply@letbuyy.local",
  TURNSTILE_SECRET_KEY: "1x0000000000000000000000000000000AA",
  UPSTASH_REDIS_REST_URL: "http://127.0.0.1:63790",
  UPSTASH_REDIS_REST_TOKEN: "local-upstash-token",
};

function run(command, args, options = {}) {
  const printable = [command, ...args].join(" ");
  console.log(`[federation-stack] ${printable}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: options.env || process.env,
    stdio: options.stdio || "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`${printable} failed with status ${result.status}`);
  }
  return result;
}

function commandExists(command) {
  const result = spawnSync("command", ["-v", command], {
    shell: true,
    stdio: "ignore",
  });
  return result.status === 0;
}

function ensureDocker() {
  if (!commandExists("docker")) {
    throw new Error("Docker is required for the real local Supabase stack.");
  }

  const dockerInfo = spawnSync("docker", ["info"], { stdio: "ignore" });
  if (dockerInfo.status === 0) return;

  if (commandExists("colima")) {
    run("colima", ["start"]);
    const afterColima = spawnSync("docker", ["info"], { stdio: "ignore" });
    if (afterColima.status === 0) return;
  }

  throw new Error("Docker daemon is not running. Start Docker Desktop or Colima, then rerun this script.");
}

function prepareSupabaseProject() {
  rmSync(supabaseConfigDir, { recursive: true, force: true });
  mkdirSync(join(supabaseConfigDir, "migrations"), { recursive: true });
  mkdirSync(logsDir, { recursive: true });

  const migrationsSource = join(repoRoot, "database", "supabase", "migrations");
  cpSync(migrationsSource, join(supabaseConfigDir, "migrations"), { recursive: true });
  writeFileSync(
    join(supabaseConfigDir, "migrations", "011000_local_stack_schema_compatibility.sql"),
    localStackSchemaCompatibilityMigration(),
    "utf8",
  );

  writeFileSync(join(supabaseConfigDir, "config.toml"), supabaseConfig(), "utf8");
  writeFileSync(join(supabaseConfigDir, "seed.sql"), seedSql(), "utf8");
}

function localStackSchemaCompatibilityMigration() {
  return `-- Local federation stack compatibility migration.
-- The historical 004 migration is intentionally no-op because canonical storage
-- remains public.sites. Some later historical migrations still assume the old
-- 004 aliases. This temp-only migration keeps fresh local replay possible
-- without changing production migration history.
CREATE TABLE IF NOT EXISTS public.super_admin_allowlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    allowed_ips TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.super_admin_allowlist ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    target_table TEXT;
    tables_with_site_alias TEXT[] := ARRAY[
        'products',
        'orders',
        'coupons',
        'skills',
        'education',
        'testimonials',
        'work_experience',
        'certifications',
        'resume_versions',
        'leads',
        'lead_forms',
        'contacts',
        'pages',
        'shipping_zones',
        'analytics_events',
        'projects'
    ];
BEGIN
    FOREACH target_table IN ARRAY tables_with_site_alias
    LOOP
        IF to_regclass('public.' || target_table) IS NOT NULL THEN
            IF NOT EXISTS (
                SELECT 1
                  FROM information_schema.columns AS c
                 WHERE table_schema = 'public'
                   AND c.table_name = target_table
                   AND column_name = 'store_id'
            ) THEN
                EXECUTE format('ALTER TABLE public.%I ADD COLUMN store_id UUID REFERENCES public.sites(id) ON DELETE CASCADE', target_table);
            END IF;

            IF EXISTS (
                SELECT 1
                  FROM information_schema.columns AS c
                 WHERE table_schema = 'public'
                   AND c.table_name = target_table
                   AND column_name = 'site_id'
            ) THEN
                EXECUTE format('UPDATE public.%I SET store_id = site_id WHERE store_id IS NULL', target_table);
            END IF;
        END IF;
    END LOOP;
END $$;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seo_title TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS seo_description TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft';
UPDATE public.products
   SET slug = COALESCE(slug, lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))),
       store_id = COALESCE(store_id, site_id)
 WHERE slug IS NULL OR store_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_products_store ON public.products(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_store ON public.orders(store_id);

CREATE TABLE IF NOT EXISTS public.portfolio_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
    store_id UUID REFERENCES public.sites(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Untitled Project',
    description TEXT,
    live_url TEXT,
    project_url TEXT,
    thumbnail_url TEXT,
    cover_image TEXT,
    categories TEXT[] DEFAULT '{}',
    tags TEXT[] DEFAULT '{}',
    status TEXT DEFAULT 'draft',
    display_order INT DEFAULT 0,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_portfolio_projects_store ON public.portfolio_projects(store_id);
`;
}

function supabaseConfig() {
  return `project_id = "${projectId}"

[api]
enabled = true
port = ${ports.supabaseApi}
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = ${ports.supabaseDb}
shadow_port = ${ports.supabaseShadow}
major_version = 17

[db.pooler]
enabled = true
port = ${ports.supabasePooler}
pool_mode = "transaction"
default_pool_size = 15

[studio]
enabled = true
port = ${ports.supabaseStudio}
api_url = "http://127.0.0.1"

[inbucket]
enabled = true
port = ${ports.supabaseInbucket}
smtp_port = ${ports.supabaseSmtp}
pop3_port = ${ports.supabasePop3}

[storage]
enabled = true
file_size_limit = "50MiB"

[auth]
enabled = true
site_url = "http://localhost:3001"
additional_redirect_urls = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
  "http://localhost:3003",
  "http://localhost:3004",
  "http://localhost:3005",
  "http://localhost:3010",
  "http://localhost:3011"
]
jwt_expiry = 3600
enable_signup = true
enable_anonymous_sign_ins = false

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = false
otp_length = 6
otp_expiry = 300

[auth.external.google]
enabled = false

[auth.external.github]
enabled = false

[analytics]
enabled = true
port = ${ports.supabaseAnalytics}
backend = "postgres"
`;
}

function seedSql() {
  return `
INSERT INTO users (id, email, display_name, subscription_tier)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'merchant@letbuyy.local', 'Demo Merchant', 'business'),
  ('00000000-0000-4000-8000-000000000002', 'partner@letbuyy.local', 'Demo Partner', 'business'),
  ('00000000-0000-4000-8000-000000000003', 'ops@letbuyy.local', 'Demo Ops Reviewer', 'business')
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  display_name = EXCLUDED.display_name,
  subscription_tier = EXCLUDED.subscription_tier,
  updated_at = NOW();

INSERT INTO users_custom (id, email, full_name, email_verified)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'merchant@letbuyy.local', 'Demo Merchant', TRUE),
  ('00000000-0000-4000-8000-000000000002', 'partner@letbuyy.local', 'Demo Partner', TRUE),
  ('00000000-0000-4000-8000-000000000003', 'ops@letbuyy.local', 'Demo Ops Reviewer', TRUE)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  email_verified = EXCLUDED.email_verified,
  updated_at = NOW();

INSERT INTO sites (
  id, user_id, name, store_name, tagline, site_type, subdomain, theme_id,
  theme_settings, template_config, sections, status, published_at
)
VALUES (
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000001',
  'Urban Kicks Demo',
  'urban-kicks-demo',
  'India-first sneaker storefront',
  'ecommerce',
  'urban-kicks-demo',
  'urban-kicks',
  '{"colorScheme":"urban"}'::jsonb,
  '{}'::jsonb,
  '[]'::jsonb,
  'published',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  store_name = EXCLUDED.store_name,
  subdomain = EXCLUDED.subdomain,
  status = EXCLUDED.status,
  published_at = EXCLUDED.published_at,
  updated_at = NOW();

INSERT INTO products (
  id, store_id, name, slug, description, price, category, tags, stock,
  track_inventory, is_active, is_featured, display_order, status, hsn_code
)
VALUES
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000010',
    'Bengaluru Street Runner',
    'bengaluru-street-runner',
    'Breathable everyday sneaker for Indian streets.',
    2499,
    'Sneakers',
    ARRAY['sneakers','urban','india'],
    25,
    TRUE,
    TRUE,
    TRUE,
    1,
    'active',
    '640399'
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000010',
    'Mumbai Monsoon High Top',
    'mumbai-monsoon-high-top',
    'High-top sneaker with grippy wet-weather sole.',
    3199,
    'Sneakers',
    ARRAY['sneakers','monsoon','urban'],
    18,
    TRUE,
    TRUE,
    FALSE,
    2,
    'active',
    '640399'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  price = EXCLUDED.price,
  stock = EXCLUDED.stock,
  is_active = EXCLUDED.is_active,
  status = EXCLUDED.status,
  updated_at = NOW();

INSERT INTO app_developers (
  id, user_id, company_name, slug, website_url, support_email, description, verified, status, country
)
VALUES (
  '00000000-0000-4000-8000-000000000201',
  '00000000-0000-4000-8000-000000000002',
  'LetBuyy Demo Partner',
  'letbuyy-demo-partner',
  'https://partner.localhost',
  'support@partner.local',
  'Demo partner for local federation testing.',
  TRUE,
  'approved',
  'IN'
)
ON CONFLICT (id) DO UPDATE SET
  company_name = EXCLUDED.company_name,
  status = EXCLUDED.status,
  verified = EXCLUDED.verified,
  updated_at = NOW();

INSERT INTO marketplace_apps (
  id, developer_id, slug, name, tagline, description, status, pricing_model,
  price_inr, category_id, api_scopes, oauth_client_id, oauth_redirect_uris,
  webhook_url, supported_site_types, version
)
SELECT
  '00000000-0000-4000-8000-000000000202',
  '00000000-0000-4000-8000-000000000201',
  'demo-loyalty-rewards',
  'Demo Loyalty Rewards',
  'Reward repeat shoppers in INR.',
  'Local demo app for cross-app federation.',
  'published',
  'free',
  0,
  (SELECT id FROM app_categories WHERE slug = 'marketing' LIMIT 1),
  ARRAY['read_products','write_orders'],
  'demo-loyalty-rewards-client',
  ARRAY['http://127.0.0.1:3004/oauth/callback'],
  'http://127.0.0.1:8787/local-webhook-receiver',
  ARRAY['ecommerce'],
  '1.0.0'
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  api_scopes = EXCLUDED.api_scopes,
  webhook_url = EXCLUDED.webhook_url,
  updated_at = NOW();
`;
}

function parseSupabaseStatus() {
  const status = run("supabase", ["status", "--workdir", supabaseProjectRoot, "-o", "json"], {
    stdio: "pipe",
  });
  const parsed = JSON.parse(status.stdout);
  return {
    apiUrl: parsed.API_URL || parsed.api_url || `http://127.0.0.1:${ports.supabaseApi}`,
    anonKey: parsed.ANON_KEY || parsed.anon_key,
    serviceRoleKey: parsed.SERVICE_ROLE_KEY || parsed.service_role_key,
  };
}

function writeGatewayVars(keys) {
  const varsPath = join(repoRoot, "services", "api-gateway", ".dev.vars");
  const values = {
    ...localSecrets,
    SUPABASE_URL: keys.apiUrl,
    SUPABASE_ANON_KEY: keys.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: keys.serviceRoleKey,
  };
  writeFileSync(varsPath, Object.entries(values).map(([key, value]) => `${key}="${value}"`).join("\n") + "\n", "utf8");
}

function processEnv(keys) {
  return {
    ...process.env,
    ...localSecrets,
    NODE_ENV: "development",
    NEXT_PUBLIC_SUPABASE_URL: keys.apiUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: keys.anonKey,
    SUPABASE_URL: keys.apiUrl,
    SUPABASE_ANON_KEY: keys.anonKey,
    SUPABASE_SERVICE_ROLE_KEY: keys.serviceRoleKey,
    LETBUYY_API_URL: `http://127.0.0.1:${ports.gateway}/v1`,
    LETBUYY_API_BASE_URL: `http://127.0.0.1:${ports.gateway}/v1`,
    NEXT_PUBLIC_API_URL: `http://127.0.0.1:${ports.gateway}/v1`,
    NEXT_PUBLIC_API_BASE_URL: `http://127.0.0.1:${ports.gateway}/v1`,
    NEXT_PUBLIC_ACCOUNTS_URL: "http://127.0.0.1:3001",
    NEXT_PUBLIC_ADMIN_URL: "http://127.0.0.1:3002",
    NEXT_PUBLIC_STOREFRONT_URL: "http://127.0.0.1:3003",
    NEXT_PUBLIC_STOREFRONT_LOCAL_URL: "http://127.0.0.1:3003",
    NEXT_PUBLIC_DEFAULT_STORE_SUBDOMAIN: "urban-kicks-demo",
  };
}

function startProcess(name, cwd, command, args, env) {
  const out = openSync(join(logsDir, `${name}.log`), "a");
  const err = openSync(join(logsDir, `${name}.error.log`), "a");
  const child = spawn(command, args, {
    cwd: join(repoRoot, cwd),
    env,
    detached: true,
    stdio: ["ignore", out, err],
  });
  child.unref();
  closeSync(out);
  closeSync(err);
  console.log(`[federation-stack] started ${name} pid=${child.pid}`);
  return { name, pid: child.pid, cwd, command, args, logs: [`${name}.log`, `${name}.error.log`] };
}

async function waitFor(name, url, predicate = (response, body) => response.ok || body.includes("<!DOCTYPE html>")) {
  const startedAt = Date.now();
  let lastError = "";
  while (Date.now() - startedAt < 120_000) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      const body = await response.text();
      if (predicate(response, body)) {
        console.log(`[federation-stack] ${name} ready ${response.status} ${url}`);
        return { status: response.status, body };
      }
      lastError = `${response.status} ${body.slice(0, 120)}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 2000));
  }
  throw new Error(`${name} did not become ready at ${url}: ${lastError}`);
}

async function main() {
  if (!commandExists("supabase")) throw new Error("Supabase CLI is required.");
  if (!commandExists("pnpm")) throw new Error("pnpm is required.");

  ensureDocker();
  prepareSupabaseProject();

  run("supabase", ["stop", "--project-id", projectId, "--no-backup"], { stdio: "ignore" });
  run("supabase", ["start", "--workdir", supabaseProjectRoot]);
  run("supabase", ["db", "reset", "--workdir", supabaseProjectRoot, "--local", "--no-seed"]);
  run("supabase", ["db", "query", "--workdir", supabaseProjectRoot, "--local", "--file", join(supabaseConfigDir, "seed.sql")]);

  const keys = parseSupabaseStatus();
  if (!keys.anonKey || !keys.serviceRoleKey) {
    throw new Error("Supabase status did not expose local anon/service-role keys.");
  }
  writeGatewayVars(keys);

  const env = processEnv(keys);
  const processes = [];
  processes.push(startProcess("api-gateway", "services/api-gateway", "pnpm", ["dev"], env));
  for (const app of webApps) {
    processes.push(startProcess(app.name, app.cwd, "pnpm", ["dev"], env));
  }
  writeFileSync(pidsFile, JSON.stringify({ projectId, supabaseProjectRoot, logsDir, processes }, null, 2), "utf8");

  await waitFor("api-gateway", `http://127.0.0.1:${ports.gateway}/health`, (response, body) => response.ok && body.includes("healthy"));
  const productProof = await waitFor(
    "seeded product query",
    `http://127.0.0.1:${ports.gateway}/v1/storefront/urban-kicks-demo/products?limit=1`,
    (response, body) => response.ok && body.includes("Bengaluru Street Runner"),
  );
  writeFileSync(join(runRoot, "product-query-proof.json"), productProof.body, "utf8");

  for (const app of webApps) {
    await waitFor(app.name, app.url);
  }

  console.log(`[federation-stack] real local stack is up. Logs: ${logsDir}`);
}

main().catch((error) => {
  console.error(`[federation-stack] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
