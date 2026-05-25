# LetBuyy Platform — Portfolio & Resume

> **Doc 06 of 17** | Portfolio Builder, Resume Builder, PDF Export & Templates
>
> **Version:** 6.0 | **Date:** February 14, 2026
>
> **Prev:** [05 E-commerce Engine](./05_Ecommerce_Engine.md) | **Next:** [07 AI Features](./07_AI_Features.md)

---

## Table of Contents

1. [Portfolio Architecture](#1-portfolio-architecture)
2. [Projects Management](#2-projects-management)
3. [Skills & Endorsements](#3-skills--endorsements)
4. [Gallery & Media](#4-gallery--media)
5. [Testimonials](#5-testimonials)
6. [Contact Form](#6-contact-form)
7. [Resume Builder Architecture](#7-resume-builder-architecture)
8. [Work Experience](#8-work-experience)
9. [Education & Certifications](#9-education--certifications)
10. [PDF Export Engine](#10-pdf-export-engine)
11. [DOCX Export](#11-docx-export)
12. [Resume Versioning](#12-resume-versioning)
13. [Template System](#13-template-system)
14. [AI Integration](#14-ai-integration)
15. [Storefront Rendering](#15-storefront-rendering)
16. [Custom Domains & URLs](#16-custom-domains--urls)
17. [Analytics & Visitor Tracking](#17-analytics--visitor-tracking)
18. [Performance & SEO](#18-performance--seo)
19. [Testing Strategy](#19-testing-strategy)
20. [Document History](#20-document-history)

---

## 1. Portfolio Architecture

### 1.1 Overview

The Portfolio site type provides creatives, developers, designers, and freelancers with a professional online presence. It combines a project showcase, skills visualization, testimonials, and contact forms into a cohesive storefront — all powered by the same multi-tenant infrastructure as LetBuyy stores.

> **Cross-ref:** [01_Architecture §2 — Route Structure](./01_Architecture.md) | [04_Admin_Dashboard §7 — Portfolio Dashboard](./04_Admin_Dashboard.md)

### 1.2 Data Flow

```
┌────────────────────────────────────────────────────────────────────┐
│              PORTFOLIO SYSTEM DATA FLOW                             │
│                                                                     │
│  Admin Dashboard (apps/web/admin)                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Portfolio Nav:                                               │  │
│  │  📁 Projects  │  🎯 Skills  │  🖼 Gallery  │  📷 Media      │  │
│  │  💬 Testimonials  │  📬 Contact Form  │  ⚙ Settings         │  │
│  └──────────┬───────────────────────────────────────────────────┘  │
│             │ CRUD via Hono API                                     │
│             ▼                                                       │
│  Workers API (Hono)                                                 │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  /api/portfolio/projects   │ /api/portfolio/skills            │  │
│  │  /api/portfolio/gallery    │ /api/portfolio/testimonials      │  │
│  │  /api/portfolio/contact    │ /api/ai/portfolio-description    │  │
│  └──────────┬───────────────────────────────────────────────────┘  │
│             │                                                       │
│  ┌──────────▼──────────────┐  ┌────────────────────────┐          │
│  │  Supabase PostgreSQL    │  │  Cloudflare R2          │          │
│  │  ├── projects           │  │  ├── portfolio-media/   │          │
│  │  ├── skills             │  │  │   ├── project imgs   │          │
│  │  ├── testimonials       │  │  │   └── gallery imgs   │          │
│  │  ├── education          │  │  └── documents/         │          │
│  │  ├── form_submissions   │  │      └── resume PDFs    │          │
│  │  └── certifications     │  └────────────────────────┘          │
│  └─────────────────────────┘                                       │
│             │ ISR (revalidate: 60s)                                 │
│             ▼                                                       │
│  Storefront (apps/web/storefront)                                   │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  /            → Hero + featured projects + skills summary    │  │
│  │  /projects    → Project grid with category filters           │  │
│  │  /projects/x  → Project detail with gallery + case study     │  │
│  │  /skills      → Skills breakdown with visualizations         │  │
│  │  /contact     → Contact form with hCaptcha                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 1.3 Portfolio vs Resume Feature Matrix

| Feature | Portfolio | Resume | Both |
|---|:---:|:---:|:---:|
| Projects showcase | ✅ | — | — |
| Image gallery | ✅ | — | — |
| Skills visualization | ✅ | ✅ | ✅ |
| Education entries | ✅ | ✅ | ✅ |
| Work experience | — | ✅ | — |
| Certifications | — | ✅ | — |
| Testimonials | ✅ | — | — |
| Contact form | ✅ | — | — |
| PDF export | — | ✅ | — |
| DOCX export | — | ✅ | — |
| ATS scoring | — | ✅ | — |
| Blog integration | ✅ | — | — |
| Custom sections | ✅ | — | — |
| QR code linking | ✅ | ✅ | ✅ |
| Multi-version | — | ✅ | — |
| Live preview | ✅ | ✅ | ✅ |

### 1.4 Admin Sidebar Navigation

```typescript
// Cross-ref: 01_Architecture.md — SIDEBAR_CONFIG

portfolio: [
  { icon: "LayoutDashboard", label: "Dashboard",    href: "/dashboard" },
  { icon: "Briefcase",       label: "Projects",     href: "/projects" },
  { icon: "Image",           label: "Gallery",      href: "/gallery" },
  { icon: "Award",           label: "Skills",       href: "/skills" },
  { icon: "GraduationCap",   label: "Education",    href: "/education" },
  { icon: "MessageSquare",   label: "Testimonials", href: "/testimonials" },
  { icon: "Mail",            label: "Contact Form", href: "/contact" },
  { icon: "Palette",         label: "Appearance",   href: "/appearance" },
  { icon: "Bot",             label: "AI Studio",    href: "/ai" },
  { icon: "BarChart3",       label: "Analytics",    href: "/analytics" },
  { icon: "Settings",        label: "Settings",     href: "/settings" },
],

resume: [
  { icon: "LayoutDashboard", label: "Dashboard",      href: "/dashboard" },
  { icon: "Briefcase",       label: "Experience",     href: "/experience" },
  { icon: "GraduationCap",   label: "Education",      href: "/education" },
  { icon: "Award",           label: "Skills",         href: "/skills" },
  { icon: "Award",           label: "Certifications", href: "/certifications" },
  { icon: "FileText",        label: "PDF Export",     href: "/export" },
  { icon: "Bot",             label: "ATS Score",      href: "/ats-score" },
  { icon: "Palette",         label: "Appearance",     href: "/appearance" },
  { icon: "BarChart3",       label: "Analytics",      href: "/analytics" },
  { icon: "Settings",        label: "Settings",       href: "/settings" },
],
```

---

## 2. Projects Management

### 2.1 Project Database Schema

```sql
CREATE TABLE projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Core info
  title           TEXT NOT NULL,
  slug            TEXT NOT NULL,
  short_description TEXT,               -- 1-2 sentence teaser
  description     TEXT,                  -- Full markdown case study
  
  -- Client details
  client_name     TEXT,
  client_logo     TEXT,                  -- R2 URL
  client_url      TEXT,
  
  -- Media
  cover_image     TEXT NOT NULL,         -- Primary project image
  images          TEXT[] DEFAULT '{}',   -- Gallery images (R2 URLs)
  video_url       TEXT,                  -- YouTube/Vimeo embed
  
  -- Links
  live_url        TEXT,                  -- Live demo link
  repo_url        TEXT,                  -- GitHub/GitLab repo
  case_study_url  TEXT,                  -- External case study
  
  -- Classification
  category        TEXT,                  -- "Web Development", "Mobile App", etc.
  tags            TEXT[] DEFAULT '{}',   -- ["React", "TypeScript", "Next.js"]
  tech_stack      TEXT[] DEFAULT '{}',   -- Technologies used (separate from tags)
  
  -- Case study fields
  problem         TEXT,                  -- The challenge
  solution        TEXT,                  -- How you solved it
  results         TEXT,                  -- Outcomes and metrics
  duration        TEXT,                  -- "3 months", "6 weeks"
  role            TEXT,                  -- "Lead Developer", "UI Designer"
  team_size       INT,                   -- Team members involved
  
  -- Display
  is_featured     BOOLEAN DEFAULT false,
  display_order   INT DEFAULT 0,
  status          TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  
  -- Dates
  started_at      DATE,
  completed_at    DATE,
  published_at    TIMESTAMPTZ,
  
  -- SEO
  seo_title       TEXT,
  seo_description TEXT,
  
  -- Stats
  view_count      INT DEFAULT 0,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_projects_slug ON projects(store_id, slug);
CREATE INDEX idx_projects_store_status ON projects(store_id, status, display_order);
CREATE INDEX idx_projects_featured ON projects(store_id, is_featured) WHERE is_featured = true;

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage projects"
  ON projects FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));

-- Public read for published projects (storefront)
CREATE POLICY "Public read published projects"
  ON projects FOR SELECT
  USING (status = 'published');
```

### 2.2 Project CRUD API

```typescript
// workers/api/src/routes/portfolio/projects.ts

import { Hono } from 'hono';
import { z } from 'zod';

const projectSchema = z.object({
  title: z.string().min(1).max(200),
  shortDescription: z.string().max(300).optional(),
  description: z.string().optional(),
  clientName: z.string().optional(),
  clientUrl: z.string().url().optional(),
  coverImage: z.string().url(),
  images: z.array(z.string().url()).max(20).default([]),
  videoUrl: z.string().url().optional(),
  liveUrl: z.string().url().optional(),
  repoUrl: z.string().url().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).max(15).default([]),
  techStack: z.array(z.string()).max(20).default([]),
  problem: z.string().optional(),
  solution: z.string().optional(),
  results: z.string().optional(),
  duration: z.string().optional(),
  role: z.string().optional(),
  teamSize: z.number().int().min(1).optional(),
  isFeatured: z.boolean().default(false),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  seoTitle: z.string().max(70).optional(),
  seoDescription: z.string().max(160).optional(),
});

const app = new Hono();

// List projects
app.get('/v1/stores/:storeId/projects', authMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const { status, category, featured, page = '1', limit = '20' } = c.req.query();
  const supabase = createServiceClient(c.env);

  let query = supabase
    .from('projects')
    .select('id, title, slug, short_description, cover_image, category, tags, status, is_featured, display_order, view_count, created_at', { count: 'exact' })
    .eq('store_id', storeId)
    .order('display_order', { ascending: true });

  if (status) query = query.eq('status', status);
  if (category) query = query.eq('category', category);
  if (featured === 'true') query = query.eq('is_featured', true);

  const offset = (parseInt(page) - 1) * parseInt(limit);
  query = query.range(offset, offset + parseInt(limit) - 1);

  const { data, count, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  return c.json({ projects: data, total: count, page: parseInt(page), limit: parseInt(limit) });
});

// Create project
app.post('/v1/stores/:storeId/projects', authMiddleware(), storeOwnerMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const body = projectSchema.parse(await c.req.json());
  const supabase = createServiceClient(c.env);

  // Generate slug
  const slug = await generateUniqueSlug(supabase, 'projects', storeId, body.title);

  // Get next display order
  const { data: maxOrder } = await supabase
    .from('projects')
    .select('display_order')
    .eq('store_id', storeId)
    .order('display_order', { ascending: false })
    .limit(1)
    .single();

  const { data, error } = await supabase.from('projects').insert({
    store_id: storeId,
    slug,
    display_order: (maxOrder?.display_order || 0) + 1,
    published_at: body.status === 'published' ? new Date().toISOString() : null,
    ...snakeCaseKeys(body),
  }).select().single();

  if (error) return c.json({ error: error.message }, 500);

  // Invalidate storefront cache
  await c.env.REDIS.del(`cache:store:${storeId}:projects`);
  await c.env.REDIS.del(`cache:store:${storeId}:home`);

  return c.json(data, 201);
});

// Update project
app.put('/v1/stores/:storeId/projects/:projectId', authMiddleware(), storeOwnerMiddleware(), async (c) => {
  const { storeId, projectId } = c.req.param();
  const body = projectSchema.partial().parse(await c.req.json());
  const supabase = createServiceClient(c.env);

  // Re-slug if title changed
  let slug;
  if (body.title) {
    slug = await generateUniqueSlug(supabase, 'projects', storeId, body.title, projectId);
  }

  const { data, error } = await supabase.from('projects').update({
    ...snakeCaseKeys(body),
    ...(slug && { slug }),
    updated_at: new Date().toISOString(),
  }).eq('id', projectId).eq('store_id', storeId).select().single();

  if (error) return c.json({ error: error.message }, 500);

  await c.env.REDIS.del(`cache:store:${storeId}:projects`);
  return c.json(data);
});

// Delete project
app.delete('/v1/stores/:storeId/projects/:projectId', authMiddleware(), storeOwnerMiddleware(), async (c) => {
  const { storeId, projectId } = c.req.param();
  const supabase = createServiceClient(c.env);

  // Delete associated media from R2
  const { data: project } = await supabase.from('projects').select('images, cover_image').eq('id', projectId).single();
  if (project) {
    const allImages = [project.cover_image, ...project.images].filter(Boolean);
    await Promise.all(allImages.map(url => deleteFromR2(c.env, url)));
  }

  await supabase.from('projects').delete().eq('id', projectId).eq('store_id', storeId);
  await c.env.REDIS.del(`cache:store:${storeId}:projects`);

  return c.json({ success: true });
});

// Reorder projects (drag-and-drop)
app.patch('/v1/stores/:storeId/projects/reorder', authMiddleware(), storeOwnerMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const { items } = await c.req.json(); // [{ id, display_order }]
  const supabase = createServiceClient(c.env);

  for (const item of items) {
    await supabase.from('projects').update({ display_order: item.display_order })
      .eq('id', item.id).eq('store_id', storeId);
  }

  await c.env.REDIS.del(`cache:store:${storeId}:projects`);
  return c.json({ success: true });
});
```

### 2.3 Project Entry Form UI

```
┌──────────────────────────────────────────────────────────────┐
│  Add/Edit Project                              [Save Draft ▼]│
│                                                               │
│  ┌─ Basic Info ───────────────────────────────────────────┐  │
│  │  Title *:          [E-Commerce Platform Redesign     ] │  │
│  │  Client / Company: [TechCorp Inc.                    ] │  │
│  │  Category:         [Web Development ▼]                 │  │
│  │  Role:             [Lead Developer                   ] │  │
│  │  Duration:         [3 months   ]  Team: [5 members  ] │  │
│  │  Date Range:       [Oct 2025] — [Jan 2026]            │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Description (Markdown) ──────────────────────────────┐  │
│  │ ┌────────────────────────────────────────────────────┐ │  │
│  │ │ Rich text editor with markdown support...          │ │  │
│  │ │ [B] [I] [H] [Link] [Code] [List]   [🤖 AI Write] │ │  │
│  │ └────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Case Study ──────────────────────────────────────────┐  │
│  │  Problem:  [What challenge did the client face?     ] │  │
│  │  Solution: [How did you approach and solve it?      ] │  │
│  │  Results:  [What were the measurable outcomes?      ] │  │
│  │  [🤖 AI: Generate case study from description]       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Media (drag to reorder) ─────────────────────────────┐  │
│  │  Cover Image *:                                        │  │
│  │  ┌──────────┐                                          │  │
│  │  │ 📷 Cover │  [Upload] [🤖 AI: Enhance]             │  │
│  │  └──────────┘                                          │  │
│  │  Gallery (max 20):                                     │  │
│  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌──────────┐           │  │
│  │  │ 📷 │ │ 📷 │ │ 📷 │ │ 📷 │ │ + Upload │           │  │
│  │  └────┘ └────┘ └────┘ └────┘ └──────────┘           │  │
│  │  Video URL: [https://youtube.com/watch?v=...         ] │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Links ───────────────────────────────────────────────┐  │
│  │  Live Demo: [https://demo.techcorp.com             ]  │  │
│  │  GitHub:    [https://github.com/user/project       ]  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Tags & Tech Stack ──────────────────────────────────┐  │
│  │  Tags:        [React] [Next.js] [TypeScript] [+]      │  │
│  │  Tech Stack:  [React] [Node.js] [PostgreSQL] [+]      │  │
│  │  [🤖 AI: Suggest tags]  [🤖 AI: Detect tech stack]   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌─ Settings ────────────────────────────────────────────┐  │
│  │  ☑ Featured project (shown on homepage)                │  │
│  │  Display Order: [1 ▼]                                  │  │
│  │  SEO Title:       [___________________________]        │  │
│  │  SEO Description: [___________________________]        │  │
│  │  [🤖 AI: Generate SEO]                                │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│       [Delete]    [Save Draft]    [Save & Publish]           │
└──────────────────────────────────────────────────────────────┘
```

### 2.4 Project List View (Admin)

```
┌──────────────────────────────────────────────────────────────┐
│  Projects (8 total)         [Filter ▼] [Sort ▼]  [+ New]    │
│                                                               │
│  Published (5)    Drafts (2)    Archived (1)                 │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ ≡ 📷│ E-Commerce Redesign     │ Web Dev  │⭐│ 🟢 │142👁│ │
│  │ ≡ 📷│ Mobile Banking App      │ Mobile   │⭐│ 🟢 │ 98👁│ │
│  │ ≡ 📷│ Portfolio Template       │ Design   │  │ 🟢 │ 67👁│ │
│  │ ≡ 📷│ AI Chat Interface        │ AI/ML    │  │ 🟢 │ 45👁│ │
│  │ ≡ 📷│ Dashboard Analytics      │ Web Dev  │  │ 🟢 │ 31👁│ │
│  │ ≡ 📷│ Brand Identity           │ Design   │  │ 🟡 │  —  │ │
│  │ ≡ 📷│ API Gateway              │ Backend  │  │ 🟡 │  —  │ │
│  │ ≡ 📷│ Legacy CMS (archived)   │ Web Dev  │  │ ⚫ │  12 │ │
│  └────────────────────────────────────────────────────────┘  │
│  ≡ = drag handle  ⭐ = featured  🟢 = published             │
│  🟡 = draft       ⚫ = archived   👁 = view count            │
│                                                               │
│  Total views: 395 this month (↑18%)                          │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Skills & Endorsements

### 3.1 Skills Schema

```sql
CREATE TABLE skills (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  category        TEXT DEFAULT 'General',    -- "Frontend", "Backend", "DevOps", "Design", etc.
  proficiency     INT DEFAULT 50 CHECK (proficiency BETWEEN 0 AND 100),
  years_of_exp    DECIMAL(3,1),              -- 2.5 years
  icon            TEXT,                       -- Icon name or URL
  color           TEXT,                       -- Badge color hex
  display_order   INT DEFAULT 0,
  is_visible      BOOLEAN DEFAULT true,
  
  -- Endorsements (from visitors)
  endorsement_count INT DEFAULT 0,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_skills_store ON skills(store_id, category, display_order);

-- Skill endorsements from portfolio visitors
CREATE TABLE skill_endorsements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id    UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  endorser_name  TEXT NOT NULL,
  endorser_email TEXT NOT NULL,
  endorser_title TEXT,           -- "CTO at TechCorp"
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(skill_id, endorser_email) -- One endorsement per person per skill
);
```

### 3.2 Skills Management UI

```
┌──────────────────────────────────────────────────────────────┐
│  Your Skills                              [+ Add Skill]      │
│                                                               │
│  Frontend (5 skills)                      [Collapse ▼]       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  React       ████████████████████░░  90%  3.5y  12👍  │  │
│  │  TypeScript  ██████████████████░░░░  85%  3.0y   8👍  │  │
│  │  Next.js     ████████████████░░░░░░  80%  2.0y   6👍  │  │
│  │  CSS/SCSS    ██████████████████░░░░  85%  4.0y   4👍  │  │
│  │  Vue.js      ████████████░░░░░░░░░░  60%  1.5y   2👍  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  Backend (3 skills)                       [Collapse ▼]       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Node.js     ████████████████░░░░░░  80%  3.0y   7👍  │  │
│  │  Python      ██████████████░░░░░░░░  70%  2.0y   3👍  │  │
│  │  PostgreSQL  ████████████████░░░░░░  80%  2.5y   5👍  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  DevOps (2 skills)                        [Collapse ▼]       │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Docker      ██████████████░░░░░░░░  70%  1.5y   2👍  │  │
│  │  AWS         ████████████░░░░░░░░░░  60%  1.0y   1👍  │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  Visualization: [Bar ▼]  (Bar | Radar | Tag Cloud)           │
│                                                               │
│  [🤖 AI: Suggest skills based on projects]                   │
│  [🤖 AI: Detect skills from GitHub repos]                    │
└──────────────────────────────────────────────────────────────┘
```

### 3.3 Skills Visualization Component

```typescript
// apps/web/admin/components/portfolio/SkillsRadarChart.tsx

'use client';

import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';

interface SkillData {
  name: string;
  proficiency: number;
  category: string;
}

export function SkillsRadarChart({ skills, category }: { skills: SkillData[]; category?: string }) {
  const filtered = category ? skills.filter(s => s.category === category) : skills.slice(0, 8);

  const data = filtered.map(s => ({
    skill: s.name,
    value: s.proficiency,
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={data}>
        <PolarGrid stroke="hsl(var(--border))" />
        <PolarAngleAxis dataKey="skill" tick={{ fontSize: 12, fill: 'hsl(var(--foreground))' }} />
        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} />
        <Radar name="Proficiency" dataKey="value" stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))" fillOpacity={0.2} strokeWidth={2} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
```

---

## 4. Gallery & Media

### 4.1 Gallery Schema

```sql
CREATE TABLE gallery_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,  -- Optional project link
  
  title         TEXT,
  description   TEXT,
  
  -- Media
  type          TEXT NOT NULL DEFAULT 'image' CHECK (type IN ('image', 'video', 'embed')),
  url           TEXT NOT NULL,            -- R2 URL for images, YouTube/Vimeo for video
  thumbnail_url TEXT,                      -- Auto-generated thumbnail
  blurhash      TEXT,                      -- BlurHash placeholder
  
  -- Metadata
  width         INT,
  height        INT,
  file_size     INT,                       -- bytes
  mime_type     TEXT,
  alt_text      TEXT,                      -- Accessibility
  
  -- Organization
  category      TEXT DEFAULT 'General',
  tags          TEXT[] DEFAULT '{}',
  display_order INT DEFAULT 0,
  is_visible    BOOLEAN DEFAULT true,
  
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gallery_store ON gallery_items(store_id, display_order);
```

### 4.2 Image Upload Pipeline

```typescript
// workers/api/src/routes/portfolio/gallery.ts

app.post('/v1/stores/:storeId/gallery/upload', authMiddleware(), storeOwnerMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const { filename, contentType } = await c.req.json();
  
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(contentType)) {
    return c.json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF' }, 400);
  }

  // Generate presigned URL for direct R2 upload
  const key = `${storeId}/gallery/${crypto.randomUUID()}-${filename}`;
  const presignedUrl = await generatePresignedUrl(c.env.R2_PORTFOLIO_MEDIA, key, contentType, 15 * 60);

  return c.json({
    uploadUrl: presignedUrl,
    fileKey: key,
    publicUrl: `${c.env.R2_PUBLIC_URL}/portfolio-media/${key}`,
  });
});

// After upload: process image (resize, blurhash, thumbnail)
app.post('/v1/stores/:storeId/gallery/process', authMiddleware(), storeOwnerMiddleware(), async (c) => {
  const { fileKey, title, description, category, projectId } = await c.req.json();
  const storeId = c.req.param('storeId');
  const supabase = createServiceClient(c.env);

  // Queue image processing
  await c.env.IMAGE_QUEUE.send({
    type: 'portfolio-gallery',
    storeId,
    fileKey,
    operations: [
      { name: 'thumbnail', width: 300, height: 300, fit: 'cover' },
      { name: 'medium', width: 800, quality: 85 },
      { name: 'large', width: 1400, quality: 90 },
      { name: 'blurhash' },
    ],
  });

  // Get image dimensions
  const metadata = await getImageMetadata(c.env.R2_PORTFOLIO_MEDIA, fileKey);

  const { data } = await supabase.from('gallery_items').insert({
    store_id: storeId,
    project_id: projectId || null,
    title,
    description,
    type: 'image',
    url: `${c.env.R2_PUBLIC_URL}/portfolio-media/${fileKey}`,
    thumbnail_url: `${c.env.R2_PUBLIC_URL}/portfolio-media/${fileKey.replace(/\.[^.]+$/, '_thumb.webp')}`,
    width: metadata.width,
    height: metadata.height,
    file_size: metadata.size,
    mime_type: metadata.mimeType,
    category,
  }).select().single();

  return c.json(data, 201);
});
```

### 4.3 Gallery Layout Options

```
┌──────────────────────────────────────────────────────────────┐
│  Gallery — Portfolio Storefront                               │
│                                                               │
│  Layout: [Masonry ▼]  (Grid | Masonry | Carousel | Slider)  │
│  Filter: [All ▼]                                              │
│                                                               │
│  ┌─ Masonry Layout ───────────────────────────────────────┐  │
│  │  ┌──────────┐ ┌────────────────┐ ┌──────────┐         │  │
│  │  │          │ │                │ │          │         │  │
│  │  │  Img 1   │ │    Img 2       │ │  Img 3   │         │  │
│  │  │          │ │    (tall)       │ │          │         │  │
│  │  └──────────┘ │                │ └──────────┘         │  │
│  │  ┌──────────┐ └────────────────┘ ┌────────────────┐   │  │
│  │  │          │ ┌──────────┐       │                │   │  │
│  │  │  Img 4   │ │  Img 5   │       │    Img 6       │   │  │
│  │  │  (wide)  │ │          │       │    (tall)       │   │  │
│  │  │          │ └──────────┘       │                │   │  │
│  │  └──────────┘                    └────────────────┘   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  Click any image → Lightbox with zoom + swipe navigation     │
└──────────────────────────────────────────────────────────────┘
```

### 4.4 Lightbox Component

```typescript
// apps/web/storefront/components/portfolio/Lightbox.tsx

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react';

interface LightboxProps {
  images: { url: string; title?: string; description?: string }[];
  initialIndex: number;
  onClose: () => void;
}

export function Lightbox({ images, initialIndex, onClose }: LightboxProps) {
  const [current, setCurrent] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);

  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length]);
  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (e.key === 'Escape') onClose();
      else if (e.key === '+') setZoom(z => Math.min(z + 0.5, 3));
      else if (e.key === '-') setZoom(z => Math.max(z - 0.5, 0.5));
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [next, prev, onClose]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}>
      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <button onClick={() => setZoom(z => Math.min(z + 0.5, 3))} className="p-2 text-white hover:bg-white/20 rounded"><ZoomIn /></button>
        <button onClick={() => setZoom(z => Math.max(z - 0.5, 0.5))} className="p-2 text-white hover:bg-white/20 rounded"><ZoomOut /></button>
        <a href={images[current].url} download className="p-2 text-white hover:bg-white/20 rounded"><Download /></a>
        <button onClick={onClose} className="p-2 text-white hover:bg-white/20 rounded"><X /></button>
      </div>

      <button onClick={(e) => { e.stopPropagation(); prev(); }}
        className="absolute left-4 p-2 text-white hover:bg-white/20 rounded"><ChevronLeft size={32} /></button>

      <AnimatePresence mode="wait">
        <motion.img key={current} src={images[current].url} alt={images[current].title || ''}
          initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: zoom }} exit={{ opacity: 0, scale: 0.9 }}
          className="max-w-[90vw] max-h-[85vh] object-contain select-none"
          onClick={(e) => e.stopPropagation()} draggable={false} />
      </AnimatePresence>

      <button onClick={(e) => { e.stopPropagation(); next(); }}
        className="absolute right-4 p-2 text-white hover:bg-white/20 rounded"><ChevronRight size={32} /></button>

      {/* Caption */}
      {images[current].title && (
        <div className="absolute bottom-8 text-center text-white">
          <p className="text-lg font-medium">{images[current].title}</p>
          {images[current].description && <p className="text-sm text-white/60">{images[current].description}</p>}
          <p className="text-xs text-white/40 mt-1">{current + 1} / {images.length}</p>
        </div>
      )}
    </motion.div>
  );
}
```

---

## 5. Testimonials

### 5.1 Testimonials Schema

```sql
CREATE TABLE testimonials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Author info
  author_name     TEXT NOT NULL,
  author_title    TEXT,                  -- "CTO at TechCorp"
  author_company  TEXT,
  author_avatar   TEXT,                  -- R2 URL
  author_linkedin TEXT,
  
  -- Content
  content         TEXT NOT NULL,         -- The testimonial text
  rating          INT CHECK (rating BETWEEN 1 AND 5),   -- Optional star rating
  
  -- Association
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,  -- Optional project link
  
  -- Source
  source          TEXT DEFAULT 'manual', -- manual, linkedin, request_email
  
  -- Display
  is_featured     BOOLEAN DEFAULT false,
  display_order   INT DEFAULT 0,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'hidden')),
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_testimonials_store ON testimonials(store_id, status, display_order);
```

### 5.2 Testimonial Request System

```typescript
// workers/api/src/routes/portfolio/testimonials.ts

// Request a testimonial via email
app.post('/v1/stores/:storeId/testimonials/request', authMiddleware(), storeOwnerMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const { recipientEmail, recipientName, projectId, message } = await c.req.json();
  const supabase = createServiceClient(c.env);

  // Get store info
  const { data: store } = await supabase.from('stores').select('name, subdomain, user_id')
    .eq('id', storeId).single();
  const { data: owner } = await supabase.from('profiles').select('full_name')
    .eq('id', store.user_id).single();

  // Generate secure token for the testimonial submission form
  const token = crypto.randomUUID();
  await c.env.REDIS.setex(`testimonial-request:${token}`, 86400 * 7, JSON.stringify({
    storeId, recipientEmail, recipientName, projectId,
  }));

  // Send email
  await c.env.EMAIL_QUEUE.send({
    template: 'testimonial-request',
    to: recipientEmail,
    data: {
      recipientName,
      ownerName: owner.full_name,
      storeName: store.name,
      personalMessage: message,
      submitUrl: `https://${store.subdomain}.letbuyy.store/testimonial/submit?token=${token}`,
    },
  });

  return c.json({ success: true, message: `Testimonial request sent to ${recipientEmail}` });
});

// Public endpoint: Submit testimonial (from email link)
app.post('/v1/testimonials/submit', async (c) => {
  const { token, content, rating, authorTitle, authorCompany, authorLinkedin } = await c.req.json();

  // Verify token
  const stored = await c.env.REDIS.get(`testimonial-request:${token}`);
  if (!stored) return c.json({ error: 'Invalid or expired request' }, 400);

  const { storeId, recipientEmail, recipientName, projectId } = JSON.parse(stored);
  const supabase = createServiceClient(c.env);

  await supabase.from('testimonials').insert({
    store_id: storeId,
    author_name: recipientName,
    author_title: authorTitle,
    author_company: authorCompany,
    author_linkedin: authorLinkedin,
    content,
    rating,
    project_id: projectId,
    source: 'request_email',
    status: 'pending', // Requires owner approval
  });

  // Delete token (one-time use)
  await c.env.REDIS.del(`testimonial-request:${token}`);

  // Notify owner
  await supabase.from('notifications').insert({
    store_id: storeId,
    type: 'testimonial.received',
    title: `New testimonial from ${recipientName}`,
    body: content.substring(0, 100) + '...',
    action_url: '/testimonials',
  });

  return c.json({ success: true });
});
```

### 5.3 Testimonial Display (Storefront Carousel)

```
┌──────────────────────────────────────────────────────────────┐
│  What People Say                                              │
│                                                               │
│  ◀  ┌────────────────────────────────────────────────────┐  ▶│
│     │                                                     │   │
│     │   "John's work on our e-commerce redesign was       │   │
│     │    exceptional. He delivered ahead of schedule       │   │
│     │    and the conversion rate increased by 35%."       │   │
│     │                                                     │   │
│     │   ⭐⭐⭐⭐⭐                                       │   │
│     │                                                     │   │
│     │   📷 Sarah Chen                                     │   │
│     │   CTO at TechCorp Inc.                              │   │
│     │   🔗 LinkedIn                                       │   │
│     │                                                     │   │
│     │   Related: E-Commerce Platform Redesign →           │   │
│     └────────────────────────────────────────────────────┘   │
│                                                               │
│  ● ○ ○ ○ ○                                                   │
│                                                               │
│  [Request Testimonial from Client]                            │
└──────────────────────────────────────────────────────────────┘
```

---

## 6. Contact Form

### 6.1 Contact Form Configuration Schema

```sql
-- Stored in stores.contact_form_config (JSONB)
-- {
--   "enabled": true,
--   "fields": [
--     { "name": "name", "label": "Your Name", "type": "text", "required": true },
--     { "name": "email", "label": "Email", "type": "email", "required": true },
--     { "name": "message", "label": "Message", "type": "textarea", "required": true },
--     { "name": "phone", "label": "Phone", "type": "tel", "required": false },
--     { "name": "company", "label": "Company", "type": "text", "required": false },
--     { "name": "budget", "label": "Budget Range", "type": "select",
--       "options": ["< ₹50K", "₹50K - ₹2L", "₹2L - ₹5L", "> ₹5L"], "required": false },
--     { "name": "project_type", "label": "Project Type", "type": "select",
--       "options": ["Web Development", "Mobile App", "UI/UX Design", "Consulting"], "required": false },
--     { "name": "attachment", "label": "Attach File", "type": "file",
--       "accept": ".pdf,.doc,.docx,.png,.jpg", "maxSize": 5242880, "required": false }
--   ],
--   "captcha": "hcaptcha",
--   "autoReply": {
--     "enabled": true,
--     "subject": "Thanks for reaching out!",
--     "body": "I'll get back to you within 24 hours."
--   },
--   "notifications": {
--     "email": true,
--     "push": true,
--     "inApp": true
--   }
-- }

CREATE TABLE form_submissions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Submitted data
  data            JSONB NOT NULL,           -- { name, email, message, ... }
  
  -- Metadata
  ip_address      TEXT,
  user_agent      TEXT,
  referrer        TEXT,
  
  -- Status
  status          TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied', 'archived', 'spam')),
  replied_at      TIMESTAMPTZ,
  
  -- Attachments
  attachments     TEXT[] DEFAULT '{}',      -- R2 URLs
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_submissions_store ON form_submissions(store_id, status, created_at DESC);
```

### 6.2 Contact Form Submission API

```typescript
// workers/api/src/routes/portfolio/contact.ts

const contactSchema = z.object({
  storeId: z.string().uuid(),
  captchaToken: z.string(),
  data: z.record(z.string(), z.any()),
});

app.post('/v1/contact/submit', async (c) => {
  const body = contactSchema.parse(await c.req.json());
  const supabase = createServiceClient(c.env);

  // 1. Verify hCaptcha
  const captchaValid = await verifyHCaptcha(c.env, body.captchaToken);
  if (!captchaValid) return c.json({ error: 'CAPTCHA verification failed' }, 400);

  // 2. Rate limit (3 submissions per IP per hour)
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  const rateKey = `contact-rate:${body.storeId}:${ip}`;
  const count = await c.env.REDIS.incr(rateKey);
  if (count === 1) await c.env.REDIS.expire(rateKey, 3600);
  if (count > 3) return c.json({ error: 'Too many submissions. Please try again later.' }, 429);

  // 3. Spam detection (basic)
  const spamScore = detectSpam(body.data);
  if (spamScore > 0.8) {
    await supabase.from('form_submissions').insert({
      store_id: body.storeId, data: body.data, ip_address: ip,
      user_agent: c.req.header('user-agent'), status: 'spam',
    });
    return c.json({ success: true }); // Silent success (don't reveal spam detection)
  }

  // 4. Save submission
  const { data: submission } = await supabase.from('form_submissions').insert({
    store_id: body.storeId,
    data: body.data,
    ip_address: ip,
    user_agent: c.req.header('user-agent'),
    referrer: c.req.header('referer'),
  }).select().single();

  // 5. Get store config
  const { data: store } = await supabase.from('stores')
    .select('name, contact_form_config, user_id')
    .eq('id', body.storeId).single();
  const config = store.contact_form_config;

  // 6. Notify store owner
  if (config?.notifications?.email) {
    const { data: owner } = await supabase.from('profiles')
      .select('email').eq('id', store.user_id).single();
    await c.env.EMAIL_QUEUE.send({
      template: 'contact-form-notification',
      to: owner.email,
      data: { storeName: store.name, submission: body.data },
    });
  }

  // 7. Send auto-reply to visitor
  if (config?.autoReply?.enabled && body.data.email) {
    await c.env.EMAIL_QUEUE.send({
      template: 'contact-form-auto-reply',
      to: body.data.email,
      data: {
        visitorName: body.data.name || 'there',
        storeName: store.name,
        replyBody: config.autoReply.body,
      },
    });
  }

  // 8. In-app notification
  await supabase.from('notifications').insert({
    store_id: body.storeId,
    type: 'contact.new_submission',
    title: `New message from ${body.data.name || body.data.email}`,
    body: (body.data.message || '').substring(0, 100),
    action_url: '/contact',
  });

  return c.json({ success: true, message: config?.autoReply?.enabled ? 'Message sent! Check your email for confirmation.' : 'Message sent successfully!' });
});
```

### 6.3 Submissions Management (Admin)

```
┌──────────────────────────────────────────────────────────────┐
│  Contact Submissions (23)    Filter: [All ▼]  [This Month ▼]│
│                                                               │
│  Unread (3)    Read (12)    Replied (5)    Archived (3)      │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 🔵 Sarah Chen — sarah@example.com        2 hours ago  │  │
│  │    "I'd like to discuss a new project for our..."      │  │
│  │    Budget: ₹2L-5L  |  Type: Web Development           │  │
│  │    [Reply] [Mark Read] [Archive]                       │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ 🔵 Alex Kim — alex@startup.io            5 hours ago  │  │
│  │    "We need a mobile app for our logistics..."         │  │
│  │    Budget: ₹50K-2L  |  Type: Mobile App               │  │
│  │    [Reply] [Mark Read] [Archive]                       │  │
│  ├────────────────────────────────────────────────────────┤  │
│  │ 🔵 Priya M — priya@agency.com            Yesterday    │  │
│  │    "Would love to collaborate on a design..."          │  │
│  │    Budget: < ₹50K  |  Type: UI/UX Design              │  │
│  │    📎 brief.pdf (1.2 MB)                               │  │
│  │    [Reply] [Mark Read] [Archive]                       │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                               │
│  [Export All as CSV]  [Bulk Archive Read]                     │
└──────────────────────────────────────────────────────────────┘
```

---

## 7. Resume Builder Architecture

### 7.1 Resume Data Model

```
┌────────────────────────────────────────────────────────────────────┐
│                  RESUME BUILDER DATA MODEL                          │
│                                                                     │
│  ┌─ Personal Info ─┐  ┌─ Summary ──────┐  ┌─ Experience ──────┐  │
│  │  Name, Title     │  │  AI-generated  │  │  Company 1        │  │
│  │  Email, Phone    │  │  or manual     │  │  Company 2        │  │
│  │  Location        │  │  2-4 sentences │  │  Company 3        │  │
│  │  Website, GitHub │  └────────────────┘  │  (achievements[]) │  │
│  │  LinkedIn        │                       └──────────────────┘  │
│  └──────────────────┘                                              │
│                                                                     │
│  ┌─ Education ─────┐  ┌─ Skills ───────┐  ┌─ Certifications ──┐  │
│  │  Degree 1       │  │  Category 1    │  │  AWS Solutions    │  │
│  │  Degree 2       │  │  Category 2    │  │  Google Cloud     │  │
│  │  (GPA optional) │  │  (proficiency) │  │  (credential URL) │  │
│  └──────────────────┘  └────────────────┘  └──────────────────┘  │
│                                                                     │
│  ┌─ Projects ──────┐  ┌─ Languages ────┐  ┌─ Volunteer ───────┐  │
│  │  Project 1      │  │  English (C2)  │  │  NGO Work         │  │
│  │  Project 2      │  │  Hindi (Native)│  │  Open Source      │  │  
│  │  (tech stack)   │  │  Spanish (B1)  │  └──────────────────┘  │
│  └──────────────────┘  └────────────────┘                        │
│                                                                     │
│  All sections → Resume Version (template + settings) → PDF/DOCX   │
└────────────────────────────────────────────────────────────────────┘
```

### 7.2 Resume Sections Config

```typescript
// packages/types/src/resume.ts

export interface ResumeSection {
  id: string;
  type: ResumeSectionType;
  label: string;
  required: boolean;
  enabled: boolean;
  order: number;
}

export type ResumeSectionType =
  | 'personal_info'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'certifications'
  | 'projects'
  | 'languages'
  | 'volunteer'
  | 'publications'
  | 'references'
  | 'custom';

export const DEFAULT_RESUME_SECTIONS: ResumeSection[] = [
  { id: 'personal_info',  type: 'personal_info',  label: 'Personal Info',     required: true,  enabled: true,  order: 0 },
  { id: 'summary',        type: 'summary',        label: 'Professional Summary', required: true, enabled: true, order: 1 },
  { id: 'experience',     type: 'experience',     label: 'Work Experience',   required: true,  enabled: true,  order: 2 },
  { id: 'education',      type: 'education',      label: 'Education',         required: true,  enabled: true,  order: 3 },
  { id: 'skills',         type: 'skills',         label: 'Skills',            required: true,  enabled: true,  order: 4 },
  { id: 'certifications', type: 'certifications', label: 'Certifications',    required: false, enabled: true,  order: 5 },
  { id: 'projects',       type: 'projects',       label: 'Projects',          required: false, enabled: true,  order: 6 },
  { id: 'languages',      type: 'languages',      label: 'Languages',         required: false, enabled: false, order: 7 },
  { id: 'volunteer',      type: 'volunteer',      label: 'Volunteer Work',    required: false, enabled: false, order: 8 },
  { id: 'publications',   type: 'publications',   label: 'Publications',      required: false, enabled: false, order: 9 },
  { id: 'references',     type: 'references',     label: 'References',        required: false, enabled: false, order: 10 },
];
```

### 7.3 Live Preview Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│              RESUME BUILDER — LIVE PREVIEW                          │
│                                                                     │
│  ┌─ Editor (Left) ──────────────┐  ┌─ Preview (Right) ──────────┐│
│  │                               │  │                            ││
│  │  Sections:                    │  │  ┌─────────────────────┐   ││
│  │  [≡ Personal Info    ]  ☑    │  │  │  JOHN DOE           │   ││
│  │  [≡ Summary          ]  ☑    │  │  │  Lead Developer     │   ││
│  │  [≡ Experience       ]  ☑    │  │  │  john@example.com   │   ││
│  │  [≡ Education        ]  ☑    │  │  │  +91 9876543210     │   ││
│  │  [≡ Skills           ]  ☑    │  │  ├─────────────────────┤   ││
│  │  [≡ Certifications   ]  ☑    │  │  │  SUMMARY            │   ││
│  │  [≡ Projects         ]  ☑    │  │  │  Experienced dev...  │   ││
│  │  [≡ Languages        ]  ☐    │  │  ├─────────────────────┤   ││
│  │  [≡ Volunteer        ]  ☐    │  │  │  EXPERIENCE         │   ││
│  │  [+ Add Custom Section]      │  │  │  Lead Developer     │   ││
│  │                               │  │  │  TechCorp Inc.      │   ││
│  │  drag ≡ to reorder           │  │  │  • Led 8-person...  │   ││
│  │  toggle ☑/☐ visibility       │  │  │  • Reduced load...  │   ││
│  │                               │  │  │                     │   ││
│  │  ─────────────────────────   │  │  │  Senior Developer   │   ││
│  │  Template: [Modern ▼]        │  │  │  StartupXYZ         │   ││
│  │  Color:    [🔵 Blue ▼]       │  │  │  • Built API...     │   ││
│  │  Font:     [Inter ▼]         │  │  ├─────────────────────┤   ││
│  │  Pages:    [Auto ▼]          │  │  │  EDUCATION          │   ││
│  │                               │  │  │  B.Tech in CS       │   ││
│  │  [🤖 AI: ATS Score]          │  │  │  IIT Mumbai          │   ││
│  │  [📄 Export PDF]              │  │  └─────────────────────┘   ││
│  │  [📝 Export DOCX]            │  │                 Page 1 of 1 ││
│  └───────────────────────────────┘  └────────────────────────────┘│
│                                                                     │
│  Updates in real-time as you type (debounced 300ms)                │
└────────────────────────────────────────────────────────────────────┘
```

---

## 8. Work Experience

### 8.1 Experience Schema

```sql
CREATE TABLE work_experience (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Company info
  company         TEXT NOT NULL,
  company_logo    TEXT,                  -- R2 URL (auto-fetched from Clearbit)
  company_url     TEXT,
  
  -- Role
  title           TEXT NOT NULL,
  employment_type TEXT DEFAULT 'full_time',  -- full_time, part_time, contract, freelance, internship
  location        TEXT,
  location_type   TEXT DEFAULT 'onsite',     -- onsite, remote, hybrid
  
  -- Dates
  start_date      DATE NOT NULL,
  end_date        DATE,                  -- NULL = current position
  is_current      BOOLEAN DEFAULT false,
  
  -- Content
  description     TEXT,                  -- Overview paragraph
  achievements    TEXT[] DEFAULT '{}',   -- Bullet points (AI-improvable)
  
  -- Association
  skills_used     TEXT[] DEFAULT '{}',   -- Link to skills
  
  -- Display
  display_order   INT DEFAULT 0,
  is_visible      BOOLEAN DEFAULT true,
  
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_experience_store ON work_experience(store_id, display_order);

ALTER TABLE work_experience ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Store owners manage experience"
  ON work_experience FOR ALL
  USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
```

### 8.2 Experience CRUD API

```typescript
// workers/api/src/routes/resume/experience.ts

const experienceSchema = z.object({
  company: z.string().min(1),
  companyUrl: z.string().url().optional(),
  title: z.string().min(1),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'freelance', 'internship']).default('full_time'),
  location: z.string().optional(),
  locationType: z.enum(['onsite', 'remote', 'hybrid']).default('onsite'),
  startDate: z.string(),   // ISO date
  endDate: z.string().nullable().optional(),
  isCurrent: z.boolean().default(false),
  description: z.string().optional(),
  achievements: z.array(z.string()).max(10).default([]),
  skillsUsed: z.array(z.string()).default([]),
});

app.post('/v1/stores/:storeId/experience', authMiddleware(), storeOwnerMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const body = experienceSchema.parse(await c.req.json());
  const supabase = createServiceClient(c.env);

  // Auto-fetch company logo from Clearbit
  let companyLogo = null;
  if (body.companyUrl) {
    try {
      const domain = new URL(body.companyUrl).hostname;
      companyLogo = `https://logo.clearbit.com/${domain}`;
    } catch { /* ignore */ }
  }

  const { data: maxOrder } = await supabase.from('work_experience')
    .select('display_order').eq('store_id', storeId)
    .order('display_order', { ascending: false }).limit(1).single();

  const { data, error } = await supabase.from('work_experience').insert({
    store_id: storeId,
    company_logo: companyLogo,
    display_order: (maxOrder?.display_order || 0) + 1,
    ...snakeCaseKeys(body),
  }).select().single();

  if (error) return c.json({ error: error.message }, 500);
  return c.json(data, 201);
});

// AI: Improve achievement bullet points
app.post('/v1/stores/:storeId/experience/:expId/ai-improve', authMiddleware(), aiCreditMiddleware(1), async (c) => {
  const { storeId, expId } = c.req.param();
  const supabase = createServiceClient(c.env);

  const { data: exp } = await supabase.from('work_experience')
    .select('*').eq('id', expId).eq('store_id', storeId).single();
  if (!exp) return c.json({ error: 'Experience not found' }, 404);

  const prompt = `You are a professional resume writer. Improve these achievement bullet points for a ${exp.title} at ${exp.company}.

Current bullet points:
${exp.achievements.map((a: string, i: number) => `${i + 1}. ${a}`).join('\n')}

Rules:
- Start each bullet with a strong action verb
- Include quantified results (percentages, numbers, revenue)
- Use the XYZ formula: "Accomplished [X] as measured by [Y], by doing [Z]"
- Keep each bullet under 2 lines
- Maintain truthfulness — enhance wording, don't fabricate

Return JSON: { "achievements": ["bullet1", "bullet2", ...] }`;

  const result = await callAI(c.env, 'claude-sonnet-4-5', prompt, { responseFormat: 'json' });
  return c.json(result);
});
```

### 8.3 Experience Entry UI

```
┌──────────────────────────────────────────────────────────────┐
│  Work Experience                      [+ Add Experience]     │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  📷 Lead Software Engineer              [Edit] [🗑]  │    │
│  │  TechCorp Inc. • Full-time • Remote                  │    │
│  │  Jan 2024 – Present (1 yr 1 mo)                      │    │
│  │  San Francisco, CA                                    │    │
│  │                                                       │    │
│  │  Achievements:                                        │    │
│  │  • Led 8-person team to rebuild e-commerce platform   │    │
│  │    resulting in 35% increase in conversion rate       │    │
│  │  • Reduced page load time by 40% through code         │    │
│  │    splitting and edge caching implementation          │    │
│  │  • Implemented CI/CD pipeline reducing deploy time    │    │
│  │    from 45 minutes to 8 minutes (5x improvement)     │    │
│  │                                                       │    │
│  │  Skills: React, TypeScript, Node.js, PostgreSQL       │    │
│  │                                                       │    │
│  │  [🤖 AI: Improve bullet points]                      │    │
│  │  [🤖 AI: Add quantified achievements]                │    │
│  │  [Move Up ↑]  [Move Down ↓]                          │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  📷 Senior Developer                   [Edit] [🗑]  │    │
│  │  StartupXYZ • Full-time • Hybrid                     │    │
│  │  Mar 2022 – Dec 2023 (1 yr 10 mo)                    │    │
│  │  Mumbai, India                                        │    │
│  │  ...                                                  │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 9. Education & Certifications

### 9.1 Education Schema

```sql
CREATE TABLE education (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Institution
  institution     TEXT NOT NULL,
  institution_logo TEXT,                -- R2 URL or Clearbit
  institution_url  TEXT,
  
  -- Degree
  degree          TEXT,                  -- "B.Tech", "Master's", "Ph.D."
  field_of_study  TEXT,                  -- "Computer Science"
  
  -- Dates
  start_date      DATE,
  end_date        DATE,
  is_current      BOOLEAN DEFAULT false,
  
  -- Details
  gpa             TEXT,                  -- "3.8/4.0" or "8.5/10"
  description     TEXT,                  -- Activities, honors
  achievements    TEXT[] DEFAULT '{}',   -- Dean's list, scholarships, etc.
  coursework      TEXT[] DEFAULT '{}',   -- Relevant courses
  
  -- Display
  display_order   INT DEFAULT 0,
  is_visible      BOOLEAN DEFAULT true,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_education_store ON education(store_id, display_order);
```

### 9.2 Certifications Schema

```sql
CREATE TABLE certifications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Cert info
  name            TEXT NOT NULL,           -- "AWS Solutions Architect"
  issuing_org     TEXT NOT NULL,           -- "Amazon Web Services"
  issuing_org_logo TEXT,                   -- R2 URL
  
  -- Validity
  issue_date      DATE NOT NULL,
  expiry_date     DATE,                    -- NULL = no expiry
  
  -- Verification
  credential_id   TEXT,                    -- "ABC123XYZ"
  credential_url  TEXT,                    -- Verification URL
  
  -- Media
  badge_url       TEXT,                    -- Digital badge image
  
  -- Display
  display_order   INT DEFAULT 0,
  is_visible      BOOLEAN DEFAULT true,
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_certs_store ON certifications(store_id, display_order);
```

### 9.3 Education & Certifications UI

```
┌──────────────────────────────────────────────────────────────┐
│  Education                            [+ Add Education]      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  🎓 B.Tech in Computer Science     [Edit] [🗑]      │    │
│  │  Indian Institute of Technology, Mumbai              │    │
│  │  Aug 2018 – May 2022                                  │    │
│  │  GPA: 8.7/10                                          │    │
│  │                                                       │    │
│  │  • Dean's List — All semesters                        │    │
│  │  • Published paper on distributed systems             │    │
│  │  Courses: Data Structures, ML, Distributed Systems    │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  Certifications                    [+ Add Certification]     │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  🏅 AWS Solutions Architect – Associate               │    │
│  │  Amazon Web Services • Issued May 2024                │    │
│  │  Expires May 2027 • ID: ABC123XYZ                     │    │
│  │  [🔗 Verify Credential]                  [Edit] [🗑] │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │  🏅 Google Cloud Professional Cloud Developer         │    │
│  │  Google Cloud • Issued Jan 2024                       │    │
│  │  Expires Jan 2026 • ID: GCP-DEV-789                   │    │
│  │  [🔗 Verify Credential]                  [Edit] [🗑] │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

---

## 10. PDF Export Engine

### 10.1 Generation Pipeline

```
┌────────────────────────────────────────────────────────────────────┐
│              PDF GENERATION PIPELINE                                │
│                                                                     │
│  Step 1: Data Assembly                                              │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Resume Data (JSON)                                          │  │
│  │  ├── personal_info → { name, title, email, phone, ... }     │  │
│  │  ├── experience[] → sorted by date, filtered by visibility   │  │
│  │  ├── education[] → sorted by date                            │  │
│  │  ├── skills[] → grouped by category                          │  │
│  │  ├── certifications[] → sorted by issue_date                 │  │
│  │  └── settings → { template, color, font, sections, pages }  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  Step 2: HTML Rendering      ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Template Engine (React Server Components)                   │  │
│  │  ├── Load template component: ModernTemplate / ClassicTpl   │  │
│  │  ├── Inject resume data as props                             │  │
│  │  ├── Apply color scheme, font family                         │  │
│  │  ├── Render to static HTML string                            │  │
│  │  └── Inject custom CSS + embedded fonts (@font-face)         │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  Step 3: PDF Conversion      ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Puppeteer (Cloudflare Workers / Browser API)                │  │
│  │  ├── Launch headless Chromium                                │  │
│  │  ├── Set page content (rendered HTML)                        │  │
│  │  ├── Configure page: A4/Letter, margins, print media query  │  │
│  │  ├── page.pdf() → Uint8Array                                │  │
│  │  └── Section-aware page breaking (CSS break-inside: avoid)  │  │
│  └──────────────────────────────────────────────────────────────┘  │
│                              │                                      │
│  Step 4: Storage & Delivery  ▼                                      │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Supabase Storage (documents bucket)                         │  │
│  │  ├── Upload PDF: {store_id}/docs/resume_{version}_{ts}.pdf  │  │
│  │  ├── Generate signed download URL (24h expiry)              │  │
│  │  ├── Update resume_versions.pdf_url + generated_at          │  │
│  │  └── Cache PDF hash for change detection                    │  │
│  └──────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

### 10.2 PDF Generation API

```typescript
// workers/api/src/routes/resume/export.ts

import puppeteer from '@cloudflare/puppeteer';

const exportSchema = z.object({
  versionId: z.string().uuid(),
  paperSize: z.enum(['a4', 'letter']).default('a4'),
  colorScheme: z.string().default('blue'),
  fontFamily: z.enum(['Inter', 'Roboto', 'Georgia', 'Source Sans Pro']).default('Inter'),
  sections: z.array(z.string()).optional(),        // Override which sections to include
  forcePages: z.number().int().min(1).max(3).optional(),  // Force page count
  includeQR: z.boolean().default(false),
});

app.post('/v1/stores/:storeId/resume/generate-pdf', authMiddleware(), storeOwnerMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const body = exportSchema.parse(await c.req.json());
  const supabase = createServiceClient(c.env);

  // 1. Fetch all resume data
  const [personal, experience, education, skills, certs, projects] = await Promise.all([
    supabase.from('stores').select('name, contact_form_config, settings').eq('id', storeId).single(),
    supabase.from('work_experience').select('*').eq('store_id', storeId).eq('is_visible', true)
      .order('start_date', { ascending: false }),
    supabase.from('education').select('*').eq('store_id', storeId).eq('is_visible', true)
      .order('start_date', { ascending: false }),
    supabase.from('skills').select('*').eq('store_id', storeId).eq('is_visible', true)
      .order('category').order('display_order'),
    supabase.from('certifications').select('*').eq('store_id', storeId).eq('is_visible', true)
      .order('issue_date', { ascending: false }),
    supabase.from('projects').select('*').eq('store_id', storeId).eq('status', 'published')
      .order('display_order').limit(5),
  ]);

  // 2. Build resume data object
  const resumeData = {
    personal: personal.data?.settings?.resume_info || {},
    experience: experience.data || [],
    education: education.data || [],
    skills: skills.data || [],
    certifications: certs.data || [],
    projects: projects.data || [],
  };

  // 3. Render HTML from template
  const templateName = body.colorScheme || 'modern';
  const html = await renderResumeTemplate(templateName, resumeData, {
    color: body.colorScheme,
    font: body.fontFamily,
    paperSize: body.paperSize,
    sections: body.sections,
    includeQR: body.includeQR,
    qrUrl: `https://${personal.data?.name}.letbuyy.store`,
  });

  // 4. Convert to PDF via Puppeteer
  const browser = await puppeteer.launch(c.env.BROWSER);
  const page = await browser.newPage();
  
  await page.setContent(html, { waitUntil: 'networkidle0' });

  const pdfOptions: Record<string, any> = {
    format: body.paperSize === 'a4' ? 'A4' : 'Letter',
    printBackground: true,
    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    preferCSSPageSize: true,
  };

  // Force page count by adjusting font size
  if (body.forcePages) {
    await adjustFontSizeForPageCount(page, body.forcePages);
  }

  const pdfBuffer = await page.pdf(pdfOptions);
  await browser.close();

  // 5. Upload to Supabase Storage
  const filename = `resume_${body.versionId}_${Date.now()}.pdf`;
  const storagePath = `${storeId}/docs/${filename}`;
  await supabase.storage.from('documents').upload(storagePath, pdfBuffer, {
    contentType: 'application/pdf',
    upsert: true,
  });

  // 6. Update version record
  const pdfUrl = supabase.storage.from('documents').getPublicUrl(storagePath).data.publicUrl;
  await supabase.from('resume_versions').update({
    pdf_url: pdfUrl,
    generated_at: new Date().toISOString(),
  }).eq('id', body.versionId);

  // 7. Return download URL
  const { data: signedUrl } = await supabase.storage.from('documents')
    .createSignedUrl(storagePath, 86400); // 24h expiry

  return c.json({ pdfUrl: signedUrl.signedUrl, filename, pageCount: pdfBuffer.length });
});
```

### 10.3 Export Options

| Setting | Options | Default |
|---|---|---|
| **Template** | Modern, Classic, Minimal, Creative, ATS | Modern |
| **Paper size** | A4, US Letter | A4 |
| **Color scheme** | Blue, Green, Red, Purple, Teal, Monochrome | Blue |
| **Font** | Inter, Roboto, Georgia, Source Sans Pro | Inter |
| **Sections** | Toggle visibility per section | All enabled |
| **Page count** | Auto, Force 1 page, Force 2 pages | Auto |
| **QR code** | Optional — links to online portfolio | Off |
| **Header photo** | Include profile photo (non-ATS) | Off |

### 10.4 PDF Template Styles

```
┌─ Modern ──────────────────────┐  ┌─ Classic ──────────────────────┐
│ ┌──────┐  JOHN DOE            │  │ ═══════════════════════════════│
│ │ Photo│  Lead Developer      │  │         JOHN DOE               │
│ │      │  john@example.com    │  │   Lead Software Developer     │
│ └──────┘  +91 98765 43210     │  │ john@example.com | 987-654    │
│ ──────────────────────────────│  │ ═══════════════════════════════│
│ ┌────────┐ ┌─────────────────┐│  │ PROFESSIONAL SUMMARY          │
│ │SIDEBAR │ │ EXPERIENCE      ││  │ ─────────────────────────────  │
│ │        │ │ Lead Developer  ││  │ Experienced developer with...  │
│ │SKILLS  │ │ TechCorp Inc.   ││  │                                │
│ │React   │ │ • Led team...   ││  │ WORK EXPERIENCE               │
│ │TS      │ │ • Reduced...    ││  │ ─────────────────────────────  │
│ │Node    │ │                 ││  │ Lead Developer                 │
│ │        │ │ EDUCATION       ││  │ TechCorp Inc. | 2024-Present  │
│ │CONTACT │ │ B.Tech CS       ││  │ • Led 8-person team...         │
│ │Email   │ │ IIT Mumbai      ││  │ • Reduced page load time...    │
│ │GitHub  │ │                 ││  │                                │
│ └────────┘ └─────────────────┘│  └────────────────────────────────┘
└───────────────────────────────┘

┌─ Minimal ─────────────────────┐  ┌─ ATS ──────────────────────────┐
│                                │  │ John Doe                       │
│  John Doe                      │  │ Lead Software Developer        │
│  ──────                        │  │ john@example.com | 987-654     │
│  Lead Developer                │  │ linkedin.com/in/john           │
│  john@example.com              │  │                                │
│                                │  │ PROFESSIONAL SUMMARY           │
│  Experience                    │  │ Experienced developer with...  │
│                                │  │                                │
│  Lead Developer — TechCorp     │  │ WORK EXPERIENCE                │
│  2024 – Present                │  │ Lead Developer                 │
│  · Led 8-person team           │  │ TechCorp Inc.                  │
│  · Reduced load time 40%      │  │ January 2024 - Present         │
│                                │  │ - Led 8-person team to         │
│  Education                     │  │   rebuild e-commerce platform  │
│                                │  │ - Reduced page load time by    │
│  B.Tech CS — IIT Mumbai        │  │   40% through optimization     │
│  2018 – 2022                   │  │                                │
└───────────────────────────────┘  └────────────────────────────────┘
```

---

## 11. DOCX Export

### 11.1 DOCX Generation

```typescript
// workers/api/src/routes/resume/export-docx.ts

import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Packer } from 'docx';

app.post('/v1/stores/:storeId/resume/generate-docx', authMiddleware(), storeOwnerMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const supabase = createServiceClient(c.env);

  // Fetch resume data (same as PDF)
  const resumeData = await fetchResumeData(supabase, storeId);

  const doc = new Document({
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
      children: [
        // Name and contact
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: resumeData.personal.name, bold: true, size: 32, font: 'Calibri' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [
            new TextRun({ text: resumeData.personal.title, size: 22, font: 'Calibri' }),
          ],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
          children: [
            new TextRun({
              text: [resumeData.personal.email, resumeData.personal.phone, resumeData.personal.location]
                .filter(Boolean).join(' | '),
              size: 18, font: 'Calibri',
            }),
          ],
        }),

        // Summary
        ...(resumeData.personal.summary ? [
          createSectionHeading('PROFESSIONAL SUMMARY'),
          new Paragraph({
            spacing: { after: 200 },
            children: [new TextRun({ text: resumeData.personal.summary, size: 20, font: 'Calibri' })],
          }),
        ] : []),

        // Experience
        createSectionHeading('WORK EXPERIENCE'),
        ...resumeData.experience.flatMap((exp: any) => [
          new Paragraph({
            children: [
              new TextRun({ text: exp.title, bold: true, size: 21, font: 'Calibri' }),
              new TextRun({ text: ` — ${exp.company}`, size: 21, font: 'Calibri' }),
            ],
          }),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: `${formatDate(exp.start_date)} – ${exp.is_current ? 'Present' : formatDate(exp.end_date)}`,
                size: 18, italics: true, font: 'Calibri',
              }),
            ],
          }),
          ...exp.achievements.map((bullet: string) =>
            new Paragraph({
              bullet: { level: 0 },
              children: [new TextRun({ text: bullet, size: 20, font: 'Calibri' })],
            })
          ),
          new Paragraph({ spacing: { after: 150 }, children: [] }),
        ]),

        // Education, Skills, Certifications follow same pattern...
      ],
    }],
  });

  const buffer = await Packer.toBuffer(doc);

  // Upload to storage
  const filename = `resume_${Date.now()}.docx`;
  await supabase.storage.from('documents').upload(`${storeId}/docs/${filename}`, buffer, {
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const { data: signedUrl } = await supabase.storage.from('documents')
    .createSignedUrl(`${storeId}/docs/${filename}`, 86400);

  return c.json({ docxUrl: signedUrl.signedUrl, filename });
});

function createSectionHeading(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 300, after: 100 },
    borders: { bottom: { color: '000000', space: 1, size: 6, style: 'single' } },
    children: [new TextRun({ text, bold: true, size: 22, font: 'Calibri', allCaps: true })],
  });
}
```

### 11.2 Export Format Comparison

| Feature | PDF | DOCX |
|---|---|---|
| Visual fidelity | ✅ Pixel-perfect | ⚠️ Varies by viewer |
| ATS compatibility | ⚠️ Template-dependent | ✅ Excellent |
| Editable | ❌ Read-only | ✅ Fully editable |
| Custom fonts | ✅ Embedded | ⚠️ System fonts only |
| File size | ~100-300 KB | ~50-150 KB |
| QR code support | ✅ Yes | ⚠️ Basic |
| Color themes | ✅ Full support | ⚠️ Limited |
| Recommended for | Direct sharing, portfolio | ATS submissions, editing |

---

## 12. Resume Versioning

### 12.1 Version Management Schema

```sql
CREATE TABLE resume_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Version info
  name            TEXT NOT NULL,            -- "Tech Resume", "Creative Resume", "ATS Resume"
  description     TEXT,                      -- Purpose of this version
  
  -- Template settings
  template        TEXT NOT NULL DEFAULT 'modern',
  settings        JSONB DEFAULT '{}',       -- { color, font, paperSize, sections[], forcePages }
  
  -- Targeting
  target_role     TEXT,                      -- "Senior Frontend Developer"
  target_company  TEXT,                      -- "Google"
  target_keywords TEXT[] DEFAULT '{}',       -- Keywords to optimize for
  
  -- Exports
  pdf_url         TEXT,                      -- Last generated PDF
  docx_url        TEXT,                      -- Last generated DOCX
  generated_at    TIMESTAMPTZ,
  
  -- Sharing
  public_slug     TEXT,
  is_public       BOOLEAN DEFAULT false,
  public_url      TEXT,                      -- letbuyy.store/{subdomain}/resume/{slug}
  
  -- ATS
  ats_score       INT,                       -- Last computed ATS score (0-100)
  ats_feedback    JSONB,                     -- Detailed ATS analysis
  
  -- Stats
  view_count      INT DEFAULT 0,
  download_count  INT DEFAULT 0,
  
  -- Meta
  is_primary      BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_resume_versions_slug ON resume_versions(store_id, public_slug) WHERE public_slug IS NOT NULL;
CREATE INDEX idx_resume_versions_store ON resume_versions(store_id, is_primary DESC);
```

### 12.2 Version Management UI

```
┌──────────────────────────────────────────────────────────────┐
│  Resume Versions (3)                  [+ Create Version]     │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  ⭐ Tech Resume (Primary)                 [Edit] [⋯]│    │
│  │  Template: Modern │ Color: Blue │ Font: Inter        │    │
│  │  Target: Senior Frontend Developer                    │    │
│  │  ATS Score: 87/100 🟢                                 │    │
│  │  Last generated: 2 hours ago                          │    │
│  │  Views: 42 │ Downloads: 12                            │    │
│  │  [📄 Download PDF] [📝 Download DOCX] [🔗 Share Link]│    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  Creative Resume                          [Edit] [⋯]│    │
│  │  Template: Creative │ Color: Purple │ Font: Roboto   │    │
│  │  Target: UI/UX Designer                               │    │
│  │  ATS Score: 62/100 🟡 (not ATS-optimized)            │    │
│  │  Last generated: 1 day ago                            │    │
│  │  [📄 Download PDF] [📝 Download DOCX] [🔗 Share Link]│    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐    │
│  │  ATS-Optimized Resume                     [Edit] [⋯]│    │
│  │  Template: ATS │ Color: Mono │ Font: Calibri         │    │
│  │  Target: Backend Engineer at Google                   │    │
│  │  ATS Score: 95/100 🟢                                 │    │
│  │  Keywords: Go, Kubernetes, distributed systems        │    │
│  │  Last generated: 3 days ago                           │    │
│  │  [📄 Download PDF] [📝 Download DOCX] [🔗 Share Link]│    │
│  └──────────────────────────────────────────────────────┘    │
│                                                               │
│  [Duplicate Version] [Compare Versions]                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 13. Template System

### 13.1 Template Architecture

Templates are shared across all site types but filtered by context:

```
templates/
├── portfolio/
│   ├── developer/         → GitHub-style, dark theme, code-focused
│   │   ├── preview.png    → Template preview image
│   │   ├── config.json    → { sections, colors, fonts, features }
│   │   └── component.tsx  → React Server Component
│   │
│   ├── designer/          → Visual-heavy, masonry grid, minimal text
│   ├── photographer/      → Full-bleed images, lightbox gallery
│   ├── freelancer/        → Services-focused, pricing table, testimonials
│   └── creative/          → Bold colors, unique section layouts
│
├── resume/
│   ├── modern/            → Sidebar + main, accent color, clean
│   ├── classic/           → Traditional full-width, serif headings
│   ├── minimal/           → Maximum whitespace, mono accents
│   ├── creative/          → Bold colors, visual skill charts
│   └── ats/               → Plain text, no columns, ATS-optimized
│
└── shared/
    ├── fonts/             → Inter, Roboto, Georgia, Source Sans Pro
    ├── icons/             → Lucide icon set
    └── variables.css      → CSS custom properties per template
```

### 13.2 Template Config

```typescript
// packages/types/src/templates.ts

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  category: 'portfolio' | 'resume';
  previewImage: string;
  
  // Features
  features: {
    darkMode: boolean;
    animations: boolean;
    customCSS: boolean;
    multiColumn: boolean;
    headerPhoto: boolean;
  };
  
  // Defaults
  defaults: {
    colorScheme: string;
    fontFamily: string;
    fontSize: number;
    spacing: 'compact' | 'normal' | 'spacious';
  };
  
  // Plan requirement
  requiredPlan: 'free' | 'starter' | 'growth' | 'enterprise';
  
  // Sections supported
  supportedSections: string[];
}

export const PORTFOLIO_TEMPLATES: TemplateConfig[] = [
  {
    id: 'developer',
    name: 'Developer',
    description: 'GitHub-inspired dark theme with code-focused layout',
    category: 'portfolio',
    previewImage: '/templates/portfolio/developer/preview.png',
    features: { darkMode: true, animations: true, customCSS: true, multiColumn: true, headerPhoto: true },
    defaults: { colorScheme: 'green', fontFamily: 'JetBrains Mono', fontSize: 14, spacing: 'normal' },
    requiredPlan: 'free',
    supportedSections: ['projects', 'skills', 'education', 'testimonials', 'contact', 'blog', 'gallery'],
  },
  {
    id: 'designer',
    name: 'Designer',
    description: 'Visual-heavy portfolio with masonry grid for design work',
    category: 'portfolio',
    previewImage: '/templates/portfolio/designer/preview.png',
    features: { darkMode: true, animations: true, customCSS: true, multiColumn: true, headerPhoto: true },
    defaults: { colorScheme: 'pink', fontFamily: 'DM Sans', fontSize: 16, spacing: 'spacious' },
    requiredPlan: 'free',
    supportedSections: ['projects', 'gallery', 'skills', 'testimonials', 'contact'],
  },
  // ... photographer, freelancer, creative
];
```

### 13.3 Template Selection UI

```
┌──────────────────────────────────────────────────────────────┐
│  Choose Template               Filter: [Portfolio ▼] [All ▼] │
│                                                               │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐              │
│  │ 📷   │ │ 📷   │ │ 📷   │ │ 📷   │ │ 📷   │              │
│  │      │ │      │ │      │ │      │ │      │              │
│  │      │ │      │ │      │ │      │ │      │              │
│  │      │ │      │ │      │ │      │ │  🔒  │              │
│  └──────┘ └──────┘ └──────┘ └──────┘ └──────┘              │
│  Developer Designer Photog.  Freelncr Creative              │
│  ✅ Active          ⭐ Popular        🔒 Starter+           │
│                                                               │
│  ┌─ Developer (Selected) ────────────────────────────────┐   │
│  │  GitHub-inspired dark theme with code-focused layout  │   │
│  │                                                        │   │
│  │  ✅ Dark Mode   ✅ Animations   ✅ Custom CSS         │   │
│  │  ✅ Multi-column  ✅ Header Photo                     │   │
│  │                                                        │   │
│  │  [Preview Full] [Select This Template]                │   │
│  └────────────────────────────────────────────────────────┘   │
│                                                               │
│  💡 AI Recommendation: Based on your content (mostly         │
│  code projects), the "Developer" template is ideal.          │
└──────────────────────────────────────────────────────────────┘
```

### 13.4 Hot-Swap & Custom CSS

```typescript
// workers/api/src/routes/portfolio/appearance.ts

app.put('/v1/stores/:storeId/appearance', authMiddleware(), storeOwnerMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const body = z.object({
    templateId: z.string(),
    colorScheme: z.string().optional(),
    fontFamily: z.string().optional(),
    customCSS: z.string().max(10000).optional(),
    darkMode: z.boolean().optional(),
  }).parse(await c.req.json());

  const supabase = createServiceClient(c.env);

  // Validate custom CSS (paid plans only)
  if (body.customCSS) {
    const { data: store } = await supabase.from('stores').select('plan').eq('id', storeId).single();
    if (store.plan === 'free') return c.json({ error: 'Custom CSS requires Starter+ plan' }, 403);

    // Sanitize CSS (no JS injection)
    const sanitized = sanitizeCSS(body.customCSS);
    if (!sanitized.valid) return c.json({ error: sanitized.error }, 400);
    body.customCSS = sanitized.css;
  }

  // Update store appearance settings
  await supabase.from('stores').update({
    settings: supabase.rpc('jsonb_merge', {
      original: 'settings',
      patch: {
        appearance: {
          template: body.templateId,
          colorScheme: body.colorScheme,
          fontFamily: body.fontFamily,
          customCSS: body.customCSS,
          darkMode: body.darkMode,
        },
      },
    }),
    updated_at: new Date().toISOString(),
  }).eq('id', storeId);

  // Invalidate storefront cache
  await c.env.REDIS.del(`cache:store:${storeId}:*`);

  return c.json({ success: true });
});
```

---

## 14. AI Integration

### 14.1 Portfolio AI Features

| Feature | Description | AI Model | Credits |
|---|---|---|---|
| **Project description** | Generate compelling case study text from project details | Claude Sonnet 4.5 | 2 |
| **Case study generator** | Create full problem / solution / results from brief | Claude Sonnet 4.5 | 3 |
| **Skill suggestions** | Analyze projects and suggest skills to add | Gemini 3 Flash | Free |
| **Tag generation** | Auto-tag projects with technologies used | Gemini 3 Flash | Free |
| **SEO optimization** | Generate portfolio meta tags and descriptions | Gemini 3 Flash | 1 |
| **Bio generation** | Create professional about-me text | Claude Sonnet 4.5 | 2 |
| **Testimonial suggestions** | Draft testimonial request emails | Gemini 3 Flash | Free |
| **Tech stack detection** | Analyze repo README to detect tech stack | Gemini 3 Flash | Free |

### 14.2 Resume AI Features

| Feature | Description | AI Model | Credits |
|---|---|---|---|
| **Bullet point improvement** | Make achievements quantified and impactful (XYZ formula) | Claude Sonnet 4.5 | 2 |
| **Summary generation** | Create professional summary from experience data | Claude Sonnet 4.5 | 2 |
| **ATS scoring** | Analyze resume against job description for ATS compatibility | Gemini 3 Pro | 2 |
| **Keyword optimization** | Suggest keywords from target job descriptions | Gemini 3 Flash | 1 |
| **Gap analysis** | Identify missing skills for target roles | Gemini 3 Pro | 2 |
| **Full resume rewrite** | Rewrite entire resume tailored to a specific role | Claude Sonnet 4.5 | 5 |
| **Cover letter** | Generate tailored cover letter from resume + job description | Claude Sonnet 4.5 | 3 |

### 14.3 ATS Scoring Engine

```typescript
// workers/api/src/routes/resume/ats-score.ts

interface ATSResult {
  score: number;               // 0-100
  breakdown: {
    formatting: number;        // 0-25
    keywords: number;          // 0-25
    experience: number;        // 0-25
    education: number;         // 0-25
  };
  suggestions: string[];
  missingKeywords: string[];
  matchedKeywords: string[];
}

app.post('/v1/stores/:storeId/resume/ats-score', authMiddleware(), aiCreditMiddleware(2), async (c) => {
  const storeId = c.req.param('storeId');
  const { jobDescription, targetRole, versionId } = await c.req.json();
  const supabase = createServiceClient(c.env);

  const resumeData = await fetchResumeData(supabase, storeId);

  const prompt = `You are an expert ATS (Applicant Tracking System) analyzer.

Evaluate this resume against the target role and job description.

## Resume Data
Name: ${resumeData.personal.name}
Title: ${resumeData.personal.title}
Summary: ${resumeData.personal.summary}

Experience:
${resumeData.experience.map((e: any) => `- ${e.title} at ${e.company} (${e.start_date} - ${e.is_current ? 'Present' : e.end_date})\n  Achievements: ${e.achievements.join('; ')}`).join('\n')}

Skills: ${resumeData.skills.map((s: any) => s.name).join(', ')}

Education:
${resumeData.education.map((e: any) => `- ${e.degree} in ${e.field_of_study} from ${e.institution}`).join('\n')}

## Target Role: ${targetRole}
## Job Description:
${jobDescription}

## Scoring Criteria:
1. **Formatting (0-25):** Professional structure, clear sections, no gimmicks
2. **Keywords (0-25):** Match between resume keywords and JD keywords
3. **Experience (0-25):** Relevance and impact of work experience
4. **Education (0-25):** Relevant education and certifications

Return JSON:
{
  "score": <number>,
  "breakdown": { "formatting": <0-25>, "keywords": <0-25>, "experience": <0-25>, "education": <0-25> },
  "suggestions": ["suggestion1", "suggestion2", ...],
  "missingKeywords": ["keyword1", "keyword2", ...],
  "matchedKeywords": ["keyword1", "keyword2", ...]
}`;

  const result: ATSResult = await callAI(c.env, 'gemini-3-pro', prompt, { responseFormat: 'json' });

  // Store ATS score on version
  if (versionId) {
    await supabase.from('resume_versions').update({
      ats_score: result.score,
      ats_feedback: result,
    }).eq('id', versionId);
  }

  return c.json(result);
});
```

### 14.4 ATS Score Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  ATS Compatibility Score                                      │
│                                                               │
│  Target: Senior Frontend Developer at Google                 │
│                                                               │
│         ┌──────────────────┐                                  │
│         │                  │                                  │
│         │       87         │  🟢 Good                        │
│         │      /100        │                                  │
│         │                  │                                  │
│         └──────────────────┘                                  │
│                                                               │
│  Breakdown:                                                   │
│  Formatting   ████████████████████░░░░░  21/25               │
│  Keywords     █████████████████████░░░░  22/25               │
│  Experience   █████████████████████████  25/25               │
│  Education    ████████████████░░░░░░░░░  19/25               │
│                                                               │
│  ✅ Matched Keywords (12):                                    │
│  React, TypeScript, Next.js, Node.js, GraphQL, REST API,     │
│  CI/CD, Agile, team leadership, performance optimization     │
│                                                               │
│  ❌ Missing Keywords (4):                                     │
│  Kubernetes, Go, gRPC, system design                         │
│                                                               │
│  💡 Suggestions:                                              │
│  1. Add "system design" experience to your summary           │
│  2. Include Kubernetes/Docker skills if applicable            │
│  3. Quantify your team leadership achievements more          │
│  4. Add a "Publications" section if you have any             │
│                                                               │
│  [🤖 AI: Auto-optimize resume for this role — 5 credits]     │
│  [Re-analyze] [Try different job description]                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 15. Storefront Rendering

### 15.1 Portfolio Storefront (Server Component)

```typescript
// apps/web/storefront/app/[subdomain]/page.tsx

import { notFound } from 'next/navigation';
import { createServerClient } from '@/lib/supabase-server';

export const revalidate = 60; // ISR: revalidate every 60 seconds

export async function generateMetadata({ params }: { params: { subdomain: string } }) {
  const supabase = createServerClient();
  const { data: store } = await supabase
    .from('stores')
    .select('name, settings, subdomain')
    .eq('subdomain', params.subdomain)
    .eq('site_type', 'portfolio')
    .single();

  if (!store) return {};

  return {
    title: `${store.name} — Portfolio`,
    description: store.settings?.seo?.description || `${store.name}'s professional portfolio`,
    openGraph: {
      title: store.name,
      description: store.settings?.seo?.description,
      images: [store.settings?.seo?.ogImage || '/default-og.png'],
      type: 'website',
    },
    twitter: { card: 'summary_large_image' },
  };
}

export default async function PortfolioPage({ params }: { params: { subdomain: string } }) {
  const supabase = createServerClient();

  const { data: store } = await supabase
    .from('stores')
    .select('id, name, settings, subdomain, site_type')
    .eq('subdomain', params.subdomain)
    .single();

  if (!store || store.site_type !== 'portfolio') notFound();

  // Parallel data fetching
  const [projects, skills, testimonials] = await Promise.all([
    supabase.from('projects')
      .select('id, title, slug, short_description, cover_image, category, tags, is_featured')
      .eq('store_id', store.id).eq('status', 'published')
      .order('display_order'),
    supabase.from('skills')
      .select('id, name, category, proficiency, years_of_exp')
      .eq('store_id', store.id).eq('is_visible', true)
      .order('category').order('display_order'),
    supabase.from('testimonials')
      .select('id, author_name, author_title, author_company, author_avatar, content, rating')
      .eq('store_id', store.id).eq('status', 'approved')
      .order('display_order').limit(6),
  ]);

  const template = store.settings?.appearance?.template || 'developer';

  return (
    <PortfolioLayout template={template} store={store}>
      <HeroSection store={store} featuredProjects={projects.data?.filter(p => p.is_featured) || []} />
      <ProjectsGrid projects={projects.data || []} />
      <SkillsSection skills={skills.data || []} />
      {testimonials.data && testimonials.data.length > 0 && (
        <TestimonialsCarousel testimonials={testimonials.data} />
      )}
      <ContactSection storeId={store.id} config={store.settings?.contactForm} />
    </PortfolioLayout>
  );
}
```

### 15.2 Resume Storefront (Printable Page)

```typescript
// apps/web/storefront/app/[subdomain]/resume/[slug]/page.tsx

export default async function ResumePage({ params }: { params: { subdomain: string; slug: string } }) {
  const supabase = createServerClient();

  const { data: store } = await supabase
    .from('stores')
    .select('id, name, subdomain, settings')
    .eq('subdomain', params.subdomain)
    .single();

  if (!store) notFound();

  // Get resume version
  const { data: version } = await supabase
    .from('resume_versions')
    .select('*')
    .eq('store_id', store.id)
    .eq('public_slug', params.slug)
    .eq('is_public', true)
    .single();

  if (!version) notFound();

  // Increment view count
  await supabase.rpc('increment_view_count', { table_name: 'resume_versions', row_id: version.id });

  // Fetch full resume data
  const resumeData = await fetchResumeData(supabase, store.id);

  return (
    <>
      {/* Print-optimized CSS */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; }
          .no-print { display: none !important; }
          .resume-container { box-shadow: none !important; }
        }
      `}</style>

      {/* Toolbar (hidden in print) */}
      <div className="no-print fixed top-0 left-0 right-0 bg-white shadow z-50 flex items-center justify-between px-4 py-2">
        <span className="text-sm text-gray-600">{store.name}'s Resume</span>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-sm">🖨 Print</button>
          {version.pdf_url && <a href={version.pdf_url} className="btn-sm">📄 PDF</a>}
        </div>
      </div>

      <div className="resume-container mt-16 print:mt-0 max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none">
        <ResumeTemplate
          template={version.template}
          settings={version.settings}
          data={resumeData}
        />
      </div>
    </>
  );
}
```

### 15.3 JSON-LD for Portfolio

```typescript
// apps/web/storefront/components/portfolio/PortfolioJsonLd.tsx

export function PortfolioJsonLd({ store, projects }: { store: Store; projects: Project[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    mainEntity: {
      '@type': 'Person',
      name: store.settings?.resume_info?.name || store.name,
      jobTitle: store.settings?.resume_info?.title,
      email: store.settings?.resume_info?.email,
      url: `https://${store.subdomain}.letbuyy.store`,
      sameAs: [
        store.settings?.resume_info?.linkedin,
        store.settings?.resume_info?.github,
      ].filter(Boolean),
      knowsAbout: projects.flatMap(p => p.tags || []).filter((v, i, a) => a.indexOf(v) === i),
    },
    hasPart: projects.map(p => ({
      '@type': 'CreativeWork',
      name: p.title,
      description: p.short_description,
      url: `https://${store.subdomain}.letbuyy.store/projects/${p.slug}`,
      image: p.cover_image,
      dateCreated: p.completed_at,
    })),
  };

  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />;
}
```

---

## 16. Custom Domains & URLs

### 16.1 URL Structure

```
Default URLs:
├── Portfolio: https://{subdomain}.letbuyy.store
├── Project:   https://{subdomain}.letbuyy.store/projects/{slug}
├── Gallery:   https://{subdomain}.letbuyy.store/gallery
├── Contact:   https://{subdomain}.letbuyy.store/contact
├── Resume:    https://{subdomain}.letbuyy.store/resume/{version-slug}
└── Blog:      https://{subdomain}.letbuyy.store/blog

Custom Domain (Starter+ plan):
├── Portfolio: https://johndoe.com
├── Project:   https://johndoe.com/projects/{slug}
└── Resume:    https://johndoe.com/resume
```

### 16.2 Custom Domain Setup

```typescript
// workers/api/src/routes/settings/domains.ts

app.post('/v1/stores/:storeId/custom-domain', authMiddleware(), storeOwnerMiddleware(), async (c) => {
  const storeId = c.req.param('storeId');
  const { domain } = z.object({ domain: z.string().regex(/^[a-z0-9.-]+\.[a-z]{2,}$/) }).parse(await c.req.json());
  const supabase = createServiceClient(c.env);

  // 1. Plan check
  const { data: store } = await supabase.from('stores').select('plan').eq('id', storeId).single();
  if (store.plan === 'free') return c.json({ error: 'Custom domains require Starter+ plan' }, 403);

  // 2. Check domain isn't already in use
  const { data: existing } = await supabase.from('stores').select('id')
    .eq('custom_domain', domain).single();
  if (existing) return c.json({ error: 'Domain already in use' }, 409);

  // 3. Add domain to Cloudflare
  const cfResult = await addCloudflareCustomHostname(c.env, domain);

  // 4. Save to database
  await supabase.from('stores').update({
    custom_domain: domain,
    custom_domain_status: 'pending_verification',
    custom_domain_cf_id: cfResult.id,
  }).eq('id', storeId);

  return c.json({
    success: true,
    verificationRecords: cfResult.verificationRecords,
    instructions: [
      `Add a CNAME record: ${domain} → cname.letbuyy.store`,
      'Wait for DNS propagation (up to 24 hours)',
      'SSL certificate will be automatically provisioned',
    ],
  });
});
```

---

## 17. Analytics & Visitor Tracking

### 17.1 Analytics Schema

```sql
CREATE TABLE portfolio_analytics (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  
  -- Event
  event_type      TEXT NOT NULL,  -- page_view, project_view, form_submit, resume_download, skill_endorse
  event_target    TEXT,           -- project_id, version_id, etc.
  
  -- Visitor
  visitor_id      TEXT,           -- Anonymous cookie-based ID
  ip_country      TEXT,           -- GeoIP country code
  ip_city         TEXT,
  user_agent      TEXT,
  referer         TEXT,
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  
  -- Device
  device_type     TEXT,           -- desktop, mobile, tablet
  browser         TEXT,
  os              TEXT,
  
  -- Metadata
  metadata        JSONB DEFAULT '{}',
  
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_analytics_store ON portfolio_analytics(store_id, created_at DESC);
CREATE INDEX idx_analytics_event ON portfolio_analytics(store_id, event_type, created_at DESC);

-- Aggregated daily view (materialized)
CREATE MATERIALIZED VIEW portfolio_daily_stats AS
SELECT
  store_id,
  DATE(created_at) AS date,
  event_type,
  COUNT(*) AS count,
  COUNT(DISTINCT visitor_id) AS unique_visitors,
  COUNT(DISTINCT ip_country) AS countries
FROM portfolio_analytics
GROUP BY store_id, DATE(created_at), event_type;

CREATE UNIQUE INDEX idx_daily_stats ON portfolio_daily_stats(store_id, date, event_type);
```

### 17.2 Analytics Dashboard UI

```
┌──────────────────────────────────────────────────────────────┐
│  Portfolio Analytics          [Last 30 days ▼]  [Export CSV] │
│                                                               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐    │
│  │   1,247  │  │    892   │  │     34   │  │     12   │    │
│  │Page Views│  │ Unique   │  │ Contact  │  │ Resume   │    │
│  │  ↑23%    │  │Visitors  │  │  Forms   │  │Downloads │    │
│  │          │  │  ↑18%    │  │  ↑45%    │  │  ↑8%     │    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘    │
│                                                               │
│  Visitors Over Time                                          │
│  60│         ╭╮                                               │
│  50│    ╭╮  ╭╯│ ╭╮                                           │
│  40│╮  ╭╯│╭╯  ╰╯│╭─╮     ╭╮                                │
│  30│╰─╯  ╰╯     ╰╯ │  ╭─╯│                                 │
│  20│                 ╰──╯  ╰╮                                │
│  10│                        ╰──                               │
│    └─────────────────────────────                             │
│     1   5    10   15   20   25   30                          │
│                                                               │
│  Top Projects (by views):                                    │
│  1. E-Commerce Redesign — 342 views (27%)                    │
│  2. Mobile Banking App — 218 views (17%)                     │
│  3. Portfolio Template — 156 views (12%)                      │
│                                                               │
│  Traffic Sources:                                             │
│  Direct: 45% │ LinkedIn: 22% │ Google: 18% │ GitHub: 10%    │
│  Twitter: 3% │ Other: 2%                                     │
│                                                               │
│  Top Countries:                                               │
│  🇮🇳 India: 45% │ 🇺🇸 USA: 22% │ 🇬🇧 UK: 12% │ 🇩🇪 DE: 8%│
└──────────────────────────────────────────────────────────────┘
```

---

## 18. Performance & SEO

### 18.1 Caching Strategy

```
Cache Layer              TTL         Purpose
──────────────────────────────────────────────────────────
Cloudflare CDN           5 min       Static assets, images
Redis (Upstash)          60 sec      API responses, store data
ISR (Next.js)            60 sec      Page-level revalidation
R2 (Cloudflare)          ∞           Immutable media files
Browser Cache            1 hour      CSS, JS bundles
BlurHash                 ∞           Image placeholders (stored in DB)
```

### 18.2 Image Optimization Pipeline

```
Original Upload (JPG/PNG, up to 10MB)
      │
      ▼
Image Processing Worker
      │
      ├── WebP conversion (85% quality) → 60-70% smaller
      ├── Thumbnail (300×300, cover) → Gallery grid
      ├── Medium (800px wide) → Project card
      ├── Large (1400px wide) → Lightbox / detail
      ├── BlurHash generation → Placeholder during load
      └── EXIF stripping → Privacy protection
      │
      ▼
R2 Storage (portfolio-media bucket)
      │
      ▼
Cloudflare CDN (edge-cached, global)
```

### 18.3 Database Indexes

```sql
-- Critical read path indexes for portfolio storefront
CREATE INDEX idx_projects_storefront
  ON projects(store_id, status, display_order)
  WHERE status = 'published';

CREATE INDEX idx_skills_storefront
  ON skills(store_id, category, display_order)
  WHERE is_visible = true;

CREATE INDEX idx_testimonials_storefront
  ON testimonials(store_id, status, display_order)
  WHERE status = 'approved';

CREATE INDEX idx_gallery_storefront
  ON gallery_items(store_id, display_order)
  WHERE is_visible = true;

-- Analytics read path
CREATE INDEX idx_analytics_date_range
  ON portfolio_analytics(store_id, event_type, created_at DESC);
```

### 18.4 SEO Checklist

| SEO Element | Portfolio | Resume |
|---|---|---|
| `<title>` | `{Name} — {Title} Portfolio` | `{Name} — Resume` |
| `<meta description>` | AI-generated from bio + skills | AI-generated from summary |
| `<h1>` | Name on homepage | Name at top of resume |
| Open Graph | Cover image or avatar | Not applicable |
| Twitter Card | `summary_large_image` | Not applicable |
| JSON-LD | `ProfilePage` + `Person` + `CreativeWork` | `Person` + `Resume` |
| `sitemap.xml` | Auto-generated with all published projects | Resume page only |
| `robots.txt` | Allow all (published pages) | Configurable (public/private) |
| Canonical URL | Subdomain or custom domain | Version-specific URL |
| `alt` text | Required for all gallery images | Not applicable |
| Page speed | Target < 2s LCP via ISR + CDN | Minimal page, < 1s |

---

## 19. Testing Strategy

### 19.1 Unit Tests

```typescript
// __tests__/portfolio/projects.test.ts

import { describe, it, expect, vi } from 'vitest';
import { generateUniqueSlug, detectSpam, sanitizeCSS } from '@/lib/portfolio-utils';

describe('generateUniqueSlug', () => {
  it('creates slug from title', () => {
    expect(generateUniqueSlug('E-Commerce Platform Redesign')).toBe('e-commerce-platform-redesign');
  });

  it('handles special characters', () => {
    expect(generateUniqueSlug('React + TypeScript — Best Practices')).toBe('react-typescript-best-practices');
  });

  it('appends number for duplicates', async () => {
    const mockSupabase = { from: vi.fn().mockReturnThis(), select: vi.fn().mockResolvedValue({ data: [{ slug: 'my-project' }] }) };
    const slug = await generateUniqueSlug(mockSupabase, 'projects', 'store-1', 'My Project');
    expect(slug).toBe('my-project-2');
  });
});

describe('detectSpam', () => {
  it('flags messages with excessive links', () => {
    const score = detectSpam({ message: 'Buy cheap stuff at http://a.com http://b.com http://c.com http://d.com http://e.com' });
    expect(score).toBeGreaterThan(0.8);
  });

  it('passes legitimate messages', () => {
    const score = detectSpam({ message: 'Hi, I would like to discuss a web development project with you.' });
    expect(score).toBeLessThan(0.3);
  });
});

describe('sanitizeCSS', () => {
  it('allows valid CSS', () => {
    const result = sanitizeCSS('.hero { background: #333; color: white; }');
    expect(result.valid).toBe(true);
  });

  it('rejects CSS with JS expressions', () => {
    const result = sanitizeCSS('body { background: expression(alert("xss")); }');
    expect(result.valid).toBe(false);
  });

  it('rejects CSS with url() to external domains', () => {
    const result = sanitizeCSS('.img { background: url("https://evil.com/track.gif"); }');
    expect(result.valid).toBe(false);
  });
});
```

### 19.2 E2E Tests

```typescript
// e2e/portfolio.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Portfolio Builder', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/projects');
    await page.waitForLoadState('networkidle');
  });

  test('create, publish, and view project', async ({ page }) => {
    // Create project
    await page.click('text=+ New');
    await page.fill('[name="title"]', 'E2E Test Project');
    await page.fill('[name="shortDescription"]', 'A test project');
    await page.setInputFiles('[type="file"]', 'fixtures/test-image.jpg');
    await page.click('text=Save & Publish');

    // Verify in list
    await expect(page.locator('text=E2E Test Project')).toBeVisible();
    await expect(page.locator('[data-status="published"]')).toBeVisible();

    // View on storefront
    await page.goto('/projects/e2e-test-project');
    await expect(page.locator('h1')).toHaveText('E2E Test Project');
    await expect(page.locator('img[alt="E2E Test Project"]')).toBeVisible();
  });

  test('reorder projects via drag and drop', async ({ page }) => {
    const firstProject = page.locator('.project-item').first();
    const thirdProject = page.locator('.project-item').nth(2);

    // Drag first to third position
    await firstProject.dragTo(thirdProject);

    // Verify order changed
    await page.reload();
    const titles = await page.locator('.project-item .title').allTextContents();
    expect(titles[0]).not.toBe('E2E Test Project');
  });
});

test.describe('Resume Builder', () => {
  test('generate PDF and verify download', async ({ page }) => {
    await page.goto('/admin/export');

    await page.selectOption('[name="template"]', 'modern');
    await page.selectOption('[name="colorScheme"]', 'blue');
    await page.click('text=Generate PDF');

    // Wait for generation
    await expect(page.locator('text=PDF generated')).toBeVisible({ timeout: 30000 });

    // Download
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('text=Download PDF'),
    ]);

    expect(download.suggestedFilename()).toMatch(/resume.*\.pdf$/);
  });

  test('ATS scoring flow', async ({ page }) => {
    await page.goto('/admin/ats-score');
    await page.fill('[name="targetRole"]', 'Senior Frontend Developer');
    await page.fill('[name="jobDescription"]', 'Looking for React, TypeScript expert...');
    await page.click('text=Analyze ATS Score');

    await expect(page.locator('.ats-score')).toBeVisible({ timeout: 15000 });
    const score = await page.locator('.ats-score-value').textContent();
    expect(parseInt(score!)).toBeGreaterThan(0);
  });
});

test.describe('Contact Form', () => {
  test('submit form and verify notification', async ({ page }) => {
    await page.goto('/contact');
    await page.fill('[name="name"]', 'Test User');
    await page.fill('[name="email"]', 'test@example.com');
    await page.fill('[name="message"]', 'This is a test message');
    // hCaptcha bypass in test env
    await page.click('text=Send Message');
    await expect(page.locator('text=Message sent')).toBeVisible();
  });
});
```

---

## 20. Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 6.0 | Feb 14, 2026 | AI-Enhanced | Major expansion — 20 sections, TypeScript & SQL, full wireframes |
| 5.0 | Feb 14, 2026 | AI-Enhanced | Initial structured documentation |
| 4.0 | Feb 13, 2026 | Platform | Portfolio and resume basic structure |
| 3.0 | Feb 12, 2026 | Platform | Template system and PDF export |

---

> **Cross-references:**
> - [00_Overview.md](./00_Overview.md) — Platform overview and site type definitions
> - [01_Architecture.md](./01_Architecture.md) — Route structure, sidebar config, AI model assignments, storage buckets
> - [02_Authentication_and_Security.md](./02_Authentication_and_Security.md) — Auth middleware, RLS policies
> - [04_Admin_Dashboard.md](./04_Admin_Dashboard.md) — Admin UI patterns, sidebar navigation
> - [05_Ecommerce_Engine.md](./05_Ecommerce_Engine.md) — Shared patterns: media pipeline, analytics, notification events

---

> **Next:** [07 AI Features](./07_AI_Features.md) — Comprehensive AI capabilities across the platform

---

*[← Back to Index](./README.md)*
