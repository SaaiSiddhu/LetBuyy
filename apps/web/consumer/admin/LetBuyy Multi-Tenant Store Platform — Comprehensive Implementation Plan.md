LetBuyy Multi-Tenant Store Platform — Comprehensive Implementation Plan
Version: 2.0Date: February 12, 2026Status: Production-Ready ArchitectureTech Stack: Next.js 14, TypeScript, Tailwind CSS, Supabase, Cloudflare Workers, Resend Email API

Table of Contents
1. Executive Summary
2. Architecture Overview
3. Tech Stack & Dependencies
4. Database Schema
5. DNS & SSL Configuration
6. Implementation Plan — Part by Part
7. Email Notification System
8. UI Wireframes — All Screens
9. Deployment Checklist
10. Testing & Validation

1. Executive Summary
Objectives
* Onboarding UI Enhancement: Align /onboarding with auth design system (theme toggle, language support, modern UI)
* Email Notifications: Send professional branded emails on store creation (success/failure)
* Wildcard DNS + SSL: Enable instant subdomain provisioning (username.letbuyy.store) with automatic SSL
* Fresh Deployment: Deploy all apps to new Vercel account + new Cloudflare account with proper configuration
Key Features
Feature	Status	Priority
Auth Design System Integration	✅ Planned	P0
Email Templates (Success/Failure)	✅ Planned	P0
Wildcard DNS + SSL Automation	✅ Planned	P0
Launching Soon Page	✅ Planned	P1
Store Type Selection	✅ Planned	P0
Multi-language Support (EN/HI/TA)	✅ Planned	P0
Deployment Targets


┌─────────────────────────────────────────────────────────┐
│                   FRESH DEPLOYMENT                       │
├─────────────────────┬───────────────────────────────────┤
│ Vercel Account      │ New (clean slate)                  │
│ Cloudflare Account  │ New (DNS + SSL + Workers)          │
│ Domain              │ letbuyy.store (transferred)        │
│ Apps to Deploy      │ 6 (accounts, admin, web, etc.)     │
└─────────────────────┴───────────────────────────────────┘

2. Architecture Overview
2.1 Domain Topology


┌──────────────────────────────────────────────────────────────┐
│                    CLOUDFLARE DNS ZONE                        │
│                      letbuyy.store                            │
├────────────────────┬─────────────────────────────────────────┤
│ Record             │ Target                Type    Proxy      │
├────────────────────┼─────────────────────────────────────────┤
│ @                  │ 76.76.21.21          A        ❌ DNS     │
│ accounts           │ cname.vercel-dns.com CNAME    ❌ DNS     │
│ admin              │ cname.vercel-dns.com CNAME    ❌ DNS     │
│ console            │ cname.vercel-dns.com CNAME    ❌ DNS     │
│ team               │ cname.vercel-dns.com CNAME    ❌ DNS     │
│ *                  │ cname.vercel-dns.com CNAME    ❌ DNS     │
│ api                │ 100::                AAAA      ✅ Proxied│
│ webhooks           │ 100::                AAAA      ✅ Proxied│
└────────────────────┴─────────────────────────────────────────┘

CRITICAL: Wildcard (*) must point to Vercel for dynamic storefronts
2.2 Application Map


┌─────────────────────────────────────────────────────────────┐
│                      APP ECOSYSTEM                           │
├───────────────┬─────────────────────────────────────────────┤
│ Subdomain     │ Purpose              Framework   Deploy To  │
├───────────────┼─────────────────────────────────────────────┤
│ letbuyy.store │ Marketing landing    Next.js     Vercel     │
│ accounts.*    │ Auth portal          Next.js     Vercel     │
│ admin.*       │ Store builder CMS    Next.js     Vercel     │
│ console.*     │ Super admin          Next.js     Vercel     │
│ team.*        │ Employee portal      Next.js     Vercel     │
│ *.letbuyy.*   │ User storefronts     Next.js     Vercel     │
│ api.*         │ REST API             Workers     Cloudflare │
│ webhooks.*    │ Webhook handlers     Workers     Cloudflare │
└───────────────┴─────────────────────────────────────────────┘
2.3 User Journey Flow


┌────────────────────────────────────────────────────────────┐
│                     USER JOURNEY                            │
└────────────────────────────────────────────────────────────┘

1️⃣ DISCOVERY
   User visits: letbuyy.store
   Clicks: "Get Started" button
   
2️⃣ EMAIL LOOKUP
   Redirects to: accounts.letbuyy.store/lookup
   User enters: email address
   System checks: email exists?
   ├─ YES → /login
   └─ NO  → /signup
   
3️⃣ AUTHENTICATION
   /signup: Create account → Email verification
   /verify: Click email link → Set password
   /login:  Enter password → Create session
   
4️⃣ ONBOARDING CHECK
   Session created → Check: has store?
   ├─ YES → Redirect to admin.letbuyy.store/{subdomain}
   └─ NO  → Redirect to /onboarding
   
5️⃣ ONBOARDING FLOW
   Step 1: Select site type (E-commerce, Portfolio, Resume, Landing)
   Step 2: Enter store name (validates subdomain availability)
   Submit:  Create store in database
   
6️⃣ POST-CREATION
   ├─ SUCCESS → Send success email
   │            Create DNS record (if wildcard not already set)
   │            Redirect to admin.letbuyy.store/{subdomain}
   │
   └─ FAILURE → Send failure email
                Display error in UI
                Allow retry
   
7️⃣ STOREFRONT ACCESS
   User visits: {subdomain}.letbuyy.store
   ├─ Published → Show live storefront
   └─ Draft    → Show "Launching Soon" page

3. Tech Stack & Dependencies
3.1 Frontend Stack


json
{
  "framework": "Next.js 14.2.x",
  "language": "TypeScript 5.x",
  "styling": "Tailwind CSS 3.4.x",
  "ui-components": "Headless UI (optional), Radix UI (optional)",
  "state": "React useState/useContext",
  "forms": "React Hook Form (optional) or native",
  "icons": "Lucide React / Heroicons"
}
3.2 Backend Stack


json
{
  "database": "Supabase (PostgreSQL 15)",
  "auth": "Supabase Auth (JWT)",
  "api-routes": "Next.js API Routes",
  "workers": "Cloudflare Workers (for api.letbuyy.store)",
  "email": "Resend API (React Email templates)",
  "storage": "Supabase Storage (for media)"
}
3.3 Infrastructure


json
{
  "hosting": "Vercel (Edge Network)",
  "dns": "Cloudflare DNS",
  "ssl": "Cloudflare Universal SSL + Vercel SSL",
  "cdn": "Vercel Edge Network + Cloudflare CDN",
  "monitoring": "Vercel Analytics, Sentry (optional)"
}
3.4 Package Dependencies
Add to apps/web/accounts/package.json:


json
{
  "dependencies": {
    "react-email": "^2.1.0",
    "@react-email/components": "^0.0.15",
    "resend": "^3.2.0",
    "date-fns": "^3.3.1"
  }
}
Add to root package.json (if monorepo):


json
{
  "devDependencies": {
    "@types/node": "^20.11.0",
    "typescript": "^5.3.3"
  }
}

4. Database Schema
4.1 Core Tables


sql
-- ============================================
-- STORES TABLE (Core entity)
-- ============================================
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Store Identity
  subdomain VARCHAR(63) UNIQUE NOT NULL, -- max DNS label length
  store_name VARCHAR(100) NOT NULL,
  store_type VARCHAR(20) NOT NULL CHECK (store_type IN ('ecommerce', 'portfolio', 'resume', 'landing')),
  
  -- Status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'suspended')),
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  
  -- Contact
  contact_email VARCHAR(255),
  
  -- Indexes
  CONSTRAINT subdomain_format CHECK (subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$')
);

CREATE INDEX idx_stores_user_id ON stores(user_id);
CREATE INDEX idx_stores_subdomain ON stores(subdomain);
CREATE INDEX idx_stores_status ON stores(status);

-- ============================================
-- EMAIL LOGS TABLE (Track all sent emails)
-- ============================================
CREATE TABLE email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
  
  -- Email Details
  email_type VARCHAR(50) NOT NULL, -- 'store_created_success', 'store_created_failure', 'verify_email', etc.
  recipient_email VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  
  -- Status
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'bounced')),
  provider VARCHAR(50) DEFAULT 'resend',
  provider_message_id VARCHAR(255),
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  
  -- Metadata (JSONB for flexibility)
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_created_at ON email_logs(created_at DESC);

-- ============================================
-- ONBOARDING_ATTEMPTS TABLE (Track failures)
-- ============================================
CREATE TABLE onboarding_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Attempt Details
  subdomain_requested VARCHAR(63) NOT NULL,
  store_type VARCHAR(20) NOT NULL,
  
  -- Outcome
  success BOOLEAN DEFAULT FALSE,
  error_code VARCHAR(50), -- 'subdomain_taken', 'db_error', 'dns_error', etc.
  error_message TEXT,
  
  -- Timestamp
  attempted_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_onboarding_user_id ON onboarding_attempts(user_id);
CREATE INDEX idx_onboarding_success ON onboarding_attempts(success);
4.2 Row Level Security (RLS)


sql
-- Enable RLS
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_attempts ENABLE ROW LEVEL SECURITY;

-- Stores policies
CREATE POLICY "Users can view their own stores"
  ON stores FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stores"
  ON stores FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stores"
  ON stores FOR UPDATE
  USING (auth.uid() = user_id);

-- Email logs policies (read-only for users)
CREATE POLICY "Users can view their own email logs"
  ON email_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Onboarding attempts policies
CREATE POLICY "Users can view their own attempts"
  ON onboarding_attempts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own attempts"
  ON onboarding_attempts FOR INSERT
  WITH CHECK (auth.uid() = user_id);
4.3 Database Functions


sql
-- ============================================
-- CHECK SUBDOMAIN AVAILABILITY
-- ============================================
CREATE OR REPLACE FUNCTION check_subdomain_available(subdomain_input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM stores WHERE subdomain = LOWER(subdomain_input)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- AUTO UPDATE TIMESTAMP
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stores_updated_at
  BEFORE UPDATE ON stores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

5. DNS & SSL Configuration
5.1 Cloudflare DNS Setup (Fresh Account)
Step 1: Add Domain to Cloudflare
1. Log into new Cloudflare account
2. Add site: letbuyy.store
3. Select Free plan
4. Cloudflare scans existing DNS records
5. Update nameservers at domain registrar to Cloudflare's:
    * austin.ns.cloudflare.com
    * lara.ns.cloudflare.com
6. Wait for DNS propagation (5-60 minutes)
Step 2: Configure DNS Records


terraform
# dns.tf (Terraform configuration for repeatability)

# Root domain → Vercel
resource "cloudflare_record" "root" {
  zone_id = var.cloudflare_zone_id
  name    = "@"
  value   = "76.76.21.21"
  type    = "A"
  proxied = false
  ttl     = 1  # Auto
}

# Subdomains → Vercel
resource "cloudflare_record" "accounts" {
  zone_id = var.cloudflare_zone_id
  name    = "accounts"
  value   = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = false
  ttl     = 1
}

resource "cloudflare_record" "admin" {
  zone_id = var.cloudflare_zone_id
  name    = "admin"
  value   = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = false
  ttl     = 1
}

resource "cloudflare_record" "console" {
  zone_id = var.cloudflare_zone_id
  name    = "console"
  value   = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = false
  ttl     = 1
}

resource "cloudflare_record" "team" {
  zone_id = var.cloudflare_zone_id
  name    = "team"
  value   = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = false
  ttl     = 1
}

# CRITICAL: Wildcard for user storefronts
resource "cloudflare_record" "wildcard" {
  zone_id = var.cloudflare_zone_id
  name    = "*"
  value   = "cname.vercel-dns.com"
  type    = "CNAME"
  proxied = false  # Must be false for SSL to work with Vercel
  ttl     = 1
}

# API endpoints → Cloudflare Workers
resource "cloudflare_record" "api" {
  zone_id = var.cloudflare_zone_id
  name    = "api"
  value   = "100::"
  type    = "AAAA"
  proxied = true  # Proxied through Cloudflare
  ttl     = 1
}

resource "cloudflare_record" "webhooks" {
  zone_id = var.cloudflare_zone_id
  name    = "webhooks"
  value   = "100::"
  type    = "AAAA"
  proxied = true
  ttl     = 1
}
```

**Manual DNS Configuration (Alternative to Terraform)**

| Type | Name | Target | Proxy | TTL | Priority |
|------|------|--------|-------|-----|----------|
| A | @ | 76.76.21.21 | DNS only | Auto | - |
| CNAME | accounts | cname.vercel-dns.com | DNS only | Auto | - |
| CNAME | admin | cname.vercel-dns.com | DNS only | Auto | - |
| CNAME | console | cname.vercel-dns.com | DNS only | Auto | - |
| CNAME | team | cname.vercel-dns.com | DNS only | Auto | - |
| CNAME | * | cname.vercel-dns.com | DNS only | Auto | - |
| AAAA | api | 100:: | Proxied | Auto | - |
| AAAA | webhooks | 100:: | Proxied | Auto | - |

### 5.2 SSL Configuration

**Cloudflare SSL Settings**
```
SSL/TLS > Overview
├─ Encryption mode: Full (strict)
└─ Always Use HTTPS: ✅ ON

SSL/TLS > Edge Certificates
├─ Universal SSL: ✅ Active
├─ Always Use HTTPS: ✅ ON
├─ HTTP Strict Transport Security (HSTS): ✅ Enable
│   ├─ Max Age: 6 months
│   ├─ Include subdomains: ✅
│   └─ Preload: ✅
├─ Minimum TLS Version: TLS 1.2
├─ Opportunistic Encryption: ✅ ON
├─ TLS 1.3: ✅ ON
└─ Automatic HTTPS Rewrites: ✅ ON
Vercel SSL Configuration
1. Add domain in Vercel project settings
2. Add all subdomains:
    * letbuyy.store
    * accounts.letbuyy.store
    * admin.letbuyy.store
    * console.letbuyy.store
    * team.letbuyy.store
    * *.letbuyy.store ← CRITICAL for wildcard SSL
3. Vercel auto-generates SSL certs via Let's Encrypt
4. Wait for SSL verification (5-10 minutes per domain)
Wildcard SSL Verification


bash
# Verify wildcard SSL is working
curl -I https://teststore123.letbuyy.store

# Expected response headers:
HTTP/2 200 
server: Vercel
strict-transport-security: max-age=63072000; includeSubDomains; preload
x-vercel-id: sfo1::xxxxx-1234567890
5.3 DNS Validation Commands


bash
# Check DNS propagation
dig accounts.letbuyy.store CNAME +short
# Expected: cname.vercel-dns.com

dig admin.letbuyy.store CNAME +short
# Expected: cname.vercel-dns.com

dig anyrandomname.letbuyy.store CNAME +short
# Expected: cname.vercel-dns.com (wildcard works)

# Check SSL certificate
echo | openssl s_client -connect accounts.letbuyy.store:443 -servername accounts.letbuyy.store 2>/dev/null | openssl x509 -noout -dates
# Expected: Valid dates, issued by Let's Encrypt or Cloudflare

# Check wildcard SSL
echo | openssl s_client -connect teststore.letbuyy.store:443 -servername teststore.letbuyy.store 2>/dev/null | openssl x509 -noout -subject
# Expected: CN=*.letbuyy.store or similar

6. Implementation Plan — Part by Part
Part 1: CSS Design System Extensions
File: apps/web/accounts/app/globals.css
Location: Add after line 612 (after desktop media query)


css
/* ============================================================
   ONBOARDING EXTENSIONS — Auth Design System
   ============================================================ */

/* --- Progress Bar --- */
.onboarding-progress {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;
}

.onboarding-progress-step {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--border);
  transition: background 0.3s ease;
}

.onboarding-progress-step.active {
  background: var(--primary);
}

/* --- Site Type Card Grid --- */
.onboarding-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 8px;
}

/* --- Site Type Card --- */
.onboarding-type-card {
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--bg);
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
  position: relative;
}

.onboarding-type-card:hover {
  border-color: var(--primary-light);
  background: var(--bg-secondary);
  transform: translateY(-2px);
}

.onboarding-type-card.selected {
  border-color: var(--primary);
  background: rgba(139, 92, 246, 0.06);
  box-shadow: 0 0 0 2px var(--primary);
}

.dark .onboarding-type-card.selected {
  background: rgba(139, 92, 246, 0.12);
}

.onboarding-type-icon {
  font-size: 24px;
  margin-bottom: 8px;
  display: block;
}

.onboarding-type-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: block;
  margin-bottom: 2px;
}

.onboarding-type-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

/* --- URL Display (subdomain input) --- */
.onboarding-url-display {
  display: flex;
  align-items: center;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--input-bg);
  transition: border-color 0.2s;
}

.onboarding-url-display:focus-within {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1);
}

.onboarding-url-display input {
  flex: 1;
  padding: 12px 14px;
  font-size: 16px;
  background: transparent;
  border: none;
  color: var(--text-primary);
  outline: none;
  font-family: 'Inter', -apple-system, sans-serif;
}

.onboarding-url-display input::placeholder {
  color: var(--text-hint);
}

.onboarding-url-suffix {
  padding: 12px 14px;
  font-size: 14px;
  color: var(--text-hint);
  background: var(--bg-secondary);
  border-left: 1px solid var(--border);
  white-space: nowrap;
  user-select: none;
  font-family: 'Fira Code', 'Monaco', monospace;
}

/* --- Button Row (Back / Create) --- */
.onboarding-btn-row {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.onboarding-btn-row > * {
  flex: 1;
}

/* --- Loading Spinner --- */
.onboarding-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--bg-secondary);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* --- Success Checkmark Animation --- */
.onboarding-success-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  border-radius: 50%;
  background: rgba(34, 197, 94, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  animation: scaleIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
}

@keyframes scaleIn {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}

/* --- Responsive Adjustments --- */
@media (max-width: 480px) {
  .onboarding-grid {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  
  .onboarding-type-card {
    padding: 14px;
  }
  
  .onboarding-url-suffix {
    font-size: 12px;
    padding: 12px 10px;
  }
  
  .onboarding-btn-row {
    flex-direction: column;
  }
  
  .onboarding-btn-row > * {
    width: 100%;
  }
}

Part 2: Onboarding Page Rewrite
File: apps/web/accounts/app/onboarding/page.tsx


typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

// ============================================
// TYPES
// ============================================
type Lang = 'en' | 'hi' | 'ta'

type StoreType = 'ecommerce' | 'portfolio' | 'resume' | 'landing'

interface StoreTypeOption {
  id: StoreType
  icon: string
  name: Record<Lang, string>
  description: Record<Lang, string>
}

interface Translation {
  title: string
  subtitle: string
  storeNameLabel: string
  storeNamePlaceholder: string
  backButton: string
  nextButton: string
  createButton: string
  creatingButton: string
  successTitle: string
  successMessage: string
  redirecting: string
  errorPrefix: string
}

// ============================================
// TRANSLATIONS
// ============================================
const translations: Record<Lang, Translation> = {
  en: {
    title: 'What do you want to build?',
    subtitle: 'Choose your site type to get started',
    storeNameLabel: 'Name your store',
    storeNamePlaceholder: 'mystore',
    backButton: 'Back',
    nextButton: 'Next',
    createButton: 'Create Store',
    creatingButton: 'Creating...',
    successTitle: 'Store Created!',
    successMessage: 'Redirecting to your dashboard',
    redirecting: 'Redirecting...',
    errorPrefix: 'Error:',
  },
  hi: {
    title: 'आप क्या बनाना चाहते हैं?',
    subtitle: 'शुरू करने के लिए अपनी साइट का प्रकार चुनें',
    storeNameLabel: 'अपनी दुकान का नाम दें',
    storeNamePlaceholder: 'mystore',
    backButton: 'पीछे',
    nextButton: 'आगे',
    createButton: 'स्टोर बनाएं',
    creatingButton: 'बनाया जा रहा है...',
    successTitle: 'स्टोर बनाया गया!',
    successMessage: 'आपके डैशबोर्ड पर पुनर्निर्देशित किया जा रहा है',
    redirecting: 'पुनर्निर्देशित हो रहा है...',
    errorPrefix: 'त्रुटि:',
  },
  ta: {
    title: 'நீங்கள் என்ன உருவாக்க விரும்புகிறீர்கள்?',
    subtitle: 'தொடங்க உங்கள் தள வகையைத் தேர்ந்தெடுக்கவும்',
    storeNameLabel: 'உங்கள் கடைக்கு பெயரிடுங்கள்',
    storeNamePlaceholder: 'mystore',
    backButton: 'பின்செல்',
    nextButton: 'அடுத்து',
    createButton: 'கடையை உருவாக்கு',
    creatingButton: 'உருவாக்குகிறது...',
    successTitle: 'கடை உருவாக்கப்பட்டது!',
    successMessage: 'உங்கள் டாஷ்போர்டுக்கு திருப்பிவிடப்படுகிறது',
    redirecting: 'திருப்பிவிடப்படுகிறது...',
    errorPrefix: 'பிழை:',
  },
}

// ============================================
// STORE TYPE OPTIONS
// ============================================
const storeTypes: StoreTypeOption[] = [
  {
    id: 'ecommerce',
    icon: '🛒',
    name: {
      en: 'E-commerce Store',
      hi: 'ई-कॉमर्स स्टोर',
      ta: 'மின் வணிக கடை',
    },
    description: {
      en: 'Sell products online',
      hi: 'ऑनलाइन उत्पाद बेचें',
      ta: 'ஆன்லைனில் தயாரிப்புகளை விற்கவும்',
    },
  },
  {
    id: 'portfolio',
    icon: '💼',
    name: {
      en: 'Portfolio',
      hi: 'पोर्टफोलियो',
      ta: 'போர்ட்ஃபோலியோ',
    },
    description: {
      en: 'Showcase your work',
      hi: 'अपना काम प्रदर्शित करें',
      ta: 'உங்கள் வேலையை காட்டுங்கள்',
    },
  },
  {
    id: 'resume',
    icon: '📄',
    name: {
      en: 'Resume / CV',
      hi: 'रिज्यूमे / सीवी',
      ta: 'விவரக்குறிப்பு',
    },
    description: {
      en: 'Professional profile',
      hi: 'पेशेवर प्रोफ़ाइल',
      ta: 'தொழில்முறை சுயவிவரம்',
    },
  },
  {
    id: 'landing',
    icon: '🚀',
    name: {
      en: 'Landing Page',
      hi: 'लैंडिंग पेज',
      ta: 'இறங்கும் பக்கம்',
    },
    description: {
      en: 'Marketing campaign',
      hi: 'मार्केटिंग अभियान',
      ta: 'சந்தைப்படுத்தல் பிரச்சாரம்',
    },
  },
]

// ============================================
// MAIN COMPONENT
// ============================================
export default function OnboardingPage() {
  const router = useRouter()
  const supabase = createClientComponentClient()

  // State
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedType, setSelectedType] = useState<StoreType | null>(null)
  const [storeName, setStoreName] = useState('')
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [success, setSuccess] = useState(false)
  
  // Theme & Language
  const [isDark, setIsDark] = useState(false)
  const [lang, setLang] = useState<Lang>('en')

  const t = translations[lang]

  // ============================================
  // LIFECYCLE
  // ============================================
  useEffect(() => {
    checkAuth()
    initializeTheme()
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
  }, [isDark])

  // ============================================
  // AUTH CHECK
  // ============================================
  async function checkAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        router.push('/login')
        return
      }

      // Check if user already has a store
      const { data: store } = await supabase
        .from('stores')
        .select('subdomain')
        .eq('user_id', session.user.id)
        .limit(1)
        .single()

      if (store) {
        // User already has a store, redirect to admin
        const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.letbuyy.store'
        window.location.href = `${adminUrl}/${store.subdomain}`
        return
      }

      setLoading(false)
    } catch (err) {
      console.error('Auth check error:', err)
      router.push('/login')
    }
  }

  // ============================================
  // THEME INITIALIZATION
  // ============================================
  function initializeTheme() {
    const savedTheme = localStorage.getItem('theme')
    const savedLang = localStorage.getItem('lang') as Lang | null
    
    if (savedTheme === 'dark') {
      setIsDark(true)
    } else if (savedTheme === 'light') {
      setIsDark(false)
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setIsDark(prefersDark)
    }

    if (savedLang && ['en', 'hi', 'ta'].includes(savedLang)) {
      setLang(savedLang)
    }
  }

  // ============================================
  // THEME TOGGLE
  // ============================================
  function toggleTheme() {
    const newTheme = !isDark
    setIsDark(newTheme)
    localStorage.setItem('theme', newTheme ? 'dark' : 'light')
  }

  // ============================================
  // LANGUAGE CYCLE
  // ============================================
  function cycleLang() {
    const langs: Lang[] = ['en', 'hi', 'ta']
    const currentIndex = langs.indexOf(lang)
    const nextLang = langs[(currentIndex + 1) % langs.length]
    setLang(nextLang)
    localStorage.setItem('lang', nextLang)
  }

  // ============================================
  // STEP NAVIGATION
  // ============================================
  function handleNext() {
    if (!selectedType) return
    setStep(2)
    setError('')
  }

  function handleBack() {
    setStep(1)
    setError('')
  }

  // ============================================
  // STORE CREATION
  // ============================================
  async function handleCreate() {
    if (!selectedType || !storeName.trim()) {
      setError('Please enter a store name')
      return
    }

    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
    const normalizedName = storeName.toLowerCase().trim()
    
    if (!subdomainRegex.test(normalizedName)) {
      setError('Store name can only contain lowercase letters, numbers, and hyphens. Must start and end with a letter or number.')
      return
    }

    setCreating(true)
    setError('')

    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        throw new Error('No active session')
      }

      // Check subdomain availability
      const { data: existing } = await supabase
        .from('stores')
        .select('subdomain')
        .eq('subdomain', normalizedName)
        .single()

      if (existing) {
        setError('This store name is already taken. Please choose another.')
        setCreating(false)
        
        // Log failed attempt
        await supabase.from('onboarding_attempts').insert({
          user_id: session.user.id,
          subdomain_requested: normalizedName,
          store_type: selectedType,
          success: false,
          error_code: 'subdomain_taken',
          error_message: 'Subdomain already exists',
        })
        
        // Send failure email
        await fetch('/api/email/store-creation-failure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: session.user.email,
            storeName: normalizedName,
            storeType: selectedType,
            reason: 'subdomain_taken',
          }),
        })
        
        return
      }

      // Create store
      const { data: newStore, error: createError } = await supabase
        .from('stores')
        .insert({
          user_id: session.user.id,
          subdomain: normalizedName,
          store_name: storeName.trim(),
          store_type: selectedType,
          status: 'draft',
          contact_email: session.user.email,
        })
        .select()
        .single()

      if (createError) {
        throw createError
      }

      // Log success attempt
      await supabase.from('onboarding_attempts').insert({
        user_id: session.user.id,
        subdomain_requested: normalizedName,
        store_type: selectedType,
        success: true,
      })

      // Send success email
      await fetch('/api/email/store-creation-success', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: session.user.email,
          storeName: normalizedName,
          storeType: selectedType,
          storeUrl: `https://${normalizedName}.letbuyy.store`,
          adminUrl: `https://admin.letbuyy.store/${normalizedName}`,
        }),
      })

      // Show success state
      setSuccess(true)

      // Redirect to admin after 2 seconds
      setTimeout(() => {
        const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.letbuyy.store'
        window.location.href = `${adminUrl}/${normalizedName}`
      }, 2000)

    } catch (err: any) {
      console.error('Store creation error:', err)
      setError(err.message || 'Failed to create store. Please try again.')
      setCreating(false)

      // Log failed attempt
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        await supabase.from('onboarding_attempts').insert({
          user_id: session.user.id,
          subdomain_requested: normalizedName,
          store_type: selectedType,
          success: false,
          error_code: 'db_error',
          error_message: err.message,
        })

        // Send failure email
        await fetch('/api/email/store-creation-failure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: session.user.email,
            storeName: normalizedName,
            storeType: selectedType,
            reason: 'database_error',
            errorDetails: err.message,
          }),
        })
      }
    }
  }

  // ============================================
  // RENDER: LOADING
  // ============================================
  if (loading) {
    return (
      <main className="auth-container">
        <div className="auth-card">
          <p style={{ color: 'var(--text-hint)', textAlign: 'center' }}>
            Loading...
          </p>
        </div>
      </main>
    )
  }

  // ============================================
  // RENDER: SUCCESS
  // ============================================
  if (success) {
    return (
      <main className="auth-container">
        <div className="auth-card">
          <div className="onboarding-success-icon">
            ✓
          </div>
          <h1 className="auth-title" style={{ textAlign: 'center' }}>
            {t.successTitle}
          </h1>
          <p className="auth-subtitle" style={{ textAlign: 'center' }}>
            {t.successMessage}
          </p>
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <span className="onboarding-spinner"></span>
            <p style={{ color: 'var(--text-hint)', fontSize: '14px', marginTop: '8px' }}>
              {t.redirecting}
            </p>
          </div>
        </div>
      </main>
    )
  }

  // ============================================
  // RENDER: MAIN ONBOARDING
  // ============================================
  return (
    <main className="auth-container">
      {/* Top Bar */}
      <div className="auth-top-bar">
        <button className="auth-lang-btn" onClick={cycleLang}>
          {lang.toUpperCase()}
        </button>
        <button className="auth-theme-btn" onClick={toggleTheme}>
          {isDark ? '☀️' : '🌙'}
        </button>
      </div>

      {/* Card */}
      <div className="auth-card">
        {/* Logo */}
        <div className="auth-logo">
          <img
            src="/icons/app_icon.png"
            alt="LetBuyy"
            width={56}
            height={56}
          />
        </div>

        {/* Progress Bar */}
        <div className="onboarding-progress">
          <div className={`onboarding-progress-step ${step >= 1 ? 'active' : ''}`} />
          <div className={`onboarding-progress-step ${step >= 2 ? 'active' : ''}`} />
        </div>

        {/* Error Display */}
        {error && (
          <div className="auth-error">
            {t.errorPrefix} {error}
          </div>
        )}

        {/* Step 1: Store Type Selection */}
        {step === 1 && (
          <>
            <h1 className="auth-title">{t.title}</h1>
            <p className="auth-subtitle">{t.subtitle}</p>

            <div className="onboarding-grid">
              {storeTypes.map((type) => (
                <button
                  key={type.id}
                  className={`onboarding-type-card ${
                    selectedType === type.id ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedType(type.id)}
                >
                  <span className="onboarding-type-icon">{type.icon}</span>
                  <span className="onboarding-type-name">
                    {type.name[lang]}
                  </span>
                  <span className="onboarding-type-desc">
                    {type.description[lang]}
                  </span>
                </button>
              ))}
            </div>

            <button
              className="auth-btn-primary"
              onClick={handleNext}
              disabled={!selectedType}
              style={{ marginTop: '24px', width: '100%' }}
            >
              {t.nextButton}
            </button>
          </>
        )}

        {/* Step 2: Store Name Input */}
        {step === 2 && (
          <>
            <h1 className="auth-title">{t.storeNameLabel}</h1>
            <p className="auth-subtitle">This will be your URL</p>

            <div className="auth-field">
              <label>Store Name</label>
              <div className="onboarding-url-display">
                <input
                  type="text"
                  placeholder={t.storeNamePlaceholder}
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  disabled={creating}
                  autoFocus
                />
                <span className="onboarding-url-suffix">.letbuyy.store</span>
              </div>
            </div>

            <div className="onboarding-btn-row">
              <button
                className="auth-btn-secondary"
                onClick={handleBack}
                disabled={creating}
              >
                {t.backButton}
              </button>
              <button
                className="auth-btn-primary"
                onClick={handleCreate}
                disabled={!storeName.trim() || creating}
              >
                {creating ? (
                  <>
                    <span className="onboarding-spinner" style={{ marginRight: '8px' }} />
                    {t.creatingButton}
                  </>
                ) : (
                  t.createButton
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

Part 3: Login Redirect Logic
File: apps/web/accounts/app/api/auth/login/route.ts
Change: Add store check before redirect


typescript
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()

    const supabase = createRouteHandlerClient({ cookies })

    // Authenticate user
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: 401 }
      )
    }

    // ============================================
    // CHECK IF USER HAS COMPLETED ONBOARDING
    // ============================================
    const { data: store } = await supabase
      .from('stores')
      .select('subdomain')
      .eq('user_id', authData.user.id)
      .limit(1)
      .single()

    const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.letbuyy.store'
    
    // If user has a store, redirect to their admin dashboard
    // Otherwise, redirect to onboarding
    const redirectTo = store
      ? `${adminUrl}/${store.subdomain}`
      : '/onboarding'

    return NextResponse.json({
      success: true,
      redirectTo,
    })

  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    )
  }
}
```

---

## 7. Email Notification System

### 7.1 Email Templates Architecture

**Directory Structure:**
```
apps/web/accounts/
├── emails/
│   ├── templates/
│   │   ├── StoreCreatedSuccess.tsx
│   │   ├── StoreCreatedFailure.tsx
│   │   └── components/
│   │       ├── EmailLayout.tsx
│   │       ├── EmailHeader.tsx
│   │       ├── EmailFooter.tsx
│   │       └── EmailButton.tsx
│   └── utils/
│       └── sendEmail.ts
└── app/
    └── api/
        └── email/
            ├── store-creation-success/
            │   └── route.ts
            └── store-creation-failure/
                └── route.ts
7.2 Email Layout Component
File: apps/web/accounts/emails/templates/components/EmailLayout.tsx


tsx
import * as React from 'react'
import {
  Html,
  Head,
  Body,
  Container,
  Section,
} from '@react-email/components'

interface EmailLayoutProps {
  children: React.ReactNode
}

export function EmailLayout({ children }: EmailLayoutProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          {children}
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Ubuntu, sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
  maxWidth: '600px',
}
File: apps/web/accounts/emails/templates/components/EmailHeader.tsx


tsx
import * as React from 'react'
import { Img, Section, Text } from '@react-email/components'

export function EmailHeader() {
  return (
    <Section style={header}>
      <Img
        src="https://letbuyy.store/icons/app_icon.png"
        width="48"
        height="48"
        alt="LetBuyy"
        style={logo}
      />
      <Text style={brandName}>LetBuyy</Text>
    </Section>
  )
}

const header = {
  padding: '32px 40px',
  textAlign: 'center' as const,
  borderBottom: '1px solid #e2e8f0',
}

const logo = {
  margin: '0 auto',
}

const brandName = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#8B5CF6',
  margin: '12px 0 0',
}
File: apps/web/accounts/emails/templates/components/EmailFooter.tsx


tsx
import * as React from 'react'
import { Section, Text, Link, Hr } from '@react-email/components'

export function EmailFooter() {
  return (
    <>
      <Hr style={divider} />
      <Section style={footer}>
        <Text style={footerText}>
          © {new Date().getFullYear()} LetBuyy. All rights reserved.
        </Text>
        <Text style={footerLinks}>
          <Link href="https://letbuyy.store" style={link}>
            Home
          </Link>
          {' • '}
          <Link href="https://letbuyy.store/help" style={link}>
            Help Center
          </Link>
          {' • '}
          <Link href="https://letbuyy.store/privacy" style={link}>
            Privacy
          </Link>
        </Text>
      </Section>
    </>
  )
}

const divider = {
  borderColor: '#e2e8f0',
  margin: '32px 40px',
}

const footer = {
  padding: '0 40px 32px',
  textAlign: 'center' as const,
}

const footerText = {
  fontSize: '12px',
  color: '#64748b',
  margin: '0 0 8px',
}

const footerLinks = {
  fontSize: '12px',
  color: '#64748b',
  margin: '0',
}

const link = {
  color: '#8B5CF6',
  textDecoration: 'none',
}
File: apps/web/accounts/emails/templates/components/EmailButton.tsx


tsx
import * as React from 'react'
import { Button } from '@react-email/components'

interface EmailButtonProps {
  href: string
  children: React.ReactNode
}

export function EmailButton({ href, children }: EmailButtonProps) {
  return (
    <Button href={href} style={button}>
      {children}
    </Button>
  )
}

const button = {
  backgroundColor: '#8B5CF6',
  borderRadius: '8px',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '14px 32px',
  margin: '32px auto',
  maxWidth: '280px',
}
7.3 Success Email Template
File: apps/web/accounts/emails/templates/StoreCreatedSuccess.tsx


tsx
import * as React from 'react'
import {
  Text,
  Section,
  Row,
  Column,
} from '@react-email/components'
import { EmailLayout } from './components/EmailLayout'
import { EmailHeader } from './components/EmailHeader'
import { EmailFooter } from './components/EmailFooter'
import { EmailButton } from './components/EmailButton'

interface StoreCreatedSuccessProps {
  storeName: string
  storeType: 'ecommerce' | 'portfolio' | 'resume' | 'landing'
  storeUrl: string
  adminUrl: string
  userEmail: string
}

const storeTypeLabels = {
  ecommerce: 'E-commerce Store',
  portfolio: 'Portfolio',
  resume: 'Resume / CV',
  landing: 'Landing Page',
}

const storeTypeEmojis = {
  ecommerce: '🛒',
  portfolio: '💼',
  resume: '📄',
  landing: '🚀',
}

export function StoreCreatedSuccess({
  storeName,
  storeType,
  storeUrl,
  adminUrl,
  userEmail,
}: StoreCreatedSuccessProps) {
  return (
    <EmailLayout>
      <EmailHeader />

      <Section style={content}>
        {/* Success Icon */}
        <div style={successIconWrapper}>
          <div style={successIcon}>✓</div>
        </div>

        {/* Title */}
        <Text style={title}>
          Your Store is Ready! 🎉
        </Text>

        {/* Message */}
        <Text style={paragraph}>
          Congratulations! Your {storeTypeLabels[storeType]} has been successfully created and is ready to customize.
        </Text>

        {/* Store Details Card */}
        <Section style={detailsCard}>
          <Row>
            <Column style={detailsIcon}>
              <Text style={emoji}>{storeTypeEmojis[storeType]}</Text>
            </Column>
            <Column>
              <Text style={detailsTitle}>{storeName}</Text>
              <Text style={detailsSubtitle}>{storeTypeLabels[storeType]}</Text>
            </Column>
          </Row>

          <div style={divider} />

          <Row style={detailRow}>
            <Column style={detailLabel}>Store URL:</Column>
            <Column>
              <Text style={detailValue}>
                <a href={storeUrl} style={urlLink}>{storeUrl}</a>
              </Text>
            </Column>
          </Row>

          <Row style={detailRow}>
            <Column style={detailLabel}>Admin Dashboard:</Column>
            <Column>
              <Text style={detailValue}>
                <a href={adminUrl} style={urlLink}>{adminUrl}</a>
              </Text>
            </Column>
          </Row>

          <Row style={detailRow}>
            <Column style={detailLabel}>Owner:</Column>
            <Column>
              <Text style={detailValue}>{userEmail}</Text>
            </Column>
          </Row>

          <Row style={detailRow}>
            <Column style={detailLabel}>Status:</Column>
            <Column>
              <Text style={statusBadge}>Draft</Text>
            </Column>
          </Row>
        </Section>

        {/* Next Steps */}
        <Text style={sectionHeading}>Next Steps:</Text>
        <ul style={list}>
          <li style={listItem}>
            <strong>Customize your store:</strong> Add your branding, colors, and content
          </li>
          <li style={listItem}>
            <strong>Add your first {storeType === 'ecommerce' ? 'product' : 'content'}:</strong> Start building your {storeTypeLabels[storeType].toLowerCase()}
          </li>
          <li style={listItem}>
            <strong>Publish when ready:</strong> Make your store live for the world to see
          </li>
        </ul>

        {/* CTA Button */}
        <EmailButton href={adminUrl}>
          Open Dashboard →
        </EmailButton>

        {/* Help Text */}
        <Text style={helpText}>
          Need help getting started? Check out our{' '}
          <a href="https://letbuyy.store/docs" style={link}>
            documentation
          </a>{' '}
          or{' '}
          <a href="https://letbuyy.store/support" style={link}>
            contact support
          </a>
          .
        </Text>
      </Section>

      <EmailFooter />
    </EmailLayout>
  )
}

// ============================================
// STYLES
// ============================================
const content = {
  padding: '40px 40px 0',
}

const successIconWrapper = {
  textAlign: 'center' as const,
  marginBottom: '24px',
}

const successIcon = {
  display: 'inline-block',
  width: '64px',
  height: '64px',
  borderRadius: '50%',
  backgroundColor: '#22C55E',
  color: '#ffffff',
  fontSize: '32px',
  fontWeight: '700',
  lineHeight: '64px',
  textAlign: 'center' as const,
}

const title = {
  fontSize: '28px',
  fontWeight: '700',
  color: '#0f172a',
  textAlign: 'center' as const,
  margin: '0 0 16px',
}

const paragraph = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#475569',
  textAlign: 'center' as const,
  margin: '0 0 32px',
}

const detailsCard = {
  backgroundColor: '#f8fafc',
  borderRadius: '12px',
  padding: '24px',
  border: '1px solid #e2e8f0',
  marginBottom: '32px',
}

const detailsIcon = {
  width: '56px',
  textAlign: 'center' as const,
  verticalAlign: 'top',
}

const emoji = {
  fontSize: '32px',
  margin: '0',
}

const detailsTitle = {
  fontSize: '20px',
  fontWeight: '700',
  color: '#0f172a',
  margin: '0 0 4px',
}

const detailsSubtitle = {
  fontSize: '14px',
  color: '#64748b',
  margin: '0',
}

const divider = {
  height: '1px',
  backgroundColor: '#e2e8f0',
  margin: '20px 0',
}

const detailRow = {
  marginBottom: '12px',
}

const detailLabel = {
  fontSize: '14px',
  color: '#64748b',
  width: '140px',
  verticalAlign: 'top',
  paddingTop: '2px',
}

const detailValue = {
  fontSize: '14px',
  color: '#0f172a',
  margin: '0',
}

const urlLink = {
  color: '#8B5CF6',
  textDecoration: 'none',
  wordBreak: 'break-all' as const,
}

const statusBadge = {
  display: 'inline-block',
  backgroundColor: '#fef3c7',
  color: '#92400e',
  fontSize: '12px',
  fontWeight: '600',
  padding: '4px 12px',
  borderRadius: '12px',
  margin: '0',
}

const sectionHeading = {
  fontSize: '18px',
  fontWeight: '700',
  color: '#0f172a',
  margin: '0 0 16px',
}

const list = {
  margin: '0 0 32px',
  padding: '0 0 0 20px',
}

const listItem = {
  fontSize: '14px',
  lineHeight: '24px',
  color: '#475569',
  marginBottom: '12px',
}

const helpText = {
  fontSize: '14px',
  color: '#64748b',
  textAlign: 'center' as const,
  margin: '32px 0 0',
}

const link = {
  color: '#8B5CF6',
  textDecoration: 'none',
}

export default StoreCreatedSuccess
7.4 Failure Email Template
File: apps/web/accounts/emails/templates/StoreCreatedFailure.tsx


tsx
import * as React from 'react'
import {
  Text,
  Section,
  Row,
  Column,
  Code,
} from '@react-email/components'
import { EmailLayout } from './components/EmailLayout'
import { EmailHeader } from './components/EmailHeader'
import { EmailFooter } from './components/EmailFooter'
import { EmailButton } from './components/EmailButton'

interface StoreCreatedFailureProps {
  storeName: string
  storeType: 'ecommerce' | 'portfolio' | 'resume' | 'landing'
  reason: string
  errorDetails?: string
  userEmail: string
}

const storeTypeLabels = {
  ecommerce: 'E-commerce Store',
  portfolio: 'Portfolio',
  resume: 'Resume / CV',
  landing: 'Landing Page',
}

const errorReasons: Record<string, { title: string; description: string; solution: string }> = {
  subdomain_taken: {
    title: 'Store Name Already Taken',
    description: 'The store name you requested is already in use by another user.',
    solution: 'Please try again with a different store name. We recommend adding your name, brand, or a unique identifier.',
  },
  database_error: {
    title: 'Database Error',
    description: 'We encountered a technical issue while creating your store.',
    solution: 'This is usually temporary. Please try again in a few minutes. If the problem persists, contact our support team.',
  },
  validation_error: {
    title: 'Invalid Store Name',
    description: 'The store name you provided does not meet our requirements.',
    solution: 'Store names must be 3-63 characters long, contain only lowercase letters, numbers, and hyphens, and start/end with a letter or number.',
  },
  dns_error: {
    title: 'DNS Configuration Error',
    description: 'We were unable to configure your custom subdomain.',
    solution: 'Our team has been notified. We will resolve this issue and notify you once your store is ready.',
  },
  unknown: {
    title: 'Unexpected Error',
    description: 'An unexpected error occurred while creating your store.',
    solution: 'Please try again. If the problem continues, please contact our support team with the error details below.',
  },
}

export function StoreCreatedFailure({
  storeName,
  storeType,
  reason,
  errorDetails,
  userEmail,
}: StoreCreatedFailureProps) {
  const error = errorReasons[reason] || errorReasons.unknown

  return (
    <EmailLayout>
      <EmailHeader />

      <Section style={content}>
        {/* Error Icon */}
        <div style={errorIconWrapper}>
          <div style={errorIcon}>✕</div>
        </div>

        {/* Title */}
        <Text style={title}>
          Store Creation Failed
        </Text>

        {/* Message */}
        <Text style={paragraph}>
          We encountered an issue while creating your {storeTypeLabels[storeType]}. Don't worry — you can try again with a different store name or contact our support team for assistance.
        </Text>

        {/* Error Details Card */}
        <Section style={detailsCard}>
          <Text style={errorTitle}>{error.title}</Text>
          <Text style={errorDescription}>{error.description}</Text>

          <div style={divider} />

          <Row style={detailRow}>
            <Column style={detailLabel}>Requested Name:</Column>
            <Column>
              <Text style={detailValue}>
                <Code style={code}>{storeName}.letbuyy.store</Code>
              </Text>
            </Column>
          </Row>

          <Row style={detailRow}>
            <Column style={detailLabel}>Store Type:</Column>
            <Column>
              <Text style={detailValue}>{storeTypeLabels[storeType]}</Text>
            </Column>
          </Row>

          <Row style={detailRow}>
            <Column style={detailLabel}>User Email:</Column>
            <Column>
              <Text style={detailValue}>{userEmail}</Text>
            </Column>
          </Row>

          {errorDetails && (
            <Row style={detailRow}>
              <Column style={detailLabel}>Error Details:</Column>
              <Column>
                <Text style={detailValue}>
                  <Code style={code}>{errorDetails}</Code>
                </Text>
              </Column>
            </Row>
          )}
        </Section>

        {/* Solution */}
        <Text style={sectionHeading}>How to Fix This:</Text>
        <Text style={solutionText}>{error.solution}</Text>

        {/* CTA Buttons */}
        <EmailButton href="https://accounts.letbuyy.store/onboarding">
          Try Again →
        </EmailButton>

        <div style={secondaryButtonWrapper}>
          <a href="https://letbuyy.store/support" style={secondaryButton}>
            Contact Support
          </a>
        </div>

        {/* Help Text */}
        <Text style={helpText}>
          If you continue to experience issues, please reply to this email or visit our{' '}
          <a href="https://letbuyy.store/support" style={link}>
            support center
          </a>
          .
        </Text>
      </Section>

      <EmailFooter />
    </EmailLayout>
  )
}

// ============================================
// STYLES
// ============================================
const content = {
  padding: '40px 40px 0',
}

const errorIconWrapper = {
  textAlign: 'center' as const,
  marginBottom: '24px',
}

const errorIcon = {
  display: 'inline-block',
  width: '64px',
  height: '64px',
  borderRadius: '50%',
  backgroundColor: '#EF4444',
  color: '#ffffff',
  fontSize: '32px',
  fontWeight: '700',
  lineHeight: '64px',
  textAlign: 'center' as const,
}

const title = {
  fontSize: '28px',
  fontWeight: '700',
  color: '#0f172a',
  textAlign: 'center' as const,
  margin: '0 0 16px',
}

const paragraph = {
  fontSize: '16px',
  lineHeight: '24px',
  color: '#475569',
  textAlign: 'center' as const,
  margin: '0 0 32px',
}

const detailsCard = {
  backgroundColor: '#fef2f2',
  borderRadius: '12px',
  padding: '24px',
  border: '1px solid #fecaca',
  marginBottom: '32px',
}

const errorTitle = {
  fontSize: '18px',
  fontWeight: '700',
  color: '#991b1b',
  margin: '0 0 8px',
}

const errorDescription = {
  fontSize: '14px',
  lineHeight: '20px',
  color: '#7f1d1d',
  margin: '0 0 20px',
}

const divider = {
  height: '1px',
  backgroundColor: '#fecaca',
  margin: '20px 0',
}

const detailRow = {
  marginBottom: '12px',
}

const detailLabel = {
  fontSize: '14px',
  color: '#991b1b',
  width: '140px',
  verticalAlign: 'top',
  paddingTop: '2px',
  fontWeight: '600',
}

const detailValue = {
  fontSize: '14px',
  color: '#7f1d1d',
  margin: '0',
}

const code = {
  backgroundColor: '#fee2e2',
  color: '#991b1b',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '13px',
  fontFamily: 'monospace',
}

const sectionHeading = {
  fontSize: '18px',
  fontWeight: '700',
  color: '#0f172a',
  margin: '0 0 12px',
}

const solutionText = {
  fontSize: '14px',
  lineHeight: '22px',
  color: '#475569',
  margin: '0 0 32px',
  backgroundColor: '#f8fafc',
  padding: '16px',
  borderRadius: '8px',
  border: '1px solid #e2e8f0',
}

const secondaryButtonWrapper = {
  textAlign: 'center' as const,
  marginTop: '16px',
}

const secondaryButton = {
  color: '#8B5CF6',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  display: 'inline-block',
}

const helpText = {
  fontSize: '14px',
  color: '#64748b',
  textAlign: 'center' as const,
  margin: '32px 0 0',
}

const link = {
  color: '#8B5CF6',
  textDecoration: 'none',
}

export default StoreCreatedFailure
7.5 Email API Routes
File: apps/web/accounts/app/api/email/store-creation-success/route.ts


typescript
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { StoreCreatedSuccess } from '@/emails/templates/StoreCreatedSuccess'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { email, storeName, storeType, storeUrl, adminUrl } = await request.json()

    if (!email || !storeName || !storeType || !storeUrl || !adminUrl) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: 'LetBuyy <noreply@letbuyy.store>',
      to: email,
      subject: `🎉 Your ${storeType === 'ecommerce' ? 'Store' : storeType === 'portfolio' ? 'Portfolio' : storeType === 'resume' ? 'Resume' : 'Landing Page'} is Ready!`,
      react: StoreCreatedSuccess({
        storeName,
        storeType,
        storeUrl,
        adminUrl,
        userEmail: email,
      }),
    })

    if (error) {
      console.error('Resend error:', error)
      
      // Log failed email attempt
      const supabase = createRouteHandlerClient({ cookies })
      await supabase.from('email_logs').insert({
        recipient_email: email,
        email_type: 'store_created_success',
        subject: `🎉 Your ${storeType} is Ready!`,
        status: 'failed',
        error_message: error.message,
        metadata: { storeName, storeType, storeUrl, adminUrl },
      })

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log successful email
    const supabase = createRouteHandlerClient({ cookies })
    await supabase.from('email_logs').insert({
      recipient_email: email,
      email_type: 'store_created_success',
      subject: `🎉 Your ${storeType} is Ready!`,
      status: 'sent',
      provider_message_id: data?.id,
      metadata: { storeName, storeType, storeUrl, adminUrl },
    })

    return NextResponse.json({ success: true, messageId: data?.id })

  } catch (error: any) {
    console.error('Email API error:', error)
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    )
  }
}
File: apps/web/accounts/app/api/email/store-creation-failure/route.ts


typescript
import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { StoreCreatedFailure } from '@/emails/templates/StoreCreatedFailure'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(request: Request) {
  try {
    const { email, storeName, storeType, reason, errorDetails } = await request.json()

    if (!email || !storeName || !storeType || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Send email via Resend
    const { data, error } = await resend.emails.send({
      from: 'LetBuyy <noreply@letbuyy.store>',
      to: email,
      subject: 'Store Creation Failed — LetBuyy',
      react: StoreCreatedFailure({
        storeName,
        storeType,
        reason,
        errorDetails,
        userEmail: email,
      }),
    })

    if (error) {
      console.error('Resend error:', error)
      
      // Log failed email attempt
      const supabase = createRouteHandlerClient({ cookies })
      await supabase.from('email_logs').insert({
        recipient_email: email,
        email_type: 'store_created_failure',
        subject: 'Store Creation Failed — LetBuyy',
        status: 'failed',
        error_message: error.message,
        metadata: { storeName, storeType, reason, errorDetails },
      })

      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Log successful email
    const supabase = createRouteHandlerClient({ cookies })
    await supabase.from('email_logs').insert({
      recipient_email: email,
      email_type: 'store_created_failure',
      subject: 'Store Creation Failed — LetBuyy',
      status: 'sent',
      provider_message_id: data?.id,
      metadata: { storeName, storeType, reason, errorDetails },
    })

    return NextResponse.json({ success: true, messageId: data?.id })

  } catch (error: any) {
    console.error('Email API error:', error)
    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    )
  }
}
7.6 Environment Variables
File: apps/web/accounts/.env.local


bash
# Resend API Key
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey...

# Admin URL
NEXT_PUBLIC_ADMIN_URL=https://admin.letbuyy.store
```

---

## 8. UI Wireframes — All Screens

### 8.1 Onboarding: Loading State
```
┌───────────────────────────────────────────────────────────┐
│                                                            │
│                            [EN] [🌙]  ← auth-top-bar      │
│                                                            │
│                                                            │
│         ┌─────────────────────────────────┐               │
│         │                                  │               │
│         │                                  │               │
│         │         Loading...               │               │
│         │      (text-hint color)           │               │
│         │                                  │               │
│         │                                  │               │
│         └─────────────────────────────────┘               │
│                  auth-card                                 │
│                                                            │
│                                                            │
└───────────────────────────────────────────────────────────┘
                     auth-container
                   (centered, full viewport)
```

### 8.2 Onboarding: Step 1 — Site Type Selection
```
┌───────────────────────────────────────────────────────────┐
│                                                            │
│                            [EN] [🌙]  ← auth-top-bar      │
│                                                            │
│         ┌─────────────────────────────────┐               │
│         │                                  │               │
│         │      [LetBuyy Logo]              │  ← auth-logo │
│         │       (56×56 icon)               │               │
│         │                                  │               │
│         │   ┌─────┐ ┌─────┐               │  ← progress  │
│         │   │█████│ │░░░░░│               │  (step 1)     │
│         │   └─────┘ └─────┘               │               │
│         │                                  │               │
│         │  What do you want to build?     │  ← auth-title│
│         │                                  │               │
│         │  Choose your site type to get   │  ← subtitle  │
│         │  started                         │               │
│         │                                  │               │
│         │  ┌────────────┬────────────┐    │               │
│         │  │ 🛒          │ 💼          │    │  ← grid      │
│         │  │ E-commerce │ Portfolio  │    │  (2×2)       │
│         │  │ Store      │            │    │               │
│         │  │ Sell       │ Showcase   │    │               │
│         │  │ products   │ your work  │    │               │
│         │  │ online     │            │    │               │
│         │  ├────────────┼────────────┤    │               │
│         │  │ 📄          │ 🚀          │    │               │
│         │  │ Resume     │ Landing    │    │               │
│         │  │ / CV       │ Page       │    │               │
│         │  │ Profes-    │ Marketing  │    │               │
│         │  │ sional     │ campaign   │    │               │
│         │  │ profile    │            │    │               │
│         │  └────────────┴────────────┘    │               │
│         │                                  │               │
│         │  ┌────────────────────────────┐ │               │
│         │  │         Next              │ │  ← primary btn│
│         │  └────────────────────────────┘ │  (disabled if │
│         │                                  │   no select) │
│         └─────────────────────────────────┘               │
│                                                            │
└───────────────────────────────────────────────────────────┘

HOVER STATE (any card):
┌────────────────────────────────────┐
│ 🛒  E-commerce Store                │  ← border-primary-light
│ Sell products online                │  bg-secondary
│                                     │  translateY(-2px)
└────────────────────────────────────┘

SELECTED STATE:
┌════════════════════════════════════┐
║ 🛒  E-commerce Store                ║  ← border-primary
║ Sell products online                ║  purple bg tint
║                                     ║  box-shadow: 0 0 0 2px primary
└════════════════════════════════════┘
```

### 8.3 Onboarding: Step 2 — Store Name Input
```
┌───────────────────────────────────────────────────────────┐
│                                                            │
│                            [EN] [🌙]  ← auth-top-bar      │
│                                                            │
│         ┌─────────────────────────────────┐               │
│         │                                  │               │
│         │      [LetBuyy Logo]              │  ← auth-logo │
│         │       (56×56 icon)               │               │
│         │                                  │               │
│         │   ┌─────┐ ┌─────┐               │  ← progress  │
│         │   │█████│ │█████│               │  (both steps) │
│         │   └─────┘ └─────┘               │               │
│         │                                  │               │
│         │  Name your store                │  ← auth-title│
│         │                                  │               │
│         │  This will be your URL          │  ← subtitle  │
│         │                                  │               │
│         │  Store Name                     │  ← label     │
│         │  ┌─────────────────────────────┐│               │
│         │  │ mystore    │.letbuyy.store  ││  ← url       │
│         │  │            │                ││  display     │
│         │  │  (input)   │  (suffix)      ││               │
│         │  └─────────────────────────────┘│               │
│         │                                  │               │
│         │  ┌─────────┐ ┌─────────────┐   │               │
│         │  │  Back   │ │   Create    │   │  ← btn-row   │
│         │  │         │ │   Store     │   │               │
│         │  └─────────┘ └─────────────┘   │               │
│         │  secondary    primary           │               │
│         │                                  │               │
│         └─────────────────────────────────┘               │
│                                                            │
└───────────────────────────────────────────────────────────┘

FOCUS STATE (input):
┌──────────────────────────────────────┐
│ myawesomestore │ .letbuyy.store      │  ← border-primary
│                │                     │  box-shadow purple
└──────────────────────────────────────┘

CREATING STATE (button):
┌───────────────────────────────────────┐
│  ◌ Creating...                        │  ← spinner icon
│                                       │  disabled state
└───────────────────────────────────────┘
```

### 8.4 Onboarding: Error State (Overlay)
```
┌───────────────────────────────────────────────────────────┐
│         │                                  │               │
│         │   ┌─────────────────────────┐   │               │
│         │   │  ⚠ Error:               │   │  ← auth-error│
│         │   │  This store name is     │   │  (red bg,    │
│         │   │  already taken. Please  │   │   border)    │
│         │   │  choose another.        │   │               │
│         │   └─────────────────────────┘   │               │
│         │                                  │               │
│         │  Name your store                │               │
│         │  ...                             │               │
└───────────────────────────────────────────────────────────┘
```

### 8.5 Onboarding: Success State
```
┌───────────────────────────────────────────────────────────┐
│                                                            │
│                            [EN] [🌙]  ← auth-top-bar      │
│                                                            │
│         ┌─────────────────────────────────┐               │
│         │                                  │               │
│         │         ┌────────┐               │               │
│         │         │   ✓    │               │  ← success   │
│         │         └────────┘               │  icon (green) │
│         │       (animated)                 │               │
│         │                                  │               │
│         │    Store Created!                │  ← title     │
│         │                                  │               │
│         │    Redirecting to your          │  ← subtitle  │
│         │    dashboard                    │               │
│         │                                  │               │
│         │         ◌                        │  ← spinner   │
│         │    Redirecting...                │               │
│         │                                  │               │
│         └─────────────────────────────────┘               │
│                                                            │
└───────────────────────────────────────────────────────────┘
```

### 8.6 Dark Mode Comparison
```
LIGHT MODE                          DARK MODE
┌────────────────────┐             ┌────────────────────┐
│ #FFFFFF (bg)       │             │ #0A0F1A (bg)       │
│ #F8FAFC (secondary)│             │ #0F172A (secondary)│
│ #0F172A (text)     │             │ #FFFFFF (text)     │
│ #8B5CF6 (primary)  │             │ #8B5CF6 (primary)  │
│                    │             │                    │
│ ┌────────────┐     │             │ ┌────────────┐     │
│ │ Card       │     │             │ │ Card       │     │
│ │ White bg   │     │             │ │ Dark bg    │     │
│ │ Light      │     │             │ │ Dark       │     │
│ │ borders    │     │             │ │ borders    │     │
│ └────────────┘     │             │ └────────────┘     │
└────────────────────┘             └────────────────────┘
```

### 8.7 Responsive: Mobile vs Desktop
```
MOBILE (375px)                     DESKTOP (1440px)
┌──────────────┐                  ┌────────────────────────────────┐
│ Full width   │                  │    Centered with max-width     │
│ No shadow    │                  │    Box shadow                  │
│ 20px padding │                  │    36px padding                │
│              │                  │                                │
│ ┌──────────┐ │                  │        ┌──────────────┐        │
│ │ 🛒        │ │  Single column  │        │ 🛒    💼     │        │
│ │ E-comm    │ │  grid (1fr)     │        │ E-comm Port  │  2×2   │
│ ├──────────┤ │                  │        ├──────────────┤  grid  │
│ │ 💼        │ │                  │        │ 📄    🚀     │        │
│ │ Portfolio │ │                  │        │ Resume Land │        │
│ ├──────────┤ │                  │        └──────────────┘        │
│ │ 📄        │ │                  │                                │
│ │ Resume    │ │                  │  Background: bg-secondary      │
│ ├──────────┤ │                  │  Card: elevated with shadow    │
│ │ 🚀        │ │                  │                                │
│ │ Landing   │ │                  └────────────────────────────────┘
│ └──────────┘ │
└──────────────┘
8.8 Email Template: Success (Desktop Preview)


┌──────────────────────────────────────────────────────────┐
│                     [LetBuyy Logo]                        │
│                       LetBuyy                             │
├──────────────────────────────────────────────────────────┤
│                                                           │
│                      ┌────────┐                           │
│                      │   ✓    │  (green circle)           │
│                      └────────┘                           │
│                                                           │
│              Your Store is Ready! 🎉                      │
│                                                           │
│   Congratulations! Your E-commerce Store has been        │
│   successfully created and is ready to customize.        │
│                                                           │
│   ┌─────────────────────────────────────────────────┐   │
│   │ 🛒  mystore                                      │   │
│   │     E-commerce Store                             │   │
│   │                                                  │   │
│   │ ───────────────────────────────────────────     │   │
│   │                                                  │   │
│   │ Store URL:        mystore.letbuyy.store          │   │
│   │ Admin Dashboard:  admin.letbuyy.store/mystore    │   │
│   │ Owner:

user@example.com │ │ │ │ Status: Draft │ │ │ └─────────────────────────────────────────────────┘ │ │ │ │ Next Steps: │ │ • Customize your store: Add your branding, colors │ │ • Add your first product: Start building your store │ │ • Publish when ready: Make your store live │ │ │ │ ┌─────────────────────────────────────────────────┐ │ │ │ Open Dashboard → │ │ │ └─────────────────────────────────────────────────┘ │ │ │ │ Need help getting started? Check out our │ │ documentation or contact support. │ │ │ ├──────────────────────────────────────────────────────────┤ │ © 2026 LetBuyy. All rights reserved. │ │ Home • Help Center • Privacy │ └──────────────────────────────────────────────────────────┘


### 8.9 Email Template: Failure (Desktop Preview)
┌──────────────────────────────────────────────────────────┐ │ [LetBuyy Logo] │ │ LetBuyy │ ├──────────────────────────────────────────────────────────┤ │ │ │ ┌────────┐ │ │ │ ✕ │ (red circle) │ │ └────────┘ │ │ │ │ Store Creation Failed │ │ │ │ We encountered an issue while creating your │ │ E-commerce Store. Don't worry — you can try again. │ │ │ │ ┌─────────────────────────────────────────────────┐ │ │ │ Store Name Already Taken │ │ (red │ │ │ │ tint) │ │ The store name you requested is already in use │ │ │ │ by another user. │ │ │ │ │ │ │ │ ─────────────────────────────────────────── │ │ │ │ │ │ │ │ Requested Name: mystore.letbuyy.store │ │ │ │ Store Type: E-commerce Store │ │ │ │ User Email: user@example.com │ │ │ └─────────────────────────────────────────────────┘ │ │ │ │ How to Fix This: │ │ ┌─────────────────────────────────────────────────┐ │ │ │ Please try again with a different store name. │ │ │ │ We recommend adding your name, brand, or a │ │ │ │ unique identifier. │ │ │ └─────────────────────────────────────────────────┘ │ │ │ │ ┌─────────────────────────────────────────────────┐ │ │ │ Try Again → │ │ │ └─────────────────────────────────────────────────┘ │ │ │ │ Contact Support │ │ │ │ If you continue to experience issues, please reply │ │ to this email or visit our support center. │ │ │ ├──────────────────────────────────────────────────────────┤ │ © 2026 LetBuyy. All rights reserved. │ │ Home • Help Center • Privacy │ └──────────────────────────────────────────────────────────┘


---

## 9. Deployment Checklist

### 9.1 Pre-Deployment (Local Development)
```bash
# ============================================
# STEP 1: Install Dependencies
# ============================================
cd /Users/saai_sidd/Git/Letbuyy_Store/apps/web/accounts
npm install react-email @react-email/components resend date-fns

# ============================================
# STEP 2: Environment Variables
# ============================================
# Create .env.local file with:
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey...
NEXT_PUBLIC_ADMIN_URL=https://admin.letbuyy.store

# ============================================
# STEP 3: Database Setup (Supabase)
# ============================================
# Run SQL migrations in Supabase SQL Editor:
# 1. Create tables (stores, email_logs, onboarding_attempts)
# 2. Enable RLS policies
# 3. Create database functions

# ============================================
# STEP 4: Make Code Changes
# ============================================
# Part 1: globals.css (add onboarding CSS)
# Part 2: onboarding/page.tsx (rewrite)
# Part 3: login/route.ts (add store check)
# Part 4: Create email templates
# Part 5: Create email API routes

# ============================================
# STEP 5: Build & Test Locally
# ============================================
npm run dev
# Visit: http://localhost:3000/onboarding
# Test all flows:
# - Loading state
# - Step 1 selection
# - Step 2 input
# - Store creation (success)
# - Store creation (failure - duplicate name)
# - Email delivery (check inbox)
# - Dark mode toggle
# - Language toggle

npm run build
# Verify build succeeds with no errors

# ============================================
# STEP 6: Test Email Templates
# ============================================
npm run email:dev
# Opens React Email preview at http://localhost:3001
# Verify both success and failure templates render correctly
```

### 9.2 Cloudflare Setup (New Account)
```bash
# ============================================
# STEP 1: Create Cloudflare Account
# ============================================
# 1. Go to https://dash.cloudflare.com/sign-up
# 2. Sign up with email
# 3. Verify email address
# 4. Complete account setup

# ============================================
# STEP 2: Add Domain to Cloudflare
# ============================================
# 1. Click "Add a Site"
# 2. Enter: letbuyy.store
# 3. Select Free plan
# 4. Cloudflare scans existing DNS
# 5. Note nameservers (e.g., austin.ns.cloudflare.com)

# ============================================
# STEP 3: Update Domain Nameservers
# ============================================
# At your domain registrar (e.g., Namecheap, GoDaddy):
# Replace current nameservers with Cloudflare's:
#   austin.ns.cloudflare.com
#   lara.ns.cloudflare.com
# Wait 5-60 minutes for propagation

# ============================================
# STEP 4: Configure DNS Records
# ============================================
# In Cloudflare dashboard > DNS > Records:

# Root domain
A     @          76.76.21.21           DNS only   Auto

# Subdomains (all point to Vercel)
CNAME accounts   cname.vercel-dns.com  DNS only   Auto
CNAME admin      cname.vercel-dns.com  DNS only   Auto
CNAME console    cname.vercel-dns.com  DNS only   Auto
CNAME team       cname.vercel-dns.com  DNS only   Auto

# CRITICAL: Wildcard for user storefronts
CNAME *          cname.vercel-dns.com  DNS only   Auto

# API endpoints (Cloudflare Workers)
AAAA  api        100::                 Proxied    Auto
AAAA  webhooks   100::                 Proxied    Auto

# ============================================
# STEP 5: Configure SSL
# ============================================
# SSL/TLS > Overview
# - Encryption mode: Full (strict)
# - Always Use HTTPS: ON

# SSL/TLS > Edge Certificates
# - Universal SSL: Active (wait for activation)
# - Always Use HTTPS: ON
# - HSTS: Enable
#   - Max Age: 6 months
#   - Include subdomains: ✓
#   - Preload: ✓
# - Minimum TLS Version: TLS 1.2
# - TLS 1.3: ON

# ============================================
# STEP 6: Verify DNS Propagation
# ============================================
dig accounts.letbuyy.store CNAME +short
# Expected: cname.vercel-dns.com

dig anyrandomname.letbuyy.store CNAME +short
# Expected: cname.vercel-dns.com (wildcard works!)
```

### 9.3 Vercel Setup (New Account)
```bash
# ============================================
# STEP 1: Create Vercel Account
# ============================================
# 1. Go to https://vercel.com/signup
# 2. Sign up with GitHub (recommended)
# 3. Authorize Vercel to access repos

# ============================================
# STEP 2: Import Git Repository
# ============================================
# 1. Click "Add New..." > "Project"
# 2. Import from Git
# 3. Select: Letbuyy_Store repository
# 4. Configure project:
#    Framework Preset: Next.js
#    Root Directory: apps/web/accounts
#    Build Command: npm run build
#    Output Directory: .next
#    Install Command: npm install

# ============================================
# STEP 3: Environment Variables (Vercel)
# ============================================
# In Project Settings > Environment Variables:

RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ey...
SUPABASE_SERVICE_ROLE_KEY=ey...
NEXT_PUBLIC_ADMIN_URL=https://admin.letbuyy.store

# Apply to: Production, Preview, Development

# ============================================
# STEP 4: Add Custom Domains
# ============================================
# In Project Settings > Domains:

# Add these domains one by one:
letbuyy.store
accounts.letbuyy.store
admin.letbuyy.store
console.letbuyy.store
team.letbuyy.store
*.letbuyy.store          ← CRITICAL for wildcard

# For each domain:
# 1. Click "Add"
# 2. Enter domain
# 3. Vercel verifies DNS (should auto-detect Cloudflare CNAME)
# 4. Wait for SSL certificate (5-10 mins per domain)
# 5. Status should show "Valid Configuration" with SSL icon

# ============================================
# STEP 5: Deploy
# ============================================
# Option 1: Auto-deploy (push to main branch)
git add .
git commit -m "feat: onboarding enhancement + email notifications"
git push origin main
# Vercel auto-deploys

# Option 2: Manual deploy
vercel --prod

# ============================================
# STEP 6: Repeat for Other Apps
# ============================================
# Deploy these apps to separate Vercel projects:
# - apps/web/admin       → admin.letbuyy.store
# - apps/web/console     → console.letbuyy.store
# - apps/web/team        → team.letbuyy.store
# - apps/web/storefront  → *.letbuyy.store (wildcard)
# - apps/web/marketing   → letbuyy.store (root)

# Each project needs:
# 1. Import from Git
# 2. Set root directory
# 3. Add environment variables
# 4. Add custom domain
# 5. Deploy
```

### 9.4 Vercel Configuration Files

**File:** `apps/web/accounts/vercel.json`
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "X-Content-Type-Options",
          "value": "nosniff"
        },
        {
          "key": "X-Frame-Options",
          "value": "DENY"
        },
        {
          "key": "X-XSS-Protection",
          "value": "1; mode=block"
        },
        {
          "key": "Referrer-Policy",
          "value": "strict-origin-when-cross-origin"
        },
        {
          "key": "Permissions-Policy",
          "value": "camera=(), microphone=(), geolocation=()"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/$1"
    }
  ]
}
```

### 9.5 Post-Deployment Verification
```bash
# ============================================
# VERIFY DNS
# ============================================
dig accounts.letbuyy.store +short
# Expected: Vercel IP (e.g., 76.76.21.21)

dig admin.letbuyy.store +short
# Expected: Vercel IP

dig teststore123.letbuyy.store +short
# Expected: Vercel IP (wildcard works!)

# ============================================
# VERIFY SSL
# ============================================
curl -I https://accounts.letbuyy.store
# Expected: HTTP/2 200, valid SSL cert

curl -I https://teststore.letbuyy.store
# Expected: HTTP/2 (might be 404 but SSL should work)

echo | openssl s_client -connect accounts.letbuyy.store:443 -servername accounts.letbuyy.store 2>/dev/null | openssl x509 -noout -subject -dates
# Expected: Valid dates, CN=*.letbuyy.store or accounts.letbuyy.store

# ============================================
# VERIFY WILDCARD SSL
# ============================================
echo | openssl s_client -connect anyrandomname.letbuyy.store:443 -servername anyrandomname.letbuyy.store 2>/dev/null | openssl x509 -noout -subject
# Expected: CN=*.letbuyy.store (wildcard cert)

# ============================================
# FUNCTIONAL TESTING
# ============================================
# 1. Visit: https://accounts.letbuyy.store/onboarding
#    - Should see modern auth UI
#    - Theme toggle works
#    - Language toggle works

# 2. Create a test store:
#    - Select store type
#    - Enter unique name
#    - Click "Create Store"
#    - Should receive success email
#    - Should redirect to admin dashboard

# 3. Try duplicate store name:
#    - Should see error message
#    - Should receive failure email

# 4. Check database:
#    - Verify store record created
#    - Verify email_logs entries
#    - Verify onboarding_attempts entries

# 5. Visit created storefront:
#    - https://{yourstore}.letbuyy.store
#    - Should show "Launching Soon" page (Phase 2)
#    - SSL should be valid

# ============================================
# EMAIL TESTING
# ============================================
# 1. Check Resend dashboard:
#    - https://resend.com/emails
#    - Verify emails sent successfully
#    - Check delivery status

# 2. Check recipient inbox:
#    - Success email received (branded template)
#    - Failure email received (if tested)
#    - Links work correctly
#    - Images load properly
```

---

## 10. Testing & Validation

### 10.1 Unit Tests (Optional)

**File:** `apps/web/accounts/__tests__/onboarding.test.tsx`
```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import OnboardingPage from '@/app/onboarding/page'
import '@testing-library/jest-dom'

// Mock Supabase client
jest.mock('@supabase/auth-helpers-nextjs', () => ({
  createClientComponentClient: () => ({
    auth: {
      getSession: jest.fn(() => Promise.resolve({
        data: { session: { user: { id: 'test-user-id', email: 'test@example.com' } } }
      })),
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          limit: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null })),
          })),
        })),
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: { subdomain: 'teststore' } })),
        })),
      })),
    })),
  }),
}))

describe('OnboardingPage', () => {
  test('renders step 1 with store type options', async () => {
    render(<OnboardingPage />)
    
    await waitFor(() => {
      expect(screen.getByText('What do you want to build?')).toBeInTheDocument()
    })
    
    expect(screen.getByText('E-commerce Store')).toBeInTheDocument()
    expect(screen.getByText('Portfolio')).toBeInTheDocument()
    expect(screen.getByText('Resume / CV')).toBeInTheDocument()
    expect(screen.getByText('Landing Page')).toBeInTheDocument()
  })

  test('advances to step 2 when store type selected', async () => {
    render(<OnboardingPage />)
    
    await waitFor(() => {
      expect(screen.getByText('What do you want to build?')).toBeInTheDocument()
    })
    
    const ecommerceCard = screen.getByText('E-commerce Store').closest('button')
    fireEvent.click(ecommerceCard!)
    
    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton)
    
    await waitFor(() => {
      expect(screen.getByText('Name your store')).toBeInTheDocument()
    })
  })

  test('validates subdomain format', async () => {
    render(<OnboardingPage />)
    
    // Navigate to step 2
    await waitFor(() => {
      expect(screen.getByText('What do you want to build?')).toBeInTheDocument()
    })
    
    const ecommerceCard = screen.getByText('E-commerce Store').closest('button')
    fireEvent.click(ecommerceCard!)
    fireEvent.click(screen.getByText('Next'))
    
    await waitFor(() => {
      expect(screen.getByText('Name your store')).toBeInTheDocument()
    })
    
    const input = screen.getByPlaceholderText('mystore')
    
    // Test invalid characters
    fireEvent.change(input, { target: { value: 'UPPERCASE' } })
    expect(input).toHaveValue('uppercase') // Should convert to lowercase
    
    fireEvent.change(input, { target: { value: 'spaces are bad' } })
    expect(input).toHaveValue('spacesarebad') // Should remove spaces
  })
})
```

### 10.2 E2E Tests (Cypress/Playwright)

**File:** `apps/web/accounts/e2e/onboarding.spec.ts`
```typescript
import { test, expect } from '@playwright/test'

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.goto('https://accounts.letbuyy.store/onboarding')
    // Assume user is already logged in for these tests
  })

  test('completes full onboarding flow', async ({ page }) => {
    // Step 1: Select store type
    await expect(page.locator('text=What do you want to build?')).toBeVisible()
    await page.click('button:has-text("E-commerce Store")')
    await page.click('button:has-text("Next")')

    // Step 2: Enter store name
    await expect(page.locator('text=Name your store')).toBeVisible()
    const uniqueName = `teststore${Date.now()}`
    await page.fill('input[placeholder="mystore"]', uniqueName)
    await page.click('button:has-text("Create Store")')

    // Wait for success
    await expect(page.locator('text=Store Created!')).toBeVisible({ timeout: 10000 })
    
    // Should redirect to admin
    await page.waitForURL(/admin\.letbuyy\.store/, { timeout: 15000 })
  })

  test('shows error for duplicate store name', async ({ page }) => {
    // Navigate to step 2
    await page.click('button:has-text("E-commerce Store")')
    await page.click('button:has-text("Next")')

    // Try to create with existing name
    await page.fill('input[placeholder="mystore"]', 'existingstore')
    await page.click('button:has-text("Create Store")')

    // Should show error
    await expect(page.locator('.auth-error')).toContainText('already taken')
  })

  test('toggles theme', async ({ page }) => {
    const html = page.locator('html')
    
    // Should start in light mode or dark mode
    const initialTheme = await html.getAttribute('class')
    
    // Click theme toggle
    await page.click('button:has-text("🌙"), button:has-text("☀️")')
    
    // Theme should change
    const newTheme = await html.getAttribute('class')
    expect(newTheme).not.toBe(initialTheme)
  })

  test('cycles through languages', async ({ page }) => {
    // Click language button
    await page.click('button:has-text("EN")')
    await expect(page.locator('button:has-text("HI")')).toBeVisible()
    
    await page.click('button:has-text("HI")')
    await expect(page.locator('button:has-text("TA")')).toBeVisible()
    
    await page.click('button:has-text("TA")')
    await expect(page.locator('button:has-text("EN")')).toBeVisible()
  })
})
```

### 10.3 Manual Testing Checklist
```markdown
## Manual Testing Checklist

### Pre-Deployment
- [ ] Local dev server starts without errors (`npm run dev`)
- [ ] Build completes successfully (`npm run build`)
- [ ] No TypeScript errors
- [ ] No console warnings in browser
- [ ] All images load correctly

### Onboarding UI
- [ ] Loading state displays correctly
- [ ] Logo (app_icon.png) displays at correct size
- [ ] Progress bar shows correct step
- [ ] Step 1: All 4 store type cards display
- [ ] Step 1: Card hover effect works
- [ ] Step 1: Card selection shows purple border + glow
- [ ] Step 1: "Next" button disabled until selection
- [ ] Step 2: Store name input accepts valid characters
- [ ] Step 2: Invalid characters are filtered out
- [ ] Step 2: ".letbuyy.store" suffix displays correctly
- [ ] Step 2: "Back" button returns to Step 1
- [ ] Step 2: "Create Store" button disabled until name entered
- [ ] Success state displays checkmark animation
- [ ] Success state shows "Redirecting..." spinner

### Theme & Language
- [ ] Theme toggle button visible in top-right
- [ ] Light mode: White background, dark text
- [ ] Dark mode: Dark navy background, white text
- [ ] Theme persists on page reload (localStorage)
- [ ] Language button cycles: EN → HI → TA → EN
- [ ] All text changes when language changes
- [ ] Language persists on page reload (localStorage)

### Error Handling
- [ ] Duplicate store name shows error banner
- [ ] Error banner has red background + border
- [ ] Error message is clear and actionable
- [ ] Validation errors prevent submission
- [ ] Network errors are caught and displayed

### Store Creation
- [ ] Successful creation redirects to admin dashboard
- [ ] Store record created in Supabase `stores` table
- [ ] `onboarding_attempts` record logged (success)
- [ ] Success email sent to user
- [ ] Success email contains correct store details
- [ ] Success email links work (open in browser)

### Email Notifications
- [ ] Success email arrives within 1 minute
- [ ] Success email has correct branding (logo, colors)
- [ ] Success email shows store URL and admin URL
- [ ] Success email "Open Dashboard" button works
- [ ] Failure email arrives for duplicate names
- [ ] Failure email explains error clearly
- [ ] Failure email "Try Again" button works
- [ ] Emails render correctly in Gmail, Outlook, Apple Mail

### Responsive Design
- [ ] Mobile (375px): Full-width card, no horizontal scroll
- [ ] Tablet (768px): Centered card with padding
- [ ] Desktop (1440px): Centered card with shadow
- [ ] Cards stack vertically on mobile
- [ ] Buttons stack vertically on mobile

### DNS & SSL
- [ ] accounts.letbuyy.store resolves to Vercel
- [ ] admin.letbuyy.store resolves to Vercel
- [ ] *.letbuyy.store (wildcard) resolves to Vercel
- [ ] All domains have valid SSL certificates
- [ ] No mixed content warnings
- [ ] HTTPS redirect works (http → https)

### Database
- [ ] New store creates record in `stores` table
- [ ] `user_id` correctly links to auth.users
- [ ] `subdomain` is unique (constraint enforced)
- [ ] `status` defaults to 'draft'
- [ ] `created_at` timestamp is correct
- [ ] Email log created in `email_logs` table
- [ ] RLS policies allow user to read their own stores
- [ ] RLS policies prevent reading other users' stores

### Integration
- [ ] Login redirect logic works (with/without store)
- [ ] Users without stores → /onboarding
- [ ] Users with stores → admin dashboard
- [ ] Session persists across page reloads
- [ ] Logout clears session and redirects to login
```

---

## Summary

This comprehensive implementation plan covers:

1. **Architecture**: Multi-tenant domain topology with wildcard DNS
2. **Database**: Complete schema with RLS policies
3. **Frontend**: Modern auth design system with theme/language support
4. **Email**: Professional React Email templates (success/failure)
5. **Infrastructure**: Fresh Cloudflare + Vercel deployment
6. **UI Wireframes**: Text-based wireframes for all screens
7. **Testing**: Unit tests, E2E tests, manual checklists
8. **Deployment**: Step-by-step guides for DNS, SSL, Vercel

**Total Implementation Time Estimate**: 8-12 hours for a single developer

**Next Steps**:
1. Review this plan
2. Make CSS changes (Part 1)
3. Rewrite onboarding page (Part 2)
4. Implement email system (Parts 7.2-7.5)
5. Set up fresh Cloudflare + Vercel accounts
6. Deploy and test

All wireframes are provided in text format as requested. The plan uses modern tech stack (Next.js 14, TypeScript, Tailwind, Supabase, Resend) and includes comprehensive email notifications for both success and failure cases with professional templates.