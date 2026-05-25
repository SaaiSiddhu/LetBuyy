# LetBuyy Platform — Shopify-Inspired Comprehensive Analysis

> **Part 7 of 8** | Deployment & Migration Strategy — Complete Implementation Guide
>
> **Date:** February 13, 2026 | **Version:** 4.0 (Shopify-Inspired Rebuild)
>
> **Prev:** [Part 6](./Shopify_Inspired_Analysis_Part6_AdminDashboards.md) | **Next:** Part 8 (Implementation Roadmap)

---

## 26. Pre-Deployment Checklist

### 26.1 Environment Preparation

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PRE-DEPLOYMENT ENVIRONMENT CHECKLIST                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  DOMAIN & DNS                                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ☐ Domain registered: letbuyy.store                                     │  │
│  │ ☐ Cloudflare account created                                           │  │
│  │ ☐ Domain added to Cloudflare                                           │  │
│  │ ☐ Nameservers updated at registrar                                     │  │
│  │ ☐ DNS propagation verified (24-48 hours)                               │  │
│  │ ☐ SSL/TLS mode set to "Full (strict)"                                  │  │
│  │ ☐ Always Use HTTPS enabled                                             │  │
│  │ ☐ HSTS enabled (6 months, include subdomains, preload)                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  HOSTING & INFRASTRUCTURE                                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ☐ Vercel account created                                               │  │
│  │ ☐ GitHub organization/repo created                                     │  │
│  │ ☐ Vercel connected to GitHub                                           │  │
│  │ ☐ Supabase project created                                             │  │
│  │ ☐ Razorpay/Stripe account setup                                        │  │
│  │ ☐ Resend account created for emails                                    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  DEVELOPMENT TOOLS                                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ☐ Node.js 20.x installed                                               │  │
│  │ ☐ pnpm package manager installed                                       │  │
│  │ ☐ Git configured with SSH keys                                         │  │
│  │ ☐ Code editor setup (VS Code recommended)                              │  │
│  │ ☐ Supabase CLI installed                                               │  │
│  │ ☐ Vercel CLI installed                                                 │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  SECURITY & SECRETS                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ☐ Supabase project URL & anon key copied                               │  │
│  │ ☐ Supabase service role key secured                                    │  │
│  │ ☐ Razorpay key_id & key_secret obtained                                │  │
│  │ ☐ Resend API key generated                                             │  │
│  │ ☐ .env.example file created                                            │  │
│  │ ☐ Environment variables documented                                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 27. Phase 1: DNS & SSL Configuration (Day 1)

### 27.1 Cloudflare DNS Setup

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    STEP-BY-STEP: CLOUDFLARE DNS SETUP                        │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: Add Domain to Cloudflare                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Login to Cloudflare Dashboard                                       │  │
│  │ 2. Click "Add Site"                                                    │  │
│  │ 3. Enter: letbuyy.store                                                │  │
│  │ 4. Select Free Plan                                                    │  │
│  │ 5. Click "Add Site"                                                    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STEP 2: Update Nameservers                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Cloudflare will provide 2 nameservers like:                            │  │
│  │ • alice.ns.cloudflare.com                                              │  │
│  │ • bob.ns.cloudflare.com                                                │  │
│  │                                                                        │  │
│  │ Update these at your domain registrar (GoDaddy, Namecheap, etc.)      │  │
│  │                                                                        │  │
│  │ ⏱️ Wait 24-48 hours for DNS propagation                               │  │
│  │ ✅ Verify with: dig letbuyy.store NS +short                           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STEP 3: Create DNS Records                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                        │  │
│  │ Record 1: Root Domain                                                  │  │
│  │ ├─ Type: A                                                             │  │
│  │ ├─ Name: @                                                             │  │
│  │ ├─ IPv4 address: 76.76.21.21 (Vercel)                                 │  │
│  │ ├─ Proxy status: DNS only (gray cloud ☁️)                             │  │
│  │ └─ TTL: Auto                                                           │  │
│  │                                                                        │  │
│  │ Record 2: accounts subdomain                                           │  │
│  │ ├─ Type: CNAME                                                         │  │
│  │ ├─ Name: accounts                                                      │  │
│  │ ├─ Target: cname.vercel-dns.com                                       │  │
│  │ ├─ Proxy status: DNS only (gray cloud ☁️)                             │  │
│  │ └─ TTL: Auto                                                           │  │
│  │                                                                        │  │
│  │ Record 3: admin subdomain                                              │  │
│  │ ├─ Type: CNAME                                                         │  │
│  │ ├─ Name: admin                                                         │  │
│  │ ├─ Target: cname.vercel-dns.com                                       │  │
│  │ ├─ Proxy status: DNS only (gray cloud ☁️)                             │  │
│  │ └─ TTL: Auto                                                           │  │
│  │                                                                        │  │
│  │ Record 4: console subdomain                                            │  │
│  │ ├─ Type: CNAME                                                         │  │
│  │ ├─ Name: console                                                       │  │
│  │ ├─ Target: cname.vercel-dns.com                                       │  │
│  │ ├─ Proxy status: DNS only (gray cloud ☁️)                             │  │
│  │ └─ TTL: Auto                                                           │  │
│  │                                                                        │  │
│  │ Record 5: team subdomain                                               │  │
│  │ ├─ Type: CNAME                                                         │  │
│  │ ├─ Name: team                                                          │  │
│  │ ├─ Target: cname.vercel-dns.com                                       │  │
│  │ ├─ Proxy status: DNS only (gray cloud ☁️)                             │  │
│  │ └─ TTL: Auto                                                           │  │
│  │                                                                        │  │
│  │ ⚠️  Record 6: WILDCARD subdomain (CRITICAL)                           │  │
│  │ ├─ Type: CNAME                                                         │  │
│  │ ├─ Name: *                                                             │  │
│  │ ├─ Target: cname.vercel-dns.com                                       │  │
│  │ ├─ Proxy status: DNS only (gray cloud ☁️) ← MUST be DNS only         │  │
│  │ └─ TTL: Auto                                                           │  │
│  │                                                                        │  │
│  │ Record 7: api subdomain                                                │  │
│  │ ├─ Type: AAAA                                                          │  │
│  │ ├─ Name: api                                                           │  │
│  │ ├─ IPv6: 100:: (Cloudflare Workers)                                   │  │
│  │ ├─ Proxy status: Proxied (orange cloud 🟠) ← MUST be proxied         │  │
│  │ └─ TTL: Auto                                                           │  │
│  │                                                                        │  │
│  │ Record 8: webhooks subdomain                                           │  │
│  │ ├─ Type: AAAA                                                          │  │
│  │ ├─ Name: webhooks                                                      │  │
│  │ ├─ IPv6: 100:: (Cloudflare Workers)                                   │  │
│  │ ├─ Proxy status: Proxied (orange cloud 🟠) ← MUST be proxied         │  │
│  │ └─ TTL: Auto                                                           │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STEP 4: SSL/TLS Configuration                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Navigate to: SSL/TLS > Overview                                        │  │
│  │                                                                        │  │
│  │ 1. Encryption mode: Full (strict) ✅                                   │  │
│  │ 2. Always Use HTTPS: ON ✅                                             │  │
│  │ 3. Minimum TLS Version: 1.2 ✅                                         │  │
│  │ 4. TLS 1.3: ON ✅                                                      │  │
│  │ 5. Automatic HTTPS Rewrites: ON ✅                                     │  │
│  │                                                                        │  │
│  │ Navigate to: SSL/TLS > Edge Certificates                               │  │
│  │                                                                        │  │
│  │ 6. HSTS Settings:                                                      │  │
│  │    ├─ Enable HSTS: ON ✅                                               │  │
│  │    ├─ Max Age: 6 months (15768000 seconds)                            │  │
│  │    ├─ Include subdomains: ON ✅                                        │  │
│  │    ├─ Preload: ON ✅                                                   │  │
│  │    └─ No-Sniff: ON ✅                                                  │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  VERIFICATION COMMANDS:                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ # Check DNS propagation                                                │  │
│  │ $ dig letbuyy.store +short                                             │  │
│  │ $ dig accounts.letbuyy.store +short                                    │  │
│  │ $ dig random-subdomain.letbuyy.store +short  # Test wildcard          │  │
│  │                                                                        │  │
│  │ # Check SSL                                                            │  │
│  │ $ curl -I https://letbuyy.store                                        │  │
│  │ # Should see: HTTP/2 200 with security headers                        │  │
│  │                                                                        │  │
│  │ # Verify HSTS                                                          │  │
│  │ $ curl -I https://letbuyy.store | grep -i strict                      │  │
│  │ # Should see: strict-transport-security header                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 28. Phase 2: Database Setup (Day 1-2)

### 28.1 Supabase Project Creation

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    STEP-BY-STEP: SUPABASE SETUP                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: Create Project                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Login to https://supabase.com                                       │  │
│  │ 2. Click "New Project"                                                 │  │
│  │ 3. Organization: Select or create new                                  │  │
│  │ 4. Project name: letbuyy-production                                    │  │
│  │ 5. Database password: [Generate strong password]                       │  │
│  │    ⚠️  SAVE THIS PASSWORD SECURELY                                    │  │
│  │ 6. Region: Southeast Asia (Singapore) - closest to users              │  │
│  │ 7. Pricing plan: Pro ($25/mo recommended for production)              │  │
│  │ 8. Click "Create new project"                                          │  │
│  │                                                                        │  │
│  │ ⏱️ Wait 2-5 minutes for project provisioning                          │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STEP 2: Collect Project Credentials                                         │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Navigate to: Project Settings > API                                    │  │
│  │                                                                        │  │
│  │ Copy the following (store in password manager):                        │  │
│  │                                                                        │  │
│  │ 1. Project URL:                                                        │  │
│  │    https://[project-ref].supabase.co                                   │  │
│  │                                                                        │  │
│  │ 2. Anon (public) key:                                                  │  │
│  │    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...                             │  │
│  │    (Use in frontend - safe to expose)                                  │  │
│  │                                                                        │  │
│  │ 3. Service role key:                                                   │  │
│  │    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...                             │  │
│  │    ⚠️  NEVER expose this in frontend!                                 │  │
│  │    (Only use in API routes/server functions)                           │  │
│  │                                                                        │  │
│  │ 4. Database connection string:                                         │  │
│  │    Navigate to: Project Settings > Database                            │  │
│  │    Copy: Connection string (for migrations)                            │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 28.2 Run Database Migrations

```bash
# ============================================
# DATABASE MIGRATION EXECUTION SCRIPT
# ============================================

# Step 1: Install Supabase CLI (if not already installed)
npm install -g supabase

# Step 2: Login to Supabase
supabase login

# Step 3: Link local project to remote
supabase link --project-ref [your-project-ref]
# You'll be prompted for the database password

# Step 4: Create migrations directory
mkdir -p supabase/migrations

# Step 5: Copy migration files
# Copy all 5 migration files from Part 5 to supabase/migrations/

# Migration files should be named:
# 20260213000001_extend_stores_table.sql
# 20260213000002_create_payment_tables.sql
# 20260213000003_create_onboarding_tables.sql
# 20260213000004_create_email_notifications.sql
# 20260213000005_row_level_security.sql

# Step 6: Review migrations locally (optional but recommended)
supabase db diff --schema public

# Step 7: Push migrations to remote database
supabase db push

# Expected output:
# Applying migration 20260213000001_extend_stores_table.sql...
# Applying migration 20260213000002_create_payment_tables.sql...
# Applying migration 20260213000003_create_onboarding_tables.sql...
# Applying migration 20260213000004_create_email_notifications.sql...
# Applying migration 20260213000005_row_level_security.sql...
# ✅ All migrations applied successfully!

# Step 8: Verify migrations
supabase db diff --schema public
# Should show: No schema changes detected

# Step 9: Test RLS policies
# Run this SQL in Supabase SQL Editor:
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public';

# Should show all RLS policies from migration 005

# Step 10: Verify helper functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
  AND routine_type = 'FUNCTION';

# Should show:
# - set_trial_dates
# - update_updated_at_column
# - get_trial_days_left
# - should_deactivate_store
# - deactivate_expired_trials
# - get_store_config
# - get_active_payment_method
# - record_payment_transaction
```

### 28.3 Seed Initial Data (Optional)

```sql
-- ============================================
-- SEED DATA FOR TESTING
-- File: supabase/seed.sql
-- ============================================

-- Insert test currencies
INSERT INTO currencies (code, symbol, name, exchange_rate, is_active) VALUES
  ('INR', '₹', 'Indian Rupee', 1.00, true),
  ('USD', '$', 'US Dollar', 0.012, true),
  ('EUR', '€', 'Euro', 0.011, true),
  ('GBP', '£', 'British Pound', 0.0095, true),
  ('AED', 'د.إ', 'UAE Dirham', 0.044, false)
ON CONFLICT (code) DO NOTHING;

-- Insert reserved subdomains
INSERT INTO reserved_subdomains (subdomain, reason) VALUES
  ('accounts', 'Platform subdomain'),
  ('admin', 'Platform subdomain'),
  ('console', 'Platform subdomain'),
  ('team', 'Platform subdomain'),
  ('api', 'Platform subdomain'),
  ('webhooks', 'Platform subdomain'),
  ('www', 'Common subdomain'),
  ('mail', 'Common subdomain'),
  ('ftp', 'Common subdomain'),
  ('localhost', 'Reserved'),
  ('letbuyy', 'Brand name'),
  ('seller', 'Reserved'),
  ('buyer', 'Reserved'),
  ('customer', 'Reserved'),
  ('support', 'Reserved'),
  ('help', 'Reserved'),
  ('about', 'Reserved'),
  ('terms', 'Reserved'),
  ('privacy', 'Reserved'),
  ('blog', 'Reserved'),
  ('careers', 'Reserved')
ON CONFLICT (subdomain) DO NOTHING;

-- Create reserved_subdomains table if it doesn't exist
CREATE TABLE IF NOT EXISTS reserved_subdomains (
  subdomain VARCHAR(63) PRIMARY KEY,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE reserved_subdomains IS 'List of subdomains that cannot be used for stores';
```

---

## 29. Phase 3: Vercel Deployment (Day 2-3)

### 29.1 Project Structure Setup

```bash
# ============================================
# PROJECT STRUCTURE
# ============================================

letbuyy-platform/
├── apps/
│   ├── web/
│   │   ├── accounts/          # accounts.letbuyy.store
│   │   ├── admin/             # admin.letbuyy.store
│   │   ├── console/           # console.letbuyy.store
│   │   ├── team/              # team.letbuyy.store
│   │   ├── landing/           # letbuyy.store
│   │   └── storefront/        # *.letbuyy.store (wildcard)
│   └── api/
│       └── workers/           # Cloudflare Workers (api.*, webhooks.*)
├── packages/
│   ├── ui/                    # Shared UI components
│   ├── database/              # Supabase client & types
│   ├── config/                # Shared configs
│   └── utils/                 # Shared utilities
├── supabase/
│   ├── migrations/            # Database migrations
│   └── seed.sql               # Seed data
├── .github/
│   └── workflows/
│       └── ci.yml             # CI/CD pipeline
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

### 29.2 Create Vercel Projects

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    VERCEL PROJECT CREATION (6 PROJECTS)                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PROJECT 1: Landing Page (letbuyy.store)                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Login to Vercel Dashboard                                           │  │
│  │ 2. Click "Add New Project"                                             │  │
│  │ 3. Import from GitHub: letbuyy-platform                                │  │
│  │ 4. Project name: letbuyy-landing                                       │  │
│  │ 5. Framework: Next.js                                                  │  │
│  │ 6. Root directory: apps/web/landing                                    │  │
│  │ 7. Environment Variables:                                              │  │
│  │    NEXT_PUBLIC_SUPABASE_URL=[from Step 2.2]                            │  │
│  │    NEXT_PUBLIC_SUPABASE_ANON_KEY=[from Step 2.2]                       │  │
│  │ 8. Click "Deploy"                                                      │  │
│  │ 9. After deployment:                                                   │  │
│  │    Settings > Domains > Add Domain: letbuyy.store                      │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  PROJECT 2: Accounts (accounts.letbuyy.store)                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Project name: letbuyy-accounts                                         │  │
│  │ Root directory: apps/web/accounts                                      │  │
│  │ Environment Variables:                                                 │  │
│  │    NEXT_PUBLIC_SUPABASE_URL=[url]                                      │  │
│  │    NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]                            │  │
│  │    SUPABASE_SERVICE_ROLE_KEY=[service-role-key] ⚠️                    │  │
│  │    RESEND_API_KEY=[resend-api-key]                                     │  │
│  │    NEXT_PUBLIC_ADMIN_URL=https://admin.letbuyy.store                   │  │
│  │ Domain: accounts.letbuyy.store                                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  PROJECT 3: Admin (admin.letbuyy.store)                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Project name: letbuyy-admin                                            │  │
│  │ Root directory: apps/web/admin                                         │  │
│  │ Environment Variables:                                                 │  │
│  │    NEXT_PUBLIC_SUPABASE_URL=[url]                                      │  │
│  │    NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]                            │  │
│  │    NEXT_PUBLIC_ACCOUNTS_URL=https://accounts.letbuyy.store             │  │
│  │ Domain: admin.letbuyy.store                                            │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  PROJECT 4: Console (console.letbuyy.store)                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Project name: letbuyy-console                                          │  │
│  │ Root directory: apps/web/console                                       │  │
│  │ Environment Variables: [Same as admin]                                 │  │
│  │ Domain: console.letbuyy.store                                          │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  PROJECT 5: Team (team.letbuyy.store)                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Project name: letbuyy-team                                             │  │
│  │ Root directory: apps/web/team                                          │  │
│  │ Environment Variables: [Same as admin]                                 │  │
│  │ Domain: team.letbuyy.store                                             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  PROJECT 6: Storefront (*.letbuyy.store) ⚠️ WILDCARD                        │  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Project name: letbuyy-storefront                                       │  │
│  │ Root directory: apps/web/storefront                                    │  │
│  │ Environment Variables:                                                 │  │
│  │    NEXT_PUBLIC_SUPABASE_URL=[url]                                      │  │
│  │    NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]                            │  │
│  │ Domains (ADD IN ORDER):                                                │  │
│  │    1. First add: storefront.letbuyy.store (for preview/testing)        │  │
│  │    2. Then add: *.letbuyy.store (wildcard - production)                │  │
│  │                                                                        │  │
│  │ ⚠️  IMPORTANT:                                                         │  │
│  │    Wildcard domains require Pro plan ($20/mo)                          │  │
│  │    Vercel will automatically provision SSL for wildcard                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 29.3 Verify Deployments

```bash
# ============================================
# DEPLOYMENT VERIFICATION SCRIPT
# ============================================

# Test each subdomain
echo "Testing Landing Page..."
curl -I https://letbuyy.store | head -n 1
# Expected: HTTP/2 200

echo "Testing Accounts..."
curl -I https://accounts.letbuyy.store | head -n 1
# Expected: HTTP/2 200

echo "Testing Admin..."
curl -I https://admin.letbuyy.store | head -n 1
# Expected: HTTP/2 200

echo "Testing Console..."
curl -I https://console.letbuyy.store | head -n 1
# Expected: HTTP/2 200

echo "Testing Team..."
curl -I https://team.letbuyy.store | head -n 1
# Expected: HTTP/2 200

echo "Testing Wildcard (random subdomain)..."
curl -I https://teststore123.letbuyy.store | head -n 1
# Expected: HTTP/2 200 (should show "Launching Soon" page)

# Verify SSL certificates
echo "Verifying SSL certificates..."
for domain in letbuyy.store accounts.letbuyy.store admin.letbuyy.store \
              console.letbuyy.store team.letbuyy.store teststore123.letbuyy.store
do
  echo "Checking $domain..."
  echo | openssl s_client -connect $domain:443 -servername $domain 2>/dev/null \
    | openssl x509 -noout -dates
done

# All should show valid dates with Let's Encrypt or Vercel issuer
```

---

## 30. Phase 4: Payment Gateway Setup (Day 3)

### 30.1 Razorpay Configuration

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    RAZORPAY SETUP (India Payment Gateway)                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: Create Account                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Visit: https://dashboard.razorpay.com/signup                       │  │
│  │ 2. Business details:                                                   │  │
│  │    Business name: LetBuyy                                              │  │
│  │    Business type: Technology/SaaS                                      │  │
│  │    Website: letbuyy.store                                              │  │
│  │ 3. Complete KYC verification                                           │  │
│  │    (Upload: PAN, GST, Business docs)                                   │  │
│  │ 4. Wait for approval (1-2 business days)                               │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STEP 2: Enable Test Mode                                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Login to Dashboard                                                  │  │
│  │ 2. Toggle: Test Mode (top-right)                                       │  │
│  │ 3. Navigate to: Settings > API Keys                                    │  │
│  │ 4. Generate API Keys                                                   │  │
│  │    Key ID: rzp_test_xxxxxxxxxxxx                                       │  │
│  │    Key Secret: [Click "Generate Secret"]                              │  │
│  │    ⚠️  SAVE BOTH SECURELY                                             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STEP 3: Configure Webhooks                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Navigate to: Settings > Webhooks                                    │  │
│  │ 2. Click "Add New Webhook"                                             │  │
│  │ 3. Webhook URL: https://webhooks.letbuyy.store/razorpay                │  │
│  │ 4. Active Events (select all):                                         │  │
│  │    ☑ payment.authorized                                               │  │
│  │    ☑ payment.captured                                                 │  │
│  │    ☑ payment.failed                                                   │  │
│  │    ☑ subscription.activated                                           │  │
│  │    ☑ subscription.charged                                             │  │
│  │    ☑ subscription.cancelled                                           │  │
│  │    ☑ subscription.paused                                              │  │
│  │    ☑ subscription.resumed                                             │  │
│  │ 5. Save webhook secret: whsec_xxxxxxxxxxxx                             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STEP 4: Create Subscription Plan                                            │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Navigate to: Subscriptions > Plans                                     │  │
│  │                                                                        │  │
│  │ Plan 1: Monthly                                                        │  │
│  │ ├─ Plan name: LetBuyy Monthly                                          │  │
│  │ ├─ Billing cycle: 1 month                                              │  │
│  │ ├─ Amount: ₹499                                                        │  │
│  │ ├─ Description: Full platform access, billed monthly                   │  │
│  │ └─ Click "Create Plan" → Copy Plan ID                                 │  │
│  │                                                                        │  │
│  │ Plan 2: Annual                                                         │  │
│  │ ├─ Plan name: LetBuyy Annual                                           │  │
│  │ ├─ Billing cycle: 12 months                                            │  │
│  │ ├─ Amount: ₹4,990 (Save 17%)                                          │  │
│  │ ├─ Description: Full platform access, billed annually                  │  │
│  │ └─ Click "Create Plan" → Copy Plan ID                                 │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STEP 5: Add to Environment Variables                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Add to accounts app in Vercel:                                         │  │
│  │                                                                        │  │
│  │ RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx                                  │  │
│  │ RAZORPAY_KEY_SECRET=xxxxxxxxxxxx                                       │  │
│  │ RAZORPAY_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx                             │  │
│  │ RAZORPAY_PLAN_MONTHLY=plan_xxxxxxxxxxxx                                │  │
│  │ RAZORPAY_PLAN_ANNUAL=plan_xxxxxxxxxxxx                                 │  │
│  │                                                                        │  │
│  │ Redeploy accounts app after adding variables                           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STEP 6: Go Live (After Testing)                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Complete production KYC                                             │  │
│  │ 2. Toggle to Live Mode                                                 │  │
│  │ 3. Generate LIVE API keys                                              │  │
│  │ 4. Update environment variables with live keys                         │  │
│  │ 5. Recreate subscription plans in live mode                            │  │
│  │ 6. Update webhook URL with live webhook secret                         │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 31. Phase 5: Email Service Setup (Day 3)

### 31.1 Resend Configuration

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    RESEND EMAIL SERVICE SETUP                                │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: Create Account                                                      │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Visit: https://resend.com/signup                                    │  │
│  │ 2. Sign up with email                                                  │  │
│  │ 3. Verify email address                                                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STEP 2: Add Domain                                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Navigate to: Domains > Add Domain                                      │  │
│  │                                                                        │  │
│  │ 1. Enter: letbuyy.store                                                │  │
│  │ 2. Resend will provide DNS records to add:                             │  │
│  │                                                                        │  │
│  │ Add these records in Cloudflare DNS:                                   │  │
│  │                                                                        │  │
│  │ TXT Record (SPF):                                                      │  │
│  │ ├─ Name: @                                                             │  │
│  │ ├─ Value: v=spf1 include:_spf.resend.com ~all                         │  │
│  │ └─ TTL: Auto                                                           │  │
│  │                                                                        │  │
│  │ TXT Record (DKIM):                                                     │  │
│  │ ├─ Name: resend._domainkey                                             │  │
│  │ ├─ Value: [provided by Resend]                                         │  │
│  │ └─ TTL: Auto                                                           │  │
│  │                                                                        │  │
│  │ TXT Record (DMARC):                                                    │  │
│  │ ├─ Name: _dmarc                                                        │  │
│  │ ├─ Value: v=DMARC1; p=none; rua=mailto:dmarc@letbuyy.store            │  │
│  │ └─ TTL: Auto                                                           │  │
│  │                                                                        │  │
│  │ 3. Wait for DNS propagation (15-30 minutes)                            │  │
│  │ 4. Click "Verify Domain" in Resend                                     │  │
│  │ 5. Status should change to ✅ Verified                                 │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STEP 3: Generate API Key                                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Navigate to: API Keys > Create API Key                                 │  │
│  │                                                                        │  │
│  │ 1. Name: Production - LetBuyy Platform                                 │  │
│  │ 2. Permission: Full Access                                             │  │
│  │ 3. Domain: letbuyy.store                                               │  │
│  │ 4. Click "Create"                                                      │  │
│  │ 5. Copy API key: re_xxxxxxxxxxxx                                       │  │
│  │    ⚠️  SAVE SECURELY - shown only once!                               │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STEP 4: Add to Environment Variables                                        │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Add to accounts app in Vercel:                                         │  │
│  │                                                                        │  │
│  │ RESEND_API_KEY=re_xxxxxxxxxxxx                                         │  │
│  │ RESEND_FROM_EMAIL=noreply@letbuyy.store                                │  │
│  │ RESEND_FROM_NAME=LetBuyy                                               │  │
│  │                                                                        │  │
│  │ Redeploy accounts app                                                  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STEP 5: Test Email Delivery                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Create test file: apps/web/accounts/app/api/test-email/route.ts       │  │
│  │                                                                        │  │
│  │ ```typescript                                                          │  │
│  │ import { Resend } from 'resend'                                        │  │
│  │                                                                        │  │
│  │ const resend = new Resend(process.env.RESEND_API_KEY)                 │  │
│  │                                                                        │  │
│  │ export async function POST() {                                         │  │
│  │   const { data, error } = await resend.emails.send({                  │  │
│  │     from: 'LetBuyy <noreply@letbuyy.store>',                          │  │
│  │     to: ['your-test-email@example.com'],                              │  │
│  │     subject: 'Test Email from LetBuyy',                               │  │
│  │     html: '<p>Email delivery is working! 🎉</p>'                      │  │
│  │   })                                                                   │  │
│  │                                                                        │  │
│  │   if (error) return Response.json({ error }, { status: 500 })         │  │
│  │   return Response.json({ data })                                      │  │
│  │ }                                                                      │  │
│  │ ```                                                                    │  │
│  │                                                                        │  │
│  │ Test: POST to https://accounts.letbuyy.store/api/test-email           │  │
│  │ Check inbox for test email                                             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 32. Phase 6: Monitoring & Analytics (Day 4)

### 32.1 Setup Monitoring Tools

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    MONITORING & ANALYTICS SETUP                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TOOL 1: Sentry (Error Tracking)                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Visit: https://sentry.io/signup                                     │  │
│  │ 2. Create organization: LetBuyy                                        │  │
│  │ 3. Create projects (one per app):                                      │  │
│  │    - letbuyy-accounts                                                  │  │
│  │    - letbuyy-admin                                                     │  │
│  │    - letbuyy-storefront                                                │  │
│  │ 4. For each project:                                                   │  │
│  │    Platform: Next.js                                                   │  │
│  │    Copy DSN: https://xxxx@yyyy.ingest.sentry.io/zzzz                  │  │
│  │ 5. Add to environment variables:                                       │  │
│  │    NEXT_PUBLIC_SENTRY_DSN=[dsn]                                        │  │
│  │ 6. Install Sentry SDK:                                                 │  │
│  │    pnpm add @sentry/nextjs                                             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  TOOL 2: Vercel Analytics                                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Enable in Vercel Dashboard for each project                         │  │
│  │ 2. Navigate to: Project > Analytics                                    │  │
│  │ 3. Click "Enable Analytics"                                            │  │
│  │ 4. Install package:                                                    │  │
│  │    pnpm add @vercel/analytics                                          │  │
│  │ 5. Add to layout:                                                      │  │
│  │    import { Analytics } from '@vercel/analytics/react'                 │  │
│  │    <Analytics />                                                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  TOOL 3: Uptime Monitoring (UptimeRobot)                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 1. Visit: https://uptimerobot.com                                      │  │
│  │ 2. Add monitors for:                                                   │  │
│  │    - https://letbuyy.store (every 5 min)                               │  │
│  │    - https://accounts.letbuyy.store (every 5 min)                      │  │
│  │    - https://admin.letbuyy.store (every 5 min)                         │  │
│  │ 3. Configure alerts:                                                   │  │
│  │    Email: ops@letbuyy.store                                            │  │
│  │    Trigger: After 2 consecutive failures                               │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

> **→ Continues in Part 8:** Implementation Roadmap & Timeline

---

## Document Navigation

| Part | Content |
|------|---------|
| Part 1 | Architecture & Trial System, URL Routing, Payment Requirements |
| Part 2 | Onboarding Flow — Site Type Questions & Paths |
| Part 3 | Store Management UI — Switcher, Badges, Multi-Store |
| Part 4 | Trial & Payment UI — Modals, Countdown, Reactivation |
| Part 5 | Complete Database Schema — All Tables |
| Part 6 | Admin Dashboard Variants — Per Site Type |
| **Part 7** (this) | Deployment & Migration — Step-by-Step |
| Part 8 | Implementation Roadmap — Timeline & Phases |