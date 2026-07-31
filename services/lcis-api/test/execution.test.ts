/**
 * LCIS API — Phase 8 EAOS execution endpoint tests (≥20 tests).
 * All seven POST /execution/* routes against the real engine. READ-ONLY.
 * Every response is the standard envelope; every data payload is honest
 * (liveConnected:false, NOT_CONNECTED live signals, never fabricated).
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { resetEngine } from '@letbuyy/lcis-core'
import { resetOrchestrationEngine } from '@letbuyy/lcis-orchestration'
import { createApp } from '../src/app'

const app = createApp({
  rateLimiter: { capacity: 200, refillRate: 200 },
})

async function post(path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function assertEnvelope(data: Record<string, unknown>, source?: string): void {
  assert.equal(typeof data['success'], 'boolean', 'missing success')
  assert.ok('data' in data, 'missing data key')
  assert.ok(Array.isArray(data['evidence']), 'evidence must be array')
  assert.equal(typeof data['confidence'], 'number', 'missing confidence')
  assert.equal(typeof data['source'], 'string', 'missing source')
  assert.equal(typeof data['executionTime'], 'number', 'missing executionTime')
  assert.equal(typeof data['timestamp'], 'string', 'missing timestamp')
  if (source) assert.equal(data['source'], source)
}

before(() => {
  resetEngine()
  resetOrchestrationEngine()
})

after(() => {
  resetEngine()
  resetOrchestrationEngine()
})

const ROUTES = ['report', 'graph', 'status', 'timeline', 'blockers', 'rollout', 'health'] as const

// ─────────────────────────────────────────────────────────────────────────────
// Shared contract across all seven /execution/* routes
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /execution/* — shared contract', () => {
  for (const route of ROUTES) {
    it(`/execution/${route} returns 200 with envelope and source=execution-${route}`, async () => {
      const res = await post(`/execution/${route}`, { text: 'Add GST e-invoicing endpoint' })
      assert.equal(res.status, 200)
      const body = await res.json() as Record<string, unknown>
      assertEnvelope(body, `execution-${route}`)
      assert.equal(body['success'], true)
    })

    it(`/execution/${route} returns 400 for missing text (no stack leak)`, async () => {
      const res = await post(`/execution/${route}`, {})
      assert.equal(res.status, 400)
      const body = await res.json() as Record<string, unknown>
      assert.equal(body['success'], false)
      assert.equal((body['error'] as Record<string, unknown>)['code'], 'VALIDATION_ERROR')
      assert.ok(!('stack' in body))
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// Route-specific payload assertions
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /execution/report (flagship)', () => {
  it('composes all seven sections + overall health', async () => {
    const res = await post('/execution/report', { text: 'Add order cancellation flow' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    for (const key of ['execution', 'agent', 'artifact', 'validation', 'status', 'rollout', 'timeline', 'health']) {
      assert.ok(key in d, `section ${key} missing`)
    }
  })

  it('is honest: liveConnected false + provenance on the data payload', async () => {
    const res = await post('/execution/report', { text: 'Add refund webhook' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['liveConnected'], false)
    assert.ok(Array.isArray(d['evidence']))
    assert.ok(Array.isArray(d['sources']))
    assert.equal(typeof d['timestamp'], 'string')
    assert.match(d['summary'] as string, /NOT_CONNECTED/)
  })

  it('accepts optional domains/tables/symbols seeds', async () => {
    const res = await post('/execution/report', {
      text: 'Migrate checkout',
      domains: ['payments'],
      tables: ['orders'],
      symbols: ['create_checkout_order'],
    })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })
})

describe('POST /execution/graph', () => {
  it('nodes carry derived PLANNED/READY/BLOCKED status only', async () => {
    const res = await post('/execution/graph', { text: 'Add discount codes' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as { graph: { nodes: Array<{ status: string }> } }
    assert.ok(d.graph.nodes.length > 0)
    for (const n of d.graph.nodes) {
      assert.ok(['PLANNED', 'READY', 'BLOCKED'].includes(n.status), `unexpected status ${n.status}`)
    }
  })
})

describe('POST /execution/status', () => {
  it('ETA is honestly NOT_CONNECTED with null value (never a fabricated date)', async () => {
    const res = await post('/execution/status', { text: 'Add inventory transfer feature' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as { eta: { connection: string; value: string | null } }
    assert.equal(d.eta.connection, 'NOT_CONNECTED')
    assert.equal(d.eta.value, null)
  })
})

describe('POST /execution/blockers', () => {
  it('returns blockedTasks + launchBlockers + reasons arrays', async () => {
    const res = await post('/execution/blockers', { text: 'Add gift card redemption' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['blockedTasks']))
    assert.ok(Array.isArray(d['launchBlockers']))
    assert.ok(Array.isArray(d['reasons']))
  })
})

describe('POST /execution/rollout', () => {
  it('money feature is not a blind GO', async () => {
    const res = await post('/execution/rollout', { text: 'add payment refund ledger' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as { launchVerdict: string }
    assert.ok(
      d.launchVerdict === 'NO_GO' || d.launchVerdict === 'CONDITIONAL_GO',
      `expected scrutiny for money feature, got ${d.launchVerdict}`,
    )
  })
})

describe('POST /execution/health', () => {
  it('returns four areas + merged overall with a valid band', async () => {
    const res = await post('/execution/health', { text: 'Add coupon engine' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as { areas: unknown[]; overall: { area: string; band: string } }
    assert.equal(d.areas.length, 4)
    assert.equal(d.overall.area, 'overall')
    assert.ok(['healthy', 'degraded', 'failing', 'unknown'].includes(d.overall.band))
  })
})

describe('POST /execution/* — robustness', () => {
  it('gibberish request still returns 200 with an honest envelope', async () => {
    const res = await post('/execution/report', { text: 'ZXQKFMRVWP_NONSENSE_9999' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'execution-report')
  })

  it('unknown /execution subroute returns 404', async () => {
    const res = await post('/execution/deploy', { text: 'try to deploy' })
    assert.equal(res.status, 404)
  })
})
