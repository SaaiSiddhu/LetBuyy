# Infrastructure Review Panel — Phase 9
**Reviewer:** Principal Infrastructure Architect (independent, Phase 9)
**Date:** 2026-06-20
**Scope:** LCIS Future Model, IA, Repository Archaeology — infrastructure lens only

---

## 1. AGREE — and why

The build-time-artifact + in-memory serve model is the **correct foundation**. `graph.json` is 44MB; `graphify-out/` total is 76MB. These are files, not a database — they load once at process start (`readFileSync` at lines 86–115 of `server.mjs`), stay in-memory, and answer queries in under 10ms without touching any external store. This is exactly how Vercel Edge Config and Cloudflare Workers with bundled data work at scale. The CI pipeline (`graph-intelligence.yml`) already regenerates the subset of artifacts derivable from the repo (db-intel, infra-intel, domain-intel, 30+ more) without the Graphify binary — proof that the refresh loop is real, not aspirational. The `live-adapters.mjs` credential model is sound: read `process.env`, return real data or `NOT CONNECTED + exact env var name`, no secret ever emitted in a response.

---

## 2. CHALLENGE — sharpest

**The artifact-as-cache model breaks at Vercel/Cloudflare deploy boundaries — and the proposal has no answer for this.**

Evidence chain:
- `graphify-out/` is in `.gitignore` (confirmed). Vercel and Cloudflare Workers build from the git checkout. At deploy time, `graphify-out/graph.json` (44MB) **does not exist in the repo**. The CI workflow uploads it as a GitHub Actions artifact (`retention-days: 14`) — not to any persistent store the Vercel build can read.
- `graph.json` requires the `graphify` binary (`graphifyy v0.8.39`, installed at `~/.local/bin/graphify`) which is a developer-local tool, not installable inside a standard Vercel/Cloudflare build runner. The db-intel, infra-intel, and domain-intel subsets *can* be regenerated in CI from SQL and TS source without the binary — but the 52,246-node code graph cannot.
- 76MB of JSON loaded synchronously at startup (`readFileSync`) exceeds Cloudflare Workers' 128MB memory limit and the 5MB bundle limit for subrequest responses. Vercel Serverless (1GB RAM, 250MB compressed bundle) could host the files, but cold-start time loading 76MB synchronously would destroy the <50ms target — Node `JSON.parse` on a 44MB file typically takes 800–1400ms.
- The proposal says "pre-computed artifacts = the primary cache" and "startup loads them once." This is fine for a **long-lived process** (the current `pnpm graph:ui` local server). It is **not fine** for serverless or edge runtimes, which restart on every cold start. A Vercel Serverless Function cold-starting with 76MB of JSON parse will blow the 50ms budget before serving a single request.

This is the central infrastructure gap: the proposal specifies `apps/lcis` as a real deploy target with `<50ms` interactions but does not name the runtime that can satisfy both "load 76MB of JSON" and "start in <50ms." Without that decision, the entire IA and experience architecture is designed for a runtime that does not yet exist.

---

## 3. MISSING

**Deployment runtime decision.** The proposal is silent on whether `apps/lcis` is a Vercel Next.js app (like the other 5 real apps), a Cloudflare Worker, or a long-lived process (Fly.io / Railway / bare VPS). Each has a different answer to the cold-start vs. artifact-size tradeoff.

**Artifact storage for the 44MB code graph in production.** Three viable options — none discussed:
1. **Commit the pre-computed artifacts** (break gitignore, accept a large-blob repo — messy but simple).
2. **Store artifacts in Vercel Blob / Cloudflare R2 / Supabase Storage**, fetched at startup and cached in module scope for the process lifetime (works for long-lived, breaks for serverless cold starts).
3. **Pre-bundle the artifacts into the Next.js build output** via `next.config.js` `outputFileTracing` inclusion — possible for the smaller JSONs, but 76MB total makes this a bundler problem.

**Refresh-to-serve latency in production.** CI generates artifacts on every relevant push and uploads them as a GitHub Actions artifact (14-day retention). The path from "CI finishes" to "the deployed `apps/lcis` serves updated data" is unspecified. Options: re-deploy the app (Vercel webhook on artifact upload), write to a storage bucket the app reads from, or accept staleness until the next deploy.

**Credentials at runtime for live adapters.** The current model reads `process.env` at query time. On Vercel, env vars are set per-project in the dashboard (deploy-time injection) — this works and is the correct pattern. On Cloudflare Workers, secrets are bound via `wrangler secret put`. Neither requires secrets in the repo. But the IA describes an Admin role that can "configure adapters (presence only; never views secret values)" — this implies a runtime UI for checking credential presence, which means the app needs a way to check its own env at request time without leaking values. `process.env[k] ? 'SET' : 'NOT SET'` is sufficient and already implemented in `live-adapters.mjs` — but this needs to be explicit in the deployment spec so the Vercel project is configured before the first deploy.

**Zero-deps constraint is viable for the engine; not for `apps/lcis`.** The graph-server's "zero deps (Node http only)" is a local-dev constraint that correctly eliminates runtime risk. `apps/lcis` as a Next.js app will have React, Next, Tailwind, and likely `@letbuyy/ui` as deps — standard workspace deps. These are fine. The constraint to carry forward is zero *external runtime service* deps for structural queries (no Qdrant, no OpenAI, no Redis required to answer a blast-radius query) — which the pre-computed artifact model already satisfies.

---

## 4. Top 3–5 Recommendations

**1. Name the runtime before writing `apps/lcis`.** The two viable options:
- **Vercel Serverless + external artifact store (Vercel Blob or Supabase Storage):** Next.js API routes fetch the artifact JSON at module initialization and cache in module scope. Cold starts will parse 44MB of JSON once per instance lifetime — acceptable for a low-traffic internal tool if instance warm-up is acceptable. Set `maxDuration = 60` on the API routes to tolerate the first cold parse.
- **Single long-lived process (Fly.io / Railway):** Eliminates the cold-start problem entirely. The engine stays in-memory. Simpler operationally for a solo-founder internal tool; the cost is one always-on instance (~$5–7/month on Fly.io for 512MB). This is architecturally cleaner and matches the current `pnpm graph:ui` model exactly.

Vercel is the natural fit given the existing stack; a Vercel Fluid Compute function (the new always-warm option) would bridge both. Decide and document in the deployment spec before the first line of `apps/lcis` is written.

**2. Solve the artifact delivery gap with a concrete schema.** Define: (a) which artifacts are committed to git (the regenerable-without-Graphify subset: db-intel, infra-intel, domain-intel, memory-intel, and all derived JSONs — approximately 32MB of the 76MB); (b) which artifacts require Graphify and are stored in Vercel Blob / Supabase Storage (graph.json, 44MB); (c) the refresh trigger (CI on push → write to Blob → Next.js revalidation or redeploy webhook). This three-part schema converts "gitignored artifacts" from a blocker into a concrete pipeline. The `graph-intelligence.yml` CI step already runs; it needs one more step: `npx vercel-blob put graphify-out/graph.json` (or equivalent).

**3. Add a cold-start budget test to the CI sanity gate.** Before `apps/lcis` ships, add a CI step: `node -e "const start = Date.now(); require('./graphify-out/graph.json'); console.log('parse ms:', Date.now()-start)"`. If parse time exceeds 1500ms, the artifact is too large for synchronous cold-start and the delivery strategy must change (stream, paginate, or split). This gives a concrete, automatable gate rather than a design-time estimate.

**4. Explicitly commit the credential injection spec for live adapters.** Document: "Each live adapter's required env vars (e.g., `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_API_TOKEN`) are set as Vercel project environment variables — production scope only — via the Vercel dashboard before the adapter is considered wired. The Admin RBAC role can view `credentialsPresent: true/false` from `live-adapters.mjs:adapterStatus()` but never the value." This is one paragraph in the deployment spec that eliminates a future security question and confirms the `live-adapters.mjs` contract is the right abstraction.

**5. Clarify artifact staleness visibility in the UI.** The IA states "the app shows 'as of commit <sha> so staleness is visible, never silent.'" Implement this as a build-time constant injected at Next.js build time (`NEXT_PUBLIC_GRAPH_SHA=<sha>`) and displayed in the app header. In the artifact store model, add `generatedAt` and `sourceCommit` fields to each artifact JSON (most already have these from the generator scripts). The app reads `db-intel.json.generatedAt` and shows "DB graph: 6 hours ago · commit abc1234." No live timestamp call needed — pure static display of the artifact's own provenance.

---

## Path

The model is viable. The prerequisite is a runtime decision (recommendation 1) and an artifact delivery schema (recommendation 2) — both resolvable in one engineering session before `apps/lcis` is added to `pnpm-workspace.yaml`. The CI workflow is 80% of the refresh pipeline already; it needs the artifact-upload destination added. Credentials stay in Vercel project settings, never in the repo. The <50ms target is achievable for in-memory structural queries once cold-start is solved — live adapter calls will be 200–800ms (network-bound) and must be clearly labeled as such in the UX, which the IA already specifies.

*Independent external review — no code produced or modified.*
