# LetBuyy Multi-Tenant Platform — Comprehensive Analysis & Implementation Plan

> **Part 1 of 8** | Executive Summary, Gap Analysis, Architecture Overview & Blogger Integration
>
> **Date:** February 13, 2026 | **Version:** 3.0 Enterprise Edition
>
> **Continues in:** Part 2 (Database Schema & Blogger Tables)

---

## Table of Contents — Complete Series

**Part 1** (this file): Executive Summary, Gap Analysis, Architecture Overview, Blogger Integration Strategy  
**Part 2**: Complete Database Schema with Blogger Tables, Relationships, RLS Policies  
**Part 3**: Shopify-Grade Admin Panel Architecture, Design System, Component Library  
**Part 4**: Blogger Admin UI Wireframes (All CRUD Operations)  
**Part 5**: Enhanced Admin Features (Bulk Actions, Advanced Search, Activity Logs)  
**Part 6**: E-commerce Enhancements (Inventory, Multi-Currency, Tax Engine)  
**Part 7**: Analytics Dashboard, Reporting Engine, Export Systems  
**Part 8**: Deployment Strategy, Testing Plan, Performance Optimization

---

## 1. Executive Summary

### 1.1 Project Scope

This comprehensive implementation plan transforms LetBuyy from a basic multi-tenant platform into an **enterprise-grade SaaS solution** rivaling Shopify's admin experience. The plan includes:

1. **New Site Type**: Full-featured Blogger platform with posts, categories, tags, comments, SEO
2. **Enterprise Admin Panel**: Shopify-level UX with bulk operations, advanced search, keyboard shortcuts
3. **Enhanced Architecture**: Type-specific tables, optimized queries, caching strategies
4. **Advanced Features**: Activity logs, version control, media library, analytics dashboard
5. **Performance**: Sub-200ms page loads, optimistic UI updates, real-time sync

### 1.2 Current State Analysis

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    CURRENT STATE INVENTORY                               │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SITE TYPES (Existing):                                                 │
│  ✅ E-commerce (stores + products + orders + customers + coupons)       │
│  ✅ Portfolio (portfolios + projects + skills)                          │
│  ✅ Resume (resumes + experiences + education + certifications)         │
│  ✅ Landing (landings + sections + form_submissions)                    │
│  ❌ Blogger (NOT IMPLEMENTED)                                            │
│                                                                          │
│  ADMIN FEATURES (Current):                                              │
│  ✅ Basic CRUD operations                                               │
│  ✅ Simple list views with pagination                                   │
│  ✅ Individual item editing                                             │
│  ❌ Bulk actions (select all, batch edit, batch delete)                 │
│  ❌ Advanced search/filtering                                           │
│  ❌ Inline editing                                                      │
│  ❌ Keyboard shortcuts                                                  │
│  ❌ Activity logs / audit trail                                         │
│  ❌ Version history                                                     │
│  ❌ Media library                                                       │
│  ❌ Advanced analytics                                                  │
│  ❌ Export/import functionality                                         │
│                                                                          │
│  UI/UX MATURITY:                                                        │
│  Current Level: Basic functional admin (3/10)                           │
│  Target Level:  Shopify enterprise grade (10/10)                        │
│                                                                          │
│  PERFORMANCE:                                                           │
│  Current: 800-1200ms page loads, no caching, N+1 queries               │
│  Target:  <200ms page loads, Redis caching, optimized queries          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Target State — Enterprise Vision

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    TARGET STATE ARCHITECTURE                             │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  SITE TYPES (Enhanced):                                                 │
│  🔷 E-commerce → Multi-currency, inventory tracking, advanced coupons   │
│  🔷 Portfolio  → Theme templates, testimonials, client logos            │
│  🔷 Resume     → PDF export, LinkedIn sync, skill endorsements          │
│  🔷 Landing    → A/B testing, heatmaps, conversion funnels              │
│  ✅ Blogger    → Full CMS with SEO, markdown, draft system, scheduling  │
│                                                                          │
│  ADMIN PANEL (Shopify-Grade):                                           │
│  ┌────────────────────────────────────────────────────────────────────┐ │
│  │ 🎯 NAVIGATION                                                       │ │
│  │ • Persistent sidebar with icons + labels                           │ │
│  │ • Collapsible sections with badges (counts, alerts)                │ │
│  │ • Quick search (⌘K) with keyboard navigation                       │ │
│  │ • Breadcrumbs for deep navigation                                  │ │
│  │                                                                     │ │
│  │ 🎯 LIST VIEWS                                                       │ │
│  │ • Bulk selection (select all, select page, custom)                 │ │
│  │ • Bulk actions toolbar (edit, delete, export, change status)       │ │
│  │ • Advanced filters (multi-select, date ranges, custom fields)      │ │
│  │ • Column customization (show/hide, reorder, resize)                │ │
│  │ • Saved views (My drafts, High priority, etc.)                     │ │
│  │ • Inline editing (double-click to edit)                            │ │
│  │ • Sortable columns                                                 │ │
│  │ • Pagination with jump-to-page                                     │ │
│  │                                                                     │ │
│  │ 🎯 DETAIL VIEWS                                                     │ │
│  │ • Tabbed interface (Details, SEO, Activity, Versions)              │ │
│  │ • Auto-save with status indicator                                  │ │
│  │ • Rich text editor with markdown support                           │ │
│  │ • Media picker with drag-drop upload                               │ │
│  │ • Related items sidebar                                            │ │
│  │ • Version history with diff view                                   │ │
│  │                                                                     │ │
│  │ 🎯 DASHBOARD                                                        │ │
│  │ • Customizable widgets (drag-drop layout)                          │ │
│  │ • Real-time metrics with sparklines                                │ │
│  │ • Quick actions panel                                              │ │
│  │ • Recent activity feed                                             │ │
│  │ • Alerts and notifications center                                  │ │
│  │                                                                     │ │
│  │ 🎯 SEARCH & DISCOVERY                                               │ │
│  │ • Global search (⌘K) across all content types                      │ │
│  │ • Search suggestions and autocomplete                              │ │
│  │ • Search history                                                   │ │
│  │ • Advanced search builder (AND/OR logic)                           │ │
│  │                                                                     │ │
│  │ 🎯 KEYBOARD SHORTCUTS                                               │ │
│  │ • ⌘K: Global search                                                │ │
│  │ • ⌘S: Save current item                                            │ │
│  │ • ⌘N: Create new item                                              │ │
│  │ • ⌘E: Edit selected item                                           │ │
│  │ • ⌘⌫: Delete selected items                                        │ │
│  │ • ⌘A: Select all                                                   │ │
│  │ • ⌘⇧A: Deselect all                                                │ │
│  │ • ←→: Navigate between tabs                                        │ │
│  │ • ?:  Show keyboard shortcuts panel                                │ │
│  └────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  PERFORMANCE TARGETS:                                                   │
│  • Page Load: <200ms (95th percentile)                                 │
│  • Time to Interactive: <500ms                                          │
│  • First Contentful Paint: <100ms                                       │
│  • API Response: <50ms (cached), <150ms (uncached)                     │
│  • Database Queries: <10ms per query                                   │
│  • Optimistic UI: 0ms perceived latency                                │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Gap Analysis — Current vs Enterprise

### 2.1 Feature Matrix

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    FEATURE COMPARISON MATRIX                             │
├────────────────────────┬─────────────┬──────────────┬──────────────────┤
│ Feature                │ Current     │ Shopify      │ Target           │
├────────────────────────┼─────────────┼──────────────┼──────────────────┤
│ Bulk Actions           │ ❌ None      │ ✅ Full       │ ✅ Full          │
│ Inline Editing         │ ❌ No        │ ✅ Yes        │ ✅ Yes           │
│ Advanced Filters       │ ❌ Basic     │ ✅ Advanced   │ ✅ Advanced      │
│ Saved Views            │ ❌ No        │ ✅ Yes        │ ✅ Yes           │
│ Column Customization   │ ❌ Fixed     │ ✅ Custom     │ ✅ Custom        │
│ Keyboard Shortcuts     │ ❌ None      │ ✅ 20+        │ ✅ 25+           │
│ Auto-save              │ ❌ Manual    │ ✅ Auto       │ ✅ Auto          │
│ Version History        │ ❌ No        │ ✅ Full       │ ✅ Full          │
│ Activity Logs          │ ❌ No        │ ✅ Yes        │ ✅ Yes           │
│ Media Library          │ ❌ Basic     │ ✅ Advanced   │ ✅ Advanced      │
│ Search (Global)        │ ❌ Per-page  │ ✅ Global     │ ✅ Global        │
│ Export/Import          │ ❌ No        │ ✅ CSV/Excel  │ ✅ CSV/Excel/JSON│
│ Bulk Edit              │ ❌ No        │ ✅ Yes        │ ✅ Yes           │
│ Undo/Redo              │ ❌ No        │ ✅ Yes        │ ✅ Yes           │
│ Comments/Notes         │ ❌ No        │ ✅ Yes        │ ✅ Yes           │
│ Tags/Labels            │ ❌ Basic     │ ✅ Advanced   │ ✅ Advanced      │
│ Analytics Dashboard    │ ❌ Basic     │ ✅ Advanced   │ ✅ Advanced      │
│ Real-time Updates      │ ❌ No        │ ✅ Yes        │ ✅ Yes           │
│ Mobile Admin           │ ❌ Responsive│ ✅ Native     │ ✅ PWA           │
│ Dark Mode              │ ✅ Yes       │ ✅ Yes        │ ✅ Yes           │
│ Multi-language         │ ✅ Basic     │ ✅ Full       │ ✅ Full          │
│ Accessibility (WCAG)   │ ❌ Partial   │ ✅ AA         │ ✅ AAA           │
│ API Access             │ ❌ Limited   │ ✅ REST+GQL   │ ✅ REST+GQL      │
│ Webhooks               │ ❌ No        │ ✅ Yes        │ ✅ Yes           │
│ Custom Fields          │ ❌ No        │ ✅ Yes        │ ✅ Yes           │
└────────────────────────┴─────────────┴──────────────┴──────────────────┘
```

### 2.2 UI/UX Maturity Assessment

```
┌──────────────────────────────────────────────────────────────────────────┐
│                    UI/UX MATURITY LEVELS                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  LEVEL 1: Basic Functional (Current State: 3/10)                        │
│  ├─ Simple CRUD operations                                              │
│  ├─ Basic list views                                                    │
│  ├─ Individual item editing                                             │
│  └─ Manual save/refresh                                                 │
│                                                                          │
│  LEVEL 2: Enhanced Functional (Milestone 1)                             │
│  ├─ Pagination and sorting                                              │
│  ├─ Basic search                                                        │
│  ├─ Status indicators                                                   │
│  └─ Responsive layout                                                   │
│                                                                          │
│  LEVEL 3: Professional (Milestone 2)                                    │
│  ├─ Bulk selection                                                      │
│  ├─ Advanced filters                                                    │
│  ├─ Auto-save                                                           │
│  └─ Loading states                                                      │
│                                                                          │
│  LEVEL 4: Enterprise Basic (Milestone 3)                                │
│  ├─ Bulk actions                                                        │
│  ├─ Keyboard shortcuts                                                  │
│  ├─ Column customization                                                │
│  └─ Saved views                                                         │
│                                                                          │
│  LEVEL 5: Enterprise Advanced (Milestone 4)                             │
│  ├─ Inline editing                                                      │
│  ├─ Version history                                                     │
│  ├─ Activity logs                                                       │
│  └─ Advanced search                                                     │
│                                                                          │
│  LEVEL 6: Shopify-Grade (Target: 10/10)                                 │
│  ├─ Real-time collaboration                                             │
│  ├─ AI-powered suggestions                                              │
│  ├─ Customizable workflows                                              │
│  └─ Full API + webhooks                                                 │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Architecture Overview — Enhanced Multi-Tenant System

### 3.1 Complete System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    ENHANCED SYSTEM ARCHITECTURE                              │
└──────────────────────────────────────────────────────────────────────────────┘

                                 INTERNET
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌───────────────┐ ┌──────────┐ ┌──────────────┐
            │  CLOUDFLARE   │ │  VERCEL  │ │   SUPABASE   │
            │   DNS + CDN   │ │   EDGE   │ │  PostgreSQL  │
            └───────┬───────┘ └────┬─────┘ └──────┬───────┘
                    │              │               │
        ┌───────────┼──────────────┼───────────────┤
        │           │              │               │
        ▼           ▼              ▼               ▼
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐
│  accounts  │ │   admin    │ │ storefront │ │   api/cdn    │
│  .letbuyy  │ │  .letbuyy  │ │*.letbuyy   │ │ api.letbuyy  │
│  .store    │ │  .store    │ │ .store     │ │   .store     │
└────────────┘ └─────┬──────┘ └────────────┘ └──────────────┘
                     │
         ┌───────────┴───────────┐
         │   ADMIN APPLICATION   │
         │   (Enhanced)          │
         └───────────┬───────────┘
                     │
     ┌───────────────┼───────────────┐
     │               │               │
     ▼               ▼               ▼
┌──────────┐  ┌──────────┐  ┌──────────────┐
│ Session  │  │ Database │  │ Media/Cache  │
│ Manager  │  │ Layer    │  │ Layer        │
└──────────┘  └────┬─────┘  └──────────────┘
                   │
     ┌─────────────┼─────────────┬─────────────┬─────────────┐
     │             │             │             │             │
     ▼             ▼             ▼             ▼             ▼
┌─────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐  ┌─────────┐
│ E-comm  │  │Portfolio │  │ Resume   │  │Landing │  │ Blogger │
│ Module  │  │ Module   │  │ Module   │  │Module  │  │ Module  │
└─────────┘  └──────────┘  └──────────┘  └────────┘  └─────────┘
```

### 3.2 Database Architecture — Type-Specific Design

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    ENHANCED DATABASE ARCHITECTURE                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LAYER 1: AUTHENTICATION & IDENTITY                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ users_custom → sessions → devices → login_attempts                     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  LAYER 2: SITE HIERARCHY (Parent Entity)                                    │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                            sites                                        │  │
│  │ ┌────────────────────────────────────────────────────────────────────┐ │  │
│  │ │ id │ custom_user_id │ subdomain │ site_type │ status │ name        │ │  │
│  │ └────────────────────────────────────────────────────────────────────┘ │  │
│  └───────────────────────────────┬────────────────────────────────────────┘  │
│                                  │                                           │
│      ┌───────────────┬───────────┼──────────┬────────────┬─────────────┐    │
│      │               │           │          │            │             │    │
│      ▼               ▼           ▼          ▼            ▼             ▼    │
│  site_type       site_type   site_type   site_type   site_type    SHARED   │
│  ='ecommerce'    ='portfolio' ='resume'  ='landing'  ='blogger'   TABLES   │
│      │               │           │          │            │             │    │
│      ▼               ▼           ▼          ▼            ▼             ▼    │
│  ┌────────┐     ┌──────────┐ ┌────────┐ ┌────────┐ ┌─────────┐  ┌───────┐ │
│  │ stores │     │portfolios│ │resumes │ │landings│ │ blogs   │  │ pages │ │
│  │site_id→│     │ site_id→ │ │site_id→│ │site_id→│ │site_id→ │  │site_id││
│  └───┬────┘     └────┬─────┘ └───┬────┘ └───┬────┘ └────┬────┘  └───────┘ │
│      │               │           │          │            │                  │
│  RELATED         RELATED      RELATED    RELATED      RELATED               │
│  TABLES:         TABLES:      TABLES:    TABLES:      TABLES:               │
│  ┌─────────┐    ┌────────┐   ┌─────────┐ ┌────────┐  ┌──────────┐         │
│  │products │    │projects│   │experiences sections│  │blog_posts │         │
│  │orders   │    │skills  │   │education│ │form_   │  │categories │         │
│  │customers│    │         │   │certs    │ │submiss.│  │tags       │         │
│  │coupons  │    │         │   │r_skills │ │         │  │comments   │         │
│  └─────────┘    └────────┘   └─────────┘ └────────┘  │post_tags  │         │
│                                                        │authors    │         │
│                                                        └──────────┘         │
│                                                                              │
│  LAYER 3: ENTERPRISE FEATURES (Cross-cutting)                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ activity_logs → All CRUD operations logged                             │  │
│  │ versions      → Full version history for content                       │  │
│  │ media_library → Centralized media management                           │  │
│  │ notifications → User alerts and system messages                        │  │
│  │ webhooks      → External integrations                                  │  │
│  │ analytics     → Page views, events, conversions                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 Blogger Site Type — Complete Feature Set

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    BLOGGER SITE TYPE — FEATURE OVERVIEW                      │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CONTENT MANAGEMENT:                                                         │
│  ✅ Blog Posts (title, slug, content, excerpt, featured_image)               │
│  ✅ Rich Text Editor (TinyMCE/Tiptap with markdown support)                  │
│  ✅ Categories (hierarchical, with descriptions)                             │
│  ✅ Tags (flexible tagging system)                                           │
│  ✅ Authors (multi-author support with bios)                                 │
│  ✅ Comments (with moderation, spam filtering, threading)                    │
│  ✅ Media Library (images, videos, documents)                                │
│  ✅ Draft System (draft → review → published → archived)                     │
│  ✅ Scheduling (publish at specific date/time)                               │
│  ✅ Revisions (auto-save, manual save points, diff view)                     │
│                                                                              │
│  SEO & DISCOVERY:                                                            │
│  ✅ Meta titles and descriptions (per post)                                  │
│  ✅ Open Graph tags (social sharing)                                         │
│  ✅ Twitter Cards (optimized previews)                                       │
│  ✅ Schema.org markup (Article, BlogPosting)                                 │
│  ✅ XML Sitemap generation                                                   │
│  ✅ RSS/Atom feeds                                                           │
│  ✅ Canonical URLs                                                           │
│  ✅ Slug optimization                                                        │
│  ✅ Reading time estimation                                                  │
│                                                                              │
│  ENGAGEMENT:                                                                 │
│  ✅ Comments with replies (threaded)                                         │
│  ✅ Reactions (like, love, insightful, etc.)                                 │
│  ✅ Share buttons (social platforms)                                         │
│  ✅ Email subscriptions (newsletter integration)                             │
│  ✅ Related posts (algorithm-based)                                          │
│  ✅ Popular posts widget                                                     │
│  ✅ Recent posts widget                                                      │
│                                                                              │
│  ANALYTICS:                                                                  │
│  ✅ Page views per post                                                      │
│  ✅ Time on page                                                             │
│  ✅ Bounce rate                                                              │
│  ✅ Top posts dashboard                                                      │
│  ✅ Traffic sources                                                          │
│  ✅ Reader demographics                                                      │
│  ✅ Conversion tracking                                                      │
│                                                                              │
│  CUSTOMIZATION:                                                              │
│  ✅ Theme templates (minimal, modern, classic, magazine)                     │
│  ✅ Color schemes                                                            │
│  ✅ Typography settings                                                      │
│  ✅ Layout options (sidebar left/right/none)                                 │
│  ✅ Custom CSS                                                               │
│  ✅ Widget areas                                                             │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Blogger Integration Strategy

### 4.1 Blogger Admin Navigation Structure

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    BLOGGER ADMIN — NAVIGATION MAP                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │  SIDEBAR (when site_type = 'blogger')                                  │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                        │  │
│  │  📊 Dashboard                                                          │  │
│  │     └─ Overview, metrics, quick actions                               │  │
│  │                                                                        │  │
│  │  📝 Posts                                    [+ New Post]              │  │
│  │     ├─ All Posts (15)                                                 │  │
│  │     ├─ Published (12)                                                 │  │
│  │     ├─ Drafts (2)                                                     │  │
│  │     ├─ Scheduled (1)                                                  │  │
│  │     └─ Archived (0)                                                   │  │
│  │                                                                        │  │
│  │  📁 Categories                               [+ New Category]         │  │
│  │     └─ Hierarchical list view                                         │  │
│  │                                                                        │  │
│  │  🏷️ Tags                                      [+ New Tag]              │  │
│  │     └─ Tag cloud with usage counts                                    │  │
│  │                                                                        │  │
│  │  💬 Comments                                                           │  │
│  │     ├─ All Comments (234)                                             │  │
│  │     ├─ Pending (8) 🔴                                                 │  │
│  │     ├─ Approved (220)                                                 │  │
│  │     └─ Spam (6)                                                       │  │
│  │                                                                        │  │
│  │  👥 Authors                                  [+ Add Author]            │  │
│  │     └─ Multi-author management                                        │  │
│  │                                                                        │  │
│  │  🖼️ Media Library                            [+ Upload]               │  │
│  │     └─ Grid/List view of all media                                    │  │
│  │                                                                        │  │
│  │  📈 Analytics                                                          │  │
│  │     ├─ Overview                                                       │  │
│  │     ├─ Top Posts                                                      │  │
│  │     ├─ Traffic Sources                                                │  │
│  │     └─ Engagement                                                     │  │
│  │                                                                        │  │
│  │  🎨 Appearance                                                         │  │
│  │     ├─ Themes                                                         │  │
│  │     ├─ Customize                                                      │  │
│  │     └─ Widgets                                                        │  │
│  │                                                                        │  │
│  │  📄 Pages                                    [+ New Page]              │  │
│  │     └─ About, Contact, Privacy, etc.                                  │  │
│  │                                                                        │  │
│  │  ⚙️ Settings                                                           │  │
│  │     ├─ General                                                        │  │
│  │     ├─ Reading                                                        │  │
│  │     ├─ Discussion                                                     │  │
│  │     ├─ SEO                                                            │  │
│  │     └─ Advanced                                                       │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Blogger Dashboard Wireframe

```
╔═════════════════════════════════════════════════════════════════════════════╗
║  ┌───────────────┐                                                        ║
║  │   LetBuyy     │    Dashboard                         [View Site →]     ║
║  │   myblog      │    Welcome back, John!                                 ║
║  │               │                                                        ║
║  │  📊 Dashboard │    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ ║
║  │  📝 Posts     │    │ Views    │ │ Posts    │ │ Comments │ │ Visitors│ ║
║  │  📁 Categories│    │ 12,450   │ │ 15       │ │ 234      │ │ 3,421   │ ║
║  │  🏷️ Tags      │    │ ↑24%     │ │ 2 drafts │ │ 8 pending│ │ ↑18%    │ ║
║  │  💬 Comments  │    └──────────┘ └──────────┘ └──────────┘ └─────────┘ ║
║  │  👥 Authors   │                                                        ║
║  │  🖼️ Media     │    Quick Actions                                       ║
║  │  📈 Analytics │    ┌─────────────┐ ┌─────────────┐ ┌───────────────┐  ║
║  │  🎨 Appearance│    │ + New Post  │ │ 💬 Moderate │ │ 🎨 Customize  │  ║
║  │  📄 Pages     │    │            │ │   Comments  │ │    Theme      │  ║
║  │  ⚙️ Settings  │    └─────────────┘ └─────────────┘ └───────────────┘  ║
║  │               │                                                        ║
║  │               │    Top Posts This Month                                ║
║  │               │    ┌───────────────────────────────────────────────┐   ║
║  │               │    │ Title                      │ Views │ Comments │   ║
║  │               │    ├────────────────────────────┼───────┼──────────┤   ║
║  │               │    │ 10 Tips for Better UX     │ 2,341 │ 45       │   ║
║  │               │    │ Getting Started with Next │ 1,876 │ 32       │   ║
║  │               │    │ React Best Practices      │ 1,543 │ 28       │   ║
║  │               │    │ TypeScript Deep Dive      │ 1,234 │ 21       │   ║
║  │               │    └───────────────────────────────────────────────┘   ║
║  │               │                                                        ║
║  │               │    Recent Activity                                     ║
║  │               │    ┌───────────────────────────────────────────────┐   ║
║  │               │    │ • New comment on "10 Tips..."       2 min ago │   ║
║  │               │    │ • Post published: "TypeScript..."   1 hr ago  │   ║
║  │               │    │ • Comment approved on "React..."    3 hrs ago │   ║
║  │               │    │ • New subscriber: john@mail.com     5 hrs ago │   ║
║  │               │    └───────────────────────────────────────────────┘   ║
║  │ user@email    │                                                        ║
║  │ ← Sign out   │                                                        ║
║  └───────────────┘                                                        ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

### 4.3 Post Editor — Enhanced UX

```
╔═════════════════════════════════════════════════════════════════════════════╗
║  ┌───────────────┐                                                        ║
║  │  SIDEBAR      │    New Post                       [Save Draft] [Preview]║
║  │               │                                    [Publish →]         ║
║  │               │                                                        ║
║  │               │    ┌─────────────────────────────────────────────────┐ ║
║  │               │    │ Title                                           │ ║
║  │               │    │ [Getting Started with Next.js 15             ] │ ║
║  │               │    │                                                 │ ║
║  │               │    │ Permalink: myblog.letbuyy.store/getting-started-│ ║
║  │               │    │            next-js-15                    [Edit] │ ║
║  │               │    └─────────────────────────────────────────────────┘ ║
║  │               │                                                        ║
║  │               │    ┌─────────────────────────────────────────────────┐ ║
║  │               │    │ Content Editor                                  │ ║
║  │               │    │ ┌─────────────────────────────────────────────┐ │ ║
║  │               │    │ │ B I U S [H1▼] [Link] [Image] [</>] [...]   │ │ ║
║  │               │    │ ├─────────────────────────────────────────────┤ │ ║
║  │               │    │ │                                             │ │ ║
║  │               │    │ │ Next.js 15 introduces several groundbreaking│ │ ║
║  │               │    │ │ features that revolutionize React...        │ │ ║
║  │               │    │ │                                             │ │ ║
║  │               │    │ │ ## Key Features                             │ │ ║
║  │               │    │ │                                             │ │ ║
║  │               │    │ │ - Server Components                         │ │ ║
║  │               │    │ │ - Improved routing                          │ │ ║
║  │               │    │ │                                             │ │ ║
║  │               │    │ │ [cursor]                                    │ │ ║
║  │               │    │ │                                             │ │ ║
║  │               │    │ └─────────────────────────────────────────────┘ │ ║
║  │               │    │ 📊 1,234 words • 6 min read  ✅ Auto-saved 2s ago│ ║
║  │               │    └─────────────────────────────────────────────────┘ ║
║  │               │                                                        ║
║  └───────────────┴────────────────────────────────────────────────────────║
║                                                                            ║
║  ┌───────────────────────────────────────────────────────────────────────┐ ║
║  │ RIGHT SIDEBAR                                                         │ ║
║  ├───────────────────────────────────────────────────────────────────────┤ ║
║  │ 📋 POST SETTINGS                                                      │ ║
║  │                                                                       │ ║
║  │ Status                                                                │ ║
║  │ [Draft ▼]                                                            │ ║
║  │                                                                       │ ║
║  │ Visibility                                                            │ ║
║  │ ○ Public  ● Private  ○ Password Protected                           │ ║
║  │                                                                       │ ║
║  │ Publish                                                               │ ║
║  │ ○ Immediately  ● Schedule                                            │ ║
║  │ [Feb 15, 2026 at 10:00 AM]                                           │ ║
║  │                                                                       │ ║
║  │ ───────────────────────────────────────────────────────────────────  │ ║
║  │                                                                       │ ║
║  │ 📁 CATEGORIES                                                         │ ║
║  │ ☑ Web Development                                                    │ ║
║  │ ☐ JavaScript                                                         │ ║
║  │ ☑ React                                                              │ ║
║  │ ☐ TypeScript                                                         │ ║
║  │ [+ Add New Category]                                                 │ ║
║  │                                                                       │ ║
║  │ ───────────────────────────────────────────────────────────────────  │ ║
║  │                                                                       │ ║
║  │ 🏷️ TAGS                                                               │ ║
║  │ [nextjs] [react] [server-components]                                │ ║
║  │ [Add tags separated by commas          ]                            │ ║
║  │                                                                       │ ║
║  │ ───────────────────────────────────────────────────────────────────  │ ║
║  │                                                                       │ ║
║  │ 🖼️ FEATURED IMAGE                                                     │ ║
║  │ ┌─────────────────┐                                                  │ ║
║  │ │   [preview]     │                                                  │ ║
║  │ └─────────────────┘                                                  │ ║
║  │ [Set featured image]                                                 │ ║
║  │                                                                       │ ║
║  │ ───────────────────────────────────────────────────────────────────  │ ║
║  │                                                                       │ ║
║  │ 📝 EXCERPT                                                            │ ║
║  │ [Write a short description...                ]                       │ ║
║  │                                                                       │ ║
║  │ ───────────────────────────────────────────────────────────────────  │ ║
║  │                                                                       │ ║
║  │ 🔍 SEO                                                                │ ║
║  │ Meta Title                                                            │ ║
║  │ [Getting Started with Next.js 15 | MyBlog]                          │ ║
║  │ 52/60 characters ✅                                                   │ ║
║  │                                                                       │ ║
║  │ Meta Description                                                      │ ║
║  │ [Learn about the new features in Next.js...]                        │ ║
║  │ 145/160 characters ✅                                                 │ ║
║  │                                                                       │ ║
║  │ Focus Keyword                                                         │ ║
║  │ [next.js 15]                                                         │ ║
║  │ SEO Score: 78/100 🟡                                                  │ ║
║  │                                                                       │ ║
║  └───────────────────────────────────────────────────────────────────────┘ ║
╚═════════════════════════════════════════════════════════════════════════════╝
```

---

## 5. Shopify-Grade Admin Features — Component Breakdown

### 5.1 Global Search (⌘K) — Command Palette

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    GLOBAL SEARCH COMMAND PALETTE                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TRIGGER: Press ⌘K (Mac) or Ctrl+K (Windows) anywhere in admin              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 Search or jump to...                                                │  │
│  │ ┌──────────────────────────────────────────────────────────────────┐   │  │
│  │ │ nextjs                                                            │   │  │
│  │ └──────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                        │  │
│  │ POSTS (3 results)                                                      │  │
│  │ ┌──────────────────────────────────────────────────────────────────┐   │  │
│  │ │ ▸ Getting Started with Next.js 15              Draft • 2 days ago│   │  │
│  │ │ ▸ Next.js Performance Optimization             Published • 1 wk  │   │  │
│  │ │ ▸ Building APIs with Next.js                   Published • 2 wks │   │  │
│  │ └──────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                        │  │
│  │ CATEGORIES (1 result)                                                  │  │
│  │ ┌──────────────────────────────────────────────────────────────────┐   │  │
│  │ │ ▸ Next.js                                      5 posts            │   │  │
│  │ └──────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                        │  │
│  │ ACTIONS                                                                │  │
│  │ ┌──────────────────────────────────────────────────────────────────┐   │  │
│  │ │ + Create new post                              ⌘N                 │   │  │
│  │ │ 🌐 View site                                   ⌘⇧V                │   │  │
│  │ │ ⚙️ Open settings                               ⌘,                 │   │  │
│  │ └──────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                        │  │
│  │ ↑↓ Navigate  •  ⏎ Select  •  Esc Close                               │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  FEATURES:                                                                   │
│  • Instant search across all content types                                  │
│  • Fuzzy matching (typo-tolerant)                                           │
│  • Recent searches history                                                  │
│  • Quick actions (create, navigate, settings)                               │
│  • Keyboard-first navigation                                                │
│  • Search operators (type:post status:draft category:tech)                  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Bulk Actions Toolbar

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    BULK ACTIONS TOOLBAR PATTERN                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STATE 1: NO SELECTION                                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ☐ Posts (15)                            [+ New Post]  [Filter ▼]  [⋯] │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STATE 2: ITEMS SELECTED (3 of 15)                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ☑ 3 selected    [Publish] [Move to Draft] [Delete] [More ▼]  [Deselect│  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STATE 3: ALL ON PAGE SELECTED                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ☑ All 10 on this page selected  [Select all 15 posts] [Actions ▼]     │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  STATE 4: ALL ITEMS SELECTED                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ ☑ All 15 posts selected  [Publish (15)] [Delete (15)] [More ▼] [Clear]│  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  BULK ACTIONS MENU:                                                          │
│  ┌────────────────────────┐                                                  │
│  │ Change Status      ▸   │ ─┐                                               │
│  │ Set Category       ▸   │  │                                               │
│  │ Add Tags           ▸   │  │ Submenu opens on hover/click                 │
│  │ ─────────────────────  │  │                                               │
│  │ Export as CSV          │  │                                               │
│  │ Export as JSON         │ ─┘                                               │
│  │ ─────────────────────  │                                                  │
│  │ 🗑️ Delete (3)          │                                                  │
│  └────────────────────────┘                                                  │
│                                                                              │
│  KEYBOARD SHORTCUTS:                                                         │
│  • ⌘A: Select all visible items                                             │
│  • ⌘⇧A: Select all items (across pages)                                     │
│  • Esc: Deselect all                                                        │
│  • ⌘⌫: Delete selected                                                      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.3 Advanced Filters Panel

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    ADVANCED FILTERS PANEL                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 Filters                                          [Save View] [Clear] │  │
│  ├────────────────────────────────────────────────────────────────────────┤  │
│  │                                                                        │  │
│  │ Status                                                                 │  │
│  │ ☐ All (15)  ☑ Published (12)  ☐ Draft (2)  ☐ Scheduled (1)          │  │
│  │                                                                        │  │
│  │ Category                                                               │  │
│  │ ┌──────────────────────────────────────┐                              │  │
│  │ │ [Select categories...             ▼] │                              │  │
│  │ └──────────────────────────────────────┘                              │  │
│  │ Selected: Web Development, React                                       │  │
│  │                                                                        │  │
│  │ Author                                                                 │  │
│  │ ○ Any  ● John Doe  ○ Jane Smith  ○ Multiple Authors                  │  │
│  │                                                                        │  │
│  │ Date Range                                                             │  │
│  │ ┌────────────────┐  to  ┌────────────────┐                           │  │
│  │ │ [Feb 1, 2026 ]│     │ [Feb 13, 2026]│                           │  │
│  │ └────────────────┘      └────────────────┘                           │  │
│  │ Quick: [Today] [Last 7 days] [Last 30 days] [This year]              │  │
│  │                                                                        │  │
│  │ Tags (any of)                                                          │  │
│  │ ┌──────────────────────────────────────┐                              │  │
│  │ │ [react, nextjs, typescript        ] │                              │  │
│  │ └──────────────────────────────────────┘                              │  │
│  │                                                                        │  │
│  │ Views                                                                  │  │
│  │ ┌─────────┬─────────┐                                                 │  │
│  │ │ Min [0] │ Max [∞]│                                                 │  │
│  │ └─────────┴─────────┘                                                 │  │
│  │                                                                        │  │
│  │ Has Comments                                                           │  │
│  │ ○ Any  ● Yes  ○ No                                                    │  │
│  │                                                                        │  │
│  │ ─────────────────────────────────────────────────────────────────────  │  │
│  │                                                                        │  │
│  │ [Apply Filters (8 matches)]          [Reset]                         │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  SAVED VIEWS:                                                                │
│  • My Drafts                                                                 │
│  • High Priority                                                             │
│  • Needs Review                                                              │
│  • Published This Week                                                       │
│  • [+ Save current filters as view]                                          │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Implementation Phases — Roadmap

### 6.1 Phase 1: Blogger Foundation (Weeks 1-2)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 1: BLOGGER FOUNDATION                               │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WEEK 1: Database & Core Tables                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Day 1-2: Schema Design & Migration                                     │  │
│  │ • Create blogs table (parent for blogger site type)                    │  │
│  │ • Create blog_posts table (title, content, slug, status, etc.)        │  │
│  │ • Create categories table (hierarchical with parent_id)               │  │
│  │ • Create tags table                                                    │  │
│  │ • Create post_tags junction table                                      │  │
│  │ • Create authors table                                                 │  │
│  │ • Create comments table (with threading support)                       │  │
│  │ • Set up all RLS policies                                              │  │
│  │ • Create database functions (slug generation, reading time calc)       │  │
│  │                                                                        │  │
│  │ Day 3-4: API Layer                                                      │  │
│  │ • Blog CRUD endpoints                                                  │  │
│  │ • Post CRUD endpoints with versioning                                  │  │
│  │ • Category CRUD endpoints                                              │  │
│  │ • Tag CRUD endpoints with autocomplete                                 │  │
│  │ • Comment moderation endpoints                                         │  │
│  │ • SEO metadata endpoints                                               │  │
│  │                                                                        │  │
│  │ Day 5: Testing & Documentation                                         │  │
│  │ • Unit tests for all database functions                               │  │
│  │ • API endpoint testing                                                 │  │
│  │ • Database performance optimization                                    │  │
│  │ • API documentation (OpenAPI/Swagger)                                  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  WEEK 2: Blogger Admin UI                                                   │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Day 1-2: Dashboard & Navigation                                        │  │
│  │ • Blogger dashboard with metrics                                       │  │
│  │ • Dynamic sidebar for blogger site type                               │  │
│  │ • Quick actions panel                                                  │  │
│  │ • Recent activity feed                                                 │  │
│  │                                                                        │  │
│  │ Day 3-4: Posts List & Editor                                           │  │
│  │ • Posts list view with status filters                                 │  │
│  │ • Rich text editor integration (TinyMCE or Tiptap)                    │  │
│  │ • Markdown support                                                     │  │
│  │ • Auto-save functionality                                              │  │
│  │ • Media picker integration                                             │  │
│  │ • SEO panel (meta title, description, keywords)                       │  │
│  │                                                                        │  │
│  │ Day 5: Categories, Tags & Testing                                      │  │
│  │ • Category manager (hierarchical tree view)                            │  │
│  │ • Tag manager with autocomplete                                        │  │
│  │ • Comment moderation interface                                         │  │
│  │ • Integration testing                                                   │  │
│  │ • E2E testing with Playwright                                          │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  DELIVERABLES:                                                               │
│  ✅ Complete blogger site type with all CRUD operations                      │
│  ✅ Rich text editor with markdown support                                   │
│  ✅ Category & tag management                                                │
│  ✅ Comment moderation system                                                │
│  ✅ SEO metadata panel                                                       │
│  ✅ Auto-save & draft system                                                 │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Phase 2: Admin Panel Enhancement (Weeks 3-4)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: ADMIN PANEL ENHANCEMENT                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WEEK 3: Core Admin UX Upgrades                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Day 1-2: Bulk Actions System                                           │  │
│  │ • Multi-select checkbox system (all types)                             │  │
│  │ • Bulk action toolbar (publish, draft, delete, export)                 │  │
│  │ • Select all / select page / custom selection                         │  │
│  │ • Confirmation dialogs with undo support                              │  │
│  │ • Optimistic UI updates with rollback                                  │  │
│  │                                                                        │  │
│  │ Day 3-4: Advanced Search & Filtering                                   │  │
│  │ • Global search (⌘K) command palette                                   │  │
│  │ • Fuzzy search with Fuse.js or MiniSearch                             │  │
│  │ • Multi-criteria filter panel                                          │  │
│  │ • Saved views (custom filter presets)                                  │  │
│  │ • Search operators (type:post status:draft)                           │  │
│  │ • Search history with recent queries                                   │  │
│  │                                                                        │  │
│  │ Day 5: Column Customization                                            │  │
│  │ • Show/hide columns per list view                                      │  │
│  │ • Column reorder via drag-drop                                        │  │
│  │ • Column width persistence (localStorage)                             │  │
│  │ • Column sort (multi-column sorting)                                  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  WEEK 4: Enterprise Features Layer                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Day 1-2: Keyboard Shortcuts System                                     │  │
│  │ • Global shortcut registry (hotkeys-js)                               │  │
│  │ • Context-aware shortcuts (different per view)                        │  │
│  │ • Shortcut overlay panel (press ? to show)                            │  │
│  │ • Save (⌘S), New (⌘N), Search (⌘K), Delete (⌘⌫)                      │  │
│  │                                                                        │  │
│  │ Day 3-4: Auto-save & Version History                                   │  │
│  │ • Debounced auto-save (2s after last edit)                            │  │
│  │ • Save status indicator (Saving... / Saved / Error)                   │  │
│  │ • Version snapshots on manual save                                     │  │
│  │ • Diff view between versions (diff-match-patch)                       │  │
│  │ • Restore from any previous version                                    │  │
│  │                                                                        │  │
│  │ Day 5: Activity Logs & Audit Trail                                     │  │
│  │ • Log all CRUD operations with actor, timestamp, changes              │  │
│  │ • Activity timeline in item detail view                               │  │
│  │ • Global activity feed on dashboard                                    │  │
│  │ • Filter by action type, user, date range                             │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  DELIVERABLES:                                                               │
│  ✅ Bulk actions on all list views                                           │
│  ✅ Global search command palette (⌘K)                                       │
│  ✅ Advanced filter panel with saved views                                   │
│  ✅ Full keyboard shortcut system                                            │
│  ✅ Auto-save with version history & diff view                               │
│  ✅ Activity logs & audit trail                                              │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.3 Phase 3: E-commerce & Media Enhancements (Weeks 5-6)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 3: E-COMMERCE & MEDIA ENHANCEMENTS                  │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WEEK 5: E-commerce Power Features                                          │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ • Inventory management (stock levels, low-stock alerts, SKU tracking) │  │
│  │ • Multi-currency support (INR, USD, EUR — auto-conversion)            │  │
│  │ • Tax engine (GST for India, VAT for EU, Sales Tax for US)            │  │
│  │ • Advanced coupon engine (BOGO, tiered discounts, usage limits)       │  │
│  │ • Product variants (size, color, material — matrix view)              │  │
│  │ • Shipping zones & rate calculator                                     │  │
│  │ • Order status workflow (pending → processing → shipped → delivered)  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  WEEK 6: Media Library & Inline Editing                                     │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ • Centralized media library (grid/list view, drag-drop upload)        │  │
│  │ • Image optimization pipeline (resize, compress, WebP conversion)     │  │
│  │ • Media picker modal (select from library or upload new)              │  │
│  │ • Inline editing on list views (double-click to edit)                 │  │
│  │ • Batch image upload with progress bars                               │  │
│  │ • Image alt text & metadata editing                                    │  │
│  │ • Media usage tracking (where is this image used?)                    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.4 Phase 4: Analytics & Reporting (Weeks 7-8)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 4: ANALYTICS & REPORTING                            │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WEEK 7: Analytics Dashboard                                                │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ • Customizable dashboard with drag-drop widgets                       │  │
│  │ • Real-time metrics with sparkline charts (Recharts/Chart.js)         │  │
│  │ • Page views, unique visitors, bounce rate, session duration          │  │
│  │ • Top content (posts, products, pages) by views/conversions           │  │
│  │ • Traffic sources breakdown (organic, social, direct, referral)       │  │
│  │ • Geographic heatmap of visitors                                       │  │
│  │ • Device & browser analytics                                          │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  WEEK 8: Reporting Engine & Export                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ • Scheduled reports (daily/weekly/monthly email digests)              │  │
│  │ • Export system (CSV, Excel, JSON, PDF)                               │  │
│  │ • Custom report builder (pick metrics, date range, filters)          │  │
│  │ • Revenue reports (for e-commerce sites)                              │  │
│  │ • SEO performance reports (keyword rankings, click-through rates)    │  │
│  │ • Content performance reports (engagement, time on page)             │  │
│  │ • Comparison reports (this month vs last month)                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.5 Phase 5: Performance & API (Weeks 9-10)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 5: PERFORMANCE & API LAYER                          │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WEEK 9: Performance Optimization                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ • Redis caching layer (site data, frequently accessed content)        │  │
│  │ • Database query optimization (eliminate N+1, add indexes)            │  │
│  │ • Optimistic UI updates (instant perceived responses)                 │  │
│  │ • React Server Components for initial page loads                      │  │
│  │ • Edge caching with Vercel/Cloudflare (stale-while-revalidate)       │  │
│  │ • Image CDN with automatic format negotiation                         │  │
│  │ • Bundle splitting & lazy loading for admin routes                    │  │
│  │ • Virtual scrolling for large lists (TanStack Virtual)                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  WEEK 10: REST API & Webhooks                                               │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ • Public REST API (CRUD for all content types)                        │  │
│  │ • API key management (generate, revoke, rate-limit per key)          │  │
│  │ • Webhook system (content.created, content.updated, order.placed)    │  │
│  │ • Webhook retry logic with exponential backoff                       │  │
│  │ • API documentation (OpenAPI 3.0 / Swagger UI)                       │  │
│  │ • GraphQL endpoint (optional, for advanced integrations)             │  │
│  │ • Rate limiting (100 req/min per API key)                            │  │
│  │ • API usage analytics dashboard                                       │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 6.6 Phase 6: Testing & Deployment (Weeks 11-12)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 6: TESTING & DEPLOYMENT                             │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WEEK 11: Comprehensive Testing                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ • Unit tests for all database functions (Vitest)                      │  │
│  │ • Integration tests for API endpoints                                  │  │
│  │ • E2E tests with Playwright (critical user flows)                     │  │
│  │   - Blogger: Create post → Publish → View on storefront              │  │
│  │   - E-commerce: Add product → Create order → Process payment         │  │
│  │   - Admin: Bulk select → Bulk action → Verify results                │  │
│  │ • Performance testing (Lighthouse CI, Web Vitals)                     │  │
│  │ • Security audit (OWASP Top 10, RLS policy verification)             │  │
│  │ • Accessibility testing (axe-core, WCAG 2.1 AAA)                     │  │
│  │ • Cross-browser testing (Chrome, Safari, Firefox, Edge)              │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  WEEK 12: Production Deployment                                             │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ • Staging environment validation                                       │  │
│  │ • Database migration scripts (idempotent, reversible)                 │  │
│  │ • Feature flags for gradual rollout                                   │  │
│  │ • Monitoring & alerting (Sentry, Vercel Analytics)                    │  │
│  │ • CDN cache warming for critical assets                               │  │
│  │ • DNS propagation verification (all subdomains)                       │  │
│  │ • Load testing (simulate 1000 concurrent admin users)                 │  │
│  │ • Runbook documentation for on-call engineers                         │  │
│  │ • Post-launch monitoring checklist (48-hour watch)                    │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

> **End of Part 1** — Continue to Part 2 for Complete Database Schema with Blogger Tables

---

## 7. Complete Database Schema — Blogger Tables & Enterprise Features

> **Part 2 of 8** | Database Schema, Relationships, RLS Policies, Functions & Indexes

### 7.1 Blogger Core Tables

```sql
-- ============================================
-- BLOGS TABLE (Parent entity for blogger sites)
-- ============================================
CREATE TABLE blogs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  
  -- Blog Identity
  title VARCHAR(200) NOT NULL DEFAULT 'My Blog',
  description TEXT,
  logo_url TEXT,
  cover_image_url TEXT,
  
  -- Settings
  posts_per_page INTEGER DEFAULT 10 CHECK (posts_per_page BETWEEN 1 AND 50),
  default_comment_status VARCHAR(20) DEFAULT 'open' CHECK (default_comment_status IN ('open', 'closed', 'approval_required')),
  date_format VARCHAR(30) DEFAULT 'MMMM DD, YYYY',
  time_format VARCHAR(20) DEFAULT 'hh:mm A',
  timezone VARCHAR(50) DEFAULT 'Asia/Kolkata',
  
  -- SEO
  meta_title VARCHAR(70),
  meta_description VARCHAR(160),
  og_image_url TEXT,
  
  -- Layout & Theme
  layout VARCHAR(20) DEFAULT 'standard' CHECK (layout IN ('standard', 'magazine', 'minimal', 'grid')),
  sidebar_position VARCHAR(10) DEFAULT 'right' CHECK (sidebar_position IN ('left', 'right', 'none')),
  theme_settings JSONB DEFAULT '{}',
  custom_css TEXT,
  
  -- Social Links
  social_links JSONB DEFAULT '{}',
  -- e.g.: {"twitter": "...", "github": "...", "linkedin": "..."}
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_blog_per_site UNIQUE (site_id)
);

CREATE INDEX idx_blogs_site_id ON blogs(site_id);

-- ============================================
-- AUTHORS TABLE (Multi-author support)
-- ============================================
CREATE TABLE blog_authors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Author Profile
  display_name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  website_url TEXT,
  social_links JSONB DEFAULT '{}',
  
  -- Role
  role VARCHAR(20) DEFAULT 'author' CHECK (role IN ('owner', 'editor', 'author', 'contributor')),
  
  -- Stats (denormalized for performance)
  post_count INTEGER DEFAULT 0,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_author_slug_per_blog UNIQUE (blog_id, slug)
);

CREATE INDEX idx_blog_authors_blog_id ON blog_authors(blog_id);
CREATE INDEX idx_blog_authors_user_id ON blog_authors(user_id);
```

### 7.2 Blog Posts & Content Tables

```sql
-- ============================================
-- BLOG POSTS TABLE (Core content entity)
-- ============================================
CREATE TABLE blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES blog_authors(id) ON DELETE RESTRICT,
  
  -- Content
  title VARCHAR(300) NOT NULL,
  slug VARCHAR(300) NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  content_html TEXT, -- Pre-rendered HTML for performance
  excerpt TEXT,
  
  -- Media
  featured_image_url TEXT,
  featured_image_alt VARCHAR(200),
  featured_image_caption TEXT,
  
  -- Publishing
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'scheduled', 'published', 'archived')),
  visibility VARCHAR(20) DEFAULT 'public' CHECK (visibility IN ('public', 'private', 'password_protected')),
  password_hash TEXT, -- For password-protected posts
  published_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ, -- For scheduled publishing
  
  -- SEO
  meta_title VARCHAR(70),
  meta_description VARCHAR(160),
  focus_keyword VARCHAR(100),
  canonical_url TEXT,
  og_title VARCHAR(100),
  og_description VARCHAR(200),
  og_image_url TEXT,
  twitter_card_type VARCHAR(20) DEFAULT 'summary_large_image',
  schema_markup JSONB, -- Schema.org Article/BlogPosting
  no_index BOOLEAN DEFAULT FALSE,
  
  -- Engagement Settings
  comment_status VARCHAR(20) DEFAULT 'open' CHECK (comment_status IN ('open', 'closed')),
  allow_reactions BOOLEAN DEFAULT TRUE,
  
  -- Metrics (denormalized)
  view_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  reaction_count INTEGER DEFAULT 0,
  share_count INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  reading_time_minutes INTEGER DEFAULT 0,
  
  -- Versioning
  version INTEGER DEFAULT 1,
  is_autosave BOOLEAN DEFAULT FALSE,
  parent_post_id UUID REFERENCES blog_posts(id) ON DELETE SET NULL, -- For revisions
  
  -- Pinning & Ordering
  is_pinned BOOLEAN DEFAULT FALSE,
  sort_order INTEGER DEFAULT 0,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_post_slug_per_blog UNIQUE (blog_id, slug)
);

CREATE INDEX idx_blog_posts_blog_id ON blog_posts(blog_id);
CREATE INDEX idx_blog_posts_author_id ON blog_posts(author_id);
CREATE INDEX idx_blog_posts_status ON blog_posts(status);
CREATE INDEX idx_blog_posts_published_at ON blog_posts(published_at DESC);
CREATE INDEX idx_blog_posts_slug ON blog_posts(blog_id, slug);
CREATE INDEX idx_blog_posts_views ON blog_posts(view_count DESC);
CREATE INDEX idx_blog_posts_composite ON blog_posts(blog_id, status, published_at DESC);

-- ============================================
-- CATEGORIES TABLE (Hierarchical taxonomy)
-- ============================================
CREATE TABLE blog_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES blog_categories(id) ON DELETE SET NULL,
  
  -- Category Details
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) NOT NULL,
  description TEXT,
  cover_image_url TEXT,
  color VARCHAR(7), -- Hex color for category badges
  icon VARCHAR(50), -- Emoji or icon class
  
  -- SEO
  meta_title VARCHAR(70),
  meta_description VARCHAR(160),
  
  -- Stats (denormalized)
  post_count INTEGER DEFAULT 0,
  
  -- Ordering
  sort_order INTEGER DEFAULT 0,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_category_slug_per_blog UNIQUE (blog_id, slug)
);

CREATE INDEX idx_blog_categories_blog_id ON blog_categories(blog_id);
CREATE INDEX idx_blog_categories_parent_id ON blog_categories(parent_id);

-- ============================================
-- TAGS TABLE (Flat taxonomy)
-- ============================================
CREATE TABLE blog_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  
  name VARCHAR(50) NOT NULL,
  slug VARCHAR(50) NOT NULL,
  description TEXT,
  color VARCHAR(7),
  
  -- Stats (denormalized)
  post_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_tag_slug_per_blog UNIQUE (blog_id, slug)
);

CREATE INDEX idx_blog_tags_blog_id ON blog_tags(blog_id);

-- ============================================
-- POST-CATEGORY JUNCTION TABLE
-- ============================================
CREATE TABLE blog_post_categories (
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES blog_categories(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT FALSE,
  
  PRIMARY KEY (post_id, category_id)
);

-- ============================================
-- POST-TAG JUNCTION TABLE
-- ============================================
CREATE TABLE blog_post_tags (
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES blog_tags(id) ON DELETE CASCADE,
  
  PRIMARY KEY (post_id, tag_id)
);
```

### 7.3 Comments & Engagement Tables

```sql
-- ============================================
-- COMMENTS TABLE (Threaded comments)
-- ============================================
CREATE TABLE blog_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES blog_comments(id) ON DELETE CASCADE,
  
  -- Author (can be authenticated user or guest)
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_name VARCHAR(100) NOT NULL,
  author_email VARCHAR(255),
  author_url TEXT,
  author_ip INET,
  author_user_agent TEXT,
  
  -- Content
  content TEXT NOT NULL,
  content_html TEXT,
  
  -- Moderation
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'spam', 'trash')),
  moderated_at TIMESTAMPTZ,
  moderated_by UUID REFERENCES auth.users(id),
  
  -- Engagement
  like_count INTEGER DEFAULT 0,
  
  -- Threading
  depth INTEGER DEFAULT 0 CHECK (depth <= 5), -- Max nesting depth
  thread_path TEXT, -- Materialized path for efficient tree queries
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blog_comments_post_id ON blog_comments(post_id);
CREATE INDEX idx_blog_comments_parent_id ON blog_comments(parent_id);
CREATE INDEX idx_blog_comments_status ON blog_comments(status);
CREATE INDEX idx_blog_comments_thread ON blog_comments(thread_path);

-- ============================================
-- REACTIONS TABLE (Post reactions)
-- ============================================
CREATE TABLE blog_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id VARCHAR(100), -- For anonymous reactions
  
  reaction_type VARCHAR(20) NOT NULL CHECK (reaction_type IN ('like', 'love', 'insightful', 'clap', 'fire')),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_reaction_per_user UNIQUE (post_id, user_id, reaction_type),
  CONSTRAINT unique_reaction_per_session UNIQUE (post_id, session_id, reaction_type)
);

CREATE INDEX idx_blog_reactions_post_id ON blog_reactions(post_id);

-- ============================================
-- EMAIL SUBSCRIBERS TABLE (Newsletter)
-- ============================================
CREATE TABLE blog_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blog_id UUID NOT NULL REFERENCES blogs(id) ON DELETE CASCADE,
  
  email VARCHAR(255) NOT NULL,
  name VARCHAR(100),
  
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced')),
  
  -- Double opt-in
  confirmed_at TIMESTAMPTZ,
  confirmation_token VARCHAR(100),
  
  -- Preferences
  frequency VARCHAR(20) DEFAULT 'weekly' CHECK (frequency IN ('every_post', 'daily', 'weekly', 'monthly')),
  
  -- Tracking
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  
  CONSTRAINT unique_subscriber_per_blog UNIQUE (blog_id, email)
);

CREATE INDEX idx_blog_subscribers_blog_id ON blog_subscribers(blog_id);
CREATE INDEX idx_blog_subscribers_status ON blog_subscribers(status);
```

### 7.4 Enterprise Feature Tables (Cross-Cutting)

```sql
-- ============================================
-- ACTIVITY LOGS TABLE (Audit trail)
-- ============================================
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Action Details
  action VARCHAR(30) NOT NULL CHECK (action IN (
    'create', 'update', 'delete', 'publish', 'unpublish',
    'archive', 'restore', 'bulk_update', 'bulk_delete',
    'login', 'logout', 'settings_change', 'export', 'import'
  )),
  entity_type VARCHAR(50) NOT NULL, -- 'blog_post', 'product', 'order', etc.
  entity_id UUID,
  entity_title VARCHAR(300), -- Snapshot of title at time of action
  
  -- Change Details
  changes JSONB, -- {"field": {"old": "...", "new": "..."}}
  metadata JSONB DEFAULT '{}', -- Additional context
  
  -- Client Info
  ip_address INET,
  user_agent TEXT,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_logs_site_id ON activity_logs(site_id);
CREATE INDEX idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX idx_activity_logs_entity ON activity_logs(entity_type, entity_id);
CREATE INDEX idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_action ON activity_logs(action);

-- ============================================
-- CONTENT VERSIONS TABLE (Version history)
-- ============================================
CREATE TABLE content_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID NOT NULL,
  
  -- Version Info
  version_number INTEGER NOT NULL,
  title VARCHAR(300),
  content TEXT,
  metadata JSONB, -- All other fields as JSON snapshot
  
  -- Snapshot
  snapshot JSONB NOT NULL, -- Complete entity state at this version
  
  -- Change Summary
  change_summary TEXT, -- Auto-generated or user-provided
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  CONSTRAINT unique_version UNIQUE (entity_type, entity_id, version_number)
);

CREATE INDEX idx_content_versions_entity ON content_versions(entity_type, entity_id);
CREATE INDEX idx_content_versions_created ON content_versions(created_at DESC);

-- ============================================
-- MEDIA LIBRARY TABLE (Centralized media)
-- ============================================
CREATE TABLE media_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- File Info
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  file_size BIGINT NOT NULL, -- In bytes
  storage_path TEXT NOT NULL, -- Supabase Storage path
  public_url TEXT NOT NULL,
  
  -- Image-specific
  width INTEGER,
  height INTEGER,
  thumbnail_url TEXT,
  blurhash VARCHAR(100), -- Blur hash for lazy loading placeholders
  
  -- Metadata
  alt_text VARCHAR(200),
  caption TEXT,
  title VARCHAR(200),
  description TEXT,
  
  -- Organization
  folder VARCHAR(200) DEFAULT '/',
  tags TEXT[] DEFAULT '{}',
  
  -- Usage Tracking
  usage_count INTEGER DEFAULT 0,
  used_in JSONB DEFAULT '[]', -- [{"type": "blog_post", "id": "...", "field": "featured_image"}]
  
  -- Tracking
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_media_library_site_id ON media_library(site_id);
CREATE INDEX idx_media_library_mime ON media_library(mime_type);
CREATE INDEX idx_media_library_folder ON media_library(site_id, folder);
CREATE INDEX idx_media_library_tags ON media_library USING GIN (tags);

-- ============================================
-- SAVED VIEWS TABLE (Custom filter presets)
-- ============================================
CREATE TABLE saved_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- View Details
  name VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL, -- 'blog_post', 'product', etc.
  filters JSONB NOT NULL, -- Filter criteria
  sort_by VARCHAR(50),
  sort_direction VARCHAR(4) DEFAULT 'desc',
  columns TEXT[] DEFAULT '{}', -- Visible columns
  
  -- Meta
  is_default BOOLEAN DEFAULT FALSE,
  is_shared BOOLEAN DEFAULT FALSE, -- Visible to other admins
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_views_user ON saved_views(user_id, entity_type);

-- ============================================
-- NOTIFICATIONS TABLE
-- ============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Notification Details
  type VARCHAR(50) NOT NULL, -- 'comment_new', 'order_placed', 'low_stock', etc.
  title VARCHAR(200) NOT NULL,
  message TEXT,
  action_url TEXT,
  
  -- State
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);
```

### 7.5 RLS Policies (Row Level Security)

```sql
-- ============================================
-- RLS POLICIES FOR ALL BLOGGER TABLES
-- ============================================
ALTER TABLE blogs ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_authors ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user owns a site
CREATE OR REPLACE FUNCTION user_owns_site(site_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM sites
    WHERE id = site_uuid AND custom_user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: Get blog_id from site
CREATE OR REPLACE FUNCTION get_blog_id_for_site(site_uuid UUID)
RETURNS UUID AS $$
  SELECT id FROM blogs WHERE site_id = site_uuid LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Blogs: Owner can CRUD
CREATE POLICY "blog_owner_all" ON blogs FOR ALL
  USING (user_owns_site(site_id))
  WITH CHECK (user_owns_site(site_id));

-- Blog posts: Owner can CRUD, public can read published
CREATE POLICY "blog_posts_owner" ON blog_posts FOR ALL
  USING (EXISTS (SELECT 1 FROM blogs WHERE id = blog_id AND user_owns_site(site_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM blogs WHERE id = blog_id AND user_owns_site(site_id)));

CREATE POLICY "blog_posts_public_read" ON blog_posts FOR SELECT
  USING (status = 'published' AND visibility = 'public');

-- Categories: Owner CRUD, public read
CREATE POLICY "blog_categories_owner" ON blog_categories FOR ALL
  USING (EXISTS (SELECT 1 FROM blogs WHERE id = blog_id AND user_owns_site(site_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM blogs WHERE id = blog_id AND user_owns_site(site_id)));

CREATE POLICY "blog_categories_public" ON blog_categories FOR SELECT
  USING (TRUE);

-- Tags: Owner CRUD, public read
CREATE POLICY "blog_tags_owner" ON blog_tags FOR ALL
  USING (EXISTS (SELECT 1 FROM blogs WHERE id = blog_id AND user_owns_site(site_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM blogs WHERE id = blog_id AND user_owns_site(site_id)));

CREATE POLICY "blog_tags_public" ON blog_tags FOR SELECT
  USING (TRUE);

-- Comments: Owner moderates, public can insert (pending), public reads approved
CREATE POLICY "blog_comments_owner" ON blog_comments FOR ALL
  USING (EXISTS (
    SELECT 1 FROM blog_posts bp
    JOIN blogs b ON bp.blog_id = b.id
    WHERE bp.id = post_id AND user_owns_site(b.site_id)
  ));

CREATE POLICY "blog_comments_public_read" ON blog_comments FOR SELECT
  USING (status = 'approved');

CREATE POLICY "blog_comments_public_insert" ON blog_comments FOR INSERT
  WITH CHECK (TRUE);

-- Activity logs: Owner read-only, system inserts via function
CREATE POLICY "activity_logs_owner_read" ON activity_logs FOR SELECT
  USING (user_owns_site(site_id));

-- Media library: Owner CRUD
CREATE POLICY "media_owner" ON media_library FOR ALL
  USING (user_owns_site(site_id))
  WITH CHECK (user_owns_site(site_id));

-- Saved views: User's own views
CREATE POLICY "saved_views_owner" ON saved_views FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Notifications: User's own notifications
CREATE POLICY "notifications_owner" ON notifications FOR ALL
  USING (user_id = auth.uid());
```

### 7.6 Database Functions & Triggers

```sql
-- ============================================
-- AUTO-GENERATE SLUG FROM TITLE
-- ============================================
CREATE OR REPLACE FUNCTION generate_slug(title TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN LOWER(
    REGEXP_REPLACE(
      REGEXP_REPLACE(
        TRIM(title),
        '[^a-zA-Z0-9\s-]', '', 'g'
      ),
      '\s+', '-', 'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- CALCULATE READING TIME
-- ============================================
CREATE OR REPLACE FUNCTION calculate_reading_time(content TEXT)
RETURNS INTEGER AS $$
DECLARE
  word_count INTEGER;
  reading_speed INTEGER := 200; -- Average words per minute
BEGIN
  word_count := ARRAY_LENGTH(REGEXP_SPLIT_TO_ARRAY(TRIM(content), '\s+'), 1);
  RETURN GREATEST(1, CEIL(word_count::DECIMAL / reading_speed));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================
-- AUTO-UPDATE WORD COUNT & READING TIME ON INSERT/UPDATE
-- ============================================
CREATE OR REPLACE FUNCTION update_post_metadata()
RETURNS TRIGGER AS $$
BEGIN
  NEW.word_count := ARRAY_LENGTH(REGEXP_SPLIT_TO_ARRAY(TRIM(COALESCE(NEW.content, '')), '\s+'), 1);
  NEW.reading_time_minutes := GREATEST(1, CEIL(NEW.word_count::DECIMAL / 200));
  NEW.updated_at := NOW();
  
  -- Auto-set published_at when status changes to 'published'
  IF NEW.status = 'published' AND (OLD IS NULL OR OLD.status != 'published') THEN
    NEW.published_at := COALESCE(NEW.published_at, NOW());
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_post_metadata
  BEFORE INSERT OR UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_post_metadata();

-- ============================================
-- AUTO-UPDATE CATEGORY POST COUNT
-- ============================================
CREATE OR REPLACE FUNCTION update_category_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE blog_categories SET post_count = (
      SELECT COUNT(*) FROM blog_post_categories WHERE category_id = OLD.category_id
    ) WHERE id = OLD.category_id;
  END IF;
  
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE blog_categories SET post_count = (
      SELECT COUNT(*) FROM blog_post_categories WHERE category_id = NEW.category_id
    ) WHERE id = NEW.category_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_category_count
  AFTER INSERT OR UPDATE OR DELETE ON blog_post_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_category_post_count();

-- ============================================
-- AUTO-UPDATE TAG POST COUNT
-- ============================================
CREATE OR REPLACE FUNCTION update_tag_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    UPDATE blog_tags SET post_count = (
      SELECT COUNT(*) FROM blog_post_tags WHERE tag_id = OLD.tag_id
    ) WHERE id = OLD.tag_id;
  END IF;
  
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE blog_tags SET post_count = (
      SELECT COUNT(*) FROM blog_post_tags WHERE tag_id = NEW.tag_id
    ) WHERE id = NEW.tag_id;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_tag_count
  AFTER INSERT OR UPDATE OR DELETE ON blog_post_tags
  FOR EACH ROW
  EXECUTE FUNCTION update_tag_post_count();

-- ============================================
-- AUTO-LOG ACTIVITY (Insert into activity_logs on mutations)
-- ============================================
CREATE OR REPLACE FUNCTION log_activity()
RETURNS TRIGGER AS $$
DECLARE
  v_site_id UUID;
  v_entity_title TEXT;
BEGIN
  -- Determine site_id based on table
  CASE TG_TABLE_NAME
    WHEN 'blog_posts' THEN
      SELECT b.site_id INTO v_site_id FROM blogs b WHERE b.id = COALESCE(NEW, OLD).blog_id;
      v_entity_title := COALESCE(NEW, OLD).title;
    WHEN 'blog_categories' THEN
      SELECT b.site_id INTO v_site_id FROM blogs b WHERE b.id = COALESCE(NEW, OLD).blog_id;
      v_entity_title := COALESCE(NEW, OLD).name;
    WHEN 'blog_tags' THEN
      SELECT b.site_id INTO v_site_id FROM blogs b WHERE b.id = COALESCE(NEW, OLD).blog_id;
      v_entity_title := COALESCE(NEW, OLD).name;
    ELSE
      v_site_id := COALESCE(NEW, OLD).site_id;
  END CASE;
  
  INSERT INTO activity_logs (site_id, user_id, action, entity_type, entity_id, entity_title, changes)
  VALUES (
    v_site_id,
    auth.uid(),
    CASE TG_OP
      WHEN 'INSERT' THEN 'create'
      WHEN 'UPDATE' THEN 'update'
      WHEN 'DELETE' THEN 'delete'
    END,
    TG_TABLE_NAME,
    COALESCE(NEW, OLD).id,
    v_entity_title,
    CASE WHEN TG_OP = 'UPDATE' THEN
      jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW))
    ELSE NULL END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply activity logging triggers to key tables
CREATE TRIGGER trg_log_blog_posts AFTER INSERT OR UPDATE OR DELETE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION log_activity();
CREATE TRIGGER trg_log_blog_categories AFTER INSERT OR UPDATE OR DELETE ON blog_categories
  FOR EACH ROW EXECUTE FUNCTION log_activity();
CREATE TRIGGER trg_log_blog_comments AFTER INSERT OR UPDATE OR DELETE ON blog_comments
  FOR EACH ROW EXECUTE FUNCTION log_activity();

-- ============================================
-- AUTO-CREATE VERSION SNAPSHOT ON POST UPDATE
-- ============================================
CREATE OR REPLACE FUNCTION create_version_snapshot()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO content_versions (site_id, entity_type, entity_id, version_number, title, content, snapshot)
    SELECT
      b.site_id,
      'blog_post',
      OLD.id,
      OLD.version,
      OLD.title,
      OLD.content,
      to_jsonb(OLD)
    FROM blogs b WHERE b.id = OLD.blog_id;
    
    NEW.version := OLD.version + 1;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_version_blog_posts
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW
  EXECUTE FUNCTION create_version_snapshot();
```

### 7.7 Entity Relationship Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    BLOGGER DATABASE — ENTITY RELATIONSHIPS                    │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  sites ──────────1:1──────────── blogs                                       │
│                                   │                                          │
│                    ┌──────────────┼──────────────┐                           │
│                    │              │              │                           │
│                    ▼              ▼              ▼                           │
│              blog_authors   blog_categories   blog_tags                     │
│                    │              │              │                           │
│                    │              │              │                           │
│                    ▼              ▼              ▼                           │
│              blog_posts ←── post_categories ─→ blog_categories             │
│                    │                                                         │
│                    ├── blog_post_tags ──────────→ blog_tags                  │
│                    │                                                         │
│                    ├── blog_comments (self-referencing for threading)        │
│                    │                                                         │
│                    ├── blog_reactions                                        │
│                    │                                                         │
│                    └── content_versions                                      │
│                                                                              │
│  blogs ──────── blog_subscribers (newsletter)                               │
│                                                                              │
│  sites ──────── activity_logs (audit trail)                                 │
│           │──── media_library (centralized media)                           │
│           │──── notifications (user alerts)                                 │
│           └──── saved_views (custom filter presets)                         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

> **End of Part 2** — Continue to Part 3 for Shopify-Grade Admin Panel Architecture

---

## 8. Shopify-Grade Admin Panel — Architecture & Design System

> **Part 3 of 8** | Design Tokens, Component Library, Layout Engine & Navigation Patterns

### 8.1 Design System Foundation — Token Architecture

```typescript
// ============================================
// DESIGN TOKENS — CSS CUSTOM PROPERTIES
// ============================================

/* 
 * Three-tier token system:
 * 1. Primitive Tokens  → Raw values (colors, spacing, fonts)
 * 2. Semantic Tokens   → Contextual meaning (--color-text-primary)
 * 3. Component Tokens  → Component-specific (--button-bg)
 */

// primitives.css
:root {
  /* ─── Color Primitives ─── */
  --gray-50:  #fafafa;   --gray-100: #f5f5f5;
  --gray-200: #e5e5e5;   --gray-300: #d4d4d4;
  --gray-400: #a3a3a3;   --gray-500: #737373;
  --gray-600: #525252;   --gray-700: #404040;
  --gray-800: #262626;   --gray-900: #171717;
  --gray-950: #0a0a0a;

  --blue-50:  #eff6ff;   --blue-500: #3b82f6;
  --blue-600: #2563eb;   --blue-700: #1d4ed8;
  
  --green-50: #f0fdf4;   --green-500: #22c55e;
  --green-600: #16a34a;
  
  --red-50:   #fef2f2;   --red-500:   #ef4444;
  --red-600:  #dc2626;
  
  --amber-50: #fffbeb;   --amber-500: #f59e0b;
  
  --brand-50:  #f0f4ff;  --brand-500: #6366f1;
  --brand-600: #4f46e5;  --brand-700: #4338ca;
  
  /* ─── Spacing Scale (4px base) ─── */
  --space-0:  0;         --space-1:  4px;
  --space-2:  8px;       --space-3:  12px;
  --space-4:  16px;      --space-5:  20px;
  --space-6:  24px;      --space-8:  32px;
  --space-10: 40px;      --space-12: 48px;
  --space-16: 64px;      --space-20: 80px;
  
  /* ─── Typography Scale ─── */
  --font-family-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-family-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  --text-xs:   0.75rem;   /* 12px */
  --text-sm:   0.875rem;  /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg:   1.125rem;  /* 18px */
  --text-xl:   1.25rem;   /* 20px */
  --text-2xl:  1.5rem;    /* 24px */
  --text-3xl:  1.875rem;  /* 30px */
  
  /* ─── Border Radius ─── */
  --radius-sm:   4px;     --radius-md:   6px;
  --radius-lg:   8px;     --radius-xl:   12px;
  --radius-2xl:  16px;    --radius-full: 9999px;
  
  /* ─── Shadows (Layered for depth) ─── */
  --shadow-xs:  0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm:  0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06);
  --shadow-md:  0 4px 6px rgba(0,0,0,0.1), 0 2px 4px rgba(0,0,0,0.06);
  --shadow-lg:  0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05);
  --shadow-xl:  0 20px 25px rgba(0,0,0,0.1), 0 10px 10px rgba(0,0,0,0.04);
  
  /* ─── Transitions ─── */
  --transition-fast:   150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-normal: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow:   300ms cubic-bezier(0.4, 0, 0.2, 1);
  
  /* ─── Z-Index Scale ─── */
  --z-dropdown:  50;     --z-sticky:  100;
  --z-overlay:   200;    --z-modal:   300;
  --z-toast:     400;    --z-tooltip: 500;
}

// semantic-light.css
[data-theme="light"] {
  /* Backgrounds */
  --bg-primary:      #ffffff;
  --bg-secondary:    var(--gray-50);
  --bg-tertiary:     var(--gray-100);
  --bg-elevated:     #ffffff;
  --bg-overlay:      rgba(0, 0, 0, 0.5);
  
  /* Text */
  --text-primary:    var(--gray-900);
  --text-secondary:  var(--gray-600);
  --text-tertiary:   var(--gray-400);
  --text-inverse:    #ffffff;
  
  /* Borders */
  --border-primary:  var(--gray-200);
  --border-secondary: var(--gray-100);
  --border-focus:    var(--brand-500);
  
  /* Surfaces */
  --surface-card:    #ffffff;
  --surface-sidebar: var(--gray-50);
  --surface-header:  rgba(255, 255, 255, 0.8);
  
  /* Interactive */
  --interactive-primary:   var(--brand-600);
  --interactive-hover:     var(--brand-700);
  --interactive-muted:     var(--brand-50);
}

// semantic-dark.css
[data-theme="dark"] {
  --bg-primary:      var(--gray-950);
  --bg-secondary:    var(--gray-900);
  --bg-tertiary:     var(--gray-800);
  --bg-elevated:     var(--gray-900);
  --bg-overlay:      rgba(0, 0, 0, 0.7);
  
  --text-primary:    var(--gray-50);
  --text-secondary:  var(--gray-400);
  --text-tertiary:   var(--gray-500);
  --text-inverse:    var(--gray-900);
  
  --border-primary:  var(--gray-800);
  --border-secondary: var(--gray-700);
  --border-focus:    var(--brand-500);
  
  --surface-card:    var(--gray-900);
  --surface-sidebar: var(--gray-950);
  --surface-header:  rgba(10, 10, 10, 0.8);
  
  --interactive-primary:   var(--brand-500);
  --interactive-hover:     var(--brand-600);
  --interactive-muted:     rgba(99, 102, 241, 0.1);
}
```

### 8.2 Admin Layout Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ADMIN PANEL — LAYOUT STRUCTURE (Shopify-Grade)                                       │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌────────────────────────────────────────────────────────────────────────────────┐   │
│  │ TOPBAR (64px)  │ 🔔 Notifications │ 🌙 Theme │ 🏪 Store Switcher │ 👤 User │   │
│  └────────────────────────────────────────────────────────────────────────────────┘   │
│  ┌──────────┬─────────────────────────────────────────────────────────────────────┐   │
│  │          │  BREADCRUMB BAR (40px)                                              │   │
│  │          │  Dashboard > Blog > Posts > Edit "My First Post"                    │   │
│  │  SIDEBAR │━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━│   │
│  │  (240px) │                                                                     │   │
│  │          │  PAGE HEADER                                                        │   │
│  │  [Logo]  │  ┌────────────────────────────────────────────────────────────────┐ │   │
│  │          │  │ Blog Posts  [+ New Post]  [...] Actions  🔍 Search  ≡ Filter  │ │   │
│  │  ■ Dash  │  └────────────────────────────────────────────────────────────────┘ │   │
│  │  ■ Blog  │                                                                     │   │
│  │   ├ Posts│  MAIN CONTENT AREA                                                  │   │
│  │   ├ Pages│  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │   ├ Cats │  │                                                              │   │   │
│  │   ├ Tags │  │      Content renders here based on route                     │   │   │
│  │   └ Media│  │      (DataTable / Form / Editor / Dashboard)                 │   │   │
│  │  ■ Store │  │                                                              │   │   │
│  │  ■ Orders│  │                                                              │   │   │
│  │  ■ Pages │  └──────────────────────────────────────────────────────────────┘   │   │
│  │  ■ Anal. │                                                                     │   │
│  │  ■ Sett. │  FOOTER BAR (Optional — Pagination / Bulk Actions)                  │   │
│  │          │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  ─────── │  │ ☐ 3 selected  [Delete] [Export]       ◀ 1 2 3 ... 10 ▶     │   │   │
│  │  ? Help  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │  ⚙ Sett. │                                                                    │   │
│  └──────────┴─────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 8.3 Component Library — Core UI Components

```typescript
// ============================================
// COMPONENT ARCHITECTURE — Type Definitions
// ============================================

// Button Component Variants
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success' | 'outline';
  size: 'xs' | 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  asChild?: boolean; // Radix pattern for polymorphism
}

// Badge Component
interface BadgeProps {
  variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  size: 'sm' | 'md';
  dot?: boolean; // Status dot indicator
  removable?: boolean;
}

// Card Component
interface CardProps {
  variant: 'default' | 'interactive' | 'outlined' | 'elevated';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  header?: ReactNode;
  footer?: ReactNode;
  hoverable?: boolean;
}

// DataTable Component (Shopify-grade)
interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  
  // Selection
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (ids: string[]) => void;
  
  // Sorting
  sortable?: boolean;
  defaultSort?: { column: string; direction: 'asc' | 'desc' };
  
  // Filtering
  filters?: FilterConfig[];
  searchable?: boolean;
  searchPlaceholder?: string;
  
  // Pagination
  pagination?: {
    pageSize: number;
    pageSizeOptions?: number[];
    total: number;
    page: number;
  };
  
  // Bulk Actions
  bulkActions?: BulkAction[];
  
  // Empty State
  emptyState?: {
    icon: ReactNode;
    title: string;
    description: string;
    action?: { label: string; onClick: () => void };
  };
  
  // Row Actions
  rowActions?: (row: T) => DropdownAction[];
  
  // Loading
  loading?: boolean;
  skeleton?: boolean;
}

// ColumnDef for DataTable
interface ColumnDef<T> {
  id: string;
  header: string | ReactNode;
  accessorKey?: keyof T;
  cell?: (row: T) => ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: number | string;
  minWidth?: number;
  align?: 'left' | 'center' | 'right';
  sticky?: 'left' | 'right';
  hidden?: boolean;
}

// FilterConfig
interface FilterConfig {
  id: string;
  label: string;
  type: 'select' | 'multi-select' | 'date-range' | 'search' | 'boolean';
  options?: { label: string; value: string; count?: number }[];
}

// BulkAction
interface BulkAction {
  id: string;
  label: string;
  icon?: ReactNode;
  variant?: 'default' | 'danger';
  onAction: (selectedIds: string[]) => Promise<void>;
  confirmMessage?: string;
}
```

### 8.4 Navigation System

```typescript
// ============================================
// SIDEBAR NAVIGATION — Configuration
// ============================================

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  href?: string;
  badge?: { count: number; variant: 'default' | 'danger' };
  children?: NavItem[];
  dividerAfter?: boolean;
  siteTypes?: SiteType[]; // Only show for specific site types
}

const adminNavigation: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    href: '/[store]/dashboard',
  },
  {
    id: 'blog',
    label: 'Blog',
    icon: BookOpen,
    siteTypes: ['blogger'],
    children: [
      { id: 'posts',      label: 'Posts',       icon: FileText,   href: '/[store]/blog/posts' },
      { id: 'pages',      label: 'Pages',       icon: File,       href: '/[store]/blog/pages' },
      { id: 'categories', label: 'Categories',  icon: Folder,     href: '/[store]/blog/categories' },
      { id: 'tags',       label: 'Tags',        icon: Tags,       href: '/[store]/blog/tags' },
      { id: 'comments',   label: 'Comments',    icon: MessageCircle, href: '/[store]/blog/comments',
        badge: { count: 5, variant: 'default' }
      },
      { id: 'subscribers',label: 'Subscribers', icon: Users,      href: '/[store]/blog/subscribers' },
    ],
    dividerAfter: true,
  },
  {
    id: 'store',
    label: 'Store',
    icon: ShoppingBag,
    siteTypes: ['store', 'portfolio'],
    children: [
      { id: 'products',   label: 'Products',    icon: Package,    href: '/[store]/products' },
      { id: 'collections',label: 'Collections', icon: Grid,       href: '/[store]/collections' },
      { id: 'inventory',  label: 'Inventory',   icon: Warehouse,  href: '/[store]/inventory' },
    ],
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: ShoppingCart,
    href: '/[store]/orders',
    siteTypes: ['store'],
    badge: { count: 12, variant: 'danger' },
  },
  {
    id: 'customers',
    label: 'Customers',
    icon: Users,
    href: '/[store]/customers',
    siteTypes: ['store'],
    dividerAfter: true,
  },
  {
    id: 'media',
    label: 'Media Library',
    icon: Image,
    href: '/[store]/media',
  },
  {
    id: 'analytics',
    label: 'Analytics',
    icon: BarChart3,
    href: '/[store]/analytics',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: Settings,
    href: '/[store]/settings',
  },
];
```

### 8.5 Responsive Breakpoints & Mobile Admin

```typescript
// ============================================
// RESPONSIVE DESIGN — MOBILE-FIRST ADMIN
// ============================================

const breakpoints = {
  xs:  '480px',   // Small phones
  sm:  '640px',   // Large phones
  md:  '768px',   // Tablets
  lg:  '1024px',  // Small laptops
  xl:  '1280px',  // Desktops
  '2xl': '1536px' // Large screens
};

/*
 * Mobile Admin Behavior:
 * 
 * < 768px (Mobile):
 *   - Sidebar becomes slide-out drawer with overlay
 *   - Hamburger menu in topbar
 *   - DataTable switches to card/list view
 *   - Bulk actions in bottom sheet
 *   - Filters in bottom sheet modal
 *   - Pagination becomes "Load More" button
 * 
 * 768px - 1024px (Tablet):
 *   - Sidebar collapses to icon-only (56px)
 *   - Hover to expand sidebar
 *   - DataTable with horizontal scroll
 *   - Side panels become full-width modals
 * 
 * > 1024px (Desktop):
 *   - Full sidebar (240px) always visible
 *   - DataTable with full columns
 *   - Side panels as right drawer (400px)
 *   - Split-view for editor + preview
 */
```

### 8.6 Admin Route Architecture

```
apps/web/admin/src/
├── app/
│   ├── layout.tsx                      # Root layout (auth check, providers)
│   ├── page.tsx                        # Redirect to store or onboarding
│   ├── launching-soon/
│   │   └── page.tsx                    # Pre-launch placeholder
│   │
│   └── [store]/                        # Dynamic store context
│       ├── layout.tsx                  # Admin shell (sidebar + topbar + main)
│       ├── dashboard/
│       │   └── page.tsx                # Overview dashboard
│       │
│       ├── blog/                       # ★ BLOGGER MODULE ★
│       │   ├── posts/
│       │   │   ├── page.tsx            # Posts list (DataTable)
│       │   │   ├── new/page.tsx        # Create post (Editor)
│       │   │   └── [postId]/
│       │   │       ├── page.tsx        # Edit post (Editor)
│       │   │       └── preview/page.tsx# Live preview
│       │   ├── pages/
│       │   │   ├── page.tsx            # Static pages list
│       │   │   └── [pageId]/page.tsx   # Edit page
│       │   ├── categories/
│       │   │   └── page.tsx            # Category manager (Tree + CRUD)
│       │   ├── tags/
│       │   │   └── page.tsx            # Tag manager (Grid + CRUD)
│       │   ├── comments/
│       │   │   └── page.tsx            # Comment moderation queue
│       │   └── subscribers/
│       │       └── page.tsx            # Email subscriber list
│       │
│       ├── products/                   # E-commerce module
│       │   ├── page.tsx                # Product list
│       │   ├── new/page.tsx            # Create product
│       │   └── [productId]/page.tsx    # Edit product
│       │
│       ├── orders/
│       │   ├── page.tsx                # Order list
│       │   └── [orderId]/page.tsx      # Order detail
│       │
│       ├── media/
│       │   └── page.tsx                # Media library (Grid + Upload)
│       │
│       ├── analytics/
│       │   └── page.tsx                # Analytics dashboard
│       │
│       └── settings/
│           ├── page.tsx                # General settings
│           ├── domain/page.tsx         # Domain & DNS
│           ├── seo/page.tsx            # SEO settings
│           ├── theme/page.tsx          # Theme customizer
│           ├── team/page.tsx           # Team members
│           ├── billing/page.tsx        # Billing & plan
│           └── api/page.tsx            # API keys & webhooks
│
├── components/
│   ├── ui/                             # Base UI components
│   │   ├── button.tsx
│   │   ├── badge.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── select.tsx
│   │   ├── dialog.tsx
│   │   ├── dropdown-menu.tsx
│   │   ├── tabs.tsx
│   │   ├── toast.tsx
│   │   ├── skeleton.tsx
│   │   ├── avatar.tsx
│   │   ├── tooltip.tsx
│   │   └── command-palette.tsx         # ⌘K command palette
│   │
│   ├── data/                           # Data display components
│   │   ├── data-table.tsx              # Enterprise DataTable
│   │   ├── data-table-toolbar.tsx      # Search + Filters + Views
│   │   ├── data-table-pagination.tsx
│   │   ├── data-table-faceted-filter.tsx
│   │   ├── data-table-row-actions.tsx
│   │   └── stats-card.tsx
│   │
│   ├── layout/                         # Layout components
│   │   ├── admin-shell.tsx             # Main layout wrapper
│   │   ├── sidebar.tsx                 # Collapsible sidebar
│   │   ├── topbar.tsx                  # Top navigation bar
│   │   ├── breadcrumbs.tsx
│   │   ├── page-header.tsx             # Title + Actions bar
│   │   └── mobile-nav.tsx              # Mobile bottom nav
│   │
│   ├── editor/                         # Rich text editor
│   │   ├── blog-editor.tsx             # Tiptap-based editor
│   │   ├── editor-toolbar.tsx
│   │   ├── editor-bubble-menu.tsx
│   │   ├── slash-commands.tsx
│   │   └── image-upload.tsx
│   │
│   └── shared/                         # Shared components
│       ├── empty-state.tsx
│       ├── loading-state.tsx
│       ├── error-boundary.tsx
│       ├── confirm-dialog.tsx
│       ├── image-cropper.tsx
│       ├── color-picker.tsx
│       ├── date-picker.tsx
│       └── file-uploader.tsx
│
└── lib/
    ├── api.ts                          # API client
    ├── supabase/
    │   ├── client.ts
    │   ├── server.ts
    │   └── middleware.ts
    ├── auth/
    │   ├── provider.tsx
    │   └── hooks.ts
    ├── hooks/
    │   ├── use-store.ts                # Current store context
    │   ├── use-debounce.ts
    │   ├── use-media-query.ts
    │   ├── use-keyboard-shortcut.ts
    │   └── use-infinite-scroll.ts
    └── utils/
        ├── formatting.ts
        ├── validation.ts
        └── slug.ts
```

### 8.7 Global Keyboard Shortcuts

```typescript
// ============================================
// KEYBOARD SHORTCUTS — PRODUCTIVITY FEATURES
// ============================================

const keyboardShortcuts = {
  // Global
  'Cmd+K':        'Open command palette',
  'Cmd+/':        'Toggle keyboard shortcut help',
  'Cmd+\\':       'Toggle sidebar',
  'Escape':       'Close current modal/drawer',
  
  // Navigation
  'G then D':     'Go to Dashboard',
  'G then P':     'Go to Posts',
  'G then O':     'Go to Orders',
  'G then S':     'Go to Settings',
  'G then A':     'Go to Analytics',
  
  // Content
  'Cmd+N':        'Create new (context-aware)',
  'Cmd+S':        'Save current item',
  'Cmd+Shift+P':  'Publish / Unpublish',
  'Cmd+Shift+D':  'Duplicate item',
  'Cmd+Delete':   'Delete selected items',
  
  // Table
  'Cmd+A':        'Select all rows',
  'J / K':        'Navigate rows up/down',
  'Space':        'Toggle row selection',
  'Enter':        'Open selected row',
  
  // Editor
  'Cmd+B':        'Bold',
  'Cmd+I':        'Italic',
  'Cmd+Shift+H':  'Toggle heading level',
  'Cmd+E':        'Inline code',
  '/':             'Slash commands menu',
};
```

---

> **End of Part 3** — Continue to Part 4 for Blogger Admin UI — Complete CRUD Wireframes

---

## 9. Blogger Admin UI — Complete CRUD Wireframes

> **Part 4 of 8** | Posts List, Post Editor, Categories, Tags, Comments & Media Library

### 9.1 Blog Posts — List View (DataTable)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ BLOG POSTS — LIST VIEW                                                           │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │ 📝 Blog Posts                                          [+ New Post]  ···  │  │
│  │ 24 total posts • 18 published • 4 drafts • 2 scheduled                    │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌─── Toolbar ──────────────────────────────────────────────────────────────┐   │
│  │ 🔍 Search posts...   │ Status ▼ │ Category ▼ │ Author ▼ │ 📅 Date ▼   │   │
│  │                                                                         │   │
│  │ Active: Status: Published ✕  Category: Tech ✕       [Clear all]        │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │☐│ TITLE                    │ STATUS    │ AUTHOR  │ CATEGORY │ DATE    │⋮ │  │
│  │─│─────────────────────────│───────────│─────────│──────────│─────────│──│  │
│  │☐│ 🖼 Getting Started with  │ 🟢 Published│ John   │ Tech     │ Feb 10  │⋮ │  │
│  │ │    Next.js 15            │           │         │          │ 1.2k 👁 │  │  │
│  │─│─────────────────────────│───────────│─────────│──────────│─────────│──│  │
│  │☑│ 🖼 Advanced TypeScript   │ 📝 Draft   │ John   │ Dev      │ Feb 8   │⋮ │  │
│  │ │    Patterns              │           │         │          │ -- 👁   │  │  │
│  │─│─────────────────────────│───────────│─────────│──────────│─────────│──│  │
│  │☐│ 🖼 10 CSS Tips You Need  │ ⏰ Scheduled│ Sarah  │ Design   │ Feb 15  │⋮ │  │
│  │ │    to Know               │ (Feb 15)  │         │          │ -- 👁   │  │  │
│  │─│─────────────────────────│───────────│─────────│──────────│─────────│──│  │
│  │☐│ 🖼 Building a Design     │ 🟢 Published│ Sarah  │ Design   │ Feb 5   │⋮ │  │
│  │ │    System from Scratch   │           │         │          │ 3.4k 👁 │  │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌─── Bulk Action Bar (visible when rows selected) ──────────────────────────┐  │
│  │ ☑ 1 post selected    [Publish] [Move to Draft] [Delete] [Export]          │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌─── Pagination ─────────────────────────────────────────────────────────────┐  │
│  │ Showing 1-10 of 24 posts    10 per page ▼    ◀  1  2  3  ▶               │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌─── Row Action Menu (⋮) ────────────────┐                                    │
│  │  ✏️  Edit post                          │                                    │
│  │  👁  View on site                       │                                    │
│  │  📋  Duplicate                          │                                    │
│  │  📌  Pin to top                         │                                    │
│  │  ─────────────────────────────────────  │                                    │
│  │  📤  Move to Draft / Publish            │                                    │
│  │  📦  Archive                            │                                    │
│  │  ─────────────────────────────────────  │                                    │
│  │  🗑️  Delete                      ← Red │                                    │
│  └─────────────────────────────────────────┘                                    │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Blog Post Editor — Rich Text (Tiptap-based)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ POST EDITOR — FULL-WIDTH LAYOUT                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ ┌── Editor Topbar ────────────────────────────────────────────────────────────┐  │
│ │ ← Back to Posts   │  📝 Draft  │  Last saved 2 min ago                     │  │
│ │                    │            │              [Preview] [Save] [Publish ▼] │  │
│ └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│ ┌─── Main Editor (60%) ────────────────┬──── Sidebar (40%) ──────────────────┐  │
│ │                                       │                                     │  │
│ │  Title:                               │  ┌─ Publish Settings ─────────────┐│  │
│ │  ┌──────────────────────────────────┐ │  │ Status:   [Draft ▼]            ││  │
│ │  │ My Amazing Blog Post Title       │ │  │ Visibility: [Public ▼]         ││  │
│ │  │ (auto-generates slug below)      │ │  │ Schedule: [Immediately ▼]      ││  │
│ │  └──────────────────────────────────┘ │  │ Author:   [John Doe ▼]         ││  │
│ │                                       │  └─────────────────────────────────┘│  │
│ │  Permalink: /blog/my-amazing-post ✏️  │                                     │  │
│ │                                       │  ┌─ Featured Image ───────────────┐│  │
│ │  ┌── Toolbar ──────────────────────┐ │  │                                 ││  │
│ │  │ B I U S ~ │H1 H2 H3│• - 1.│""│ │  │  ┌───────────────────────────┐  ││  │
│ │  │ 🔗 📷 📹 | 📊 ─── </> │⎌ ⎍ │ │  │  │   📷 Click to upload      │  ││  │
│ │  └────────────────────────────────┘ │  │  │   or drag & drop          │  ││  │
│ │                                       │  │  └───────────────────────────┘  ││  │
│ │  ┌── Content Area ─────────────────┐ │  │  Alt text: [________________]   ││  │
│ │  │                                  │ │  └─────────────────────────────────┘│  │
│ │  │  Start writing your post...      │ │                                     │  │
│ │  │                                  │ │  ┌─ Categories ───────────────────┐│  │
│ │  │  Type "/" for slash commands:     │ │  │ ☑ Technology                   ││  │
│ │  │  ┌──────────────────────┐       │ │  │   ☑ Web Development            ││  │
│ │  │  │ /heading   → H1-H3  │       │ │  │   ☐ Mobile                     ││  │
│ │  │  │ /image     → Upload  │       │ │  │ ☐ Design                       ││  │
│ │  │  │ /code      → Block   │       │ │  │ ☐ Business                     ││  │
│ │  │  │ /table     → Table   │       │ │  │ [+ Add Category]               ││  │
│ │  │  │ /divider   → <hr>   │       │ │  └─────────────────────────────────┘│  │
│ │  │  │ /embed     → URL     │       │ │                                     │  │
│ │  │  │ /callout   → Alert   │       │ │  ┌─ Tags ──────────────────────────┐│  │
│ │  │  │ /youtube   → Video   │       │ │  │ [nextjs ✕] [typescript ✕]       ││  │
│ │  │  └──────────────────────┘       │ │  │ [react ✕]                       ││  │
│ │  │                                  │ │  │ Add tag: [______________] +     ││  │
│ │  │                                  │ │  └─────────────────────────────────┘│  │
│ │  │                                  │ │                                     │  │
│ │  └──────────────────────────────────┘ │  ┌─ SEO ──────────────────────────┐│  │
│ │                                       │  │ Focus Keyword: [___________]   ││  │
│ │  ┌── Word Count & Stats ─────────┐   │  │ Score: 🟢 Good (78/100)        ││  │
│ │  │ 1,247 words • 6 min read      │   │  │                                ││  │
│ │  │ Version 3 • Autosaved         │   │  │ Meta Title: (58/70 chars)      ││  │
│ │  └────────────────────────────────┘   │  │ [Getting Started with Next..]  ││  │
│ │                                       │  │                                ││  │
│ └───────────────────────────────────────│  │ Meta Description: (142/160)    ││  │
│                                          │  │ [Learn how to build modern..]  ││  │
│                                          │  │                                ││  │
│                                          │  │ ┌─ Preview ─────────────────┐ ││  │
│                                          │  │ │ Getting Started with...   │ ││  │
│                                          │  │ │ myblog.letbuyy.com/blog/..│ ││  │
│                                          │  │ │ Learn how to build...     │ ││  │
│                                          │  │ └───────────────────────────┘ ││  │
│                                          │  └──────────────────────────────┘ │  │
│                                          └───────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 Categories Manager

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ CATEGORIES — TREE VIEW + CRUD                                                    │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌── Page Header ─────────────────────────────────────────────────────────────┐  │
│  │ 📁 Categories                                           [+ New Category]  │  │
│  │ Organize your blog posts into hierarchical categories                     │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌── Category Tree (Left) ──────────┬── Edit Panel (Right) ──────────────────┐  │
│  │                                   │                                        │  │
│  │  🔍 Filter categories...          │  ┌── Edit Category ─────────────────┐ │  │
│  │                                   │  │                                   │ │  │
│  │  📂 Technology (12)          ✏️🗑 │  │  Name:  [Technology           ]  │ │  │
│  │   ├── 📂 Web Development (8)  ✏️🗑│  │  Slug:  [technology           ]  │ │  │
│  │   │    ├── React (3)          ✏️🗑│  │  Parent: [None (Top Level) ▼ ]   │ │  │
│  │   │    ├── Vue.js (2)         ✏️🗑│  │  Description:                    │ │  │
│  │   │    └── Angular (3)        ✏️🗑│  │  [All things technology and..]   │ │  │
│  │   └── 📂 Mobile (4)          ✏️🗑│  │                                   │ │  │
│  │        ├── iOS (2)            ✏️🗑│  │  Color: [🔵 #3B82F6         ]   │ │  │
│  │        └── Android (2)        ✏️🗑│  │  Icon:  [💻                  ]   │ │  │
│  │  📂 Design (6)               ✏️🗑│  │                                   │ │  │
│  │   ├── UI/UX (4)              ✏️🗑│  │  Cover Image:                    │ │  │
│  │   └── Typography (2)         ✏️🗑│  │  [📷 Upload image]               │ │  │
│  │  📂 Business (4)             ✏️🗑│  │                                   │ │  │
│  │  📂 Lifestyle (2)            ✏️🗑│  │  ─── SEO ───────────────────     │ │  │
│  │                                   │  │  Meta Title:  [____________]     │ │  │
│  │  Drag to reorder              │  │  Meta Desc:   [____________]     │ │  │
│  │                                   │  │                                   │ │  │
│  │                                   │  │         [Cancel] [Save Category]  │ │  │
│  │                                   │  └───────────────────────────────────┘ │  │
│  └───────────────────────────────────┴────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 9.4 Tags Manager

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ TAGS — GRID VIEW + INLINE EDIT                                                   │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌── Page Header ─────────────────────────────────────────────────────────────┐  │
│  │ 🏷️ Tags                                                   [+ Add Tag]     │  │
│  │ 38 tags • Used across 24 posts                                            │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  🔍 Search tags...    Sort by: [Most Used ▼]                                    │
│                                                                                  │
│  ┌─── Tag Grid ───────────────────────────────────────────────────────────────┐  │
│  │                                                                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │ 🔵 nextjs    │  │ 🟢 react     │  │ 🟣 typescript│  │ 🟡 css       │   │  │
│  │  │ 12 posts     │  │ 10 posts     │  │ 8 posts      │  │ 7 posts      │   │  │
│  │  │ ✏️ 🗑        │  │ ✏️ 🗑        │  │ ✏️ 🗑        │  │ ✏️ 🗑        │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  │                                                                             │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │  │
│  │  │ 🔴 tailwind  │  │ 🟠 node      │  │ ⚪ api       │  │ 🟤 database  │   │  │
│  │  │ 6 posts      │  │ 5 posts      │  │ 4 posts      │  │ 3 posts      │   │  │
│  │  │ ✏️ 🗑        │  │ ✏️ 🗑        │  │ ✏️ 🗑        │  │ ✏️ 🗑        │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘   │  │
│  │                                                                             │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌─── Inline Tag Edit Dialog ────────────────────────────────┐                  │
│  │  Name:  [nextjs              ]                             │                  │
│  │  Slug:  [nextjs              ]  (auto-generated)           │                  │
│  │  Color: [🔵 #3B82F6 ▼       ]                             │                  │
│  │  Desc:  [Posts about Next.js framework...]                 │                  │
│  │                                                             │                  │
│  │              [Cancel] [Save]                                │                  │
│  └─────────────────────────────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 9.5 Comment Moderation Queue

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ COMMENTS — MODERATION QUEUE                                                      │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌── Tabs ───────────────────────────────────────────────────────────────────┐  │
│  │ [All (42)] [Pending (5)] [Approved (35)] [Spam (2)] [Trash (0)]          │  │
│  └───────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌── Comment Card ────────────────────────────────────────────────────────────┐  │
│  │  ┌──────────────────────────────────────────────────────────────────────┐ │  │
│  │  │ 🟡 PENDING                                                  2h ago  │ │  │
│  │  │                                                                      │ │  │
│  │  │ 👤 Jane Smith (jane@example.com)                                     │ │  │
│  │  │ on "Getting Started with Next.js 15"                                 │ │  │
│  │  │                                                                      │ │  │
│  │  │ "This is a really helpful article! I've been struggling with the     │ │  │
│  │  │  new app router and this clarified so many things. Would love to     │ │  │
│  │  │  see a follow-up on middleware..."                                   │ │  │
│  │  │                                                                      │ │  │
│  │  │ [✅ Approve] [🗑 Trash] [⚠️ Spam] [↩️ Reply]                       │ │  │
│  │  └──────────────────────────────────────────────────────────────────────┘ │  │
│  │                                                                            │  │
│  │  ┌──────────────────────────────────────────────────────────────────────┐ │  │
│  │  │ 🟡 PENDING                                                  5h ago  │ │  │
│  │  │                                                                      │ │  │
│  │  │ 👤 Anonymous User (IP: 192.168.1.xxx)                                │ │  │
│  │  │ on "10 CSS Tips You Need to Know"                                    │ │  │
│  │  │                                                                      │ │  │
│  │  │ "Buy cheap products at www.spam-link.com!!!!"                        │ │  │
│  │  │                                                                      │ │  │
│  │  │ ⚠️ Flagged: Contains suspicious link                                │ │  │
│  │  │                                                                      │ │  │
│  │  │ [✅ Approve] [🗑 Trash] [⚠️ Spam] [↩️ Reply]                       │ │  │
│  │  └──────────────────────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌── Bulk Actions ──────────────────────────────────────────────────────────┐   │
│  │ ☑ 2 selected   [Approve All] [Mark as Spam] [Delete All]                │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 9.6 Media Library

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ MEDIA LIBRARY — GRID + DETAIL VIEW                                               │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌── Header ────────────────────────────────────────────────────────────────┐   │
│  │ 🖼 Media Library                                        [📤 Upload]      │   │
│  │ 156 files • 2.4 GB used of 10 GB        🔍 Search  │ ≡ Grid │ ☰ List   │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌── Filters ───────────────────────────────────────────────────────────────┐   │
│  │ All │ Images (120) │ Videos (20) │ Documents (16) │ 📁 Folder ▼         │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│                                                                                  │
│  ┌── Upload Zone (Drag & Drop) ──────────────────────────────────────────────┐  │
│  │ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │  │
│  │   📤 Drag and drop files here, or click to browse                       │  │
│  │      Supports: JPG, PNG, GIF, WebP, MP4, PDF • Max 10MB per file        │  │
│  │ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌── Media Grid ──────────────────────────────────────────────────────────────┐  │
│  │                                                                             │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │  │
│  │  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │    │  │
│  │  │ │ IMG  │ │  │ │ IMG  │ │  │ │ IMG  │ │  │ │ 📹   │ │  │ │ IMG  │ │    │  │
│  │  │ │      │ │  │ │      │ │  │ │      │ │  │ │      │ │  │ │      │ │    │  │
│  │  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │    │  │
│  │  │ hero.jpg │  │ about.png│  │thumb.webp│  │ demo.mp4 │  │ logo.svg │    │  │
│  │  │ 2.4 MB   │  │ 1.1 MB   │  │ 340 KB   │  │ 8.2 MB   │  │ 24 KB    │    │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │  │
│  │                                                                             │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌── Media Detail Panel (slides in from right) ──────────────────────────────┐  │
│  │                                                                            │  │
│  │  ┌────────────────────────────────┐   File: hero-image.jpg                │  │
│  │  │                                │   Size: 2.4 MB (1920 × 1080)          │  │
│  │  │     [Full Image Preview]       │   Uploaded: Feb 10, 2025              │  │
│  │  │                                │   Used in: 3 posts                    │  │
│  │  └────────────────────────────────┘                                       │  │
│  │                                                                            │  │
│  │  Alt Text: [Hero image for blog______]                                    │  │
│  │  Caption:  [Main featured image______]                                    │  │
│  │  Title:    [hero-image              ]                                     │  │
│  │                                                                            │  │
│  │  URL: https://storage.letbuyy.com/...  [📋 Copy]                         │  │
│  │                                                                            │  │
│  │  [✂️ Crop] [🔄 Replace] [📥 Download] [🗑 Delete]                        │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### 9.7 Blog Dashboard Overview

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ BLOGGER DASHBOARD — OVERVIEW                                                     │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│  ┌── Stats Cards (Top Row) ────────────────────────────────────────────────────┐ │
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐        │ │
│  │ │ Total Views   │ │ Posts        │ │ Subscribers  │ │ Avg. Read    │        │ │
│  │ │ 12,847       │ │ 24           │ │ 156          │ │ Time         │        │ │
│  │ │ ↑ 23% (30d)  │ │ 4 drafts     │ │ ↑ 12 (7d)   │ │ 4.2 min     │        │ │
│  │ │ ██████░░     │ │ 2 scheduled  │ │ █████░░░     │ │ ↑ 0.3 min   │        │ │
│  │ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘        │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                  │
│  ┌── Quick Actions ──────────────────┬── Recent Activity ────────────────────┐  │
│  │                                    │                                       │  │
│  │  [📝 New Post]  [📄 New Page]     │  • Published "CSS Tips" — 2h ago     │  │
│  │  [📁 New Category] [🏷 New Tag]    │  • ✅ Comment approved — 3h ago      │  │
│  │                                    │  • 📝 Draft saved "React..." — 5h   │  │
│  └────────────────────────────────────│  • 🟡 New comment pending — 6h      │  │
│                                       │  • 📤 Published "Design..." — 1d    │  │
│  ┌── Top Posts (by Views) ────────── │                                       │  │
│  │                                    └───────────────────────────────────────┘  │
│  │ 1. Building a Design System    3.4k views  ████████████████                │  │
│  │ 2. Getting Started w/ Next.js  1.2k views  ██████                          │  │
│  │ 3. TypeScript Best Practices   890 views   ████                            │  │
│  │ 4. CSS Grid Complete Guide     654 views   ███                             │  │
│  │ 5. React Server Components     421 views   ██                              │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                  │
│  ┌── Traffic Chart (7-day/30-day/90-day toggle) ──────────────────────────────┐  │
│  │                                                                             │  │
│  │  Views ↑                    ╭────╮                                          │  │
│  │  500 │                 ╭───╯    ╰──╮                                       │  │
│  │  400 │            ╭───╯            ╰──╮                                    │  │
│  │  300 │       ╭───╯                    ╰───╮                                │  │
│  │  200 │  ╭───╯                              ╰───╮                           │  │
│  │  100 │──╯                                       ╰──                        │  │
│  │      └──────────────────────────────────────────────                       │  │
│  │        Mon    Tue    Wed    Thu    Fri    Sat    Sun                        │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

> **End of Part 4** — Continue to Part 5 for Enhanced Admin Features (Bulk Actions, Search, Activity Logs)

---

## 10. Enhanced Admin Features — Bulk Actions, Search & Activity Logs

> **Part 5 of 8** | Enterprise-Grade Admin Productivity Features

### 10.1 Bulk Actions System

```typescript
// ============================================
// BULK ACTIONS — ENTERPRISE IMPLEMENTATION
// ============================================

// Bulk action registry (per entity type)
const bulkActionRegistry: Record<string, BulkActionConfig[]> = {
  blog_posts: [
    {
      id: 'publish',
      label: 'Publish',
      icon: Globe,
      variant: 'default',
      confirmTitle: 'Publish {count} posts?',
      confirmMessage: 'These posts will be immediately visible on your site.',
      handler: async (ids: string[], supabase: SupabaseClient) => {
        const { error } = await supabase
          .from('blog_posts')
          .update({ status: 'published', published_at: new Date().toISOString() })
          .in('id', ids);
        if (error) throw error;
        return { success: true, message: `${ids.length} posts published` };
      }
    },
    {
      id: 'draft',
      label: 'Move to Draft',
      icon: FileText,
      handler: async (ids, supabase) => {
        await supabase.from('blog_posts').update({ status: 'draft' }).in('id', ids);
        return { success: true, message: `${ids.length} posts moved to draft` };
      }
    },
    {
      id: 'assign_category',
      label: 'Assign Category',
      icon: Folder,
      requiresInput: true,
      inputType: 'category_select',
      handler: async (ids, supabase, { categoryId }) => {
        const inserts = ids.map(id => ({ post_id: id, category_id: categoryId }));
        await supabase.from('blog_post_categories').upsert(inserts, { onConflict: 'post_id,category_id' });
        return { success: true };
      }
    },
    {
      id: 'assign_author',
      label: 'Change Author',
      icon: User,
      requiresInput: true,
      inputType: 'author_select',
      handler: async (ids, supabase, { authorId }) => {
        await supabase.from('blog_posts').update({ author_id: authorId }).in('id', ids);
        return { success: true };
      }
    },
    {
      id: 'export',
      label: 'Export',
      icon: Download,
      handler: async (ids, supabase) => {
        const { data } = await supabase.from('blog_posts').select('*').in('id', ids);
        // Generate CSV/JSON export
        return { success: true, download: generateExport(data, 'csv') };
      }
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      variant: 'danger',
      confirmTitle: 'Delete {count} posts?',
      confirmMessage: 'This action cannot be undone. Draft posts will be permanently deleted.',
      handler: async (ids, supabase) => {
        await supabase.from('blog_posts').delete().in('id', ids);
        return { success: true, message: `${ids.length} posts deleted` };
      }
    }
  ],
  
  blog_comments: [
    { id: 'approve', label: 'Approve', icon: Check, handler: /* ... */ },
    { id: 'spam',    label: 'Mark as Spam', icon: AlertTriangle, handler: /* ... */ },
    { id: 'trash',   label: 'Move to Trash', icon: Trash2, variant: 'danger', handler: /* ... */ },
  ],
  
  products: [
    { id: 'activate',    label: 'Set Active', handler: /* ... */ },
    { id: 'deactivate',  label: 'Set Inactive', handler: /* ... */ },
    { id: 'update_price',label: 'Update Price', requiresInput: true, handler: /* ... */ },
    { id: 'delete',      label: 'Delete', variant: 'danger', handler: /* ... */ },
  ],
};

// Bulk Action Execution Flow
/*
 * 1. User selects rows via checkboxes (Shift+Click for range)
 * 2. Bulk action bar appears at bottom of table
 * 3. User clicks action button
 * 4. If requiresInput → show input modal
 * 5. If confirmMessage → show confirmation dialog
 * 6. Execute handler with progress indicator
 * 7. Show success/error toast
 * 8. Refresh table data
 * 9. Clear selection
 */
```

### 10.2 Advanced Search & Command Palette

```typescript
// ============================================
// COMMAND PALETTE — ⌘K UNIVERSAL SEARCH
// ============================================

interface CommandPaletteItem {
  id: string;
  label: string;
  description?: string;
  icon: ReactNode;
  category: 'navigation' | 'action' | 'content' | 'settings';
  keywords: string[];
  shortcut?: string;
  onSelect: () => void;
}

const commandPaletteConfig = {
  // Search sources (debounced, 200ms)
  sources: [
    {
      name: 'Navigation',
      icon: Compass,
      items: [
        { label: 'Go to Dashboard',    shortcut: 'G D', action: () => router.push('/dashboard') },
        { label: 'Go to Posts',         shortcut: 'G P', action: () => router.push('/blog/posts') },
        { label: 'Go to Orders',        shortcut: 'G O', action: () => router.push('/orders') },
        { label: 'Go to Settings',      shortcut: 'G S', action: () => router.push('/settings') },
        { label: 'Go to Analytics',     shortcut: 'G A', action: () => router.push('/analytics') },
        { label: 'Go to Media Library', action: () => router.push('/media') },
      ]
    },
    {
      name: 'Actions',
      icon: Zap,
      items: [
        { label: 'Create New Post',     shortcut: '⌘N', action: () => router.push('/blog/posts/new') },
        { label: 'Upload Media',        action: () => openMediaUpload() },
        { label: 'Toggle Dark Mode',    shortcut: '⌘⇧D', action: () => toggleTheme() },
        { label: 'View Keyboard Shortcuts', shortcut: '⌘/', action: () => openShortcutsHelp() },
      ]
    },
    {
      name: 'Content Search',
      icon: Search,
      async: true, // Real-time database search
      search: async (query: string) => {
        const [posts, pages, products] = await Promise.all([
          supabase.from('blog_posts').select('id,title,status').ilike('title', `%${query}%`).limit(5),
          supabase.from('blog_posts').select('id,title').eq('type', 'page').ilike('title', `%${query}%`).limit(3),
          supabase.from('products').select('id,name').ilike('name', `%${query}%`).limit(5),
        ]);
        return [...posts.data, ...pages.data, ...products.data].map(item => ({
          label: item.title || item.name,
          action: () => router.push(`/edit/${item.id}`)
        }));
      }
    }
  ],
  
  // Recently accessed (persisted in localStorage)
  recentItems: 5,
  
  // Keyboard
  hotkey: 'mod+k',
  closeOnSelect: true,
  placeholder: 'Search or type a command...',
};
```

### 10.3 Activity Logs & Audit Trail

```typescript
// ============================================
// ACTIVITY LOGS — ADMIN AUDIT TRAIL
// ============================================

// Activity Log UI Component Props
interface ActivityLogProps {
  siteId: string;
  filters?: {
    userId?: string;
    entityType?: string;
    action?: string;
    dateRange?: [Date, Date];
  };
  realtime?: boolean; // Subscribe to new events
}

// Activity Log Entry Display
interface ActivityLogEntry {
  id: string;
  user: { name: string; avatar: string };
  action: string;
  entityType: string;
  entityTitle: string;
  changes?: Record<string, { old: any; new: any }>;
  timestamp: Date;
  ip?: string;
}

/*
 * Activity Log UI Layout:
 * 
 * ┌── Activity Log ──────────────────────────────────────────────────────┐
 * │                                                                       │
 * │  Filters: [User ▼] [Entity ▼] [Action ▼] [Date Range 📅]           │
 * │                                                                       │
 * │  Timeline View:                                                       │
 * │                                                                       │
 * │  ● Today ─────────────────────────────────────────────────────────── │
 * │  │                                                                    │
 * │  │  👤 John Doe published "Getting Started with Next.js"             │
 * │  │  📝 blog_post • 2 hours ago                                       │
 * │  │  [View Changes]                                                    │
 * │  │                                                                    │
 * │  │  👤 John Doe updated settings                                     │
 * │  │  ⚙️ site_settings • 3 hours ago                                   │
 * │  │  Changes: { "site_name": "My Blog" → "John's Tech Blog" }         │
 * │  │                                                                    │
 * │  │  👤 Jane Smith approved comment on "CSS Tips"                     │
 * │  │  💬 blog_comment • 4 hours ago                                    │
 * │  │                                                                    │
 * │  ● Yesterday ─────────────────────────────────────────────────────── │
 * │  │                                                                    │
 * │  │  👤 John Doe created category "Tutorials"                         │
 * │  │  📁 blog_category • 1 day ago                                     │
 * │  │                                                                    │
 * │  │  👤 John Doe bulk deleted 3 spam comments                         │
 * │  │  💬 blog_comment • 1 day ago                                      │
 * │  │                                                                    │
 * │  [Load More]                                                          │
 * └───────────────────────────────────────────────────────────────────────┘
 */

// Real-time subscription for activity feed
const useActivityFeed = (siteId: string) => {
  useEffect(() => {
    const channel = supabase
      .channel(`activity:${siteId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_logs',
        filter: `site_id=eq.${siteId}`
      }, (payload) => {
        // Prepend new activity to feed with animation
        addToFeed(payload.new as ActivityLogEntry);
        // Show toast notification
        toast.info(`${payload.new.user_name} ${payload.new.action}ed ${payload.new.entity_title}`);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [siteId]);
};
```

### 10.4 Saved Views & Custom Filters

```typescript
// ============================================
// SAVED VIEWS — PERSISTENT FILTER PRESETS
// ============================================

interface SavedView {
  id: string;
  name: string;
  entityType: string;
  filters: FilterState;
  sortBy: string;
  sortDirection: 'asc' | 'desc';
  columns: string[];
  isDefault: boolean;
}

/*
 * Saved Views UI:
 * 
 * ┌── Views Dropdown ────────────────────────────────────────────────────┐
 * │                                                                       │
 * │  📋 Views                                                   [+ Save] │
 * │                                                                       │
 * │  DEFAULT VIEWS                                                        │
 * │  ├── 📌 All Posts                                                     │
 * │  ├── 📝 My Drafts (filtered by current user + draft status)          │
 * │  ├── 🟢 Published (filtered by published status)                     │
 * │  └── ⏰ Scheduled (filtered by scheduled status)                     │
 * │                                                                       │
 * │  CUSTOM VIEWS                                                         │
 * │  ├── ⭐ Tech Posts This Month (Category: Tech + Date: This Month)    │
 * │  ├── 📊 Top Performing (Sort: Views DESC + Published)                │
 * │  └── 🔍 Needs SEO Review (Focus Keyword: empty)                     │
 * │                                                                       │
 * │  ────────────────────────────────────────────                         │
 * │  ⚙️ Manage Views...                                                  │
 * └───────────────────────────────────────────────────────────────────────┘
 * 
 * Usage:
 * 1. User configures filters, columns, and sort order
 * 2. Clicks "Save as View" → enters name → saves to `saved_views` table
 * 3. View appears in dropdown for quick access
 * 4. Default views are pre-seeded and cannot be deleted
 * 5. Custom views sync across devices via database
 */
```

### 10.5 Content Version History & Diff Viewer

```typescript
// ============================================
// VERSION HISTORY — FULL DIFF & RESTORE
// ============================================

/*
 * Version History Panel (Right drawer, 400px):
 *
 * ┌── Version History ────────────────────────────────────────────────────┐
 * │                                                                       │
 * │  📜 Version History for "Getting Started with Next.js"               │
 * │  Current: Version 5 (Published)                                       │
 * │                                                                       │
 * │  ┌── v5 (Current) ──────────────────────────────────────────────────┐│
 * │  │ Feb 10, 2025 at 3:15 PM • by John Doe                            ││
 * │  │ Published version                                                  ││
 * │  │ [View] [Compare with Previous]                                    ││
 * │  └───────────────────────────────────────────────────────────────────┘│
 * │                                                                       │
 * │  ┌── v4 ────────────────────────────────────────────────────────────┐│
 * │  │ Feb 10, 2025 at 2:30 PM • by John Doe                            ││
 * │  │ Updated introduction paragraph                                     ││
 * │  │ [View] [Compare] [Restore this version]                           ││
 * │  └───────────────────────────────────────────────────────────────────┘│
 * │                                                                       │
 * │  ┌── v3 ────────────────────────────────────────────────────────────┐│
 * │  │ Feb 9, 2025 at 11:00 AM • by John Doe                            ││
 * │  │ Added code examples section                                        ││
 * │  │ [View] [Compare] [Restore this version]                           ││
 * │  └───────────────────────────────────────────────────────────────────┘│
 * │                                                                       │
 * │  ┌── v2 ────────────────────────────────────────────────────────────┐│
 * │  │ Feb 8, 2025 at 5:45 PM • by John Doe                             ││
 * │  │ Initial draft with outline                                         ││
 * │  └───────────────────────────────────────────────────────────────────┘│
 * │                                                                       │
 * │  ┌── v1 (Original) ────────────────────────────────────────────────┐│
 * │  │ Feb 8, 2025 at 4:00 PM • by John Doe                             ││
 * │  │ Post created                                                       ││
 * │  └───────────────────────────────────────────────────────────────────┘│
 * │                                                                       │
 * └───────────────────────────────────────────────────────────────────────┘
 *
 * Diff Viewer (Side-by-side or Unified):
 *
 * ┌── Compare: v4 → v5 ──────────────────────────────────────────────────┐
 * │  ≡ Unified  │  ⫿ Side-by-Side                                       │
 * │                                                                       │
 * │  ## Introduction                                                      │
 * │                                                                       │
 * │  - Next.js is a React framework for building web applications.       │
 * │  + Next.js 15 is the latest React framework for building modern,     │
 * │  + high-performance web applications with server-first architecture.  │
 * │                                                                       │
 * │    It provides features like server-side rendering, static site       │
 * │    generation, and API routes out of the box.                         │
 * │                                                                       │
 * │  - In this guide, we'll cover the basics.                            │
 * │  + In this comprehensive guide, we'll explore the new features        │
 * │  + introduced in Next.js 15, including partial prerendering,          │
 * │  + improved caching, and the new Turbopack bundler.                   │
 * │                                                                       │
 * │  [Restore v4] [Keep Current (v5)]                                    │
 * └───────────────────────────────────────────────────────────────────────┘
 */
```

### 10.6 Notification System

```typescript
// ============================================
// NOTIFICATION CENTER — REAL-TIME ALERTS
// ============================================

interface NotificationConfig {
  triggers: {
    'comment.new':      { title: 'New Comment', sound: true, desktop: true },
    'comment.spam':     { title: 'Spam Detected', sound: false, desktop: false },
    'order.placed':     { title: 'New Order!', sound: true, desktop: true },
    'order.cancelled':  { title: 'Order Cancelled', sound: false, desktop: true },
    'stock.low':        { title: 'Low Stock Alert', sound: false, desktop: true },
    'post.scheduled':   { title: 'Post Published', sound: false, desktop: false },
    'subscriber.new':   { title: 'New Subscriber', sound: false, desktop: false },
  };
}

/*
 * Notification Bell UI (Topbar):
 *
 * ┌── 🔔 (3) ────────────────────────────────────────────────────────────┐
 * │                                                                       │
 * │  Notifications                                        [Mark All Read] │
 * │                                                                       │
 * │  ┌── New ──────────────────────────────────────────────────────────┐  │
 * │  │ 🟢 New comment on "CSS Tips You Need to Know"                  │  │
 * │  │    from Jane Smith • 5 min ago                        [View]   │  │
 * │  │                                                                │  │
 * │  │ 🛒 New order #1247 — ₹2,500                                   │  │
 * │  │    from customer@email.com • 15 min ago               [View]   │  │
 * │  │                                                                │  │
 * │  │ 📧 New subscriber: john@example.com                            │  │
 * │  │    Blog newsletter • 1 hour ago                       [View]   │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  ┌── Earlier ─────────────────────────────────────────────────────┐  │
 * │  │ ⏰ Scheduled post "React Tips" published                       │  │
 * │  │    Auto-published • 3 hours ago                                │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  [View All Notifications]                                             │
 * └───────────────────────────────────────────────────────────────────────┘
 */
```

---

> **End of Part 5** — Continue to Part 6 for E-commerce Enhancements (Inventory, Multi-Currency, Tax)

---

## 11. E-commerce Enhancements — Inventory, Multi-Currency & Tax Engine

> **Part 6 of 8** | Production-Ready Commerce Infrastructure

### 11.1 Inventory Management System

```sql
-- ============================================
-- INVENTORY SCHEMA — MULTI-WAREHOUSE SUPPORT
-- ============================================

-- Product Variants (Size, Color, Material)
CREATE TABLE product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  sku VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,           -- e.g., "Red / Large"
  price_override DECIMAL(12,2),          -- NULL = use product base price
  compare_at_price DECIMAL(12,2),
  weight DECIMAL(8,2),
  weight_unit VARCHAR(10) DEFAULT 'g',   -- g, kg, lb, oz
  barcode VARCHAR(100),
  option1_name VARCHAR(50),              -- e.g., "Color"
  option1_value VARCHAR(100),            -- e.g., "Red"
  option2_name VARCHAR(50),              -- e.g., "Size"
  option2_value VARCHAR(100),            -- e.g., "Large"
  option3_name VARCHAR(50),
  option3_value VARCHAR(100),
  requires_shipping BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, sku)
);

-- Warehouse / Inventory Locations
CREATE TABLE inventory_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(2),
  postal_code VARCHAR(20),
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Levels (per variant × per location)
CREATE TABLE inventory_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  available INTEGER NOT NULL DEFAULT 0,
  committed INTEGER NOT NULL DEFAULT 0,     -- Reserved by unpaid orders
  incoming INTEGER NOT NULL DEFAULT 0,      -- Expected from purchase orders
  damaged INTEGER NOT NULL DEFAULT 0,
  safety_stock INTEGER DEFAULT 0,           -- Minimum threshold for alerts
  reorder_point INTEGER DEFAULT 0,
  reorder_quantity INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(variant_id, location_id)
);

-- Stock Movements (full audit trail)
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  location_id UUID NOT NULL REFERENCES inventory_locations(id),
  type VARCHAR(30) NOT NULL,
  -- Types: 'purchase', 'sale', 'return', 'adjustment', 
  --        'transfer_in', 'transfer_out', 'damage', 'correction'
  quantity INTEGER NOT NULL,                -- Positive = in, Negative = out
  previous_available INTEGER NOT NULL,
  new_available INTEGER NOT NULL,
  reference_type VARCHAR(50),               -- 'order', 'purchase_order', 'manual'
  reference_id UUID,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Adjustment Trigger
CREATE OR REPLACE FUNCTION fn_record_stock_movement()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.available != NEW.available THEN
    INSERT INTO stock_movements (
      variant_id, location_id, type, quantity,
      previous_available, new_available
    ) VALUES (
      NEW.variant_id, NEW.location_id,
      CASE 
        WHEN NEW.available > OLD.available THEN 'adjustment'
        ELSE 'adjustment'
      END,
      NEW.available - OLD.available,
      OLD.available, NEW.available
    );
  END IF;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_inventory_stock_movement
  BEFORE UPDATE ON inventory_levels
  FOR EACH ROW
  EXECUTE FUNCTION fn_record_stock_movement();
```

```typescript
// ============================================
// INVENTORY UI — ADMIN WIREFRAME
// ============================================

/*
 * Inventory Dashboard:
 *
 * ┌── Inventory Overview ────────────────────────────────────────────────┐
 * │                                                                       │
 * │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
 * │  │ Total SKUs   │ │ In Stock     │ │ Low Stock    │ │ Out of Stock │ │
 * │  │   1,247      │ │   1,089      │ │   ⚠️ 43     │ │   🔴 15     │ │
 * │  │ +23 this wk  │ │ 87.3%        │ │ 3.4%         │ │ 1.2%         │ │
 * │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘ │
 * │                                                                       │
 * │  ┌── Low Stock Alerts ─────────────────────────────────────────────┐  │
 * │  │ Product          │ Variant    │ Available │ Safety │ Reorder    │  │
 * │  │──────────────────│────────────│───────────│────────│────────────│  │
 * │  │ Summer T-Shirt   │ Red / M    │ 3         │ 10     │ [Order 50] │  │
 * │  │ Canvas Sneakers  │ White / 42 │ 1         │ 5      │ [Order 30] │  │
 * │  │ Denim Jacket     │ Blue / L   │ 0         │ 5      │ [Order 20] │  │
 * │  └─────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  ┌── Recent Stock Movements ───────────────────────────────────────┐  │
 * │  │ 📦 +50 Summer T-Shirt (Red/M) — Purchase Order #PO-1042       │  │
 * │  │ 🛒 −1 Canvas Sneakers (White/42) — Order #ORD-2847            │  │
 * │  │ 🔄 +2 Denim Jacket (Blue/L) — Return #RET-0092                │  │
 * │  │ ⚠️ −5 Winter Coat (Black/XL) — Damage Write-off               │  │
 * │  └─────────────────────────────────────────────────────────────────┘  │
 * └───────────────────────────────────────────────────────────────────────┘
 */
```

### 11.2 Multi-Currency Support

```typescript
// ============================================
// MULTI-CURRENCY ENGINE
// ============================================

interface CurrencyConfig {
  supported: Currency[];
  default: string;
  autoDetect: boolean;           // Detect from user's locale
  displayFormat: 'symbol' | 'code' | 'both';
  exchangeRateProvider: 'openexchangerates' | 'fixer' | 'manual';
  updateFrequency: 'hourly' | 'daily' | 'manual';
}

interface Currency {
  code: string;       // ISO 4217
  symbol: string;
  name: string;
  decimals: number;
  symbolPosition: 'before' | 'after';
  thousandsSeparator: string;
  decimalSeparator: string;
}

const currencyPresets: Currency[] = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee',   decimals: 2, symbolPosition: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
  { code: 'USD', symbol: '$', name: 'US Dollar',       decimals: 2, symbolPosition: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
  { code: 'EUR', symbol: '€', name: 'Euro',            decimals: 2, symbolPosition: 'before', thousandsSeparator: '.', decimalSeparator: ',' },
  { code: 'GBP', symbol: '£', name: 'British Pound',   decimals: 2, symbolPosition: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen',    decimals: 0, symbolPosition: 'before', thousandsSeparator: ',', decimalSeparator: '.' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham',    decimals: 2, symbolPosition: 'after',  thousandsSeparator: ',', decimalSeparator: '.' },
  { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal',   decimals: 2, symbolPosition: 'after',  thousandsSeparator: ',', decimalSeparator: '.' },
];

// Price Storage Strategy
/*
 * 1. Store base price in store's default currency
 * 2. Store per-currency manual overrides (optional)
 * 3. Auto-convert at checkout using live exchange rates
 * 4. Cache exchange rates with 1-hour TTL
 * 
 * Table: product_prices
 * ┌────────────┬──────────┬────────────┬───────────┐
 * │ product_id │ currency │ price      │ is_manual │
 * ├────────────┼──────────┼────────────┼───────────┤
 * │ abc123     │ INR      │ 2499.00    │ true      │ ← Base price
 * │ abc123     │ USD      │ 29.99      │ true      │ ← Manual override
 * │ abc123     │ EUR      │ NULL       │ false     │ ← Auto-converted
 * └────────────┴──────────┴────────────┴───────────┘
 */

// Currency formatting utility
const formatPrice = (amount: number, currency: Currency): string => {
  const formatted = new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: currency.decimals,
    maximumFractionDigits: currency.decimals,
  }).format(amount);
  
  return currency.symbolPosition === 'before'
    ? `${currency.symbol}${formatted}`
    : `${formatted} ${currency.symbol}`;
};
```

### 11.3 Tax Calculation Engine

```typescript
// ============================================
// TAX ENGINE — GST / VAT / SALES TAX
// ============================================

interface TaxConfig {
  mode: 'inclusive' | 'exclusive';  // Prices include tax or not
  defaultRate: number;
  rules: TaxRule[];
  gstEnabled: boolean;              // India-specific GST
  hsnCodeRequired: boolean;
}

interface TaxRule {
  id: string;
  name: string;
  type: 'percentage' | 'fixed';
  rate: number;
  applicableTo: {
    countries?: string[];
    states?: string[];
    categories?: string[];
    priceRange?: { min: number; max: number };
  };
  priority: number;                  // Higher priority = applied first
}

/*
 * Indian GST Tax Slabs:
 * ┌──────────────┬────────────┬──────────────────────────┐
 * │ GST Rate     │ CGST+SGST  │ Applicable Items         │
 * ├──────────────┼────────────┼──────────────────────────┤
 * │ 0%           │ 0% + 0%    │ Essential items          │
 * │ 5%           │ 2.5%+2.5%  │ Packaged food, footwear  │
 * │ 12%          │ 6% + 6%    │ Processed food, phones   │
 * │ 18%          │ 9% + 9%    │ Most goods & services    │
 * │ 28%          │ 14% + 14%  │ Luxury goods, cars       │
 * └──────────────┴────────────┴──────────────────────────┘
 *
 * Interstate: IGST (single rate) replaces CGST+SGST
 */

const calculateTax = (
  subtotal: number,
  customerState: string,
  sellerState: string,
  gstRate: number,
  mode: 'inclusive' | 'exclusive'
): TaxBreakdown => {
  const isInterstate = customerState !== sellerState;
  
  if (mode === 'inclusive') {
    const taxableAmount = subtotal / (1 + gstRate / 100);
    const taxAmount = subtotal - taxableAmount;
    
    return {
      taxableAmount: round(taxableAmount),
      totalTax: round(taxAmount),
      components: isInterstate
        ? [{ name: 'IGST', rate: gstRate, amount: round(taxAmount) }]
        : [
            { name: 'CGST', rate: gstRate / 2, amount: round(taxAmount / 2) },
            { name: 'SGST', rate: gstRate / 2, amount: round(taxAmount / 2) },
          ],
      total: subtotal,
    };
  } else {
    const taxAmount = subtotal * (gstRate / 100);
    return {
      taxableAmount: subtotal,
      totalTax: round(taxAmount),
      components: isInterstate
        ? [{ name: 'IGST', rate: gstRate, amount: round(taxAmount) }]
        : [
            { name: 'CGST', rate: gstRate / 2, amount: round(taxAmount / 2) },
            { name: 'SGST', rate: gstRate / 2, amount: round(taxAmount / 2) },
          ],
      total: round(subtotal + taxAmount),
    };
  }
};
```

### 11.4 Shipping Integration

```typescript
// ============================================
// SHIPPING — MULTI-PROVIDER GATEWAY
// ============================================

interface ShippingProvider {
  id: string;
  name: string;
  logo: string;
  apiEndpoint: string;
  features: ('tracking' | 'label' | 'pickup' | 'cod' | 'returns')[];
}

const shippingProviders: ShippingProvider[] = [
  // Indian Providers
  { id: 'shiprocket',  name: 'Shiprocket',     features: ['tracking', 'label', 'pickup', 'cod', 'returns'] },
  { id: 'delhivery',   name: 'Delhivery',      features: ['tracking', 'label', 'pickup', 'cod'] },
  { id: 'bluedart',    name: 'Blue Dart',       features: ['tracking', 'label', 'pickup'] },
  { id: 'dtdc',        name: 'DTDC',            features: ['tracking', 'label', 'pickup', 'cod'] },
  // International
  { id: 'fedex',       name: 'FedEx',           features: ['tracking', 'label', 'pickup', 'returns'] },
  { id: 'dhl',         name: 'DHL Express',     features: ['tracking', 'label', 'pickup', 'returns'] },
];

/*
 * Shipping Rules Engine:
 *
 * ┌── Shipping Zones ────────────────────────────────────────────────────┐
 * │                                                                       │
 * │  Zone: "Domestic — Metro Cities"                                      │
 * │  Regions: Mumbai, Delhi, Bangalore, Chennai, Kolkata, Hyderabad      │
 * │  ┌── Rate: Flat Rate ────────────────────────────────────────────┐   │
 * │  │  ₹40 for orders < ₹500                                       │   │
 * │  │  FREE for orders ≥ ₹500                                       │   │
 * │  │  ₹30 extra for COD                                            │   │
 * │  └──────────────────────────────────────────────────────────────┘   │
 * │                                                                       │
 * │  Zone: "Domestic — Rest of India"                                     │
 * │  Regions: All other PIN codes                                         │
 * │  ┌── Rate: Weight-Based ────────────────────────────────────────┐   │
 * │  │  First 500g: ₹60                                              │   │
 * │  │  Each additional 500g: ₹30                                    │   │
 * │  │  FREE for orders ≥ ₹999                                       │   │
 * │  │  ₹40 extra for COD                                            │   │
 * │  └──────────────────────────────────────────────────────────────┘   │
 * │                                                                       │
 * │  Zone: "International"                                                │
 * │  Regions: All countries except India                                   │
 * │  ┌── Rate: Weight-Based ────────────────────────────────────────┐   │
 * │  │  First 500g: $15                                              │   │
 * │  │  Each additional 500g: $8                                     │   │
 * │  │  No COD available                                             │   │
 * │  └──────────────────────────────────────────────────────────────┘   │
 * └───────────────────────────────────────────────────────────────────────┘
 */
```

### 11.5 Discount & Promotion Engine

```typescript
// ============================================
// DISCOUNT ENGINE — FLEXIBLE PROMO SYSTEM
// ============================================

interface DiscountRule {
  id: string;
  code?: string;                    // NULL = automatic discount
  type: 'percentage' | 'fixed' | 'buy_x_get_y' | 'free_shipping';
  value: number;
  conditions: {
    minPurchase?: number;
    minQuantity?: number;
    applicableProducts?: string[];
    applicableCategories?: string[];
    applicableCollections?: string[];
    customerGroups?: string[];       // 'new' | 'returning' | 'vip'
    firstTimeOnly?: boolean;
    validFrom: Date;
    validUntil: Date;
    maxUses?: number;
    maxUsesPerCustomer?: number;
    combineWithOther?: boolean;
  };
  currentUses: number;
}

/*
 * Discount Builder UI:
 *
 * ┌── Create Discount ───────────────────────────────────────────────────┐
 * │                                                                       │
 * │  Discount Code (optional)                                             │
 * │  ┌───────────────────────────────────────────────────────────────┐   │
 * │  │ SUMMER2025                                    [Generate Code] │   │
 * │  └───────────────────────────────────────────────────────────────┘   │
 * │                                                                       │
 * │  Type                                                                 │
 * │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────┐ │
 * │  │ ◉ Percentage │  │ ○ Fixed Amt  │  │ ○ Buy X Get Y│  │ ○ Free  │ │
 * │  │              │  │              │  │              │  │ Shipping│ │
 * │  └──────────────┘  └──────────────┘  └──────────────┘  └─────────┘ │
 * │                                                                       │
 * │  Value: [20] %                                                        │
 * │                                                                       │
 * │  ─── Conditions ──────────────────────────────────────────────────── │
 * │  Min. purchase amount: [₹ 500]                                        │
 * │  Applies to: (●) All products  ( ) Specific products  ( ) Categories │
 * │  Customer eligibility: [All Customers ▼]                              │
 * │  Usage limits: Max [100] uses total, [1] per customer                 │
 * │  Active dates: [Feb 1, 2025] to [Mar 31, 2025]                       │
 * │  Can combine with other discounts: [✓]                                │
 * │                                                                       │
 * │                                          [Cancel] [Save Discount]     │
 * └───────────────────────────────────────────────────────────────────────┘
 */

// Discount calculation pipeline
const applyDiscounts = (cart: Cart, availableDiscounts: DiscountRule[]): CartWithDiscounts => {
  // 1. Filter eligible discounts
  const eligible = availableDiscounts.filter(d => isEligible(cart, d));
  
  // 2. Sort by priority (automatic first, then by value)
  const sorted = eligible.sort((a, b) => {
    if (!a.code && b.code) return -1;  // Auto discounts first
    return calculateDiscount(b, cart) - calculateDiscount(a, cart);  // Highest value first
  });
  
  // 3. Apply discounts (respecting combination rules)
  let appliedDiscounts: AppliedDiscount[] = [];
  let remainingTotal = cart.subtotal;
  
  for (const discount of sorted) {
    if (!discount.conditions.combineWithOther && appliedDiscounts.length > 0) continue;
    
    const amount = calculateDiscount(discount, { ...cart, subtotal: remainingTotal });
    appliedDiscounts.push({ discount, amount });
    remainingTotal -= amount;
    
    if (remainingTotal <= 0) break;
  }
  
  return { ...cart, discounts: appliedDiscounts, total: Math.max(0, remainingTotal) };
};
```

### 11.6 Checkout Optimization

```typescript
// ============================================
// CHECKOUT — CONVERSION-OPTIMIZED FLOW
// ============================================

/*
 * Single-Page Checkout Flow:
 *
 * ┌── Checkout ──────────────────────────────────────────────────────────┐
 * │                                                                       │
 * │  ┌── Left Column (60%) ──────────────────────────────────────────┐   │
 * │  │                                                                │   │
 * │  │  ① CONTACT                                              ✓ Done│   │
 * │  │  ┌──────────────────────────────────────────────────────┐     │   │
 * │  │  │ john@example.com                           [Change] │     │   │
 * │  │  └──────────────────────────────────────────────────────┘     │   │
 * │  │                                                                │   │
 * │  │  ② DELIVERY ADDRESS                                    ✓ Done│   │
 * │  │  ┌──────────────────────────────────────────────────────┐     │   │
 * │  │  │ John Doe                                             │     │   │
 * │  │  │ 123 MG Road, Indiranagar                             │     │   │
 * │  │  │ Bangalore, Karnataka 560038                          │     │   │
 * │  │  │ Phone: +91 98765 43210                    [Change]  │     │   │
 * │  │  └──────────────────────────────────────────────────────┘     │   │
 * │  │                                                                │   │
 * │  │  ③ SHIPPING METHOD                                    ● Active│   │
 * │  │  ┌──────────────────────────────────────────────────────┐     │   │
 * │  │  │ ◉ Standard Delivery (3-5 days)              FREE    │     │   │
 * │  │  │ ○ Express Delivery (1-2 days)               ₹149    │     │   │
 * │  │  │ ○ Same Day Delivery (order before 2pm)      ₹299    │     │   │
 * │  │  └──────────────────────────────────────────────────────┘     │   │
 * │  │                                                                │   │
 * │  │  ④ PAYMENT                                                    │   │
 * │  │  ┌──────────────────────────────────────────────────────┐     │   │
 * │  │  │ ◉ UPI (PhonePe, GPay, Paytm)                        │     │   │
 * │  │  │ ○ Credit / Debit Card                                │     │   │
 * │  │  │ ○ Net Banking                                        │     │   │
 * │  │  │ ○ Cash on Delivery (+₹30)                            │     │   │
 * │  │  │ ○ EMI (starting ₹833/month)                          │     │   │
 * │  │  └──────────────────────────────────────────────────────┘     │   │
 * │  └────────────────────────────────────────────────────────────────┘   │
 * │                                                                       │
 * │  ┌── Right Column (40%) — Order Summary ─────────────────────────┐   │
 * │  │                                                                │   │
 * │  │  ┌─────┐ Summer T-Shirt (Red, M)            ×2    ₹1,998    │   │
 * │  │  │ 📷  │                                                     │   │
 * │  │  └─────┘                                                      │   │
 * │  │  ┌─────┐ Canvas Sneakers (White, 42)         ×1    ₹3,499    │   │
 * │  │  │ 📷  │                                                     │   │
 * │  │  └─────┘                                                      │   │
 * │  │                                                                │   │
 * │  │  Discount Code: [SUMMER2025        ] [Apply]                  │   │
 * │  │  ✅ SUMMER2025 applied — 20% off                              │   │
 * │  │                                                                │   │
 * │  │  ─────────────────────────────────────────                    │   │
 * │  │  Subtotal                              ₹5,497                │   │
 * │  │  Discount (SUMMER2025)                −₹1,099                │   │
 * │  │  Shipping                               FREE                 │   │
 * │  │  CGST (9%)                              ₹396                 │   │
 * │  │  SGST (9%)                              ₹396                 │   │
 * │  │  ─────────────────────────────────────────                    │   │
 * │  │  Total                                 ₹5,190                │   │
 * │  │                                                                │   │
 * │  │  ┌────────────────────────────────────────────────────────┐   │   │
 * │  │  │           🔒 PLACE ORDER — ₹5,190                    │   │   │
 * │  │  └────────────────────────────────────────────────────────┘   │   │
 * │  │                                                                │   │
 * │  │  🔒 256-bit SSL Encrypted  •  Secure Checkout               │   │
 * │  └────────────────────────────────────────────────────────────────┘   │
 * └───────────────────────────────────────────────────────────────────────┘
 */

// Abandoned Cart Recovery
interface AbandonedCartConfig {
  trackAfterMinutes: 30;
  emailSequence: [
    { delayHours: 1,  subject: 'You left something behind!', includeDiscount: false },
    { delayHours: 24, subject: 'Your cart is waiting',       includeDiscount: true, discountPercent: 10 },
    { delayHours: 72, subject: 'Last chance — 15% off',      includeDiscount: true, discountPercent: 15 },
  ];
  whatsappEnabled: true;
  pushNotificationEnabled: true;
}
```

---

> **End of Part 6** — Continue to Part 7 for Analytics Dashboard & Reporting Engine

---

## 12. Analytics Dashboard & Reporting Engine

> **Part 7 of 8** | Data-Driven Insights for Growth

### 12.1 Analytics Architecture

```typescript
// ============================================
// ANALYTICS ENGINE — EVENT TRACKING PIPELINE
// ============================================

/*
 * Data Flow:
 *                                                           
 *  Storefront ──► Edge Function ──► Analytics Events Table  
 *       │                                    │              
 *       │         Supabase                   │              
 *       │         Realtime ◄─────────────────┘              
 *       │              │                                    
 *       ▼              ▼                                    
 *  Page View    Admin Dashboard                             
 *  Tracking     (Real-time Charts)                          
 *                                                           
 *  Nightly CRON ──► Aggregated Metrics ──► Cached Reports   
 */

// Analytics Events Schema
interface AnalyticsEvent {
  id: string;
  siteId: string;
  sessionId: string;
  visitorId: string;        // Anonymous fingerprint
  userId?: string;          // If logged in
  event: string;
  properties: Record<string, any>;
  page: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  device: 'desktop' | 'tablet' | 'mobile';
  browser: string;
  os: string;
  country: string;
  city?: string;
  timestamp: Date;
}

// Event Types
const ANALYTICS_EVENTS = {
  // Page / Content
  PAGE_VIEW:        'page_view',
  BLOG_POST_VIEW:   'blog_post_view',
  BLOG_POST_READ:   'blog_post_read',    // Scrolled > 75%
  SEARCH:           'search',
  
  // E-commerce
  PRODUCT_VIEW:     'product_view',
  ADD_TO_CART:       'add_to_cart',
  REMOVE_FROM_CART:  'remove_from_cart',
  CHECKOUT_START:    'checkout_start',
  CHECKOUT_COMPLETE: 'checkout_complete',
  
  // Engagement
  SHARE:            'share',
  COMMENT:          'comment',
  SUBSCRIBE:        'subscribe',
  CONTACT_FORM:     'contact_form',
  
  // Performance
  WEB_VITAL_LCP:    'web_vital_lcp',
  WEB_VITAL_FID:    'web_vital_fid',
  WEB_VITAL_CLS:    'web_vital_cls',
} as const;
```

```sql
-- ============================================
-- ANALYTICS DATABASE SCHEMA
-- ============================================

-- Raw Events (partitioned by month for performance)
CREATE TABLE analytics_events (
  id UUID DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  visitor_id VARCHAR(64) NOT NULL,
  user_id UUID,
  event VARCHAR(50) NOT NULL,
  properties JSONB DEFAULT '{}',
  page VARCHAR(2048),
  referrer VARCHAR(2048),
  utm_source VARCHAR(100),
  utm_medium VARCHAR(100),
  utm_campaign VARCHAR(100),
  device VARCHAR(10),
  browser VARCHAR(50),
  os VARCHAR(50),
  country VARCHAR(2),
  city VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE analytics_events_2025_01 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');
CREATE TABLE analytics_events_2025_02 PARTITION OF analytics_events
  FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');
-- ... additional monthly partitions auto-created by CRON

-- Daily Aggregates (pre-computed for fast dashboard queries)
CREATE TABLE analytics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL,
  date DATE NOT NULL,
  page_views INTEGER DEFAULT 0,
  unique_visitors INTEGER DEFAULT 0,
  sessions INTEGER DEFAULT 0,
  avg_session_duration INTERVAL,
  bounce_rate DECIMAL(5,2),
  top_pages JSONB DEFAULT '[]',
  top_referrers JSONB DEFAULT '[]',
  top_countries JSONB DEFAULT '[]',
  device_breakdown JSONB DEFAULT '{}',
  browser_breakdown JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, date)
);

-- E-commerce Metrics (daily)
CREATE TABLE analytics_ecommerce_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL,
  date DATE NOT NULL,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  total_orders INTEGER DEFAULT 0,
  average_order_value DECIMAL(12,2) DEFAULT 0,
  cart_abandonment_rate DECIMAL(5,2),
  conversion_rate DECIMAL(5,4),
  top_products JSONB DEFAULT '[]',
  revenue_by_category JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, date)
);

-- Content Performance Metrics
CREATE TABLE analytics_content_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL,
  post_id UUID,
  date DATE NOT NULL,
  views INTEGER DEFAULT 0,
  unique_views INTEGER DEFAULT 0,
  avg_time_on_page INTERVAL,
  scroll_depth_avg DECIMAL(5,2),
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(site_id, post_id, date)
);

-- Indexes for fast dashboard queries
CREATE INDEX idx_analytics_events_site_date ON analytics_events (site_id, created_at DESC);
CREATE INDEX idx_analytics_events_session ON analytics_events (session_id);
CREATE INDEX idx_analytics_daily_site_date ON analytics_daily (site_id, date DESC);
CREATE INDEX idx_analytics_ecommerce_site_date ON analytics_ecommerce_daily (site_id, date DESC);

-- Daily aggregation function (runs via pg_cron at midnight)
CREATE OR REPLACE FUNCTION fn_aggregate_daily_analytics(target_date DATE DEFAULT CURRENT_DATE - 1)
RETURNS VOID AS $$
DECLARE
  site RECORD;
BEGIN
  FOR site IN SELECT DISTINCT site_id FROM analytics_events 
    WHERE created_at >= target_date AND created_at < target_date + 1
  LOOP
    INSERT INTO analytics_daily (site_id, date, page_views, unique_visitors, sessions)
    SELECT
      site.site_id,
      target_date,
      COUNT(*) FILTER (WHERE event = 'page_view'),
      COUNT(DISTINCT visitor_id),
      COUNT(DISTINCT session_id)
    FROM analytics_events
    WHERE site_id = site.site_id
      AND created_at >= target_date
      AND created_at < target_date + 1
    ON CONFLICT (site_id, date) DO UPDATE SET
      page_views = EXCLUDED.page_views,
      unique_visitors = EXCLUDED.unique_visitors,
      sessions = EXCLUDED.sessions;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
```

### 12.2 Main Analytics Dashboard

```typescript
// ============================================
// ANALYTICS DASHBOARD — WIREFRAME
// ============================================

/*
 * ┌── Analytics Dashboard ───────────────────────────────────────────────┐
 * │                                                                       │
 * │  Date Range: [Last 30 Days ▼]  Compare: [Previous Period ▼]  [Export]│
 * │                                                                       │
 * │  ┌── KPI Cards ───────────────────────────────────────────────────┐  │
 * │  │                                                                │  │
 * │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────┐ │  │
 * │  │  │  Visitors    │  │  Page Views  │  │  Bounce Rate │  │Avg.│ │  │
 * │  │  │  12,847      │  │  45,231      │  │  42.3%       │  │Dur.│ │  │
 * │  │  │  ↑ 18.2%     │  │  ↑ 23.5%     │  │  ↓ 3.1%     │  │2:47│ │  │
 * │  │  │  vs prev     │  │  vs prev     │  │  vs prev     │  │↑12%│ │  │
 * │  │  └──────────────┘  └──────────────┘  └──────────────┘  └────┘ │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  ┌── Traffic Over Time ── [Line ▼] ───────────────────────────────┐  │
 * │  │  10K ┤                                                          │  │
 * │  │      │              ╱╲                                          │  │
 * │  │   8K ┤           ╱╱   ╲╲      ╱╲                               │  │
 * │  │      │         ╱╱       ╲╲  ╱╱  ╲╲                             │  │
 * │  │   6K ┤      ╱╱╱          ╲╲╱      ╲╲                           │  │
 * │  │      │   ╱╱╱                        ╲╲╲                        │  │
 * │  │   4K ┤╱╱╱                              ╲╲╲                     │  │
 * │  │      │                                     ╲╲╲╲╲╲              │  │
 * │  │   2K ┤                                          ╲╲╲            │  │
 * │  │      ├──────┬──────┬──────┬──────┬──────┬──────┬──────         │  │
 * │  │      Jan 6  Jan 13 Jan 20 Jan 27 Feb 3  Feb 10 Feb 17         │  │
 * │  │                                                                 │  │
 * │  │  ── Visitors (12,847)   ·· Page Views (45,231)                 │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  ┌── Row 2 ───────────────────────────────────────────────────────┐  │
 * │  │                                                                │  │
 * │  │  ┌── Top Pages ──────────────┐  ┌── Traffic Sources ────────┐ │  │
 * │  │  │                            │  │                            │ │  │
 * │  │  │ 1. /                 4,521 │  │ ● Direct        45.2%    │ │  │
 * │  │  │ 2. /blog/nextjs      2,847 │  │ ● Google        28.7%    │ │  │
 * │  │  │ 3. /blog/css-tips    1,923 │  │ ● Twitter       12.3%    │ │  │
 * │  │  │ 4. /about            1,456 │  │ ● Facebook       8.1%    │ │  │
 * │  │  │ 5. /contact            891 │  │ ● Other          5.7%    │ │  │
 * │  │  │                            │  │                            │ │  │
 * │  │  │ [View All Pages →]         │  │            [Doughnut Chart]│ │  │
 * │  │  └────────────────────────────┘  └────────────────────────────┘ │  │
 * │  │                                                                │  │
 * │  │  ┌── Devices ────────────────┐  ┌── Top Countries ──────────┐ │  │
 * │  │  │                            │  │                            │ │  │
 * │  │  │  💻 Desktop     58.3%     │  │ 🇮🇳 India        67.2%    │ │  │
 * │  │  │  ████████████░░░░░░░░     │  │ 🇺🇸 USA          12.8%    │ │  │
 * │  │  │  📱 Mobile      35.2%     │  │ 🇬🇧 UK            5.4%    │ │  │
 * │  │  │  █████████░░░░░░░░░░░     │  │ 🇨🇦 Canada        3.2%    │ │  │
 * │  │  │  📱 Tablet       6.5%     │  │ 🇦🇺 Australia     2.8%    │ │  │
 * │  │  │  ██░░░░░░░░░░░░░░░░░░     │  │                            │ │  │
 * │  │  └────────────────────────────┘  └────────────────────────────┘ │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * └───────────────────────────────────────────────────────────────────────┘
 */
```

### 12.3 Blog Content Analytics

```typescript
/*
 * ┌── Content Performance ───────────────────────────────────────────────┐
 * │                                                                       │
 * │  ┌── KPI Cards ───────────────────────────────────────────────────┐  │
 * │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────┐ │  │
 * │  │  │  Total Posts  │  │  Avg. Views  │  │  Subscribers │  │Eng.│ │  │
 * │  │  │  87           │  │  523 / post  │  │  1,247       │  │Rate│ │  │
 * │  │  │  +5 this mo   │  │  ↑ 15.3%     │  │  ↑ 8.7%      │  │4.2%│ │  │
 * │  │  └──────────────┘  └──────────────┘  └──────────────┘  └────┘ │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  ┌── Top Performing Posts ─────────────────────────────────────────┐  │
 * │  │ #  │ Title                        │ Views  │ Read  │ Shares   │  │
 * │  │────│──────────────────────────────│────────│───────│──────────│  │
 * │  │ 1  │ Getting Started with Next.js │ 4,521  │ 72%   │ 234      │  │
 * │  │ 2  │ CSS Tips You Need to Know    │ 3,847  │ 68%   │ 189      │  │
 * │  │ 3  │ React 19 What's New          │ 2,923  │ 81%   │ 312      │  │
 * │  │ 4  │ TypeScript Best Practices    │ 2,456  │ 75%   │ 178      │  │
 * │  │ 5  │ Supabase vs Firebase         │ 1,891  │ 83%   │ 267      │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  ┌── Content Breakdown ───────────────────────────────────────────┐  │
 * │  │                                                                │  │
 * │  │  ┌── By Category ────────────┐  ┌── Post Frequency ─────────┐ │  │
 * │  │  │                            │  │                            │ │  │
 * │  │  │ React          28 posts   │  │  ▇                         │ │  │
 * │  │  │ ████████████████████░░░░  │  │  ▇  ▇     ▇               │ │  │
 * │  │  │ CSS            19 posts   │  │  ▇  ▇  ▇  ▇  ▇            │ │  │
 * │  │  │ █████████████░░░░░░░░░░  │  │  ▇  ▇  ▇  ▇  ▇  ▇  ▇     │ │  │
 * │  │  │ TypeScript     15 posts   │  │  ▇  ▇  ▇  ▇  ▇  ▇  ▇  ▇  │ │  │
 * │  │  │ ██████████░░░░░░░░░░░░░  │  │  W1 W2 W3 W4 W5 W6 W7 W8 │ │  │
 * │  │  │ Next.js        12 posts   │  │                            │ │  │
 * │  │  │ ████████░░░░░░░░░░░░░░░  │  │  Avg: 3.2 posts/week      │ │  │
 * │  │  └────────────────────────────┘  └────────────────────────────┘ │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * └───────────────────────────────────────────────────────────────────────┘
 */
```

### 12.4 E-commerce Revenue Analytics

```typescript
/*
 * ┌── Revenue Analytics ─────────────────────────────────────────────────┐
 * │                                                                       │
 * │  ┌── Revenue KPIs ────────────────────────────────────────────────┐  │
 * │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────┐ │  │
 * │  │  │  Revenue     │  │  Orders      │  │  AOV         │  │Conv│ │  │
 * │  │  │  ₹4,58,750   │  │  347         │  │  ₹1,322      │  │Rate│ │  │
 * │  │  │  ↑ 24.5%     │  │  ↑ 18.2%     │  │  ↑ 5.3%      │  │3.2%│ │  │
 * │  │  └──────────────┘  └──────────────┘  └──────────────┘  └────┘ │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  ┌── Revenue Over Time ───────────────────────────────────────────┐  │
 * │  │  ₹80K ┤                     ╱╲                                  │  │
 * │  │       │                   ╱╱  ╲╲                                │  │
 * │  │  ₹60K ┤      ╱╲        ╱╱      ╲╲    ╱╱╲╲                     │  │
 * │  │       │    ╱╱  ╲╲    ╱╱          ╲╲╱╱    ╲╲                    │  │
 * │  │  ₹40K ┤  ╱╱      ╲╱╱                      ╲╲                   │  │
 * │  │       │╱╱                                     ╲╲                │  │
 * │  │  ₹20K ┤                                                         │  │
 * │  │       ├──────┬──────┬──────┬──────┬──────┬──────┬──────         │  │
 * │  │       Jan 6  Jan 13 Jan 20 Jan 27 Feb 3  Feb 10 Feb 17         │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  ┌── Sales Funnel ────────────────────────────────────────────────┐  │
 * │  │                                                                │  │
 * │  │  Product Views        ████████████████████████████  12,847     │  │
 * │  │  Add to Cart          ██████████████████░░░░░░░░░░   3,421     │  │
 * │  │  Checkout Started     ████████████░░░░░░░░░░░░░░░░   1,856     │  │
 * │  │  Checkout Completed   █████░░░░░░░░░░░░░░░░░░░░░░░     347     │  │
 * │  │                                                                │  │
 * │  │  Overall Conversion: 2.7%  │  Cart → Purchase: 10.1%          │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  ┌── Top Products by Revenue ─────────────────────────────────────┐  │
 * │  │ #  │ Product                │ Units │ Revenue   │ % of Total  │  │
 * │  │────│────────────────────────│───────│───────────│─────────────│  │
 * │  │ 1  │ Canvas Sneakers        │ 89    │ ₹3,11,411 │ 67.9%       │  │
 * │  │ 2  │ Summer T-Shirt         │ 145   │ ₹1,44,855 │ 31.6%       │  │
 * │  │ 3  │ Denim Jacket           │ 12    │ ₹47,880   │ 10.4%       │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * └───────────────────────────────────────────────────────────────────────┘
 */
```

### 12.5 SEO & Web Performance Analytics

```typescript
/*
 * ┌── SEO & Performance ─────────────────────────────────────────────────┐
 * │                                                                       │
 * │  ┌── Core Web Vitals ─────────────────────────────────────────────┐  │
 * │  │                                                                │  │
 * │  │  LCP (Largest Contentful Paint)                                │  │
 * │  │  ┌──────────────────────────────────────────────────────┐     │  │
 * │  │  │ 🟢 1.8s     Good < 2.5s                      [p75]│     │  │
 * │  │  │ ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░      │     │  │
 * │  │  └──────────────────────────────────────────────────────┘     │  │
 * │  │                                                                │  │
 * │  │  FID (First Input Delay)                                      │  │
 * │  │  ┌──────────────────────────────────────────────────────┐     │  │
 * │  │  │ 🟢 45ms     Good < 100ms                     [p75]│     │  │
 * │  │  │ ██████████████████████████░░░░░░░░░░░░░░░░░░░      │     │  │
 * │  │  └──────────────────────────────────────────────────────┘     │  │
 * │  │                                                                │  │
 * │  │  CLS (Cumulative Layout Shift)                                │  │
 * │  │  ┌──────────────────────────────────────────────────────┐     │  │
 * │  │  │ 🟡 0.12     Needs improvement < 0.1          [p75]│     │  │
 * │  │  │ ████████████████████████████████████░░░░░░░░░░      │     │  │
 * │  │  └──────────────────────────────────────────────────────┘     │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  ┌── Search Keywords ─────────────────────────────────────────────┐  │
 * │  │ Keyword                  │ Impressions │ Clicks │ CTR  │ Pos. │  │
 * │  │──────────────────────────│─────────────│────────│──────│──────│  │
 * │  │ "nextjs tutorial"        │ 12,450      │ 1,247  │ 10%  │ 3.2  │  │
 * │  │ "css tips"               │ 8,920       │ 714    │ 8%   │ 5.1  │  │
 * │  │ "react best practices"   │ 6,340       │ 380    │ 6%   │ 8.7  │  │
 * │  │ "typescript guide"       │ 5,120       │ 256    │ 5%   │ 12.4 │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  ┌── Page Speed by Route ─────────────────────────────────────────┐  │
 * │  │ Route                │ LCP   │ FID  │ CLS   │ Score │ Grade  │  │
 * │  │──────────────────────│───────│──────│───────│───────│────────│  │
 * │  │ / (Homepage)         │ 1.2s  │ 24ms │ 0.02  │ 95    │ 🟢 A  │  │
 * │  │ /blog                │ 1.8s  │ 45ms │ 0.08  │ 88    │ 🟢 B+ │  │
 * │  │ /blog/:slug          │ 2.1s  │ 38ms │ 0.12  │ 82    │ 🟡 B  │  │
 * │  │ /shop                │ 2.8s  │ 62ms │ 0.15  │ 71    │ 🟡 C+ │  │
 * │  │ /checkout            │ 1.5s  │ 31ms │ 0.03  │ 92    │ 🟢 A  │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * └───────────────────────────────────────────────────────────────────────┘
 */
```

### 12.6 Report Builder & Export

```typescript
// ============================================
// REPORT BUILDER — CUSTOM REPORT GENERATOR
// ============================================

interface ReportConfig {
  name: string;
  metrics: string[];             // Selected KPIs
  dimensions: string[];          // Grouping dimensions
  filters: FilterState;
  dateRange: DateRange;
  compareWith?: DateRange;
  visualization: 'table' | 'line' | 'bar' | 'pie' | 'funnel';
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    recipients: string[];
    format: 'pdf' | 'csv' | 'xlsx';
  };
}

/*
 * Report Builder UI:
 *
 * ┌── Create Report ─────────────────────────────────────────────────────┐
 * │                                                                       │
 * │  Report Name: [Monthly Performance Overview          ]               │
 * │                                                                       │
 * │  ┌── Metrics (drag to reorder) ───────────────────────────────────┐  │
 * │  │  [✓] Page Views    [✓] Unique Visitors  [✓] Bounce Rate       │  │
 * │  │  [✓] Avg. Duration [ ] Revenue          [ ] Orders             │  │
 * │  │  [ ] Conversion    [ ] Cart Abandon.    [✓] New Subscribers    │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  ┌── Dimensions ──────────────────────────────────────────────────┐  │
 * │  │  Group by: [Date (Daily) ▼]                                    │  │
 * │  │  Break down by: [Traffic Source ▼]                              │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  ┌── Visualization ───────────────────────────────────────────────┐  │
 * │  │  [◉ Line] [○ Bar] [○ Table] [○ Pie] [○ Funnel]               │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  ┌── Schedule (Optional) ─────────────────────────────────────────┐  │
 * │  │  [✓] Auto-send report                                         │  │
 * │  │  Frequency: [Monthly ▼] on [1st ▼]                            │  │
 * │  │  Recipients: [john@example.com] [+ Add]                        │  │
 * │  │  Format: [PDF ▼]                                               │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  [Preview Report]                    [Cancel] [Save & Generate]      │
 * └───────────────────────────────────────────────────────────────────────┘
 */

// Export formats
const exportReport = async (report: ReportConfig, format: 'pdf' | 'csv' | 'xlsx') => {
  const data = await fetchReportData(report);
  
  switch (format) {
    case 'csv':
      return generateCSV(data, report.metrics);
    case 'xlsx':
      return generateXLSX(data, report.metrics, report.name);
    case 'pdf':
      return generatePDF(data, {
        title: report.name,
        dateRange: report.dateRange,
        charts: report.visualization !== 'table',
        branding: { logo: site.logo, name: site.name },
      });
  }
};
```

### 12.7 Real-Time Live Dashboard

```typescript
/*
 * ┌── Live Dashboard (Real-Time) ────────────────────────────────────────┐
 * │                                                                       │
 * │  🟢 LIVE  •  Auto-refreshing every 5 seconds                        │
 * │                                                                       │
 * │  ┌── Right Now ───────────────────────────────────────────────────┐  │
 * │  │                                                                │  │
 * │  │  Active Visitors: 47                                           │  │
 * │  │                                                                │  │
 * │  │  ┌── Active Pages ─────────────────────────────────────────┐  │  │
 * │  │  │ /blog/nextjs-15-guide           12 visitors             │  │  │
 * │  │  │ /                                8 visitors             │  │  │
 * │  │  │ /shop/canvas-sneakers            6 visitors             │  │  │
 * │  │  │ /blog/css-tips                   5 visitors             │  │  │
 * │  │  │ /checkout                        3 visitors             │  │  │
 * │  │  └─────────────────────────────────────────────────────────┘  │  │
 * │  │                                                                │  │
 * │  │  ┌── Live Event Stream ────────────────────────────────────┐  │  │
 * │  │  │ 🟢 Page View     /blog/nextjs-15   India    2s ago     │  │  │
 * │  │  │ 🛒 Add to Cart   Canvas Sneakers   USA      5s ago     │  │  │
 * │  │  │ 🟢 Page View     /shop             India    8s ago     │  │  │
 * │  │  │ 📝 Comment       "Great article!"  UK       12s ago    │  │  │
 * │  │  │ 💳 Purchase      Order #ORD-2849   India    15s ago    │  │  │
 * │  │  │ 🟢 Page View     /about            Canada   18s ago    │  │  │
 * │  │  │ 📧 Subscribe     New subscriber    India    22s ago    │  │  │
 * │  │  └─────────────────────────────────────────────────────────┘  │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * │                                                                       │
 * │  ┌── World Map (Visitor Locations) ───────────────────────────────┐  │
 * │  │                                                                │  │
 * │  │          🌍 Live Visitor Map                                   │  │
 * │  │          (Interactive globe with pulsing dots                  │  │
 * │  │           showing real-time visitor locations)                  │  │
 * │  │                                                                │  │
 * │  └────────────────────────────────────────────────────────────────┘  │
 * └───────────────────────────────────────────────────────────────────────┘
 */
```

---

> **End of Part 7** — Continue to Part 8 for Deployment Strategy, Testing Plan & Performance Optimization

---

## 13. Deployment Strategy, Testing Plan & Performance Optimization

> **Part 8 of 8** | Production-Grade Infrastructure & Quality Assurance

### 13.1 CI/CD Pipeline Architecture

```yaml
# ============================================
# GITHUB ACTIONS — MONOREPO CI/CD PIPELINE
# ============================================
# .github/workflows/deploy.yml

name: LetBuyy CI/CD Pipeline

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'
  PNPM_VERSION: '8'

jobs:
  # ── Detect Changed Packages ──────────────────────
  changes:
    runs-on: ubuntu-latest
    outputs:
      web-admin: ${{ steps.filter.outputs.web-admin }}
      web-accounts: ${{ steps.filter.outputs.web-accounts }}
      web-storefront: ${{ steps.filter.outputs.web-storefront }}
      packages: ${{ steps.filter.outputs.packages }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            web-admin:
              - 'apps/web/admin/**'
              - 'packages/**'
            web-accounts:
              - 'apps/web/accounts/**'
              - 'packages/**'
            web-storefront:
              - 'apps/web/storefront/**'
              - 'packages/**'
            packages:
              - 'packages/**'

  # ── Lint & Type Check ────────────────────────────
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
        with:
          version: ${{ env.PNPM_VERSION }}
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm format:check

  # ── Unit & Integration Tests ─────────────────────
  test:
    runs-on: ubuntu-latest
    needs: quality
    services:
      postgres:
        image: supabase/postgres:latest
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: letbuyy_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit --coverage
      - run: pnpm test:integration
      - uses: codecov/codecov-action@v4
        with:
          file: ./coverage/lcov.info

  # ── E2E Tests ────────────────────────────────────
  e2e:
    runs-on: ubuntu-latest
    needs: test
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
      - run: pnpm install --frozen-lockfile
      - name: Install Playwright
        run: pnpm exec playwright install --with-deps
      - name: Run E2E Tests
        run: pnpm test:e2e
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: e2e-screenshots
          path: test-results/

  # ── Deploy to Staging ────────────────────────────
  deploy-staging:
    runs-on: ubuntu-latest
    needs: [quality, test]
    if: github.ref == 'refs/heads/staging'
    strategy:
      matrix:
        app: [web-admin, web-accounts, web-storefront]
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets[format('VERCEL_{0}_PROJECT_ID', matrix.app)] }}
          working-directory: apps/web/${{ matrix.app }}

  # ── Deploy to Production ─────────────────────────
  deploy-production:
    runs-on: ubuntu-latest
    needs: [quality, test, e2e]
    if: github.ref == 'refs/heads/main'
    environment: production
    strategy:
      matrix:
        app: [web-admin, web-accounts, web-storefront]
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets[format('VERCEL_{0}_PROJECT_ID', matrix.app)] }}
          vercel-args: '--prod'
          working-directory: apps/web/${{ matrix.app }}
      - name: Notify Deployment
        run: |
          curl -X POST ${{ secrets.DISCORD_WEBHOOK }} \
            -H "Content-Type: application/json" \
            -d '{"content": "🚀 ${{ matrix.app }} deployed to production!"}'

  # ── Database Migrations ──────────────────────────
  migrate:
    runs-on: ubuntu-latest
    needs: deploy-production
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - run: supabase db push --linked
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
```

### 13.2 Deployment Architecture

```
┌── Deployment Topology ─────────────────────────────────────────────────────┐
│                                                                             │
│  ┌── DNS (Cloudflare) ──────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  letbuyy.com          → Vercel (Landing Page)                        │  │
│  │  accounts.letbuyy.com → Vercel (Auth App)                            │  │
│  │  *.letbuyy.store      → Vercel (Storefront — Wildcard)              │  │
│  │  admin.letbuyy.com    → Vercel (Admin Panel)                         │  │
│  │  api.letbuyy.com      → Supabase Edge Functions                      │  │
│  │                                                                       │  │
│  │  Cloudflare Features:                                                 │  │
│  │  • DDoS Protection (Always On)                                        │  │
│  │  • CDN Caching (Static Assets: 1 year, HTML: 1 hour)                 │  │
│  │  • Wildcard SSL (*.letbuyy.store)                                     │  │
│  │  • Page Rules (Redirect www → non-www)                                │  │
│  │  • Workers (A/B Testing, Feature Flags)                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌── Vercel (Frontend Hosting) ─────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  Projects:                                                            │  │
│  │  ├── letbuyy-admin       (apps/web/admin)                            │  │
│  │  ├── letbuyy-accounts    (apps/web/accounts)                         │  │
│  │  ├── letbuyy-storefront  (apps/web/storefront)                       │  │
│  │  └── letbuyy-landing     (apps/web/landing)                          │  │
│  │                                                                       │  │
│  │  Config:                                                              │  │
│  │  • Framework: Next.js 15 (App Router)                                 │  │
│  │  • Node.js: 20.x                                                     │  │
│  │  • Build: Turborepo (Cached across deploys)                          │  │
│  │  • Regions: iad1 (US-East), bom1 (India-Mumbai)                      │  │
│  │  • Edge Functions: Middleware (Auth, Subdomain Routing)               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌── Supabase (Backend) ────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  PostgreSQL 15:                                                       │  │
│  │  • Region: ap-south-1 (Mumbai)                                        │  │
│  │  • Plan: Pro ($25/mo) → Team ($599/mo at scale)                      │  │
│  │  • Connection Pooling: PgBouncer (Transaction mode)                   │  │
│  │  • Point-in-time Recovery: 7 days                                     │  │
│  │  • Read Replicas: 1 (for analytics queries)                           │  │
│  │                                                                       │  │
│  │  Storage:                                                             │  │
│  │  • CDN-backed for media (images, files)                               │  │
│  │  • Max upload: 50MB per file                                          │  │
│  │  • Image transformations via CDN                                      │  │
│  │                                                                       │  │
│  │  Edge Functions:                                                      │  │
│  │  • Deno runtime                                                       │  │
│  │  • Custom API endpoints                                               │  │
│  │  • Webhook handlers                                                   │  │
│  │  • CRON jobs (analytics aggregation)                                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 13.3 Testing Strategy

```typescript
// ============================================
// TESTING PYRAMID — COMPREHENSIVE COVERAGE
// ============================================

/*
 * Testing Pyramid:
 *
 *            ╱╲
 *           ╱ E2E ╲              5-10 critical flows
 *          ╱────────╲
 *         ╱Integration╲          30-50 integration tests
 *        ╱──────────────╲
 *       ╱   Unit Tests    ╲      200+ unit tests
 *      ╱────────────────────╲
 *     ╱  Static Analysis      ╲  TypeScript + ESLint
 *    ╱──────────────────────────╲
 *
 * Target Coverage: 
 * • Unit: > 80%
 * • Integration: > 60%
 * • E2E: Critical paths only
 */

// ── Unit Tests (Vitest) ─────────────────────────

// Example: Discount calculation tests
describe('applyDiscounts', () => {
  it('should apply percentage discount correctly', () => {
    const cart = { subtotal: 1000, items: [mockItem] };
    const discount = { type: 'percentage', value: 20, conditions: {} };
    const result = applyDiscounts(cart, [discount]);
    expect(result.total).toBe(800);
  });

  it('should respect minimum purchase condition', () => {
    const cart = { subtotal: 400, items: [mockItem] };
    const discount = { type: 'percentage', value: 20, conditions: { minPurchase: 500 } };
    const result = applyDiscounts(cart, [discount]);
    expect(result.total).toBe(400); // Discount not applied
  });

  it('should not combine non-combinable discounts', () => {
    const cart = { subtotal: 1000, items: [mockItem] };
    const discounts = [
      { type: 'percentage', value: 20, conditions: { combineWithOther: false } },
      { type: 'fixed', value: 50, conditions: { combineWithOther: true } },
    ];
    const result = applyDiscounts(cart, discounts);
    expect(result.discounts).toHaveLength(1);
  });
});

// Example: Tax calculation tests
describe('calculateTax', () => {
  it('should calculate intra-state GST (CGST + SGST)', () => {
    const result = calculateTax(1000, 'KA', 'KA', 18, 'exclusive');
    expect(result.components).toHaveLength(2);
    expect(result.components[0]).toEqual({ name: 'CGST', rate: 9, amount: 90 });
    expect(result.components[1]).toEqual({ name: 'SGST', rate: 9, amount: 90 });
    expect(result.total).toBe(1180);
  });

  it('should calculate inter-state GST (IGST)', () => {
    const result = calculateTax(1000, 'MH', 'KA', 18, 'exclusive');
    expect(result.components).toHaveLength(1);
    expect(result.components[0]).toEqual({ name: 'IGST', rate: 18, amount: 180 });
  });

  it('should handle inclusive pricing correctly', () => {
    const result = calculateTax(1180, 'KA', 'KA', 18, 'inclusive');
    expect(result.taxableAmount).toBeCloseTo(1000, 0);
    expect(result.totalTax).toBeCloseTo(180, 0);
  });
});

// ── Integration Tests ───────────────────────────

// Example: Blog post CRUD with Supabase
describe('Blog Post CRUD', () => {
  let supabase: SupabaseClient;
  
  beforeAll(async () => {
    supabase = createTestClient();
    await seedTestData(supabase);
  });

  afterAll(async () => {
    await cleanupTestData(supabase);
  });

  it('should create a post and auto-generate slug', async () => {
    const { data, error } = await supabase
      .from('blog_posts')
      .insert({ title: 'Test Post Title', content: '<p>Body</p>', blog_id: testBlogId })
      .select()
      .single();
    
    expect(error).toBeNull();
    expect(data.slug).toBe('test-post-title');
    expect(data.reading_time).toBeGreaterThan(0);
  });

  it('should enforce RLS — user cannot access other site posts', async () => {
    const otherUserClient = createTestClient(otherUserToken);
    const { data } = await otherUserClient
      .from('blog_posts')
      .select()
      .eq('blog_id', testBlogId);
    
    expect(data).toHaveLength(0);
  });

  it('should create version snapshot on update', async () => {
    await supabase
      .from('blog_posts')
      .update({ title: 'Updated Title' })
      .eq('id', testPostId);
    
    const { data: versions } = await supabase
      .from('content_versions')
      .select()
      .eq('entity_id', testPostId)
      .order('version_number', { ascending: false });
    
    expect(versions.length).toBeGreaterThanOrEqual(1);
    expect(versions[0].data.title).toBe('Test Post Title'); // Previous version
  });
});

// ── E2E Tests (Playwright) ──────────────────────

// Example: Full blog post publishing flow
test('should publish a blog post end-to-end', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[data-testid="email"]', 'test@example.com');
  await page.fill('[data-testid="password"]', 'test123');
  await page.click('[data-testid="login-btn"]');
  await page.waitForURL('/dashboard');
  
  // Navigate to post editor
  await page.click('[data-testid="nav-blog"]');
  await page.click('[data-testid="new-post"]');
  
  // Fill post details
  await page.fill('[data-testid="post-title"]', 'E2E Test Post');
  await page.locator('.tiptap-editor').fill('This is a test post content.');
  
  // Add category
  await page.click('[data-testid="category-select"]');
  await page.click('text=Tutorials');
  
  // Publish
  await page.click('[data-testid="publish-btn"]');
  await page.click('[data-testid="confirm-publish"]');
  
  // Verify
  await expect(page.locator('[data-testid="toast-success"]'))
    .toContainText('Post published');
  
  // Verify on storefront
  await page.goto(`${STOREFRONT_URL}/blog/e2e-test-post`);
  await expect(page.locator('h1')).toContainText('E2E Test Post');
});
```

### 13.4 Performance Optimization

```typescript
// ============================================
// PERFORMANCE — ENTERPRISE-GRADE OPTIMIZATION
// ============================================

/*
 * Performance Budget:
 * ┌────────────────────────┬───────────────┬───────────────┐
 * │ Metric                 │ Target        │ Max           │
 * ├────────────────────────┼───────────────┼───────────────┤
 * │ LCP                    │ < 1.5s        │ < 2.5s        │
 * │ FID / INP              │ < 50ms        │ < 100ms       │
 * │ CLS                    │ < 0.05        │ < 0.1         │
 * │ TTFB                   │ < 200ms       │ < 600ms       │
 * │ Initial JS Bundle      │ < 150KB (gz)  │ < 250KB (gz)  │
 * │ Total Page Weight      │ < 500KB       │ < 1MB         │
 * │ Lighthouse Score       │ > 95          │ > 85          │
 * └────────────────────────┴───────────────┴───────────────┘
 */

// Optimization Strategies

// 1. Image Optimization
const imageOptimization = {
  formats: ['avif', 'webp', 'jpg'],   // Priority order
  sizes: [320, 640, 960, 1280, 1920], // Responsive breakpoints
  quality: 80,
  lazy: true,                          // Lazy load below fold
  blur: true,                          // LQIP blur placeholder
  cdn: 'supabase-storage',            // CDN-backed serving
};

// 2. Code Splitting Strategy
/*
 * ┌── Bundle Analysis ──────────────────────────────────────┐
 * │                                                          │
 * │  Entry Point (shared):     ~45KB gzipped                │
 * │  ├── react + react-dom     ~32KB                        │
 * │  ├── next/router           ~8KB                         │
 * │  └── shared utils          ~5KB                         │
 * │                                                          │
 * │  Route Chunks (per page):                               │
 * │  ├── /dashboard            ~25KB (lazy)                 │
 * │  ├── /blog/posts           ~18KB (lazy)                 │
 * │  ├── /blog/posts/[id]      ~45KB (lazy, includes editor)│
 * │  ├── /analytics            ~35KB (lazy, includes charts)│
 * │  └── /settings             ~12KB (lazy)                 │
 * │                                                          │
 * │  Heavy Libraries (dynamic import):                      │
 * │  ├── @tiptap/editor        ~80KB (loaded on editor page)│
 * │  ├── recharts              ~55KB (loaded on analytics)  │
 * │  └── @dnd-kit              ~20KB (loaded on drag views) │
 * └──────────────────────────────────────────────────────────┘
 */

// 3. Caching Strategy
const cachingStrategy = {
  // Browser caching
  staticAssets: 'public, max-age=31536000, immutable',  // 1 year
  htmlPages: 'public, max-age=0, must-revalidate',
  apiResponses: 'private, max-age=300',                  // 5 min
  
  // Server-side caching (Next.js ISR)
  blogPosts: { revalidate: 3600 },       // 1 hour
  productPages: { revalidate: 1800 },    // 30 min
  homePage: { revalidate: 7200 },        // 2 hours
  
  // Supabase query caching
  queryCache: {
    dashboard: { ttl: 300, staleWhileRevalidate: true },
    analytics: { ttl: 600, staleWhileRevalidate: true },
    settings: { ttl: 3600 },
  },
};

// 4. Database Query Optimization
/*
 * Key optimizations:
 * • Use read replicas for analytics queries
 * • Implement cursor-based pagination (not offset)
 * • Pre-compute aggregates via pg_cron
 * • Use JSONB with GIN indexes for flexible properties
 * • Partition analytics_events by month
 * • Connection pooling via PgBouncer
 * • Prepared statements for hot queries
 */
```

### 13.5 Security Hardening

```typescript
// ============================================
// SECURITY — MULTI-LAYER DEFENSE
// ============================================

const securityConfig = {
  // Authentication
  auth: {
    provider: 'supabase-auth',
    mfa: true,                             // Multi-factor authentication
    sessionTimeout: '24h',
    refreshTokenRotation: true,
    passwordPolicy: {
      minLength: 8,
      requireUppercase: true,
      requireNumber: true,
      requireSpecial: false,
      maxAge: 90,                          // Days before forced change
    },
  },
  
  // Rate Limiting
  rateLimiting: {
    api: { window: '1m', max: 60 },
    auth: { window: '15m', max: 5 },
    upload: { window: '1h', max: 50 },
    search: { window: '1m', max: 30 },
  },
  
  // Content Security
  headers: {
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    ].join('; '),
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  },
  
  // Input Validation
  validation: {
    sanitizeHTML: true,          // DOMPurify for user content
    parameterized: true,        // All queries parameterized (Supabase default)
    fileUpload: {
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'application/pdf'],
      maxSize: 10 * 1024 * 1024,  // 10MB
      virusScan: false,            // Enable at scale
    },
  },
  
  // Data Protection
  dataProtection: {
    encryption: 'AES-256 at rest',
    backups: 'Daily, 7-day retention',
    gdprCompliance: true,
    dataExport: true,             // Users can export their data
    dataDelete: true,             // Users can request deletion
    auditLog: true,               // All admin actions logged
  },
};
```

### 13.6 Monitoring & Observability

```typescript
// ============================================
// MONITORING — PRODUCTION OBSERVABILITY
// ============================================

/*
 * Monitoring Stack:
 * 
 * ┌── Observability Stack ──────────────────────────────────────────────┐
 * │                                                                      │
 * │  LAYER 1: Error Tracking                                             │
 * │  └── Sentry (Frontend + Edge Functions)                              │
 * │      • Auto-capture unhandled errors                                 │
 * │      • Source maps for readable stack traces                         │
 * │      • Release tracking + commit integration                        │
 * │      • Performance monitoring (transactions)                        │
 * │                                                                      │
 * │  LAYER 2: Application Monitoring                                     │
 * │  └── Vercel Analytics + Speed Insights                               │
 * │      • Core Web Vitals tracking                                      │
 * │      • Real User Monitoring (RUM)                                    │
 * │      • Edge function execution times                                 │
 * │      • Deployment analytics                                          │
 * │                                                                      │
 * │  LAYER 3: Database Monitoring                                        │
 * │  └── Supabase Dashboard + pg_stat_statements                         │
 * │      • Query performance                                             │
 * │      • Connection pool utilization                                   │
 * │      • Storage usage                                                 │
 * │      • Realtime channel metrics                                      │
 * │                                                                      │
 * │  LAYER 4: Uptime Monitoring                                          │
 * │  └── Betteruptime / UptimeRobot                                      │
 * │      • HTTP endpoint checks (1-minute interval)                      │
 * │      • SSL certificate expiry alerts                                 │
 * │      • Status page (status.letbuyy.com)                              │
 * │      • Incident management + escalation                              │
 * │                                                                      │
 * │  LAYER 5: Alerting                                                   │
 * │  └── PagerDuty / Discord Webhooks                                    │
 * │      • Error spike alerts (> 10 errors / 5 min)                      │
 * │      • Performance degradation (LCP > 4s)                            │
 * │      • Database connection exhaustion                                │
 * │      • Deployment failure notifications                              │
 * └──────────────────────────────────────────────────────────────────────┘
 */

// Health Check Endpoint
// GET /api/health
const healthCheck = async () => ({
  status: 'healthy',
  timestamp: new Date().toISOString(),
  version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
  checks: {
    database: await checkDatabase(),      // pg connection test
    storage: await checkStorage(),        // Supabase storage ping
    cache: await checkCache(),            // Query cache status
  },
});
```

### 13.7 Scaling Roadmap

```
┌── Scaling Roadmap ─────────────────────────────────────────────────────────┐
│                                                                             │
│  ── Phase 1: Launch (0 - 100 tenants) ──────────────────────────────────── │
│  • Supabase Pro ($25/mo)                                                    │
│  • Vercel Pro ($20/mo)                                                      │
│  • Cloudflare Free                                                          │
│  • Single region (Mumbai)                                                   │
│  • Estimated cost: $45-75/mo                                                │
│                                                                             │
│  ── Phase 2: Growth (100 - 1,000 tenants) ──────────────────────────────── │
│  • Supabase Team ($599/mo) with read replica                                │
│  • Vercel Team ($150/mo)                                                    │
│  • Cloudflare Pro ($20/mo)                                                  │
│  • Multi-region (Mumbai + US-East)                                          │
│  • CDN for media assets                                                     │
│  • Estimated cost: $800-1,200/mo                                            │
│                                                                             │
│  ── Phase 3: Scale (1,000 - 10,000 tenants) ────────────────────────────── │
│  • Supabase Enterprise (Custom)                                             │
│  • Vercel Enterprise (Custom)                                               │
│  • Cloudflare Business ($200/mo)                                            │
│  • Multiple read replicas                                                   │
│  • Redis caching layer (Upstash)                                            │
│  • Queue system for background jobs                                         │
│  • Estimated cost: $3,000-8,000/mo                                          │
│                                                                             │
│  ── Phase 4: Enterprise (10,000+ tenants) ──────────────────────────────── │
│  • Dedicated database instances                                             │
│  • Global CDN with custom domains                                           │
│  • Kubernetes for custom compute                                            │
│  • Data warehouse for analytics (BigQuery / ClickHouse)                     │
│  • Dedicated support channels                                               │
│  • Estimated cost: $15,000+/mo                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 14. Document Summary & Next Steps

> **All 8 Parts Complete** — Enterprise-Grade Multi-Tenant Platform Blueprint

### What This Document Covers

| Part | Section | Content |
|------|---------|---------|
| 1 | Sections 1-6 | Architecture, Gap Analysis, Site Types, Component Mapping, DNS, Implementation Phases |
| 2 | Section 7 | Database Schema (15+ tables), RLS Policies, Triggers & Functions, ERD |
| 3 | Section 8 | Admin Panel Architecture, Design System Tokens, Component API, Navigation, Routes |
| 4 | Section 9 | Blogger Admin UI — CRUD Wireframes (Posts, Editor, Categories, Tags, Comments, Media) |
| 5 | Section 10 | Enhanced Features — Bulk Actions, Command Palette, Activity Logs, Notifications |
| 6 | Section 11 | E-commerce — Inventory, Multi-Currency, Tax Engine, Shipping, Discounts, Checkout |
| 7 | Section 12 | Analytics Dashboard — Traffic, Content, Revenue, SEO, Report Builder, Real-Time |
| 8 | Section 13 | Deployment — CI/CD, Testing Strategy, Performance, Security, Monitoring, Scaling |

### Recommended Implementation Order

```
Priority 1 (Weeks 1-4):
├── Database schema migration
├── Admin panel foundation (layout, navigation, design system)
├── Blog CRUD (posts, categories, tags)
└── Basic analytics event tracking

Priority 2 (Weeks 5-8):
├── Post editor (Tiptap integration)
├── Media library
├── Comment moderation
├── Activity logging
└── Command palette

Priority 3 (Weeks 9-12):
├── E-commerce inventory management
├── Discount & promotion engine
├── Multi-currency support
├── Analytics dashboard
└── SEO & performance monitoring

Priority 4 (Weeks 13-16):
├── Checkout optimization
├── Shipping integration
├── Tax engine (GST)
├── Report builder & export
├── Real-time live dashboard
└── Security hardening & monitoring
```

---

> **🎯 This document serves as the single source of truth for the LetBuyy Multi-Tenant Platform implementation. Each section is designed to be actionable, with code-ready schemas, typed interfaces, and detailed wireframes that can be directly translated into production code.**

---

*Document Version: 2.0 — Complete 8-Part Enterprise Blueprint*  
*Last Updated: February 2025*  
*Author: LetBuyy Engineering Team*

