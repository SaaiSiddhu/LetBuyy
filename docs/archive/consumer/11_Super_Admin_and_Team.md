# LetBuyy Platform — Super Admin & Team

> **Doc 11 of 17** | Platform Console, Team Management, RBAC, Moderation, Analytics & Operations
>
> **Version:** 6.0 | **Date:** February 15, 2026
>
> **Prev:** [10 Storefront & Themes](./10_Storefront_and_Themes.md) | **Next:** [12 Implementation Roadmap](./12_Implementation_Roadmap.md)

---

## Table of Contents

1. [Super Admin Console Architecture](#1-super-admin-console-architecture)
2. [Console Dashboard](#2-console-dashboard)
3. [Store Management](#3-store-management)
4. [User Management](#4-user-management)
5. [Team & Role-Based Access Control](#5-team--role-based-access-control)
6. [Permission Matrix](#6-permission-matrix)
7. [Content Moderation](#7-content-moderation)
8. [Moderation AI Pipeline](#8-moderation-ai-pipeline)
9. [Platform Analytics](#9-platform-analytics)
10. [Revenue & Billing Operations](#10-revenue--billing-operations)
11. [Support System](#11-support-system)
12. [Audit Logging](#12-audit-logging)
13. [Security & Fraud Detection](#13-security--fraud-detection)
14. [Feature Flags & Experimentation](#14-feature-flags--experimentation)
15. [Notification & Alert System](#15-notification--alert-system)
16. [Operational Tools](#16-operational-tools)
17. [Maintenance & Incident Management](#17-maintenance--incident-management)
18. [Flutter Super-Admin App](#18-flutter-super-admin-app)
19. [Compliance & Data Governance](#19-compliance--data-governance)
20. [Document History](#20-document-history)

---

## 1. Super Admin Console Architecture

### 1.1 System Overview

```
                        Super Admin Access
                              │
                 ┌────────────┼────────────┐
                 │            │            │
                 ▼            ▼            ▼
          ┌───────────┐ ┌──────────┐ ┌──────────────┐
          │   Web     │ │ Flutter  │ │   API        │
          │  Console  │ │  Mobile  │ │  Direct      │
          │  (Next.js)│ │  App     │ │  (REST)      │
          └─────┬─────┘ └────┬─────┘ └──────┬───────┘
                │            │              │
                └────────────┼──────────────┘
                             │
                             ▼
          ┌──────────────────────────────────────────┐
          │          Security Gateway                 │
          │  ┌────────────────────────────────────┐  │
          │  │ VPN Check (Tailscale Mesh)          │  │
          │  │ IP Allowlist Verification            │  │
          │  │ 2FA Validation (TOTP / WebAuthn)    │  │
          │  │ JWT + Role Assertion (super_admin)  │  │
          │  │ Session Timeout: 30 min inactive    │  │
          │  │ Audit Log Entry Created             │  │
          │  └────────────────────────────────────┘  │
          └──────────────────────┬───────────────────┘
                                 │
                                 ▼
          ┌──────────────────────────────────────────┐
          │           API Layer (Hono)                │
          │  ┌────────────────────────────────────┐  │
          │  │ /v1/super-admin/* routes            │  │
          │  │ Middleware: requireSuperAdmin()      │  │
          │  │ Every action → audit_logs table      │  │
          │  └────────────────────────────────────┘  │
          └──────────────────────┬───────────────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼            ▼
             ┌──────────┐ ┌──────────┐ ┌──────────┐
             │ Supabase │ │ Upstash  │ │ Cloudflare│
             │ Postgres │ │ Redis    │ │ R2 / KV  │
             └──────────┘ └──────────┘ └──────────┘
```

### 1.2 Access Requirements

| Requirement | Implementation |
|---|---|
| **Authentication** | Supabase Auth (email + password, no social login) |
| **2FA mandatory** | TOTP (Google Authenticator / Authy) or WebAuthn (hardware key) |
| **VPN-only access** | Tailscale mesh network — console API rejects non-VPN IPs |
| **IP allowlisting** | Additional layer — only approved IPs can reach console |
| **Session timeout** | 30 minutes inactive → forced re-authentication |
| **No self-registration** | Accounts created only by platform owner via invite |
| **Audit logging** | Every action logged with actor, IP, timestamp, payload diff |
| **Device binding** | Optional — restrict to approved device fingerprints |

### 1.3 Console Authentication Flow

```typescript
// apps/api/src/middleware/requireSuperAdmin.ts
import { Context, Next } from 'hono';

export async function requireSuperAdmin(c: Context, next: Next) {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401);
  }

  // Verify super admin role from profiles table
  const { data: profile } = await c.get('supabase')
    .from('profiles')
    .select('role, is_2fa_enabled')
    .eq('id', user.id)
    .single();

  if (!profile || !['super_admin', 'platform_owner'].includes(profile.role)) {
    // Log unauthorized access attempt
    await logAuditEvent(c, {
      actor_id: user.id,
      action: 'SUPER_ADMIN_ACCESS_DENIED',
      resource_type: 'console',
      ip_address: c.req.header('cf-connecting-ip'),
      severity: 'warning',
    });
    return c.json({ success: false, error: { code: 'FORBIDDEN', message: 'Super admin access required' } }, 403);
  }

  if (!profile.is_2fa_enabled) {
    return c.json({ success: false, error: { code: '2FA_REQUIRED', message: 'Two-factor authentication must be enabled' } }, 403);
  }

  // Verify VPN / IP allowlist
  const clientIP = c.req.header('cf-connecting-ip') || '';
  const isAllowed = await verifyIPAllowlist(clientIP);
  if (!isAllowed) {
    await logAuditEvent(c, {
      actor_id: user.id,
      action: 'IP_BLOCKED',
      resource_type: 'console',
      ip_address: clientIP,
      severity: 'critical',
    });
    return c.json({ success: false, error: { code: 'IP_BLOCKED', message: 'Access from this IP is not allowed' } }, 403);
  }

  c.set('superAdmin', profile);
  await next();
}
```

---

## 2. Console Dashboard

### 2.1 Dashboard Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  LetBuyy Console                                   [👤 Admin ▾] │
│  console.letbuyy.store                              [🔔 3] [⚙️]│
├──────────┬───────────────────────────────────────────────────────┤
│          │                                                       │
│ SIDEBAR  │  Platform Health                       🟢 All Systems │
│          │                                                       │
│ ┌──────┐ │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
│ │📊    │ │  │ Total    │ │ Active   │ │ Revenue  │ │ AI      ││
│ │Dash  │ │  │ Stores   │ │ Users    │ │ (MTD)    │ │ Credits ││
│ │      │ │  │ 1,247    │ │ 3,456    │ │ ₹12.5L   │ │ 234K    ││
│ │🏪    │ │  │ ↑5% MoM  │ │ ↑12% MoM│ │ ↑18% MoM│ │ used    ││
│ │Stores│ │  └──────────┘ └──────────┘ └──────────┘ └─────────┘│
│ │      │ │                                                       │
│ │👥    │ │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
│ │Users │ │  │ Active   │ │ Trial →  │ │ API      │ │ Avg     ││
│ │      │ │  │ Stores   │ │ Paid     │ │ Uptime   │ │ Response││
│ │📋    │ │  │ 892      │ │ 34%      │ │ 99.97%   │ │ 45ms    ││
│ │Orders│ │  │ 71.5% of │ │ ↑6pp MoM │ │ this     │ │ p95     ││
│ │      │ │  │ total    │ │          │ │ month    │ │         ││
│ │🛡️    │ │  └──────────┘ └──────────┘ └──────────┘ └─────────┘│
│ │Mod   │ │                                                       │
│ │      │ │  ALERTS & NOTIFICATIONS                               │
│ │💰    │ │  ┌────────────────────────────────────────────────┐   │
│ │Bills │ │  │ ⚠️ 3 content items pending moderation          │   │
│ │      │ │  │ 🤖 AI detected suspicious signup pattern       │   │
│ │🎫    │ │  │ 💰 Revenue milestone: ₹10L/month reached      │   │
│ │Tix   │ │  │ 🔴 2 support tickets marked as critical        │   │
│ │      │ │  │ 📊 Weekly report ready for review              │   │
│ │👨‍💼    │ │  └────────────────────────────────────────────────┘   │
│ │Team  │ │                                                       │
│ │      │ │  REVENUE TREND (last 30 days)                         │
│ │📝    │ │  ┌────────────────────────────────────────────────┐   │
│ │Audit │ │  │  ₹12L ─                              ╱─       │   │
│ │      │ │  │  ₹10L ─                         ╱──╱          │   │
│ │🚩    │ │  │   ₹8L ─                    ╱──╱               │   │
│ │Flags │ │  │   ₹6L ─              ╱──╱                     │   │
│ │      │ │  │   ₹4L ─        ╱──╱                           │   │
│ │⚙️    │ │  │   ₹2L ─  ╱──╱                                │   │
│ │Ops   │ │  │      0 ─╱───────────────────────────────────   │   │
│ │      │ │  │        Jan 16    Jan 23    Jan 30    Feb 7     │   │
│ └──────┘ │  └────────────────────────────────────────────────┘   │
│          │                                                       │
│          │  AI OPERATIONAL INSIGHT                                │
│          │  ┌────────────────────────────────────────────────┐   │
│          │  │ 🤖 "Trial-to-paid conversion is 34%, up from   │   │
│          │  │ 28% last month. Onboarding email improvements  │   │
│          │  │ are likely driving this. Top converting segment:│   │
│          │  │ Fashion stores (42% conversion). Consider a    │   │
│          │  │ case study featuring fashion store owners."     │   │
│          │  └────────────────────────────────────────────────┘   │
└──────────┴───────────────────────────────────────────────────────┘
```

### 2.2 Dashboard Widgets

| Widget | Data Source | Refresh |
|---|---|---|
| Total Stores | `SELECT COUNT(*) FROM stores` | 5 min |
| Active Users | Supabase Auth active sessions | Real-time (WebSocket) |
| Revenue (MTD) | `SELECT SUM(amount) FROM payments WHERE status = 'completed'` | 1 min |
| AI Credits Used | `SELECT SUM(credits_used) FROM ai_usage_logs` | 5 min |
| Trial → Paid Conversion | `stores WHERE plan != 'free' / total trial stores` | Hourly |
| API Uptime | Cloudflare Analytics API | 5 min |
| Avg Response Time | Cloudflare Workers p95 metrics | 5 min |
| Revenue Trend Chart | Daily revenue aggregation (30 days) | Hourly |
| Alert Feed | `platform_alerts` + `moderation_queue` | Real-time |
| AI Insight | Gemini API weekly digest (cached) | Daily |

---

## 3. Store Management

### 3.1 Store List View

```
┌──────────────────────────────────────────────────────────────────┐
│  Store Management                          [+ Create Store]      │
│                                                                   │
│  Search: [🔍 Search stores...          ]                         │
│  Filters: [Status ▾] [Plan ▾] [Type ▾] [Created ▾] [Sort ▾]    │
│                                                                   │
│  1,247 stores total  │  892 active  │  215 trial  │  140 other   │
│                                                                   │
│  ┌───┬──────────────┬────────────┬──────────┬────────┬────────┐ │
│  │   │ Store        │ Owner      │ Plan     │ Status │ Actions│ │
│  ├───┼──────────────┼────────────┼──────────┼────────┼────────┤ │
│  │ ☐ │ Fashion Hub  │ priya@..   │ Business │ 🟢 Live │ [•••] │ │
│  │ ☐ │ Tech Reviews │ amit@..    │ Starter  │ 🟢 Live │ [•••] │ │
│  │ ☐ │ Art Studio   │ sarah@..   │ Free     │ 🟡 Trial│ [•••] │ │
│  │ ☐ │ Pharma Store │ scam@..    │ Free     │ 🔴 Susp.│ [•••] │ │
│  │ ☐ │ My Portfolio │ dev@..     │ Starter  │ 🔵 Draft│ [•••] │ │
│  └───┴──────────────┴────────────┴──────────┴────────┴────────┘ │
│                                                                   │
│  [← Prev]  Page 1 of 63  [Next →]                               │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Store Management Actions

| Action | Description | Permission | Audit Level |
|---|---|---|---|
| **View store details** | Full store data, config, analytics | `stores.read` | info |
| **Impersonate store** | View admin dashboard as store owner (read-only) | `stores.impersonate` | critical |
| **Suspend store** | Block store access, show suspension page | `stores.suspend` | critical |
| **Unsuspend store** | Restore store access | `stores.suspend` | critical |
| **Delete store** | Soft-delete with 30-day grace period | `stores.delete` | critical |
| **Force plan change** | Override subscription plan (upgrade/downgrade) | `billing.override` | critical |
| **Extend trial** | Add extra days to trial period | `billing.override` | warning |
| **Transfer ownership** | Move store to different user account | `stores.transfer` | critical |
| **Reset store** | Wipe all products/pages, keep config | `stores.reset` | critical |
| **Export store data** | Download full store data (GDPR compliance) | `stores.export` | warning |
| **Add internal note** | Attach internal notes to store record | `stores.annotate` | info |
| **Feature override** | Enable/disable specific features per store | `flags.write` | warning |

### 3.3 Store Impersonation (Read-Only)

```
Super Admin clicks "Impersonate" on store "Fashion Hub"
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  ⚠️ IMPERSONATION MODE                                       │
│  Viewing as: Priya Sharma (Fashion Hub)                       │
│  All actions are READ-ONLY and audit-logged                   │
│  [Exit Impersonation →]                                       │
├──────────────────────────────────────────────────────────────┤
│                                                                │
│  [Store Owner's Admin Dashboard — identical view]              │
│  - See their products, orders, settings, analytics             │
│  - Cannot modify, create, or delete anything                   │
│  - Useful for debugging support tickets                       │
│                                                                │
└──────────────────────────────────────────────────────────────┘
```

**Impersonation Implementation:**

```typescript
// apps/api/src/routes/super-admin/impersonate.ts
superAdminRouter.post('/impersonate/:storeId', async (c) => {
  const admin = c.get('superAdmin');
  const storeId = c.req.param('storeId');

  // Fetch store and owner
  const { data: store } = await c.get('supabase')
    .from('stores')
    .select('*, profiles!owner_id(*)')
    .eq('id', storeId)
    .single();

  if (!store) return c.json({ error: 'Store not found' }, 404);

  // Create time-limited impersonation token (15 min, read-only)
  const impersonationToken = await signJWT({
    sub: store.owner_id,
    store_id: storeId,
    impersonator_id: admin.id,
    mode: 'read_only',
    exp: Math.floor(Date.now() / 1000) + 900, // 15 minutes
  });

  // Log critical audit event
  await logAuditEvent(c, {
    actor_id: admin.id,
    action: 'STORE_IMPERSONATION_START',
    resource_type: 'store',
    resource_id: storeId,
    metadata: { store_name: store.name, owner_email: store.profiles.email },
    severity: 'critical',
  });

  return c.json({
    success: true,
    data: {
      token: impersonationToken,
      redirect_url: `https://admin.letbuyy.store/${store.subdomain}?impersonate=true`,
      expires_in: 900,
    },
  });
});
```

### 3.4 Store Lifecycle Management

```
Store Lifecycle States:

  ┌─────────────────────────────────────────────────────────────┐
  │                                                              │
  │  ┌──────────┐  onboard   ┌──────────┐  publish  ┌────────┐ │
  │  │ CREATED  │ ─────────→ │  DRAFT   │ ────────→ │ LIVE   │ │
  │  │ (signup) │            │ (setup)  │           │(public)│ │
  │  └──────────┘            └──────────┘           └────┬───┘ │
  │                                                      │      │
  │                          ┌──────────┐  unpublish     │      │
  │                          │UNPUBLISHED│ ←─────────────┘      │
  │                          └─────┬────┘                │      │
  │                                │ republish           │      │
  │                                └─────────────────────┘      │
  │                                                              │
  │  Trial expires                  Violation detected           │
  │  ┌──────────┐                   ┌──────────┐                 │
  │  │  FROZEN  │ ←── (trial end)   │SUSPENDED │ ←── (mod team) │
  │  │  (paywall│                   │(blocked) │                 │
  │  │  prompt) │                   └────┬─────┘                 │
  │  └────┬─────┘                        │ unsuspend             │
  │       │ subscribe                    └──→ LIVE               │
  │       └──→ LIVE                                              │
  │                                                              │
  │  Owner / admin requests deletion                             │
  │  ┌──────────┐  30 days  ┌──────────┐                         │
  │  │ DELETING │ ────────→ │ DELETED  │  (data purged)          │
  │  │ (grace)  │           │(terminal)│                         │
  │  └──────────┘           └──────────┘                         │
  └─────────────────────────────────────────────────────────────┘
```

---

## 4. User Management

### 4.1 User List View

```
┌──────────────────────────────────────────────────────────────────┐
│  User Management                                                  │
│                                                                   │
│  Search: [🔍 Search by name, email, or ID... ]                   │
│  Filters: [Role ▾] [Status ▾] [Signup Date ▾] [Has Store ▾]     │
│                                                                   │
│  3,456 users total  │  2,891 active  │  342 suspended  │  223 del│
│                                                                   │
│  ┌───┬──────────────┬──────────────┬─────────┬────────┬────────┐│
│  │   │ User          │ Email        │ Stores  │ Status │ Actions││
│  ├───┼──────────────┼──────────────┼─────────┼────────┼────────┤│
│  │ ☐ │ Priya Sharma │ priya@ex.com │ 2       │ 🟢 Act.│ [•••] ││
│  │ ☐ │ Amit Kumar   │ amit@ex.com  │ 1       │ 🟢 Act.│ [•••] ││
│  │ ☐ │ Spam User    │ spam@temp.co │ 0       │ 🔴 Susp│ [•••] ││
│  └───┴──────────────┴──────────────┴─────────┴────────┴────────┘│
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 User Management Actions

| Action | Description | Permission |
|---|---|---|
| **View user profile** | Full user data, login history, stores | `users.read` |
| **Disable account** | Block login, keep data | `users.suspend` |
| **Re-enable account** | Restore login access | `users.suspend` |
| **Delete account** | GDPR data deletion request (30-day grace) | `users.delete` |
| **Reset password** | Send password reset email | `users.write` |
| **Revoke sessions** | Force logout all devices | `users.write` |
| **View login history** | IP, device, timestamp, location | `users.read` |
| **Assign role** | Change platform role (admin, developer) | `users.roles` |
| **Export user data** | GDPR data export (JSON download) | `users.export` |

---

## 5. Team & Role-Based Access Control

### 5.1 Role Hierarchy

```
Platform Owner (founder — single account, irrevocable)
     │
     ├── Super Admin (full console access, all permissions)
     │    ├── Can do everything except delete platform owner
     │    ├── Can manage other super admins
     │    └── Assigned by: Platform Owner only
     │
     ├── Admin (operations, support, moderation)
     │    ├── Store management (view, suspend, extend trial)
     │    ├── Content moderation (approve, reject)
     │    ├── Support tickets (manage, respond)
     │    ├── Cannot: billing overrides, delete stores, impersonate
     │    └── Assigned by: Super Admin or Platform Owner
     │
     ├── Developer (technical ops, debugging)
     │    ├── API access, worker logs, database explorer (read-only)
     │    ├── Feature flags management
     │    ├── Cache management
     │    ├── Cannot: store management, billing, user management
     │    └── Assigned by: Super Admin or Platform Owner
     │
     ├── Support Agent (ticket-only access)
     │    ├── Support tickets (view, respond, escalate)
     │    ├── Store details (read-only for context)
     │    ├── Cannot: moderation, billing, user management
     │    └── Assigned by: Admin, Super Admin, or Platform Owner
     │
     └── Store-Level Roles (per-store, managed by store owner):
          ├── Store Owner (full admin dashboard for their store)
          ├── Manager (orders, inventory, customers — no billing)
          └── Editor (products, pages, blog — no orders or billing)
```

### 5.2 Team Member Invitation Flow

```
Super Admin invites new team member
         │
         ▼
1. Enter email + select role
         │
         ▼
2. System sends invitation email with one-time link
         │
         ▼
3. Invitee clicks link → Create account (name, password)
         │
         ▼
4. Mandatory 2FA setup (TOTP enrollment)
         │
         ▼
5. Account activated with assigned role
         │
         ▼
6. Audit log: TEAM_MEMBER_INVITED by {admin}
```

```typescript
// apps/api/src/routes/super-admin/team.ts
const InviteTeamMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['super_admin', 'admin', 'developer', 'support_agent']),
  message: z.string().max(500).optional(),
});

superAdminRouter.post('/team/invite', async (c) => {
  const admin = c.get('superAdmin');
  const body = InviteTeamMemberSchema.parse(await c.req.json());

  // Role escalation check — cannot invite higher role than self
  const roleHierarchy = { platform_owner: 4, super_admin: 3, admin: 2, developer: 1, support_agent: 0 };
  if (roleHierarchy[body.role] >= roleHierarchy[admin.role]) {
    return c.json({ error: 'Cannot invite user with equal or higher role' }, 403);
  }

  // Create invitation
  const token = crypto.randomUUID();
  await c.get('supabase').from('team_invitations').insert({
    email: body.email,
    role: body.role,
    invited_by: admin.id,
    token,
    expires_at: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours
  });

  // Send invitation email
  await sendEmail({
    to: body.email,
    template: 'team-invite',
    data: { inviter_name: admin.full_name, role: body.role, link: `https://console.letbuyy.store/invite/${token}`, message: body.message },
  });

  await logAuditEvent(c, {
    actor_id: admin.id,
    action: 'TEAM_MEMBER_INVITED',
    resource_type: 'team',
    metadata: { email: body.email, role: body.role },
    severity: 'warning',
  });

  return c.json({ success: true, message: `Invitation sent to ${body.email}` });
});
```

### 5.3 Team Management Features

| Feature | Description |
|---|---|
| **Invite by email** | One-time invitation link with role pre-assigned |
| **Role assignment** | Change role at any time (audit-logged) |
| **2FA enforcement** | All team accounts require TOTP or WebAuthn |
| **Session management** | View/revoke active sessions per team member |
| **Activity log** | Per-team-member action history |
| **Availability status** | Online/Away/Offline for ticket assignment |
| **Internal notes** | Annotate stores, users, tickets with internal context |
| **Slack/Discord alerts** | Webhook-based alert forwarding for moderation & tickets |

---

## 6. Permission Matrix

### 6.1 Platform-Level Permissions

| Permission | Platform Owner | Super Admin | Admin | Developer | Support Agent |
|---|---|---|---|---|---|
| **Dashboard — view** | ✅ | ✅ | ✅ | ✅ | ✅ (limited) |
| **Stores — list & view** | ✅ | ✅ | ✅ | ✅ (read-only) | ✅ (read-only) |
| **Stores — suspend/unsuspend** | ✅ | ✅ | ✅ | — | — |
| **Stores — delete** | ✅ | ✅ | — | — | — |
| **Stores — impersonate** | ✅ | ✅ | — | — | — |
| **Stores — transfer ownership** | ✅ | ✅ | — | — | — |
| **Users — list & view** | ✅ | ✅ | ✅ | — | ✅ (read-only) |
| **Users — suspend/delete** | ✅ | ✅ | ✅ | — | — |
| **Users — assign roles** | ✅ | ✅ | — | — | — |
| **Users — export data** | ✅ | ✅ | — | — | — |
| **Moderation — view queue** | ✅ | ✅ | ✅ | — | — |
| **Moderation — approve/reject** | ✅ | ✅ | ✅ | — | — |
| **Moderation — configure rules** | ✅ | ✅ | — | — | — |
| **Billing — view** | ✅ | ✅ | ✅ (read-only) | — | — |
| **Billing — override plans** | ✅ | ✅ | — | — | — |
| **Billing — refund** | ✅ | ✅ | — | — | — |
| **Tickets — view & respond** | ✅ | ✅ | ✅ | — | ✅ |
| **Tickets — assign** | ✅ | ✅ | ✅ | — | — |
| **Team — invite members** | ✅ | ✅ | — | — | — |
| **Team — manage roles** | ✅ | ✅ | — | — | — |
| **Audit logs — view** | ✅ | ✅ | ✅ (own actions) | ✅ (own actions) | — |
| **Feature flags — manage** | ✅ | ✅ | — | ✅ | — |
| **System tools — DB explorer** | ✅ | ✅ | — | ✅ | — |
| **System tools — cache/logs** | ✅ | ✅ | — | ✅ | — |
| **Maintenance mode** | ✅ | ✅ | — | — | — |
| **Platform settings** | ✅ | — | — | — | — |
| **Delete super admins** | ✅ | — | — | — | — |

### 6.2 Permission Implementation

```typescript
// apps/api/src/lib/permissions.ts
export const PERMISSIONS = {
  // Stores
  'stores.read':        ['platform_owner', 'super_admin', 'admin', 'developer', 'support_agent'],
  'stores.suspend':     ['platform_owner', 'super_admin', 'admin'],
  'stores.delete':      ['platform_owner', 'super_admin'],
  'stores.impersonate': ['platform_owner', 'super_admin'],
  'stores.transfer':    ['platform_owner', 'super_admin'],
  'stores.export':      ['platform_owner', 'super_admin'],
  'stores.reset':       ['platform_owner', 'super_admin'],
  'stores.annotate':    ['platform_owner', 'super_admin', 'admin', 'support_agent'],

  // Users
  'users.read':         ['platform_owner', 'super_admin', 'admin', 'support_agent'],
  'users.suspend':      ['platform_owner', 'super_admin', 'admin'],
  'users.delete':       ['platform_owner', 'super_admin'],
  'users.roles':        ['platform_owner', 'super_admin'],
  'users.export':       ['platform_owner', 'super_admin'],
  'users.write':        ['platform_owner', 'super_admin', 'admin'],

  // Moderation
  'moderation.read':    ['platform_owner', 'super_admin', 'admin'],
  'moderation.action':  ['platform_owner', 'super_admin', 'admin'],
  'moderation.config':  ['platform_owner', 'super_admin'],

  // Billing
  'billing.read':       ['platform_owner', 'super_admin', 'admin'],
  'billing.override':   ['platform_owner', 'super_admin'],
  'billing.refund':     ['platform_owner', 'super_admin'],

  // Support
  'tickets.read':       ['platform_owner', 'super_admin', 'admin', 'support_agent'],
  'tickets.respond':    ['platform_owner', 'super_admin', 'admin', 'support_agent'],
  'tickets.assign':     ['platform_owner', 'super_admin', 'admin'],

  // Team
  'team.invite':        ['platform_owner', 'super_admin'],
  'team.manage':        ['platform_owner', 'super_admin'],

  // Technical
  'flags.read':         ['platform_owner', 'super_admin', 'developer'],
  'flags.write':        ['platform_owner', 'super_admin', 'developer'],
  'system.db':          ['platform_owner', 'super_admin', 'developer'],
  'system.cache':       ['platform_owner', 'super_admin', 'developer'],
  'system.logs':        ['platform_owner', 'super_admin', 'developer'],
  'system.maintenance': ['platform_owner', 'super_admin'],

  // Audit
  'audit.read':         ['platform_owner', 'super_admin'],
  'audit.read_own':     ['platform_owner', 'super_admin', 'admin', 'developer'],

  // Platform
  'platform.settings':  ['platform_owner'],
} as const;

export function hasPermission(role: string, permission: string): boolean {
  return PERMISSIONS[permission]?.includes(role) ?? false;
}

// Middleware usage
export function requirePermission(permission: string) {
  return async (c: Context, next: Next) => {
    const admin = c.get('superAdmin');
    if (!hasPermission(admin.role, permission)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }
    await next();
  };
}
```

---

## 7. Content Moderation

### 7.1 Moderation Queue

```
┌──────────────────────────────────────────────────────────────────┐
│  Content Moderation Queue                                        │
│                                                                   │
│  Filters: [Status ▾] [Type ▾] [Risk Level ▾] [Assigned To ▾]   │
│                                                                   │
│  🔴 3 pending  │  🟡 5 in review  │  🟢 127 resolved today      │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ 🔴 HIGH — Product: "Pharmaceutical Grade Supplements"      │  │
│  │ Store: pharma-deals  │  Risk: 87/100  │  Type: Product     │  │
│  │                                                             │  │
│  │ 🤖 AI Analysis:                                            │  │
│  │ "Product listing contains claims of medical benefits        │  │
│  │  without disclaimers. Title suggests pharmaceutical         │  │
│  │  products. Flagged categories: health_claims, prohibited."  │  │
│  │                                                             │  │
│  │ Evidence:                                                   │  │
│  │ • Title: "Pharmaceutical Grade Fat Burner — Medical Proof"  │  │
│  │ • Description contains: "FDA approved", "cures", "treats"  │  │
│  │ • Images: product with medical-style labeling               │  │
│  │                                                             │  │
│  │ [✅ Approve] [❌ Reject] [⚠️ Warn] [📩 Contact] [👁️ View] │  │
│  │ [Assign to: [Team Member ▾]]                                │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ 🟡 MEDIUM — Image: Store logo (fashion-hub)                │  │
│  │ Store: fashion-hub  │  Risk: 45/100  │  Type: Media         │  │
│  │                                                             │  │
│  │ 🤖 AI Analysis:                                            │  │
│  │ "Logo design contains elements similar to Nike swoosh.      │  │
│  │  Potential trademark infringement. Confidence: 62%"         │  │
│  │                                                             │  │
│  │ [✅ Approve] [❌ Reject] [⚠️ Warn] [📩 Contact] [👁️ View] │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ 🟡 MEDIUM — Blog: "Best Dropshipping Products 2026"        │  │
│  │ Store: tech-reviews  │  Risk: 52/100  │  Type: Content      │  │
│  │                                                             │  │
│  │ 🤖 AI Analysis:                                            │  │
│  │ "Content appears to be low-quality AI-generated spam.       │  │
│  │  High keyword stuffing density. Thin content warning."      │  │
│  │                                                             │  │
│  │ [✅ Approve] [❌ Reject] [⚠️ Warn] [📩 Contact] [👁️ View] │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Moderation Actions & Outcomes

| Action | Effect | Notification to Store Owner |
|---|---|---|
| **Approve** | Content goes live immediately | — (no notification needed) |
| **Reject** | Content removed, marked as rejected | Email with rejection reason + appeal link |
| **Warning** | Content stays live, owner warned | Email with policy reminder + violation details |
| **Request Edit** | Content hidden until owner edits | Email with required changes |
| **Suspend Store** | Store access blocked, suspension page shown | Email + in-app notification |
| **Escalate** | Forward to platform owner for review | Internal notification only |
| **Auto-Approve** | Low-risk content auto-approved by AI | — |
| **Auto-Reject** | High-risk content auto-rejected by AI | Email with auto-rejection reason |

### 7.3 Violation Tier System

| Tier | Consequence | Reset |
|---|---|---|
| **Tier 1 — Warning** | Warning email sent, no action on store | After 30 days |
| **Tier 2 — Strike 1** | Content removed + warning | After 60 days |
| **Tier 3 — Strike 2** | Content removed + feature restrictions | After 90 days |
| **Tier 4 — Strike 3** | Store suspended for 7 days | After 180 days |
| **Tier 5 — Permanent** | Store permanently suspended + data export | Appeal only |

---

## 8. Moderation AI Pipeline

### 8.1 Content Scanning Flow

```
New Content Created (product / image / page / blog)
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Stage 1: Rule-Based Checks (instant, no AI cost)             │
│  ├── Keyword blocklist (prohibited terms)                     │
│  ├── URL blocklist (known malicious domains)                  │
│  ├── File type validation (images, no executables)            │
│  ├── Content length checks (min/max)                          │
│  └── Duplicate content detection (hash comparison)            │
│                                                                │
│  Outcome: PASS → Stage 2  │  FAIL → Auto-reject               │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Stage 2: AI Content Analysis (Gemini 2.0 Flash Lite)         │
│  ├── Text → Classify: spam, prohibited, health_claims, etc.  │
│  ├── Images → NSFW detection, copyright check, watermarks    │
│  ├── Product → Category validation, price reasonableness     │
│  └── Returns: risk_score (0-100) + categories + explanation  │
│                                                                │
│  Outcome:                                                      │
│  ├── Risk ≤ 20 → Auto-approve (content goes live)             │
│  ├── Risk 21-70 → Queue for human review                      │
│  └── Risk > 70 → Auto-reject (notify owner)                   │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Stage 3: Human Review (if queued)                            │
│  ├── Moderator sees AI analysis + evidence                    │
│  ├── One-click actions: Approve / Reject / Warn / Escalate   │
│  └── Decision stored → feeds back into AI training data       │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 AI Moderation Prompt Template

```typescript
const moderationPrompt = `
You are a content moderation AI for an e-commerce platform.
Analyze the following content and return a JSON response.

Content Type: ${type} (product / image / blog_post / page)
Title: ${title}
Description: ${description}
Category: ${category}

Check for:
1. Prohibited items (weapons, drugs, counterfeit goods)
2. Health/medical claims without disclaimers
3. NSFW or inappropriate content
4. Spam or low-quality AI-generated content
5. Copyright infringement indicators
6. Personal information exposure (PII)
7. Malicious links or phishing attempts
8. Misleading pricing or fake discounts

Return JSON:
{
  "risk_score": 0-100,
  "categories": ["prohibited", "health_claims", "spam", ...],
  "explanation": "Brief explanation of findings",
  "confidence": 0-100,
  "recommended_action": "approve" | "review" | "reject"
}
`;
```

### 8.3 Auto-Moderation Configuration

| Check | Auto Action | Threshold | Configurable |
|---|---|---|---|
| Prohibited products (weapons, drugs) | Auto-reject | Risk > 80 | ✅ |
| NSFW images | Auto-reject | Risk > 70 | ✅ |
| Health/medical claims | Flag for review | Any detection | ✅ |
| Spam / thin content | Flag for review | Risk > 40 | ✅ |
| PII exposure (SSN, card numbers) | Auto-flag + redact | Any detection | — |
| Copyright watermarks | Flag for review | Risk > 50 | ✅ |
| Malicious links | Auto-reject | Any detection | — |
| Duplicate products (cross-store) | Flag for review | > 90% similarity | ✅ |
| Fake reviews | Auto-hide + flag | Risk > 60 | ✅ |
| Price manipulation (₹1 products) | Flag for review | Price < ₹10 | ✅ |

---

## 9. Platform Analytics

### 9.1 Analytics Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│  Platform Analytics                     Period: [Last 30 days ▾] │
│                                                                   │
│  GROWTH ──────────────────────────────────────────────────────── │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ New      │ │ Active   │ │ Churn    │ │ Net      │           │
│  │ Signups  │ │ Stores   │ │ Rate     │ │ Growth   │           │
│  │ 312      │ │ 892      │ │ 3.2%     │ │ +45 net  │           │
│  │ ↑15% MoM│ │ ↑5% MoM  │ │ ↓0.5pp   │ │ stores   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                   │
│  REVENUE ─────────────────────────────────────────────────────── │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ MRR      │ │ ARR      │ │ ARPU     │ │ LTV      │           │
│  │ ₹8.2L    │ │ ₹98.4L   │ │ ₹920     │ │ ₹11,040  │           │
│  │ ↑18% MoM│ │ proj.    │ │ per store│ │ 12-month │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                   │
│  ENGAGEMENT ──────────────────────────────────────────────────── │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ DAU      │ │ MAU      │ │ Avg      │ │ Feature  │           │
│  │ 456      │ │ 1,892    │ │ Session  │ │ Adoption │           │
│  │          │ │          │ │ 12.4 min │ │ AI: 67%  │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                   │
│  AI USAGE ────────────────────────────────────────────────────── │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Total AI │ │ Credits  │ │ Cache Hit│ │ AI Cost  │           │
│  │ Calls    │ │ Consumed │ │ Rate     │ │ (MTD)    │           │
│  │ 234,567  │ │ 1.2M     │ │ 42%     │ │ ₹18,450  │           │
│  │ ↑22%    │ │          │ │ ↑8pp     │ │ ↓12%     │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                   │
│  SYSTEM ──────────────────────────────────────────────────────── │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ API      │ │ p95      │ │ Error    │ │ Worker   │           │
│  │ Uptime   │ │ Latency  │ │ Rate     │ │ CPU      │           │
│  │ 99.97%   │ │ 45ms     │ │ 0.12%   │ │ 34%      │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
└──────────────────────────────────────────────────────────────────┘
```

### 9.2 Key Metrics Definitions

| Category | Metric | Formula / Source |
|---|---|---|
| **Growth** | New Signups | `COUNT(profiles) WHERE created_at >= period_start` |
| **Growth** | Active Stores | `COUNT(stores) WHERE status = 'published' AND last_activity >= 7 days ago` |
| **Growth** | Churn Rate | `Stores canceled this month / Total paying stores at month start × 100` |
| **Growth** | Net Growth | `New stores − Churned stores` |
| **Revenue** | MRR | `SUM(active subscriptions × monthly_price)` |
| **Revenue** | ARR | `MRR × 12` |
| **Revenue** | ARPU | `MRR / Total paying stores` |
| **Revenue** | LTV | `ARPU × Average customer lifespan (months)` |
| **Revenue** | Trial → Paid | `Stores converted to paid / Total trial stores × 100` |
| **Engagement** | DAU | Unique users with any API activity today |
| **Engagement** | MAU | Unique users with any API activity this month |
| **Engagement** | Feature Adoption | `Users who used feature X / Total active users × 100` |
| **AI** | Total Calls | `COUNT(ai_usage_logs) WHERE period` |
| **AI** | Cache Hit Rate | `Cached responses / Total AI requests × 100` |
| **AI** | Cost | `SUM(ai_usage_logs.cost_usd) converted to INR` |
| **System** | Uptime | `1 − (downtime_minutes / total_minutes) × 100` |
| **System** | p95 Latency | 95th percentile response time from Cloudflare Analytics |
| **System** | Error Rate | `5xx responses / Total requests × 100` |

### 9.3 AI-Powered Weekly Reports

```typescript
// cron: weekly-report (runs every Monday at 9:00 AM IST)
async function generateWeeklyReport(): Promise<string> {
  const metrics = await fetchPlatformMetrics({ period: '7d' });
  const previousMetrics = await fetchPlatformMetrics({ period: '7d', offset: '7d' });
  
  const prompt = `
    Generate a concise operational summary for the LetBuyy platform.
    
    This Week:
    - New stores: ${metrics.newStores} (prev: ${previousMetrics.newStores})
    - Active stores: ${metrics.activeStores} (prev: ${previousMetrics.activeStores})
    - Revenue: ₹${metrics.revenue} (prev: ₹${previousMetrics.revenue})
    - Trial conversions: ${metrics.trialConversions}%
    - AI usage: ${metrics.aiCalls} calls (prev: ${previousMetrics.aiCalls})
    - Content violations: ${metrics.violations} auto-rejected
    - Support tickets: ${metrics.openTickets} open
    - Top segment: ${metrics.topSegment}
    
    Provide:
    1. Key highlights (2-3 sentences)
    2. Trends and insights
    3. One actionable recommendation
    
    Keep it under 150 words. Be specific with numbers.
  `;
  
  const report = await generateAIContent(prompt);
  
  // Store report
  await supabase.from('platform_reports').insert({
    type: 'weekly',
    content: report,
    metrics: metrics,
    generated_at: new Date(),
  });
  
  // Notify team via Slack
  await sendSlackMessage('#ops-reports', report);
  
  return report;
}
```

### 9.4 Store Segmentation Analytics

| Segment | Criteria | Tracked Metrics |
|---|---|---|
| By **site type** | Store, Portfolio, Resume, Landing, Blog | Count, revenue, growth rate |
| By **plan** | Free, Starter, Business, Enterprise | Conversion rate, ARPU, churn |
| By **age** | 0-7d, 7-30d, 1-3mo, 3-6mo, 6-12mo, 12mo+ | Retention curve, activity rate |
| By **GMV** | ₹0, ₹1-10K, ₹10K-1L, ₹1L-10L, ₹10L+ | Distribution, plan correlation |
| By **region** | Top 10 Indian states by store count | Growth, revenue, popular types |
| By **AI usage** | None, Light, Heavy | Correlation with retention |

---

## 10. Revenue & Billing Operations

### 10.1 Billing Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│  Revenue & Billing                         Period: [Feb 2026 ▾]  │
│                                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Revenue  │ │ Failed   │ │ Refunds  │ │ Net      │           │
│  │ Collected│ │ Payments │ │ Issued   │ │ Revenue  │           │
│  │ ₹12.8L   │ │ ₹45K     │ │ ₹12K     │ │ ₹12.3L   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                   │
│  PLAN DISTRIBUTION                                               │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Free     ███████████████████████████████████████  620 (50%)│  │
│  │  Starter  ██████████████████████  380 (30%)                │  │
│  │  Business █████████  170 (14%)                              │  │
│  │  Enterprise ███  77 (6%)                                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  RECENT TRANSACTIONS                                             │
│  ┌──────┬──────────────┬──────────┬──────────┬─────────┐        │
│  │ Date │ Store        │ Amount   │ Plan     │ Status  │        │
│  │ Feb14│ Fashion Hub  │ ₹1,999   │ Business │ ✅ Paid  │        │
│  │ Feb14│ Tech Reviews │ ₹799     │ Starter  │ ✅ Paid  │        │
│  │ Feb13│ Art Studio   │ ₹799     │ Starter  │ ❌ Failed│        │
│  │ Feb13│ Quick Store  │ ₹1,999   │ Business │ 🔄 Retry│        │
│  └──────┴──────────────┴──────────┴──────────┴─────────┘        │
└──────────────────────────────────────────────────────────────────┘
```

### 10.2 Billing Operations Actions

| Action | Description | Permission |
|---|---|---|
| **View all transactions** | Payment history with filters | `billing.read` |
| **Force plan upgrade** | Override plan without payment | `billing.override` |
| **Grant free plan** | Assign paid features to a store for free | `billing.override` |
| **Extend trial** | Add days to trial (e.g., for support cases) | `billing.override` |
| **Process refund** | Issue partial/full refund via Razorpay | `billing.refund` |
| **Retry payment** | Re-attempt failed payment | `billing.override` |
| **Cancel subscription** | Cancel store's subscription | `billing.override` |
| **View Razorpay dashboard** | Deep link to Razorpay payment details | `billing.read` |
| **Generate invoice** | Create/resend invoice PDF | `billing.read` |
| **Grant AI credits** | Add bonus AI credits to a store | `billing.override` |

---

## 11. Support System

### 11.1 Support Ticket Flow

```
Store owner submits ticket (from admin dashboard or email)
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Stage 1: AI Auto-Triage (instant, < 2s)                      │
│  ├── Parse ticket content with Gemini                         │
│  ├── Classify category:                                       │
│  │   • Billing (payment issues, plan changes)                 │
│  │   • Technical (bugs, errors, integration help)             │
│  │   • Feature Request (new feature suggestions)              │
│  │   • Content (moderation questions, policy clarification)   │
│  │   • Account (login issues, data export, deletion)          │
│  ├── Assign priority:                                          │
│  │   • 🔴 Critical — store is down, payment processing broken │
│  │   • 🟠 High — major feature broken, data concerns          │
│  │   • 🟡 Medium — minor issues, how-to questions              │
│  │   • 🟢 Low — feature requests, general inquiries            │
│  └── Suggest resolution from knowledge base (if match > 80%)  │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Stage 2: Auto-Assignment                                     │
│  ├── Check team member availability (online/away status)      │
│  ├── Check expertise (category match)                         │
│  ├── Check current ticket load (fairness distribution)        │
│  └── Assign to best-fit team member                           │
│                                                                │
│  Fallback: If no one available → enter general queue           │
│  SLA timer starts on assignment                                │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Stage 3: Resolution                                          │
│  ├── Agent responds to store owner                            │
│  ├── Internal notes + collaboration with other team members   │
│  ├── Link related tickets (duplicate detection)                │
│  ├── Escalate to super admin if needed                        │
│  └── Status: Open → In Progress → Awaiting Reply → Resolved   │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  Stage 4: Close + Follow-up                                   │
│  ├── Auto-close after 48 hours of no reply (after resolution) │
│  ├── Satisfaction survey (1-5 stars + optional comment)        │
│  ├── Knowledge base article creation (if new issue type)      │
│  └── Metrics update: response time, resolution time, CSAT     │
└──────────────────────────────────────────────────────────────┘
```

### 11.2 Ticket Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│  Support Tickets                              [Filter ▾] [Sort ▾]│
│                                                                   │
│  🔴 2 critical  │  🟡 8 open  │  🔄 5 in progress  │  ✅ 127 res│
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ #1045 🔴 CRITICAL — "Payments not processing"             │  │
│  │ Fashion Hub (priya@...)  │  Category: Billing              │  │
│  │ Opened: 2h ago  │  Assigned: Amit K.  │  SLA: ⏰ 2h left  │  │
│  │                                                             │  │
│  │ 🤖 AI Triage: "Customer reports Razorpay checkout failing   │  │
│  │ with error 'PAYMENT_GATEWAY_ERROR'. Likely related to       │  │
│  │ webhook configuration. KB Match: #KB-042 (87% match)"      │  │
│  │                                                             │  │
│  │ [Reply] [Internal Note] [Escalate] [Link KB] [Close]       │  │
│  ├────────────────────────────────────────────────────────────┤  │
│  │ #1042 🟡 MEDIUM — "How to add custom domain?"              │  │
│  │ Tech Reviews (amit@...)  │  Category: Technical            │  │
│  │ Opened: 5h ago  │  Assigned: Sarah L.  │  SLA: ✅ on track │  │
│  │                                                             │  │
│  │ 🤖 AI Triage: "Customer asking about custom domain setup.  │  │
│  │ KB Match: #KB-018 (95% match). Suggest auto-reply."        │  │
│  │                                                             │  │
│  │ [Reply] [Auto-Reply with KB] [Close]                       │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### 11.3 SLA Configuration

| Priority | First Response | Resolution | Escalation |
|---|---|---|---|
| 🔴 Critical | < 1 hour | < 4 hours | After 2 hours |
| 🟠 High | < 4 hours | < 24 hours | After 8 hours |
| 🟡 Medium | < 12 hours | < 48 hours | After 24 hours |
| 🟢 Low | < 24 hours | < 72 hours | After 48 hours |

### 11.4 Canned Responses

Pre-configured response templates for common issues:

| Template | Trigger | Content |
|---|---|---|
| Custom domain setup | "custom domain" | Step-by-step DNS instructions |
| Payment failure | "payment", "checkout" | Common Razorpay troubleshooting steps |
| Plan upgrade | "upgrade", "plan" | Plan comparison + upgrade link |
| How to add products | "add product" | Product creation guide link |
| Trial extension | "trial", "extend" | Policy explanation + request form |
| Data export (GDPR) | "export", "data" | Data export process + timeline |
| Account deletion | "delete account" | Consequences + confirmation process |

### 11.5 Support Performance Metrics

| Metric | Target | Measurement |
|---|---|---|
| Average first response time | < 4 hours | Median of all tickets |
| Average resolution time | < 24 hours | Median time from open to resolved |
| CSAT score | > 4.5/5.0 | Customer satisfaction surveys |
| First-contact resolution rate | > 60% | Tickets resolved in single response |
| Ticket volume trend | Decreasing | Week-over-week comparison |
| Knowledge base deflection | > 30% | Tickets avoided by self-service KB |

---

## 12. Audit Logging

### 12.1 Audit Log Schema

```sql
-- Every super admin action is recorded
CREATE TABLE audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID NOT NULL REFERENCES profiles(id),
  action        TEXT NOT NULL,           -- e.g., 'STORE_SUSPENDED', 'TEAM_MEMBER_INVITED'
  resource_type TEXT NOT NULL,           -- 'store', 'user', 'team', 'ticket', 'system'
  resource_id   UUID,                    -- ID of the affected resource
  metadata      JSONB DEFAULT '{}',      -- Additional context (before/after values, etc.)
  ip_address    TEXT,                    -- Actor's IP address
  user_agent    TEXT,                    -- Actor's browser/device
  severity      TEXT DEFAULT 'info',     -- 'info', 'warning', 'critical'
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Index for fast querying
CREATE INDEX idx_audit_actor ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action, created_at DESC);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_severity ON audit_logs(severity) WHERE severity IN ('warning', 'critical');
```

### 12.2 Tracked Actions

| Action | Resource Type | Severity | Trigger |
|---|---|---|---|
| `SUPER_ADMIN_LOGIN` | session | info | Successful console login |
| `SUPER_ADMIN_LOGIN_FAILED` | session | warning | Failed login attempt |
| `SUPER_ADMIN_ACCESS_DENIED` | console | warning | Unauthorized access attempt |
| `IP_BLOCKED` | console | critical | Access from non-allowlisted IP |
| `STORE_VIEWED` | store | info | Admin views store details |
| `STORE_SUSPENDED` | store | critical | Store suspended by admin |
| `STORE_UNSUSPENDED` | store | critical | Store restored |
| `STORE_DELETED` | store | critical | Store deletion initiated |
| `STORE_IMPERSONATION_START` | store | critical | Admin starts impersonation |
| `STORE_IMPERSONATION_END` | store | info | Impersonation session ended |
| `STORE_PLAN_OVERRIDDEN` | store | critical | Plan manually changed |
| `STORE_TRIAL_EXTENDED` | store | warning | Trial period extended |
| `STORE_OWNERSHIP_TRANSFERRED` | store | critical | Ownership changed |
| `USER_SUSPENDED` | user | critical | User account disabled |
| `USER_DELETED` | user | critical | User deletion initiated |
| `USER_ROLE_CHANGED` | user | warning | Platform role changed |
| `USER_DATA_EXPORTED` | user | warning | GDPR data export |
| `TEAM_MEMBER_INVITED` | team | warning | New team invitation sent |
| `TEAM_MEMBER_REMOVED` | team | warning | Team member removed |
| `TEAM_ROLE_CHANGED` | team | warning | Team member role changed |
| `MODERATION_APPROVED` | content | info | Content approved |
| `MODERATION_REJECTED` | content | warning | Content rejected |
| `TICKET_RESPONDED` | ticket | info | Support ticket reply |
| `TICKET_ESCALATED` | ticket | warning | Ticket escalated |
| `REFUND_ISSUED` | billing | critical | Payment refunded |
| `FEATURE_FLAG_CHANGED` | system | warning | Feature flag toggled |
| `MAINTENANCE_MODE_ACTIVATED` | system | critical | Maintenance mode on |
| `MAINTENANCE_MODE_DEACTIVATED` | system | critical | Maintenance mode off |

### 12.3 Audit Log Viewer

```
┌──────────────────────────────────────────────────────────────────┐
│  Audit Logs                               [Export CSV ↓]         │
│                                                                   │
│  Filters: [Actor ▾] [Action ▾] [Severity ▾] [Date Range ▾]     │
│                                                                   │
│  ┌────┬──────────┬───────────────────┬──────────┬──────────────┐│
│  │Sev.│ Time      │ Action            │ Actor    │ Resource     ││
│  ├────┼──────────┼───────────────────┼──────────┼──────────────┤│
│  │ 🔴 │ 14:32:05 │ STORE_SUSPENDED   │ Amit K.  │ pharma-deals ││
│  │ 🟡 │ 14:28:11 │ MODERATION_REJECT │ Sarah L. │ product-4521 ││
│  │ 🔵 │ 14:25:00 │ TICKET_RESPONDED  │ Amit K.  │ ticket-1045  ││
│  │ 🔴 │ 13:55:22 │ IMPERSONATION_ST  │ You      │ fashion-hub  ││
│  │ 🟡 │ 13:45:10 │ TRIAL_EXTENDED    │ Sarah L. │ art-studio   ││
│  │ 🔵 │ 13:30:55 │ SUPER_ADMIN_LOGIN │ You      │ session      ││
│  └────┴──────────┴───────────────────┴──────────┴──────────────┘│
│                                                                   │
│  Showing 6 of 14,521 entries  │  [← Prev] Page 1 of 2421 [Next]│
└──────────────────────────────────────────────────────────────────┘
```

### 12.4 Audit Retention Policy

| Severity | Retention | Storage |
|---|---|---|
| **Info** | 90 days | Supabase Postgres |
| **Warning** | 1 year | Supabase Postgres |
| **Critical** | 5 years (or indefinite) | Supabase Postgres + R2 archive |
| **All (compressed)** | Indefinite | Monthly export to R2 cold storage |

---

## 13. Security & Fraud Detection

### 13.1 Security Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│  Security Overview                       Status: 🟢 No Threats   │
│                                                                   │
│  THREAT MONITORING (last 24 hours)                               │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Failed    │ │Suspicious│ │Blocked   │ │Active    │           │
│  │Logins    │ │Signups   │ │IPs       │ │Abuse     │           │
│  │ 47       │ │ 3        │ │ 12       │ │ 0        │           │
│  │< thresh. │ │ ⚠️ Review│ │auto-block│ │Reports   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                   │
│  SECURITY CHECKLIST                                              │
│  ✅ SSL certificates valid (auto-renew: Cloudflare)              │
│  ✅ API keys rotated < 90 days ago                               │
│  ✅ 2FA enabled for all team members                             │
│  ✅ No leaked credentials detected                               │
│  ⚠️ 1 team member has not logged in for 30+ days                │
└──────────────────────────────────────────────────────────────────┘
```

### 13.2 AI-Powered Fraud Detection

| Threat Vector | Detection Method | Auto Action |
|---|---|---|
| **Signup spam** | Burst detection (>5 signups from same IP in 10 min) | Block IP + flag accounts |
| **Disposable emails** | Match against disposable email domain list (10K+ domains) | Reject signup |
| **Bot signups** | Behavioral analysis (click speed, mouse movement) | CAPTCHA challenge |
| **Account takeover** | Unusual login (new device + new location + new IP) | Force 2FA re-verification |
| **Payment fraud** | Razorpay risk scoring + velocity checks | Hold order for review |
| **Card testing** | Multiple small transactions from same card | Block card + alert |
| **Fake stores** | Mass-created stores with identical content | Flag for review |
| **Content scraping** | High request velocity for product data | Rate limit + CAPTCHA |
| **Coupon abuse** | Same user/IP using multiple coupons | Block + flag |
| **Refund fraud** | Refund requests > 3x in 30 days per store | Flag for review |

### 13.3 IP Intelligence

```typescript
// apps/api/src/lib/security/ip-intelligence.ts
interface IPIntelligence {
  ip: string;
  is_vpn: boolean;
  is_tor: boolean;
  is_proxy: boolean;
  is_datacenter: boolean;
  country: string;
  city: string;
  risk_score: number; // 0-100
  is_blocklisted: boolean;
}

async function analyzeIP(ip: string): Promise<IPIntelligence> {
  // Check local blocklist (Upstash Redis)
  const blocked = await redis.sismember('blocked_ips', ip);
  if (blocked) return { ip, is_blocklisted: true, risk_score: 100 } as IPIntelligence;

  // Check rate limits
  const recentAttempts = await redis.incr(`login_attempts:${ip}`);
  await redis.expire(`login_attempts:${ip}`, 3600);

  if (recentAttempts > 20) {
    await redis.sadd('blocked_ips', ip);
    await redis.expire('blocked_ips', 86400);
    return { ip, is_blocklisted: true, risk_score: 100 } as IPIntelligence;
  }

  // Cloudflare provides geo data via headers
  const geoData = {
    country: headers['cf-ipcountry'],
    city: headers['cf-ipcity'],
    is_tor: headers['cf-is-tor'] === '1',
  };

  return {
    ip,
    ...geoData,
    risk_score: calculateRiskScore(geoData, recentAttempts),
    is_blocklisted: false,
  };
}
```

### 13.4 Security Alerts

| Alert | Trigger | Channel | Priority |
|---|---|---|---|
| Brute force detected | > 20 failed logins from single IP in 1 hour | Slack + Console | 🔴 Critical |
| Account takeover attempt | New device + new location login | Email to user + Console | 🔴 Critical |
| Signup spam burst | > 5 signups from same IP in 10 minutes | Slack + Console | 🟠 High |
| SSL certificate expiring | Certificate expires in < 14 days | Email + Slack | 🟡 Medium |
| Team member inactive | No login for 30+ days | Console notification | 🟡 Medium |
| API key near expiry | Key expires in < 7 days | Email + Console | 🟡 Medium |
| Unusual API traffic | 3× normal request volume | Slack + Console | 🟠 High |
| Data export requested | GDPR export initiated | Console notification | 🔵 Info |

---

## 14. Feature Flags & Experimentation

### 14.1 Feature Flag System

```
┌──────────────────────────────────────────────────────────────────┐
│  Feature Flags                           [+ New Flag]            │
│                                                                   │
│  ┌────┬──────────────────┬─────────┬────────────┬──────────────┐│
│  │ On │ Flag Name         │ Scope   │ Rollout %  │ Last Changed ││
│  ├────┼──────────────────┼─────────┼────────────┼──────────────┤│
│  │ 🟢 │ ai_product_desc   │ Global  │ 100%       │ Feb 10, 2026 ││
│  │ 🟢 │ new_checkout_flow │ Gradual │ 25%        │ Feb 12, 2026 ││
│  │ 🟡 │ blog_comments     │ Plan    │ Business+  │ Feb 14, 2026 ││
│  │ 🔴 │ video_products    │ Global  │ 0% (off)   │ Feb 08, 2026 ││
│  │ 🟢 │ ai_chatbot_v2     │ Store   │ 3 stores   │ Feb 14, 2026 ││
│  │ 🟢 │ dark_mode_store   │ Global  │ 100%       │ Jan 28, 2026 ││
│  └────┴──────────────────┴─────────┴────────────┴──────────────┘│
│                                                                   │
│  Total: 42 flags  │  32 active  │  6 gradual rollout  │  4 off  │
└──────────────────────────────────────────────────────────────────┘
```

### 14.2 Flag Scoping Types

| Scope | Description | Example |
|---|---|---|
| **Global** | On/off for all stores | `ai_product_desc: true` |
| **Plan-based** | Available only for specific plans | `blog_comments: Business+` |
| **Percentage rollout** | Gradual rollout to % of stores | `new_checkout_flow: 25%` |
| **Store-specific** | Enable for explicit store IDs | `ai_chatbot_v2: [store_1, store_2]` |
| **User-specific** | Enable for explicit user IDs | `beta_dashboard: [user_1]` |
| **Time-based** | Auto-enable/disable at scheduled time | `holiday_theme: Dec 20 → Jan 5` |

### 14.3 Feature Flag Implementation

```typescript
// apps/api/src/lib/feature-flags.ts
import { Redis } from '@upstash/redis';

interface FeatureFlag {
  key: string;
  enabled: boolean;
  scope: 'global' | 'plan' | 'percentage' | 'store' | 'user' | 'time';
  config: {
    plans?: string[];           // For plan-based
    percentage?: number;        // For gradual rollout (0-100)
    store_ids?: string[];       // For store-specific
    user_ids?: string[];        // For user-specific
    start_at?: string;          // For time-based (ISO 8601)
    end_at?: string;            // For time-based (ISO 8601)
  };
  description: string;
  created_by: string;
  updated_at: string;
}

export async function isFeatureEnabled(
  flagKey: string,
  context: { store_id?: string; user_id?: string; plan?: string }
): Promise<boolean> {
  // Check Redis cache first
  const cached = await redis.get<FeatureFlag>(`flag:${flagKey}`);
  const flag = cached || await fetchFlagFromDB(flagKey);

  if (!flag || !flag.enabled) return false;

  switch (flag.scope) {
    case 'global':
      return true;

    case 'plan':
      return flag.config.plans?.includes(context.plan || '') ?? false;

    case 'percentage':
      // Deterministic hash based on store_id for consistent experience
      const hash = hashCode(`${flagKey}:${context.store_id}`);
      return (hash % 100) < (flag.config.percentage || 0);

    case 'store':
      return flag.config.store_ids?.includes(context.store_id || '') ?? false;

    case 'user':
      return flag.config.user_ids?.includes(context.user_id || '') ?? false;

    case 'time':
      const now = new Date();
      const start = flag.config.start_at ? new Date(flag.config.start_at) : new Date(0);
      const end = flag.config.end_at ? new Date(flag.config.end_at) : new Date('2099-12-31');
      return now >= start && now <= end;

    default:
      return false;
  }
}
```

---

## 15. Notification & Alert System

### 15.1 Alert Channels

| Channel | Use Case | Configuration |
|---|---|---|
| **Console in-app** | All alerts — default channel | Always on |
| **Email** | Critical alerts, daily/weekly digests | Per-team-member preference |
| **Slack webhook** | Real-time alerts for ops channel | Webhook URL in settings |
| **Discord webhook** | Alternative to Slack | Webhook URL in settings |
| **SMS** (future) | Critical-only alerts | Phone number + carrier config |
| **Push notification** | Flutter super-admin app | FCM token |

### 15.2 Alert Categories & Defaults

| Category | Console | Email | Slack | Priority |
|---|---|---|---|---|
| **Security — brute force** | ✅ | ✅ | ✅ | 🔴 Critical |
| **Security — account takeover** | ✅ | ✅ | ✅ | 🔴 Critical |
| **Moderation — high risk** | ✅ | — | ✅ | 🟠 High |
| **Moderation — auto-rejected** | ✅ | — | — | 🟡 Medium |
| **Support — critical ticket** | ✅ | ✅ | ✅ | 🔴 Critical |
| **Support — SLA breach** | ✅ | ✅ | ✅ | 🟠 High |
| **Billing — payment failed** | ✅ | — | — | 🟡 Medium |
| **Billing — refund issued** | ✅ | — | ✅ | 🟡 Medium |
| **System — error spike** | ✅ | ✅ | ✅ | 🔴 Critical |
| **System — high latency** | ✅ | — | ✅ | 🟠 High |
| **Growth — milestone** | ✅ | ✅ | ✅ | 🔵 Info |
| **Report — weekly digest** | ✅ | ✅ | — | 🔵 Info |
| **Feature flag changed** | ✅ | — | ✅ | 🟡 Medium |
| **Team — member invited** | ✅ | ✅ | — | 🔵 Info |
| **Maintenance — scheduled** | ✅ | ✅ | ✅ | 🟠 High |

### 15.3 Slack Webhook Integration

```typescript
// apps/api/src/lib/notifications/slack.ts
interface SlackAlert {
  channel: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  message: string;
  fields?: { name: string; value: string }[];
  link?: { url: string; text: string };
}

const SEVERITY_COLORS = {
  critical: '#DC2626',
  high: '#F97316',
  medium: '#EAB308',
  low: '#22C55E',
  info: '#3B82F6',
};

export async function sendSlackAlert(alert: SlackAlert) {
  const webhookUrl = await redis.get<string>('config:slack_webhook');
  if (!webhookUrl) return;

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      attachments: [{
        color: SEVERITY_COLORS[alert.severity],
        title: `${severityEmoji(alert.severity)} ${alert.title}`,
        text: alert.message,
        fields: alert.fields?.map(f => ({
          title: f.name,
          value: f.value,
          short: true,
        })),
        actions: alert.link ? [{
          type: 'button',
          text: alert.link.text,
          url: alert.link.url,
        }] : undefined,
        ts: Math.floor(Date.now() / 1000),
      }],
    }),
  });
}
```

---

## 16. Operational Tools

### 16.1 Database Explorer (Read-Only)

```
┌──────────────────────────────────────────────────────────────────┐
│  Database Explorer (READ-ONLY)                                    │
│                                                                   │
│  ⚠️ All queries are audit-logged. No write operations allowed.   │
│                                                                   │
│  Query: [SELECT * FROM stores WHERE status = 'published'        ]│
│         [LIMIT 10                                                ]│
│                                                                   │
│  [▶ Run Query]   Timeout: 10s   Max rows: 1000                  │
│                                                                   │
│  Results (892 rows, showing first 10):                           │
│  ┌──────┬──────────────┬──────────┬────────────┬──────────┐     │
│  │ id   │ name         │ status   │ plan       │ created  │     │
│  │ ab12 │ Fashion Hub  │ published│ business   │ Jan 15   │     │
│  │ cd34 │ Tech Reviews │ published│ starter    │ Jan 22   │     │
│  │ ...  │ ...          │ ...      │ ...        │ ...      │     │
│  └──────┴──────────────┴──────────┴────────────┴──────────┘     │
│                                                                   │
│  [⬇ Export CSV]   [📋 Copy]   [📊 Visualize]                    │
└──────────────────────────────────────────────────────────────────┘
```

**Safety constraints:**

- Only `SELECT` statements allowed (server-side SQL parser validates)
- Query timeout: 10 seconds max
- Result limit: 1,000 rows
- Sensitive columns masked: `password_hash`, payment tokens, API keys
- Every query logged to `audit_logs` with full SQL text

### 16.2 System Tools Overview

| Tool | Description | Permission | Details |
|---|---|---|---|
| **Database explorer** | Read-only Supabase SQL console | `system.db` | Query with safety constraints |
| **Worker logs** | Cloudflare Workers real-time log viewer | `system.logs` | Filter by worker, status, latency |
| **Cache management** | CDN + Redis cache inspector & invalidator | `system.cache` | View cache entries, flush by pattern |
| **Email previews** | Preview transactional email templates | `system.logs` | With test data injection |
| **API playground** | Test API endpoints with auth context | `system.db` | Based on Swagger/OpenAPI spec |
| **Deployment status** | Vercel + Cloudflare deployment history | `system.logs` | Build logs, rollback option |
| **Health checks** | Service status with dependency graph | `system.logs` | Supabase, Redis, R2, Razorpay health |
| **DNS manager** | View/manage Cloudflare DNS records | `system.cache` | Store subdomain + custom domain records |
| **Cron monitor** | View scheduled task execution history | `system.logs` | Weekly reports, cleanups, sync jobs |

### 16.3 Cache Management

```
┌──────────────────────────────────────────────────────────────────┐
│  Cache Management                                                 │
│                                                                   │
│  CDN CACHE (Cloudflare)                                          │
│  ┌──────────────┬──────────┬───────────────────────────────┐    │
│  │ Zone         │ Hit Rate │ Actions                        │    │
│  │ letbuyy.store│ 94.2%    │ [Purge All] [Purge by URL]    │    │
│  │ *.letbuyy.st │ 89.7%    │ [Purge All] [Purge by Tag]    │    │
│  └──────────────┴──────────┴───────────────────────────────┘    │
│                                                                   │
│  REDIS CACHE (Upstash)                                           │
│  ┌──────────────┬──────────┬───────────────────────────────┐    │
│  │ Namespace    │ Keys     │ Actions                        │    │
│  │ ai_cache:*   │ 12,456   │ [Flush] [Browse]              │    │
│  │ session:*    │ 3,201    │ [Browse]                       │    │
│  │ rate_limit:* │ 892      │ [Flush]                        │    │
│  │ flag:*       │ 42       │ [Browse]                       │    │
│  │ store_cfg:*  │ 1,247    │ [Flush] [Browse]              │    │
│  └──────────────┴──────────┴───────────────────────────────┘    │
│                                                                   │
│  Total Redis memory: 128 MB / 256 MB (50%)                       │
└──────────────────────────────────────────────────────────────────┘
```

---

## 17. Maintenance & Incident Management

### 17.1 Maintenance Mode

```
┌──────────────────────────────────────────────────────────────────┐
│  Maintenance Mode                            Status: 🟢 NORMAL   │
│                                                                   │
│  MODE                                                            │
│  ○ Normal operations (current)                                   │
│  ○ Full maintenance (all services offline)                       │
│  ○ API-only maintenance (storefronts online, admin/API offline)  │
│  ○ Read-only mode (no writes — browsing OK, no purchases)       │
│  ○ Degraded mode (non-critical features disabled)                │
│                                                                   │
│  CONFIGURATION                                                    │
│  Custom message: [We're upgrading for a better experience.     ]│
│  Scheduled start: [2026-02-15] [03:00 IST]                      │
│  Expected duration: [45] minutes                                 │
│  Show countdown on storefront: [✅ Yes]                          │
│  Notify store owners via email: [✅ Yes]                         │
│  Auto-end after duration: [✅ Yes]                               │
│                                                                   │
│  [Schedule Maintenance]  [Activate Now]  [Cancel]                │
└──────────────────────────────────────────────────────────────────┘
```

### 17.2 Maintenance Modes Behavior

| Mode | Storefronts | Admin Dashboard | API | Database |
|---|---|---|---|---|
| **Full maintenance** | Maintenance page | Maintenance page | 503 response | Read/Write |
| **API-only maintenance** | ✅ Live (cached) | Maintenance page | 503 response | Read-only |
| **Read-only** | ✅ Live | ✅ Live (view-only) | GET only | Read-only |
| **Degraded** | ✅ Live | ✅ Live | ✅ Live | Read/Write |
| **Normal** | ✅ Live | ✅ Live | ✅ Live | Read/Write |

**Degraded mode** disables: AI features, image processing, email sending, webhooks — keeping core commerce operational.

### 17.3 Incident Management

```
Incident Detected (manual or automated alert)
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  1. IDENTIFY — What's happening?                              │
│     ├── Automated: error rate spike, latency jump, downtime   │
│     └── Manual: team member reports an issue                  │
│                                                                │
│  Severity Classification:                                      │
│  ├── SEV-1 (Critical): Full outage, data loss risk            │
│  ├── SEV-2 (Major): Partial outage, significant feature down  │
│  ├── SEV-3 (Minor): Degraded performance, workaround exists   │
│  └── SEV-4 (Low): Cosmetic issue, no business impact          │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  2. COMMUNICATE — Notify stakeholders                         │
│     ├── SEV-1/2: Status page update + Slack + Email to owners │
│     ├── SEV-3: Slack notification + Console alert              │
│     └── SEV-4: Internal tracking only                          │
│                                                                │
│  Status page states: Investigating → Identified → Monitoring  │
│                      → Resolved                                │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  3. MITIGATE — Stop the bleeding                              │
│     ├── Activate maintenance mode (if needed)                 │
│     ├── Roll back deployment (Vercel instant rollback)         │
│     ├── Flush cache (if cache-related)                         │
│     ├── Scale up resources (Cloudflare Workers: auto-scales)   │
│     └── Redirect traffic / disable affected routes             │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  4. RESOLVE — Fix the root cause                              │
│     ├── Deploy hotfix                                          │
│     ├── Verify fix with monitoring                             │
│     └── Deactivate maintenance mode                            │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────┐
│  5. POST-MORTEM — Learn and prevent                           │
│     ├── Timeline of events                                    │
│     ├── Root cause analysis (5 Whys)                          │
│     ├── What went well / what didn't                          │
│     ├── Action items with owners and deadlines                │
│     └── Documentation update                                  │
└──────────────────────────────────────────────────────────────┘
```

### 17.4 Deployment & Rollback

| Provider | Deployment | Rollback | Time |
|---|---|---|---|
| **Vercel** (Next.js apps) | Git push → auto-deploy | Instant (previous deployment) | < 1 min |
| **Cloudflare Workers** (API) | Wrangler deploy | Previous version rollback | < 30 sec |
| **Supabase** (DB migrations) | SQL migration files | Reverse migration script | Manual |
| **Cloudflare R2** (assets) | Direct upload | No rollback (immutable) | — |

---

## 18. Flutter Super-Admin App

### 18.1 App Overview

The Flutter super-admin app provides on-the-go access to critical platform operations.

```
┌─────────────────────────────────────────┐
│  LetBuyy Console                        │
│  ─────────────────────────────          │
│                                          │
│  ┌───────────────────────────────┐      │
│  │     Platform Health           │      │
│  │     🟢 All systems normal      │      │
│  └───────────────────────────────┘      │
│                                          │
│  ┌─────────┐  ┌─────────┐              │
│  │ Stores  │  │ Revenue │              │
│  │ 1,247   │  │ ₹12.5L  │              │
│  │ ↑5%     │  │ ↑18%    │              │
│  └─────────┘  └─────────┘              │
│  ┌─────────┐  ┌─────────┐              │
│  │ Tickets │  │ Mod Q   │              │
│  │ 🔴 2    │  │ 🟡 3    │              │
│  └─────────┘  └─────────┘              │
│                                          │
│  RECENT ALERTS                           │
│  ├ 🔴 Critical ticket: Payments down    │
│  ├ 🟡 Content flagged: pharma-deals     │
│  └ 🔵 Weekly report ready               │
│                                          │
│  ──────────────────────────────         │
│  [📊] [🏪] [🎫] [🛡️] [⚙️]            │
│   Home  Store Tix  Mod  Settings        │
└─────────────────────────────────────────┘
```

### 18.2 App Features Matrix

| Feature | Mobile App | Web Console | Notes |
|---|---|---|---|
| **Dashboard overview** | ✅ | ✅ | Simplified cards on mobile |
| **Store list & details** | ✅ | ✅ | Search + filters |
| **Suspend/unsuspend store** | ✅ | ✅ | With confirmation dialog |
| **Impersonate store** | — | ✅ only | Security: web-only |
| **Support tickets** | ✅ | ✅ | Reply + internal notes |
| **Moderation queue** | ✅ | ✅ | Approve/reject with swipe |
| **Analytics** | ✅ (summary) | ✅ (full) | Mobile shows key metrics |
| **Audit logs** | ✅ (read) | ✅ (full) | Recent logs only on mobile |
| **Feature flags** | — | ✅ only | Too complex for mobile |
| **Database explorer** | — | ✅ only | Requires keyboard |
| **Cache management** | — | ✅ only | Technical tool |
| **Maintenance mode** | ✅ | ✅ | Emergency activate |
| **Push notifications** | ✅ (FCM) | — | Real-time alerts |
| **Biometric auth** | ✅ (Face/Touch ID) | — | Additional security |

### 18.3 App Architecture

```
Flutter Super-Admin App
├── lib/
│   ├── main.dart                     # App entry point
│   ├── core/
│   │   ├── api/
│   │   │   ├── api_client.dart       # HTTP client (Dio)
│   │   │   ├── interceptors.dart     # Auth token, error handling
│   │   │   └── endpoints.dart        # API endpoint definitions
│   │   ├── auth/
│   │   │   ├── auth_service.dart     # Supabase Auth integration
│   │   │   ├── biometric_service.dart # Face/Touch ID
│   │   │   └── totp_service.dart     # 2FA TOTP verification
│   │   ├── notifications/
│   │   │   └── fcm_service.dart      # Firebase Cloud Messaging
│   │   └── theme/
│   │       └── app_theme.dart        # Dark/light theme
│   ├── features/
│   │   ├── dashboard/                # Overview + metrics
│   │   ├── stores/                   # Store management
│   │   ├── tickets/                  # Support ticket management
│   │   ├── moderation/               # Content moderation
│   │   ├── analytics/                # Platform analytics
│   │   └── settings/                 # App settings + account
│   └── shared/
│       ├── widgets/                  # Reusable UI components
│       └── models/                   # Data models
├── pubspec.yaml
└── firebase_options.dart
```

---

## 19. Compliance & Data Governance

### 19.1 GDPR / Privacy Compliance

| Requirement | Implementation |
|---|---|
| **Right to access** | Users can export all their data (JSON) from account settings |
| **Right to deletion** | Users can request account deletion (30-day grace period) |
| **Data portability** | Full store data export (products, orders, customers, pages) |
| **Consent management** | Cookie consent banner on storefronts (configurable) |
| **Data minimization** | Only collect necessary data; no IP storage in analytics |
| **Privacy by design** | Data isolated per store; no cross-store data access |
| **Breach notification** | Automated alert if data breach detected (< 72 hours) |
| **Data retention** | Configurable per data type; auto-purge after period |

### 19.2 Admin Data Export (GDPR Response)

```typescript
// apps/api/src/routes/super-admin/gdpr.ts
superAdminRouter.post('/gdpr/export/:userId', async (c) => {
  const userId = c.req.param('userId');

  // Gather all user data across tables
  const exportData = {
    profile: await fetchUserProfile(userId),
    stores: await fetchUserStores(userId),
    orders: await fetchUserOrders(userId),
    products: await fetchUserProducts(userId),
    customers: await fetchUserCustomers(userId),
    ai_usage: await fetchUserAIUsage(userId),
    login_history: await fetchLoginHistory(userId),
    support_tickets: await fetchUserTickets(userId),
  };

  // Generate downloadable JSON file
  const filename = `gdpr-export-${userId}-${Date.now()}.json`;
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });

  // Upload to R2 (temporary — 7-day expiry)
  await uploadToR2(`exports/${filename}`, blob, { expiresIn: 7 * 24 * 3600 });

  // Log audit event
  await logAuditEvent(c, {
    actor_id: c.get('superAdmin').id,
    action: 'USER_DATA_EXPORTED',
    resource_type: 'user',
    resource_id: userId,
    severity: 'warning',
  });

  return c.json({ 
    success: true, 
    download_url: `https://r2.letbuyy.store/exports/${filename}`,
    expires_in: '7 days',
  });
});
```

### 19.3 Data Retention Policies

| Data Type | Active | After Deletion | Archive |
|---|---|---|---|
| **User profiles** | Indefinite | 30 days grace → purge | — |
| **Store data** | Indefinite | 30 days grace → purge | — |
| **Orders** | 3 years (tax requirement) | 30 days grace → archive | R2 cold storage |
| **Products** | While store active | 30 days grace → purge | — |
| **Analytics events** | 2 years | Anonymized immediately | — |
| **Audit logs (info)** | 90 days | Retained as-is | R2 archive |
| **Audit logs (critical)** | 5 years | Retained as-is | R2 archive |
| **Support tickets** | 2 years | Anonymized immediately | — |
| **AI usage logs** | 1 year | Purge | — |
| **Session data** | 30 days | Purge immediately | — |
| **Login history** | 1 year | Anonymized immediately | — |

### 19.4 Platform Policies (Configurable)

| Policy | Default | Configurable |
|---|---|---|
| **Terms of Service** | Standard LetBuyy ToS | Yes — URL in platform settings |
| **Privacy Policy** | Standard LetBuyy privacy policy | Yes — URL in platform settings |
| **Acceptable Use Policy** | Prohibited items list | Yes — moderation rules |
| **Refund Policy** | Store-level configuration | Store owners set their own |
| **Cookie Policy** | Standard EU cookie notice | Yes — toggle + customization |
| **DMCA / Copyright** | Takedown request process via support tickets | — |

---

## 20. Document History

| Version | Date | Changes |
|---|---|---|
| 6.0 | Feb 15, 2026 | Major expansion — 20 sections, console architecture (auth middleware), store lifecycle diagram, impersonation implementation, permission matrix (28-row), moderation AI pipeline (3-stage), platform analytics with AI reports, revenue & billing ops, support system (4-stage with AI triage, SLA config), audit logging (28 actions, retention policy), security & fraud detection (10 vectors, IP intelligence), feature flags (6 scoping types, TypeScript), notification system (15 alert types, Slack webhook), operational tools (DB explorer, cache UI), maintenance & incident management (5 modes, 5-step incident process), Flutter super-admin app (architecture, feature matrix), GDPR compliance (data export, retention policies) |
| 5.0 | Feb 14, 2026 | Initial version — 7 sections, basic console dashboard, role hierarchy, moderation queue, platform analytics, support ticket flow, security dashboard, operational tools |

---

> **Next:** [12 Implementation Roadmap](./12_Implementation_Roadmap.md) — Phased development plan, milestones, and deployment

---

*[← Back to Index](./README.md)*
