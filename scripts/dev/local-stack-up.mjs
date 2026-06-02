#!/usr/bin/env node
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync, cpSync, openSync, closeSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
const runRoot = join(repoRoot, ".tmp", "federation-stack");
const supabaseProjectRoot = runRoot;
const supabaseConfigDir = join(runRoot, "supabase");
const supabaseHome = join(runRoot, "home");
const seedSqlPath = join(runRoot, "seed.sql");
const logsDir = join(runRoot, "logs");
const pidsFile = join(runRoot, "pids.json");
const projectId = "letbuyy-federation-local";
const supabaseCliEnv = {
  ...process.env,
  HOME: supabaseHome,
  XDG_CONFIG_HOME: join(supabaseHome, ".config"),
};

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

function localValue(label) {
  return `local-${label}-placeholder`;
}

function localHex32() {
  return Array.from({ length: 32 }, (_, index) => (index % 16).toString(16)).join("");
}

const localSecrets = {
  AUTH_SECRET: localValue("auth"),
  CUSTOMER_SESSION_SECRET: localValue("customer-session"),
  CSRF_SECRET: localValue("csrf"),
  INTERNAL_API_SECRET: localValue("internal-api"),
  PLATFORM_CONSOLE_API_TOKEN: localValue("platform-console-token"),
  PLATFORM_CONSOLE_SESSION_SECRET: localValue("platform-console-session"),
  PLATFORM_CONSOLE_ALLOWED_EMAILS: "ops@letbuyy.local,partner@letbuyy.local",
  PLATFORM_CONSOLE_DEV_MFA_CODE: "123456",
  PAYMENT_CONFIG_ENCRYPTION_KEY: localHex32(),
  RAZORPAY_KEY_ID: ["rzp", "test", "local"].join("_"),
  RAZORPAY_KEY_SECRET: localValue("razorpay"),
  RAZORPAY_WEBHOOK_SECRET: localValue("razorpay-webhook"),
  STRIPE_SECRET_KEY: ["sk", "test", "local"].join("_"),
  PAYPAL_CLIENT_ID: "local-paypal-client",
  PAYPAL_CLIENT_SECRET: localValue("paypal-client"),
  PAYPAL_MODE: "sandbox",
  RESEND_API_KEY: localValue("resend-api"),
  RESEND_FROM_EMAIL: "noreply@letbuyy.local",
  TURNSTILE_SECRET_KEY: ["1x", "0".repeat(30), "AA"].join(""),
  UPSTASH_REDIS_REST_URL: "http://127.0.0.1:63790",
  UPSTASH_REDIS_REST_TOKEN: localValue("upstash-rest"),
};

function parseNodeMajor(version) {
  const match = /^v?(\d+)\./.exec(version.trim());
  return match ? Number.parseInt(match[1], 10) : 0;
}

function nodeMajorFor(binary, env = process.env) {
  const result = spawnSync(binary, ["--version"], {
    cwd: repoRoot,
    env,
    encoding: "utf8",
    stdio: "pipe",
  });
  return result.status === 0 ? parseNodeMajor(result.stdout) : 0;
}

function detectModernNodeBin() {
  const currentMajor = nodeMajorFor("node");
  if (currentMajor >= 22) return dirname(process.execPath);

  const home = process.env.HOME || "";
  const candidates = [
    process.env.LETBUYY_LOCAL_NODE_BIN,
    join(home, ".cache", "codex-runtimes", "codex-primary-runtime", "dependencies", "node", "bin"),
    "/opt/homebrew/opt/node@24/bin",
    "/opt/homebrew/opt/node@22/bin",
    "/usr/local/opt/node@24/bin",
    "/usr/local/opt/node@22/bin",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const nodePath = join(candidate, "node");
    if (existsSync(nodePath) && nodeMajorFor(nodePath) >= 22) {
      return candidate;
    }
  }

  return undefined;
}

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

function runOptional(command, args, options = {}) {
  const printable = [command, ...args].join(" ");
  console.log(`[federation-stack] ${printable}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: options.env || process.env,
    stdio: options.stdio || "inherit",
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.warn(`[federation-stack] ${printable} exited with status ${result.status}; continuing`);
  }
  return result;
}

function runWithInput(command, args, input, options = {}) {
  const printable = [command, ...args].join(" ");
  console.log(`[federation-stack] ${printable}`);
  const result = spawnSync(command, args, {
    cwd: options.cwd || repoRoot,
    env: options.env || process.env,
    input,
    stdio: ["pipe", "inherit", "inherit"],
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

function detectDockerHost() {
  const result = spawnSync("docker", ["context", "inspect", "--format", "{{.Endpoints.docker.Host}}"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "pipe",
  });
  const host = result.stdout?.trim();
  return result.status === 0 && host ? host : process.env.DOCKER_HOST;
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
  mkdirSync(supabaseHome, { recursive: true });
  mkdirSync(logsDir, { recursive: true });

  const migrationsSource = join(repoRoot, "database", "supabase", "migrations");
  cpSync(migrationsSource, join(supabaseConfigDir, "migrations"), { recursive: true });

  writeFileSync(join(supabaseConfigDir, "config.toml"), supabaseConfig(), "utf8");
  writeFileSync(seedSqlPath, seedSql(), "utf8");
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
enabled = false
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

INSERT INTO super_admin_allowlist (id, user_id, email, full_name, is_active, two_factor_enabled)
VALUES (
  '00000000-0000-4000-8000-000000000004',
  NULL,
  'ops@letbuyy.local',
  'Demo Ops Reviewer',
  TRUE,
  FALSE
)
ON CONFLICT (id) DO UPDATE SET
  user_id = EXCLUDED.user_id,
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  is_active = EXCLUDED.is_active,
  two_factor_enabled = EXCLUDED.two_factor_enabled,
  updated_at = NOW();

INSERT INTO app_categories (id, name, slug, description, icon, sort_order, is_active)
VALUES
  (
    '00000000-0000-4000-8000-000000000200',
    'Marketing',
    'marketing',
    'Customer engagement and growth apps for local federation testing.',
    'megaphone',
    10,
    TRUE
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active;

INSERT INTO themes (
  id, name, slug, site_type, category, description, preview_url, thumbnail_url,
  is_premium, price, config, author, version, is_active, sort_order,
  long_description, industry, letbuyy_pricing_type, letbuyy_price_inr,
  screenshots, demo_url, features, supported_site_types, tags, rating_avg,
  review_count, default_template, section_schemas, block_schemas,
  settings_schema, renderer_manifest
)
VALUES
  (
    '00000000-0000-4000-8000-000000000300',
    'Urban Kicks',
    'urban-kicks',
    'store',
    'commerce',
    'Premium storefront theme for India-first sneaker and fashion stores.',
    'http://127.0.0.1:3003',
    '/themes/urban-kicks/thumbnail.png',
    FALSE,
    0,
    '{"colors":{"primary":"#111827","accent":"#f97316","background":"#ffffff","text":"#111827"},"fonts":{"body":"LetBuyy Sans","heading":"LetBuyy Display"}}'::jsonb,
    'LetBuyy',
    '1.0.0',
    TRUE,
    1,
    'A dense, polished commerce theme tuned for product discovery and checkout conversion.',
    ARRAY['fashion','footwear','lifestyle'],
    'free',
    0,
    ARRAY['/themes/urban-kicks/screenshot-1.png'],
    'http://127.0.0.1:3003',
    ARRAY['Product grid','Cart ready','GST-ready checkout'],
    ARRAY['store'],
    ARRAY['commerce','india','premium'],
    4.80,
    24,
    '{"template":"storefront"}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    '{"renderer":"storefront-runtime","version":"1.0.0"}'::jsonb
  ),
  (
    '00000000-0000-4000-8000-000000000301',
    'Minimal Commerce',
    'minimal-commerce',
    'store',
    'commerce',
    'Clean catalog-first commerce theme for small Indian merchants.',
    'http://127.0.0.1:3003?theme=minimal-commerce',
    '/themes/minimal-commerce/thumbnail.png',
    FALSE,
    0,
    '{"colors":{"primary":"#0f766e","accent":"#ca8a04","background":"#fafafa","text":"#111827"},"fonts":{"body":"LetBuyy Sans","heading":"LetBuyy Display"}}'::jsonb,
    'LetBuyy',
    '1.0.0',
    TRUE,
    2,
    'A restrained storefront theme for fast browsing, clear pricing, and repeat operations.',
    ARRAY['general','retail','grocery'],
    'free',
    0,
    ARRAY['/themes/minimal-commerce/screenshot-1.png'],
    'http://127.0.0.1:3003?theme=minimal-commerce',
    ARRAY['Responsive catalog','Fast checkout','Theme marketplace ready'],
    ARRAY['store'],
    ARRAY['commerce','minimal','india'],
    4.60,
    18,
    '{"template":"storefront"}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    '{}'::jsonb,
    '{"renderer":"storefront-runtime","version":"1.0.0"}'::jsonb
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  site_type = EXCLUDED.site_type,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order,
  letbuyy_pricing_type = EXCLUDED.letbuyy_pricing_type,
  letbuyy_price_inr = EXCLUDED.letbuyy_price_inr,
  supported_site_types = EXCLUDED.supported_site_types,
  tags = EXCLUDED.tags,
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
  'store',
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
  site_type = EXCLUDED.site_type,
  subdomain = EXCLUDED.subdomain,
  theme_id = EXCLUDED.theme_id,
  status = EXCLUDED.status,
  published_at = EXCLUDED.published_at,
  updated_at = NOW();

INSERT INTO store_themes (id, store_id, theme_id, is_active, config_overrides)
VALUES (
  '00000000-0000-4000-8000-000000000302',
  '00000000-0000-4000-8000-000000000010',
  '00000000-0000-4000-8000-000000000300',
  TRUE,
  '{"colorScheme":"urban"}'::jsonb
)
ON CONFLICT (store_id, theme_id) DO UPDATE SET
  is_active = EXCLUDED.is_active,
  config_overrides = EXCLUDED.config_overrides,
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

INSERT INTO inventory_locations (id, store_id, name, address, is_default, status)
VALUES (
  '00000000-0000-4000-8000-000000000110',
  '00000000-0000-4000-8000-000000000010',
  'Urban Kicks Bengaluru Warehouse',
  '{"address":"42 Commerce Street","city":"Bengaluru","state":"Karnataka","state_code":"29","pincode":"560001","country":"IN"}'::jsonb,
  TRUE,
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  is_default = EXCLUDED.is_default,
  status = EXCLUDED.status;

INSERT INTO inventory_levels (
  id, product_id, location_id, available, reserved, incoming,
  on_hand_quantity, available_quantity, committed_quantity,
  unavailable_quantity, incoming_quantity, reserved_quantity
)
VALUES
  (
    '00000000-0000-4000-8000-000000000111',
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000110',
    25,
    0,
    0,
    25,
    25,
    0,
    0,
    0,
    0
  ),
  (
    '00000000-0000-4000-8000-000000000112',
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000110',
    18,
    0,
    0,
    18,
    18,
    0,
    0,
    0,
    0
  )
ON CONFLICT (id) DO UPDATE SET
  available = EXCLUDED.available,
  reserved = EXCLUDED.reserved,
  incoming = EXCLUDED.incoming,
  on_hand_quantity = EXCLUDED.on_hand_quantity,
  available_quantity = EXCLUDED.available_quantity,
  committed_quantity = EXCLUDED.committed_quantity,
  unavailable_quantity = EXCLUDED.unavailable_quantity,
  incoming_quantity = EXCLUDED.incoming_quantity,
  reserved_quantity = EXCLUDED.reserved_quantity,
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
  ARRAY['store'],
  '1.0.0'
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  api_scopes = EXCLUDED.api_scopes,
  webhook_url = EXCLUDED.webhook_url,
  updated_at = NOW();

INSERT INTO app_extensions (
  id, app_id, type, target, label, config, sort_order
)
VALUES
  (
    '00000000-0000-4000-8000-000000000203',
    '00000000-0000-4000-8000-000000000202',
    'settings_page',
    'http://127.0.0.1:3002/apps/demo-loyalty-rewards',
    'Demo Loyalty Rewards',
    '{"capabilities":["api:fetch","toast","navigation"]}'::jsonb,
    10
  ),
  (
    '00000000-0000-4000-8000-000000000204',
    '00000000-0000-4000-8000-000000000202',
    'storefront_block',
    'apps.app-block-slot',
    'Demo Loyalty Rewards Block',
    '{"slot":"product-below-price","heading":"Rewards available","description":"Earn demo loyalty points on this order."}'::jsonb,
    20
  )
ON CONFLICT (id) DO UPDATE SET
  target = EXCLUDED.target,
  label = EXCLUDED.label,
  config = EXCLUDED.config,
  sort_order = EXCLUDED.sort_order;
`;
}

function parseSupabaseStatus() {
  const status = run("supabase", ["status", "--workdir", supabaseProjectRoot, "-o", "json"], {
    env: supabaseCliEnv,
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
  const modernNodeBin = detectModernNodeBin();
  return {
    ...process.env,
    ...localSecrets,
    ...(modernNodeBin ? { PATH: `${modernNodeBin}:${process.env.PATH || ""}` } : {}),
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
  const dockerHost = detectDockerHost();
  if (dockerHost) {
    supabaseCliEnv.DOCKER_HOST = dockerHost;
  }
  prepareSupabaseProject();

  runOptional("supabase", ["stop", "--project-id", projectId, "--no-backup"], { env: supabaseCliEnv, stdio: "ignore" });
  run("supabase", ["start", "--workdir", supabaseProjectRoot], { env: supabaseCliEnv });
  run("supabase", ["db", "reset", "--workdir", supabaseProjectRoot, "--local", "--no-seed"], { env: supabaseCliEnv });
  runWithInput(
    "docker",
    ["exec", "-i", `supabase_db_${projectId}`, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-f", "-"],
    seedSql(),
    { env: supabaseCliEnv },
  );

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
