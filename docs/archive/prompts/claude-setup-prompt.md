# 🤖 Agent Prompt — Generate Production-Grade `.claude/` Folder

> **What this is:** A comprehensive prompt you give to your AI coding agent (Claude Code, Cursor, Windsurf, etc.) at the ROOT of any SaaS project.
> It will analyze your entire codebase, research latest best practices, and generate a complete `.claude/` context system tailored to YOUR project.
>
> **How to use:** Copy this entire file content → paste into your agent conversation → let it run.
>
> **Created by:** Saai Siddharth (PixlNova) — battle-tested on a production SaaS monorepo.
> **Last updated:** April 2026

---

## 📋 THE PROMPT — Copy Everything Below This Line

---

You are a senior AI engineering consultant specializing in Claude Code configuration and AI-augmented development workflows. Your task is to create a **complete, production-grade `.claude/` folder** for this project that will serve as the "permanent brain" for all future AI coding sessions.

## 🔬 PHASE 1: RESEARCH (Do this FIRST — before creating any files)

### 1A. Codebase Deep Analysis

Analyze the ENTIRE codebase systematically. Read every configuration file, understand every package, trace every architectural pattern. You must understand:

```
PROJECT IDENTITY
□ What is this project? (SaaS, marketplace, dashboard, API, mobile app, etc.)
□ Who are the users? (B2B, B2C, internal, developer-facing?)
□ What problem does it solve?
□ How many apps/services are in the repo?
□ Is it a monorepo or single app?

TECH STACK — Map every technology
□ Language(s) and versions
□ Framework(s) and versions (Next.js, Nuxt, SvelteKit, Remix, Express, FastAPI, etc.)
□ Styling (Tailwind, CSS Modules, styled-components, etc.)
□ Database(s) (PostgreSQL, MySQL, MongoDB, SQLite, etc.)
□ ORM/Query builder (Prisma, Drizzle, TypeORM, Sequelize, Knex, raw SQL, etc.)
□ Authentication system (custom JWT, NextAuth, Clerk, Supabase Auth, Firebase Auth, etc.)
□ Hosting/Infrastructure (Vercel, AWS, GCP, Cloudflare, Railway, Fly.io, etc.)
□ API architecture (REST, GraphQL, tRPC, gRPC, WebSockets, etc.)
□ Cache layer (Redis, Memcached, Node-cache, Vercel KV, etc.)
□ Message queue / Background jobs (BullMQ, RabbitMQ, SQS, Upstash QStash, etc.)
□ Email service (Resend, SendGrid, Postmark, SES, etc.)
□ Payment gateway(s) (Stripe, Razorpay, PayPal, LemonSqueezy, etc.)
□ File storage (S3, R2, Supabase Storage, Cloudinary, etc.)
□ Monitoring (Sentry, DataDog, Axiom, Logtail, New Relic, etc.)
□ Testing frameworks (Jest, Vitest, Mocha, Playwright, Cypress, etc.)
□ Validation library (Zod, Yup, Joi, AJK, class-validator, etc.)
□ Build tools (Webpack, Vite, Turbopack, esbuild, Rollup, etc.)
□ Monorepo tools (Turborepo, Nx, Lerna, pnpm workspaces, etc.)
□ Package manager (npm, yarn, pnpm, bun, etc.)
□ CI/CD (GitHub Actions, GitLab CI, CircleCI, etc.)
□ Version control (Git, branch strategy, release process)

ARCHITECTURE PATTERNS
□ Folder structure (feature-based, layer-based, domain-driven, etc.)
□ State management (Redux, Zustand, Jotai, Context, Pinia, etc.)
□ Component patterns (atomic design, compound components, etc.)
□ API layer patterns (service layer, repository pattern, middleware chain, etc.)
□ Error handling strategy
□ Logging strategy
□ Configuration management (.env, config files, etc.)

EXISTING CONVENTIONS (detect from code — don't assume)
□ Naming conventions (camelCase, snake_case, PascalCase patterns)
□ File naming conventions (kebab-case.ts vs PascalCase.tsx vs camelCase.ts)
□ Import style (absolute vs relative, barrel files, path aliases)
□ Comment style and documentation patterns
□ Git commit message format (Conventional Commits? custom?)
□ PR/branch naming conventions
□ Code organization within files (exports, types, functions ordering)
```

### 1B. Web Research — Latest Claude Code Best Practices

Research the following topics to ensure you're using the latest patterns:

```
RESEARCH TOPICS
□ Claude Code CLAUDE.md best practices 2025-2026
□ Claude Code skills vs commands — latest unified approach
□ SKILL.md YAML frontmatter fields and auto-invocation
□ Claude Code settings.json configuration options
□ Claude Code subagents and agents/ directory
□ Memory patterns for AI coding agents (lessons.md, decisions.md)
□ Architecture Decision Records (ADR) for AI-augmented development
□ .cursorrules and AGENTS.md cross-compatibility patterns
□ Context window optimization strategies for large codebases
```

### 1C. Competitive Analysis

Look at how top open-source projects structure their AI agent context:
- How do production SaaS codebases organize `.claude/` or `.cursor/`?
- What skill categories are most impactful?
- What gets the best auto-invocation trigger accuracy?

---

## 📁 PHASE 2: GENERATE THE COMPLETE `.claude/` FOLDER

After research is complete, generate ALL of the following files. Every file must be tailored to THIS specific project — no generic templates.

### File Tree to Generate

```
.claude/
├── CLAUDE.md              ← The main project brain (500-1000 lines)
├── settings.json          ← Permissions and tool access
└── skills/                ← Auto-invokable specialized skills
    ├── [skill-1]/SKILL.md
    ├── [skill-2]/SKILL.md
    ├── [skill-3]/SKILL.md
    └── ... (20-40+ skills based on project needs)

memory/
├── lessons.md             ← Mistake patterns log
└── decisions.md           ← Architecture decisions log (ADR)

tasks/
├── todo.md                ← Active task tracker
├── completed.md           ← Completed task archive
└── backlog.md             ← Future work backlog
```

---

## 📄 PHASE 2A: CLAUDE.md — The Project Brain

This is the single most important file. It must contain:

### Structure Template (adapt to your project)

```markdown
# CLAUDE.md — [Project Name]

> You are [Agent Name] — a senior full-stack engineer building [Project Name],
> a production-grade [project type].
> Read this file FULLY at the start of EVERY session before writing code.
> Last updated: [Month Year] — v1.0

---

## 📌 What Is [Project Name]?
[2-3 sentence description. Include: what it does, who it's for, business model]

[Table of apps/services with domains and purposes]

---

## 📂 Session Startup — Read in This Exact Order
1. memory/lessons.md    → Patterns from past mistakes
2. tasks/todo.md        → What's in progress, what's next
3. [docs reference]     → Relevant sections only
4. .env.example         → Know what env vars exist

**ALWAYS check tasks/todo.md first. Never re-implement what's done.**

[Section lookup table mapping task types to doc sections]

---

## 🏗️ Tech Stack (Memorize This)
[Complete tech stack in code block format — one line per technology]

---

## 📁 Project Structure
[Full folder tree with inline comments explaining each directory]

---

## ⚡ Workflow Rules
### 1. Plan Mode First
### 2. Subagent Strategy
### 3. Self-Improvement Loop
### 4. Verification Before Done
### 5. Demand Elegance
### 6. Autonomous Bug Fixing
### 7. Context Window Discipline

---

## 🏛️ Architecture Principles
[Clean Architecture layers diagram specific to your project]
[Core principles — DOs and DON'Ts for code organization]

---

## 🗄️ Database Rules
[Schema requirements — what every table must have]
[Query rules — pagination, N+1 prevention, etc.]
[Connection rules — pooling, environments]
[Migration rules — UP/DOWN, naming, execution]
[Data integrity — optimistic locking, soft deletes, etc.]

---

## 🔐 Auth Architecture
[Full auth flow diagram — login → token → refresh → logout]
[Storage rules — HttpOnly cookies, no localStorage]
[Session validation approach]
[RBAC role definitions table]
[Permission checking rules]

---

## 🌐 API Architecture
[What lives where — which endpoints in which service]
[Middleware stack — order matters]
[Response shape — success and error formats]
[Versioning, pagination, rate limiting rules]

---

## 🛡️ Security Standards
[HTTP security headers]
[Input validation rules]
[Attack mitigation strategies]
[Encryption standards]
[Webhook verification]

---

## 💳 Payment Flow (if applicable)
[Step-by-step flow for each payment gateway]
[Idempotency rules]
[Refund flow]

---

## 🎨 UI/UX Standards
[Design system reference]
[Component quality bar — states every component needs]
[Loading/skeleton rules]
[Animation standards]
[Color system and token usage]

---

## 📧 Email Standards (if applicable)
[Email triggers and templates]
[Queue-based sending rules]
[Bounce/complaint handling]

---

## ⚡ Performance Standards
[Core Web Vitals targets]
[Server Component optimization rules]
[Caching strategy hierarchy]
[Database performance rules]

---

## 🚀 Deployment Standards
[Environment definitions — dev, staging, production]
[Deploy pipeline steps]
[Environment variable management]
[Rollback strategy]

---

## 🧪 Testing Standards
[Framework choice and coverage requirements]
[What must be tested — no exceptions list]
[Running test commands]

---

## 📊 Monitoring & Observability
[Logging format and strategy]
[Error tracking configuration]
[Health check endpoint specification]

---

## 📝 Task Management Protocol
[Step-by-step: plan → verify → track → explain → capture → commit]

---

## 🚫 Hard Rules — NEVER Break These
[Organized by category: Auth, Database, Security, Code Quality, UI/UX, etc.]
[Use ✗ NEVER format for maximum clarity]

---

## ✅ Always Do
[Organized by category: Architecture, Performance, Security, Payments, UI, Process]
[Use ✓ Always format]

---

## 📚 Documentation Hierarchy
[Source of truth chain: CLAUDE.md → docs → tasks → memory → .env.example]
```

### Key Principles for CLAUDE.md
1. **Be specific, not generic** — Reference YOUR actual file paths, YOUR actual tools, YOUR actual patterns
2. **Use code blocks** — Agents parse code blocks more reliably than prose
3. **Include examples** — Show the actual code pattern, not just describe it
4. **Use tables** — For role definitions, env mappings, section lookups
5. **Organize by concern** — Auth, DB, API, UI, Security are all separate sections
6. **Make rules actionable** — "NEVER use X — always use Y instead" not just "avoid X"

---

## ⚙️ PHASE 2B: settings.json

Generate a permissions file tailored to the project's toolchain:

```json
{
  "permissions": {
    "allow": [
      "Bash([pnpm|npm|yarn|bun] *)",
      "Bash(npx *)",
      "Bash(git *)",
      "Bash(ls *)",
      "Bash(cat *)",
      "Bash(find *)",
      "Bash(grep *)",
      "Bash(head *)",
      "Bash(tail *)",
      "Bash(wc *)",
      "Bash([project-specific-cli] *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(rm -r /)*",
      "Bash(drop *)",
      "Bash(DROP *)",
      "Bash(DELETE FROM *)",
      "Bash(TRUNCATE *)",
      "Bash(chmod 777 *)",
      "Bash(curl * | bash)",
      "Bash(wget * | bash)",
      "Bash(eval *)"
    ]
  }
}
```

Replace `[pnpm|npm|yarn|bun]` with the actual package manager and `[project-specific-cli]` with actual tools (prisma, wrangler, turbo, drizzle-kit, etc.)

---

## 🧠 PHASE 2C: Skills — The Auto-Invokable Specialists

### Skill Architecture Rules

1. **One skill = one concern** — Never create a "do everything" skill
2. **Keep SKILL.md under 500 lines** — Put reference docs in supporting files
3. **Description is king** — Claude auto-invokes based on the `description` field
4. **Include trigger keywords** — List specific words that should activate the skill
5. **Show the pattern** — Include code templates, not just rules

### SKILL.md Template

```markdown
---
name: [skill-name]
description: [What this skill does]. Auto-invoke when [trigger conditions]. Use when user mentions [keyword1, keyword2, keyword3].
command: /[skill-name]
---

You are the [role description] for [Project Name]. Follow these rules:

## [Section 1 — Core Pattern]
[Code template or step-by-step flow]

## [Section 2 — Configuration]
[Specific settings, schema, or config]

## [Section 3 — Rules]
[DOs and DON'Ts specific to this skill]

## Output Format
[What the agent should produce when this skill is invoked]
```

### Skill Categories to Generate

Generate skills from EVERY category applicable to your project:

```
── 🗄️ DATABASE ──────────────────
orm-expert         → ORM patterns, queries, relations, migrations, seeding
migration          → Schema change workflow (UP/DOWN, naming, execution)
[db-specific]      → Database-specific patterns (Supabase RLS, PlanetScale, etc.)

── 🔐 AUTH & SECURITY ──────────
auth               → Auth flow, token management, session handling
rbac               → Role-based access control patterns
security-audit     → Security checklist and vulnerability scanning

── 🌐 API ──────────────────────
api-design         → Endpoint design, response shapes, versioning
[framework]        → Framework-specific patterns (Hono, Express, FastAPI, etc.)
validation         → Input/output validation patterns (Zod, Yup, etc.)
error-handling     → Error taxonomy, error responses, error boundaries
webhook-handler    → Webhook verification, idempotency, processing

── 💳 PAYMENTS ──────────────────
[gateway-1]        → Primary payment gateway flow (Stripe, Razorpay, etc.)
[gateway-2]        → Secondary payment gateway (if applicable)

── 🎨 FRONTEND ─────────────────
component          → Component creation patterns and standards
[ui-framework]     → Framework-specific patterns (Next.js, Nuxt, SvelteKit, etc.)
skeleton-states    → Loading skeletons, empty states, error boundaries
[admin/dashboard]  → Admin panel patterns (if applicable)

── ⚡ PERFORMANCE ──────────────
cache              → Caching strategy (Redis, CDN, ISR, SWR, etc.)
background-jobs    → Job queue, scheduled tasks, async processing

── 📧 COMMUNICATION ────────────
email-template     → Email template creation and sending
[notifications]    → Push notifications, in-app notifications (if applicable)

── 🏗️ INFRASTRUCTURE ──────────
[deploy-platform]  → Deployment platform patterns (Vercel, AWS, etc.)
ci-cd              → CI/CD pipeline configuration
[cloud-storage]    → File storage patterns (S3, R2, etc.)
[monorepo-tool]    → Monorepo management (Turborepo, Nx, etc.)

── 📊 OBSERVABILITY ────────────
observability      → Logging, metrics, tracing, alerts
audit-log          → Audit trail for user/admin actions

── 🧪 TESTING ──────────────────
[test-framework]   → Unit and integration test patterns
[e2e-framework]    → End-to-end test patterns (Playwright, Cypress, etc.)

── 🔄 WORKFLOW ─────────────────
review             → Code review checklist and PR standards
fix                → Bug fixing workflow
phase              → Implementation phase planning
audit              → Full codebase audit workflow
deploy-check       → Pre-deployment checklist

── 🔧 PROJECT-SPECIFIC ─────────
[feature-1]        → Project-specific feature patterns
[feature-2]        → Project-specific domain logic
[integration-1]    → Third-party integration patterns
```

### Critical: Description Field Examples (for auto-invocation)

```yaml
# ✅ GOOD — Specific trigger keywords
description: Prisma ORM expert. Auto-invoke when writing database queries, creating migrations, defining schema relations, or seeding data. Use when user mentions Prisma, schema, migration, model, relation, database query.

# ✅ GOOD — Multiple trigger scenarios
description: Admin panel UI expert. Auto-invoke when building admin pages, tables, dashboards, management UIs, or data grids. Use when user mentions admin panel, dashboard, management page, data table, admin component.

# ❌ BAD — Too vague
description: Helps with database stuff.

# ❌ BAD — No trigger keywords
description: A skill for managing data.
```

---

## 📝 PHASE 2D: Memory Files

### memory/lessons.md

```markdown
# Lessons Learned — [Agent Name]

> Read this at the start of EVERY session before touching code.
> Add a new entry after EVERY correction from [your name].

## Format
### [Date] — [Short Title]
**What happened:** ...
**Root cause:** ...
**Rule going forward:** ...

---

## Entries

### [Today's Date] — Initial Setup
**What happened:** .claude/ folder created with comprehensive project context.
**Root cause:** First-time setup — no prior context existed.
**Rule going forward:** After every stack decision or tool addition, update CLAUDE.md the same day.
```

### memory/decisions.md

```markdown
# Architecture Decisions — [Project Name]

> Log every significant architecture decision here with the reason.
> This prevents the agent from second-guessing or reversing past decisions.

## Format
### [Date] — [Decision Title]
**Decision:** ...
**Reason:** ...
**Alternatives considered:** ...
**Do not revisit unless:** ...

---

## Decisions

[Pre-populate with decisions detected from the codebase:
- Why was this framework chosen?
- Why this database?
- Why this auth approach?
- Why this hosting platform?
- Why this folder structure?
etc.]
```

---

## 📋 PHASE 2E: Task Files

### tasks/todo.md

```markdown
# Active Tasks — [Project Name]

> Updated by agent after every task completion.
> Check this FIRST at session start — never re-implement what's done.

## In Progress
- [ ] [Items detected from recent git history or WIP branches]

## Up Next
- [ ] [Items from README, issues, or TODO comments in code]

## Blocked
[Nothing yet]
```

### tasks/completed.md

```markdown
# Completed Tasks

> Archive of finished work. Never delete entries.

## [Month Year]
[Empty — will be populated as work completes]
```

### tasks/backlog.md

```markdown
# Backlog — Future Work

> Ideas and future improvements. Not prioritized.
> Move items to todo.md when ready to start.

## Feature Ideas
- [ ] [Detected from code TODOs, README, issues]

## Technical Debt
- [ ] [Detected from code smells, deprecated patterns, missing tests]

## Performance
- [ ] [Detected from potential bottlenecks]
```

---

## ✅ PHASE 3: VALIDATION CHECKLIST

After generating all files, verify:

```
CLAUDE.md Checklist
□ Project identity is clear in first 10 lines
□ Tech stack is complete and accurate (verified against package.json)
□ Folder structure matches actual project (verified with find)
□ All file paths referenced actually exist
□ Architecture principles match actual code patterns (not aspirational)
□ Database rules match actual schema conventions
□ Auth flow matches actual implementation
□ API patterns match actual endpoint design
□ Every "NEVER" rule is actually relevant to this project
□ Every "ALWAYS" rule is actually followed in existing code
□ Session startup order references actual files that exist

settings.json Checklist
□ All CLI tools used in the project are in the allow list
□ Package manager matches actual project (npm/yarn/pnpm/bun)
□ Destructive operations are in the deny list
□ No overly permissive rules (like "Bash(*)")

Skills Checklist
□ Every skill has a specific, trigger-keyword-rich description
□ Every skill body is under 500 lines
□ Every skill references actual project patterns, not generic advice
□ Every skill includes code templates using actual project conventions
□ No two skills overlap significantly in scope
□ All critical project domains have a corresponding skill
□ Command names are kebab-case and descriptive

Memory Files Checklist
□ lessons.md has the initial entry
□ decisions.md has at least 3-5 pre-populated decisions from codebase analysis
□ Both files have clear format templates for future entries

Task Files Checklist
□ todo.md has items detected from actual project state
□ backlog.md has items from code analysis (TODOs, technical debt)
□ completed.md exists as empty archive
```

---

## 🚨 CRITICAL RULES FOR THE AGENT

1. **NEVER generate generic content** — Every line must reference THIS specific project's actual files, tools, and patterns
2. **NEVER assume the tech stack** — Read package.json, requirements.txt, go.mod, etc. and VERIFY
3. **NEVER invent architecture** — Describe what EXISTS in the code, not what should exist
4. **NEVER skip the research phase** — Codebase analysis MUST happen before file generation
5. **Always verify file paths** — Every path referenced in CLAUDE.md must actually exist
6. **Always detect conventions** — Don't impose conventions, detect what's already used
7. **Quality over quantity for skills** — 20 excellent skills beats 50 mediocre ones
8. **Skills must be project-specific** — Generic "how to write TypeScript" skills are worthless

---

## 🎯 SUCCESS CRITERIA

The generated `.claude/` folder is successful if:

1. A new developer (or AI agent) with ZERO context about the project can read CLAUDE.md and understand:
   - What the project is and who it's for
   - The complete tech stack
   - Where to find everything in the codebase
   - Every important convention and pattern
   - What they should NEVER do
   - What they should ALWAYS do

2. The skills auto-invoke correctly — when working on database tasks, the DB skill loads; when working on auth, the auth skill loads; etc.

3. The memory files provide a living record that improves agent performance over time.

4. The task files keep work organized and prevent re-implementation of completed features.

---

*— End of agent prompt. Drop this into the root of your project. Let the agent cook. 🚀*
