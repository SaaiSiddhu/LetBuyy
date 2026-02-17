# LetBuyy Platform — AI Features

> **Doc 07 of 17** | AI Architecture, Model Pricing, Credit System, Prompt Engineering, Streaming, Content Moderation & AI Studio
>
> **Version:** 7.0 | **Date:** February 14, 2026
>
> **Prev:** [06 Portfolio & Resume](./06_Portfolio_and_Resume.md) | **Next:** [08 Database Schema](./08_Database_Schema.md)

---

## Table of Contents

1. [AI Architecture Overview](#1-ai-architecture-overview)
2. [Model Specifications & Real Pricing](#2-model-specifications--real-pricing)
3. [Task-to-Model Routing](#3-task-to-model-routing)
4. [Provider Abstraction Layer](#4-provider-abstraction-layer)
5. [Credit System & Token Economics](#5-credit-system--token-economics)
6. [Redis Session & Token Monitoring](#6-redis-session--token-monitoring)
7. [Rate Limiting Architecture](#7-rate-limiting-architecture)
8. [AI Gateway Implementation](#8-ai-gateway-implementation)
9. [Prompt Engineering & Templates](#9-prompt-engineering--templates)
10. [Streaming Responses (SSE)](#10-streaming-responses-sse)
11. [Response Caching Strategy](#11-response-caching-strategy)
12. [E-commerce AI Features](#12-e-commerce-ai-features)
13. [Portfolio & Resume AI](#13-portfolio--resume-ai)
14. [Landing Page & Blog AI](#14-landing-page--blog-ai)
15. [Content Moderation Pipeline](#15-content-moderation-pipeline)
16. [Admin AI Tools](#16-admin-ai-tools)
17. [Super-Admin AI Tools](#17-super-admin-ai-tools)
18. [AI Studio Interface](#18-ai-studio-interface)
19. [Database Schema (AI)](#19-database-schema-ai)
20. [API Routes (AI)](#20-api-routes-ai)
21. [Testing Strategy](#21-testing-strategy)
22. [Cost Analysis & Projections](#22-cost-analysis--projections)
23. [Document History](#23-document-history)

---

## 1. AI Architecture Overview

### 1.1 System Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           AI SERVICE LAYER                                    │
│                                                                               │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │                     AI GATEWAY (Cloudflare Worker)                        ││
│  │                                                                           ││
│  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐                ││
│  │  │ REQUEST       │  │ REDIS         │  │ MODEL         │                ││
│  │  │ VALIDATOR     │  │ MONITOR       │  │ ROUTER        │                ││
│  │  │               │  │               │  │               │                ││
│  │  │ • Auth check  │  │ • Token count │  │ • Task → Model│                ││
│  │  │ • Plan check  │  │ • Rate check  │  │ • Fallback    │                ││
│  │  │ • Input size  │  │ • Credit check│  │ • Retry logic │                ││
│  │  │ • Model access│  │ • Session     │  │ • Load balance│                ││
│  │  └───────────────┘  └───────────────┘  └───────────────┘                ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                    │                                          │
│  ┌─────────────────────────────────▼────────────────────────────────────────┐│
│  │              PROVIDER ABSTRACTION LAYER (Multi-Model)                     ││
│  │                                                                           ││
│  │  ┌──────────────────┐  ┌──────────────────┐                              ││
│  │  │  GOOGLE AI       │  │  ANTHROPIC        │                              ││
│  │  │                  │  │                    │                              ││
│  │  │  Gemini 3 Flash  │  │  Claude Sonnet 4.5 │                              ││
│  │  │  $0.50 / $3.00   │  │  $3.00 / $15.00    │                              ││
│  │  │  per 1M tokens   │  │  per 1M tokens     │                              ││
│  │  │                  │  │                    │                              ││
│  │  │  Gemini 3 Pro  │  │  Claude Opus 4.6   │                              ││
│  │  │  $1.25 / $10.00  │  │  $5.00 / $25.00    │                              ││
│  │  │  per 1M tokens   │  │  per 1M tokens     │                              ││
│  │  └──────────────────┘  └──────────────────┘                              ││
│  └──────────────────────────────────────────────────────────────────────────┘│
│                                    │                                          │
│  ┌─────────────────────────────────▼────────────────────────────────────────┐│
│  │                        REDIS MONITORING LAYER                             ││
│  │                                                                           ││
│  │  Token Counters │ Rate Limiters │ Session State │ Credit Ledger │ Cache  ││
│  └──────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

| Principle | Implementation | Benefit |
|---|---|---|
| **Multi-model** | 4 models auto-routed by task complexity and plan tier | Optimal cost/quality tradeoff |
| **Token-aware billing** | Credits deducted based on actual tokens consumed per model | Fair, transparent pricing |
| **Redis-enforced** | All limits (rate, tokens, credits, sessions) checked via Redis before any API call | Sub-millisecond enforcement |
| **Cache-first** | Identical requests served from Redis cache to reduce cost | 35-40% cache hit rate target |
| **Graceful fallback** | If primary model is rate-limited or fails, fallback to secondary | 99.9% effective availability |
| **Streaming-native** | Long-form content streamed via SSE for real-time output | Better UX, perceived speed |
| **Audit trail** | Every AI call logged with model, tokens, latency, cost | Full cost visibility |
| **Prompt isolation** | Store context injected into every prompt for personalization | Relevant, targeted output |

### 1.3 Request Lifecycle

```
Client (Admin UI / AI Studio)
    │
    ▼
┌─ API Worker (/v1/ai/*) ─────────────────────────────────────────────────┐
│  1. Auth middleware → verify JWT, extract store_id                        │
│  2. Zod validation → validate task, input, options                       │
│  3. Plan gate → check model access for plan tier                         │
│  4. Redis pipeline (atomic):                                              │
│     a. Credit check → balance ≥ creditCost?                              │
│     b. Rate limit → sliding window RPM check                             │
│     c. Token budget → estimated TPM check                                │
│     d. Concurrency → active_requests < plan_max?                         │
│  5. Cache check → SHA-256 hash of (task + input + model)                 │
│     └── HIT → return cached response, skip provider call                 │
│  6. Prompt assembly → inject store context + task template               │
│  7. Provider call → primary model (with timeout)                         │
│     └── FAIL → fallback model → FAIL → refund + 503                     │
│  8. Post-call Redis update (atomic):                                      │
│     a. Debit credits                                                      │
│     b. Record token usage                                                 │
│     c. Decrement active_requests                                          │
│     d. Cache response (if cacheable)                                      │
│     e. Push to usage log                                                  │
│  9. Supabase insert → ai_usage row for permanent audit                   │
│  10. Return response (JSON or SSE stream)                                │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Model Specifications & Real Pricing

> **Pricing sourced from official provider pages as of February 2026.**

### 2.1 Google AI — Gemini Models

#### Gemini 3 Flash

| Specification | Value |
|---|---|
| **Provider** | Google AI |
| **Input Price** | **$0.50** per 1M tokens |
| **Output Price** | **$3.00** per 1M tokens |
| **Audio Input** | $1.00 per 1M tokens |
| **Context Window** | 1,000,000 tokens |
| **Max Output Tokens** | 65,536 |
| **Best For** | Fast, high-volume tasks (descriptions, SEO, moderation) |
| **Batch Discount** | 50% off via Batch API |
| **Context Cache** | $0.05 per 1M cached tokens |

**Rate Limits (Paid Tier 1):**

| Metric | Limit |
|---|---|
| Requests/min (RPM) | 300 |
| Tokens/min (TPM) | 1,000,000 |
| Requests/day (RPD) | 10,000 |

---

#### Gemini 3 Pro

| Specification | Value |
|---|---|
| **Provider** | Google AI |
| **Input Price (≤200K context)** | **$1.25** per 1M tokens |
| **Output Price (≤200K context)** | **$10.00** per 1M tokens |
| **Input Price (>200K context)** | $2.50 per 1M tokens |
| **Output Price (>200K context)** | $15.00 per 1M tokens |
| **Context Window** | 1,000,000 tokens |
| **Max Output Tokens** | 65,536 |
| **Best For** | Complex reasoning (analytics, pricing, forecasting) |
| **Batch Discount** | 50% off via Batch API |
| **Context Cache** | $0.31 per 1M cached tokens |

**Rate Limits (Paid Tier 1):**

| Metric | Limit |
|---|---|
| Requests/min (RPM) | 150 |
| Tokens/min (TPM) | 1,000,000 |
| Requests/day (RPD) | 1,500 |

---

### 2.2 Anthropic — Claude Models

#### Claude Sonnet 4.5

| Specification | Value |
|---|---|
| **Provider** | Anthropic |
| **Input Price** | **$3.00** per 1M tokens |
| **Output Price** | **$15.00** per 1M tokens |
| **Input Price (>200K context)** | $6.00 per 1M tokens |
| **Output Price (>200K context)** | $22.50 per 1M tokens |
| **Context Window** | 200,000 tokens (1M beta for Tier 4) |
| **Max Output Tokens** | 8,192 |
| **Best For** | Creative writing (resumes, landing copy, long-form) |
| **Batch Discount** | 50% off via Batch API |
| **Prompt Caching** | Up to 90% savings on repeated inputs |

**Rate Limits (Tier 1 — prepaid):**

| Metric | Limit |
|---|---|
| Requests/min (RPM) | 50 |
| Input tokens/min (ITPM) | 80,000 |
| Output tokens/min (OTPM) | 16,000 |

---

#### Claude Opus 4.6

| Specification | Value |
|---|---|
| **Provider** | Anthropic |
| **Input Price** | **$5.00** per 1M tokens |
| **Output Price** | **$25.00** per 1M tokens |
| **Input Price (>200K context)** | $10.00 per 1M tokens |
| **Output Price (>200K context)** | $37.50 per 1M tokens |
| **Context Window** | 200,000 tokens (1M beta for Tier 4) |
| **Max Output Tokens** | 8,192 |
| **Best For** | Premium tasks (full content audit, strategic analysis) |
| **Batch Discount** | 50% off via Batch API |
| **Prompt Caching** | Up to 90% savings on repeated inputs |

**Rate Limits (Tier 1 — prepaid):**

| Metric | Limit |
|---|---|
| Requests/min (RPM) | 30 |
| Input tokens/min (ITPM) | 40,000 |
| Output tokens/min (OTPM) | 8,000 |

---

### 2.3 Pricing Comparison & Benchmark

| Model | Input $/1M | Output $/1M | Relative Cost | Speed | Quality | Best Use Case |
|---|---|---|---|---|---|---|
| **Gemini 3 Flash** | $0.50 | $3.00 | 1× (baseline) | ⚡⚡⚡ | ★★★☆ | Bulk tasks, moderation, alt text |
| **Gemini 3 Pro** | $1.25 | $10.00 | ~3× | ⚡⚡ | ★★★★ | Data analysis, forecasting, ATS |
| **Claude Sonnet 4.5** | $3.00 | $15.00 | ~5× | ⚡⚡ | ★★★★½ | Creative writing, resume, copy |
| **Claude Opus 4.6** | $5.00 | $25.00 | ~8× | ⚡ | ★★★★★ | Deep analysis, full audits |

### 2.4 Model Selection Decision Matrix

```
                 ┌─────────────────────────────────────────────────────┐
                 │              WHICH MODEL TO USE?                     │
                 └─────────────────────┬───────────────────────────────┘
                                       │
                        Is the task latency-sensitive?
                       /                                \
                     YES                                 NO
                      │                                   │
              Is quality critical?                 Is it creative writing?
              /                \                   /                \
            NO                 YES               YES                NO
             │                  │                  │                  │
     ┌───────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐
     │ Gemini Flash  │  │ Gemini Pro   │  │Claude Sonnet │  │ Gemini Pro   │
     │ Fast + cheap  │  │ Fast + smart │  │ Best writer  │  │ Best reasoner│
     └───────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
                                                                    │
                                                           Is it enterprise-only?
                                                           /                \
                                                         YES                NO
                                                          │                  │
                                                  ┌───────┴───────┐         │
                                                  │ Claude Opus   │    (use Pro)
                                                  │ Premium tier  │
                                                  └───────────────┘
```

---

## 3. Task-to-Model Routing

### 3.1 Task Type Definition

```typescript
// packages/types/src/ai.ts

export type AITask =
  | 'product_description_short'
  | 'product_description_detailed'
  | 'product_tags'
  | 'seo_meta_tags'
  | 'smart_pricing'
  | 'inventory_forecast'
  | 'resume_bullets'
  | 'resume_full_rewrite'
  | 'resume_summary'
  | 'ats_score'
  | 'portfolio_description'
  | 'skill_suggestions'
  | 'analytics_insight'
  | 'landing_copy'
  | 'headline_generation'
  | 'blog_draft'
  | 'blog_seo'
  | 'content_moderation'
  | 'content_audit'
  | 'image_alt_text'
  | 'email_template'
  | 'page_section_gen'
  | 'store_name_suggestions'
  | 'testimonial_request_email';

export type ModelId = 'gemini-3-flash' | 'gemini-3-pro' | 'claude-sonnet-4.5' | 'claude-opus-4.6';

export interface TaskConfig {
  primary: ModelId;
  fallback: ModelId | null;
  avgInputTokens: number;
  avgOutputTokens: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  cacheTTL: number;       // seconds (0 = no cache)
  creditCost: number;     // LetBuyy credits
  streamable: boolean;    // supports SSE streaming
  requiresPlan: 'free' | 'starter' | 'business' | 'enterprise';
}
```

### 3.2 Complete Routing Table

```typescript
// workers/api/src/ai/routing.ts

export const TASK_ROUTING: Record<AITask, TaskConfig> = {
  // ─── E-COMMERCE ──────────────────────────────────────────────
  product_description_short: {
    primary: 'gemini-3-flash', fallback: 'claude-sonnet-4.5',
    avgInputTokens: 300, avgOutputTokens: 200,
    maxInputTokens: 1000, maxOutputTokens: 500,
    cacheTTL: 86400, creditCost: 1, streamable: false, requiresPlan: 'free',
  },
  product_description_detailed: {
    primary: 'claude-sonnet-4.5', fallback: 'gemini-3-pro',
    avgInputTokens: 500, avgOutputTokens: 800,
    maxInputTokens: 2000, maxOutputTokens: 2000,
    cacheTTL: 86400, creditCost: 2, streamable: true, requiresPlan: 'starter',
  },
  product_tags: {
    primary: 'gemini-3-flash', fallback: null,
    avgInputTokens: 200, avgOutputTokens: 100,
    maxInputTokens: 500, maxOutputTokens: 200,
    cacheTTL: 604800, creditCost: 1, streamable: false, requiresPlan: 'free',
  },
  seo_meta_tags: {
    primary: 'gemini-3-flash', fallback: null,
    avgInputTokens: 200, avgOutputTokens: 150,
    maxInputTokens: 500, maxOutputTokens: 300,
    cacheTTL: 604800, creditCost: 1, streamable: false, requiresPlan: 'free',
  },
  smart_pricing: {
    primary: 'gemini-3-pro', fallback: 'claude-sonnet-4.5',
    avgInputTokens: 1000, avgOutputTokens: 500,
    maxInputTokens: 3000, maxOutputTokens: 1000,
    cacheTTL: 43200, creditCost: 1, streamable: false, requiresPlan: 'business',
  },
  inventory_forecast: {
    primary: 'gemini-3-pro', fallback: 'claude-sonnet-4.5',
    avgInputTokens: 2000, avgOutputTokens: 1000,
    maxInputTokens: 8000, maxOutputTokens: 3000,
    cacheTTL: 43200, creditCost: 2, streamable: false, requiresPlan: 'business',
  },

  // ─── RESUME & PORTFOLIO ─────────────────────────────────────
  resume_bullets: {
    primary: 'claude-sonnet-4.5', fallback: 'gemini-3-pro',
    avgInputTokens: 400, avgOutputTokens: 300,
    maxInputTokens: 1500, maxOutputTokens: 800,
    cacheTTL: 0, creditCost: 1, streamable: false, requiresPlan: 'starter',
  },
  resume_full_rewrite: {
    primary: 'claude-opus-4.6', fallback: 'claude-sonnet-4.5',
    avgInputTokens: 2000, avgOutputTokens: 3000,
    maxInputTokens: 6000, maxOutputTokens: 6000,
    cacheTTL: 0, creditCost: 5, streamable: true, requiresPlan: 'enterprise',
  },
  resume_summary: {
    primary: 'claude-sonnet-4.5', fallback: 'gemini-3-pro',
    avgInputTokens: 800, avgOutputTokens: 200,
    maxInputTokens: 2000, maxOutputTokens: 500,
    cacheTTL: 0, creditCost: 1, streamable: false, requiresPlan: 'starter',
  },
  ats_score: {
    primary: 'gemini-3-pro', fallback: 'claude-sonnet-4.5',
    avgInputTokens: 3000, avgOutputTokens: 1500,
    maxInputTokens: 8000, maxOutputTokens: 3000,
    cacheTTL: 0, creditCost: 2, streamable: false, requiresPlan: 'business',
  },
  portfolio_description: {
    primary: 'claude-sonnet-4.5', fallback: 'gemini-3-pro',
    avgInputTokens: 400, avgOutputTokens: 500,
    maxInputTokens: 1500, maxOutputTokens: 1500,
    cacheTTL: 0, creditCost: 1, streamable: false, requiresPlan: 'starter',
  },
  skill_suggestions: {
    primary: 'gemini-3-flash', fallback: null,
    avgInputTokens: 300, avgOutputTokens: 200,
    maxInputTokens: 800, maxOutputTokens: 400,
    cacheTTL: 86400, creditCost: 1, streamable: false, requiresPlan: 'free',
  },

  // ─── LANDING & BLOG ─────────────────────────────────────────
  landing_copy: {
    primary: 'claude-sonnet-4.5', fallback: 'gemini-3-pro',
    avgInputTokens: 500, avgOutputTokens: 1200,
    maxInputTokens: 2000, maxOutputTokens: 3000,
    cacheTTL: 0, creditCost: 2, streamable: true, requiresPlan: 'starter',
  },
  headline_generation: {
    primary: 'claude-sonnet-4.5', fallback: 'gemini-3-flash',
    avgInputTokens: 200, avgOutputTokens: 300,
    maxInputTokens: 500, maxOutputTokens: 600,
    cacheTTL: 3600, creditCost: 1, streamable: false, requiresPlan: 'starter',
  },
  blog_draft: {
    primary: 'claude-sonnet-4.5', fallback: 'gemini-3-pro',
    avgInputTokens: 500, avgOutputTokens: 2000,
    maxInputTokens: 2000, maxOutputTokens: 4000,
    cacheTTL: 0, creditCost: 3, streamable: true, requiresPlan: 'starter',
  },
  blog_seo: {
    primary: 'gemini-3-flash', fallback: null,
    avgInputTokens: 500, avgOutputTokens: 200,
    maxInputTokens: 1500, maxOutputTokens: 500,
    cacheTTL: 604800, creditCost: 1, streamable: false, requiresPlan: 'free',
  },

  // ─── PLATFORM ────────────────────────────────────────────────
  content_moderation: {
    primary: 'gemini-3-flash', fallback: null,
    avgInputTokens: 500, avgOutputTokens: 50,
    maxInputTokens: 2000, maxOutputTokens: 200,
    cacheTTL: 0, creditCost: 0, streamable: false, requiresPlan: 'free',
  },
  content_audit: {
    primary: 'claude-opus-4.6', fallback: 'claude-sonnet-4.5',
    avgInputTokens: 5000, avgOutputTokens: 4000,
    maxInputTokens: 16000, maxOutputTokens: 8000,
    cacheTTL: 0, creditCost: 8, streamable: true, requiresPlan: 'enterprise',
  },
  image_alt_text: {
    primary: 'gemini-3-flash', fallback: null,
    avgInputTokens: 400, avgOutputTokens: 100,
    maxInputTokens: 1000, maxOutputTokens: 200,
    cacheTTL: 2592000, creditCost: 0, streamable: false, requiresPlan: 'free',
  },
  analytics_insight: {
    primary: 'gemini-3-pro', fallback: 'claude-sonnet-4.5',
    avgInputTokens: 1500, avgOutputTokens: 800,
    maxInputTokens: 5000, maxOutputTokens: 2000,
    cacheTTL: 3600, creditCost: 1, streamable: false, requiresPlan: 'business',
  },
  email_template: {
    primary: 'gemini-3-flash', fallback: 'claude-sonnet-4.5',
    avgInputTokens: 300, avgOutputTokens: 600,
    maxInputTokens: 1000, maxOutputTokens: 1500,
    cacheTTL: 86400, creditCost: 1, streamable: false, requiresPlan: 'free',
  },
  page_section_gen: {
    primary: 'claude-sonnet-4.5', fallback: 'gemini-3-pro',
    avgInputTokens: 400, avgOutputTokens: 1500,
    maxInputTokens: 2000, maxOutputTokens: 4000,
    cacheTTL: 0, creditCost: 2, streamable: true, requiresPlan: 'starter',
  },
  store_name_suggestions: {
    primary: 'gemini-3-flash', fallback: null,
    avgInputTokens: 100, avgOutputTokens: 200,
    maxInputTokens: 300, maxOutputTokens: 500,
    cacheTTL: 3600, creditCost: 0, streamable: false, requiresPlan: 'free',
  },
  testimonial_request_email: {
    primary: 'gemini-3-flash', fallback: null,
    avgInputTokens: 200, avgOutputTokens: 300,
    maxInputTokens: 500, maxOutputTokens: 600,
    cacheTTL: 86400, creditCost: 1, streamable: false, requiresPlan: 'free',
  },
};
```

### 3.3 Model Access by Plan

| Model | Free | Starter | Business | Enterprise |
|---|:---:|:---:|:---:|:---:|
| Gemini 3 Flash | ✅ | ✅ | ✅ | ✅ |
| Gemini 3 Pro | ❌ | ❌ | ✅ | ✅ |
| Claude Sonnet 4.5 | ❌ | ✅ | ✅ | ✅ |
| Claude Opus 4.6 | ❌ | ❌ | ❌ | ✅ |

### 3.4 Per-Request Token Caps by Plan

| Plan | Max Input/Request | Max Output/Request | Concurrent Requests |
|---|---|---|---|
| Free | 2,000 tokens | 1,000 tokens | 1 |
| Starter | 4,000 tokens | 2,000 tokens | 2 |
| Business | 8,000 tokens | 4,000 tokens | 5 |
| Enterprise | 16,000 tokens | 8,000 tokens | 10 |

---

## 4. Provider Abstraction Layer

### 4.1 Unified Provider Interface

```typescript
// workers/api/src/ai/providers/base.ts

export interface AIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  timeoutMs: number;
  maxRetries: number;
}

export interface AIRequest {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  stream: boolean;
  jsonMode?: boolean;
}

export interface AIResponse {
  content: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  finishReason: 'stop' | 'max_tokens' | 'error';
  latencyMs: number;
}

export abstract class AIProvider {
  constructor(protected config: AIProviderConfig) {}

  abstract generate(request: AIRequest): Promise<AIResponse>;
  abstract generateStream(request: AIRequest): AsyncGenerator<string, AIResponse>;

  protected async withRetry<T>(fn: () => Promise<T>, retries = this.config.maxRetries): Promise<T> {
    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err as Error;
        if (attempt < retries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(r => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }
}
```

### 4.2 Google AI Adapter

```typescript
// workers/api/src/ai/providers/google.ts

import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider, AIRequest, AIResponse } from './base';

export class GoogleAIProvider extends AIProvider {
  private client: GoogleGenerativeAI;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = new GoogleGenerativeAI(config.apiKey);
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    return this.withRetry(async () => {
      const start = Date.now();
      const model = this.client.getGenerativeModel({
        model: request.model,
        systemInstruction: request.systemPrompt,
        generationConfig: {
          maxOutputTokens: request.maxTokens,
          temperature: request.temperature,
          responseMimeType: request.jsonMode ? 'application/json' : 'text/plain',
        },
      });

      const result = await model.generateContent(request.userPrompt);
      const response = result.response;
      const usage = response.usageMetadata;

      return {
        content: response.text(),
        inputTokens: usage?.promptTokenCount || 0,
        outputTokens: usage?.candidatesTokenCount || 0,
        model: request.model,
        finishReason: response.candidates?.[0]?.finishReason === 'STOP' ? 'stop' : 'max_tokens',
        latencyMs: Date.now() - start,
      };
    });
  }

  async *generateStream(request: AIRequest): AsyncGenerator<string, AIResponse> {
    const start = Date.now();
    const model = this.client.getGenerativeModel({
      model: request.model,
      systemInstruction: request.systemPrompt,
      generationConfig: { maxOutputTokens: request.maxTokens, temperature: request.temperature },
    });

    const result = await model.generateContentStream(request.userPrompt);
    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullContent += text;
      yield text;

      if (chunk.usageMetadata) {
        inputTokens = chunk.usageMetadata.promptTokenCount || 0;
        outputTokens = chunk.usageMetadata.candidatesTokenCount || 0;
      }
    }

    return {
      content: fullContent, inputTokens, outputTokens,
      model: request.model, finishReason: 'stop', latencyMs: Date.now() - start,
    };
  }
}
```

### 4.3 Anthropic Adapter

```typescript
// workers/api/src/ai/providers/anthropic.ts

import Anthropic from '@anthropic-ai/sdk';
import { AIProvider, AIRequest, AIResponse } from './base';

export class AnthropicProvider extends AIProvider {
  private client: Anthropic;

  constructor(config: AIProviderConfig) {
    super(config);
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    return this.withRetry(async () => {
      const start = Date.now();
      const message = await this.client.messages.create({
        model: request.model,
        max_tokens: request.maxTokens,
        temperature: request.temperature,
        system: request.systemPrompt,
        messages: [{ role: 'user', content: request.userPrompt }],
      });

      return {
        content: message.content[0].type === 'text' ? message.content[0].text : '',
        inputTokens: message.usage.input_tokens,
        outputTokens: message.usage.output_tokens,
        model: request.model,
        finishReason: message.stop_reason === 'end_turn' ? 'stop' : 'max_tokens',
        latencyMs: Date.now() - start,
      };
    });
  }

  async *generateStream(request: AIRequest): AsyncGenerator<string, AIResponse> {
    const start = Date.now();
    let fullContent = '';
    let inputTokens = 0;
    let outputTokens = 0;

    const stream = this.client.messages.stream({
      model: request.model,
      max_tokens: request.maxTokens,
      temperature: request.temperature,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.userPrompt }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullContent += event.delta.text;
        yield event.delta.text;
      }
      if (event.type === 'message_delta' && event.usage) {
        outputTokens = event.usage.output_tokens;
      }
    }

    const finalMessage = await stream.finalMessage();
    inputTokens = finalMessage.usage.input_tokens;

    return {
      content: fullContent, inputTokens, outputTokens,
      model: request.model, finishReason: 'stop', latencyMs: Date.now() - start,
    };
  }
}
```

### 4.4 Provider Registry

```typescript
// workers/api/src/ai/providers/registry.ts

import { AIProvider } from './base';
import { GoogleAIProvider } from './google';
import { AnthropicProvider } from './anthropic';

export function createProvider(modelId: ModelId, env: Env): AIProvider {
  const PROVIDER_MAP: Record<ModelId, () => AIProvider> = {
    'gemini-3-flash': () => new GoogleAIProvider({
      apiKey: env.GOOGLE_AI_KEY, timeoutMs: 15000, maxRetries: 2,
    }),
    'gemini-3-pro': () => new GoogleAIProvider({
      apiKey: env.GOOGLE_AI_KEY, timeoutMs: 30000, maxRetries: 2,
    }),
    'claude-sonnet-4.5': () => new AnthropicProvider({
      apiKey: env.ANTHROPIC_KEY, timeoutMs: 30000, maxRetries: 2,
    }),
    'claude-opus-4.6': () => new AnthropicProvider({
      apiKey: env.ANTHROPIC_KEY, timeoutMs: 60000, maxRetries: 1,
    }),
  };

  return PROVIDER_MAP[modelId]();
}
```

---

## 5. Credit System & Token Economics

### 5.1 How Credits Work

**1 credit ≈ 1 AI operation**, regardless of which model is used. The platform absorbs the cost difference between models — users pay a flat credit rate, while LetBuyy routes to the optimal model.

```
User clicks "Generate Description" (1 credit)
    │
    ├── Platform routes to Gemini Flash → costs LetBuyy $0.0008
    │   └── User paid $0.10 in credit value → 99.2% margin
    │
    └── (If Flash fails) Falls back to Claude Sonnet → costs LetBuyy $0.014
        └── User still pays 1 credit ($0.10) → 86% margin
```

### 5.2 Credit Allocation by Plan

| Plan | Monthly Credits | Credit Value | Rollover | Top-Up Allowed | Bonus Credits |
|---|---|---|---|---|---|
| **Trial** | 10 (one-time) | $0.10 each | No | No | — |
| **Free** | 10/month | $0.10 each | No | Yes | — |
| **Starter** | 50/month | $0.10 each | Up to 25 | Yes | 5 on signup |
| **Business** | 200/month | $0.08 each | Up to 100 | Yes | 20 on signup |
| **Enterprise** | 1,000/month | $0.05 each | Up to 500 | Yes | 100 on signup |

### 5.3 Credit Costs by Feature

| Feature | Credits | Actual Avg Provider Cost | Margin | Plan Required |
|---|---|---|---|---|
| Product description (short, Flash) | 1 | $0.0008 | 99.2% | Free |
| Product description (detailed, Sonnet) | 2 | $0.014 | 93% | Starter |
| SEO meta tags (Flash) | 1 | $0.0006 | 99.4% | Free |
| Smart pricing analysis (Pro) | 1 | $0.006 | 94% | Business |
| Resume bullet improvement (Sonnet) | 1 | $0.006 | 94% | Starter |
| Full resume rewrite (Opus) | 5 | $0.085 | 83% | Enterprise |
| ATS score analysis (Pro) | 2 | $0.019 | 90.5% | Business |
| Landing page copy (Sonnet) | 2 | $0.020 | 90% | Starter |
| Blog draft generation (Sonnet) | 3 | $0.033 | 89% | Starter |
| Analytics insight (Pro) | 1 | $0.010 | 90% | Business |
| Page section builder (Sonnet) | 2 | $0.024 | 88% | Starter |
| Email template (Flash) | 1 | $0.002 | 98% | Free |
| Inventory forecast (Pro) | 2 | $0.013 | 93.5% | Business |
| Full content audit (Opus) | 8 | $0.125 | 84.4% | Enterprise |
| Image alt text (Flash) | Free | $0.0005 | Platform cost | Free |
| Content moderation (Flash) | Free | $0.0003 | Platform cost | Free |

### 5.4 Top-Up Packs

| Pack | Credits | Price | Per-Credit | Savings |
|---|---|---|---|---|
| **Micro** | 10 | $1.00 | $0.100 | — |
| **Small** | 25 | $2.50 | $0.100 | — |
| **Medium** | 100 | $8.00 | $0.080 | 20% |
| **Large** | 500 | $30.00 | $0.060 | 40% |
| **Jumbo** | 1,000 | $50.00 | $0.050 | 50% |

### 5.5 Credit Purchase Flow

```typescript
// workers/api/src/routes/ai/credits.ts

const purchaseSchema = z.object({
  packId: z.enum(['micro', 'small', 'medium', 'large', 'jumbo']),
  paymentMethodId: z.string(),
});

app.post('/v1/ai/credits/purchase', authMiddleware(), async (c) => {
  const storeId = c.get('storeId');
  const { packId, paymentMethodId } = purchaseSchema.parse(await c.req.json());
  const supabase = createServiceClient(c.env);
  const redis = createRedis(c.env);

  const PACKS = {
    micro:  { credits: 10,    price: 100 },     // cents
    small:  { credits: 25,    price: 250 },
    medium: { credits: 100,   price: 800 },
    large:  { credits: 500,   price: 3000 },
    jumbo:  { credits: 1000,  price: 5000 },
  };

  const pack = PACKS[packId];

  // 1. Charge via Stripe
  const charge = await stripe.paymentIntents.create({
    amount: pack.price,
    currency: 'usd',
    payment_method: paymentMethodId,
    confirm: true,
    metadata: { store_id: storeId, pack_id: packId, credits: pack.credits.toString() },
  });

  if (charge.status !== 'succeeded') {
    return c.json({ error: 'Payment failed' }, 402);
  }

  // 2. Add credits in Supabase (source of truth)
  await supabase.rpc('add_purchased_credits', {
    p_store_id: storeId,
    p_credits: pack.credits,
    p_amount_cents: pack.price,
    p_stripe_payment_id: charge.id,
  });

  // 3. Invalidate Redis cache so next AI call fetches fresh balance
  await redis.del(`ai:credits:${storeId}`);
  await redis.del(`ai:session:${storeId}`);

  // 4. Log transaction
  await supabase.from('credit_transactions').insert({
    store_id: storeId,
    type: 'purchase',
    credits: pack.credits,
    amount_cents: pack.price,
    stripe_payment_id: charge.id,
    pack_id: packId,
  });

  return c.json({
    success: true,
    creditsAdded: pack.credits,
    amountCharged: `$${(pack.price / 100).toFixed(2)}`,
  });
});
```

### 5.6 Monthly Credit Reset (Cron Job)

```typescript
// workers/api/src/cron/credit-reset.ts

export async function resetMonthlyCredits(env: Env): Promise<void> {
  const supabase = createServiceClient(env);
  const redis = createRedis(env);

  // Find all stores due for reset (last_reset_at > 30 days ago)
  const { data: stores } = await supabase
    .from('ai_credits')
    .select('store_id, plan, monthly_allocation, current_balance, purchased_balance')
    .lt('last_reset_at', new Date(Date.now() - 30 * 86400000).toISOString());

  if (!stores || stores.length === 0) return;

  for (const store of stores) {
    // Calculate rollover (plan-specific caps)
    const ROLLOVER_CAPS: Record<string, number> = {
      free: 0, starter: 25, business: 100, enterprise: 500,
    };
    const maxRollover = ROLLOVER_CAPS[store.plan] || 0;
    const unusedCredits = Math.min(store.current_balance, maxRollover);

    // Reset: monthly allocation + rollover + purchased (purchased never expire)
    const newBalance = store.monthly_allocation + unusedCredits + store.purchased_balance;

    await supabase.from('ai_credits').update({
      current_balance: newBalance,
      purchased_balance: store.purchased_balance, // purchased stays as-is
      last_reset_at: new Date().toISOString(),
    }).eq('store_id', store.store_id);

    // Invalidate Redis
    await redis.del(`ai:credits:${store.store_id}`);
    await redis.del(`ai:session:${store.store_id}`);
  }

  console.log(`[CRON] Reset credits for ${stores.length} stores`);
}
```

---

## 6. Redis Session & Token Monitoring

### 6.1 Architecture

**All AI gateway decisions are enforced through Upstash Redis** — a serverless Redis compatible with Cloudflare Workers (HTTP/REST API):

```
Request arrives at AI Gateway
        │
        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    REDIS CHECK PIPELINE (Atomic)                      │
│                                                                       │
│  Step 1: AUTH + PLAN CHECK                                            │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ HGET session:{store_id} plan, credits_balance, model_access     │ │
│  │ → If no session → fetch from Supabase → cache in Redis (30min)  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Step 2: CREDIT CHECK                                                 │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ HGET ai:credits:{store_id} balance                              │ │
│  │ → If balance < task.creditCost → HTTP 422 INSUFFICIENT_CREDITS  │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Step 3: RATE LIMIT CHECK (per model, sliding window)                 │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ EVALSHA rate_limit_script                                        │ │
│  │   KEY: ai:rl:{store_id}:{model}:{minute_window}                 │ │
│  │   → If requests > plan_rpm_limit → HTTP 429 RATE_LIMITED        │ │
│  │                                                                   │ │
│  │ EVALSHA token_limit_script                                        │ │
│  │   KEY: ai:tpm:{store_id}:{model}:{minute_window}                 │ │
│  │   → If tokens > model_tpm_limit → queue or reject               │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  Step 4: CONCURRENCY CHECK                                            │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ HINCRBY ai:session:{store_id} active_requests 1                 │ │
│  │ → If active_requests > plan_concurrency → HTTP 429              │ │
│  └─────────────────────────────────────────────────────────────────┘ │
│                                                                       │
│  ALL CHECKS PASS → Forward to AI Provider                             │
└──────────────────────────────────────────────────────────────────────┘
        │
        ▼
  AI Provider Response
        │
        ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    REDIS POST-CALL UPDATE (Atomic)                    │
│                                                                       │
│  • HINCRBY ai:credits:{store_id} balance -{creditCost}               │
│  • HINCRBY ai:tokens:{store_id}:{date} {model}_input +{in_tokens}   │
│  • HINCRBY ai:tokens:{store_id}:{date} {model}_output +{out_tokens} │
│  • HINCRBY ai:tpm:{store_id}:{model}:{window} count +{total_tokens} │
│  • HINCRBY ai:session:{store_id} active_requests -1                  │
│  • SET ai:cache:{hash} {response} EX {cacheTTL}  (if cacheable)     │
│  • LPUSH ai:log:{store_id} {usage_record}                           │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.2 Redis Key Schema

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `session:{store_id}` | Hash | 30min | Plan info, model access, cached auth state |
| `ai:credits:{store_id}` | Hash | — (persistent) | `balance`, `monthly_alloc`, `purchased`, `total_used` |
| `ai:tokens:{store_id}:{YYYY-MM-DD}` | Hash | 48h | Per-model daily token counts (input/output) |
| `ai:rl:{store_id}:{model}:{minute}` | String (int) | 60s | Sliding window request counter per model |
| `ai:tpm:{store_id}:{model}:{minute}` | String (int) | 60s | Sliding window token counter per model |
| `ai:session:{store_id}` | Hash | 30min | `active_requests`, `last_call_at`, `last_model` |
| `ai:cache:{sha256_hash}` | String (JSON) | Varies | Cached AI responses for identical inputs |
| `ai:log:{store_id}` | List | 7 days | Recent usage log entries (capped at 1000) |
| `ai:monthly:{store_id}:{YYYY-MM}` | Hash | 35 days | Monthly aggregate: total calls, tokens, cost |
| `ai:circuit:{model}` | Hash | 5min | Circuit breaker state per model |
| `ai:global:rpm:{model}:{minute}` | String | 60s | Global RPM across all stores per model |

### 6.3 Rate Limiting Lua Script (Atomic)

```lua
-- Redis Lua script: Sliding window rate limiter
-- KEYS[1] = rate limit key (e.g., ai:rl:{store_id}:{model}:{window})
-- ARGV[1] = max requests allowed
-- ARGV[2] = window size in seconds
-- ARGV[3] = current timestamp

local key = KEYS[1]
local max_requests = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

-- Remove expired entries
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- Count current requests in window
local current = redis.call('ZCARD', key)

if current >= max_requests then
  return 0  -- DENIED
end

-- Add current request
redis.call('ZADD', key, now, now .. ':' .. math.random(1000000))
redis.call('EXPIRE', key, window)

return 1  -- ALLOWED
```

### 6.4 Token Budget Enforcement

```typescript
// Cloudflare Worker — AI Gateway middleware
async function enforceTokenBudget(
  redis: Redis,
  storeId: string,
  model: ModelId,
  estimatedTokens: number
): Promise<{ allowed: boolean; reason?: string }> {
  const minute = Math.floor(Date.now() / 60000);
  const tpmKey = `ai:tpm:${storeId}:${model}:${minute}`;

  const currentTPM = parseInt(await redis.get(tpmKey) || '0');

  const MODEL_TPM_LIMITS: Record<ModelId, number> = {
    'gemini-3-flash':    1_000_000,
    'gemini-3-pro':    1_000_000,
    'claude-sonnet-4.5':    80_000,
    'claude-opus-4.6':      40_000,
  };

  const limit = MODEL_TPM_LIMITS[model];

  if (currentTPM + estimatedTokens > limit) {
    return {
      allowed: false,
      reason: `Token limit exceeded for ${model}: ${currentTPM}/${limit} TPM`
    };
  }

  await redis.incrby(tpmKey, estimatedTokens);
  await redis.expire(tpmKey, 60);

  return { allowed: true };
}
```

### 6.5 Session Manager

```typescript
interface AISession {
  store_id: string;
  plan: 'free' | 'starter' | 'business' | 'enterprise';
  credits_balance: number;
  active_requests: number;
  last_call_at: number;
  model_usage: Record<ModelId, { calls: number; tokens: number }>;
}

class AISessionManager {
  constructor(private redis: Redis) {}

  async getOrCreate(storeId: string): Promise<AISession> {
    const key = `ai:session:${storeId}`;
    const cached = await this.redis.hgetall(key);

    if (Object.keys(cached).length > 0) {
      return this.deserialize(cached);
    }

    // Fetch from Supabase and cache
    const store = await supabase
      .from('stores')
      .select('*, subscriptions(*), ai_credits(*)')
      .eq('id', storeId)
      .single();

    const session: AISession = {
      store_id: storeId,
      plan: store.subscriptions?.plan || 'free',
      credits_balance: store.ai_credits?.current_balance || 0,
      active_requests: 0,
      last_call_at: 0,
      model_usage: {},
    };

    await this.redis.hset(key, this.serialize(session));
    await this.redis.expire(key, 1800);

    return session;
  }

  async stopUserUsage(storeId: string, reason: string): Promise<void> {
    const key = `ai:session:${storeId}`;
    await this.redis.hset(key, 'blocked', 'true');
    await this.redis.hset(key, 'block_reason', reason);
    await this.redis.lpush(`ai:log:${storeId}`, JSON.stringify({
      event: 'usage_blocked', reason, timestamp: Date.now(),
    }));
  }
}
```

---

## 7. Rate Limiting Architecture

### 7.1 LetBuyy Platform Rate Limits (per store)

| Plan | AI Requests/min | AI Requests/hour | Concurrent | Models |
|---|---|---|---|---|
| **Free** | 5 | 30 | 1 | Flash |
| **Starter** | 15 | 100 | 2 | Flash, Sonnet |
| **Business** | 30 | 300 | 5 | Flash, Pro, Sonnet |
| **Enterprise** | 60 | 600 | 10 | All 4 |

### 7.2 Upstream Provider Rate Limits

LetBuyy's platform-level limits are set **below** upstream provider limits to avoid hitting 429s:

| Model | Provider RPM | LetBuyy Max RPM (all users combined) | Safety Buffer |
|---|---|---|---|
| Gemini 3 Flash | 300 | 200 | 33% |
| Gemini 3 Pro | 150 | 100 | 33% |
| Claude Sonnet 4.5 | 50 | 35 | 30% |
| Claude Opus 4.6 | 30 | 20 | 33% |

### 7.3 Circuit Breaker Pattern

```typescript
// workers/api/src/ai/circuit-breaker.ts

interface CircuitState {
  status: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureAt: number;
  successCount: number;
}

class AICircuitBreaker {
  private readonly FAILURE_THRESHOLD = 5;
  private readonly RECOVERY_TIMEOUT = 60000; // 1 minute
  private readonly HALF_OPEN_MAX_REQUESTS = 3;

  constructor(private redis: Redis) {}

  async canRequest(model: ModelId): Promise<{ allowed: boolean; reason?: string }> {
    const key = `ai:circuit:${model}`;
    const state = await this.getState(key);

    switch (state.status) {
      case 'closed':
        return { allowed: true };
      case 'open':
        if (Date.now() - state.lastFailureAt > this.RECOVERY_TIMEOUT) {
          await this.setState(key, { ...state, status: 'half-open', successCount: 0 });
          return { allowed: true };
        }
        return { allowed: false, reason: `Circuit open for ${model} — too many failures` };
      case 'half-open':
        if (state.successCount >= this.HALF_OPEN_MAX_REQUESTS) {
          await this.setState(key, { status: 'closed', failureCount: 0, lastFailureAt: 0, successCount: 0 });
          return { allowed: true };
        }
        return { allowed: true };
    }
  }

  async recordSuccess(model: ModelId): Promise<void> {
    const key = `ai:circuit:${model}`;
    const state = await this.getState(key);
    if (state.status === 'half-open') {
      await this.setState(key, { ...state, successCount: state.successCount + 1 });
    } else {
      await this.setState(key, { ...state, failureCount: 0 });
    }
  }

  async recordFailure(model: ModelId): Promise<void> {
    const key = `ai:circuit:${model}`;
    const state = await this.getState(key);
    const newCount = state.failureCount + 1;

    if (newCount >= this.FAILURE_THRESHOLD || state.status === 'half-open') {
      await this.setState(key, { status: 'open', failureCount: newCount, lastFailureAt: Date.now(), successCount: 0 });
    } else {
      await this.setState(key, { ...state, failureCount: newCount });
    }
  }
}
```

### 7.4 Error Handling & Fallback Chain

```
AI Request
  │
  ├── Pre-check: Credits ≤ 0? → 422 INSUFFICIENT_CREDITS
  ├── Pre-check: Circuit open? → skip to fallback model
  ├── Pre-check: Rate limited? → 429 RATE_LIMITED (include Retry-After header)
  ├── Pre-check: Model not in plan? → 403 MODEL_NOT_AVAILABLE
  │
  ├── Call Primary Model
  │   ├── Success → return result, update Redis, record success
  │   ├── Rate Limited (429 from provider) → record failure, try fallback
  │   ├── Timeout (15s for Flash/Pro, 30s for Sonnet, 60s for Opus) → try fallback
  │   └── API Error (5xx) → record failure, try fallback
  │
  ├── Call Fallback Model
  │   ├── Success → return result, log using fallback
  │   └── Failure → refund credits, return 503
  │
  └── All Failed
      ├── Refund credits (atomic Redis HINCRBY)
      ├── Log error with full context
      ├── Alert if error rate > 5% (Sentry)
      └── Return user-friendly error message
```

---

## 8. AI Gateway Implementation

### 8.1 Main Handler

```typescript
// workers/api/src/routes/ai/generate.ts

import { Hono } from 'hono';
import { z } from 'zod';
import { authMiddleware, storeMiddleware } from '@/middleware';
import { TASK_ROUTING, AITask } from '@/ai/routing';
import { createProvider } from '@/ai/providers/registry';
import { AISessionManager } from '@/ai/session';
import { AICircuitBreaker } from '@/ai/circuit-breaker';
import { buildPrompt } from '@/ai/prompts';
import { createCacheKey, getCachedResponse, setCachedResponse } from '@/ai/cache';

const app = new Hono<{ Bindings: Env }>();

const generateSchema = z.object({
  task: z.string() as z.ZodType<AITask>,
  input: z.record(z.any()),
  options: z.object({
    stream: z.boolean().default(false),
    temperature: z.number().min(0).max(2).default(0.7),
    forceModel: z.string().optional(),
  }).default({}),
});

app.post('/v1/ai/generate', authMiddleware(), storeMiddleware(), async (c) => {
  const storeId = c.get('storeId');
  const storePlan = c.get('storePlan');
  const { task, input, options } = generateSchema.parse(await c.req.json());

  const taskConfig = TASK_ROUTING[task];
  if (!taskConfig) return c.json({ error: 'Unknown task' }, 400);

  const redis = createRedis(c.env);
  const session = new AISessionManager(redis);
  const circuitBreaker = new AICircuitBreaker(redis);

  // ─── PLAN GATE ───────────────────────────────────────────────
  const PLAN_RANK = { free: 0, starter: 1, business: 2, enterprise: 3 };
  if (PLAN_RANK[storePlan] < PLAN_RANK[taskConfig.requiresPlan]) {
    return c.json({
      error: 'PLAN_UPGRADE_REQUIRED',
      message: `This feature requires ${taskConfig.requiresPlan} plan or higher`,
      requiredPlan: taskConfig.requiresPlan,
    }, 403);
  }

  // ─── REDIS PIPELINE (atomic checks) ─────────────────────────
  const sessionData = await session.getOrCreate(storeId);

  if (sessionData.credits_balance < taskConfig.creditCost) {
    return c.json({
      error: 'INSUFFICIENT_CREDITS',
      balance: sessionData.credits_balance,
      required: taskConfig.creditCost,
      topUpUrl: '/ai/credits/purchase',
    }, 422);
  }

  // Rate limit check
  const rateLimitResult = await checkRateLimit(redis, storeId, storePlan);
  if (!rateLimitResult.allowed) {
    return c.json({
      error: 'RATE_LIMITED',
      retryAfter: rateLimitResult.retryAfter,
    }, 429);
  }

  // ─── CACHE CHECK ─────────────────────────────────────────────
  if (taskConfig.cacheTTL > 0) {
    const cacheKey = createCacheKey(task, input, taskConfig.primary);
    const cached = await getCachedResponse(redis, cacheKey);
    if (cached) {
      // Log as cached hit (no credits deducted)
      await logUsage(c.env, storeId, task, taskConfig.primary, 0, 0, 0, 'cached', 0);
      return c.json({ result: cached, cached: true, creditsUsed: 0 });
    }
  }

  // ─── BUILD PROMPT ────────────────────────────────────────────
  const { data: store } = await supabase
    .from('stores')
    .select('name, settings, site_type, industry')
    .eq('id', storeId)
    .single();

  const { systemPrompt, userPrompt } = buildPrompt(task, input, store);

  // ─── PROVIDER CALL WITH FALLBACK ─────────────────────────────
  const modelsToTry = [taskConfig.primary, taskConfig.fallback].filter(Boolean) as ModelId[];
  let response = null;
  let usedModel = taskConfig.primary;

  for (const model of modelsToTry) {
    const circuitCheck = await circuitBreaker.canRequest(model);
    if (!circuitCheck.allowed) continue;

    try {
      const provider = createProvider(model, c.env);

      if (options.stream && taskConfig.streamable) {
        // Stream response (handled separately)
        return handleStreamResponse(c, provider, {
          model, systemPrompt, userPrompt,
          maxTokens: taskConfig.maxOutputTokens,
          temperature: options.temperature,
        }, storeId, task, taskConfig, redis, circuitBreaker);
      }

      response = await provider.generate({
        model, systemPrompt, userPrompt,
        maxTokens: taskConfig.maxOutputTokens,
        temperature: options.temperature,
        stream: false,
      });

      usedModel = model;
      await circuitBreaker.recordSuccess(model);
      break;
    } catch (err) {
      await circuitBreaker.recordFailure(model);
      console.error(`[AI] ${model} failed:`, err);
    }
  }

  if (!response) {
    return c.json({ error: 'AI_SERVICE_UNAVAILABLE', message: 'All models failed' }, 503);
  }

  // ─── POST-CALL UPDATES ───────────────────────────────────────
  const actualCost = calculateCost(usedModel, response.inputTokens, response.outputTokens);

  // Redis updates (atomic)
  await Promise.all([
    redis.hincrby(`ai:credits:${storeId}`, 'balance', -taskConfig.creditCost),
    redis.hincrby(`ai:tokens:${storeId}:${today()}`, `${usedModel}_input`, response.inputTokens),
    redis.hincrby(`ai:tokens:${storeId}:${today()}`, `${usedModel}_output`, response.outputTokens),
    taskConfig.cacheTTL > 0
      ? setCachedResponse(redis, createCacheKey(task, input, usedModel), response.content, taskConfig.cacheTTL)
      : Promise.resolve(),
  ]);

  // Supabase audit log
  await logUsage(c.env, storeId, task, usedModel, response.inputTokens, response.outputTokens,
    taskConfig.creditCost, usedModel !== taskConfig.primary ? 'fallback' : 'success', response.latencyMs, actualCost);

  return c.json({
    result: response.content,
    model: usedModel,
    tokens: { input: response.inputTokens, output: response.outputTokens },
    creditsUsed: taskConfig.creditCost,
    latencyMs: response.latencyMs,
    cached: false,
  });
});
```

---

## 9. Prompt Engineering & Templates

### 9.1 Prompt Template System

```typescript
// workers/api/src/ai/prompts/index.ts

import { AITask } from '../routing';

interface StoreContext {
  name: string;
  site_type: string;
  industry?: string;
  settings?: {
    onboarding_survey?: {
      targetAudience?: string;
      businessGoal?: string;
      brandTone?: string;
    };
  };
}

interface PromptResult {
  systemPrompt: string;
  userPrompt: string;
}

const SYSTEM_BASE = `You are an AI assistant for the LetBuyy platform, helping store owners create professional content. Always be helpful, accurate, and match the store's brand voice.`;

export function buildPrompt(task: AITask, input: Record<string, any>, store: StoreContext): PromptResult {
  const storeContext = buildStoreContext(store);
  const taskPrompt = TASK_PROMPTS[task];

  return {
    systemPrompt: `${SYSTEM_BASE}\n\n${storeContext}\n\n${taskPrompt.system}`,
    userPrompt: taskPrompt.user(input),
  };
}

function buildStoreContext(store: StoreContext): string {
  const survey = store.settings?.onboarding_survey;
  return [
    `## Store Context`,
    `- Store Name: ${store.name}`,
    `- Site Type: ${store.site_type}`,
    store.industry && `- Industry: ${store.industry}`,
    survey?.targetAudience && `- Target Audience: ${survey.targetAudience}`,
    survey?.businessGoal && `- Business Goal: ${survey.businessGoal}`,
    survey?.brandTone && `- Brand Tone: ${survey.brandTone}`,
  ].filter(Boolean).join('\n');
}
```

### 9.2 Task-Specific Prompts (Examples)

```typescript
// workers/api/src/ai/prompts/ecommerce.ts

export const ECOMMERCE_PROMPTS = {
  product_description_short: {
    system: `Generate concise, compelling product descriptions (2-3 sentences). Focus on key benefits and unique selling points. Use the store's brand tone.`,
    user: (input: any) => `Write a short product description for:
Product: ${input.title}
Category: ${input.category}
Price: ${input.price}
Key Features: ${input.features?.join(', ') || 'N/A'}

Return ONLY the description, no labels or formatting.`,
  },

  product_description_detailed: {
    system: `Generate detailed marketing copy for products. Include:
- An attention-grabbing opening line
- 3-4 key benefits (not just features)
- Technical specifications woven naturally
- A compelling call-to-action closing
Use persuasive but honest language. Match the store's brand tone.`,
    user: (input: any) => `Write a detailed product description for:
Product: ${input.title}
Category: ${input.category}
Price: ${input.price}
Features: ${JSON.stringify(input.features || [])}
Target Audience: ${input.targetAudience || 'General'}
Existing Short Description: ${input.shortDescription || 'N/A'}

Write 150-250 words. Use markdown formatting (bold, bullets) where appropriate.`,
  },

  smart_pricing: {
    system: `You are a pricing strategy expert. Analyze the product and market data to suggest optimal pricing. Return JSON with the structure:
{
  "suggestedPrice": number,
  "priceRange": { "min": number, "max": number },
  "confidence": "high" | "medium" | "low",
  "reasoning": string,
  "competitorInsights": string[],
  "pricingStrategy": string
}`,
    user: (input: any) => `Analyze pricing for:
Product: ${input.title}
Category: ${input.category}
Current Price: $${input.currentPrice}
Cost: $${input.cost || 'Unknown'}
Competitor Prices: ${JSON.stringify(input.competitorPrices || [])}
Market: ${input.market || 'General'}
Sales Volume (30d): ${input.salesVolume || 'N/A'}

Provide data-driven pricing recommendation in JSON format.`,
  },
};
```

### 9.3 Resume & Portfolio Prompts

```typescript
// workers/api/src/ai/prompts/resume.ts

export const RESUME_PROMPTS = {
  resume_bullets: {
    system: `You are a professional resume writer. Improve work experience bullet points using the STAR method (Situation, Task, Action, Result). Quantify achievements where possible. Use strong action verbs. Return improved bullets as a JSON array of strings.`,
    user: (input: any) => `Improve these resume bullet points for a ${input.roleTitle} position:

Company: ${input.company}
Role: ${input.roleTitle}
Duration: ${input.duration}

Original bullets:
${input.bullets.map((b: string, i: number) => `${i + 1}. ${b}`).join('\n')}

Target industry: ${input.targetIndustry || 'General'}
Target role: ${input.targetRole || input.roleTitle}

Return improved bullets as a JSON array. Each bullet should:
- Start with a strong action verb (Led, Engineered, Optimized, etc.)
- Include quantified results where possible (%, $, time saved)
- Be 1-2 lines maximum
- Highlight transferable skills relevant to the target role`,
  },

  ats_score: {
    system: `You are an ATS (Applicant Tracking System) expert. Analyze a resume against a job description and return a detailed compatibility score. Return JSON with this structure:
{
  "overallScore": number (0-100),
  "sections": {
    "keywordMatch": { "score": number, "details": string, "matchedKeywords": string[], "missingKeywords": string[] },
    "experienceRelevance": { "score": number, "details": string },
    "skillsAlignment": { "score": number, "details": string },
    "educationFit": { "score": number, "details": string },
    "formatting": { "score": number, "details": string }
  },
  "suggestions": string[],
  "keywordDensity": number
}`,
    user: (input: any) => `## Resume Data
${JSON.stringify(input.resumeData, null, 2)}

## Target Role: ${input.targetRole}
## Job Description:
${input.jobDescription}

## Scoring Criteria:
- Keyword Match (30%): How well do resume keywords match the job description?
- Experience Relevance (25%): How relevant is the work experience?
- Skills Alignment (20%): Do the skills match requirements?
- Education Fit (15%): Does education meet requirements?
- Formatting (10%): Is the resume well-structured for ATS parsing?

Analyze thoroughly and return JSON.`,
  },

  resume_full_rewrite: {
    system: `You are a senior career consultant and professional resume writer. Completely rewrite the resume to maximize impact for the target role. Maintain factual accuracy but dramatically improve wording, structure, and impact. Return the full rewritten resume sections as a JSON object.`,
    user: (input: any) => `Rewrite this resume for a ${input.targetRole} position:

${JSON.stringify(input.resumeData, null, 2)}

Target Company: ${input.targetCompany || 'General'}
Industry: ${input.industry || 'Technology'}
Career Level: ${input.careerLevel || 'Mid-level'}

Rewrite ALL sections and return as JSON with keys: summary, experience (array), skills (array), education (keep original facts).`,
  },
};
```

### 9.4 Output Parsing & Validation

```typescript
// workers/api/src/ai/output-parser.ts

import { z } from 'zod';

// Each task type has an expected output schema
const OUTPUT_SCHEMAS: Partial<Record<AITask, z.ZodSchema>> = {
  smart_pricing: z.object({
    suggestedPrice: z.number(),
    priceRange: z.object({ min: z.number(), max: z.number() }),
    confidence: z.enum(['high', 'medium', 'low']),
    reasoning: z.string(),
    competitorInsights: z.array(z.string()),
    pricingStrategy: z.string(),
  }),
  ats_score: z.object({
    overallScore: z.number().min(0).max(100),
    sections: z.record(z.object({
      score: z.number(),
      details: z.string(),
    })),
    suggestions: z.array(z.string()),
  }),
  resume_bullets: z.array(z.string()),
  product_tags: z.array(z.string()),
};

export function parseAIOutput(task: AITask, rawOutput: string): { parsed: any; valid: boolean; error?: string } {
  const schema = OUTPUT_SCHEMAS[task];

  if (!schema) {
    // Tasks without schemas return raw text
    return { parsed: rawOutput.trim(), valid: true };
  }

  try {
    // Extract JSON from response (handle markdown code blocks)
    const jsonString = rawOutput
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();

    const data = JSON.parse(jsonString);
    const result = schema.safeParse(data);

    if (result.success) {
      return { parsed: result.data, valid: true };
    }

    return { parsed: data, valid: false, error: result.error.message };
  } catch (e) {
    return { parsed: rawOutput, valid: false, error: 'Failed to parse JSON output' };
  }
}
```

---

## 10. Streaming Responses (SSE)

### 10.1 Server-Side Streaming Handler

```typescript
// workers/api/src/ai/streaming.ts

export async function handleStreamResponse(
  c: Context,
  provider: AIProvider,
  request: { model: string; systemPrompt: string; userPrompt: string; maxTokens: number; temperature: number },
  storeId: string,
  task: AITask,
  taskConfig: TaskConfig,
  redis: Redis,
  circuitBreaker: AICircuitBreaker,
): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = provider.generateStream({
          ...request,
          stream: true,
        });

        let finalResponse: AIResponse | undefined;

        for await (const chunk of generator) {
          // Send SSE data event
          const sseData = JSON.stringify({ type: 'chunk', content: chunk });
          controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
        }

        // Generator returns the final response summary
        finalResponse = (generator as any).return?.value;

        if (finalResponse) {
          // Post-call updates
          const actualCost = calculateCost(request.model as ModelId, finalResponse.inputTokens, finalResponse.outputTokens);

          await Promise.all([
            redis.hincrby(`ai:credits:${storeId}`, 'balance', -taskConfig.creditCost),
            redis.hincrby(`ai:tokens:${storeId}:${today()}`, `${request.model}_input`, finalResponse.inputTokens),
            redis.hincrby(`ai:tokens:${storeId}:${today()}`, `${request.model}_output`, finalResponse.outputTokens),
          ]);

          await circuitBreaker.recordSuccess(request.model as ModelId);

          // Send final SSE event with metadata
          const doneData = JSON.stringify({
            type: 'done',
            model: request.model,
            tokens: { input: finalResponse.inputTokens, output: finalResponse.outputTokens },
            creditsUsed: taskConfig.creditCost,
            latencyMs: finalResponse.latencyMs,
          });
          controller.enqueue(encoder.encode(`data: ${doneData}\n\n`));
        }
      } catch (err) {
        await circuitBreaker.recordFailure(request.model as ModelId);
        const errorData = JSON.stringify({ type: 'error', message: (err as Error).message });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
```

### 10.2 Client-Side Stream Consumer

```typescript
// apps/web/admin/lib/ai-stream.ts

export async function consumeAIStream(
  task: string,
  input: Record<string, any>,
  onChunk: (text: string) => void,
  onDone: (metadata: StreamDoneEvent) => void,
  onError: (error: string) => void,
): Promise<void> {
  const response = await fetch('/api/v1/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
    body: JSON.stringify({ task, input, options: { stream: true } }),
  });

  if (!response.ok) {
    const err = await response.json();
    onError(err.error || 'Failed to start stream');
    return;
  }

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = JSON.parse(line.slice(6));

      switch (data.type) {
        case 'chunk': onChunk(data.content); break;
        case 'done': onDone(data); break;
        case 'error': onError(data.message); break;
      }
    }
  }
}
```

### 10.3 React Hook for Streaming

```typescript
// apps/web/admin/hooks/useAIStream.ts

import { useState, useCallback, useRef } from 'react';
import { consumeAIStream } from '@/lib/ai-stream';

export function useAIStream() {
  const [output, setOutput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [metadata, setMetadata] = useState<StreamDoneEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef(false);

  const generate = useCallback(async (task: string, input: Record<string, any>) => {
    setOutput('');
    setIsStreaming(true);
    setError(null);
    setMetadata(null);
    abortRef.current = false;

    await consumeAIStream(
      task,
      input,
      (chunk) => {
        if (!abortRef.current) {
          setOutput(prev => prev + chunk);
        }
      },
      (meta) => {
        setMetadata(meta);
        setIsStreaming(false);
      },
      (err) => {
        setError(err);
        setIsStreaming(false);
      },
    );
  }, []);

  const abort = useCallback(() => {
    abortRef.current = true;
    setIsStreaming(false);
  }, []);

  return { output, isStreaming, metadata, error, generate, abort };
}
```

---

## 11. Response Caching Strategy

### 11.1 Two-Tier Cache Architecture

```
Request with cache key SHA-256(task + input + model)
    │
    ▼
┌── Redis Cache (Layer 1) ──────────────────────────────────────────────┐
│  Key: ai:cache:{hash}                                                  │
│  TTL: Task-specific (0s to 30 days)                                   │
│  Speed: <5ms (Upstash HTTP)                                           │
│  Size limit: 1MB per entry                                            │
│  ├── HIT → return immediately (0 credits, 0 tokens)                   │
│  └── MISS → check Postgres                                            │
└───────────────────────────────────────────────────────────────────────┘
    │
    ▼
┌── Postgres Cache (Layer 2) ───────────────────────────────────────────┐
│  Table: ai_content_cache                                               │
│  TTL: Same as Redis but longer retention                               │
│  Speed: ~50ms                                                          │
│  Size limit: Unlimited                                                 │
│  ├── HIT → return + populate Redis for next time                       │
│  └── MISS → call AI provider                                           │
└───────────────────────────────────────────────────────────────────────┘
```

### 11.2 Cache TTLs by Content Type

| Content Type | Cache TTL | Cache Key Components | Est. Hit Rate |
|---|---|---|---|
| Product descriptions | 24 hours | `hash(title + category + tags + model)` | ~30% |
| SEO meta tags | 7 days | `hash(page_content + url)` | ~50% |
| Image alt text | 30 days | `hash(image_url)` | ~80% |
| Analytics insights | 1 hour | `hash(store_id + query + date)` | ~20% |
| Pricing suggestions | 12 hours | `hash(category + price_range)` | ~40% |
| Email templates | 24 hours | `hash(type + tone + industry)` | ~35% |
| Product tags | 7 days | `hash(title + category)` | ~60% |
| Blog SEO | 7 days | `hash(post_content_hash)` | ~45% |
| Store name suggestions | 1 hour | `hash(industry + keywords)` | ~25% |

**Overall cache hit target: 35-40%** — reducing actual API calls and provider cost.

### 11.3 Cache Implementation

```typescript
// workers/api/src/ai/cache.ts

import { createHash } from 'crypto';

export function createCacheKey(task: string, input: Record<string, any>, model: string): string {
  const normalized = JSON.stringify({ task, input, model }, Object.keys({ task, input, model }).sort());
  return `ai:cache:${createHash('sha256').update(normalized).digest('hex')}`;
}

export async function getCachedResponse(redis: Redis, key: string): Promise<string | null> {
  const cached = await redis.get(key);
  if (cached) {
    // Increment hit counter
    await redis.hincrby(`ai:cache:stats`, 'hits', 1);
    return cached as string;
  }
  await redis.hincrby(`ai:cache:stats`, 'misses', 1);
  return null;
}

export async function setCachedResponse(
  redis: Redis, key: string, content: string, ttl: number
): Promise<void> {
  await redis.set(key, content, { ex: ttl });
}

// Postgres fallback cache for longer retention
export async function getPostgresCachedResponse(
  supabase: SupabaseClient, cacheKey: string
): Promise<string | null> {
  const { data } = await supabase
    .from('ai_content_cache')
    .select('content')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (data) {
    // Increment hit count
    await supabase.rpc('increment_cache_hit', { p_cache_key: cacheKey });
    return data.content;
  }
  return null;
}
```

---

## 12. E-commerce AI Features

### 12.1 Feature Overview

| Feature | Model | Credits | Streaming | Plan | Description |
|---|---|---|---|---|---|
| Product description (quick) | Gemini 3 Flash | 1 | No | Free | 2-3 sentence product description from title + category |
| Product description (detailed) | Claude Sonnet 4.5 | 2 | Yes | Starter | Full marketing copy with features, benefits, persuasion |
| Bulk descriptions | Gemini 3 Flash | 1/each | No | Free | Batch generate descriptions via CSV upload |
| Smart pricing | Gemini 3 Pro | 1 | No | Business | Competitive price analysis with market range |
| Inventory forecast | Gemini 3 Pro | 2 | No | Business | Predict reorder dates from 90 days of sales data |
| SEO meta tags | Gemini 3 Flash | 1 | No | Free | Title + description + keywords for any page |
| Image alt text | Gemini 3 Flash | Free | No | Free | Auto-generate accessible alt text from images |
| Product tags | Gemini 3 Flash | 1 | No | Free | Auto-categorize products with smart tags |

### 12.2 Product Description Generator

```typescript
// workers/api/src/routes/ai/ecommerce.ts

app.post('/v1/ai/generate/product-description', authMiddleware(), storeMiddleware(), async (c) => {
  const schema = z.object({
    productId: z.string().uuid(),
    type: z.enum(['short', 'detailed']).default('short'),
    tone: z.enum(['professional', 'casual', 'luxury', 'playful']).default('professional'),
    includeEmoji: z.boolean().default(false),
    language: z.enum(['en', 'hi', 'es', 'fr']).default('en'),
  });

  const { productId, type, tone, includeEmoji, language } = schema.parse(await c.req.json());
  const storeId = c.get('storeId');
  const supabase = createServiceClient(c.env);

  // Fetch product data
  const { data: product } = await supabase
    .from('products')
    .select('title, category, price, compare_at_price, tags, variants, media')
    .eq('id', productId)
    .eq('store_id', storeId)
    .single();

  if (!product) return c.json({ error: 'Product not found' }, 404);

  // Route to AI gateway
  const result = await generateAI(c.env, {
    task: type === 'short' ? 'product_description_short' : 'product_description_detailed',
    storeId,
    input: {
      title: product.title,
      category: product.category,
      price: product.price,
      features: product.tags,
      tone,
      includeEmoji,
      language,
      hasDiscount: product.compare_at_price > product.price,
      variantCount: product.variants?.length || 0,
    },
  });

  // Auto-save to product
  await supabase.from('products').update({
    description: type === 'short' ? result.content : undefined,
    long_description: type === 'detailed' ? result.content : undefined,
    ai_generated: true,
  }).eq('id', productId);

  return c.json({
    description: result.content,
    model: result.model,
    creditsUsed: result.creditsUsed,
    autoSaved: true,
  });
});
```

### 12.3 Smart Pricing Analyzer

```typescript
app.post('/v1/ai/analyze/pricing', authMiddleware(), storeMiddleware(), async (c) => {
  const schema = z.object({
    productId: z.string().uuid(),
    competitorPrices: z.array(z.number()).optional(),
    targetMargin: z.number().min(0).max(100).optional(),
  });

  const { productId, competitorPrices, targetMargin } = schema.parse(await c.req.json());
  const storeId = c.get('storeId');
  const supabase = createServiceClient(c.env);

  // Fetch product + 90 days of sales data
  const [{ data: product }, { data: salesData }] = await Promise.all([
    supabase.from('products')
      .select('title, category, price, cost_per_item, tags')
      .eq('id', productId).eq('store_id', storeId).single(),
    supabase.from('order_items')
      .select('quantity, unit_price, created_at')
      .eq('product_id', productId)
      .gte('created_at', new Date(Date.now() - 90 * 86400000).toISOString()),
  ]);

  const result = await generateAI(c.env, {
    task: 'smart_pricing',
    storeId,
    input: {
      title: product.title,
      category: product.category,
      currentPrice: product.price,
      cost: product.cost_per_item,
      competitorPrices,
      targetMargin,
      salesHistory: salesData?.map(s => ({
        quantity: s.quantity, price: s.unit_price, date: s.created_at,
      })),
      salesVolume: salesData?.reduce((sum, s) => sum + s.quantity, 0) || 0,
    },
  });

  return c.json({
    analysis: JSON.parse(result.content),
    model: result.model,
    creditsUsed: result.creditsUsed,
  });
});
```

### 12.4 Inventory Forecast Engine

```
Admin clicks "Forecast Inventory" on a product
        │
        ▼
┌── Data Assembly ─────────────────────────────────────────────────────┐
│  1. Sales data (90 days): daily units sold, revenue                   │
│  2. Current stock level & reorder threshold                           │
│  3. Seasonal patterns (if available)                                  │
│  4. Supplier lead time (from store settings)                          │
└──────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌── AI Analysis (Gemini 3 Pro) ──────────────────────────────────────┐
│  Returns JSON:                                                        │
│  {                                                                    │
│    "avgDailySales": 4.2,                                             │
│    "trend": "increasing",                                             │
│    "daysUntilStockout": 18,                                          │
│    "reorderDate": "2026-03-04",                                       │
│    "suggestedReorderQty": 200,                                        │
│    "seasonalFactor": "Spring uptick expected (+15%)",                 │
│    "confidence": "high",                                              │
│    "chartData": [{ "date": "...", "projected": 45, "actual": 48 }]  │
│  }                                                                    │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 13. Portfolio & Resume AI

### 13.1 Feature Overview

See [06 Portfolio & Resume](./06_Portfolio_and_Resume.md) for full implementation details.

| Feature | Model | Credits | Plan |
|---|---|---|---|
| Project description | Claude Sonnet 4.5 | 1 | Starter |
| Skill suggestions | Gemini 3 Flash | 1 | Free |
| Resume bullet improvement | Claude Sonnet 4.5 | 1 | Starter |
| Professional summary | Claude Sonnet 4.5 | 1 | Starter |
| Full resume rewrite | Claude Opus 4.6 | 5 | Enterprise |
| ATS score analysis | Gemini 3 Pro | 2 | Business |
| Portfolio SEO | Gemini 3 Flash | 1 | Free |

### 13.2 ATS Score Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  ATS Score Analysis                        [Re-analyze] [↗]  │
│                                                               │
│  Target Role: Senior Frontend Developer                       │
│  Job Description: 245 words analyzed                          │
│                                                               │
│          ┌─────────────────────┐                              │
│          │                     │                              │
│          │        78/100       │                              │
│          │    Overall Score    │                              │
│          │    ████████░░       │                              │
│          │                     │                              │
│          └─────────────────────┘                              │
│                                                               │
│  Score Breakdown:                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Keyword Match      ███████████████░░░░  75%  (30% wt)  │ │
│  │ Experience         ████████████████████  92%  (25% wt)  │ │
│  │ Skills Alignment   ██████████████░░░░░  70%  (20% wt)  │ │
│  │ Education          ████████████████░░░  80%  (15% wt)  │ │
│  │ Formatting         ██████████████████░  85%  (10% wt)  │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  ✅ Matched Keywords: React, TypeScript, Next.js, REST API    │
│  ❌ Missing Keywords: GraphQL, CI/CD, AWS, Agile             │
│                                                               │
│  💡 Suggestions:                                              │
│  1. Add "GraphQL" to your skills section                     │
│  2. Mention CI/CD experience in your work bullets            │
│  3. Include cloud platform experience (AWS/GCP)              │
│  4. Use more quantified results in your bullets              │
│                                                               │
│  [Apply AI Suggestions]  [Download Report]  [Share Score]    │
└──────────────────────────────────────────────────────────────┘
```

---

## 14. Landing Page & Blog AI

### 14.1 Feature Overview

| Feature | Model | Credits | Streaming | Description |
|---|---|---|---|---|
| Headline generation | Claude Sonnet 4.5 | 1 | No | 5 headline variations for A/B testing |
| CTA text optimization | Gemini 3 Flash | 1 | No | Button text + microcopy alternatives |
| Full section copy | Claude Sonnet 4.5 | 2 | Yes | Hero, features, testimonials, FAQ copy |
| Page section builder | Claude Sonnet 4.5 | 2 | Yes | Generates React/HTML code for sections |
| Blog draft | Claude Sonnet 4.5 | 3 | Yes | Full blog post from topic + outline |
| Blog SEO | Gemini 3 Flash | 1 | No | Meta tags, slug, excerpt optimization |

### 14.2 Blog Draft Generator

```typescript
app.post('/v1/ai/generate/blog-draft', authMiddleware(), storeMiddleware(), async (c) => {
  const schema = z.object({
    topic: z.string().min(5).max(200),
    outline: z.array(z.string()).optional(),
    length: z.enum(['short', 'medium', 'long']).default('medium'),
    tone: z.enum(['professional', 'casual', 'educational', 'storytelling']).default('professional'),
    targetKeywords: z.array(z.string()).optional(),
    includeImages: z.boolean().default(false),
  });

  const input = schema.parse(await c.req.json());
  const storeId = c.get('storeId');

  const LENGTH_MAP = { short: '500-800', medium: '1000-1500', long: '2000-3000' };

  const result = await generateAI(c.env, {
    task: 'blog_draft',
    storeId,
    input: {
      ...input,
      wordCount: LENGTH_MAP[input.length],
    },
    options: { stream: true },
  });

  return result; // SSE stream
});
```

### 14.3 Headline A/B Generator

```typescript
app.post('/v1/ai/generate/headlines', authMiddleware(), storeMiddleware(), async (c) => {
  const schema = z.object({
    context: z.string().min(10),
    type: z.enum(['hero', 'feature', 'cta', 'email_subject']),
    count: z.number().min(3).max(10).default(5),
    maxLength: z.number().default(80),
  });

  const input = schema.parse(await c.req.json());

  const result = await generateAI(c.env, {
    task: 'headline_generation',
    storeId: c.get('storeId'),
    input,
  });

  // Parse multiple headlines from response
  const headlines = JSON.parse(result.content);

  return c.json({
    headlines,
    model: result.model,
    creditsUsed: result.creditsUsed,
    tip: 'Test 2-3 headlines with your audience to find the highest-converting option.',
  });
});
```

---

## 15. Content Moderation Pipeline

### 15.1 Architecture

```
Content Created/Updated (product, blog post, review, testimonial, profile)
    │
    ▼
┌── Moderation Queue (async) ──────────────────────────────────────────┐
│                                                                       │
│  1. Immediate check (synchronous, blocks publish if critical):        │
│     ├── Profanity filter (word list, regex) → block if severe         │
│     ├── URL/link scanner → flag external links                        │
│     └── Image NSFW check (if applicable) → block if unsafe           │
│                                                                       │
│  2. AI moderation (async job, runs within 30s):                       │
│     ├── Gemini 3 Flash analyzes content                               │
│     ├── Returns: safe / needs_review / blocked                        │
│     ├── Categories: spam, hate_speech, harassment, adult,             │
│     │    misleading, copyright, phishing                               │
│     └── Confidence score (0.0 - 1.0)                                  │
│                                                                       │
│  3. Action:                                                           │
│     ├── safe (confidence > 0.9) → auto-approve, publish              │
│     ├── needs_review (0.5 < confidence ≤ 0.9) → flag for review     │
│     └── blocked (confidence ≤ 0.5 or critical category) → hide       │
└──────────────────────────────────────────────────────────────────────┘
```

### 15.2 Moderation Schema

```sql
CREATE TABLE content_moderation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id        UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  content_type    TEXT NOT NULL,        -- product, blog_post, review, testimonial, profile
  content_id      UUID NOT NULL,        -- FK to the content table
  content_text    TEXT NOT NULL,         -- the text that was moderated

  -- AI result
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending','safe','needs_review','blocked','appealed','overridden')),
  categories      TEXT[] DEFAULT '{}',   -- spam, hate_speech, etc.
  confidence      NUMERIC(3,2),          -- 0.00 - 1.00
  ai_reasoning    TEXT,                  -- AI's explanation for the decision
  model_used      TEXT,

  -- Review
  reviewed_by     UUID REFERENCES auth.users(id),
  reviewed_at     TIMESTAMPTZ,
  review_action   TEXT,                  -- approved, rejected, escalated
  review_notes    TEXT,

  -- Appeal
  appeal_reason   TEXT,
  appeal_status   TEXT,                  -- pending, approved, rejected

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_moderation_store ON content_moderation(store_id, status, created_at DESC);
CREATE INDEX idx_moderation_pending ON content_moderation(status) WHERE status IN ('needs_review', 'appealed');
```

### 15.3 Moderation API

```typescript
// workers/api/src/ai/moderation.ts

export async function moderateContent(
  env: Env,
  storeId: string,
  contentType: string,
  contentId: string,
  text: string,
): Promise<ModerationResult> {
  // Step 1: Quick regex checks (synchronous)
  const quickCheck = runQuickFilters(text);
  if (quickCheck.blocked) {
    return { status: 'blocked', categories: quickCheck.categories, confidence: 1.0, reasoning: 'Blocked by content filter' };
  }

  // Step 2: AI moderation (Gemini Flash — free, platform cost)
  const result = await generateAI(env, {
    task: 'content_moderation',
    storeId: 'platform', // platform cost, not user credits
    input: {
      contentType,
      text: text.substring(0, 2000), // limit input
      context: `Content from store ${storeId}, type: ${contentType}`,
    },
  });

  const parsed = JSON.parse(result.content);

  // Step 3: Save to moderation table
  const supabase = createServiceClient(env);
  await supabase.from('content_moderation').insert({
    store_id: storeId,
    content_type: contentType,
    content_id: contentId,
    content_text: text.substring(0, 500),
    status: parsed.status,
    categories: parsed.categories,
    confidence: parsed.confidence,
    ai_reasoning: parsed.reasoning,
    model_used: result.model,
  });

  // Step 4: Auto-publish if safe
  if (parsed.status === 'safe' && parsed.confidence > 0.9) {
    await autoPublishContent(supabase, contentType, contentId);
  }

  return parsed;
}
```

### 15.4 Super-Admin Moderation Queue UI

```
┌──────────────────────────────────────────────────────────────┐
│  Content Moderation Queue                    [Filter ▼] [⟳]  │
│  12 items need review                                         │
│                                                               │
│  ┌─ Flagged ─────────────────────────────────────────────── │
│  │ 🟡 Product: "Weight Loss Miracle Pill"                    │
│  │    Store: healthylife.letbuyy.store                       │
│  │    Category: misleading (78% confidence)                  │
│  │    Reason: "Claims of guaranteed weight loss without      │
│  │    evidence. May violate advertising standards."           │
│  │    [Approve] [Reject] [Escalate] [View Full]              │
│  ├───────────────────────────────────────────────────────── │
│  │ 🟡 Blog Post: "How to hack your competition"             │
│  │    Store: techblog.letbuyy.store                          │
│  │    Category: needs_review (62% confidence)                │
│  │    Reason: "Title may imply unethical practices,          │
│  │    but content appears to be legitimate marketing advice"  │
│  │    [Approve] [Reject] [Escalate] [View Full]              │
│  ├───────────────────────────────────────────────────────── │
│  │ 🔴 Review: "This product is $#@% garbage"                │
│  │    Store: gadgets.letbuyy.store                           │
│  │    Category: profanity (95% confidence)                   │
│  │    Reason: "Contains explicit profanity"                   │
│  │    [Approve] [Reject] [Escalate] [View Full]              │
│  └───────────────────────────────────────────────────────── │
└──────────────────────────────────────────────────────────────┘
```

---

## 16. Admin AI Tools

### 16.1 Smart Analytics (Natural Language)

```typescript
// workers/api/src/routes/ai/analytics.ts

app.post('/v1/ai/analyze/store-insights', authMiddleware(), storeMiddleware(), async (c) => {
  const schema = z.object({
    query: z.string().min(5).max(500),
    dateRange: z.enum(['7d', '30d', '90d', 'all']).default('30d'),
  });

  const { query, dateRange } = schema.parse(await c.req.json());
  const storeId = c.get('storeId');
  const siteType = c.get('siteType');
  const supabase = createServiceClient(c.env);

  // Fetch relevant metrics based on site type
  const metrics = await fetchStoreMetrics(supabase, storeId, siteType, dateRange);

  const result = await generateAI(c.env, {
    task: 'analytics_insight',
    storeId,
    input: {
      query,
      siteType,
      metrics: JSON.stringify(metrics),
      dateRange,
    },
  });

  return c.json({
    insight: result.content,
    metricsUsed: Object.keys(metrics),
    model: result.model,
    creditsUsed: result.creditsUsed,
  });
});

// Example queries:
// "How did my store perform last week?"
// "Which products should I discount?"
// "What's my best traffic source?"
// "Show me my conversion funnel"
```

### 16.2 NL Analytics Dashboard Widget

```
┌──────────────────────────────────────────────────────────────┐
│  🤖 AI Insights                                 [1 credit]   │
│                                                               │
│  Ask anything about your store:                               │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ How did my store perform last week?                 [→] │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  📊 Your store had a strong week:                             │
│                                                               │
│  • Revenue: ₹24,500 (+18% vs previous week)                  │
│  • Orders: 34 (+12%)                                          │
│  • Best seller: "Wireless Earbuds Pro" (8 units)             │
│  • Avg order value: ₹720 (↑ from ₹680)                      │
│  • Top traffic source: Instagram (42%)                        │
│                                                               │
│  💡 Recommendation: Your "Leather Wallet" is trending         │
│  upward — consider featuring it on your homepage.             │
│                                                               │
│  Suggested queries:                                           │
│  [Which products should I restock?]                           │
│  [What's my customer retention rate?]                         │
│  [Compare this month to last month]                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 17. Super-Admin AI Tools

### 17.1 Platform-Level AI (No User Credits)

These tools run at the platform level and are funded by LetBuyy, not individual stores.

| Tool | Model | Description | Trigger |
|---|---|---|---|
| Content Moderation | Gemini 3 Flash | Auto-flag inappropriate content | On content publish |
| Fraud Detection | Gemini 3 Pro | Suspicious pattern identification | On order/signup |
| Support Ticket Triage | Gemini 3 Flash | Auto-categorize + prioritize tickets | On ticket creation |
| Operational Insights | Gemini 3 Pro | Platform health summaries | Daily cron |
| Anomaly Detection | Gemini 3 Pro | Spike/drop alerting | Hourly cron |
| Cost Optimization | Gemini 3 Pro | AI spend analysis + routing optimization | Weekly cron |

### 17.2 Fraud Detection Engine

```typescript
// workers/api/src/ai/fraud.ts

export async function detectFraud(
  env: Env,
  event: {
    type: 'order' | 'signup' | 'payment';
    storeId: string;
    data: Record<string, any>;
  },
): Promise<{ riskScore: number; flags: string[]; action: 'allow' | 'review' | 'block' }> {
  const signals = await gatherFraudSignals(env, event);

  const result = await generateAI(env, {
    task: 'content_moderation', // reuse moderation slot (platform cost)
    storeId: 'platform',
    input: {
      type: 'fraud_detection',
      event: event.type,
      signals: JSON.stringify(signals),
      instructions: `Analyze these signals for fraud risk. Return JSON:
      {
        "riskScore": 0-100,
        "flags": ["velocity_anomaly", "geo_mismatch", etc.],
        "action": "allow" | "review" | "block",
        "reasoning": "..."
      }`,
    },
  });

  return JSON.parse(result.content);
}

async function gatherFraudSignals(env: Env, event: any) {
  const redis = createRedis(env);
  return {
    // Velocity checks
    ordersLast24h: await redis.get(`fraud:orders:${event.storeId}:${today()}`),
    signupsFromIP: await redis.get(`fraud:ip:${event.data.ip}:${today()}`),
    // Geo checks
    ipCountry: event.data.ipCountry,
    billingCountry: event.data.billingCountry,
    shippingCountry: event.data.shippingCountry,
    // Pattern checks
    emailAge: event.data.emailCreatedDaysAgo,
    orderAmount: event.data.amount,
    isNewCustomer: event.data.isFirstOrder,
    paymentMethod: event.data.paymentMethod,
  };
}
```

### 17.3 Anomaly Detection (Cron)

```typescript
// workers/api/src/cron/anomaly-detection.ts

export async function detectAnomalies(env: Env): Promise<void> {
  const supabase = createServiceClient(env);

  // Gather platform-wide metrics (last 24h vs 7-day average)
  const metrics = await supabase.rpc('get_platform_metrics_comparison');

  const thresholds = {
    signupSpike: 2.0,       // 2× normal = alert
    orderDrop: 0.5,         // 50% drop = alert
    errorRateSpike: 3.0,    // 3× normal = critical
    aiCostSpike: 2.5,       // 2.5× normal = alert
    paymentFailureSpike: 2.0,
  };

  const alerts: string[] = [];

  if (metrics.signups_24h > metrics.avg_signups_7d * thresholds.signupSpike) {
    alerts.push(`🚨 Signup spike: ${metrics.signups_24h} (avg: ${metrics.avg_signups_7d})`);
  }
  if (metrics.orders_24h < metrics.avg_orders_7d * thresholds.orderDrop) {
    alerts.push(`📉 Order drop: ${metrics.orders_24h} (avg: ${metrics.avg_orders_7d})`);
  }
  if (metrics.error_rate_24h > metrics.avg_error_rate_7d * thresholds.errorRateSpike) {
    alerts.push(`🔴 Error rate spike: ${metrics.error_rate_24h}% (avg: ${metrics.avg_error_rate_7d}%)`);
  }
  if (metrics.ai_cost_24h > metrics.avg_ai_cost_7d * thresholds.aiCostSpike) {
    alerts.push(`💰 AI cost spike: $${metrics.ai_cost_24h} (avg: $${metrics.avg_ai_cost_7d})`);
  }

  if (alerts.length > 0) {
    // Send alerts to super admin
    await sendSlackAlert(env, {
      channel: '#platform-alerts',
      title: `⚠️ ${alerts.length} Anomalies Detected`,
      alerts,
      dashboard: 'https://console.letbuyy.store/health',
    });

    // Also use AI to provide context
    const aiInsight = await generateAI(env, {
      task: 'analytics_insight',
      storeId: 'platform',
      input: { query: 'Analyze these anomalies and suggest root causes', metrics: JSON.stringify(metrics), alerts },
    });

    await supabase.from('platform_alerts').insert({
      type: 'anomaly',
      severity: alerts.some(a => a.includes('🔴')) ? 'critical' : 'warning',
      alerts,
      ai_analysis: aiInsight.content,
    });
  }
}
```

---

## 18. AI Studio Interface

### 18.1 AI Studio Dashboard

```
┌──────────────────────────────────────────────────────────────┐
│  🤖 AI Studio                                                │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Credit Balance                                               │
│  ┌────────────────────────────────────────────────┐          │
│  │  42 / 50 credits remaining     [Buy More]     │          │
│  │  ████████████████████████████████████░░░░░░    │          │
│  │  Resets in 18 days  •  Plan: Starter           │          │
│  └────────────────────────────────────────────────┘          │
│                                                               │
│  Quick Actions                                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ ✏️ Write  │ │ 🔍 SEO   │ │ 📊 Analyze│ │ 📝 Blog  │       │
│  │ Product  │ │ Optimize │ │ Pricing  │ │ Draft    │       │
│  │ Copy     │ │          │ │          │ │          │       │
│  │ 1 credit │ │ 1 credit │ │ 1 credit │ │ 3 credits│       │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘       │
│                                                               │
│  Usage Today: 3 calls  •  Tokens: 2,450 in / 1,830 out      │
│                                                               │
│  ─── Recent Generations ─────────────────────────────────── │
│  │ 🕐 10:32 AM │ Product desc (short)  │ Flash  │ 1 cr │   │
│  │ 🕐 10:28 AM │ SEO meta tags         │ Flash  │ 1 cr │   │
│  │ 🕐 09:15 AM │ Blog draft            │ Sonnet │ 3 cr │   │
│  ────────────────────────────────────────────────────────── │
│                                                               │
│  [View Full Usage History]                                    │
└──────────────────────────────────────────────────────────────┘
```

### 18.2 Usage History Page

```
┌──────────────────────────────────────────────────────────────┐
│  AI Usage History              [Last 30 days ▼] [Export CSV] │
│                                                               │
│  Monthly Summary:                                             │
│  8 credits used  •  12 calls  •  4,280 tokens consumed       │
│                                                               │
│  ┌──────┬────────────────────┬────────┬──────┬──────┬──────┐│
│  │ Time │ Feature            │ Model  │ Cr.  │ In   │ Out  ││
│  ├──────┼────────────────────┼────────┼──────┼──────┼──────┤│
│  │10:32 │Product desc (short)│ Flash  │  1   │ 280  │ 180  ││
│  │10:28 │SEO meta tags       │ Flash  │  1   │ 195  │ 142  ││
│  │09:15 │Blog draft          │ Sonnet │  3   │ 520  │1,840 ││
│  │09:02 │Resume bullets      │ Sonnet │  1   │ 380  │ 290  ││
│  │ Yest │Smart pricing       │ Pro    │  1   │ 950  │ 480  ││
│  │ Yest │Headline generation │ Sonnet │  1   │ 180  │ 310  ││
│  └──────┴────────────────────┴────────┴──────┴──────┴──────┘│
│                                                               │
│  Model Distribution:                                          │
│  Flash: 5 calls (42%)  Sonnet: 4 calls (33%)  Pro: 3 (25%)  │
│                                                               │
│  [← Prev Page]  Page 1 of 3  [Next Page →]                   │
└──────────────────────────────────────────────────────────────┘
```

---

## 19. Database Schema (AI)

```sql
-- ═══════════════════════════════════════════════════════════════
-- AI Usage Tracking (every AI call is logged here)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE ai_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  feature TEXT NOT NULL,          -- 'product_description', 'resume_rewrite', etc.
  provider TEXT NOT NULL,         -- 'google', 'anthropic'
  model TEXT NOT NULL,            -- 'gemini-3-flash', 'claude-opus-4.6'
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,
  credits_used NUMERIC(10,2) NOT NULL,
  actual_cost NUMERIC(10,4),      -- provider cost in USD
  latency_ms INTEGER,
  status TEXT DEFAULT 'success' CHECK (status IN ('success','error','cached','fallback')),
  fallback_model TEXT,            -- if used fallback, which model
  error_message TEXT,
  cached BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- AI Content Cache (Postgres fallback for Redis cache misses)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE ai_content_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  content JSONB NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER,
  output_tokens INTEGER,
  tokens_saved INTEGER DEFAULT 0,
  hit_count INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- AI Credits (source of truth — Redis caches this)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE ai_credits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID REFERENCES stores(id) ON DELETE CASCADE UNIQUE,
  plan TEXT DEFAULT 'free',
  monthly_allocation NUMERIC(10,2) DEFAULT 10,
  current_balance NUMERIC(10,2) DEFAULT 10,
  purchased_balance NUMERIC(10,2) DEFAULT 0,
  total_used NUMERIC(10,2) DEFAULT 0,
  total_tokens_consumed BIGINT DEFAULT 0,
  last_reset_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- Credit Transactions (purchase audit trail)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE credit_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase','monthly_reset','rollover','bonus','refund','admin_grant')),
  credits NUMERIC(10,2) NOT NULL,
  amount_cents INTEGER,                -- payment amount (for purchases)
  stripe_payment_id TEXT,
  pack_id TEXT,                        -- micro, small, medium, large, jumbo
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- Content Moderation Queue
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE content_moderation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL,
  content_id UUID NOT NULL,
  content_text TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','safe','needs_review','blocked','appealed','overridden')),
  categories TEXT[] DEFAULT '{}',
  confidence NUMERIC(3,2),
  ai_reasoning TEXT,
  model_used TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  review_action TEXT,
  review_notes TEXT,
  appeal_reason TEXT,
  appeal_status TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- Indexes
-- ═══════════════════════════════════════════════════════════════
CREATE INDEX idx_ai_usage_store ON ai_usage(store_id, created_at DESC);
CREATE INDEX idx_ai_usage_feature ON ai_usage(feature, created_at DESC);
CREATE INDEX idx_ai_usage_model ON ai_usage(model, created_at DESC);
CREATE INDEX idx_ai_usage_cost ON ai_usage(store_id, actual_cost);
CREATE INDEX idx_ai_cache_key ON ai_content_cache(cache_key);
CREATE INDEX idx_ai_cache_expires ON ai_content_cache(expires_at);
CREATE INDEX idx_credit_tx_store ON credit_transactions(store_id, created_at DESC);
CREATE INDEX idx_moderation_store ON content_moderation(store_id, status, created_at DESC);
CREATE INDEX idx_moderation_pending ON content_moderation(status) WHERE status IN ('needs_review', 'appealed');

-- ═══════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI usage"
  ON ai_usage FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "Users can view own credits"
  ON ai_credits FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
CREATE POLICY "Users can view own credit transactions"
  ON credit_transactions FOR SELECT USING (store_id IN (SELECT id FROM stores WHERE user_id = auth.uid()));
```

---

## 20. API Routes (AI)

| Method | Route | Description | Credits | Model | Plan |
|---|---|---|---|---|---|
| `POST` | `/v1/ai/generate` | Universal AI generation endpoint | Varies | Auto-routed | Varies |
| `POST` | `/v1/ai/generate/product-description` | Generate product description | 1-2 | Flash/Sonnet | Free/Starter |
| `POST` | `/v1/ai/generate/seo-meta` | Generate SEO meta tags | 1 | Flash | Free |
| `POST` | `/v1/ai/generate/product-tags` | Auto-generate product tags | 1 | Flash | Free |
| `POST` | `/v1/ai/generate/portfolio-description` | Generate project description | 1 | Sonnet | Starter |
| `POST` | `/v1/ai/generate/resume-bullets` | Improve resume bullets | 1 | Sonnet | Starter |
| `POST` | `/v1/ai/generate/resume-summary` | Professional summary | 1 | Sonnet | Starter |
| `POST` | `/v1/ai/generate/resume-rewrite` | Full resume rewrite | 5 | Opus | Enterprise |
| `POST` | `/v1/ai/generate/landing-copy` | Generate landing copy | 2 | Sonnet | Starter |
| `POST` | `/v1/ai/generate/headlines` | Headline A/B variations | 1 | Sonnet | Starter |
| `POST` | `/v1/ai/generate/blog-draft` | Full blog post draft | 3 | Sonnet | Starter |
| `POST` | `/v1/ai/generate/blog-seo` | Blog SEO optimization | 1 | Flash | Free |
| `POST` | `/v1/ai/generate/email-template` | Generate email template | 1 | Flash | Free |
| `POST` | `/v1/ai/generate/page-section` | AI page section builder | 2 | Sonnet | Starter |
| `POST` | `/v1/ai/analyze/pricing` | Smart pricing analysis | 1 | Pro | Business |
| `POST` | `/v1/ai/analyze/ats-score` | ATS compatibility check | 2 | Pro | Business |
| `POST` | `/v1/ai/analyze/store-insights` | NL analytics query | 1 | Pro | Business |
| `POST` | `/v1/ai/analyze/inventory-forecast` | Inventory prediction | 2 | Pro | Business |
| `POST` | `/v1/ai/audit/content` | Full content audit | 8 | Opus | Enterprise |
| `GET` | `/v1/ai/credits` | Get credit balance + usage | — | — | All |
| `POST` | `/v1/ai/credits/purchase` | Buy credit pack | — | — | All |
| `GET` | `/v1/ai/usage` | Usage history (paginated) | — | — | All |
| `GET` | `/v1/ai/usage/stats` | Usage stats by model/feature | — | — | All |
| `GET` | `/v1/ai/usage/tokens` | Token consumption breakdown | — | — | All |
| `GET` | `/v1/ai/session` | Current session state (Redis) | — | — | All |
| `GET` | `/v1/ai/models` | Available models for plan | — | — | All |

---

## 21. Testing Strategy

### 21.1 Unit Tests

```typescript
// __tests__/ai/routing.test.ts

import { describe, it, expect } from 'vitest';
import { TASK_ROUTING } from '@/ai/routing';
import { createCacheKey, parseAIOutput } from '@/ai/cache';

describe('Task Routing', () => {
  it('all tasks have valid primary models', () => {
    const validModels = ['gemini-3-flash', 'gemini-3-pro', 'claude-sonnet-4.5', 'claude-opus-4.6'];
    for (const [task, config] of Object.entries(TASK_ROUTING)) {
      expect(validModels).toContain(config.primary);
      if (config.fallback) expect(validModels).toContain(config.fallback);
    }
  });

  it('free tasks should use Flash model', () => {
    const freeTasks = Object.entries(TASK_ROUTING).filter(([, c]) => c.requiresPlan === 'free');
    for (const [task, config] of freeTasks) {
      expect(config.primary).toBe('gemini-3-flash');
    }
  });

  it('enterprise-only tasks have high credit costs', () => {
    const enterpriseTasks = Object.entries(TASK_ROUTING).filter(([, c]) => c.requiresPlan === 'enterprise');
    for (const [task, config] of enterpriseTasks) {
      expect(config.creditCost).toBeGreaterThanOrEqual(5);
    }
  });

  it('streamable tasks should use creative models', () => {
    const streamable = Object.entries(TASK_ROUTING).filter(([, c]) => c.streamable);
    for (const [task, config] of streamable) {
      expect(['claude-sonnet-4.5', 'claude-opus-4.6']).toContain(config.primary);
    }
  });
});

describe('Cache Key Generation', () => {
  it('produces consistent keys for same input', () => {
    const k1 = createCacheKey('seo_meta_tags', { url: '/products/shirt' }, 'gemini-3-flash');
    const k2 = createCacheKey('seo_meta_tags', { url: '/products/shirt' }, 'gemini-3-flash');
    expect(k1).toBe(k2);
  });

  it('produces different keys for different inputs', () => {
    const k1 = createCacheKey('seo_meta_tags', { url: '/products/shirt' }, 'gemini-3-flash');
    const k2 = createCacheKey('seo_meta_tags', { url: '/products/pants' }, 'gemini-3-flash');
    expect(k1).not.toBe(k2);
  });
});

describe('Output Parsing', () => {
  it('parses valid JSON for structured tasks', () => {
    const result = parseAIOutput('smart_pricing', JSON.stringify({
      suggestedPrice: 29.99,
      priceRange: { min: 19.99, max: 39.99 },
      confidence: 'high',
      reasoning: 'Based on market analysis',
      competitorInsights: ['Competitor A: $24.99'],
      pricingStrategy: 'Competitive pricing',
    }));
    expect(result.valid).toBe(true);
    expect(result.parsed.suggestedPrice).toBe(29.99);
  });

  it('returns raw text for unstructured tasks', () => {
    const result = parseAIOutput('product_description_short', 'A beautiful leather wallet.');
    expect(result.valid).toBe(true);
    expect(result.parsed).toBe('A beautiful leather wallet.');
  });

  it('handles markdown-wrapped JSON', () => {
    const result = parseAIOutput('resume_bullets', '```json\n["Led team of 5", "Increased sales by 30%"]\n```');
    expect(result.valid).toBe(true);
    expect(result.parsed).toHaveLength(2);
  });
});
```

### 21.2 Integration Tests

```typescript
// __tests__/ai/gateway.integration.test.ts

import { describe, it, expect, vi } from 'vitest';

describe('AI Gateway', () => {
  it('deducts credits on successful generation', async () => {
    const res = await testClient.post('/v1/ai/generate', {
      task: 'product_description_short',
      input: { title: 'Test Product', category: 'Electronics' },
    });
    expect(res.status).toBe(200);
    expect(res.body.creditsUsed).toBe(1);

    const credits = await testClient.get('/v1/ai/credits');
    expect(credits.body.balance).toBe(9); // started with 10
  });

  it('returns 422 when credits exhausted', async () => {
    // Exhaust credits
    await setCredits(testStoreId, 0);

    const res = await testClient.post('/v1/ai/generate', {
      task: 'product_description_short',
      input: { title: 'Test Product', category: 'Electronics' },
    });
    expect(res.status).toBe(422);
    expect(res.body.error).toBe('INSUFFICIENT_CREDITS');
  });

  it('returns 403 when model not in plan', async () => {
    // Free plan trying to use Opus
    const res = await testClient.post('/v1/ai/generate', {
      task: 'resume_full_rewrite',
      input: { resumeData: {} },
    });
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('PLAN_UPGRADE_REQUIRED');
  });

  it('falls back to secondary model on primary failure', async () => {
    // Mock Flash to fail
    vi.spyOn(googleProvider, 'generate').mockRejectedValueOnce(new Error('Rate limited'));

    const res = await testClient.post('/v1/ai/generate', {
      task: 'product_description_short',
      input: { title: 'Test', category: 'Fashion' },
    });
    expect(res.status).toBe(200);
    expect(res.body.model).toBe('claude-sonnet-4.5'); // fallback used
  });

  it('serves cached response without deducting credits', async () => {
    // First call
    const res1 = await testClient.post('/v1/ai/generate', {
      task: 'seo_meta_tags',
      input: { url: '/products/test', content: 'Test product page' },
    });
    expect(res1.body.cached).toBe(false);

    // Second identical call
    const res2 = await testClient.post('/v1/ai/generate', {
      task: 'seo_meta_tags',
      input: { url: '/products/test', content: 'Test product page' },
    });
    expect(res2.body.cached).toBe(true);
    expect(res2.body.creditsUsed).toBe(0);
  });
});
```

### 21.3 Prompt Quality Evaluation

```typescript
// __tests__/ai/prompt-eval.test.ts

describe('Prompt Quality', () => {
  it('product descriptions mention key features', async () => {
    const result = await generateAI({
      task: 'product_description_short',
      input: { title: 'Wireless Earbuds Pro', category: 'Electronics', features: ['noise cancelling', 'Bluetooth 5.3', '30hr battery'] },
    });

    const description = result.content.toLowerCase();
    expect(description).toContain('noise cancel');
    expect(description).toContain('bluetooth');
    expect(description.length).toBeGreaterThan(50);
    expect(description.length).toBeLessThan(500);
  });

  it('ATS scores return valid JSON with required fields', async () => {
    const result = await generateAI({
      task: 'ats_score',
      input: {
        resumeData: mockResumeData,
        targetRole: 'Frontend Developer',
        jobDescription: 'Looking for React + TypeScript developer...',
      },
    });

    const parsed = JSON.parse(result.content);
    expect(parsed.overallScore).toBeGreaterThanOrEqual(0);
    expect(parsed.overallScore).toBeLessThanOrEqual(100);
    expect(parsed.suggestions).toBeInstanceOf(Array);
    expect(parsed.sections).toHaveProperty('keywordMatch');
  });
});
```

---

## 22. Cost Analysis & Projections

### 22.1 Estimated Monthly AI Provider Costs (1,000 Users)

| Plan | Users | Avg Calls/mo/User | Avg Model Mix | Est. Provider Cost/User | Total |
|---|---|---|---|---|---|
| Free | 500 | 8 | 100% Flash | $0.006 | $3.00 |
| Starter | 300 | 30 | 70% Flash, 30% Sonnet | $0.05 | $15.00 |
| Business | 150 | 80 | 40% Flash, 30% Pro, 30% Sonnet | $0.25 | $37.50 |
| Enterprise | 50 | 200 | 30% Flash, 25% Pro, 30% Sonnet, 15% Opus | $1.50 | $75.00 |
| **Total** | **1,000** | | | | **$130.50/mo** |

### 22.2 Revenue vs Cost

| Plan | Users | AI Revenue/mo | AI Cost/mo | Net AI Margin |
|---|---|---|---|---|
| Free | 500 | $0 (included) | $3.00 | -$3.00 |
| Starter | 300 | $2,700 | $15.00 | $2,685 |
| Business | 150 | $4,350 | $37.50 | $4,312.50 |
| Enterprise | 50 | $4,950 | $75.00 | $4,875 |
| Top-ups (est.) | ~200 | $600 | $24.00 | $576 |
| **Total** | **1,000** | **$12,600** | **$154.50** | **$12,445.50** |

> **AI cost is ~1.2% of AI revenue** — excellent margin.

### 22.3 Scaling Projections

| Users | Monthly AI Calls | Monthly Tokens | Provider Cost | AI Revenue | Cache Savings |
|---|---|---|---|---|---|
| 1,000 | 25,000 | 15M | $130 | $12,600 | ~$45 |
| 5,000 | 125,000 | 75M | $650 | $63,000 | ~$230 |
| 10,000 | 250,000 | 150M | $1,300 | $126,000 | ~$455 |
| 50,000 | 1,250,000 | 750M | $6,500 | $630,000 | ~$2,275 |

### 22.4 Cost Optimization Strategies

| Strategy | Est. Savings | Implementation |
|---|---|---|
| **Response caching** | 35-40% | Redis + Postgres two-tier cache |
| **Prompt caching (Anthropic)** | Up to 90% | Cache system prompts with store context |
| **Context caching (Google)** | 50-75% | Cache repeated instructions |
| **Batch API (off-peak)** | 50% | Bulk descriptions, SEO tags via batch |
| **Model optimization** | 15-20% | Route more tasks to Flash where quality sufficient |
| **Token optimization** | 10-15% | Minimize prompt size, output max tokens |
| **Smart routing** | 5-10% | Switch models based on real-time pricing changes |

### 22.5 Infrastructure Costs (AI-Related)

| Service | Monthly Cost | Purpose |
|---|---|---|
| **Upstash Redis** | ~$10-30 | Rate limiting, session management, caching |
| **Google AI API** | ~$50-100 | Gemini model calls |
| **Anthropic API** | ~$50-100 | Claude model calls |
| **Cloudflare Workers** | $5 (paid plan) | AI gateway processing |
| **Supabase** | Included in plan | Usage logging, credit tracking |
| **Total** | **$115-235/mo** | For 1,000 active stores |

---

## 23. Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 7.0 | Feb 14, 2026 | AI-Enhanced | Major expansion — 23 sections, full implementations, testing, UI wireframes |
| 6.0 | Feb 14, 2026 | AI-Enhanced | Initial structured documentation with 12 sections |
| 5.0 | Feb 13, 2026 | Platform | AI architecture and credit system |
| 4.0 | Feb 12, 2026 | Platform | Model pricing and task routing |

---

> **Cross-references:**
> - [00_Overview.md](./00_Overview.md) — Platform overview, 4-model AI engine, AI-first content creation
> - [01_Architecture.md](./01_Architecture.md) — AI Service Layer (§5), Router implementation, streaming, prompt templates
> - [02_Authentication_and_Security.md](./02_Authentication_and_Security.md) — Auth middleware used by AI gateway
> - [04_Admin_Dashboard.md](./04_Admin_Dashboard.md) — AI Studio sidebar nav, dashboard AI widgets
> - [05_Ecommerce_Engine.md](./05_Ecommerce_Engine.md) — Product descriptions, smart pricing, inventory forecast
> - [06_Portfolio_and_Resume.md](./06_Portfolio_and_Resume.md) — ATS scoring, resume rewrite, portfolio AI features

---

> **Next:** [08 Database Schema](./08_Database_Schema.md) — Complete database schema reference

---

*[← Back to Index](./README.md)*
