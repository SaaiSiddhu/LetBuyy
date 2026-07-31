# LCIS Executive Summary
**LetBuyy Central Intelligence System — Forensic Audit Report**
*Date: 2026-06-19 | Auditor: Forensic Architecture Review*

---

## What LCIS Is

The LetBuyy Central Intelligence System (LCIS) is a **local, zero-dependency knowledge-graph intelligence platform** built directly over the LetBuyy commerce codebase. It is not a third-party tool, a SaaS product, or a cloud service. It is a purpose-built, in-repository system that answers architectural, operational, and intelligence questions about the LetBuyy platform without requiring a repository scan.

LCIS runs as a local HTTP server (`pnpm graph:ui` → `http://localhost:3333`) and exposes a rich REST API across 90+ endpoints organized into 13 intelligence layers. Its primary purpose is to make an AI agent — specifically Claude Code — capable of answering any question about the LetBuyy codebase without reading source files.

**One sentence definition:** LCIS is a queryable knowledge brain that converts a 52,246-node code graph + 414-table database schema + infrastructure topology into answerable intelligence about architecture, security, business, operations, and launch readiness.

---

## The Problem LCIS Solves

Before LCIS, every architectural question required an AI agent (or a human engineer) to:
- Search through thousands of source files
- Read multiple documentation files
- Correlate database migrations with API routes
- Connect infrastructure definitions with deployment targets
- Manually trace payment flows through code

This produced slow, unreliable, context-window-exhausting answers.

LCIS solves this by **pre-computing and indexing all relationships** so any question can be answered in a single HTTP query. The CLAUDE.md contains the explicit protocol: "query LCIS first, repo scan is the last resort."

**Secondary problem solved:** preventing AI agents from creating architecture drift. By making the right architectural answers instantly available via query (`/api/explain?node=payments`), agents no longer need to reverse-engineer architecture from code — reducing the chance of wiring the wrong system.

---

## Why LCIS Was Created

LCIS was created because:

1. **The codebase is large.** 52,246 code nodes, 66,761 edges, 8 runtimes, 22 business domains, 414 database tables, 156 database functions, 651 RLS policies — far too large for a context window.

2. **Architectural governance was failing.** The forensic audit of 2026-06-10 discovered that the prior `AGENTS.md` was auto-generated from a repository scan. This encoded repository drift as law, declaring rejected topologies and stale counts as canonical. LCIS was purpose-built to give agents accurate, hand-verified architectural answers instead.

3. **AI agents were the primary consumer.** Claude Code, Codex, and other agents were spending most of their context window reading files to answer structural questions. LCIS makes those answers pre-computed and instantly retrievable.

4. **Business intelligence was siloed.** No single place answered: "What breaks if payments fail? Which merchants are affected? What is the revenue at risk? What should be fixed next?" LCIS aggregates all these answers.

---

## Who Consumes LCIS

| Consumer | Usage Pattern |
|----------|--------------|
| **Claude Code (primary)** | API queries at `localhost:3333/api/*` instead of file searches |
| **Human architects** | Visual Atlas UI for graph exploration |
| **Human engineers** | `pnpm graph:intel blast "X"` CLI for impact analysis |
| **CI/CD system** | Pre-built JSON artifacts for validation |
| **On-call engineers** | Runbooks, incident timelines, root-cause API |
| **Product/Founder** | Investor mode, executive center, launch status |

---

## Business Value LCIS Creates

| Value | Evidence |
|-------|---------|
| **Context window savings** | Replaces 50+ file reads with a single `/api/explain?node=orders` call |
| **Drift prevention** | Agents get correct architecture answers without guessing |
| **Blast-radius analysis** | `pnpm graph:intel blast "getSupabaseAdmin"` → 115 files affected |
| **Launch readiness** | `/api/launch-command-center` produces GO/NO-GO with evidence |
| **Incident response** | `/api/runbook?domain=payments` → full recovery runbook, instantly |
| **Onboarding acceleration** | Developer mode: "Understand LetBuyy in 30 minutes" |
| **Security audit** | `/api/security-intelligence` → 11 controls, cross-tenant candidates |

---

## Current Status

| Dimension | Status |
|-----------|--------|
| Intelligence layers | 13 (V1 through OMEGA + Genesis + INFINITY + X) |
| API endpoints | 90+ |
| Code graph nodes | 52,246 |
| Database entities indexed | 414 tables, 156 RPCs, 651 policies, 395 triggers, 826 indexes |
| Business domains | 22 |
| Live data connections | 0 (all structural; live = NOT CONNECTED) |
| Intelligence engines | 83 .mjs files in `tools/graph-server/` |
| Output artifacts | 50+ pre-built JSON files in `graphify-out/` |
| Certification level | OMEGA + Genesis + INFINITY + X |

---

## Critical Limitation: The "NOT CONNECTED" Honesty Contract

LCIS has a built-in honesty contract. **Every live value (revenue amounts, merchant counts, customer counts, error rates, latency, queue depth) is explicitly marked `NOT CONNECTED`** with the exact environment variable needed to wire it. LCIS never fabricates a live metric. It provides structural truth (from the repository) and marks operational truth (from Supabase/Cloudflare/Vercel) as requiring wiring.

This is the most important property of LCIS. It makes it trustworthy: you will never see a fake number claiming to be live data.

---

## The Core Insight

LCIS is not documentation. It is not a knowledge base in the traditional sense. It is a **live computation over the repository** — a set of engines that read the codebase, database schema, and infrastructure definitions at build time, compute relationships and intelligence, and serve them via a REST API.

The repository IS the source of truth. LCIS is the indexing and query layer over it.
