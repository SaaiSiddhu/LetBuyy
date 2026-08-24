#!/usr/bin/env node
// S6/W2 — the concurrent-load harness. Answers ONE question: does rendering through Liquid
// degrade the storefront RELATIVE to React, under concurrent HTTP load, on the same machine, in
// the same run? Mirrors liquid-parity-harness.mjs's conventions (structured evidence output,
// documented run command, no tuning-to-pass) but measures HTTP latency/throughput, not semantic
// section content.
//
// WHAT THIS DOES: drives a REAL, ALREADY-RUNNING `next start` (production build) server over HTTP
// via the demo/preview A/B mechanism (app/preview/page.tsx's `demo=urban-kicks&engine=react|liquid
// &route_type=index|product|collection` — see S6-load-summary.md for why this route, not a direct
// renderer call, and its known content-parity caveats per surface). It does NOT start the server
// itself (the caller must already have `next start` running — see the documented run command
// below) and it makes ZERO writes anywhere.
//
// WHAT THIS DOES NOT DO: no unseeded randomness (interleaving is deterministic round-robin, not
// randomised — every re-run with the same flags hits scenarios in the same order); no closed-loop
// coordinated-omission bias (requests are scheduled at a fixed open-loop rate, not "wait for the
// last response before sending the next"); no mean-only reporting (full p50/p90/p95/p99/max
// distribution + throughput + status-code histogram, per scenario, per trial).
//
// Run (server must already be up — see docs/evidence/liquid-load/S6-load-summary.md for the exact
// command used to start it):
//   node apps/storefront-runtime/scripts/liquid-load-harness.mjs \
//     --base-url=http://localhost:3939 --rps=10 --duration=15 --warmup=3 --trials=3 \
//     --surfaces=index,product,collection \
//     --out=docs/evidence/liquid-load/S6-load-results.json

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import { performance } from 'node:perf_hooks';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

// ---------------------------------------------------------------------------------------------
// CLI args (no dependency — hand-parsed; this harness is small enough not to justify minimist/yargs)
// ---------------------------------------------------------------------------------------------
function parseArgs(argv) {
  const out = {};
  for (const raw of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(raw);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const BASE_URL = args['base-url'] || 'http://localhost:3939';
const TARGET_RPS = Number(args.rps || 10);
const DURATION_S = Number(args.duration || 15);
const WARMUP_S = Number(args.warmup || 3);
const TRIALS = Number(args.trials || 3);
const CONCURRENCY_CAP = Number(args.concurrency || 8);
const SURFACES = (args.surfaces || 'index,product,collection').split(',').map((s) => s.trim()).filter(Boolean);
const OUT_PATH = resolve(REPO_ROOT, args.out || 'docs/evidence/liquid-load/S6-load-results.json');
const REQUEST_TIMEOUT_MS = Number(args.timeout || 10_000);

const ENGINES = ['react', 'liquid'];

// ---------------------------------------------------------------------------------------------
// Scenarios — one per (surface, engine). Deterministic round-robin order, always the same array
// order every run (no Math.random anywhere in this file).
// ---------------------------------------------------------------------------------------------
function buildScenarios() {
  const scenarios = [];
  for (const surface of SURFACES) {
    for (const engine of ENGINES) {
      scenarios.push({
        label: `${surface}/${engine}`,
        surface,
        engine,
        url: `${BASE_URL}/preview?demo=urban-kicks&engine=${engine}&route_type=${surface}`,
      });
    }
  }
  return scenarios;
}

// ---------------------------------------------------------------------------------------------
// Percentile helpers — full distribution, never a bare mean.
// ---------------------------------------------------------------------------------------------
function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1);
  return sorted[Math.max(0, idx)];
}

function summarizeLatencies(samples) {
  const ok = samples.filter((s) => s.error === null).map((s) => s.latencyMs).sort((a, b) => a - b);
  const errored = samples.filter((s) => s.error !== null);
  const statusHistogram = {};
  for (const s of samples) {
    const key = s.status === null ? 'network_error' : String(s.status);
    statusHistogram[key] = (statusHistogram[key] || 0) + 1;
  }
  const mean = ok.length > 0 ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : null;
  return {
    count: samples.length,
    okCount: ok.length,
    errorCount: errored.length,
    p50: percentile(ok, 0.50),
    p90: percentile(ok, 0.90),
    p95: percentile(ok, 0.95),
    p99: percentile(ok, 0.99),
    max: ok.length > 0 ? ok[ok.length - 1] : null,
    min: ok.length > 0 ? ok[0] : null,
    mean,
    statusHistogram,
  };
}

function mean(values) {
  const v = values.filter((x) => x !== null && x !== undefined);
  return v.length > 0 ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function stddev(values) {
  const v = values.filter((x) => x !== null && x !== undefined);
  if (v.length < 2) return 0;
  const m = mean(v);
  const variance = v.reduce((sum, x) => sum + (x - m) ** 2, 0) / (v.length - 1);
  return Math.sqrt(variance);
}

// ---------------------------------------------------------------------------------------------
// One request against one scenario, with a hard timeout so a hung request cannot stall the whole run.
// ---------------------------------------------------------------------------------------------
async function timedFetch(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const t0 = performance.now();
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    // Drain the body — a fair comparison must include response-body transfer cost, not just headers.
    await res.arrayBuffer();
    const latencyMs = Math.round((performance.now() - t0) * 100) / 100;
    return { latencyMs, status: res.status, error: res.ok ? null : `http_${res.status}` };
  } catch (err) {
    const latencyMs = Math.round((performance.now() - t0) * 100) / 100;
    return { latencyMs, status: null, error: err?.name === 'AbortError' ? 'timeout' : String(err?.message || err) };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------------------------
// Open-loop, fixed-rate, round-robin-interleaved request generator for one trial.
// Requests are scheduled at a fixed inter-arrival interval derived from TARGET_RPS (aggregate
// across ALL scenarios, matching S6-workload-definition.md's aggregate storefront-request target
// — not per-scenario), dispatched in strict round-robin scenario order (deterministic), with an
// in-flight concurrency cap so a slow scenario cannot unboundedly queue work.
// ---------------------------------------------------------------------------------------------
async function runWindow(scenarios, windowSeconds, collectInto) {
  const intervalMs = 1000 / TARGET_RPS;
  const endAt = performance.now() + windowSeconds * 1000;
  let scenarioIndex = 0;
  let inFlight = 0;
  const pending = [];

  while (performance.now() < endAt) {
    if (inFlight >= CONCURRENCY_CAP) {
      // Backpressure: wait for at least one in-flight request to finish before scheduling more,
      // rather than growing an unbounded queue on a slow host.
      await Promise.race(pending);
    } else {
      const scenario = scenarios[scenarioIndex % scenarios.length];
      scenarioIndex += 1;
      inFlight += 1;
      const p = timedFetch(scenario.url, REQUEST_TIMEOUT_MS).then((result) => {
        inFlight -= 1;
        const idx = pending.indexOf(p);
        if (idx !== -1) pending.splice(idx, 1);
        if (collectInto) collectInto.push({ label: scenario.label, ...result });
      });
      pending.push(p);
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  await Promise.all(pending);
}

function hostLoadSnapshot() {
  const load = os.loadavg();
  return {
    loadavg_1m: Number(load[0].toFixed(2)),
    loadavg_5m: Number(load[1].toFixed(2)),
    loadavg_15m: Number(load[2].toFixed(2)),
    cpuCount: os.cpus().length,
    freeMemMb: Math.round(os.freemem() / (1024 * 1024)),
  };
}

async function main() {
  const scenarios = buildScenarios();
  console.log(`[liquid-load-harness] base=${BASE_URL} rps=${TARGET_RPS} duration=${DURATION_S}s warmup=${WARMUP_S}s trials=${TRIALS} concurrency=${CONCURRENCY_CAP}`);
  console.log(`[liquid-load-harness] scenarios (deterministic round-robin order): ${scenarios.map((s) => s.label).join(', ')}`);
  console.log(`[liquid-load-harness] host load before run: ${JSON.stringify(hostLoadSnapshot())}`);

  const trialResults = [];

  for (let trial = 1; trial <= TRIALS; trial++) {
    console.log(`\n[liquid-load-harness] trial ${trial}/${TRIALS} — warmup ${WARMUP_S}s (discarded)`);
    const warmupSamples = [];
    await runWindow(scenarios, WARMUP_S, warmupSamples);
    console.log(`[liquid-load-harness] trial ${trial}: warmup discarded ${warmupSamples.length} requests`);

    const loadBefore = hostLoadSnapshot();
    console.log(`[liquid-load-harness] trial ${trial}: measuring for ${DURATION_S}s (host load ${JSON.stringify(loadBefore)})`);
    const measuredSamples = [];
    const measureStart = performance.now();
    await runWindow(scenarios, DURATION_S, measuredSamples);
    const measuredWallSeconds = (performance.now() - measureStart) / 1000;
    const loadAfter = hostLoadSnapshot();

    const perScenario = {};
    for (const scenario of scenarios) {
      const samples = measuredSamples.filter((s) => s.label === scenario.label);
      const summary = summarizeLatencies(samples);
      perScenario[scenario.label] = {
        ...summary,
        throughputRps: Number((summary.okCount / measuredWallSeconds).toFixed(2)),
      };
      console.log(`[liquid-load-harness] trial ${trial}: ${scenario.label} — n=${summary.count} ok=${summary.okCount} err=${summary.errorCount} p50=${summary.p50}ms p95=${summary.p95}ms p99=${summary.p99}ms max=${summary.max}ms`);
    }

    trialResults.push({
      trial,
      warmupRequestsDiscarded: warmupSamples.length,
      measuredWallSeconds: Number(measuredWallSeconds.toFixed(2)),
      hostLoadBefore: loadBefore,
      hostLoadAfter: loadAfter,
      perScenario,
    });
  }

  // ---- cross-trial aggregation: mean + stddev of p50/p95/p99 per scenario, across trials ----
  const aggregate = {};
  for (const scenario of scenarios) {
    const p50s = trialResults.map((t) => t.perScenario[scenario.label].p50);
    const p95s = trialResults.map((t) => t.perScenario[scenario.label].p95);
    const p99s = trialResults.map((t) => t.perScenario[scenario.label].p99);
    const throughputs = trialResults.map((t) => t.perScenario[scenario.label].throughputRps);
    const errorCounts = trialResults.map((t) => t.perScenario[scenario.label].errorCount);
    aggregate[scenario.label] = {
      surface: scenario.surface,
      engine: scenario.engine,
      p50_mean: mean(p50s), p50_stddev: Number(stddev(p50s).toFixed(2)),
      p95_mean: mean(p95s), p95_stddev: Number(stddev(p95s).toFixed(2)),
      p99_mean: mean(p99s), p99_stddev: Number(stddev(p99s).toFixed(2)),
      throughputRps_mean: Number(mean(throughputs)?.toFixed(2)),
      totalErrorsAcrossTrials: errorCounts.reduce((a, b) => a + b, 0),
    };
  }

  const report = {
    tool: 'liquid-load-harness.mjs',
    generatedAt: args['stamp'] || null, // caller-supplied; this script never calls Date.now() itself
    config: { baseUrl: BASE_URL, targetRps: TARGET_RPS, durationSeconds: DURATION_S, warmupSeconds: WARMUP_S, trials: TRIALS, concurrencyCap: CONCURRENCY_CAP, surfaces: SURFACES, requestTimeoutMs: REQUEST_TIMEOUT_MS },
    scenarios: scenarios.map((s) => ({ label: s.label, surface: s.surface, engine: s.engine, url: s.url })),
    trials: trialResults,
    aggregate,
  };

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
  console.log(`\n[liquid-load-harness] wrote ${OUT_PATH}`);

  // ---- delta table: liquid vs react, per surface, on p95 (the tail the flip decision cares about) ----
  console.log('\n[liquid-load-harness] Liquid vs React delta (p95, mean across trials):');
  for (const surface of SURFACES) {
    const r = aggregate[`${surface}/react`];
    const l = aggregate[`${surface}/liquid`];
    if (!r || !l || r.p95_mean === null || l.p95_mean === null) {
      console.log(`  ${surface}: incomplete data`);
      continue;
    }
    const deltaMs = l.p95_mean - r.p95_mean;
    const deltaPct = r.p95_mean > 0 ? ((deltaMs / r.p95_mean) * 100).toFixed(1) : 'n/a';
    console.log(`  ${surface}: react p95=${r.p95_mean}ms  liquid p95=${l.p95_mean}ms  delta=${deltaMs >= 0 ? '+' : ''}${deltaMs.toFixed(1)}ms (${deltaPct}%)`);
  }
}

main().catch((err) => {
  console.error('[liquid-load-harness] fatal:', err);
  process.exitCode = 1;
});
