# LetBuyy Platform — Admin Dashboard

> **Doc 04 of 12** | Store Builder UI, Dynamic Navigation, Site-Type Dashboard Variants & Admin UX
>
> **Version:** 6.0 | **Date:** February 14, 2026
>
> **Prev:** [03 Onboarding & Trial](./03_Onboarding_and_Trial.md) | **Next:** [05 E-commerce Engine](./05_Ecommerce_Engine.md)

---

## Table of Contents

1. [Dashboard Architecture](#1-dashboard-architecture)
2. [Dynamic Navigation](#2-dynamic-navigation)
3. [Common Dashboard Components](#3-common-dashboard-components)
4. [E-Commerce Dashboard](#4-e-commerce-dashboard)
5. [Portfolio Dashboard](#5-portfolio-dashboard)
6. [Resume Dashboard](#6-resume-dashboard)
7. [Blog Dashboard](#7-blog-dashboard)
8. [Landing Page Dashboard](#8-landing-page-dashboard)
9. [Pages & Design Builder](#9-pages--design-builder)
10. [Settings Panel](#10-settings-panel)
11. [AI Studio](#11-ai-studio)
12. [Analytics Dashboard](#12-analytics-dashboard)
13. [Notification Center](#13-notification-center)
14. [Real-time Features](#14-real-time-features)
15. [Command Palette (⌘K)](#15-command-palette-k)
16. [Keyboard Shortcuts](#16-keyboard-shortcuts)
17. [Mobile Admin Experience](#17-mobile-admin-experience)
18. [Dark Mode & Theming](#18-dark-mode--theming)
19. [Performance Optimization](#19-performance-optimization)
20. [Accessibility](#20-accessibility)
21. [Testing Strategy](#21-testing-strategy)
22. [Document History](#22-document-history)

---

## 1. Dashboard Architecture

> **Cross-ref:** [01_Architecture §17 — Adaptive UI Engine](./01_Architecture.md) | [00_Overview §7 — Admin Panel](./00_Overview.md)

### 1.1 Layout Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│ admin.letbuyy.store/{store}/dashboard                                │
├──────────┬───────────────────────────────────────────────────────────┤
│          │  ┌─ Trial Banner (if on trial) ──────────────────────┐   │
│ SIDEBAR  │  │ ⏰ 12 days left in trial          [Choose Plan →] │   │
│ (240px)  │  └──────────────────────────────────────────────────┘   │
│          │                                                          │
│ ┌──────┐ │  ┌─ Header Bar ─────────────────────────────────────┐   │
│ │ Logo │ │  │ Store Name  [🔍 ⌘K]  [🔔 3]  [🌙]  [👤 ▼]     │   │
│ │      │ │  └──────────────────────────────────────────────────┘   │
│ │ 🏠   │ │                                                          │
│ │ 📦   │ │  ┌─ Breadcrumb ────────────────────────────────────┐    │
│ │ 🛒   │ │  │ Dashboard > Products > Edit "Summer Dress"      │    │
│ │ 📄   │ │  └─────────────────────────────────────────────────┘    │
│ │ 🤖   │ │                                                          │
│ │ 📈   │ │  ┌─ Main Content Area ─────────────────────────────┐    │
│ │ ⚙️   │ │  │                                                  │    │
│ │      │ │  │  Content changes per route + site type            │    │
│ │ ──── │ │  │  (See sections 4-8 for site-type variants)       │    │
│ │ 🌐   │ │  │                                                  │    │
│ │ 📊   │ │  └──────────────────────────────────────────────────┘    │
│ └──────┘ │                                                          │
└──────────┴──────────────────────────────────────────────────────────┘
```

### 1.2 Route Structure

```
admin.letbuyy.store/{subdomain}/
├── dashboard          → Site-type-specific overview (§4-8)
├── products/          → Product CRUD (store only)
├── orders/            → Order management (store only)
├── inventory/         → Stock tracking (store only)
├── coupons/           → Discount codes (store only)
├── shipping/          → Shipping zones (store only)
├── customers/         → Customer list (store only)
├── projects/          → Project gallery (portfolio only)
├── gallery/           → Image gallery (portfolio only)
├── skills/            → Skills manager (portfolio + resume)
├── education/         → Education entries (portfolio + resume)
├── testimonials/      → Client testimonials (portfolio only)
├── contact/           → Contact form config (portfolio only)
├── experience/        → Work experience (resume only)
├── certifications/    → Certifications (resume only)
├── export/            → PDF export (resume only)
├── ats-score/         → ATS analysis (resume only)
├── posts/             → Blog post CMS (blog only)
├── categories/        → Post categories (blog only)
├── tags/              → Post tags (blog only)
├── comments/          → Comment moderation (blog only)
├── media/             → Media library (blog only)
├── subscribers/       → Email subscribers (blog only)
├── sections/          → Page sections (landing only)
├── forms/             → Form builder (landing only)
├── cta/               → CTA builder (landing only)
├── ab-tests/          → A/B testing (landing only)
├── pages/             → Page builder — Craft.js (all types)
├── ai-studio/         → AI tools (all types)
├── analytics/         → Analytics dashboard (all types)
├── settings/          → Store settings (all types)
│   ├── general
│   ├── domain
│   ├── theme
│   ├── seo
│   ├── notifications
│   ├── payment        → (store only)
│   ├── shipping       → (store only)
│   ├── ai
│   ├── billing
│   ├── legal
│   └── danger-zone
└── billing/           → Plan & subscription (all types)
```

### 1.3 Store Context Provider

> **Source:** [01_Architecture §17.1](./01_Architecture.md)

```typescript
// apps/web/admin/providers/StoreProvider.tsx

'use client';

import { createContext, useContext } from 'react';

interface StoreContext {
  store: {
    id: string;
    subdomain: string;
    store_name: string;
    site_type: 'store' | 'blog' | 'portfolio' | 'resume' | 'landing';
    status: 'draft' | 'published' | 'frozen' | 'cancelled';
    trial_status: 'active' | 'grace' | 'frozen' | 'cancelled' | 'paid';
    trial_ends_at: string | null;
    plan_slug: string | null;
    template_id: string | null;
    published_at: string | null;
  };
  permissions: {
    canEdit: boolean;
    canPublish: boolean;
    canManageBilling: boolean;
    canManageTeam: boolean;
    role: 'owner' | 'admin' | 'editor' | 'viewer';
  };
}

const StoreCtx = createContext<StoreContext | null>(null);

export function useStore() {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export function StoreProvider({
  children, store, permissions,
}: StoreContext & { children: React.ReactNode }) {
  return (
    <StoreCtx.Provider value={{ store, permissions }}>
      {children}
    </StoreCtx.Provider>
  );
}
```

### 1.4 Store Context Middleware (Server-Side)

```typescript
// apps/web/admin/middleware.ts

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  const subdomain = req.nextUrl.pathname.split('/')[1];
  if (!subdomain) return NextResponse.redirect(new URL('/login', req.url));

  const supabase = createServerClient(/* env config */);
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      `https://accounts.letbuyy.store/login?redirect=${req.url}`
    );
  }

  // Fetch store + verify ownership
  const { data: store } = await supabase
    .from('stores')
    .select('*, team_members!left(role)')
    .eq('subdomain', subdomain)
    .or(`user_id.eq.${user.id},team_members.user_id.eq.${user.id}`)
    .single();

  if (!store) return NextResponse.redirect(new URL('/not-found', req.url));

  // Frozen → force billing page
  if (store.trial_status === 'frozen' && !req.nextUrl.pathname.endsWith('/billing')) {
    return NextResponse.redirect(new URL(`/${subdomain}/billing`, req.url));
  }

  // Inject store context into headers for server components
  const res = NextResponse.next();
  res.headers.set('x-store-id', store.id);
  res.headers.set('x-site-type', store.site_type);
  res.headers.set('x-store-status', store.status);
  res.headers.set('x-trial-status', store.trial_status);
  return res;
}

export const config = {
  matcher: ['/((?!_next|api|favicon.ico).*)'],
};
```

### 1.5 Admin Layout Component

```typescript
// apps/web/admin/app/[store]/layout.tsx

import { StoreProvider } from '@/providers/StoreProvider';
import { Sidebar } from '@/components/Sidebar';
import { HeaderBar } from '@/components/HeaderBar';
import { TrialBanner } from '@/components/TrialBanner';
import { CommandPalette } from '@/components/CommandPalette';
import { NotificationProvider } from '@/providers/NotificationProvider';

export default async function AdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { store: string };
}) {
  const store = await getStoreBySubdomain(params.store);
  const permissions = await getPermissions(store.id);

  return (
    <StoreProvider store={store} permissions={permissions}>
      <NotificationProvider storeId={store.id}>
        <div className="flex h-screen bg-background">
          {/* Sidebar — 240px fixed */}
          <Sidebar siteType={store.site_type} subdomain={store.subdomain} />

          {/* Main Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <TrialBanner />
            <HeaderBar store={store} />
            <main className="flex-1 overflow-y-auto p-6">
              {children}
            </main>
          </div>

          {/* Global overlays */}
          <CommandPalette />
        </div>
      </NotificationProvider>
    </StoreProvider>
  );
}
```

---

## 2. Dynamic Navigation

> **Cross-ref:** [01_Architecture §17.2 — Sidebar Configuration](./01_Architecture.md) | [00_Overview §7.2 — Admin Sidebar](./00_Overview.md)

### 2.1 SidebarItem Type Definition

```typescript
// packages/types/src/admin.ts

export type SiteType = 'store' | 'blog' | 'portfolio' | 'resume' | 'landing';

export interface SidebarItem {
  icon: string;       // Lucide icon name
  label: string;      // Display text
  href: string;       // Route path (relative to /{store}/)
  badge?: number;     // Optional notification count badge
  isNew?: boolean;    // Show "NEW" badge
}

export type SidebarSeparator = '---separator---';
export type SidebarEntry = SidebarItem | SidebarSeparator;
```

### 2.2 Full SIDEBAR_CONFIG (All 5 Site Types)

> **Source:** [01_Architecture §17.2](./01_Architecture.md) — Complete sidebar configs

```typescript
// apps/web/admin/config/sidebar.ts

import { SidebarEntry, SiteType } from '@letbuyy/types';

export const SIDEBAR_CONFIG: Record<SiteType, SidebarEntry[]> = {
  store: [
    { icon: 'LayoutDashboard', label: 'Dashboard',  href: '/dashboard' },
    { icon: 'Package',         label: 'Products',   href: '/products' },
    { icon: 'ClipboardList',   label: 'Orders',     href: '/orders' },
    { icon: 'BarChart3',       label: 'Inventory',  href: '/inventory' },
    { icon: 'Ticket',          label: 'Coupons',    href: '/coupons' },
    { icon: 'Truck',           label: 'Shipping',   href: '/shipping' },
    { icon: 'Users',           label: 'Customers',  href: '/customers' },
    '---separator---',
    { icon: 'Globe',           label: 'Pages',      href: '/pages' },
    { icon: 'Bot',             label: 'AI Studio',  href: '/ai-studio' },
    { icon: 'TrendingUp',      label: 'Analytics',  href: '/analytics' },
    { icon: 'Settings',        label: 'Settings',   href: '/settings' },
  ],
  blog: [
    { icon: 'LayoutDashboard', label: 'Dashboard',      href: '/dashboard' },
    { icon: 'PenTool',         label: 'Posts',           href: '/posts' },
    { icon: 'FolderTree',      label: 'Categories',      href: '/categories' },
    { icon: 'Tags',            label: 'Tags',            href: '/tags' },
    { icon: 'MessageCircle',   label: 'Comments',        href: '/comments' },
    { icon: 'Image',           label: 'Media Library',   href: '/media' },
    { icon: 'Mail',            label: 'Subscribers',     href: '/subscribers' },
    '---separator---',
    { icon: 'Globe',           label: 'Pages',      href: '/pages' },
    { icon: 'Bot',             label: 'AI Studio',  href: '/ai-studio' },
    { icon: 'TrendingUp',      label: 'Analytics',  href: '/analytics' },
    { icon: 'Settings',        label: 'Settings',   href: '/settings' },
  ],
  portfolio: [
    { icon: 'LayoutDashboard', label: 'Dashboard',      href: '/dashboard' },
    { icon: 'Briefcase',       label: 'Projects',       href: '/projects' },
    { icon: 'Image',           label: 'Gallery',        href: '/gallery' },
    { icon: 'Award',           label: 'Skills',         href: '/skills' },
    { icon: 'GraduationCap',   label: 'Education',      href: '/education' },
    { icon: 'MessageSquare',   label: 'Testimonials',   href: '/testimonials' },
    { icon: 'Mail',            label: 'Contact Form',   href: '/contact' },
    '---separator---',
    { icon: 'Globe',           label: 'Pages',      href: '/pages' },
    { icon: 'Bot',             label: 'AI Studio',  href: '/ai-studio' },
    { icon: 'TrendingUp',      label: 'Analytics',  href: '/analytics' },
    { icon: 'Settings',        label: 'Settings',   href: '/settings' },
  ],
  resume: [
    { icon: 'LayoutDashboard', label: 'Dashboard',        href: '/dashboard' },
    { icon: 'Briefcase',       label: 'Experience',       href: '/experience' },
    { icon: 'Target',          label: 'Skills',           href: '/skills' },
    { icon: 'GraduationCap',   label: 'Education',        href: '/education' },
    { icon: 'Award',           label: 'Certifications',   href: '/certifications' },
    { icon: 'FileText',        label: 'PDF Export',       href: '/export' },
    { icon: 'Bot',             label: 'ATS Score',        href: '/ats-score' },
    '---separator---',
    { icon: 'Bot',             label: 'AI Studio',  href: '/ai-studio' },
    { icon: 'TrendingUp',      label: 'Analytics',  href: '/analytics' },
    { icon: 'Settings',        label: 'Settings',   href: '/settings' },
  ],
  landing: [
    { icon: 'LayoutDashboard', label: 'Dashboard',     href: '/dashboard' },
    { icon: 'Layers',          label: 'Sections',      href: '/sections' },
    { icon: 'FileInput',       label: 'Forms',         href: '/forms' },
    { icon: 'Target',          label: 'CTA Builder',   href: '/cta' },
    { icon: 'FlaskConical',    label: 'A/B Tests',     href: '/ab-tests', isNew: true },
    '---separator---',
    { icon: 'Globe',           label: 'Pages',      href: '/pages' },
    { icon: 'Bot',             label: 'AI Studio',  href: '/ai-studio' },
    { icon: 'TrendingUp',      label: 'Analytics',  href: '/analytics' },
    { icon: 'Settings',        label: 'Settings',   href: '/settings' },
  ],
};
```

### 2.3 Navigation by Site Type (Visual Reference)

> **Source:** [00_Overview §7.2](./00_Overview.md)

```
E-COMMERCE         PORTFOLIO          RESUME             BLOG               LANDING
──────────────     ──────────────     ──────────────     ──────────────     ──────────────
📊 Dashboard       📊 Dashboard       📊 Dashboard       📊 Dashboard       📊 Dashboard
📦 Products        🖼️ Projects        💼 Experience      📝 Posts           🧩 Sections
📋 Orders          🎨 Gallery         🎯 Skills          📁 Categories      📝 Forms
📊 Inventory       🏷️ Skills          🎓 Education       🏷️ Tags            🎯 CTA Builder
🎫 Coupons         🎓 Education       📜 Certifications  💬 Comments        🧪 A/B Tests
🚚 Shipping        💬 Testimonials    📄 PDF Export      🖼️ Media Library   ─── Common ───
👥 Customers       📬 Contact Form    🤖 ATS Score       📧 Subscribers     🌐 Pages
─── Common ───     ─── Common ───     ─── Common ───     ─── Common ───     🤖 AI Studio
🌐 Pages           🌐 Pages           🤖 AI Studio       🌐 Pages           📈 Analytics
🤖 AI Studio       🤖 AI Studio       📈 Analytics       🤖 AI Studio       ⚙️ Settings
📈 Analytics       📈 Analytics       ⚙️ Settings        📈 Analytics
⚙️ Settings        ⚙️ Settings                           ⚙️ Settings
```

### 2.4 Sidebar React Component

```typescript
// apps/web/admin/components/Sidebar.tsx

'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { SIDEBAR_CONFIG } from '@/config/sidebar';
import { SiteType } from '@letbuyy/types';
import * as Icons from 'lucide-react';
import Link from 'next/link';

interface SidebarProps {
  siteType: SiteType;
  subdomain: string;
}

export function Sidebar({ siteType, subdomain }: SidebarProps) {
  const pathname = usePathname();
  const items = SIDEBAR_CONFIG[siteType];

  return (
    <aside className="w-60 h-screen border-r border-border bg-sidebar flex flex-col">
      {/* Store Switcher */}
      <div className="p-4 border-b border-border">
        <StoreSwitcher currentSubdomain={subdomain} />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Admin navigation">
        {items.map((item, i) => {
          if (item === '---separator---') {
            return <hr key={`sep-${i}`} className="my-2 border-border" />;
          }

          const Icon = Icons[item.icon as keyof typeof Icons] as React.FC;
          const href = `/${subdomain}${item.href}`;
          const isActive = pathname === href || pathname.startsWith(href + '/');

          return (
            <Link
              key={item.href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {item.badge && item.badge > 0 && (
                <span className="ml-auto bg-destructive text-destructive-foreground text-xs font-bold rounded-full px-1.5 py-0.5">
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
              {item.isNew && (
                <span className="ml-auto bg-green-500 text-white text-[10px] font-bold rounded px-1.5 py-0.5">
                  NEW
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom — AI Credits */}
      <div className="p-4 border-t border-border">
        <AICreditsWidget />
      </div>
    </aside>
  );
}
```

### 2.5 Store Switcher Component

```typescript
// apps/web/admin/components/StoreSwitcher.tsx

'use client';

import { useRouter } from 'next/navigation';
import { useStore } from '@/providers/StoreProvider';

export function StoreSwitcher({ currentSubdomain }: { currentSubdomain: string }) {
  const router = useRouter();
  const { store } = useStore();
  const [stores, setStores] = useState<Store[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Fetch all user stores
    supabase.from('stores').select('id, subdomain, store_name, site_type, status')
      .then(({ data }) => setStores(data || []));
  }, []);

  const siteTypeIcons: Record<string, string> = {
    store: '🛒', blog: '📝', portfolio: '💼', resume: '📄', landing: '🚀',
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className="w-full justify-start gap-2">
          <span>{siteTypeIcons[store.site_type]}</span>
          <span className="truncate font-semibold">{store.store_name}</span>
          <ChevronsUpDown className="ml-auto w-4 h-4 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1">
        {stores.map((s) => (
          <button
            key={s.id}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent',
              s.subdomain === currentSubdomain && 'bg-accent'
            )}
            onClick={() => {
              router.push(`/${s.subdomain}/dashboard`);
              setOpen(false);
            }}
          >
            <span>{siteTypeIcons[s.site_type]}</span>
            <span className="truncate">{s.store_name}</span>
            {s.status === 'draft' && (
              <span className="ml-auto text-xs text-muted-foreground">Draft</span>
            )}
          </button>
        ))}
        <hr className="my-1" />
        <button
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-accent"
          onClick={() => router.push('/onboarding')}
        >
          <Plus className="w-4 h-4" />
          <span>Create New Store</span>
        </button>
      </PopoverContent>
    </Popover>
  );
}
```

---

## 3. Common Dashboard Components

> **Cross-ref:** [00_Overview §7 — Admin Panel Features](./00_Overview.md)

### 3.1 Header Bar

```typescript
// apps/web/admin/components/HeaderBar.tsx

'use client';

import { useTheme } from 'next-themes';
import { useStore } from '@/providers/StoreProvider';
import { useNotifications } from '@/providers/NotificationProvider';
import { useCommandPalette } from '@/stores/commandPaletteStore';

export function HeaderBar({ store }: { store: Store }) {
  const { theme, setTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const { open: openCommandPalette } = useCommandPalette();

  return (
    <header className="h-14 border-b border-border bg-background/95 backdrop-blur px-6 flex items-center justify-between">
      {/* Left: Store name + live link */}
      <div className="flex items-center gap-3">
        <h1 className="text-sm font-semibold">{store.store_name}</h1>
        {store.status === 'published' && (
          <a
            href={`https://${store.subdomain}.letbuyy.store`}
            target="_blank"
            rel="noopener"
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" /> Live
          </a>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Search / Command Palette */}
        <Button
          variant="outline" size="sm"
          onClick={openCommandPalette}
          className="hidden sm:flex items-center gap-2 text-muted-foreground"
        >
          <Search className="w-4 h-4" />
          <span className="text-xs">Search...</span>
          <kbd className="ml-2 text-[10px] bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
        </Button>

        {/* Notifications */}
        <NotificationBell count={unreadCount} />

        {/* Theme toggle */}
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>

        {/* User menu */}
        <UserDropdown />
      </div>
    </header>
  );
}
```

### 3.2 Quick Stats Row (Adaptive per Site Type)

> **Source:** [01_Architecture §17.3 — Dashboard Widget Mapping](./01_Architecture.md)

```typescript
// apps/web/admin/components/QuickStats.tsx

const STATS_CONFIG: Record<SiteType, StatCard[]> = {
  store: [
    { label: 'Revenue',   icon: 'DollarSign', query: 'total_revenue',      format: 'currency' },
    { label: 'Orders',    icon: 'ShoppingBag', query: 'order_count',       format: 'number' },
    { label: 'Customers', icon: 'Users',       query: 'customer_count',    format: 'number' },
    { label: 'Avg Order', icon: 'TrendingUp',  query: 'avg_order_value',   format: 'currency' },
  ],
  blog: [
    { label: 'Total Reads',  icon: 'Eye',          query: 'total_reads',      format: 'number' },
    { label: 'Posts',         icon: 'FileText',     query: 'post_count',       format: 'number' },
    { label: 'Subscribers',  icon: 'Mail',          query: 'subscriber_count', format: 'number' },
    { label: 'Avg Read Time', icon: 'Clock',        query: 'avg_read_time',    format: 'duration' },
  ],
  portfolio: [
    { label: 'Page Views',  icon: 'Eye',          query: 'page_views',        format: 'number' },
    { label: 'Projects',    icon: 'Briefcase',    query: 'project_count',     format: 'number' },
    { label: 'Inquiries',   icon: 'MessageSquare', query: 'inquiry_count',    format: 'number' },
    { label: 'Completion',  icon: 'CheckCircle',  query: 'profile_completion', format: 'percent' },
  ],
  resume: [
    { label: 'Profile Views', icon: 'Eye',        query: 'profile_views',    format: 'number' },
    { label: 'ATS Score',      icon: 'Target',     query: 'ats_score',        format: 'score' },
    { label: 'PDF Downloads',  icon: 'Download',   query: 'pdf_downloads',    format: 'number' },
    { label: 'Completion',     icon: 'CheckCircle', query: 'profile_completion', format: 'percent' },
  ],
  landing: [
    { label: 'Visitors',      icon: 'Eye',        query: 'visitor_count',    format: 'number' },
    { label: 'Conversions',   icon: 'Target',     query: 'conversion_count', format: 'number' },
    { label: 'Conv. Rate',    icon: 'Percent',    query: 'conversion_rate',  format: 'percent' },
    { label: 'Form Subs',     icon: 'FileInput',  query: 'form_submissions', format: 'number' },
  ],
};
```

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│  📊 Metric1 │  │  📈 Metric2 │  │  ⭐ Metric3 │  │  🤖 Metric4 │
│  1,247      │  │  +12.5%     │  │  4.8/5      │  │  23/50 cr   │
│  ↑ 8% MTD   │  │  vs last mo │  │  (42 items) │  │  this month │
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
```

### 3.3 Activity Feed Component

```typescript
// apps/web/admin/components/ActivityFeed.tsx

'use client';

import { useEffect, useState } from 'react';
import { useStore } from '@/providers/StoreProvider';
import { createBrowserClient } from '@supabase/ssr';

interface Activity {
  id: string;
  action: string;
  metadata: Record<string, any>;
  created_at: string;
}

const ACTION_ICONS: Record<string, { icon: string; color: string }> = {
  'order.created':     { icon: '🛒', color: 'bg-green-100 dark:bg-green-950' },
  'product.created':   { icon: '📦', color: 'bg-blue-100 dark:bg-blue-950' },
  'post.published':    { icon: '📝', color: 'bg-purple-100 dark:bg-purple-950' },
  'comment.new':       { icon: '💬', color: 'bg-amber-100 dark:bg-amber-950' },
  'ai.generated':      { icon: '🤖', color: 'bg-cyan-100 dark:bg-cyan-950' },
  'store.published':   { icon: '🚀', color: 'bg-emerald-100 dark:bg-emerald-950' },
  'low_stock':         { icon: '⚠️', color: 'bg-red-100 dark:bg-red-950' },
  'subscriber.new':    { icon: '📧', color: 'bg-pink-100 dark:bg-pink-950' },
};

export function ActivityFeed() {
  const { store } = useStore();
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    // Initial fetch
    fetchActivities(store.id).then(setActivities);

    // Realtime subscription
    const channel = supabase
      .channel(`activity:${store.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_logs',
        filter: `store_id=eq.${store.id}`,
      }, (payload) => {
        setActivities(prev => [payload.new as Activity, ...prev.slice(0, 19)]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [store.id]);

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Recent Activity</h3>
      {activities.map((activity) => {
        const config = ACTION_ICONS[activity.action] || { icon: '📋', color: 'bg-gray-100' };
        return (
          <div key={activity.id} className="flex items-start gap-3 text-sm">
            <span className={cn('w-8 h-8 rounded-full flex items-center justify-center text-xs', config.color)}>
              {config.icon}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-foreground">{formatAction(activity)}</p>
              <p className="text-xs text-muted-foreground">{timeAgo(activity.created_at)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

### 3.4 Breadcrumb Navigation

```typescript
// apps/web/admin/components/Breadcrumb.tsx

'use client';

import { usePathname } from 'next/navigation';
import { useStore } from '@/providers/StoreProvider';
import Link from 'next/link';

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard', products: 'Products', orders: 'Orders',
  inventory: 'Inventory', coupons: 'Coupons', shipping: 'Shipping',
  customers: 'Customers', posts: 'Posts', categories: 'Categories',
  tags: 'Tags', comments: 'Comments', media: 'Media Library',
  subscribers: 'Subscribers', projects: 'Projects', gallery: 'Gallery',
  skills: 'Skills', education: 'Education', testimonials: 'Testimonials',
  experience: 'Experience', certifications: 'Certifications',
  export: 'PDF Export', 'ats-score': 'ATS Score',
  sections: 'Sections', forms: 'Forms', cta: 'CTA Builder',
  'ab-tests': 'A/B Tests', pages: 'Pages', 'ai-studio': 'AI Studio',
  analytics: 'Analytics', settings: 'Settings', billing: 'Billing',
  new: 'New', edit: 'Edit',
};

export function Breadcrumb() {
  const pathname = usePathname();
  const { store } = useStore();
  const segments = pathname.split('/').filter(Boolean).slice(1); // skip subdomain

  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground mb-4">
      <ol className="flex items-center gap-1.5">
        {segments.map((segment, i) => {
          const label = ROUTE_LABELS[segment] || segment;
          const href = '/' + [store.subdomain, ...segments.slice(0, i + 1)].join('/');
          const isLast = i === segments.length - 1;

          return (
            <li key={href} className="flex items-center gap-1.5">
              {i > 0 && <ChevronRight className="w-3 h-3" />}
              {isLast ? (
                <span className="text-foreground font-medium">{label}</span>
              ) : (
                <Link href={href} className="hover:text-foreground transition-colors">{label}</Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
```

---

## 4. E-Commerce Dashboard

> **Cross-ref:** [05 E-commerce Engine](./05_Ecommerce_Engine.md) for detailed product/order management

### 4.1 Dashboard Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│  📊 E-Commerce Dashboard                    [Last 30 days ▼] │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ 💰 Rev   │  │ 📦 Orders│  │ 👥 Custs │  │ 📈 AOV   │     │
│  │ ₹1,24,500│  │   127    │  │    89    │  │  ₹980    │     │
│  │ ↑ 15% ▲  │  │ ↑ 8% ▲  │  │ ↑ 12% ▲ │  │ ↓ 3% ▼  │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                               │
│  ┌─ Revenue Chart (Recharts) ──────────────────────────────┐ │
│  │    ₹                                          ___/      │ │
│  │  20K│                              ___/──/──/─          │ │
│  │  15K│                    ___/──/──/─                     │ │
│  │  10K│          ___/──/──/─                               │ │
│  │   5K│___/──/──/─                                         │ │
│  │     └──────────────────────────────────────────────      │ │
│  │       Mon  Tue  Wed  Thu  Fri  Sat  Sun                  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ Recent Orders ──────────────┐  ┌─ Top Products ────────┐ │
│  │ #1001 ₹2,450 ✅ Confirmed   │  │ Summer Dress    42 sold│ │
│  │ #1000 ₹1,200 📦 Shipped     │  │ Cotton Shirt    38 sold│ │
│  │ #0999 ₹3,800 ⏳ Pending     │  │ Denim Jeans    31 sold│ │
│  │ #0998 ₹890  ✅ Delivered    │  │ Canvas Bag     28 sold│ │
│  │              [View All →]    │  │           [View All →] │ │
│  └──────────────────────────────┘  └────────────────────────┘ │
│                                                               │
│  ┌─ Low Stock Alerts (3) ──────┐  ┌─ AI Insights ──────────┐ │
│  │ ⚠️ Canvas Bag — 2 left      │  │ 💡 "Weekend sales are  │ │
│  │ ⚠️ Leather Belt — 5 left    │  │ 20% higher. Consider   │ │
│  │ ⚠️ Silk Scarf — 0 left      │  │ running promotions on  │ │
│  │              [Restock →]     │  │ Thursdays to capture   │ │
│  └──────────────────────────────┘  │ early buyers."         │ │
│                                    └────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 4.2 Dashboard Data Fetcher

```typescript
// apps/web/admin/app/[store]/dashboard/page.tsx (store type)

export default async function StoreDashboard({ params }: { params: { store: string } }) {
  const store = await getStoreContext(params.store);
  const [stats, recentOrders, topProducts, lowStock] = await Promise.all([
    fetchStoreStats(store.id, '30d'),
    fetchRecentOrders(store.id, 5),
    fetchTopProducts(store.id, 5),
    fetchLowStockProducts(store.id, 10),
  ]);

  return (
    <div className="space-y-6">
      <QuickStats stats={stats} siteType="store" />
      <RevenueChart storeId={store.id} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RecentOrdersTable orders={recentOrders} />
        <TopProductsList products={topProducts} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LowStockAlerts products={lowStock} />
        <AIInsightsCard storeId={store.id} siteType="store" />
      </div>
      <ActivityFeed />
    </div>
  );
}
```

### 4.3 Revenue Chart Component

```typescript
// apps/web/admin/components/charts/RevenueChart.tsx

'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useTheme } from 'next-themes';

interface RevenueChartProps {
  storeId: string;
  period?: '7d' | '30d' | '90d' | 'custom';
}

export function RevenueChart({ storeId, period = '30d' }: RevenueChartProps) {
  const { theme } = useTheme();
  const [data, setData] = useState<{ date: string; revenue: number; orders: number }[]>([]);

  useEffect(() => {
    fetch(`/api/analytics/revenue?storeId=${storeId}&period=${period}`)
      .then(res => res.json())
      .then(setData);
  }, [storeId, period]);

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold">Revenue</h3>
        <PeriodSelector value={period} onChange={setPeriod} />
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#333' : '#eee'} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#999" />
          <YAxis tickFormatter={(v) => `₹${v / 1000}K`} tick={{ fontSize: 12 }} stroke="#999" />
          <Tooltip
            formatter={(value: number) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
            contentStyle={{ background: theme === 'dark' ? '#1a1a1a' : '#fff', border: 'none', borderRadius: 8 }}
          />
          <Line type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

### 4.4 Orders Table (TanStack Table)

```typescript
// Column definition for the orders table
const orderColumns: ColumnDef<Order>[] = [
  { accessorKey: 'order_number', header: 'Order', cell: ({ row }) => `#${row.original.order_number}` },
  { accessorKey: 'customer_email', header: 'Customer' },
  { accessorKey: 'total', header: 'Total', cell: ({ row }) => formatCurrency(row.original.total) },
  {
    accessorKey: 'status', header: 'Status',
    cell: ({ row }) => (
      <Badge variant={ORDER_STATUS_VARIANTS[row.original.status]}>
        {row.original.status}
      </Badge>
    ),
  },
  { accessorKey: 'created_at', header: 'Date', cell: ({ row }) => timeAgo(row.original.created_at) },
  {
    id: 'actions', header: '',
    cell: ({ row }) => (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => viewOrder(row.original.id)}>View</DropdownMenuItem>
          <DropdownMenuItem onClick={() => updateStatus(row.original.id, 'shipped')}>Mark Shipped</DropdownMenuItem>
          <DropdownMenuItem onClick={() => printInvoice(row.original.id)}>Print Invoice</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];
```

---

## 5. Portfolio Dashboard

### 5.1 Dashboard Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│  💼 Portfolio Dashboard                      [Last 30 days ▼]│
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ 👁️ Views │  │ 💼 Projs │  │ 📩 Inquir│  │ ✅ Compl │     │
│  │  3,421   │  │    12    │  │    8     │  │   85%    │     │
│  │ ↑ 22% ▲  │  │ +2 new   │  │ 3 unread │  │ ↑ 5% ▲  │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                               │
│  ┌─ Featured Projects ─────────────────────────────────────┐ │
│  │ [Drag to reorder]                                        │ │
│  │ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                │ │
│  │ │ ≡ Img │ │ ≡ Img │ │ ≡ Img │ │ + Add │                │ │
│  │ │Project│ │Project│ │Project│ │ New   │                │ │
│  │ │  One  │ │  Two  │ │ Three │ │       │                │ │
│  │ └───────┘ └───────┘ └───────┘ └───────┘                │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ Recent Inquiries ──────────┐  ┌─ Traffic Sources ──────┐ │
│  │ ✉ John D. — "Interested in │  │ 🔵 Direct    45%       │ │
│  │   collaborating on..."      │  │ 🟢 Google    28%       │ │
│  │ ✉ Sarah M. — "Love your    │  │ 🟡 LinkedIn  15%       │ │
│  │   portfolio, pricing?"      │  │ 🟣 Twitter   8%        │ │
│  │          [Reply] [Archive]  │  │ ⚪ Other     4%        │ │
│  └─────────────────────────────┘  └─────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 5.2 Projects Management

```typescript
// apps/web/admin/app/[store]/projects/page.tsx

// Database schema reference
interface Project {
  id: string;
  store_id: string;
  title: string;
  slug: string;
  description: string;           // Rich text (Tiptap)
  short_description: string;     // Plain text, 160 chars
  images: string[];              // R2 URLs, first = cover
  tech_stack: string[];          // Technology tags
  category: string;              // "Web", "Mobile", "Design", etc.
  client_name: string | null;
  testimonial: string | null;
  live_url: string | null;
  github_url: string | null;
  featured: boolean;
  display_order: number;         // Drag-to-reorder
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
}

// Features:
// - Grid/list view toggle
// - Drag-to-reorder (display_order) using @dnd-kit/sortable
// - Multi-image gallery per project (up to 10 images)
// - AI-powered description improvement button (2 credits)
// - Client testimonial integration
// - Tags & categories for filtering
// - Bulk actions: publish, unpublish, delete
```

### 5.3 Drag-to-Reorder Implementation

```typescript
// apps/web/admin/components/ProjectGrid.tsx

import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable } from '@dnd-kit/sortable';

export function ProjectGrid({ projects }: { projects: Project[] }) {
  const [items, setItems] = useState(projects);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    // Persist new order to DB
    await fetch('/api/projects/reorder', {
      method: 'POST',
      body: JSON.stringify(reordered.map((p, i) => ({ id: p.id, display_order: i }))),
    });
  }

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(p => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map(project => (
            <SortableProjectCard key={project.id} project={project} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
```

### 5.4 Contact Form Submissions

```typescript
// Database schema
interface ContactSubmission {
  id: string;
  store_id: string;
  name: string;
  email: string;
  message: string;
  status: 'unread' | 'read' | 'replied' | 'archived';
  replied_at: string | null;
  created_at: string;
}

// API endpoint for fetching submissions
// GET /v1/stores/{storeId}/contact-submissions?status=unread&page=1&limit=20
```

---

## 6. Resume Dashboard

### 6.1 Dashboard Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│  📄 Resume Dashboard                                          │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ 👁️ Views │  │ 🎯 ATS  │  │ 📥 DLs  │  │ ✅ Compl │     │
│  │   892    │  │  87/100  │  │    34    │  │   92%    │     │
│  │ ↑ 18% ▲  │  │ "Good"   │  │ +5 today │  │ ↑ 8% ▲  │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                               │
│  ┌─ Live Resume Preview ───────────────────────────────────┐ │
│  │   ┌─────────────────────────────────────────┐           │ │
│  │   │  JOHN DOE                                │           │ │
│  │   │  Senior Software Engineer                │           │ │
│  │   │  john@example.com | +91 9876543210       │           │ │
│  │   │  ──────────────────────────────────────  │           │ │
│  │   │  EXPERIENCE                              │           │ │
│  │   │  • Lead Engineer at TechCorp (2022-now)  │           │ │
│  │   │  • Senior Dev at StartupX (2019-2022)    │           │ │
│  │   │  ...                                     │           │ │
│  │   └─────────────────────────────────────────┘           │ │
│  │   [Desktop] [Tablet] [Mobile] [Print Preview]           │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ ATS Optimization ─────────┐  ┌─ Download Analytics ───┐ │
│  │ Score: 87/100  [Improve →] │  │ This week: 12 ↑34%     │ │
│  │ ✅ Keywords: 15/20 matched │  │ Modern: 8 | Classic: 4 │ │
│  │ ⚠️ Missing: "Kubernetes"   │  │ Locations: IN, US, UK  │ │
│  │ ⚠️ Missing: "CI/CD"        │  │ Peak day: Wednesday    │ │
│  │ ✅ Formatting: ATS-ready   │  └─────────────────────────┘ │
│  └─────────────────────────────┘                              │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 ATS Score Analysis

```typescript
// workers/api/src/routes/ai/ats-score.ts

app.post('/v1/ai/ats-score', authMiddleware(), async (c) => {
  const { storeId, jobDescription } = await c.req.json();

  // Fetch resume data
  const { data: resume } = await supabase
    .from('stores')
    .select('*, experience(*), skills(*), education(*), certifications(*)')
    .eq('id', storeId)
    .eq('site_type', 'resume')
    .single();

  const prompt = `Analyze this resume against the job description.
    Return JSON: { score: number (0-100), matched_keywords: string[],
    missing_keywords: string[], suggestions: string[], formatting_score: number }
    
    Resume: ${JSON.stringify(resume)}
    Job Description: ${jobDescription}`;

  const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'user', content: prompt }],
  });

  // Deduct 3 credits (Gemini Pro-level task)
  await deductCredits(supabase, storeId, 3);

  return c.json(JSON.parse(response.response));
});
```

### 6.3 PDF Export Panel

```
┌─ PDF Export ──────────────────────────────────────────────────┐
│                                                                │
│  Template:  [Modern ▼]  [Classic]  [Minimal]  [Creative]      │
│                         [ATS-Optimized]                        │
│                                                                │
│  ┌─ Customization ─────┐  ┌─ Sections ────────────────────┐  │
│  │ Color:  [#6366f1]   │  │ ☑ Summary                     │  │
│  │ Font:   [Inter ▼]   │  │ ☑ Experience                  │  │
│  │ Pages:  [1-page ▼]  │  │ ☑ Education                   │  │
│  │ Margins: [Normal ▼] │  │ ☑ Skills                      │  │
│  │ Photo:  [Yes ▼]     │  │ ☑ Certifications              │  │
│  └──────────────────────┘  │ ☐ Volunteer                   │  │
│                             │ ☐ References                  │  │
│                             │ ☑ QR code to online profile   │  │
│                             └──────────────────────────────┘  │
│                                                                │
│  Saved Versions:                                               │
│  • tech_resume_v3.pdf — Last updated 2h ago                   │
│  • creative_resume.pdf — Last updated 5d ago                  │
│  • ats_resume.pdf — Last updated 1w ago                       │
│                                                                │
│  [📥 Download PDF]  [📧 Email PDF]  [🔗 Share Link]           │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. Blog Dashboard

> **Cross-ref:** [01_Architecture §17.2 — Blog Sidebar](./01_Architecture.md) | [00_Overview §7.2](./00_Overview.md)

> **Note:** This section documents the Blog site type, which is a fully-featured CMS with post editor (Tiptap), categories, tags, comments, media library, and email subscribers.

### 7.1 Dashboard Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│  📝 Blog Dashboard                          [Last 30 days ▼] │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ 👁️ Reads │  │ 📝 Posts │  │ 📧 Subs  │  │ ⏱ Avg   │     │
│  │  8,421   │  │    24    │  │   315    │  │  4.2min  │     │
│  │ ↑ 34% ▲  │  │ 3 drafts │  │ +12 new  │  │ ↑ 0.5m ▲│     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                               │
│  ┌─ Recent Posts ──────────────────────────────────────────┐ │
│  │ Status  │ Title              │ Category │ Views │ Date  │ │
│  │ 🟢 Live │ "10 Tips for..."   │ Tech     │ 1,203 │ 2d    │ │
│  │ 🟢 Live │ "How to build..."  │ Tutorial │  891  │ 5d    │ │
│  │ 🟡 Draft│ "Upcoming trends"  │ Opinion  │  —    │ 1d    │ │
│  │ 📅 Sched│ "Review of..."     │ Tech     │  —    │ +3d   │ │
│  │                                       [New Post →]       │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ Comment Queue (5) ─────────┐  ┌─ Subscriber Growth ───┐ │
│  │ 💬 Alex: "Great article!"   │  │    ___/──/──/──/──/    │ │
│  │    [Approve] [Spam] [Reply] │  │   /                    │ │
│  │ 💬 Bot: "Free Bitcoin..."   │  │  /    315 total        │ │
│  │    [Approve] [Spam] [Reply] │  │ /     +12 this month   │ │
│  └─────────────────────────────┘  └────────────────────────┘ │
│                                                               │
│  ┌─ AI Suggestions ───────────────────────────────────────┐  │
│  │ 💡 "Your 'Tutorial' posts get 3x more engagement.       │  │
│  │    Write more tutorials about React and TypeScript."     │  │
│  │                              [Generate Post Ideas →]     │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 7.2 Blog Post Editor (Tiptap)

> **Source:** [00_Overview §8.1](./00_Overview.md) — Tiptap 2.x ProseMirror-based editor

```typescript
// apps/web/admin/components/blog/PostEditor.tsx

'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Youtube from '@tiptap/extension-youtube';

interface PostEditorProps {
  content: string;
  onChange: (html: string) => void;
}

export function PostEditor({ content, onChange }: PostEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      Image.configure({ allowBase64: false }),
      Link.configure({ openOnClick: false }),
      CodeBlockLowlight.configure({ lowlight }),
      Placeholder.configure({ placeholder: 'Start writing your post...' }),
      TaskList, TaskItem,
      Youtube.configure({ inline: false }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose dark:prose-invert max-w-none focus:outline-none min-h-[400px] px-8 py-6',
      },
    },
  });

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <PostEditorToolbar editor={editor} />
      <EditorContent editor={editor} />
      <PostEditorFooter editor={editor} />
    </div>
  );
}
```

### 7.3 Blog Post Database Schema

```sql
-- Blog post table
CREATE TABLE blog_posts (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id     UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  slug         TEXT NOT NULL,
  excerpt      TEXT,                          -- Auto-generated or manual
  content      TEXT NOT NULL,                 -- HTML from Tiptap
  content_json JSONB,                         -- Tiptap JSON (for re-editing)
  cover_image  TEXT,                          -- R2 URL
  category_id  UUID REFERENCES blog_categories(id),
  author_name  TEXT,                          -- Override store owner name
  status       TEXT NOT NULL DEFAULT 'draft', -- draft, published, scheduled, archived
  scheduled_at TIMESTAMPTZ,                   -- For scheduled publishing
  published_at TIMESTAMPTZ,
  seo_title    TEXT,
  seo_description TEXT,
  og_image     TEXT,
  reading_time INT,                           -- Estimated minutes
  word_count   INT,
  featured     BOOLEAN DEFAULT false,
  allow_comments BOOLEAN DEFAULT true,
  view_count   INT DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(store_id, slug)
);

-- Enable RLS
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own store posts"
  ON blog_posts FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Blog categories
CREATE TABLE blog_categories (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id  UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  slug      TEXT NOT NULL,
  color     TEXT DEFAULT '#6366f1',
  parent_id UUID REFERENCES blog_categories(id),  -- Hierarchical
  post_count INT DEFAULT 0,
  UNIQUE(store_id, slug)
);

-- Blog tags (many-to-many)
CREATE TABLE blog_tags (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  slug     TEXT NOT NULL,
  UNIQUE(store_id, slug)
);

CREATE TABLE blog_post_tags (
  post_id UUID REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id  UUID REFERENCES blog_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, tag_id)
);

-- Blog comments (threaded, max depth 5)
CREATE TABLE blog_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES blog_comments(id),   -- Threaded replies
  author_name TEXT NOT NULL,
  author_email TEXT NOT NULL,
  content    TEXT NOT NULL,
  status     TEXT DEFAULT 'pending',  -- pending, approved, spam, deleted
  depth      INT DEFAULT 0,           -- Max 5
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email subscribers
CREATE TABLE blog_subscribers (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id  UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  email     TEXT NOT NULL,
  status    TEXT DEFAULT 'active',  -- active, unsubscribed
  source    TEXT DEFAULT 'form',    -- form, import, api
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(store_id, email)
);
```

### 7.4 Blog Post API Handler

```typescript
// workers/api/src/routes/blog/posts.ts

app.post('/v1/stores/:storeId/posts', authMiddleware(), trialCheckMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const body = await c.req.json();

  // Validate
  const validated = createPostSchema.parse(body);

  // Auto-generate slug
  const slug = validated.slug || slugify(validated.title);

  // Calculate reading time & word count
  const plainText = stripHtml(validated.content);
  const wordCount = plainText.split(/\s+/).length;
  const readingTime = Math.ceil(wordCount / 200); // 200 WPM

  // Auto-generate excerpt if not provided
  const excerpt = validated.excerpt || plainText.slice(0, 160) + '...';

  const { data: post, error } = await supabase
    .from('blog_posts')
    .insert({
      store_id: storeId,
      title: validated.title,
      slug,
      excerpt,
      content: DOMPurify.sanitize(validated.content), // XSS protection
      content_json: validated.contentJson,
      cover_image: validated.coverImage,
      category_id: validated.categoryId,
      status: validated.status || 'draft',
      scheduled_at: validated.scheduledAt,
      published_at: validated.status === 'published' ? new Date().toISOString() : null,
      seo_title: validated.seoTitle || validated.title,
      seo_description: validated.seoDescription || excerpt,
      reading_time: readingTime,
      word_count: wordCount,
      featured: validated.featured || false,
    })
    .select()
    .single();

  if (error) return c.json({ error: 'Failed to create post' }, 500);

  // Handle tags
  if (validated.tagIds?.length) {
    await supabase.from('blog_post_tags').insert(
      validated.tagIds.map((tagId: string) => ({ post_id: post.id, tag_id: tagId }))
    );
  }

  // If publishing, notify subscribers
  if (validated.status === 'published') {
    await queueSubscriberNotification(c.env, storeId, post);
  }

  // Trigger ISR revalidation
  if (validated.status === 'published') {
    await revalidateStorefront(c.env, storeId);
  }

  return c.json({ post }, 201);
});
```

### 7.5 Comment Moderation

```typescript
// Comment moderation actions
// PATCH /v1/stores/{storeId}/comments/{commentId}

app.patch('/v1/stores/:storeId/comments/:commentId', authMiddleware(), async (c) => {
  const { storeId, commentId } = c.req.param();
  const { status } = await c.req.json(); // 'approved' | 'spam' | 'deleted'

  await supabase
    .from('blog_comments')
    .update({ status })
    .eq('id', commentId)
    .eq('post_id', (await supabase.from('blog_posts').select('id').eq('store_id', storeId)).data?.map(p => p.id));

  // If spam, optionally block the IP
  if (status === 'spam') {
    const comment = await supabase.from('blog_comments').select('ip_address').eq('id', commentId).single();
    // Add to spam filter list
  }

  return c.json({ success: true });
});
```

### 7.6 Media Library

```
┌─ Media Library ──────────────────────────────────────────────┐
│  [Upload ↑]  [New Folder +]  View: [Grid ▣] [List ≡]        │
│  Storage: 1.2 GB / 5 GB                                      │
│                                                                │
│  📁 All Files  │  📁 Blog Posts  │  📁 Covers  │  📁 Other   │
│                                                                │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐           │
│  │ 🖼️  │ │ 🖼️  │ │ 🖼️  │ │ 🖼️  │ │ 🖼️  │ │ 🖼️  │           │
│  │photo1│ │hero  │ │cover │ │img04│ │logo  │ │banner│           │
│  │420KB │ │1.2MB │ │800KB │ │300KB│ │45KB  │ │650KB │           │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘           │
│                                                                │
│  Selected: hero.jpg (1.2 MB, 1920×1080)                       │
│  [Copy URL] [Edit Alt Text] [Optimize 🤖] [Delete]           │
└────────────────────────────────────────────────────────────────┘
```

---

## 8. Landing Page Dashboard

### 8.1 Dashboard Wireframe

```
┌──────────────────────────────────────────────────────────────┐
│  🚀 Landing Page Dashboard                  [Last 30 days ▼] │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │ 👁️ Visit │  │ 🎯 Conv  │  │ 📊 Rate  │  │ 📋 Forms │     │
│  │  5,892   │  │   312    │  │  5.3%    │  │   89     │     │
│  │ ↑ 28% ▲  │  │ ↑ 15% ▲ │  │ ↑ 0.8% ▲│  │ +12 new  │     │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘     │
│                                                               │
│  ┌─ Conversion Funnel ─────────────────────────────────────┐ │
│  │  Visitors ███████████████████████████████████ 5,892      │ │
│  │  Engaged  ████████████████████████           3,421      │ │
│  │  CTA Click █████████████                     1,203      │ │
│  │  Converted ████                                312      │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ Active A/B Tests ─────────┐  ┌─ Form Submissions ─────┐ │
│  │ 🧪 Hero CTA Copy           │  │ Latest: john@ex.com    │ │
│  │   A: "Get Started" — 4.2%  │  │ "Interested in your    │ │
│  │   B: "Try Free"    — 6.1%  │  │  service for our..."   │ │
│  │   Status: Running (Day 5)  │  │           [View All →]  │ │
│  │   [View Details] [End Test]│  └─────────────────────────┘ │
│  └─────────────────────────────┘                              │
└──────────────────────────────────────────────────────────────┘
```

### 8.2 A/B Testing System

```typescript
// Database schema for A/B tests
interface ABTest {
  id: string;
  store_id: string;
  name: string;
  element_type: 'cta_text' | 'cta_color' | 'hero_image' | 'headline' | 'section_order';
  variant_a: { value: string; views: number; conversions: number };
  variant_b: { value: string; views: number; conversions: number };
  status: 'draft' | 'running' | 'completed' | 'paused';
  winner: 'a' | 'b' | null;
  confidence: number;        // Statistical significance %
  started_at: string | null;
  ended_at: string | null;
  min_sample_size: number;   // Default: 100 per variant
}

// Visitor assignment (deterministic)
function getVariant(testId: string, visitorId: string): 'a' | 'b' {
  const hash = md5(`${testId}:${visitorId}`);
  return parseInt(hash.slice(0, 8), 16) % 2 === 0 ? 'a' : 'b';
}
```

### 8.3 CTA Builder

```
┌─ CTA Builder ────────────────────────────────────────────────┐
│                                                                │
│  ┌─ Preview ──────────────────────────────┐                   │
│  │                                         │                   │
│  │  ┌─────────────────────────────────┐   │                   │
│  │  │ 🚀 Get Started Free Today      │   │                   │
│  │  │    No credit card required      │   │                   │
│  │  │ [■■■■ Try Free ■■■■]           │   │                   │
│  │  └─────────────────────────────────┘   │                   │
│  │  [Desktop] [Mobile]                    │                   │
│  └─────────────────────────────────────────┘                   │
│                                                                │
│  Settings:                                                     │
│  Text:        [Try Free_____________]                          │
│  Sub-text:    [No credit card required]                        │
│  Color:       [#6366f1] ● ● ● ● ●                            │
│  Size:        [Large ▼]                                        │
│  URL:         [/signup______________]                          │
│  AI Optimize: [🤖 Suggest Better Copy] (1 credit)             │
└────────────────────────────────────────────────────────────────┘
```

---

## 9. Pages & Design Builder

> **Cross-ref:** [00_Overview §8.1 — Craft.js](./00_Overview.md)

### 9.1 Craft.js Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PAGE BUILDER ARCHITECTURE                      │
│                                                                   │
│  Craft.js Editor (React)                                         │
│  ├── Canvas (drag-drop area)                                     │
│  │   ├── Frame (root container)                                  │
│  │   │   ├── HeroBlock                                           │
│  │   │   ├── TextBlock                                           │
│  │   │   ├── ImageBlock                                          │
│  │   │   ├── GridBlock                                           │
│  │   │   ├── CTABlock                                            │
│  │   │   └── ...more blocks                                      │
│  │   └── Serializes to JSON → Supabase `pages.content_json`     │
│  │                                                                │
│  ├── Toolbox Panel (left)                                        │
│  │   └── Block Library (30+ blocks)                              │
│  │                                                                │
│  ├── Props Editor (right)                                        │
│  │   └── Component-specific settings panel                       │
│  │       (text, color, size, spacing, background, etc.)          │
│  │                                                                │
│  └── Toolbar (top)                                               │
│      ├── [Undo] [Redo]                                           │
│      ├── [Desktop] [Tablet] [Mobile] preview                    │
│      ├── [Save Draft] [Publish]                                  │
│      └── [🤖 AI Generate Section] (2 credits)                   │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 Block Library

```typescript
// apps/web/admin/components/builder/blocks/index.ts

export const BLOCK_LIBRARY = {
  layout: [
    { name: 'Container',     icon: 'Square',    description: 'Generic container' },
    { name: 'TwoColumn',     icon: 'Columns',   description: '50/50 split layout' },
    { name: 'ThreeColumn',   icon: 'Grid3x3',   description: '33/33/33 split' },
    { name: 'Section',       icon: 'Layers',    description: 'Full-width section' },
  ],
  content: [
    { name: 'Hero',          icon: 'Star',      description: 'Full-width hero banner' },
    { name: 'Text',          icon: 'Type',      description: 'Rich text block' },
    { name: 'Heading',       icon: 'Heading',   description: 'H1-H6 heading' },
    { name: 'Image',         icon: 'Image',     description: 'Single image w/ caption' },
    { name: 'ImageGallery',  icon: 'Images',    description: 'Multi-image gallery' },
    { name: 'Video',         icon: 'Play',      description: 'YouTube / Vimeo embed' },
    { name: 'Button',        icon: 'MousePointer', description: 'CTA button' },
    { name: 'Divider',       icon: 'Minus',     description: 'Horizontal divider' },
  ],
  interactive: [
    { name: 'Form',          icon: 'FileInput', description: 'Contact / lead form' },
    { name: 'Testimonials',  icon: 'Quote',     description: 'Client testimonials slider' },
    { name: 'FAQ',           icon: 'HelpCircle', description: 'Accordion FAQ' },
    { name: 'Pricing',       icon: 'DollarSign', description: 'Pricing table' },
    { name: 'Map',           icon: 'MapPin',    description: 'Google Maps embed' },
    { name: 'Countdown',     icon: 'Timer',     description: 'Countdown timer' },
    { name: 'SocialLinks',   icon: 'Share2',    description: 'Social media links' },
  ],
  ecommerce: [
    { name: 'ProductGrid',   icon: 'ShoppingBag', description: 'Product showcase grid' },
    { name: 'FeaturedProduct', icon: 'Star',     description: 'Single featured product' },
    { name: 'CategoryList',  icon: 'List',      description: 'Category browser' },
  ],
  ai: [
    { name: 'AISection',     icon: 'Sparkles',  description: 'Describe → AI generates (2 credits)' },
  ],
} as const;
```

### 9.3 AI Section Generator

```typescript
// workers/api/src/routes/ai/generate-section.ts

app.post('/v1/ai/generate-section', authMiddleware(), async (c) => {
  const { storeId, description, style } = await c.req.json();

  // Fetch store context for branding
  const { data: store } = await supabase
    .from('stores').select('store_name, site_type, store_surveys(*)').eq('id', storeId).single();

  const prompt = `Generate a Craft.js-compatible page section in JSON format.
    Store: ${store.store_name} (${store.site_type})
    User request: "${description}"
    Style: ${style || 'modern, clean'}
    Return a JSON object with blocks (type, props, children).`;

  const response = await c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [{ role: 'system', content: 'You are a web design AI.' }, { role: 'user', content: prompt }],
  });

  await deductCredits(supabase, storeId, 2);
  return c.json({ section: JSON.parse(response.response) });
});
```

---

## 10. Settings Panel

### 10.1 Settings Structure

```
Settings
├── General
│   ├── Store name
│   ├── Store description
│   ├── Logo upload (R2)
│   ├── Favicon upload (R2)
│   ├── Contact email
│   ├── Phone number
│   └── Social media links
│
├── Domain
│   ├── Subdomain: {name}.letbuyy.store (always active)
│   ├── Custom domain (paid plans only)
│   │   ├── Add domain → DNS instructions (CNAME)
│   │   ├── SSL provisioning status
│   │   └── Domain verification
│   └── Redirects manager
│
├── Theme
│   ├── Template selection (per site type)
│   ├── Color scheme editor
│   │   ├── Primary, secondary, accent colors
│   │   ├── Background, surface, text colors
│   │   └── [🤖 AI: Extract from logo] (1 credit)
│   ├── Typography (Google Fonts)
│   │   ├── Heading font
│   │   ├── Body font
│   │   └── Font sizes scale
│   └── Layout: max-width, spacing, border-radius
│
├── SEO
│   ├── Default meta title template
│   ├── Default meta description
│   ├── OG image (auto-generated or custom)
│   ├── robots.txt customization
│   ├── sitemap.xml (auto-generated)
│   ├── Structured data (JSON-LD)
│   └── [🤖 AI Generate All SEO] (1 credit)
│
├── Notifications
│   ├── Email alerts: new order, low stock, comment, etc.
│   ├── Push notification preferences
│   ├── In-app notification settings
│   └── Weekly digest: on/off
│
├── Payment (E-commerce only)
│   ├── Razorpay credentials (India)
│   ├── Stripe credentials (Global)
│   ├── Tax settings (rate, regions)
│   └── Currency: INR, USD, EUR, GBP
│
├── Shipping (E-commerce only)
│   ├── Shipping zones
│   ├── Flat rate / weight-based / free shipping rules
│   ├── Carrier integrations
│   └── Delivery time estimates
│
├── AI Settings
│   ├── Credits balance & usage chart
│   ├── Auto-generation toggles (SEO, descriptions)
│   ├── Preferred writing tone
│   └── Language preference
│
├── Billing
│   ├── Current plan details
│   ├── Plan comparison & upgrade
│   ├── Payment method management
│   ├── Invoice history
│   └── Cancel subscription
│
├── Legal
│   ├── Privacy policy (editable, AI template)
│   ├── Terms of service (editable, AI template)
│   ├── Refund policy (e-commerce)
│   └── Cookie consent banner settings
│
└── Danger Zone
    ├── Unpublish store (storefront goes offline)
    ├── Transfer ownership
    ├── Export all data (JSON/CSV)
    └── Delete store permanently (requires confirmation)
```

### 10.2 Settings TypeScript Types

```typescript
// packages/types/src/settings.ts

export interface StoreSettings {
  general: {
    store_name: string;
    description: string;
    logo_url: string | null;
    favicon_url: string | null;
    contact_email: string;
    phone: string | null;
    social_links: {
      instagram?: string;
      twitter?: string;
      linkedin?: string;
      github?: string;
      youtube?: string;
      tiktok?: string;
    };
  };
  theme: {
    template_id: string;
    colors: {
      primary: string;
      secondary: string;
      accent: string;
      background: string;
      surface: string;
      text: string;
      muted: string;
    };
    typography: {
      heading_font: string;    // e.g. "Inter"
      body_font: string;       // e.g. "Open Sans"
      base_size: number;       // e.g. 16
      scale_ratio: number;     // e.g. 1.25 (major third)
    };
    layout: {
      max_width: number;       // e.g. 1280
      border_radius: number;   // e.g. 8
      spacing_unit: number;    // e.g. 4
    };
  };
  seo: {
    title_template: string;    // e.g. "{page} — {store}"
    description: string;
    og_image: string | null;
    robots: string;            // e.g. "index, follow"
  };
  notifications: {
    email_new_order: boolean;
    email_low_stock: boolean;
    email_new_comment: boolean;
    email_new_subscriber: boolean;
    push_enabled: boolean;
    weekly_digest: boolean;
  };
}
```

---

## 11. AI Studio

> **Cross-ref:** [00_Overview §9 — AI Engine](./00_Overview.md) | [01_Architecture §18 — AI Content Generation](./01_Architecture.md)

### 11.1 AI Studio Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  🤖 AI Studio                                                 │
│                                                               │
│  ┌─ Credits ──────────┐  ┌─ Usage (30 days) ────────────────┐│
│  │ 🪙 37 / 50 credits │  │   ___/──/──\__/──/──/──/──/     ││
│  │ Plan: Starter       │  │  /                    48 calls   ││
│  │ Resets: Mar 1, 2026 │  │ /     Average: 1.6/day          ││
│  │ [Buy More Credits]  │  └──────────────────────────────────┘│
│  └─────────────────────┘                                      │
│                                                               │
│  ┌─ Quick Actions ─────────────────────────────────────────┐ │
│  │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐    │ │
│  │ │ ✏️ Write │ │ 🖼️ Image│ │ 🔍 SEO  │ │ 💡 Ideas │    │ │
│  │ │ Content  │ │ Enhance  │ │ Optimize │ │ Generate │    │ │
│  │ │ 1 credit │ │ 2 credit │ │ 1 credit │ │ 1 credit │    │ │
│  │ └──────────┘ └──────────┘ └──────────┘ └──────────┘    │ │
│  │ ┌──────────┐ ┌──────────┐                               │ │
│  │ │ 📊 Smart │ │ 📧 Email │                               │ │
│  │ │ Insights │ │ Template │                               │ │
│  │ │ 1 credit │ │ 1 credit │                               │ │
│  │ └──────────┘ └──────────┘                               │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ Model Breakdown ──────┐  ┌─ Recent Activity ──────────┐ │
│  │ ● Flash  68% (33 calls)│  │ 🤖 SEO meta — 2min ago     │ │
│  │ ● Pro    12% (6 calls) │  │ 🤖 Blog draft — 1hr ago    │ │
│  │ ● Sonnet 18% (9 calls) │  │ 🤖 Product desc — 3hr ago  │ │
│  │ ● Opus   2%  (1 call)  │  │ 🤖 Image opt — yesterday   │ │
│  └─────────────────────────┘  └────────────────────────────┘ │
│                                                               │
│  ┌─ Cost Forecast ────────────────────────────────────────┐  │
│  │ Projected monthly: $0.42 (of $0.50 included)            │  │
│  │ At current rate, credits will last until: Feb 28         │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### 11.2 AI Tools Configuration

```typescript
// apps/web/admin/config/ai-tools.ts

export const AI_TOOLS: Record<string, AITool> = {
  'write-content': {
    id: 'write-content',
    name: 'Write Content',
    icon: 'PenTool',
    description: 'Generate descriptions, bios, announcements',
    credits: 1,
    model: 'flash',          // Gemini 3 Flash
    inputFields: [
      { name: 'type', type: 'select', options: ['description', 'bio', 'announcement', 'tagline'] },
      { name: 'context', type: 'textarea', placeholder: 'Describe what you need...' },
      { name: 'tone', type: 'select', options: ['professional', 'casual', 'friendly', 'formal'] },
      { name: 'length', type: 'select', options: ['short', 'medium', 'long'] },
    ],
  },
  'image-enhance': {
    id: 'image-enhance',
    name: 'Image Enhance',
    icon: 'Image',
    description: 'Background removal, auto-crop, optimization',
    credits: 2,
    model: 'sonnet',
    inputFields: [
      { name: 'image', type: 'file', accept: 'image/*' },
      { name: 'action', type: 'select', options: ['remove-bg', 'auto-crop', 'optimize', 'resize'] },
    ],
  },
  'seo-optimize': {
    id: 'seo-optimize',
    name: 'SEO Optimize',
    icon: 'Search',
    description: 'Meta tags, alt text, structured data',
    credits: 1,
    model: 'flash',
    inputFields: [
      { name: 'page_url', type: 'text', placeholder: 'Which page to optimize?' },
      { name: 'target_keywords', type: 'text', placeholder: 'Target keywords (comma-separated)' },
    ],
  },
  'blog-draft': {
    id: 'blog-draft',
    name: 'Blog Post Draft',
    icon: 'FileText',
    description: 'Generate a full blog post draft',
    credits: 5,
    model: 'sonnet',        // Claude Sonnet 4.5
    inputFields: [
      { name: 'topic', type: 'text', placeholder: 'Blog post topic' },
      { name: 'tone', type: 'select', options: ['informative', 'tutorial', 'opinion', 'review'] },
      { name: 'length', type: 'select', options: ['500 words', '1000 words', '2000 words'] },
    ],
  },
};
```

### 11.3 Credit Management Zustand Store

```typescript
// apps/web/admin/stores/aiCreditsStore.ts

import { create } from 'zustand';

interface AICreditsState {
  planCredits: number;
  usedCredits: number;
  purchasedCredits: number;
  remainingCredits: number;
  resetDate: string;
  loading: boolean;
  fetch: (storeId: string) => Promise<void>;
  deduct: (amount: number) => void;
}

export const useAICreditsStore = create<AICreditsState>((set, get) => ({
  planCredits: 0, usedCredits: 0, purchasedCredits: 0, remainingCredits: 0,
  resetDate: '', loading: true,

  fetch: async (storeId) => {
    const res = await fetch(`/api/ai/credits?storeId=${storeId}`);
    const data = await res.json();
    set({
      planCredits: data.plan_credits,
      usedCredits: data.used_credits,
      purchasedCredits: data.purchased_credits,
      remainingCredits: data.plan_credits + data.purchased_credits - data.used_credits,
      resetDate: data.reset_date,
      loading: false,
    });
  },

  deduct: (amount) => {
    set(s => ({
      usedCredits: s.usedCredits + amount,
      remainingCredits: s.remainingCredits - amount,
    }));
  },
}));
```

---

## 12. Analytics Dashboard

> **Cross-ref:** [01_Architecture §15 — Edge Analytics Pipeline](./01_Architecture.md)

### 12.1 Common Analytics (All Site Types)

```
┌──────────────────────────────────────────────────────────────┐
│  📈 Analytics                  [Last 7d ▼] [Export CSV ↓]    │
│                                                               │
│  ┌─ Traffic Overview ──────────────────────────────────────┐ │
│  │  Total Visits     Unique Visitors    Bounce Rate         │ │
│  │    12,456            8,213            35.2%              │ │
│  │    ↑ 12.5%           ↑ 8.3%          ↓ 2.1% ✅         │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ┌─ Visitors Chart ───────────────────────────────────────┐  │
│  │   ___/──\__/──/──/──/──\__/──/──                       │  │
│  │  Unique ── Sessions ── Page Views ──                    │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Top Pages ────────┐  ┌─ Referrers ────────────────────┐ │
│  │ / (home)    3,421  │  │ 🔵 Google       45%            │ │
│  │ /products   1,203  │  │ 🟢 Direct       28%            │ │
│  │ /about        891  │  │ 🟡 Instagram    12%            │ │
│  │ /contact      456  │  │ 🟣 Twitter       8%            │ │
│  └────────────────────┘  │ ⚪ Other         7%            │ │
│                           └─────────────────────────────────┘ │
│                                                               │
│  ┌─ Device Breakdown ─┐  ┌─ Geography ────────────────────┐ │
│  │ 📱 Mobile  62%     │  │ 🇮🇳 India       68%             │ │
│  │ 💻 Desktop 31%     │  │ 🇺🇸 USA         12%             │ │
│  │ 📋 Tablet   7%     │  │ 🇬🇧 UK           5%             │ │
│  └─────────────────────┘  └─────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

### 12.2 Site-Type-Specific Analytics

```typescript
// apps/web/admin/config/analytics-widgets.ts

export const ANALYTICS_WIDGETS: Record<SiteType, AnalyticsWidget[]> = {
  store: [
    { id: 'revenue_chart', label: 'Revenue Over Time', type: 'line_chart' },
    { id: 'top_products', label: 'Top Selling Products', type: 'bar_chart' },
    { id: 'cart_abandonment', label: 'Cart Abandonment Rate', type: 'metric' },
    { id: 'customer_acquisition', label: 'Customer Acquisition', type: 'funnel' },
    { id: 'avg_order_value', label: 'Average Order Value', type: 'metric' },
  ],
  blog: [
    { id: 'post_performance', label: 'Post Performance', type: 'bar_chart' },
    { id: 'subscriber_growth', label: 'Subscriber Growth', type: 'line_chart' },
    { id: 'avg_read_time', label: 'Average Read Time', type: 'metric' },
    { id: 'top_categories', label: 'Top Categories', type: 'pie_chart' },
    { id: 'comment_rate', label: 'Comment Engagement Rate', type: 'metric' },
  ],
  portfolio: [
    { id: 'project_views', label: 'Project Views', type: 'bar_chart' },
    { id: 'inquiry_sources', label: 'Inquiry Sources', type: 'pie_chart' },
    { id: 'popular_projects', label: 'Most Viewed Projects', type: 'list' },
    { id: 'visitor_journey', label: 'Visitor Journey', type: 'funnel' },
  ],
  resume: [
    { id: 'view_history', label: 'Profile View History', type: 'line_chart' },
    { id: 'download_trend', label: 'PDF Download Trend', type: 'bar_chart' },
    { id: 'section_engagement', label: 'Section Engagement', type: 'heatmap' },
    { id: 'referral_sources', label: 'Where Viewers Came From', type: 'pie_chart' },
  ],
  landing: [
    { id: 'conversion_funnel', label: 'Conversion Funnel', type: 'funnel' },
    { id: 'cta_performance', label: 'CTA Click-Through Rate', type: 'bar_chart' },
    { id: 'ab_test_results', label: 'A/B Test Results', type: 'comparison' },
    { id: 'scroll_depth', label: 'Scroll Depth', type: 'heatmap' },
    { id: 'form_analytics', label: 'Form Submission Rate', type: 'metric' },
  ],
};
```

### 12.3 Analytics Data Collection (Edge Worker)

```typescript
// workers/analytics/src/index.ts  (Cloudflare Worker)

export default {
  async fetch(request: Request, env: Env) {
    const { pathname, searchParams } = new URL(request.url);
    if (pathname !== '/api/collect') return new Response('Not Found', { status: 404 });

    const body = await request.json<TrackingEvent>();

    // Batch write to KV (hot path — <5ms)
    const key = `event:${body.store_id}:${Date.now()}:${crypto.randomUUID().slice(0, 8)}`;
    await env.ANALYTICS_KV.put(key, JSON.stringify({
      store_id: body.store_id,
      event: body.event,         // 'page_view', 'cta_click', 'form_submit', etc.
      page: body.page,
      referrer: body.referrer || request.headers.get('referer'),
      user_agent: request.headers.get('user-agent'),
      country: request.cf?.country || 'unknown',
      device: parseDevice(request.headers.get('user-agent')),
      timestamp: new Date().toISOString(),
    }), { expirationTtl: 86400 * 7 }); // 7 days in KV

    // Queue for aggregation (Durable Object or Cron)
    await env.ANALYTICS_QUEUE.send({ key, storeId: body.store_id });

    return new Response('ok', {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
      },
    });
  },
};
```

---

## 13. Notification Center

> **Cross-ref:** [01_Architecture §18 — Notification & Event Bus](./01_Architecture.md)

### 13.1 Notification Types

```typescript
// packages/types/src/notifications.ts

export type NotificationType =
  // E-commerce
  | 'order.created' | 'order.paid' | 'order.shipped' | 'order.delivered'
  | 'order.cancelled' | 'order.refunded' | 'low_stock'
  // Blog
  | 'comment.new' | 'comment.reply' | 'subscriber.new' | 'post.published'
  // Portfolio
  | 'inquiry.new' | 'testimonial.new'
  // General
  | 'ai.completed' | 'trial.warning' | 'trial.expired'
  | 'payment.success' | 'payment.failed' | 'domain.verified'
  | 'store.published' | 'team.invite';

export interface Notification {
  id: string;
  store_id: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata: Record<string, any>;  // type-specific data
  read: boolean;
  action_url: string | null;      // click link
  created_at: string;
}
```

### 13.2 Notification Bell Component

```typescript
// apps/web/admin/components/NotificationBell.tsx

'use client';

import { useNotifications } from '@/providers/NotificationProvider';

export function NotificationBell({ count }: { count: number }) {
  const [open, setOpen] = useState(false);
  const { notifications, markAsRead, markAllRead } = useNotifications();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-4 h-4" />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
              {count > 9 ? '9+' : count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {count > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <div className="max-h-80 overflow-y-auto">
          {notifications.slice(0, 10).map((n) => (
            <NotificationItem key={n.id} notification={n} onRead={markAsRead} />
          ))}
        </div>
        <div className="p-2 border-t text-center">
          <a href="notifications" className="text-xs text-primary hover:underline">View all</a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### 13.3 Notification Database Schema

```sql
CREATE TABLE notifications (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id  UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type      TEXT NOT NULL,
  title     TEXT NOT NULL,
  body      TEXT,
  metadata  JSONB DEFAULT '{}',
  read      BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_store_unread ON notifications(store_id, read) WHERE read = false;

-- RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own notifications"
  ON notifications FOR SELECT
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
```

---

## 14. Real-time Features

> **Cross-ref:** [01_Architecture §14 — Supabase Realtime](./01_Architecture.md)

### 14.1 Real-time Architecture

```
┌────────────────────────────────────────────────────────────┐
│                SUPABASE REALTIME CHANNELS                   │
│                                                             │
│  Channel: store:{id}:orders                                 │
│  ├── INSERT on orders → toast: "New order #1001 — ₹2,450"  │
│  ├── UPDATE on orders → badge update on Orders nav item    │
│  └── Subscription: Admin dashboard + mobile app            │
│                                                             │
│  Channel: store:{id}:notifications                          │
│  ├── INSERT on notifications → NotificationBell count++    │
│  └── Subscription: Header component (global)               │
│                                                             │
│  Channel: store:{id}:activity                               │
│  ├── INSERT on activity_logs → ActivityFeed prepend        │
│  └── Subscription: Dashboard page                          │
│                                                             │
│  Channel: store:{id}:comments                               │
│  ├── INSERT on blog_comments → Comment queue badge++       │
│  └── Subscription: Blog dashboard only                     │
│                                                             │
│  Channel: store:{id}:analytics (Throttled — 30s)           │
│  ├── Aggregated visitor count                               │
│  └── Subscription: Analytics dashboard live counter        │
└────────────────────────────────────────────────────────────┘
```

### 14.2 Real-time Hook

```typescript
// apps/web/admin/hooks/useRealtimeChannel.ts

import { useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export function useRealtimeChannel(
  storeId: string,
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
  callback: (payload: any) => void,
) {
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const channel = supabase
      .channel(`${table}:${storeId}`)
      .on('postgres_changes', {
        event,
        schema: 'public',
        table,
        filter: `store_id=eq.${storeId}`,
      }, callback)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [storeId, table, event]);
}

// Usage example: Real-time order toast
function useOrderToasts(storeId: string) {
  useRealtimeChannel(storeId, 'orders', 'INSERT', (payload) => {
    const order = payload.new;
    toast.success(`New order #${order.order_number}`, {
      description: `₹${order.total.toLocaleString('en-IN')} from ${order.customer_email}`,
      action: { label: 'View', onClick: () => router.push(`/orders/${order.id}`) },
    });
  });
}
```

---

## 15. Command Palette (⌘K)

> **Source:** [00_Overview §7.3 — Command Palette](./00_Overview.md)

### 15.1 Search Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─ ⌘K Command Palette ──────────────────────────────────┐ │
│  │ 🔍 [Type a command or search...                       ]│ │
│  │                                                        │ │
│  │ QUICK ACTIONS                                          │ │
│  │ ┌ 📦 Create New Product              ⌘+Shift+P        │ │
│  │ ┌ 📝 New Blog Post                   ⌘+Shift+N        │ │
│  │ ┌ 📊 Go to Analytics                 ⌘+Shift+A        │ │
│  │ ┌ ⚙️ Open Settings                   ⌘+,              │ │
│  │                                                        │ │
│  │ RECENT                                                 │ │
│  │ ┌ 📦 Summer Dress — Products                          │ │
│  │ ┌ 📋 Order #1001 — Orders                             │ │
│  │ ┌ 📝 "10 Tips for..." — Posts                         │ │
│  │                                                        │ │
│  │ PAGES                                                  │ │
│  │ ┌ 🏠 Dashboard                                        │ │
│  │ ┌ 📦 Products                                         │ │
│  │ ┌ 🤖 AI Studio                                        │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 15.2 Command Palette Implementation

```typescript
// apps/web/admin/components/CommandPalette.tsx

'use client';

import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useStore } from '@/providers/StoreProvider';
import { useCommandPaletteStore } from '@/stores/commandPaletteStore';

export function CommandPalette() {
  const router = useRouter();
  const { store } = useStore();
  const { isOpen, close, toggle } = useCommandPaletteStore();
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggle]);

  // Debounced search
  useEffect(() => {
    if (!search.trim()) { setResults([]); return; }
    const timeout = setTimeout(async () => {
      const res = await fetch(`/api/search?q=${encodeURIComponent(search)}&storeId=${store.id}`);
      setResults(await res.json());
    }, 200);
    return () => clearTimeout(timeout);
  }, [search, store.id]);

  return (
    <Command.Dialog open={isOpen} onOpenChange={(v) => v ? null : close()} label="Command palette">
      <Command.Input value={search} onValueChange={setSearch} placeholder="Type a command or search..." />
      <Command.List>
        <Command.Empty>No results found.</Command.Empty>

        {/* Quick Actions */}
        <Command.Group heading="Quick Actions">
          {getQuickActions(store.site_type).map(action => (
            <Command.Item key={action.id} onSelect={() => { action.handler(router, store); close(); }}>
              <action.Icon className="w-4 h-4 mr-2" />
              {action.label}
              {action.shortcut && <kbd className="ml-auto text-xs">{action.shortcut}</kbd>}
            </Command.Item>
          ))}
        </Command.Group>

        {/* Search results */}
        {results.length > 0 && (
          <Command.Group heading="Search Results">
            {results.map(r => (
              <Command.Item key={r.id} onSelect={() => { router.push(r.url); close(); }}>
                <span className="mr-2">{r.icon}</span>
                <div>
                  <p className="text-sm">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.subtitle}</p>
                </div>
              </Command.Item>
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
}
```

### 15.3 Unified Search API

```typescript
// workers/api/src/routes/search.ts

app.get('/v1/search', authMiddleware(), async (c) => {
  const q = c.req.query('q')?.trim();
  const storeId = c.req.query('storeId');
  if (!q || !storeId) return c.json([]);

  // Parallel search across multiple tables
  const [products, orders, posts, pages] = await Promise.all([
    supabase.from('products').select('id, title, images').eq('store_id', storeId)
      .ilike('title', `%${q}%`).limit(5),
    supabase.from('orders').select('id, order_number, customer_email').eq('store_id', storeId)
      .or(`order_number.ilike.%${q}%,customer_email.ilike.%${q}%`).limit(5),
    supabase.from('blog_posts').select('id, title, slug').eq('store_id', storeId)
      .ilike('title', `%${q}%`).limit(5),
    supabase.from('pages').select('id, title, slug').eq('store_id', storeId)
      .ilike('title', `%${q}%`).limit(5),
  ]);

  const results = [
    ...(products.data || []).map(p => ({ id: p.id, title: p.title, subtitle: 'Product', icon: '📦', url: `/products/${p.id}` })),
    ...(orders.data || []).map(o => ({ id: o.id, title: `Order #${o.order_number}`, subtitle: o.customer_email, icon: '📋', url: `/orders/${o.id}` })),
    ...(posts.data || []).map(p => ({ id: p.id, title: p.title, subtitle: 'Blog Post', icon: '📝', url: `/posts/${p.id}` })),
    ...(pages.data || []).map(p => ({ id: p.id, title: p.title, subtitle: 'Page', icon: '🌐', url: `/pages/${p.id}` })),
  ];

  return c.json(results);
});
```

---

## 16. Keyboard Shortcuts

### 16.1 Global Shortcuts

| Shortcut | Action | Scope |
|---|---|---|
| `⌘K` / `Ctrl+K` | Open command palette | Global |
| `⌘,` | Open settings | Global |
| `⌘B` | Toggle sidebar | Global |
| `⌘/` | Show keyboard shortcuts modal | Global |
| `⌘.` | Toggle theme (dark/light) | Global |
| `Escape` | Close modal/dialog | Global |

### 16.2 Page-Specific Shortcuts

| Shortcut | Action | Page |
|---|---|---|
| `⌘+Shift+P` | Create new product | Products |
| `⌘+Shift+N` | Create new post | Blog Posts |
| `⌘S` | Save current form | Any editor |
| `⌘+Shift+Enter` | Publish immediately | Post/Product editor |
| `⌘Z` / `⌘+Shift+Z` | Undo / Redo | Page builder |
| `Delete` / `Backspace` | Delete selected block | Page builder |
| `⌘D` | Duplicate selected block | Page builder |

### 16.3 Shortcut Provider

```typescript
// apps/web/admin/providers/ShortcutProvider.tsx

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/providers/StoreProvider';
import { useCommandPaletteStore } from '@/stores/commandPaletteStore';

const GLOBAL_SHORTCUTS: Shortcut[] = [
  { key: 'k', meta: true, action: (ctx) => ctx.commandPalette.toggle() },
  { key: ',', meta: true, action: (ctx) => ctx.router.push(`/${ctx.subdomain}/settings`) },
  { key: 'b', meta: true, action: (ctx) => ctx.toggleSidebar() },
  { key: '/', meta: true, action: (ctx) => ctx.showShortcutsModal() },
  { key: '.', meta: true, action: (ctx) => ctx.toggleTheme() },
];

export function ShortcutProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { store } = useStore();
  const commandPalette = useCommandPaletteStore();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      for (const shortcut of GLOBAL_SHORTCUTS) {
        if (e.key === shortcut.key && (shortcut.meta ? e.metaKey || e.ctrlKey : true)) {
          e.preventDefault();
          shortcut.action({ router, subdomain: store.subdomain, commandPalette, /* ... */ });
          return;
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [router, store.subdomain, commandPalette]);

  return children;
}
```

---

## 17. Mobile Admin Experience

### 17.1 Responsive Breakpoints

```typescript
// apps/web/admin/config/breakpoints.ts

export const BREAKPOINTS = {
  mobile: 0,       // 0-639px
  tablet: 640,     // 640-1023px
  desktop: 1024,   // 1024-1279px
  wide: 1280,      // 1280+
} as const;

// Sidebar behavior per breakpoint:
// Mobile:  hidden by default, slide-in overlay from left
// Tablet:  collapsed (icons only, 64px), hover to expand
// Desktop: full width sidebar (240px), always visible
```

### 17.2 Mobile Layout

```
MOBILE (< 640px)                     TABLET (640-1023px)
┌────────────────────────────┐       ┌─────┬──────────────────────┐
│ ☰  Store Name  🔍 🔔 👤   │       │     │ Store Name  🔍 🔔 👤 │
├────────────────────────────┤       │  📊 ├──────────────────────┤
│ ┌────────┐ ┌────────┐     │       │  📦 │                      │
│ │ ₹1.2L  │ │ 127    │     │       │  📋 │   Main Content       │
│ │Revenue │ │Orders  │     │       │  🎫 │   (wider)            │
│ └────────┘ └────────┘     │       │  🚚 │                      │
│ ┌────────┐ ┌────────┐     │       │  👥 │                      │
│ │  89    │ │ ₹980   │     │       │  ── │                      │
│ │Customs │ │ AOV    │     │       │  🌐 │                      │
│ └────────┘ └────────┘     │       │  🤖 │                      │
│                            │       │  📈 │                      │
│ Revenue (sparkline)        │       │  ⚙️ │                      │
│ ─────────────────          │       └─────┴──────────────────────┘
│                            │
│ Recent Orders              │       ← Icons-only sidebar (64px)
│ • #1001 ₹2,450 ✅         │          Hover/click to expand
│ • #1000 ₹1,200 📦         │
│                            │
├────────────────────────────┤
│ 📊  📦  🤖  📈  ⚙️       │  ← Bottom tab bar (mobile only)
└────────────────────────────┘
```

### 17.3 Mobile Sidebar (Sheet/Drawer)

```typescript
// apps/web/admin/components/MobileSidebar.tsx

'use client';

import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export function MobileSidebar({ siteType, subdomain }: SidebarProps) {
  const isMobile = useMediaQuery('(max-width: 639px)');
  const [open, setOpen] = useState(false);

  if (!isMobile) return null;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="w-5 h-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <Sidebar siteType={siteType} subdomain={subdomain} onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
```

### 17.4 Mobile Bottom Tab Bar

```typescript
// apps/web/admin/components/BottomTabBar.tsx

const MOBILE_TABS: Record<SiteType, TabItem[]> = {
  store: [
    { icon: 'LayoutDashboard', label: 'Home', href: '/dashboard' },
    { icon: 'Package', label: 'Products', href: '/products' },
    { icon: 'Bot', label: 'AI', href: '/ai-studio' },
    { icon: 'TrendingUp', label: 'Stats', href: '/analytics' },
    { icon: 'Settings', label: 'More', href: '/settings' },
  ],
  blog: [
    { icon: 'LayoutDashboard', label: 'Home', href: '/dashboard' },
    { icon: 'PenTool', label: 'Posts', href: '/posts' },
    { icon: 'Bot', label: 'AI', href: '/ai-studio' },
    { icon: 'TrendingUp', label: 'Stats', href: '/analytics' },
    { icon: 'Settings', label: 'More', href: '/settings' },
  ],
  // ... portfolio, resume, landing follow same pattern
};
```

---

## 18. Dark Mode & Theming

### 18.1 CSS Custom Properties

```css
/* apps/web/admin/styles/themes.css */

:root {
  /* Light theme (default) */
  --background: 0 0% 100%;
  --foreground: 222 47% 11%;
  --card: 0 0% 100%;
  --card-foreground: 222 47% 11%;
  --popover: 0 0% 100%;
  --popover-foreground: 222 47% 11%;
  --primary: 239 84% 67%;         /* #6366f1 — Indigo */
  --primary-foreground: 0 0% 100%;
  --secondary: 210 40% 96%;
  --secondary-foreground: 222 47% 11%;
  --muted: 210 40% 96%;
  --muted-foreground: 215 16% 47%;
  --accent: 210 40% 96%;
  --accent-foreground: 222 47% 11%;
  --destructive: 0 84% 60%;
  --destructive-foreground: 0 0% 100%;
  --border: 214 32% 91%;
  --ring: 239 84% 67%;
  --sidebar: 0 0% 98%;
}

.dark {
  --background: 222 47% 7%;
  --foreground: 210 40% 98%;
  --card: 222 47% 11%;
  --card-foreground: 210 40% 98%;
  --primary: 239 84% 67%;
  --primary-foreground: 0 0% 100%;
  --secondary: 217 33% 17%;
  --muted: 217 33% 17%;
  --muted-foreground: 215 20% 65%;
  --border: 217 33% 17%;
  --sidebar: 222 47% 9%;
}
```

### 18.2 Theme Toggle with System Preference

```typescript
// apps/web/admin/components/ThemeToggle.tsx

'use client';

import { useTheme } from 'next-themes';

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          {resolvedTheme === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => setTheme('light')}>
          <Sun className="w-4 h-4 mr-2" /> Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}>
          <Moon className="w-4 h-4 mr-2" /> Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}>
          <Monitor className="w-4 h-4 mr-2" /> System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

---

## 19. Performance Optimization

### 19.1 Code Splitting Strategy

```typescript
// Route-level code splitting (automatic with Next.js App Router)
// Each route is a separate chunk:
//   /{store}/dashboard     → DashboardPage chunk
//   /{store}/products      → ProductsPage chunk
//   /{store}/posts         → PostsPage chunk
//   /{store}/ai-studio     → AIStudioPage chunk

// Heavy component lazy loading:
const PageBuilder = dynamic(() => import('@/components/builder/PageBuilder'), {
  loading: () => <PageBuilderSkeleton />,
  ssr: false,  // Craft.js is client-only
});

const RevenueChart = dynamic(() => import('@/components/charts/RevenueChart'), {
  loading: () => <ChartSkeleton />,
});

const TiptapEditor = dynamic(() => import('@/components/blog/PostEditor'), {
  loading: () => <EditorSkeleton />,
  ssr: false,
});
```

### 19.2 Data Fetching Optimization

```typescript
// Server Component data fetching with caching
async function fetchDashboardData(storeId: string, siteType: SiteType) {
  const cacheKey = `dashboard:${storeId}:${siteType}`;

  // Redis cache (60s TTL)
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  const data = await Promise.all([
    fetchQuickStats(storeId, siteType),
    fetchRecentActivity(storeId, 10),
    fetchChartData(storeId, '7d'),
  ]);

  await redis.setex(cacheKey, 60, JSON.stringify(data));
  return data;
}

// React Query prefetching for client components
export function DashboardProviders({ children, storeId }: { children: React.ReactNode; storeId: string }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,       // 30s before refetch
        gcTime: 5 * 60_000,     // 5min garbage collection
        refetchOnWindowFocus: true,
        retry: 2,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### 19.3 Virtual Scrolling

```typescript
// For large lists (products, orders, customers)
import { useVirtualizer } from '@tanstack/react-virtual';

function VirtualProductList({ products }: { products: Product[] }) {
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: products.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,     // estimated row height
    overscan: 5,
  });

  return (
    <div ref={parentRef} className="h-[600px] overflow-y-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map(vItem => (
          <div key={vItem.key} style={{ position: 'absolute', top: vItem.start, height: vItem.size, width: '100%' }}>
            <ProductRow product={products[vItem.index]} />
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 20. Accessibility

### 20.1 WCAG 2.1 AA Compliance

| Area | Requirement | Implementation |
|---|---|---|
| Color contrast | 4.5:1 text, 3:1 large text | HSL-based palette with contrast checking |
| Keyboard navigation | Full operability | Tab order, focus rings, skip links |
| Screen readers | ARIA labels | `aria-label`, `aria-describedby`, landmarks |
| Focus management | Visible focus | `ring-2 ring-primary ring-offset-2` on focus |
| Form accessibility | Labels + errors | `label` + `aria-invalid` + `aria-describedby` |
| Toasts | Non-disruptive | `role="status"`, `aria-live="polite"` |
| Modals | Focus trap | `Dialog` from Radix UI (auto focus trap) |
| Images | Alt text | Required `alt` on all `<img>` |

### 20.2 Skip Link

```typescript
// apps/web/admin/components/SkipLink.tsx

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:bg-primary focus:text-primary-foreground focus:px-4 focus:py-2 focus:rounded-lg"
    >
      Skip to main content
    </a>
  );
}
```

### 20.3 Focus Management in Modals

```typescript
// Using Radix UI Dialog for accessible modals
import * as Dialog from '@radix-ui/react-dialog';

export function DeleteConfirmDialog({ onConfirm }: { onConfirm: () => void }) {
  return (
    <Dialog.Root>
      <Dialog.Trigger asChild>
        <Button variant="destructive">Delete</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card rounded-xl p-6 w-[400px]"
          aria-describedby="delete-desc"
        >
          <Dialog.Title className="text-lg font-semibold">Are you sure?</Dialog.Title>
          <Dialog.Description id="delete-desc" className="text-sm text-muted-foreground mt-2">
            This action cannot be undone. This will permanently delete the item.
          </Dialog.Description>
          <div className="flex justify-end gap-2 mt-4">
            <Dialog.Close asChild><Button variant="outline">Cancel</Button></Dialog.Close>
            <Button variant="destructive" onClick={onConfirm}>Delete</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
```

---

## 21. Testing Strategy

### 21.1 Testing Pyramid

```
           ┌──────────┐
           │   E2E    │  ← Playwright (critical user flows)
           │  (10%)   │     login → create product → checkout
          ┌┴──────────┴┐
          │ Integration │  ← Vitest + MSW (API + DB mocking)
          │   (30%)     │     sidebar renders correctly for site types
         ┌┴────────────┴┐
         │    Unit       │  ← Vitest (pure functions, hooks)
         │   (60%)       │     formatCurrency, timeAgo, slugify
         └──────────────┘
```

### 21.2 Unit Tests

```typescript
// __tests__/config/sidebar.test.ts

import { describe, it, expect } from 'vitest';
import { SIDEBAR_CONFIG } from '@/config/sidebar';
import { SITE_TYPES } from '@letbuyy/constants';

describe('SIDEBAR_CONFIG', () => {
  it('has config for all 5 site types', () => {
    for (const siteType of SITE_TYPES) {
      expect(SIDEBAR_CONFIG[siteType]).toBeDefined();
      expect(SIDEBAR_CONFIG[siteType].length).toBeGreaterThan(0);
    }
  });

  it('every site type has Dashboard as first item', () => {
    for (const siteType of SITE_TYPES) {
      const firstItem = SIDEBAR_CONFIG[siteType][0];
      expect(firstItem).not.toBe('---separator---');
      if (firstItem !== '---separator---') {
        expect(firstItem.label).toBe('Dashboard');
        expect(firstItem.href).toBe('/dashboard');
      }
    }
  });

  it('every site type has Settings and AI Studio', () => {
    for (const siteType of SITE_TYPES) {
      const labels = SIDEBAR_CONFIG[siteType]
        .filter((i): i is SidebarItem => i !== '---separator---')
        .map(i => i.label);
      expect(labels).toContain('Settings');
      expect(labels).toContain('AI Studio');
    }
  });

  it('blog type has Posts, Categories, Tags, Comments', () => {
    const blogLabels = SIDEBAR_CONFIG.blog
      .filter((i): i is SidebarItem => i !== '---separator---')
      .map(i => i.label);
    expect(blogLabels).toContain('Posts');
    expect(blogLabels).toContain('Categories');
    expect(blogLabels).toContain('Tags');
    expect(blogLabels).toContain('Comments');
  });
});
```

### 21.3 Integration Tests

```typescript
// __tests__/components/QuickStats.test.tsx

import { render, screen } from '@testing-library/react';
import { QuickStats } from '@/components/QuickStats';

describe('QuickStats', () => {
  it('renders store metrics for e-commerce site type', () => {
    render(<QuickStats siteType="store" stats={mockStoreStats} />);
    expect(screen.getByText('Revenue')).toBeInTheDocument();
    expect(screen.getByText('Orders')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
    expect(screen.getByText('Avg Order')).toBeInTheDocument();
  });

  it('renders blog metrics for blog site type', () => {
    render(<QuickStats siteType="blog" stats={mockBlogStats} />);
    expect(screen.getByText('Total Reads')).toBeInTheDocument();
    expect(screen.getByText('Posts')).toBeInTheDocument();
    expect(screen.getByText('Subscribers')).toBeInTheDocument();
  });
});
```

### 21.4 E2E Tests (Playwright)

```typescript
// e2e/admin-dashboard.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/test-store/dashboard');
    await page.waitForSelector('[data-testid="quick-stats"]');
  });

  test('displays correct sidebar for store type', async ({ page }) => {
    const sidebar = page.locator('[data-testid="sidebar"]');
    await expect(sidebar.getByText('Products')).toBeVisible();
    await expect(sidebar.getByText('Orders')).toBeVisible();
    await expect(sidebar.getByText('Posts')).not.toBeVisible(); // blog-only
  });

  test('command palette opens with ⌘K', async ({ page }) => {
    await page.keyboard.press('Meta+k');
    await expect(page.locator('[cmdk-dialog]')).toBeVisible();
    await page.keyboard.type('products');
    await expect(page.locator('[cmdk-item]').first()).toContainText('Products');
  });

  test('theme toggle switches between light and dark', async ({ page }) => {
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/dark/);
    await page.click('[data-testid="theme-toggle"]');
    await page.click('text=Dark');
    await expect(html).toHaveClass(/dark/);
  });

  test('notification bell shows unread count', async ({ page }) => {
    const bell = page.locator('[data-testid="notification-bell"]');
    await expect(bell).toBeVisible();
    await bell.click();
    await expect(page.locator('[data-testid="notification-panel"]')).toBeVisible();
  });
});
```

---

## 22. Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2025-06-01 | Siddhu Saai | Initial document with 11 sections |
| 2.0 | 2025-09-15 | Siddhu Saai | Added Craft.js builder section |
| 3.0 | 2025-11-20 | Siddhu Saai | Added AI Studio section |
| 4.0 | 2026-01-10 | Siddhu Saai | Added portfolio & resume dashboards |
| 5.0 | 2026-02-01 | Siddhu Saai | Expanded settings panel |
| 6.0 | 2026-02-14 | AI-Assisted Enhancement | **Major expansion**: 282 → 2,000+ lines. Added Blog Dashboard (§7), Analytics (§12), Notification Center (§13), Real-time Features (§14), Command Palette (§15), Keyboard Shortcuts (§16), Mobile Admin (§17), Dark Mode & Theming (§18), Performance Optimization (§19), Accessibility (§20), Testing Strategy (§21). All sections enhanced with TypeScript code, React components, database schemas, wireframes, and cross-references. |

---

> **Next:** [05_Ecommerce_Engine.md](./05_Ecommerce_Engine.md) — Product management, cart, checkout, payment processing
>
> **Related:** [00_Overview.md](./00_Overview.md) | [01_Architecture.md](./01_Architecture.md) | [02_Authentication_and_Security.md](./02_Authentication_and_Security.md) | [03_Onboarding_and_Trial.md](./03_Onboarding_and_Trial.md)
