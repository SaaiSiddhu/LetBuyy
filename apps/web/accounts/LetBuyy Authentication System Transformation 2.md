# LetBuyy Authentication System Transformation
## From Basic Auth to Shopify-Grade Professional SaaS Authentication

**Document Version:** 1.0  
**Date:** February 12, 2026  
**Target:** Production-Ready Professional Authentication System

---

## Executive Summary

This document provides a comprehensive analysis of your current authentication system and a detailed implementation plan to transform it into a Shopify-grade, professional SaaS authentication system using Resend for email delivery.

### Current State Assessment
- **Rating:** Basic Implementation (3/10)
- **Issues:** Inconsistent flows, missing middleware, no email verification, poor session management
- **Tech Stack:** Supabase Auth, Next.js 16, scattered OAuth implementation

### Target State
- **Rating:** Professional SaaS-Grade (9/10)
- **Features:** Email verification, magic links, progressive disclosure, multi-account support, secure session management
- **Tech Stack:** Resend Email, Supabase (database only), Next.js 16, Secure cookies, Middleware-protected routes

---

## Table of Contents

1. [Deep Dive: Shopify Authentication Analysis](#1-shopify-authentication-analysis)
2. [Current System Critical Analysis](#2-current-system-analysis)
3. [Gap Analysis](#3-gap-analysis)
4. [New Authentication Architecture](#4-new-authentication-architecture)
5. [Resend Email Integration Strategy](#5-resend-email-integration)
6. [Implementation Phases](#6-implementation-phases)
7. [Technical Specifications](#7-technical-specifications)
8. [Security Requirements](#8-security-requirements)
9. [User Experience Flows](#9-user-experience-flows)
10. [Testing Strategy](#10-testing-strategy)
11. [Migration Plan](#11-migration-plan)

---

## 1. Shopify Authentication Analysis

### 1.1 Shopify's Authentication Philosophy

Shopify uses a **progressive disclosure** approach that prioritizes user experience while maintaining enterprise-grade security:

#### Key Principles
1. **Email-First Identity**: Email is the primary identifier
2. **Progressive Disclosure**: Show only what's needed, when it's needed
3. **Multi-Account Support**: Seamless switching between multiple stores/accounts
4. **Passwordless Options**: Magic links and verification codes
5. **Secure by Default**: HTTP-only cookies, CSRF protection, session rotation
6. **Device Trust**: Remember trusted devices for faster authentication

### 1.2 Shopify Login Flow Breakdown

```
┌─────────────────────────────────────────────────────────────────┐
│                     SHOPIFY LOGIN JOURNEY                        │
└─────────────────────────────────────────────────────────────────┘

STEP 1: Email Lookup (accounts.shopify.com/lookup)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌────────────────────────────────────┐
│  Enter your email                   │
│  ┌──────────────────────────────┐  │
│  │ email@example.com            │  │
│  └──────────────────────────────┘  │
│           [Continue]                │
└────────────────────────────────────┘

STEP 2: Check Account Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Database Query:
- Does email exist? YES → Show login options
- Does email exist? NO  → Show signup flow
- Multiple accounts?    → Show account selector

STEP 3A: Existing User - Progressive Disclosure
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌────────────────────────────────────┐
│  email@example.com         [Edit]   │
│                                      │
│  Enter your password                │
│  ┌──────────────────────────────┐  │
│  │ ••••••••••                   │  │
│  └──────────────────────────────┘  │
│  [Forgot password?]                 │
│                                      │
│           [Log in]                  │
│                                      │
│  Or use:                            │
│  [Send magic link instead]          │
└────────────────────────────────────┘

STEP 3B: New User - Signup Flow
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌────────────────────────────────────┐
│  Welcome! Let's create your account │
│                                      │
│  email@example.com         [Edit]   │
│                                      │
│  We'll send you a verification link │
│           [Continue]                │
└────────────────────────────────────┘
         ↓
Email sent with magic link → Verify → Set password

STEP 4: Multi-Account Detection
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
If user has multiple stores:
┌────────────────────────────────────┐
│  Choose an account                  │
│                                      │
│  ┌──────────────────────────────┐  │
│  │ 🏪 Store A                   │  │
│  │ store-a.myshopify.com       │  │
│  └──────────────────────────────┘  │
│                                      │
│  ┌──────────────────────────────┐  │
│  │ 🏪 Store B                   │  │
│  │ store-b.myshopify.com       │  │
│  └──────────────────────────────┘  │
│                                      │
│  + Add another store                │
└────────────────────────────────────┘

STEP 5: Trusted Device Recognition
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
For returning users on trusted devices:
┌────────────────────────────────────┐
│  Welcome back!                      │
│                                      │
│  ┌──────────────────────────────┐  │
│  │ 👤 John Doe                  │  │
│  │ john@example.com            │  │
│  │ [Continue as John]          │  │
│  └──────────────────────────────┘  │
│                                      │
│  [Use a different account]          │
└────────────────────────────────────┘
         ↓
One-click login (no password needed)
```

### 1.3 Shopify Signup Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHOPIFY SIGNUP JOURNEY                        │
└─────────────────────────────────────────────────────────────────┘

STEP 1: Email Entry
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User enters email → System checks if email exists

STEP 2: Email Verification (if new user)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌────────────────────────────────────┐
│  Check your email                   │
│                                      │
│  We sent a verification link to:    │
│  email@example.com                  │
│                                      │
│  📧                                  │
│                                      │
│  [Resend email]                     │
│  [Use a different email]            │
└────────────────────────────────────┘

STEP 3: Magic Link Click
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User clicks link in email →
Token validated →
Redirect to password setup

STEP 4: Password Creation
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌────────────────────────────────────┐
│  Create your password               │
│                                      │
│  Choose a strong password           │
│  ┌──────────────────────────────┐  │
│  │ ••••••••••                   │  │
│  └──────────────────────────────┘  │
│                                      │
│  ✓ At least 8 characters            │
│  ✓ Mix of letters and numbers       │
│                                      │
│           [Create account]          │
└────────────────────────────────────┘

STEP 5: Store Creation / Onboarding
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Proceed to store setup wizard
```

### 1.4 Key Shopify Features to Replicate

#### A. Progressive Disclosure
- First screen: Email only
- Second screen: Context-aware (password OR magic link)
- No overwhelming forms

#### B. Email Verification Flow
- **Signup**: Magic link → Verify → Set password
- **Login**: Password OR magic link option
- **Forgot Password**: Magic link to reset page

#### C. Multi-Account Support
- Store multiple accounts in secure cookies
- Show account picker on login
- One-click switch between accounts
- "Use different account" option always available

#### D. Trusted Device Recognition
- Cookie-based device fingerprinting
- Show user avatar/name for returning users
- Skip password for trusted devices (optional)

#### E. Security Features
- HTTP-only cookies
- CSRF tokens
- Session rotation after login
- Device tracking and management
- Email notifications for new logins

---

## 2. Current System Analysis

### 2.1 Critical Issues

#### 🔴 CRITICAL ISSUES

1. **No Email Verification**
   - Users can sign up without verifying email
   - High risk of fake accounts
   - No way to confirm email ownership

2. **Dual Login Pages**
   - `/login` and `/lookup` both exist
   - `/login` lacks i18n and theme toggle
   - Confusing for users and developers

3. **No Middleware Protection**
   - Any page accessible without auth
   - No automatic session refresh
   - No redirect logic for protected routes

4. **Broken Multi-Account System**
   - `localStorage` used for account storage (insecure)
   - No code writes to `letbuyy_accounts` key
   - Feature is completely non-functional

5. **Inconsistent Styling**
   - `/select` and `/onboarding` use hardcoded dark mode
   - No CSS variable consistency
   - Light mode broken on these pages

6. **OAuth Without Email Verification**
   - OAuth users bypass email verification
   - No way to ensure valid email addresses

7. **Missing Reset Password Page**
   - Forgot password flow redirects to non-existent page
   - Broken user experience

8. **No Session Management**
   - No refresh token handling
   - No device tracking
   - No logout from all devices option

#### 🟡 MODERATE ISSUES

1. **Wasteful Supabase Client Pattern**
   - Creates new client instance per component
   - Should use singleton pattern

2. **No Rate Limiting**
   - Auth endpoints not protected
   - Vulnerable to brute force attacks

3. **No Email Notifications**
   - No welcome emails
   - No login alerts
   - No password change confirmations

4. **Poor Error Handling**
   - Generic error messages
   - No proper error logging
   - Poor user feedback

### 2.2 Architecture Problems

```
CURRENT (BROKEN) FLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Landing Page
     ↓
  /signup ────────────→ Email OTP (Supabase)
     │                        ↓
     │                   /check-email
     │                        ↓
     │              Click magic link
     │                        ↓
     │              /auth/callback
     │                        ↓
     └──────────→ OAuth (Google/Apple)
                             ↓
                  Has store? ─────→ Yes → /admin/{store}
                             │
                             No
                             ↓
                       /onboarding
                             ↓
                      Create store
                             ↓
                       /admin/{store}

PROBLEMS:
❌ No email verification for signup
❌ OAuth bypasses email verification
❌ No multi-account support
❌ No device trust
❌ Inconsistent styling
❌ Missing reset password page
❌ No middleware protection
```

---

## 3. Gap Analysis

### 3.1 Feature Comparison Matrix

| Feature | Shopify | Current LetBuyy | Target LetBuyy |
|---------|---------|-----------------|----------------|
| **Email Verification** | ✅ Magic link | ❌ None | ✅ Resend magic link |
| **Progressive Disclosure** | ✅ Email → Password | ⚠️ Partial (/lookup only) | ✅ Full implementation |
| **Multi-Account Support** | ✅ Cookie-based | ❌ Broken | ✅ Secure cookie-based |
| **Trusted Device** | ✅ One-click login | ❌ None | ✅ Cookie + fingerprint |
| **Password Reset** | ✅ Magic link → Reset page | ❌ Broken flow | ✅ Complete flow |
| **Email Notifications** | ✅ All actions | ❌ None | ✅ Resend templates |
| **OAuth** | ✅ With verification | ⚠️ No verification | ✅ With verification |
| **Session Management** | ✅ Advanced | ❌ Basic | ✅ Middleware-based |
| **Device Tracking** | ✅ Full tracking | ❌ None | ✅ Database-tracked |
| **Rate Limiting** | ✅ Yes | ❌ No | ✅ Upstash Redis |
| **CSRF Protection** | ✅ Yes | ⚠️ Partial | ✅ Complete |
| **Middleware Protection** | ✅ Yes | ❌ No | ✅ Complete |
| **Consistent Styling** | ✅ Yes | ❌ Broken | ✅ CSS variables |
| **i18n Support** | ✅ Full | ⚠️ Partial | ✅ Full |

### 3.2 Security Comparison

| Security Feature | Shopify | Current | Target |
|------------------|---------|---------|--------|
| HTTP-only cookies | ✅ | ⚠️ Partial | ✅ |
| Secure flag on cookies | ✅ | ⚠️ | ✅ |
| SameSite=Lax/Strict | ✅ | ⚠️ | ✅ |
| CSRF tokens | ✅ | ❌ | ✅ |
| Email verification | ✅ | ❌ | ✅ |
| Rate limiting | ✅ | ❌ | ✅ |
| Password strength | ✅ | ⚠️ Basic | ✅ |
| Breach detection | ✅ | ❌ | ✅ |
| 2FA support | ✅ | ❌ | 🔮 Future |
| Device tracking | ✅ | ❌ | ✅ |
| Session rotation | ✅ | ❌ | ✅ |
| Logout all devices | ✅ | ❌ | ✅ |

---

## 4. New Authentication Architecture

### 4.1 System Architecture Diagram

```
┌───────────────────────────────────────────────────────────────────────┐
│                      LETBUYY AUTH ECOSYSTEM                            │
└───────────────────────────────────────────────────────────────────────┘

┌─────────────┐      ┌──────────────┐      ┌─────────────────┐
│   Browser   │◄────►│   accounts   │◄────►│  Supabase DB    │
│             │      │  (Next.js 16) │      │  (Data Layer)   │
└─────────────┘      └──────────────┘      └─────────────────┘
       │                    │                       │
       │                    │                       │
       │                    ▼                       │
       │            ┌──────────────┐                │
       │            │   Resend     │                │
       │            │   Email API  │                │
       │            └──────────────┘                │
       │                    │                       │
       │                    │                       │
       ▼                    ▼                       ▼
┌──────────────────────────────────────────────────────────┐
│              SECURITY & SESSION MANAGEMENT                │
│  • HTTP-only Cookies (accounts, devices, sessions)       │
│  • CSRF Tokens (stored in cookies)                       │
│  • Rate Limiting (Upstash Redis)                         │
│  • Session Rotation (post-login, post-password-change)   │
└──────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                  DATABASE SCHEMA                         │
├─────────────────────────────────────────────────────────┤
│  users                                                   │
│  ├─ id (uuid, PK)                                       │
│  ├─ email (unique)                                      │
│  ├─ email_verified (boolean)                           │
│  ├─ password_hash (text)                               │
│  ├─ created_at                                          │
│  └─ updated_at                                          │
│                                                          │
│  sessions                                                │
│  ├─ id (uuid, PK)                                       │
│  ├─ user_id (FK → users)                               │
│  ├─ session_token (unique)                             │
│  ├─ device_fingerprint (text)                          │
│  ├─ ip_address (inet)                                  │
│  ├─ user_agent (text)                                  │
│  ├─ last_activity (timestamp)                          │
│  ├─ expires_at (timestamp)                             │
│  └─ created_at                                          │
│                                                          │
│  devices                                                 │
│  ├─ id (uuid, PK)                                       │
│  ├─ user_id (FK → users)                               │
│  ├─ device_fingerprint (unique)                        │
│  ├─ device_name (text)                                 │
│  ├─ is_trusted (boolean)                               │
│  ├─ last_used (timestamp)                              │
│  └─ created_at                                          │
│                                                          │
│  verification_tokens                                     │
│  ├─ id (uuid, PK)                                       │
│  ├─ email (text)                                        │
│  ├─ token (unique)                                      │
│  ├─ type (enum: email_verify, password_reset)          │
│  ├─ expires_at (timestamp)                             │
│  └─ created_at                                          │
│                                                          │
│  user_accounts (multi-account support)                  │
│  ├─ id (uuid, PK)                                       │
│  ├─ user_id (FK → users)                               │
│  ├─ device_fingerprint (text)                          │
│  ├─ accounts (jsonb) [{email, store_id, ...}]          │
│  └─ updated_at                                          │
└─────────────────────────────────────────────────────────┘
```

### 4.2 Application Structure

```
apps/web/accounts/
├── middleware.ts                 # 🆕 Auth middleware (session check, CSRF, rate limit)
├── next.config.ts
├── package.json
├── tsconfig.json
│
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx             # → /lookup (redirect)
│   │   ├── globals.css          # ✅ Unified CSS variables
│   │   │
│   │   ├── lookup/
│   │   │   └── page.tsx         # 🔄 Enhanced: Progressive disclosure + device trust
│   │   │
│   │   ├── signup/
│   │   │   └── page.tsx         # 🔄 Email → Send magic link
│   │   │
│   │   ├── verify-email/
│   │   │   └── page.tsx         # 🆕 Magic link verification + password setup
│   │   │
│   │   ├── reset-password/
│   │   │   └── page.tsx         # 🆕 Password reset form (after magic link)
│   │   │
│   │   ├── forgot-password/
│   │   │   └── page.tsx         # ✅ Send reset magic link
│   │   │
│   │   ├── check-email/
│   │   │   └── page.tsx         # ✅ Email sent confirmation
│   │   │
│   │   ├── select/
│   │   │   └── page.tsx         # 🔄 Multi-account selector (cookie-based)
│   │   │
│   │   ├── onboarding/
│   │   │   └── page.tsx         # 🔄 Fixed styling (CSS variables)
│   │   │
│   │   └── api/
│   │       ├── auth/
│   │       │   ├── signup/route.ts           # 🆕 Email signup (create user, send magic link)
│   │       │   ├── verify-email/route.ts     # 🆕 Verify magic link token
│   │       │   ├── login/route.ts            # 🆕 Password login
│   │       │   ├── logout/route.ts           # 🆕 Clear cookies, invalidate session
│   │       │   ├── logout-all/route.ts       # 🆕 Logout from all devices
│   │       │   ├── forgot-password/route.ts  # 🆕 Send reset magic link
│   │       │   ├── reset-password/route.ts   # 🆕 Set new password
│   │       │   ├── magic-link/route.ts       # 🆕 Send magic link for login
│   │       │   └── callback/route.ts         # 🔄 OAuth callback (with email verification)
│   │       │
│   │       ├── session/
│   │       │   ├── refresh/route.ts          # 🆕 Refresh session
│   │       │   └── devices/route.ts          # 🆕 Get user devices, remove device
│   │       │
│   │       └── accounts/
│   │           ├── list/route.ts             # 🆕 Get saved accounts for device
│   │           └── add/route.ts              # 🆕 Add account to device
│   │
│   ├── lib/
│   │   ├── auth/
│   │   │   ├── session.ts                    # 🆕 Session management (create, validate, refresh)
│   │   │   ├── password.ts                   # 🆕 Password hashing (bcrypt)
│   │   │   ├── tokens.ts                     # 🆕 Token generation & validation
│   │   │   ├── device.ts                     # 🆕 Device fingerprinting
│   │   │   ├── rate-limit.ts                 # 🆕 Rate limiting (Upstash)
│   │   │   └── csrf.ts                       # 🆕 CSRF token handling
│   │   │
│   │   ├── email/
│   │   │   ├── resend.ts                     # 🆕 Resend client
│   │   │   └── templates/
│   │   │       ├── verification.tsx          # 🆕 Email verification template
│   │   │       ├── welcome.tsx               # 🆕 Welcome email
│   │   │       ├── reset-password.tsx        # 🆕 Password reset template
│   │   │       ├── login-alert.tsx           # 🆕 New login notification
│   │   │       └── password-changed.tsx      # 🆕 Password change confirmation
│   │   │
│   │   ├── db/
│   │   │   ├── client.ts                     # 🔄 Supabase client (singleton)
│   │   │   └── queries/
│   │   │       ├── users.ts                  # 🆕 User CRUD
│   │   │       ├── sessions.ts               # 🆕 Session CRUD
│   │   │       ├── devices.ts                # 🆕 Device CRUD
│   │   │       ├── tokens.ts                 # 🆕 Token CRUD
│   │   │       └── accounts.ts               # 🆕 Multi-account CRUD
│   │   │
│   │   ├── utils/
│   │   │   ├── cookies.ts                    # 🆕 Cookie helpers (secure, HTTP-only)
│   │   │   ├── validation.ts                 # 🆕 Input validation (zod)
│   │   │   └── errors.ts                     # 🆕 Custom error classes
│   │   │
│   │   └── types/
│   │       ├── auth.ts                       # 🆕 Auth types
│   │       ├── session.ts                    # 🆕 Session types
│   │       └── user.ts                       # 🆕 User types
│   │
│   └── components/
│       ├── auth/
│       │   ├── EmailInput.tsx                # 🆕 Reusable email input
│       │   ├── PasswordInput.tsx             # 🆕 Password input with strength meter
│       │   ├── DeviceTrustCard.tsx           # 🆕 "Continue as {user}" card
│       │   ├── AccountSelector.tsx           # 🆕 Multi-account picker
│       │   └── OAuthButtons.tsx              # 🔄 Enhanced OAuth buttons
│       │
│       └── ui/
│           ├── Button.tsx                    # ✅ Consistent button
│           ├── Input.tsx                     # ✅ Consistent input
│           └── Card.tsx                      # ✅ Consistent card
│
└── public/
    ├── icons/
    └── favicon.png
```

---

## 5. Resend Email Integration

### 5.1 Why Resend?

Resend is a modern email API built for developers, offering:
- **Simple API**: Clean, intuitive interface
- **React Email Templates**: Build emails with React components
- **High Deliverability**: Optimized for inbox placement
- **Domain Verification**: Your domain, your emails
- **Affordable**: Free tier includes 3,000 emails/month
- **TypeScript-first**: Excellent DX for Next.js projects

### 5.2 Resend Setup

#### A. Install Dependencies

```bash
npm install resend react-email @react-email/components
npm install -D @types/node
```

#### B. Environment Variables

```env
# .env.local
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=noreply@letbuyy.store
RESEND_DOMAIN=letbuyy.store
```

#### C. Resend Client

```typescript
// src/lib/email/resend.ts
import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

export const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@letbuyy.store';
export const DOMAIN = process.env.RESEND_DOMAIN || 'letbuyy.store';
```

### 5.3 Email Templates

#### A. Email Verification Template

```tsx
// src/lib/email/templates/verification.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface VerificationEmailProps {
  email: string;
  verificationLink: string;
}

export const VerificationEmail = ({ email, verificationLink }: VerificationEmailProps) => {
  return (
    
      
      Verify your LetBuyy account
      
        
          Verify your email address
          
            Welcome to LetBuyy! Click the button below to verify your email address and complete
            your account setup.
          
          
            
              Verify Email
            
          
          
            This link will expire in 24 hours. If you didn't create a LetBuyy account, you can
            safely ignore this email.
          
          
            Sent to {email} | LetBuyy | letbuyy.store
          
        
      
    
  );
};

const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const h1 = {
  color: '#333',
  fontSize: '24px',
  fontWeight: 'bold',
  margin: '40px 0',
  padding: '0',
  textAlign: 'center' as const,
};

const text = {
  color: '#333',
  fontSize: '16px',
  lineHeight: '26px',
  textAlign: 'center' as const,
};

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '32px 0',
};

const button = {
  backgroundColor: '#8B5CF6',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '12px 24px',
};

const footer = {
  color: '#8898aa',
  fontSize: '12px',
  lineHeight: '16px',
  textAlign: 'center' as const,
  marginTop: '32px',
};
```

#### B. Password Reset Template

```tsx
// src/lib/email/templates/reset-password.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface ResetPasswordEmailProps {
  email: string;
  resetLink: string;
}

export const ResetPasswordEmail = ({ email, resetLink }: ResetPasswordEmailProps) => {
  return (
    
      
      Reset your LetBuyy password
      
        
          Reset your password
          
            We received a request to reset your password. Click the button below to create a new
            password.
          
          
            
              Reset Password
            
          
          
            This link will expire in 1 hour. If you didn't request a password reset, you can
            safely ignore this email.
          
          
            Sent to {email} | LetBuyy | letbuyy.store
          
        
      
    
  );
};

// ... (same styles as verification email)
```

#### C. Magic Link Login Template

```tsx
// src/lib/email/templates/magic-link.tsx
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface MagicLinkEmailProps {
  email: string;
  magicLink: string;
}

export const MagicLinkEmail = ({ email, magicLink }: MagicLinkEmailProps) => {
  return (
    
      
      Your LetBuyy login link
      
        
          Log in to LetBuyy
          
            Click the button below to securely log in to your LetBuyy account. This link will only
            work once.
          
          
            
              Log In
            
          
          
            This link will expire in 15 minutes. If you didn't request this, you can safely ignore
            this email.
          
          
            Sent to {email} | LetBuyy | letbuyy.store
          
        
      
    
  );
};

// ... (same styles)
```

### 5.4 Email Sending Service

```typescript
// src/lib/email/send.ts
import { resend, FROM_EMAIL } from './resend';
import { VerificationEmail } from './templates/verification';
import { ResetPasswordEmail } from './templates/reset-password';
import { MagicLinkEmail } from './templates/magic-link';
import { WelcomeEmail } from './templates/welcome';
import { LoginAlertEmail } from './templates/login-alert';
import { PasswordChangedEmail } from './templates/password-changed';

export async function sendVerificationEmail(email: string, token: string) {
  const verificationLink = `${process.env.NEXT_PUBLIC_ACCOUNTS_URL}/verify-email?token=${token}`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Verify your LetBuyy account',
      react: VerificationEmail({ email, verificationLink }),
    });
  } catch (error) {
    console.error('Failed to send verification email:', error);
    throw new Error('Failed to send verification email');
  }
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const resetLink = `${process.env.NEXT_PUBLIC_ACCOUNTS_URL}/reset-password?token=${token}`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Reset your LetBuyy password',
      react: ResetPasswordEmail({ email, resetLink }),
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}

export async function sendMagicLinkEmail(email: string, token: string) {
  const magicLink = `${process.env.NEXT_PUBLIC_ACCOUNTS_URL}/api/auth/magic-link/verify?token=${token}`;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Your LetBuyy login link',
      react: MagicLinkEmail({ email, magicLink }),
    });
  } catch (error) {
    console.error('Failed to send magic link email:', error);
    throw new Error('Failed to send magic link email');
  }
}

export async function sendWelcomeEmail(email: string, name?: string) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Welcome to LetBuyy!',
      react: WelcomeEmail({ email, name }),
    });
  } catch (error) {
    console.error('Failed to send welcome email:', error);
    // Don't throw - welcome email is not critical
  }
}

export async function sendLoginAlertEmail(
  email: string,
  deviceInfo: { name: string; location?: string; ip: string }
) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'New login to your LetBuyy account',
      react: LoginAlertEmail({ email, ...deviceInfo }),
    });
  } catch (error) {
    console.error('Failed to send login alert email:', error);
    // Don't throw - alert email is not critical
  }
}

export async function sendPasswordChangedEmail(email: string) {
  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      subject: 'Your LetBuyy password was changed',
      react: PasswordChangedEmail({ email }),
    });
  } catch (error) {
    console.error('Failed to send password changed email:', error);
    // Don't throw - confirmation email is not critical
  }
}
```

---

## 6. Implementation Phases

### Phase 1: Foundation & Setup (Week 1)

**Goal:** Set up infrastructure and core utilities

#### Tasks

1. **Database Schema Migration**
   - [ ] Create `users` table migration
   - [ ] Create `sessions` table migration
   - [ ] Create `devices` table migration
   - [ ] Create `verification_tokens` table migration
   - [ ] Create `user_accounts` table migration
   - [ ] Add indexes for performance
   - [ ] Set up Row Level Security (RLS) policies

2. **Resend Email Setup**
   - [ ] Create Resend account
   - [ ] Verify domain (letbuyy.store)
   - [ ] Get API key
   - [ ] Install dependencies (`resend`, `react-email`, `@react-email/components`)
   - [ ] Create email templates (verification, reset, magic link, welcome, alerts)
   - [ ] Test email delivery

3. **Core Libraries**
   - [ ] Implement password hashing (`bcrypt`)
   - [ ] Implement token generation (`crypto`)
   - [ ] Implement session management
   - [ ] Implement cookie utilities (HTTP-only, Secure, SameSite)
   - [ ] Implement device fingerprinting
   - [ ] Implement CSRF protection
   - [ ] Set up rate limiting (Upstash Redis)

4. **Environment Setup**
   - [ ] Add all required environment variables
   - [ ] Configure Supabase connection
   - [ ] Configure Resend API key
   - [ ] Configure app URLs

#### Deliverables
- ✅ Database schema deployed
- ✅ Email sending functional
- ✅ Core auth utilities implemented
- ✅ Environment configured

---

### Phase 2: Authentication Core (Week 2)

**Goal:** Implement core authentication flows

#### Tasks

1. **Signup Flow**
   - [ ] Build `/signup` page (email entry only)
   - [ ] Create `/api/auth/signup` endpoint
     - Validate email
     - Check if user exists
     - Create user record (email_verified = false)
     - Generate verification token
     - Send verification email
     - Return success
   - [ ] Build `/check-email` confirmation page
   - [ ] Create `/verify-email` page (token validation + password setup)
   - [ ] Create `/api/auth/verify-email` endpoint
     - Validate token
     - Mark email as verified
     - Accept password
     - Hash and store password
     - Create session
     - Set session cookie
     - Send welcome email
     - Redirect to onboarding or admin

2. **Login Flow**
   - [ ] Build `/lookup` page (progressive disclosure)
     - Email input first
     - Check if email exists
     - If exists → show password field
     - If not exists → redirect to signup
   - [ ] Create `/api/auth/login` endpoint
     - Validate email + password
     - Check email verification status
     - Create session
     - Set session cookie
     - Track device
     - Send login alert (if new device)
     - Return user + stores
   - [ ] Implement "Send magic link instead" option
   - [ ] Create `/api/auth/magic-link` endpoint
     - Generate magic link token
     - Send magic link email
     - Redirect to /check-email

3. **Password Reset Flow**
   - [ ] Build `/forgot-password` page
   - [ ] Create `/api/auth/forgot-password` endpoint
     - Validate email
     - Generate reset token
     - Send reset email
     - Redirect to /check-email
   - [ ] Build `/reset-password` page (token + new password)
   - [ ] Create `/api/auth/reset-password` endpoint
     - Validate token
     - Hash new password
     - Update user password
     - Invalidate all existing sessions
     - Send password changed email
     - Redirect to /lookup

4. **Session Management**
   - [ ] Create `/api/auth/logout` endpoint
     - Clear session cookie
     - Invalidate session in database
   - [ ] Create `/api/auth/logout-all` endpoint
     - Clear all sessions for user
     - Clear session cookie
   - [ ] Create `/api/session/refresh` endpoint
     - Validate current session
     - Extend expiration
     - Rotate session token (optional)

#### Deliverables
- ✅ Complete signup flow with email verification
- ✅ Complete login flow with progressive disclosure
- ✅ Complete password reset flow
- ✅ Session management endpoints

---

### Phase 3: Multi-Account & Device Trust (Week 3)

**Goal:** Implement Shopify-like multi-account support and device trust

#### Tasks

1. **Device Fingerprinting**
   - [ ] Implement client-side fingerprinting
     - Browser user agent
     - Screen resolution
     - Timezone
     - Language
     - Canvas fingerprint (optional)
   - [ ] Store device fingerprint in cookie
   - [ ] Track devices in database

2. **Multi-Account Support**
   - [ ] Update login flow to save account to device
   - [ ] Create `/api/accounts/list` endpoint
     - Get all accounts for current device
     - Return email, store info, last used
   - [ ] Create `/api/accounts/add` endpoint
     - Add new account to device
   - [ ] Build `/select` page
     - Show all saved accounts
     - One-click login for trusted devices
     - "Use different account" option
     - Clean, consistent styling with CSS variables

3. **Trusted Device Login**
   - [ ] Enhance `/lookup` page
     - Detect returning user on trusted device
     - Show "Continue as {user}" card
     - One-click login (no password required)
     - "Use different account" option
   - [ ] Create device trust logic
     - Check device fingerprint
     - Check last login < 30 days
     - Auto-populate email
     - Skip password if trusted

4. **Device Management**
   - [ ] Create `/api/session/devices` endpoint
     - List all devices for user
     - Show device name, last used, location
   - [ ] Add "Remove device" functionality
     - Remove device from trusted list
     - Invalidate sessions on that device

#### Deliverables
- ✅ Device fingerprinting working
- ✅ Multi-account selector functional
- ✅ Trusted device one-click login
- ✅ Device management API

---

### Phase 4: Middleware & Route Protection (Week 4)

**Goal:** Implement Next.js middleware for automatic session management and route protection

#### Tasks

1. **Middleware Implementation**
   - [ ] Create `middleware.ts`
   - [ ] Implement session validation
     - Read session cookie
     - Validate session token
     - Check expiration
     - Refresh if needed
   - [ ] Implement route protection
     - Public routes: `/signup`, `/lookup`, `/forgot-password`, `/verify-email`, `/reset-password`, `/check-email`
     - Protected routes: `/onboarding`, `/select`
     - Admin routes: Redirect to admin app
   - [ ] Implement automatic redirects
     - If not authenticated → `/lookup`
     - If authenticated but no store → `/onboarding`
     - If authenticated with store → admin app

2. **CSRF Protection**
   - [ ] Generate CSRF token on page load
   - [ ] Store in HTTP-only cookie
   - [ ] Validate on all state-changing requests (POST, PUT, DELETE)
   - [ ] Return 403 if CSRF token invalid

3. **Rate Limiting**
   - [ ] Set up Upstash Redis
   - [ ] Implement rate limiting for auth endpoints
     - Signup: 5 per hour per IP
     - Login: 10 per hour per IP
     - Password reset: 3 per hour per email
     - Magic link: 5 per hour per email
   - [ ] Return 429 if rate limit exceeded

4. **Error Handling**
   - [ ] Implement custom error classes
   - [ ] Add proper error logging
   - [ ] Return user-friendly error messages
   - [ ] Log errors to monitoring service (optional)

#### Deliverables
- ✅ Middleware protecting all routes
- ✅ CSRF protection on all mutations
- ✅ Rate limiting on auth endpoints
- ✅ Proper error handling and logging

---

### Phase 5: UI/UX Polish & Consistency (Week 5)

**Goal:** Ensure consistent, professional UI across all auth pages

#### Tasks

1. **Unified CSS Variables**
   - [ ] Audit `globals.css`
   - [ ] Ensure all pages use CSS variables (not hardcoded colors)
   - [ ] Fix `/select` page (remove hardcoded Tailwind classes)
   - [ ] Fix `/onboarding` page (remove hardcoded Tailwind classes)
   - [ ] Add light mode support to all pages

2. **Component Library**
   - [ ] Extract reusable components
     - `<EmailInput />` with validation
     - `<PasswordInput />` with strength meter
     - `<Button />` with loading states
     - `<Card />` for consistent containers
     - `<OAuthButtons />` for social login
   - [ ] Ensure consistent spacing, typography, colors

3. **Progressive Disclosure Refinement**
   - [ ] Polish `/lookup` page
     - Smooth transitions
     - Clear error messages
     - Loading states
     - "Back" button to change email
   - [ ] Add animations (subtle, professional)
   - [ ] Add focus management (auto-focus inputs)

4. **Internationalization (i18n)**
   - [ ] Ensure `/lookup` i18n works
   - [ ] Add i18n to all pages
   - [ ] Support: English, Hindi, Tamil
   - [ ] Store language preference in cookie

5. **Dark Mode**
   - [ ] Ensure dark mode works on all pages
   - [ ] Fix theme flash prevention
   - [ ] Store theme preference in cookie

6. **Accessibility**
   - [ ] Add proper ARIA labels
   - [ ] Ensure keyboard navigation works
   - [ ] Add focus indicators
   - [ ] Test with screen reader

#### Deliverables
- ✅ Consistent styling across all pages
- ✅ Reusable component library
- ✅ Smooth progressive disclosure UX
- ✅ Full i18n support
- ✅ Dark mode working everywhere
- ✅ Accessible to all users

---

### Phase 6: OAuth Enhancement (Week 6)

**Goal:** Ensure OAuth users also verify their email

#### Tasks

1. **OAuth Email Verification**
   - [ ] Update `/api/auth/callback/route.ts`
     - After OAuth success, check if email is verified
     - If not verified:
       - Generate verification token
       - Send verification email
       - Redirect to `/check-email?oauth=true`
     - If verified:
       - Create session
       - Redirect to admin or onboarding

2. **OAuth Flow Diagram**
   ```
   User clicks "Continue with Google"
          ↓
   Redirect to Google OAuth
          ↓
   Google callback → /api/auth/callback
          ↓
   Check: Is email verified in our system?
          ├─ YES → Create session → Redirect to admin/onboarding
          └─ NO  → Send verification email → Redirect to /check-email?oauth=true
                        ↓
                  User clicks verification link
                        ↓
                  Email verified → Create session → Redirect to admin/onboarding
   ```

3. **Handle Unverified OAuth Users**
   - [ ] Create special `/check-email` variant for OAuth
     - Explain that verification is required
     - Resend button
     - "Use different email" option

#### Deliverables
- ✅ OAuth users must verify email before access
- ✅ Smooth OAuth verification flow
- ✅ No bypassing email verification

---

### Phase 7: Testing & Security Audit (Week 7)

**Goal:** Ensure system is secure, reliable, and production-ready

#### Tasks

1. **Unit Tests**
   - [ ] Test password hashing
   - [ ] Test token generation/validation
   - [ ] Test session management
   - [ ] Test CSRF protection
   - [ ] Test rate limiting
   - [ ] Test device fingerprinting

2. **Integration Tests**
   - [ ] Test complete signup flow
   - [ ] Test complete login flow
   - [ ] Test password reset flow
   - [ ] Test magic link flow
   - [ ] Test multi-account flow
   - [ ] Test OAuth flow
   - [ ] Test session refresh
   - [ ] Test logout

3. **Security Audit**
   - [ ] Review all endpoints for vulnerabilities
   - [ ] Test SQL injection protection
   - [ ] Test XSS protection
   - [ ] Test CSRF protection
   - [ ] Test rate limiting effectiveness
   - [ ] Review cookie security settings
   - [ ] Check for exposed secrets
   - [ ] Test password strength requirements
   - [ ] Test session hijacking prevention

4. **Performance Testing**
   - [ ] Load test auth endpoints
   - [ ] Test database query performance
   - [ ] Test email sending performance
   - [ ] Optimize slow queries

5. **Browser Testing**
   - [ ] Test on Chrome, Firefox, Safari, Edge
   - [ ] Test on mobile (iOS Safari, Chrome Android)
   - [ ] Test dark mode on all browsers
   - [ ] Test i18n on all browsers

#### Deliverables
- ✅ Comprehensive test suite
- ✅ Security vulnerabilities addressed
- ✅ Performance optimized
- ✅ Cross-browser compatibility

---

### Phase 8: Documentation & Deployment (Week 8)

**Goal:** Document the system and deploy to production

#### Tasks

1. **Documentation**
   - [ ] API documentation (all endpoints)
   - [ ] Database schema documentation
   - [ ] Environment variables documentation
   - [ ] Email templates documentation
   - [ ] Rate limiting documentation
   - [ ] Session management documentation
   - [ ] Multi-account flow documentation
   - [ ] OAuth flow documentation

2. **Developer Guide**
   - [ ] Setup instructions
   - [ ] Local development guide
   - [ ] Testing guide
   - [ ] Deployment guide
   - [ ] Troubleshooting guide

3. **Deployment Prep**
   - [ ] Set up production Supabase project
   - [ ] Set up production Resend account
   - [ ] Set up production Upstash Redis
   - [ ] Configure production environment variables
   - [ ] Set up monitoring (Sentry, LogRocket, etc.)
   - [ ] Set up error logging
   - [ ] Set up analytics

4. **Production Deployment**
   - [ ] Deploy to Vercel/production environment
   - [ ] Run database migrations
   - [ ] Verify email delivery
   - [ ] Test all flows in production
   - [ ] Monitor for errors
   - [ ] Set up automated backups

5. **Post-Deployment**
   - [ ] Monitor logs for errors
   - [ ] Monitor email deliverability
   - [ ] Monitor rate limiting effectiveness
   - [ ] Monitor session management
   - [ ] Collect user feedback
   - [ ] Fix any production issues

#### Deliverables
- ✅ Complete documentation
- ✅ Production deployment successful
- ✅ Monitoring and logging set up
- ✅ System running smoothly in production

---

## 7. Technical Specifications

### 7.1 API Endpoints

#### Authentication Endpoints

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/api/auth/signup` | POST | Create account, send verification email | `{ email }` | `{ success: true }` |
| `/api/auth/verify-email` | POST | Verify email and set password | `{ token, password }` | `{ success: true, user, session }` |
| `/api/auth/login` | POST | Login with email + password | `{ email, password, deviceFingerprint }` | `{ success: true, user, stores, session }` |
| `/api/auth/logout` | POST | Logout (invalidate session) | `{}` | `{ success: true }` |
| `/api/auth/logout-all` | POST | Logout from all devices | `{}` | `{ success: true }` |
| `/api/auth/forgot-password` | POST | Send password reset email | `{ email }` | `{ success: true }` |
| `/api/auth/reset-password` | POST | Reset password with token | `{ token, password }` | `{ success: true }` |
| `/api/auth/magic-link` | POST | Send magic link for login | `{ email }` | `{ success: true }` |
| `/api/auth/magic-link/verify` | GET | Verify magic link token | `?token=xxx` | Redirect to admin/onboarding |
| `/api/auth/callback` | GET | OAuth callback (Google, Apple) | `?code=xxx` | Redirect to admin/onboarding |

#### Session Endpoints

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/api/session/refresh` | POST | Refresh session | `{}` | `{ success: true, session }` |
| `/api/session/devices` | GET | Get all user devices | - | `{ devices: [...] }` |
| `/api/session/devices/:id` | DELETE | Remove device | - | `{ success: true }` |

#### Account Endpoints

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/api/accounts/list` | GET | Get saved accounts for device | - | `{ accounts: [...] }` |
| `/api/accounts/add` | POST | Add account to device | `{ email, storeId, storeName }` | `{ success: true }` |

### 7.2 Database Schema

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  email_verified BOOLEAN DEFAULT FALSE,
  password_hash TEXT,
  oauth_provider VARCHAR(50), -- 'google', 'apple', null
  oauth_id VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_oauth ON users(oauth_provider, oauth_id);

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  session_token VARCHAR(255) UNIQUE NOT NULL,
  device_fingerprint VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  last_activity TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(session_token);
CREATE INDEX idx_sessions_device ON sessions(device_fingerprint);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Devices table
CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint VARCHAR(255) UNIQUE NOT NULL,
  device_name VARCHAR(255),
  is_trusted BOOLEAN DEFAULT FALSE,
  last_used TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE INDEX idx_devices_fingerprint ON devices(device_fingerprint);

-- Verification tokens table
CREATE TABLE verification_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  token VARCHAR(255) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'email_verify', 'password_reset', 'magic_link'
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_tokens_email ON verification_tokens(email);
CREATE INDEX idx_tokens_token ON verification_tokens(token);
CREATE INDEX idx_tokens_type ON verification_tokens(type);
CREATE INDEX idx_tokens_expires ON verification_tokens(expires_at);

-- User accounts (multi-account support)
CREATE TABLE user_accounts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint VARCHAR(255) NOT NULL,
  accounts JSONB DEFAULT '[]', -- [{ email, store_id, store_name, last_used }]
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_user_accounts_user_id ON user_accounts(user_id);
CREATE INDEX idx_user_accounts_device ON user_accounts(device_fingerprint);

-- Stores table (already exists, just referencing)
-- CREATE TABLE stores (
--   id UUID PRIMARY KEY,
--   user_id UUID REFERENCES users(id),
--   name VARCHAR(255),
--   store_name VARCHAR(255) UNIQUE,
--   subdomain VARCHAR(255),
--   site_type VARCHAR(50),
--   created_at TIMESTAMP DEFAULT NOW()
-- );
```

### 7.3 Cookie Strategy

```typescript
// Cookie names
const COOKIES = {
  SESSION: 'letbuyy_session',          // Session token (HTTP-only, Secure, SameSite=Lax)
  CSRF: 'letbuyy_csrf',                // CSRF token (HTTP-only, Secure, SameSite=Strict)
  DEVICE: 'letbuyy_device',            // Device fingerprint (HTTP-only, Secure, SameSite=Lax)
  THEME: 'letbuyy_theme',              // Theme preference (not HTTP-only, client-readable)
  LANG: 'letbuyy_lang',                // Language preference (not HTTP-only, client-readable)
};

// Cookie settings
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60, // 30 days
};

const CSRF_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  path: '/',
  maxAge: 24 * 60 * 60, // 1 day
};

const DEVICE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 365 * 24 * 60 * 60, // 1 year
};
```

### 7.4 Token Generation

```typescript
// Generate secure random token
function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

// Token types and expiration
const TOKEN_EXPIRATION = {
  EMAIL_VERIFY: 24 * 60 * 60 * 1000,      // 24 hours
  PASSWORD_RESET: 60 * 60 * 1000,         // 1 hour
  MAGIC_LINK: 15 * 60 * 1000,             // 15 minutes
  SESSION: 30 * 24 * 60 * 60 * 1000,      // 30 days
};
```

### 7.5 Rate Limiting Configuration

```typescript
// Rate limit rules
const RATE_LIMITS = {
  SIGNUP: {
    points: 5,           // 5 attempts
    duration: 3600,      // per hour
    blockDuration: 3600, // block for 1 hour
  },
  LOGIN: {
    points: 10,
    duration: 3600,
    blockDuration: 1800, // block for 30 min
  },
  PASSWORD_RESET: {
    points: 3,
    duration: 3600,
    blockDuration: 3600,
  },
  MAGIC_LINK: {
    points: 5,
    duration: 3600,
    blockDuration: 1800,
  },
  EMAIL_SEND: {
    points: 10,          // 10 emails
    duration: 3600,      // per hour
    blockDuration: 3600,
  },
};
```

---

## 8. Security Requirements

### 8.1 Security Checklist

- [ ] **HTTPS Only**: All cookies set with `Secure` flag in production
- [ ] **HTTP-only Cookies**: Session, CSRF, Device cookies are HTTP-only
- [ ] **SameSite Cookies**: `Lax` for session/device, `Strict` for CSRF
- [ ] **CSRF Protection**: All state-changing requests validate CSRF token
- [ ] **Rate Limiting**: All auth endpoints rate-limited
- [ ] **Email Verification**: Required for all signups (including OAuth)
- [ ] **Password Hashing**: bcrypt with salt rounds ≥ 12
- [ ] **Password Strength**: Min 8 chars, mix of letters, numbers, symbols
- [ ] **Token Expiration**: All tokens expire appropriately
- [ ] **Session Expiration**: Sessions expire after 30 days or inactivity
- [ ] **Session Rotation**: Session token rotates after login/password change
- [ ] **Device Tracking**: Track and allow user to manage devices
- [ ] **SQL Injection Protection**: Parameterized queries only
- [ ] **XSS Protection**: Input sanitization and output encoding
- [ ] **Error Handling**: No sensitive info in error messages
- [ ] **Logging**: Log all auth events (signup, login, password reset, etc.)
- [ ] **Monitoring**: Monitor for unusual activity (multiple failed logins, etc.)

### 8.2 Password Policy

```typescript
const PASSWORD_POLICY = {
  minLength: 8,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSymbols: false, // Optional
  preventCommon: true,   // Check against common password list
  preventBreach: true,   // Check against haveibeenpwned.com API (optional)
};
```

### 8.3 Session Security

- **Session Token**: 32-byte random hex string
- **Storage**: Database with expiration timestamp
- **Cookie**: HTTP-only, Secure, SameSite=Lax
- **Expiration**: 30 days from creation or last activity
- **Refresh**: Extend expiration on each request (if > 24h old)
- **Rotation**: Generate new token after login, password change
- **Invalidation**: On logout, password change, suspicious activity

---

## 9. User Experience Flows

### 9.1 Complete Signup Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    NEW USER SIGNUP FLOW                          │
└─────────────────────────────────────────────────────────────────┘

STEP 1: User visits /signup or /lookup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Screen: Email entry
┌────────────────────────────────────┐
│  Create your LetBuyy account        │
│                                      │
│  Email address                      │
│  ┌──────────────────────────────┐  │
│  │ you@example.com              │  │
│  └──────────────────────────────┘  │
│                                      │
│           [Continue]                │
│                                      │
│  Or sign up with:                   │
│  [Google] [Apple]                   │
└────────────────────────────────────┘

User enters email → Clicks Continue

STEP 2: Backend checks if email exists
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Query: SELECT * FROM users WHERE email = 'you@example.com'

IF email exists:
  → Redirect to /lookup (login flow)
  
IF email does NOT exist:
  → Continue to Step 3

STEP 3: Create user and send verification email
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backend:
1. INSERT INTO users (email, email_verified) VALUES ('you@example.com', false)
2. Generate verification token
3. INSERT INTO verification_tokens (email, token, type, expires_at)
4. Send email via Resend (verification link)
5. Redirect to /check-email

STEP 4: Check email confirmation page
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Screen: /check-email
┌────────────────────────────────────┐
│  Check your email                   │
│                                      │
│  We sent a verification link to:    │
│  you@example.com                    │
│                                      │
│  📧                                  │
│                                      │
│  [Didn't receive it? Resend]        │
│  [Use a different email]            │
└────────────────────────────────────┘

STEP 5: User clicks link in email
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email link: https://accounts.letbuyy.store/verify-email?token=abc123

User clicks → Redirects to /verify-email?token=abc123

STEP 6: Email verification + password setup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Screen: /verify-email
Backend validates token:
  - Token exists in database?
  - Token not expired?
  - Email not already verified?

If valid → Show password setup form
┌────────────────────────────────────┐
│  Create your password               │
│                                      │
│  you@example.com        ✓ Verified  │
│                                      │
│  Choose a strong password           │
│  ┌──────────────────────────────┐  │
│  │ ••••••••••                   │  │
│  └──────────────────────────────┘  │
│                                      │
│  Password strength: ███░░ Strong    │
│                                      │
│  ✓ At least 8 characters            │
│  ✓ Mix of letters and numbers       │
│                                      │
│           [Create account]          │
└────────────────────────────────────┘

User enters password → Clicks Create account

STEP 7: Backend processes password and creates session
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backend:
1. Validate password strength
2. Hash password (bcrypt, salt rounds = 12)
3. UPDATE users SET email_verified = true, password_hash = '...' WHERE email = '...'
4. DELETE FROM verification_tokens WHERE token = '...'
5. Create session:
   - Generate session token
   - INSERT INTO sessions (user_id, session_token, device_fingerprint, expires_at)
6. Set session cookie
7. Send welcome email (async)
8. Return success

STEP 8: Check if user has a store
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Query: SELECT * FROM stores WHERE user_id = '...'

IF user has store:
  → Redirect to https://admin.letbuyy.store/admin/{store_name}
  
IF user has NO store:
  → Redirect to /onboarding

STEP 9: Onboarding (if no store)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Screen: /onboarding
User completes 2-step wizard:
  - Step 1: Choose site type
  - Step 2: Name your store

Backend:
1. INSERT INTO stores (user_id, name, store_name, subdomain, site_type)
2. Redirect to https://admin.letbuyy.store/admin/{store_name}

✅ SIGNUP COMPLETE
```

### 9.2 Complete Login Flow (Progressive Disclosure)

```
┌─────────────────────────────────────────────────────────────────┐
│                 RETURNING USER LOGIN FLOW                        │
└─────────────────────────────────────────────────────────────────┘

STEP 1: User visits /lookup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backend checks for device cookie and recent session

SCENARIO A: Trusted Device (has cookie, recent login)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Screen: /lookup (device trust card)
┌────────────────────────────────────┐
│  Welcome back!                      │
│                                      │
│  ┌──────────────────────────────┐  │
│  │ 👤 John Doe                  │  │
│  │ john@example.com            │  │
│  │                               │  │
│  │    [Continue as John]        │  │
│  └──────────────────────────────┘  │
│                                      │
│  [Use a different account]          │
└────────────────────────────────────┘

User clicks "Continue as John":
  → Backend validates device fingerprint
  → Creates new session
  → Redirects to admin/store

User clicks "Use a different account":
  → Hide device trust card
  → Show email input (Step 1B)

SCENARIO B: New/Untrusted Device (no cookie or old session)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Screen: /lookup (email input)
┌────────────────────────────────────┐
│  Log in to LetBuyy                  │
│                                      │
│  Email address                      │
│  ┌──────────────────────────────┐  │
│  │ you@example.com              │  │
│  └──────────────────────────────┘  │
│                                      │
│           [Continue]                │
│                                      │
│  Or log in with:                    │
│  [Google] [Apple]                   │
└────────────────────────────────────┘

User enters email → Clicks Continue

STEP 2: Backend checks if email exists
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Query: SELECT * FROM users WHERE email = 'you@example.com'

IF email does NOT exist:
  → Show error: "No account found. Would you like to create one?"
  → Link to /signup
  
IF email exists:
  → Continue to Step 3

STEP 3: Progressive disclosure - Show password field
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Screen: /lookup (password revealed)
┌────────────────────────────────────┐
│  you@example.com         [Edit]    │
│                                      │
│  Enter your password                │
│  ┌──────────────────────────────┐  │
│  │ ••••••••••                   │  │
│  └──────────────────────────────┘  │
│  [Forgot password?]                 │
│                                      │
│           [Log in]                  │
│                                      │
│  Or:                                │
│  [Send me a magic link instead]     │
└────────────────────────────────────┘

User enters password → Clicks Log in

STEP 4: Backend validates credentials
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backend:
1. Query: SELECT * FROM users WHERE email = '...'
2. Compare password hash (bcrypt.compare)
3. Check email verification status

IF password incorrect:
  → Show error: "Incorrect password"
  → Increment failed login counter (rate limiting)
  → If > 5 failed attempts: "Too many attempts. Try again in 30 minutes."
  
IF email not verified:
  → Show error: "Please verify your email first"
  → Button to resend verification email
  
IF credentials valid:
  → Continue to Step 5

STEP 5: Create session and track device
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backend:
1. Generate session token
2. INSERT INTO sessions (user_id, session_token, device_fingerprint, ip_address, user_agent)
3. Set session cookie (HTTP-only, Secure, SameSite=Lax, 30 days)
4. Check if device is known:
   - IF new device: Send login alert email (async)
   - IF known device: Update last_used timestamp
5. Query stores: SELECT * FROM stores WHERE user_id = '...'
6. Return: { success: true, user: {...}, stores: [...] }

STEP 6: Check if multiple stores
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
IF user has 0 stores:
  → Redirect to /onboarding
  
IF user has 1 store:
  → Redirect to https://admin.letbuyy.store/admin/{store_name}
  
IF user has multiple stores:
  → Redirect to /select (store selector)

✅ LOGIN COMPLETE
```

### 9.3 Magic Link Login Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAGIC LINK LOGIN FLOW                         │
└─────────────────────────────────────────────────────────────────┘

STEP 1: User clicks "Send me a magic link instead" on /lookup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backend:
1. Validate email exists
2. Generate magic link token (expires in 15 minutes)
3. INSERT INTO verification_tokens (email, token, type='magic_link', expires_at)
4. Send magic link email via Resend
5. Redirect to /check-email

STEP 2: User checks email and clicks magic link
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email link: https://accounts.letbuyy.store/api/auth/magic-link/verify?token=xyz789

User clicks → Backend processes

STEP 3: Backend validates magic link token
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backend:
1. Query: SELECT * FROM verification_tokens WHERE token = 'xyz789' AND type = 'magic_link'
2. Check if token exists and not expired
3. If valid:
   - Get user by email
   - Create session
   - DELETE FROM verification_tokens WHERE token = 'xyz789'
   - Set session cookie
   - Check stores
   - Redirect to admin or /onboarding
4. If invalid:
   - Redirect to /lookup?error=invalid_link
   - Show error: "This link is invalid or has expired"

✅ MAGIC LINK LOGIN COMPLETE
```

### 9.4 Password Reset Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  PASSWORD RESET FLOW                             │
└─────────────────────────────────────────────────────────────────┘

STEP 1: User clicks "Forgot password?" on /lookup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Redirect to /forgot-password

Screen: /forgot-password
┌────────────────────────────────────┐
│  Reset your password                │
│                                      │
│  Enter your email address           │
│  ┌──────────────────────────────┐  │
│  │ you@example.com              │  │
│  └──────────────────────────────┘  │
│                                      │
│     [Send reset link]               │
│                                      │
│  [Back to login]                    │
└────────────────────────────────────┘

User enters email → Clicks Send reset link

STEP 2: Backend sends password reset email
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backend:
1. Query: SELECT * FROM users WHERE email = '...'
2. IF user exists:
   - Generate reset token (expires in 1 hour)
   - INSERT INTO verification_tokens (email, token, type='password_reset', expires_at)
   - Send reset email via Resend
3. IF user does NOT exist:
   - Still show success (security: don't reveal if email exists)
4. Redirect to /check-email

STEP 3: User checks email and clicks reset link
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email link: https://accounts.letbuyy.store/reset-password?token=def456

User clicks → Redirects to /reset-password?token=def456

STEP 4: Password reset form
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Screen: /reset-password
Backend validates token:
  - Token exists?
  - Not expired?

IF valid → Show password reset form
┌────────────────────────────────────┐
│  Create a new password              │
│                                      │
│  New password                       │
│  ┌──────────────────────────────┐  │
│  │ ••••••••••                   │  │
│  └──────────────────────────────┘  │
│                                      │
│  Password strength: ████░ Strong    │
│                                      │
│  ✓ At least 8 characters            │
│  ✓ Mix of letters and numbers       │
│                                      │
│      [Reset password]               │
└────────────────────────────────────┘

IF invalid → Show error
┌────────────────────────────────────┐
│  ⚠️ Invalid or expired link         │
│                                      │
│  This reset link is no longer valid.│
│                                      │
│  [Request a new reset link]         │
└────────────────────────────────────┘

User enters new password → Clicks Reset password

STEP 5: Backend updates password and invalidates sessions
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backend:
1. Validate password strength
2. Hash new password
3. UPDATE users SET password_hash = '...' WHERE email = '...'
4. DELETE FROM verification_tokens WHERE token = '...'
5. DELETE FROM sessions WHERE user_id = '...' (invalidate all sessions)
6. Send password changed email (async)
7. Redirect to /lookup?message=password_reset_success

STEP 6: User logs in with new password
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Screen: /lookup
┌────────────────────────────────────┐
│  ✅ Password reset successful!      │
│                                      │
│  Log in with your new password      │
│                                      │
│  Email address                      │
│  ┌──────────────────────────────┐  │
│  │ you@example.com              │  │
│  └──────────────────────────────┘  │
│                                      │
│           [Continue]                │
└────────────────────────────────────┘

✅ PASSWORD RESET COMPLETE
```

### 9.5 Multi-Account Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  MULTI-ACCOUNT FLOW                              │
└─────────────────────────────────────────────────────────────────┘

SCENARIO: User has logged in with multiple accounts on this device

STEP 1: User opens new tab or visits /lookup
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Middleware checks:
1. Does session cookie exist? YES
2. Is session valid? YES
3. Query stores: SELECT * FROM stores WHERE user_id = '...'
4. IF user has stores:
   → Redirect to admin
5. IF user has NO stores:
   → Redirect to /onboarding

STEP 2: User clicks "Use a different account" or visits /select
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Screen: /select
Backend:
1. Get device fingerprint from cookie
2. Query: SELECT accounts FROM user_accounts WHERE device_fingerprint = '...'
3. Return list of accounts saved on this device

┌────────────────────────────────────┐
│  Choose an account                  │
│                                      │
│  ┌──────────────────────────────┐  │
│  │ 👤 John Doe                  │  │
│  │ john@example.com            │  │
│  │ Last used: 2 hours ago      │  │
│  │                               │  │
│  │    [Continue as John]        │  │
│  └──────────────────────────────┘  │
│                                      │
│  ┌──────────────────────────────┐  │
│  │ 👤 Jane Smith                │  │
│  │ jane@example.com            │  │
│  │ Last used: 3 days ago       │  │
│  │                               │  │
│  │    [Continue as Jane]        │  │
│  └──────────────────────────────┘  │
│                                      │
│  + Add another account              │
└────────────────────────────────────┘

STEP 3: User selects an account
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
User clicks "Continue as John":
  → Redirect to /lookup?email=john@example.com
  → /lookup shows device trust card for John
  → One-click login (no password needed)

User clicks "+ Add another account":
  → Redirect to /lookup (email input shown)
  → Normal login flow

STEP 4: After successful login, save account to device
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Backend (after login):
1. Get device fingerprint
2. Query: SELECT accounts FROM user_accounts WHERE device_fingerprint = '...'
3. IF record exists:
   - Add new account to accounts JSONB array
   - UPDATE user_accounts SET accounts = '...' WHERE device_fingerprint = '...'
4. IF record does NOT exist:
   - INSERT INTO user_accounts (device_fingerprint, accounts)
5. Accounts JSONB structure:
   [
     {
       "email": "john@example.com",
       "user_id": "uuid-123",
       "store_id": "uuid-456",
       "store_name": "john-store",
       "last_used": "2026-02-12T10:30:00Z"
     },
     ...
   ]

✅ MULTI-ACCOUNT FLOW COMPLETE
```

---

## 10. Testing Strategy

### 10.1 Unit Tests

**Tools:** Jest, React Testing Library

#### Auth Utilities
- [ ] `password.ts` - Password hashing and validation
  - Test bcrypt hashing
  - Test password comparison
  - Test password strength validation
- [ ] `tokens.ts` - Token generation and validation
  - Test token generation (random, secure)
  - Test token expiration checking
  - Test token validation
- [ ] `session.ts` - Session management
  - Test session creation
  - Test session validation
  - Test session refresh
  - Test session expiration
- [ ] `device.ts` - Device fingerprinting
  - Test fingerprint generation
  - Test fingerprint consistency
- [ ] `csrf.ts` - CSRF token handling
  - Test CSRF token generation
  - Test CSRF token validation
- [ ] `cookies.ts` - Cookie utilities
  - Test cookie setting (HTTP-only, Secure, SameSite)
  - Test cookie reading
  - Test cookie deletion

### 10.2 Integration Tests

**Tools:** Playwright, Vitest

#### Complete Flows
- [ ] **Signup Flow**
  - User enters email
  - Receives verification email
  - Clicks verification link
  - Sets password
  - Redirected to onboarding
  
- [ ] **Login Flow**
  - User enters email
  - Password field appears
  - User enters password
  - Logged in successfully
  - Redirected to admin
  
- [ ] **Magic Link Flow**
  - User requests magic link
  - Receives email
  - Clicks link
  - Logged in automatically
  
- [ ] **Password Reset Flow**
  - User requests reset
  - Receives reset email
  - Clicks reset link
  - Sets new password
  - Can log in with new password
  
- [ ] **Multi-Account Flow**
  - User logs in with Account A
  - Logs out
  - Logs in with Account B
  - /select shows both accounts
  - Can switch between accounts

- [ ] **OAuth Flow**
  - User clicks "Continue with Google"
  - Redirects to Google
  - Redirects back to callback
  - Email verification required
  - Completes verification
  - Logged in successfully

### 10.3 Security Tests

- [ ] **SQL Injection**
  - Test all endpoints with SQL injection payloads
  - Ensure parameterized queries prevent injection
  
- [ ] **XSS**
  - Test all input fields with XSS payloads
  - Ensure input sanitization and output encoding
  
- [ ] **CSRF**
  - Test state-changing requests without CSRF token
  - Ensure 403 response
  
- [ ] **Rate Limiting**
  - Test rapid requests to auth endpoints
  - Ensure rate limit kicks in (429 response)
  
- [ ] **Session Hijacking**
  - Test using someone else's session token
  - Ensure proper validation
  
- [ ] **Brute Force**
  - Test multiple failed login attempts
  - Ensure account lockout or CAPTCHA

### 10.4 Performance Tests

**Tools:** k6, Apache JMeter

- [ ] **Load Test Auth Endpoints**
  - 100 concurrent users signing up
  - 100 concurrent users logging in
  - Ensure < 500ms response time
  
- [ ] **Database Query Performance**
  - Test session lookup performance
  - Test user lookup performance
  - Ensure proper indexing
  
- [ ] **Email Sending Performance**
  - Test sending 1000 emails
  - Ensure Resend handles load

### 10.5 Browser Compatibility Tests

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)
- [ ] Chrome Mobile (Android)
- [ ] Safari Mobile (iOS)

Test on each browser:
- [ ] Signup flow
- [ ] Login flow
- [ ] Dark mode toggle
- [ ] i18n language switch
- [ ] Cookie persistence
- [ ] Session management

---

## 11. Migration Plan

### 11.1 Pre-Migration Checklist

- [ ] Backup current production database
- [ ] Export all existing users
- [ ] Document current system behavior
- [ ] Set up staging environment
- [ ] Test new system in staging
- [ ] Communicate with users about upcoming changes

### 11.2 Migration Steps

#### Step 1: Database Preparation (Day 1)

1. **Create new tables without affecting existing system**
   ```sql
   -- Run migrations to create new tables
   -- users, sessions, devices, verification_tokens, user_accounts
   ```

2. **Migrate existing Supabase auth users to new users table**
   ```sql
   INSERT INTO users (id, email, email_verified, created_at)
   SELECT id, email, email_confirmed_at IS NOT NULL, created_at
   FROM auth.users;
   ```

3. **Verify data integrity**
   - Count users in both tables
   - Verify email fields match
   - Check for any data anomalies

#### Step 2: Deploy New Auth System (Day 2)

1. **Deploy code changes in maintenance mode**
   ```
   - Enable maintenance page on accounts.letbuyy.store
   - Deploy new Next.js app with all auth changes
   - Run smoke tests against staging
   - Verify Resend email delivery
   - Verify cookie creation/reading
   - Verify session management
   ```

2. **Switch DNS / traffic to new system**
   ```
   - Point accounts.letbuyy.store to new deployment
   - Monitor error rates
   - Monitor login success rates
   - Keep old system available as fallback
   ```

3. **Verify production functionality**
   - [ ] Test signup flow end-to-end
   - [ ] Test login flow (email + password)
   - [ ] Test login flow (magic link)
   - [ ] Test password reset flow
   - [ ] Test OAuth flow (Google)
   - [ ] Test OAuth flow (Apple)
   - [ ] Test multi-account flow
   - [ ] Test session persistence
   - [ ] Test dark mode on all pages
   - [ ] Test i18n on all pages

#### Step 3: User Communication (Day 2-3)

1. **Send migration notification email to all users**
   ```
   Subject: We've upgraded your LetBuyy login experience
   
   Body:
   - What changed (improved security, faster login)
   - What to expect (email verification, magic links)
   - Action needed (verify email on next login)
   - Support contact
   ```

2. **In-app notification**
   - Show banner in admin dashboard about new auth system
   - Link to help article explaining changes

#### Step 4: Monitoring (Day 3-7)

1. **Monitor key metrics**
   - Login success rate (target: >95%)
   - Signup completion rate (target: >80%)
   - Email delivery rate (target: >99%)
   - Average login time (target: <5 seconds)
   - Error rate (target: <1%)

2. **Monitor support tickets**
   - Track auth-related support requests
   - Identify common issues
   - Create FAQ/help articles as needed

3. **Database monitoring**
   - Session table growth rate
   - Token table cleanup (expired tokens)
   - Query performance

#### Step 5: Cleanup (Day 7-14)

1. **Remove old auth code**
   - [ ] Delete `/login` page (replaced by `/lookup`)
   - [ ] Remove old Supabase auth client calls
   - [ ] Clean up unused environment variables
   - [ ] Remove localStorage-based account storage code

2. **Set up automated cleanup jobs**
   ```sql
   -- Cron job: Clean up expired tokens (run daily)
   DELETE FROM verification_tokens WHERE expires_at < NOW();
   
   -- Cron job: Clean up expired sessions (run daily)
   DELETE FROM sessions WHERE expires_at < NOW();
   
   -- Cron job: Clean up inactive devices (run weekly)
   DELETE FROM devices WHERE last_used < NOW() - INTERVAL '90 days';
   ```

3. **Archive old Supabase auth data**
   - Export auth.users table as backup
   - Document migration mapping
   - Keep backup for 90 days

### 11.3 Rollback Plan

> ⚠️ **If critical issues are found post-migration:**

#### Immediate Rollback (< 1 hour)

```
1. Revert DNS to old deployment
2. Restore old Supabase auth configuration
3. Users continue using old login system
4. Investigate and fix issues in staging
5. Re-attempt migration when ready
```

#### Partial Rollback (Specific Feature)

```
1. Disable specific feature via environment variable
   - FEATURE_MAGIC_LINK=false
   - FEATURE_MULTI_ACCOUNT=false
   - FEATURE_DEVICE_TRUST=false
2. Users fall back to basic email+password login
3. Fix feature in staging
4. Re-enable when ready
```

#### Data Rollback

```
1. New users created during migration → Keep in new system
2. Sessions created during migration → Invalidate all
3. Device data → Safe to discard
4. Token data → Safe to discard (all expired)
```

### 11.4 Feature Flags

Implement feature flags for gradual rollout:

```typescript
// src/lib/config/features.ts
export const FEATURES = {
  MAGIC_LINK_LOGIN: process.env.FEATURE_MAGIC_LINK !== 'false',
  MULTI_ACCOUNT: process.env.FEATURE_MULTI_ACCOUNT !== 'false',
  DEVICE_TRUST: process.env.FEATURE_DEVICE_TRUST !== 'false',
  EMAIL_VERIFICATION: process.env.FEATURE_EMAIL_VERIFICATION !== 'false',
  PASSWORD_RESET_VIA_RESEND: process.env.FEATURE_RESEND_RESET !== 'false',
  LOGIN_ALERTS: process.env.FEATURE_LOGIN_ALERTS !== 'false',
  RATE_LIMITING: process.env.FEATURE_RATE_LIMITING !== 'false',
};
```

This allows enabling/disabling individual features without full redeployment.

---

## 12. Timeline Summary

### 12.1 8-Week Implementation Timeline

```
┌──────────────────────────────────────────────────────────────────────┐
│                    IMPLEMENTATION TIMELINE                            │
└──────────────────────────────────────────────────────────────────────┘

Week 1  ██████████  Foundation & Setup
                    • Database schema migration
                    • Resend email setup & templates
                    • Core auth libraries (password, tokens, sessions)
                    • Cookie utilities & CSRF protection
                    • Environment configuration

Week 2  ██████████  Authentication Core
                    • Signup flow (email → verify → set password)
                    • Login flow (progressive disclosure)
                    • Password reset flow (forgot → reset page)
                    • Magic link login
                    • Session management (create, validate, logout)

Week 3  ██████████  Multi-Account & Device Trust
                    • Device fingerprinting
                    • Multi-account cookie storage
                    • Account picker (/select) redesign
                    • Trusted device one-click login
                    • Device management API

Week 4  ██████████  Middleware & Route Protection
                    • Next.js middleware implementation
                    • Route protection (public vs protected)
                    • CSRF validation on all mutations
                    • Rate limiting (Upstash Redis)
                    • Error handling & logging

Week 5  ██████████  UI/UX Polish & Consistency
                    • Unified CSS variables on all pages
                    • Reusable component library
                    • Progressive disclosure animations
                    • i18n (English, Hindi, Tamil) on all pages
                    • Dark mode consistency
                    • Accessibility audit (WCAG 2.1 AA)

Week 6  ██████████  OAuth Enhancement
                    • OAuth email verification requirement
                    • Enhanced OAuth callback handler
                    • Unverified OAuth user flow
                    • Account linking (OAuth + email/password)

Week 7  ██████████  Testing & Security Audit
                    • Unit tests (auth utilities)
                    • Integration tests (Playwright)
                    • Security audit (injection, XSS, CSRF)
                    • Performance testing (k6)
                    • Browser compatibility testing

Week 8  ██████████  Documentation & Deployment
                    • API documentation
                    • Developer guide
                    • Production deployment
                    • Monitoring setup (Sentry, LogRocket)
                    • Post-deployment verification
                    • User communication
```

### 12.2 Milestone Checkpoints

| Milestone | Week | Success Criteria |
|-----------|------|-----------------|
| **M1: Infrastructure Ready** | End of Week 1 | Resend sends emails, DB schema deployed, core utils working |
| **M2: Auth Flows Complete** | End of Week 2 | Signup, login, password reset all functional end-to-end |
| **M3: Multi-Account Working** | End of Week 3 | Account picker functional, device trust implemented |
| **M4: Security Hardened** | End of Week 4 | Middleware protects routes, rate limiting active, CSRF validated |
| **M5: UI/UX Polished** | End of Week 5 | All pages consistent, dark mode & i18n everywhere |
| **M6: OAuth Secured** | End of Week 6 | OAuth users must verify email, no bypass possible |
| **M7: Tested & Audited** | End of Week 7 | All tests passing, no critical security findings |
| **M8: Production Live** | End of Week 8 | Deployed, monitored, user communication sent |

---

## 13. Cost Estimates

### 13.1 Service Costs (Monthly)

| Service | Tier | Cost | Notes |
|---------|------|------|-------|
| **Resend** | Free → Pro | $0 – $20/mo | Free: 3,000 emails/mo; Pro: 50,000/mo |
| **Supabase** | Free → Pro | $0 – $25/mo | Free: 50K MAU; Pro: unlimited |
| **Upstash Redis** | Free → Pay-as-you-go | $0 – $10/mo | Free: 10K commands/day |
| **Vercel** | Pro | $20/mo | Already in use for deployment |
| **Sentry** (optional) | Developer | $0 | Free: 5K errors/mo |
| **Total** | — | **$0 – $75/mo** | Scales with usage |

### 13.2 Development Time Estimate

| Phase | Estimated Hours | Developer |
|-------|----------------|-----------|
| Phase 1: Foundation | 20-25 hrs | Full-stack |
| Phase 2: Auth Core | 25-30 hrs | Full-stack |
| Phase 3: Multi-Account | 15-20 hrs | Full-stack |
| Phase 4: Middleware | 10-15 hrs | Backend |
| Phase 5: UI/UX Polish | 15-20 hrs | Frontend |
| Phase 6: OAuth | 8-12 hrs | Full-stack |
| Phase 7: Testing | 15-20 hrs | QA/Full-stack |
| Phase 8: Deployment | 8-12 hrs | DevOps |
| **Total** | **116-154 hrs** | — |

---

## 14. Future Enhancements (Post-Launch)

### 14.1 Short-Term (1-3 months post-launch)

| Feature | Priority | Description |
|---------|----------|-------------|
| **Passkey (WebAuthn)** | 🟡 High | Passwordless login via biometrics/device keys |
| **2FA / TOTP** | 🟡 High | Time-based one-time password via authenticator app |
| **SMS Verification** | 🟢 Medium | OTP via SMS for regions with low email usage |
| **Account Recovery** | 🟡 High | Recovery codes for users who lose email access |
| **Login History** | 🟢 Medium | User-facing log of all login events |

### 14.2 Medium-Term (3-6 months post-launch)

| Feature | Priority | Description |
|---------|----------|-------------|
| **Team/Staff Auth** | 🟡 High | Invite team members with role-based access |
| **SSO / SAML** | 🟢 Medium | Enterprise single sign-on for large merchants |
| **Passwordless-Only Mode** | 🟢 Medium | Option to disable password login entirely |
| **Geo-Blocking** | 🔵 Low | Block logins from suspicious locations |
| **Bot Detection** | 🟢 Medium | CAPTCHA or hCaptcha on auth forms |

### 14.3 Long-Term (6-12 months post-launch)

| Feature | Priority | Description |
|---------|----------|-------------|
| **OAuth Provider** | 🔵 Low | LetBuyy as an OAuth provider for third-party apps |
| **API Keys** | 🟢 Medium | API key management for developer integrations |
| **Audit Logs** | 🟢 Medium | Comprehensive audit trail for compliance |
| **GDPR Compliance** | 🟡 High | Data export, deletion, consent management |
| **Multi-Tenant Auth** | 🟢 Medium | Shared auth across all LetBuyy apps (storefront, admin, marketplace) |

---

## 15. Files to Delete After Migration

These files become obsolete after the new system is fully deployed:

| File | Reason |
|------|--------|
| `src/app/login/page.tsx` | Replaced by enhanced `/lookup` with progressive disclosure |
| `src/app/check-email/page.tsx` | Rebuilt with Resend integration and resend button |

> [!NOTE]
> The `/login` route should be kept as a redirect to `/lookup` for backwards compatibility with any existing links or bookmarks for at least 6 months post-migration.

---

## 16. Summary

### What We're Building

A **Shopify-grade authentication system** that transforms LetBuyy from basic auth to enterprise-ready:

| Before | After |
|--------|-------|
| Dual login pages with inconsistent UX | Single progressive disclosure login (`/lookup`) |
| No email verification | Magic link verification via Resend |
| Broken password reset flow | Complete forgot → reset → auto-login flow |
| localStorage-based account storage | Encrypted HTTP-only cookie multi-account system |
| No session management | Cookie-based sessions with device tracking |
| No middleware protection | Full route protection with automatic redirects |
| Inconsistent styling | Unified CSS variable design system |
| No rate limiting | Upstash Redis rate limiting on all auth endpoints |
| No email notifications | Welcome emails, login alerts, password change notifications |
| No CSRF protection | Full CSRF token validation |

### Key Decisions

1. **Resend** for email delivery (not Supabase email or SendGrid)
2. **Cookie-based** multi-account (not localStorage)
3. **Progressive disclosure** login (not separate signup/login pages)
4. **Custom session management** (not Supabase sessions)
5. **Feature flags** for gradual rollout
6. **8-week phased implementation** (not big-bang deployment)

### Success Metrics

| Metric | Target |
|--------|--------|
| Login success rate | > 95% |
| Signup completion rate | > 80% |
| Email delivery rate | > 99% |
| Average login time | < 5 seconds |
| Auth error rate | < 1% |
| Security incidents | 0 |

---

*Document prepared on February 12, 2026*  
*Architecture inspired by Shopify's authentication system*  
*Target implementation: 8 weeks*