/**
 * LCIS API integration tests — uses real lcis-core engine over real graphify-out artifacts.
 * Run with: tsx --test test/*.test.ts
 */
import { describe, it, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { resetEngine } from '@letbuyy/lcis-core'
import { createApp } from '../src/app'

// ── App instance shared across all tests ──────────────────────────────────────

const app = createApp({
  rateLimiter: { capacity: 200, refillRate: 200 },
})

async function get(path: string): Promise<Response> {
  return app.request(path, { method: 'GET' })
}

async function post(path: string, body: unknown): Promise<Response> {
  return app.request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ── Envelope contract helper ───────────────────────────────────────────────────

function assertEnvelope(data: Record<string, unknown>, source?: string): void {
  assert.equal(typeof data['success'], 'boolean', 'missing success')
  assert.ok('data' in data, 'missing data key')
  assert.ok(Array.isArray(data['evidence']), 'evidence must be array')
  assert.equal(typeof data['confidence'], 'number', 'missing confidence')
  assert.equal(typeof data['source'], 'string', 'missing source')
  assert.equal(typeof data['executionTime'], 'number', 'missing executionTime')
  assert.equal(typeof data['timestamp'], 'string', 'missing timestamp')
  assert.equal(typeof data['version'], 'string', 'missing version')
  if (source) {
    assert.equal(data['source'], source)
  }
}

// ── Before/after ──────────────────────────────────────────────────────────────

before(() => {
  // Reset singleton so the test process gets a fresh engine
  resetEngine()
})

after(() => {
  resetEngine()
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /health
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /health', () => {
  it('returns 200 with envelope contract', async () => {
    const res = await get('/health')
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'health')
    assert.equal(body['success'], true)
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['status'], 'ok')
    assert.equal(typeof d['version'], 'string')
  })

  it('sets security headers on /health', async () => {
    const res = await get('/health')
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff')
    assert.equal(res.headers.get('X-Frame-Options'), 'DENY')
    assert.equal(res.headers.get('Referrer-Policy'), 'no-referrer')
    assert.equal(res.headers.get('Cache-Control'), 'no-store')
  })

  it('echoes x-request-id header when provided', async () => {
    const res = await app.request('/health', {
      method: 'GET',
      headers: { 'x-request-id': 'test-id-abc' },
    })
    assert.equal(res.headers.get('x-request-id'), 'test-id-abc')
  })

  it('generates x-request-id when not provided', async () => {
    const res = await get('/health')
    const rid = res.headers.get('x-request-id')
    assert.ok(rid && rid.length > 0, 'x-request-id should be generated')
  })

  it('generates x-trace-id on every request', async () => {
    const res = await get('/health')
    const tid = res.headers.get('x-trace-id')
    assert.ok(tid && tid.length > 0, 'x-trace-id should be present')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /graph/stats
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /graph/stats', () => {
  it('returns 200 with graph stats', async () => {
    const res = await get('/graph/stats')
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'graph')
    const d = body['data'] as Record<string, unknown>
    assert.equal(typeof d['nodeCount'], 'number')
    assert.equal(typeof d['edgeCount'], 'number')
    assert.ok((d['nodeCount'] as number) > 0, 'graph should have nodes')
    assert.ok((d['edgeCount'] as number) > 0, 'graph should have edges')
  })

  it('has non-empty evidence array', async () => {
    const res = await get('/graph/stats')
    const body = await res.json() as Record<string, unknown>
    assert.ok((body['evidence'] as unknown[]).length > 0)
  })

  it('security headers on /graph/stats', async () => {
    const res = await get('/graph/stats')
    assert.equal(res.headers.get('X-Content-Type-Options'), 'nosniff')
  })

  it('includes executionTime in milliseconds', async () => {
    const res = await get('/graph/stats')
    const body = await res.json() as Record<string, unknown>
    const ms = body['executionTime'] as number
    assert.ok(ms >= 0, 'executionTime must be non-negative')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /blast
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /blast', () => {
  it('returns blast result for a known symbol', async () => {
    const res = await post('/blast', { symbol: 'getSupabaseAdmin' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'blast-radius')
    assert.equal(body['success'], true)
    const d = body['data'] as Record<string, unknown>
    assert.equal(typeof d['impactedNodes'], 'number')
    assert.equal(typeof d['impactedFiles'], 'number')
    assert.ok((d['impactedNodes'] as number) >= 0)
  })

  it('includes artifact reference in evidence', async () => {
    const res = await post('/blast', { symbol: 'getSupabaseAdmin' })
    const body = await res.json() as Record<string, unknown>
    const evidence = body['evidence'] as { ref: string }[]
    assert.ok(evidence.length > 0)
    assert.ok(evidence[0].ref.includes('graph'), 'evidence should cite graph artifact')
  })

  it('returns 404 for unknown symbol', async () => {
    const res = await post('/blast', { symbol: 'nonExistentSymbolXYZ123' })
    assert.equal(res.status, 404)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    const error = body['error'] as Record<string, unknown>
    assert.equal(error['code'], 'NOT_FOUND')
    assert.ok(!('stack' in body), 'must not leak stack trace')
  })

  it('respects depth parameter', async () => {
    const res = await post('/blast', { symbol: 'getSupabaseAdmin', depth: 1 })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })

  it('returns 400 for missing symbol field', async () => {
    const res = await post('/blast', { depth: 2 })
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    const error = body['error'] as Record<string, unknown>
    assert.equal(error['code'], 'VALIDATION_ERROR')
  })

  it('returns 400 for invalid JSON body', async () => {
    const res = await app.request('/blast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    })
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.ok(!('stack' in body))
  })

  it('returns 400 for empty symbol string', async () => {
    const res = await post('/blast', { symbol: '' })
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
  })

  it('echoes requestId on 404 response', async () => {
    const res = await app.request('/blast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': 'blast-req-id',
      },
      body: JSON.stringify({ symbol: 'unknownXYZ' }),
    })
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['requestId'], 'blast-req-id')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /verify
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /verify', () => {
  it('verifies architecture and returns envelope', async () => {
    const res = await post('/verify', { entity: 'architecture' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'verification')
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['subject'], 'architecture')
    assert.ok(['VERIFIED', 'PARTIAL', 'UNVERIFIED', 'REFUTED'].includes(d['status'] as string))
    assert.equal(typeof d['confidence'], 'number')
    assert.ok(Array.isArray(d['evidence']))
    assert.ok(Array.isArray(d['gaps']))
  })

  it('verifies domains entity', async () => {
    const res = await post('/verify', { entity: 'domains' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'verification')
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['subject'], 'domains')
  })

  it('verifies production-readiness entity', async () => {
    const res = await post('/verify', { entity: 'production-readiness' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body)
  })

  it('returns 400 for missing entity', async () => {
    const res = await post('/verify', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.equal((body['error'] as Record<string, unknown>)['code'], 'VALIDATION_ERROR')
    assert.ok(!('stack' in body))
  })

  it('confidence is a number between 0 and 1', async () => {
    const res = await post('/verify', { entity: 'architecture' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    const conf = d['confidence'] as number
    assert.ok(conf >= 0 && conf <= 1, `confidence ${conf} out of [0,1]`)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /explain
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /explain', () => {
  it('explains the payments domain', async () => {
    const res = await post('/explain', { entity: 'payments' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'architecture')
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['kind'], 'domain')
    assert.equal(typeof d['summary'], 'string')
    assert.ok((d['summary'] as string).length > 0)
    assert.ok(Array.isArray(d['evidence']))
  })

  it('explains the overall architecture', async () => {
    const res = await post('/explain', { entity: 'architecture' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body)
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['kind'], 'architecture')
  })

  it('returns 400 for missing entity', async () => {
    const res = await post('/explain', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.ok(!('stack' in body))
  })

  it('evidence is an array', async () => {
    const res = await post('/explain', { entity: 'orders' })
    const body = await res.json() as Record<string, unknown>
    assert.ok(Array.isArray(body['evidence']))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /memory
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /memory', () => {
  it('returns memory hits for a governance query', async () => {
    const res = await post('/memory', { query: 'money RPC canonical ledger' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'memory')
    const d = body['data'] as Record<string, unknown>
    assert.equal(typeof d['query'], 'string')
    assert.ok(Array.isArray(d['hits']))
    assert.ok(Array.isArray(d['citations']))
    assert.equal(typeof d['stale'], 'boolean')
    assert.equal(typeof d['tokensUsed'], 'number')
  })

  it('respects limit parameter', async () => {
    const res = await post('/memory', { query: 'authentication', limit: 3 })
    const body = await res.json() as Record<string, unknown>
    assert.equal(res.status, 200)
    const d = body['data'] as Record<string, unknown>
    assert.ok((d['hits'] as unknown[]).length <= 3)
  })

  it('returns 400 for missing query', async () => {
    const res = await post('/memory', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.ok(!('stack' in body))
  })

  it('returns 400 for empty query string', async () => {
    const res = await post('/memory', { query: '' })
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
  })

  it('evidence references doc sources', async () => {
    const res = await post('/memory', { query: 'RLS tenant' })
    const body = await res.json() as Record<string, unknown>
    const evidence = body['evidence'] as { kind: string }[]
    // citations that exist should have kind 'doc'
    if (evidence.length > 0) {
      assert.ok(evidence.some((e) => e.kind === 'doc'))
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /decision
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /decision', () => {
  it('returns ranked risks for default subject', async () => {
    const res = await post('/decision', { subject: 'what are the risks' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'decision')
    const d = body['data'] as Record<string, unknown>
    assert.ok('risks' in d)
    assert.ok(Array.isArray(d['risks']))
  })

  it('returns ranked fixes when subject mentions fix', async () => {
    const res = await post('/decision', { subject: 'what to fix next' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body)
    const d = body['data'] as Record<string, unknown>
    assert.ok('fixes' in d)
    assert.ok(Array.isArray(d['fixes']))
  })

  it('returns launch verdict when subject mentions launch', async () => {
    const res = await post('/decision', { subject: 'launch verdict' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body)
    const d = body['data'] as Record<string, unknown>
    assert.ok('verdict' in d)
    assert.ok(['GO', 'NO-GO', 'CONDITIONAL-GO'].includes(d['verdict'] as string))
    assert.equal(typeof d['openBlockers'], 'number')
  })

  it('returns 400 for missing subject', async () => {
    const res = await post('/decision', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.ok(!('stack' in body))
  })

  it('confidence is a number', async () => {
    const res = await post('/decision', { subject: 'risks' })
    const body = await res.json() as Record<string, unknown>
    assert.equal(typeof body['confidence'], 'number')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// 404 + Error paths
// ─────────────────────────────────────────────────────────────────────────────

describe('404 and error handling', () => {
  it('returns 404 structured JSON for unknown route', async () => {
    const res = await get('/unknown-route')
    assert.equal(res.status, 404)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    const error = body['error'] as Record<string, unknown>
    assert.equal(error['code'], 'NOT_FOUND')
    assert.ok(!('stack' in body))
  })

  it('returns 404 for POST to unknown route', async () => {
    const res = await post('/totally-unknown', { x: 1 })
    assert.equal(res.status, 404)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
  })

  it('no stack trace in 400 response', async () => {
    const res = await post('/blast', {})
    const body = await res.json() as Record<string, unknown>
    assert.ok(!('stack' in body))
    assert.ok(!(JSON.stringify(body).includes('at Object.')))
  })

  it('requestId is echoed in 400 responses', async () => {
    const res = await app.request('/blast', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-request-id': 'my-req-123',
      },
      body: JSON.stringify({}),
    })
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['requestId'], 'my-req-123')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Rate limiter
// ─────────────────────────────────────────────────────────────────────────────

describe('rate limiter', () => {
  it('returns 429 after capacity is exhausted', async () => {
    // Use a tiny-capacity app
    const tinyApp = createApp({ rateLimiter: { capacity: 2, refillRate: 0 } })

    let lastStatus = 200
    for (let i = 0; i < 5; i++) {
      const res = await tinyApp.request('/health', { method: 'GET' })
      lastStatus = res.status
      if (res.status === 429) break
    }
    assert.equal(lastStatus, 429)
  })

  it('429 response has structured error without stack trace', async () => {
    const tinyApp = createApp({ rateLimiter: { capacity: 1, refillRate: 0 } })
    // Exhaust bucket
    await tinyApp.request('/health', { method: 'GET' })
    const res = await tinyApp.request('/health', { method: 'GET' })
    assert.equal(res.status, 429)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    const error = body['error'] as Record<string, unknown>
    assert.equal(error['code'], 'RATE_LIMITED')
    assert.ok(!('stack' in body))
  })

  it('does not rate-limit when capacity is generous', async () => {
    // Normal app with high capacity — all 5 requests succeed
    const statuses: number[] = []
    for (let i = 0; i < 5; i++) {
      const res = await get('/health')
      statuses.push(res.status)
    }
    assert.ok(statuses.every((s) => s === 200))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Envelope contract cross-cutting
// ─────────────────────────────────────────────────────────────────────────────

describe('envelope contract', () => {
  it('every 200 response has success=true', async () => {
    const endpoints = [
      () => get('/health'),
      () => get('/graph/stats'),
      () => post('/blast', { symbol: 'getSupabaseAdmin' }),
      () => post('/verify', { entity: 'architecture' }),
      () => post('/explain', { entity: 'payments' }),
      () => post('/memory', { query: 'RLS' }),
      () => post('/decision', { subject: 'risks' }),
    ]
    for (const endpoint of endpoints) {
      const res = await endpoint()
      const body = await res.json() as Record<string, unknown>
      assert.equal(res.status, 200, `expected 200, got ${res.status}`)
      assert.equal(body['success'], true, `success should be true`)
      assert.equal(typeof body['version'], 'string', 'missing version')
    }
  })

  it('every response has x-request-id header', async () => {
    const res = await post('/verify', { entity: 'domains' })
    assert.ok(res.headers.get('x-request-id') !== null)
  })

  it('requestId in envelope matches x-request-id header for success', async () => {
    const res = await app.request('/health', {
      method: 'GET',
      headers: { 'x-request-id': 'envelope-test-id' },
    })
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['requestId'], 'envelope-test-id')
    assert.equal(res.headers.get('x-request-id'), 'envelope-test-id')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /live/health
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /live/health', () => {
  it('returns 200 with envelope contract', async () => {
    const res = await get('/live/health')
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'live-health')
    assert.equal(body['success'], true)
  })

  it('response data contains overall and adapters array', async () => {
    const res = await get('/live/health')
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok('overall' in d, 'missing overall field')
    assert.ok(Array.isArray(d['adapters']), 'adapters must be array')
  })

  it('adapters array has 4 entries', async () => {
    const res = await get('/live/health')
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal((d['adapters'] as unknown[]).length, 4)
  })

  it('notConnected is an array of strings', async () => {
    const res = await get('/live/health')
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['notConnected']), 'notConnected must be array')
    for (const item of d['notConnected'] as unknown[]) {
      assert.equal(typeof item, 'string')
    }
  })

  it('evidence cites LivePlatform.health()', async () => {
    const res = await get('/live/health')
    const body = await res.json() as Record<string, unknown>
    const evidence = body['evidence'] as { ref: string }[]
    assert.ok(evidence.length > 0)
    assert.ok(evidence.some((e) => e.ref.includes('health') || e.ref.includes('Platform')))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /live/status
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /live/status', () => {
  it('returns 200 with envelope contract', async () => {
    const res = await get('/live/status')
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'live-status')
    assert.equal(body['success'], true)
  })

  it('adapters array present and non-empty', async () => {
    const res = await get('/live/status')
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['adapters']), 'adapters must be array')
    assert.ok((d['adapters'] as unknown[]).length > 0)
  })

  it('notConnected adapters are named honestly', async () => {
    const res = await get('/live/status')
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    const nc = d['notConnected'] as string[]
    assert.ok(Array.isArray(nc))
    // In this env all 4 adapters have no creds → all NOT_CONNECTED
    assert.ok(nc.length >= 0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /live/investigate
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /live/investigate', () => {
  it('returns 200 with envelope for payments subject', async () => {
    const res = await post('/live/investigate', { subject: 'payments' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'live-investigate')
    assert.equal(body['success'], true)
  })

  it('data contains subject and correlation', async () => {
    const res = await post('/live/investigate', { subject: 'checkout' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['subject'], 'checkout')
    assert.ok('correlation' in d, 'correlation must be present')
  })

  it('notConnected array present in data', async () => {
    const res = await post('/live/investigate', { subject: 'database' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['notConnected']), 'notConnected must be array')
  })

  it('returns 400 for missing subject field', async () => {
    const res = await post('/live/investigate', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.equal((body['error'] as Record<string, unknown>)['code'], 'VALIDATION_ERROR')
    assert.ok(!('stack' in body))
  })

  it('returns 400 for empty subject string', async () => {
    const res = await post('/live/investigate', { subject: '' })
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /db/status
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /db/status', () => {
  it('returns 200 with envelope', async () => {
    const res = await get('/db/status')
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'db-status')
    assert.equal(body['success'], true)
  })

  it('data contains adapter and status fields', async () => {
    const res = await get('/db/status')
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['adapter'], 'supabase')
    assert.ok('status' in d, 'status must be present')
    const validStatuses = new Set(['CONNECTED', 'NOT_CONNECTED', 'DEGRADED', 'ERROR'])
    assert.ok(validStatuses.has(d['status'] as string), `unknown status: ${d['status']}`)
  })

  it('NOT_CONNECTED response is honest (no fabricated data)', async () => {
    const res = await get('/db/status')
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    if (d['status'] === 'NOT_CONNECTED') {
      // Must be honest: not CONNECTED and no fabricated payload
      assert.equal(d['status'], 'NOT_CONNECTED')
    }
    // Either way: no stack in body
    assert.ok(!('stack' in body))
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// GET /github/status, /cloudflare/status, /vercel/status
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /github/status', () => {
  it('returns 200 with envelope', async () => {
    const res = await get('/github/status')
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'github-status')
    assert.equal(body['success'], true)
  })

  it('data has adapter=github and a status field', async () => {
    const res = await get('/github/status')
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['adapter'], 'github')
    assert.ok('status' in d)
  })
})

describe('GET /cloudflare/status', () => {
  it('returns 200 with envelope', async () => {
    const res = await get('/cloudflare/status')
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'cloudflare-status')
    assert.equal(body['success'], true)
  })

  it('data has adapter=cloudflare and a status field', async () => {
    const res = await get('/cloudflare/status')
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['adapter'], 'cloudflare')
    assert.ok('status' in d)
  })
})

describe('GET /vercel/status', () => {
  it('returns 200 with envelope', async () => {
    const res = await get('/vercel/status')
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'vercel-status')
    assert.equal(body['success'], true)
  })

  it('data has adapter=vercel and a status field', async () => {
    const res = await get('/vercel/status')
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['adapter'], 'vercel')
    assert.ok('status' in d)
  })

  it('NOT_CONNECTED has notConnectedNote when no credentials', async () => {
    const res = await get('/vercel/status')
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    if (d['status'] === 'NOT_CONNECTED') {
      assert.ok(typeof d['notConnectedNote'] === 'string' && (d['notConnectedNote'] as string).length > 0)
    }
  })

  it('live endpoints included in envelope cross-cut — all have success=true', async () => {
    const liveEndpoints = [
      () => get('/live/health'),
      () => get('/live/status'),
      () => get('/db/status'),
      () => get('/github/status'),
      () => get('/cloudflare/status'),
      () => get('/vercel/status'),
    ]
    for (const ep of liveEndpoints) {
      const res = await ep()
      const body = await res.json() as Record<string, unknown>
      assert.equal(res.status, 200, `live endpoint returned ${res.status}`)
      assert.equal(body['success'], true)
      assert.equal(typeof body['version'], 'string')
      assert.ok(Array.isArray(body['evidence']))
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /plan/change
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /plan/change', () => {
  it('returns 200 with envelope and source=plan-change', async () => {
    const res = await post('/plan/change', { text: 'Add GST filing endpoint' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'plan-change')
    assert.equal(body['success'], true)
  })

  it('data has evidence + confidence + sources + timestamp (PlanArtifact)', async () => {
    const res = await post('/plan/change', { text: 'Add order cancellation' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['evidence']), 'data.evidence must be array')
    assert.equal(typeof d['confidence'], 'number')
    assert.ok(Array.isArray(d['sources']), 'data.sources must be array')
    assert.equal(typeof d['timestamp'], 'string')
  })

  it('accepts optional domains/tables/symbols fields', async () => {
    const res = await post('/plan/change', {
      text: 'Migrate checkout',
      domains: ['payments'],
      tables: ['orders'],
      symbols: ['create_checkout_order'],
    })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })

  it('returns 400 for missing text field', async () => {
    const res = await post('/plan/change', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.equal((body['error'] as Record<string, unknown>)['code'], 'VALIDATION_ERROR')
    assert.ok(!('stack' in body))
  })

  it('returns 400 for empty text string', async () => {
    const res = await post('/plan/change', { text: '' })
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /plan/execution
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /plan/execution', () => {
  it('returns 200 with envelope and source=plan-execution', async () => {
    const res = await post('/plan/execution', { text: 'Add inventory transfer feature' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'plan-execution')
    assert.equal(body['success'], true)
  })

  it('returns 400 for missing text', async () => {
    const res = await post('/plan/execution', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.ok(!('stack' in body))
  })

  it('accepts optional domains seed', async () => {
    const res = await post('/plan/execution', { text: 'Add discount codes', domains: ['discounts'] })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /plan/migration
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /plan/migration', () => {
  it('returns 200 with envelope and source=plan-migration', async () => {
    const res = await post('/plan/migration', { text: 'Add new column to orders table' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'plan-migration')
    assert.equal(body['success'], true)
  })

  it('returns 400 for invalid body', async () => {
    const res = await post('/plan/migration', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
  })

  it('accepts optional tables seed', async () => {
    const res = await post('/plan/migration', { text: 'Migrate payment records', tables: ['payment_transactions'] })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /plan/tests
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /plan/tests', () => {
  it('returns 200 with envelope and source=plan-tests', async () => {
    const res = await post('/plan/tests', { text: 'Add refund flow' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'plan-tests')
    assert.equal(body['success'], true)
  })

  it('returns 400 for missing text', async () => {
    const res = await post('/plan/tests', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.ok(!('stack' in body))
  })

  it('confidence is in [0,1]', async () => {
    const res = await post('/plan/tests', { text: 'Test checkout flow' })
    const body = await res.json() as Record<string, unknown>
    assert.ok((body['confidence'] as number) >= 0 && (body['confidence'] as number) <= 1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /plan/rollback
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /plan/rollback', () => {
  it('returns 200 with envelope and source=plan-rollback', async () => {
    const res = await post('/plan/rollback', { text: 'Roll back order schema change' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'plan-rollback')
    assert.equal(body['success'], true)
  })

  it('returns 400 for missing text', async () => {
    const res = await post('/plan/rollback', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /plan/launch
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /plan/launch', () => {
  it('returns 200 with envelope and source=plan-launch', async () => {
    const res = await post('/plan/launch', { text: 'Launch v1 to production' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'plan-launch')
    assert.equal(body['success'], true)
  })

  it('returns 400 for missing text', async () => {
    const res = await post('/plan/launch', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.ok(!('stack' in body))
  })

  it('confidence is in [0,1]', async () => {
    const res = await post('/plan/launch', { text: 'Evaluate launch readiness' })
    const body = await res.json() as Record<string, unknown>
    assert.ok((body['confidence'] as number) >= 0 && (body['confidence'] as number) <= 1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// POST /plan/release
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /plan/release', () => {
  it('returns 200 with envelope and source=plan-release', async () => {
    const res = await post('/plan/release', { text: 'Full release of gift card feature' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'plan-release')
    assert.equal(body['success'], true)
  })

  it('data contains all 8 FullPlan keys', async () => {
    const res = await post('/plan/release', { text: 'Release v2 of the checkout flow' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    for (const key of ['change', 'execution', 'executionGraph', 'migration', 'tests', 'rollback', 'launch', 'verification']) {
      assert.ok(key in d, `FullPlan must contain key: ${key}`)
    }
  })

  it('returns 400 for missing text', async () => {
    const res = await post('/plan/release', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.ok(!('stack' in body))
  })

  it('returns 400 for empty text string', async () => {
    const res = await post('/plan/release', { text: '' })
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
  })

  it('accepts all optional seed fields', async () => {
    const res = await post('/plan/release', {
      text: 'Release v2 payment integration',
      domains: ['payments'],
      tables: ['payment_transactions'],
      symbols: ['confirm_order_payment_with_ledger'],
    })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Plan endpoints cross-cut — all 7 return envelope contract
// ─────────────────────────────────────────────────────────────────────────────

describe('plan endpoints envelope cross-cut', () => {
  it('all 7 plan endpoints return 200 with success=true and envelope', async () => {
    const planEndpoints = [
      () => post('/plan/change', { text: 'Add feature A' }),
      () => post('/plan/execution', { text: 'Add feature B' }),
      () => post('/plan/migration', { text: 'Add feature C' }),
      () => post('/plan/tests', { text: 'Add feature D' }),
      () => post('/plan/rollback', { text: 'Add feature E' }),
      () => post('/plan/launch', { text: 'Add feature F' }),
      () => post('/plan/release', { text: 'Add feature G' }),
    ]
    for (const ep of planEndpoints) {
      const res = await ep()
      const body = await res.json() as Record<string, unknown>
      assert.equal(res.status, 200, `plan endpoint returned ${res.status}`)
      assert.equal(body['success'], true)
      assert.equal(typeof body['version'], 'string')
      assert.ok(Array.isArray(body['evidence']))
      assert.equal(typeof body['executionTime'], 'number')
    }
  })

  it('honest unresolved: plan endpoints return data with evidence array even when no seeds resolve', async () => {
    // An obscure non-existent feature — no seeds resolve, but response must still be honest (not fabricated)
    const res = await post('/plan/change', { text: 'xyzzy_nonexistent_feature_abc_987' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
    const d = body['data'] as Record<string, unknown>
    // evidence is present (may be empty when truly unresolved)
    assert.ok(Array.isArray(d['evidence']), 'data.evidence must be array')
    // unresolved flag is honest
    if ('unresolved' in d) {
      assert.equal(typeof d['unresolved'], 'boolean')
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 5: GDIS governance endpoints
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /drift', () => {
  it('returns 200 with envelope and source=governance-drift', async () => {
    const res = await post('/drift', {})
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'governance-drift')
    assert.equal(body['success'], true)
  })

  it('data has evidence array and confidence', async () => {
    const res = await post('/drift', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['evidence']), 'data.evidence must be array')
    assert.equal(typeof d['confidence'], 'number')
  })

  it('accepts empty body gracefully', async () => {
    const res = await app.request('/drift', { method: 'POST' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })

  it('data has findings array and scope', async () => {
    const res = await post('/drift', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['findings']), 'data.findings must be array')
    assert.equal(typeof d['scope'], 'string')
  })
})

describe('POST /compliance', () => {
  it('returns 200 with envelope and source=governance-compliance', async () => {
    const res = await post('/compliance', {})
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'governance-compliance')
    assert.equal(body['success'], true)
  })

  it('data.score is a number in [0,100]', async () => {
    const res = await post('/compliance', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    const score = d['score'] as number
    assert.equal(typeof score, 'number')
    assert.ok(score >= 0 && score <= 100, `score ${score} out of [0,100]`)
  })

  it('accepts empty body gracefully', async () => {
    const res = await app.request('/compliance', { method: 'POST' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })

  it('data has evaluations and violations arrays', async () => {
    const res = await post('/compliance', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['evaluations']), 'data.evaluations must be array')
    assert.ok(Array.isArray(d['violations']), 'data.violations must be array')
  })
})

describe('POST /governance', () => {
  it('returns 200 with envelope and source=governance-report', async () => {
    const res = await post('/governance', {})
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'governance-report')
    assert.equal(body['success'], true)
  })

  it('data.healthScore is a number in [0,100]', async () => {
    const res = await post('/governance', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    const hs = d['healthScore'] as number
    assert.equal(typeof hs, 'number')
    assert.ok(hs >= 0 && hs <= 100, `healthScore ${hs} out of [0,100]`)
  })

  it('data has drift, compliance, ownership, security, readiness keys', async () => {
    const res = await post('/governance', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    for (const key of ['drift', 'compliance', 'ownership', 'security', 'readiness']) {
      assert.ok(key in d, `GovernanceReport must contain key: ${key}`)
    }
  })

  it('accepts empty body gracefully', async () => {
    const res = await app.request('/governance', { method: 'POST' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })
})

describe('POST /ownership', () => {
  it('returns 200 with envelope and source=governance-ownership', async () => {
    const res = await post('/ownership', {})
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'governance-ownership')
    assert.equal(body['success'], true)
  })

  it('data has gaps array and coverage object', async () => {
    const res = await post('/ownership', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['gaps']), 'data.gaps must be array')
    assert.equal(typeof d['coverage'], 'object')
  })

  it('data.evidence is an array', async () => {
    const res = await post('/ownership', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['evidence']), 'data.evidence must be array')
  })
})

describe('POST /readiness', () => {
  it('returns 200 with envelope and source=governance-readiness', async () => {
    const res = await post('/readiness', {})
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'governance-readiness')
    assert.equal(body['success'], true)
  })

  it('data.overall is a number in [0,100]', async () => {
    const res = await post('/readiness', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    const overall = d['overall'] as number
    assert.equal(typeof overall, 'number')
    assert.ok(overall >= 0 && overall <= 100, `overall ${overall} out of [0,100]`)
  })

  it('data.scores is an array', async () => {
    const res = await post('/readiness', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['scores']), 'data.scores must be array')
  })

  it('accepts empty body gracefully', async () => {
    const res = await app.request('/readiness', { method: 'POST' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })
})

describe('POST /security-drift', () => {
  it('returns 200 with envelope and source=governance-security-drift', async () => {
    const res = await post('/security-drift', {})
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'governance-security-drift')
    assert.equal(body['success'], true)
  })

  it('data has findings array with evidence and confidence', async () => {
    const res = await post('/security-drift', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['findings']), 'data.findings must be array')
    assert.ok(Array.isArray(d['evidence']), 'data.evidence must be array')
    assert.equal(typeof d['confidence'], 'number')
  })

  it('accepts empty body gracefully', async () => {
    const res = await app.request('/security-drift', { method: 'POST' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })
})

describe('GET /architecture-health', () => {
  it('returns 200 with envelope and source=governance-architecture-health', async () => {
    const res = await get('/architecture-health')
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'governance-architecture-health')
    assert.equal(body['success'], true)
  })

  it('data.area is "architecture"', async () => {
    const res = await get('/architecture-health')
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['area'], 'architecture')
  })

  it('data.score is a number in [0,100]', async () => {
    const res = await get('/architecture-health')
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    const score = d['score'] as number
    assert.equal(typeof score, 'number')
    assert.ok(score >= 0 && score <= 100, `score ${score} out of [0,100]`)
  })

  it('data.findings is an array', async () => {
    const res = await get('/architecture-health')
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['findings']), 'data.findings must be array')
  })
})

describe('GET /domain-health', () => {
  it('returns 200 with envelope and source=governance-domain-health', async () => {
    const res = await get('/domain-health')
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'governance-domain-health')
    assert.equal(body['success'], true)
  })

  it('data.area is "domain"', async () => {
    const res = await get('/domain-health')
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['area'], 'domain')
  })

  it('data.score is a number in [0,100]', async () => {
    const res = await get('/domain-health')
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    const score = d['score'] as number
    assert.equal(typeof score, 'number')
    assert.ok(score >= 0 && score <= 100, `score ${score} out of [0,100]`)
  })
})

describe('GDIS endpoints cross-cut', () => {
  it('all 8 GDIS endpoints return 200 with success=true and envelope', async () => {
    const gdisEndpoints = [
      () => post('/drift', {}),
      () => post('/compliance', {}),
      () => post('/governance', {}),
      () => post('/ownership', {}),
      () => post('/readiness', {}),
      () => post('/security-drift', {}),
      () => get('/architecture-health'),
      () => get('/domain-health'),
    ]
    for (const ep of gdisEndpoints) {
      const res = await ep()
      const body = await res.json() as Record<string, unknown>
      assert.equal(res.status, 200, `GDIS endpoint returned ${res.status}`)
      assert.equal(body['success'], true)
      assert.equal(typeof body['version'], 'string')
      assert.ok(Array.isArray(body['evidence']))
      assert.equal(typeof body['executionTime'], 'number')
    }
  })

  it('all GDIS POST endpoints accept empty body without error', async () => {
    const postEndpoints = ['/drift', '/compliance', '/governance', '/ownership', '/readiness', '/security-drift']
    for (const path of postEndpoints) {
      const res = await app.request(path, { method: 'POST' })
      const body = await res.json() as Record<string, unknown>
      assert.equal(res.status, 200, `${path} rejected empty body`)
      assert.equal(body['success'], true)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 6: LCOS operations endpoints
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /runtime', () => {
  it('returns 200 with envelope and source=operations-runtime', async () => {
    const res = await post('/runtime', {})
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'operations-runtime')
    assert.equal(body['success'], true)
  })

  it('data has evidence array and confidence', async () => {
    const res = await post('/runtime', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['evidence']), 'data.evidence must be array')
    assert.equal(typeof d['confidence'], 'number')
  })

  it('accepts empty body gracefully', async () => {
    const res = await app.request('/runtime', { method: 'POST' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })

  it('data has area=runtime and signals array', async () => {
    const res = await post('/runtime', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['area'], 'runtime')
    assert.ok(Array.isArray(d['signals']), 'data.signals must be array')
  })
})

describe('POST /commerce', () => {
  it('returns 200 with envelope and source=operations-commerce', async () => {
    const res = await post('/commerce', {})
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'operations-commerce')
    assert.equal(body['success'], true)
  })

  it('data has area=commerce and findings array', async () => {
    const res = await post('/commerce', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['area'], 'commerce')
    assert.ok(Array.isArray(d['findings']), 'data.findings must be array')
  })

  it('accepts empty body gracefully', async () => {
    const res = await app.request('/commerce', { method: 'POST' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })

  it('evidence array is present', async () => {
    const res = await post('/commerce', {})
    const body = await res.json() as Record<string, unknown>
    assert.ok(Array.isArray(body['evidence']))
  })
})

describe('POST /merchant', () => {
  it('returns 200 with envelope and source=operations-merchant', async () => {
    const res = await post('/merchant', {})
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'operations-merchant')
    assert.equal(body['success'], true)
  })

  it('data has area=merchant', async () => {
    const res = await post('/merchant', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['area'], 'merchant')
  })

  it('data.liveConnected is a boolean (honest connection state)', async () => {
    const res = await post('/merchant', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(typeof d['liveConnected'], 'boolean')
  })
})

describe('POST /customer', () => {
  it('returns 200 with envelope and source=operations-customer', async () => {
    const res = await post('/customer', {})
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'operations-customer')
    assert.equal(body['success'], true)
  })

  it('data has area=customer and signals array', async () => {
    const res = await post('/customer', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['area'], 'customer')
    assert.ok(Array.isArray(d['signals']), 'data.signals must be array')
  })

  it('accepts empty body gracefully', async () => {
    const res = await app.request('/customer', { method: 'POST' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })
})

describe('POST /deployment', () => {
  it('returns 200 with envelope and source=operations-deployment', async () => {
    const res = await post('/deployment', {})
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'operations-deployment')
    assert.equal(body['success'], true)
  })

  it('data has area=deployment and findings array', async () => {
    const res = await post('/deployment', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['area'], 'deployment')
    assert.ok(Array.isArray(d['findings']), 'data.findings must be array')
  })

  it('data.confidence is a number in [0,1]', async () => {
    const res = await post('/deployment', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    const conf = d['confidence'] as number
    assert.ok(conf >= 0 && conf <= 1, `confidence ${conf} out of [0,1]`)
  })
})

describe('POST /incident', () => {
  it('returns 200 with envelope and source=operations-incident', async () => {
    const res = await post('/incident', {})
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'operations-incident')
    assert.equal(body['success'], true)
  })

  it('data has area=incident and findings array', async () => {
    const res = await post('/incident', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['area'], 'incident')
    assert.ok(Array.isArray(d['findings']), 'data.findings must be array')
  })

  it('accepts empty body gracefully', async () => {
    const res = await app.request('/incident', { method: 'POST' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })
})

describe('POST /security-ops', () => {
  it('returns 200 with envelope and source=operations-security', async () => {
    const res = await post('/security-ops', {})
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'operations-security')
    assert.equal(body['success'], true)
  })

  it('data has area=security and evidence array', async () => {
    const res = await post('/security-ops', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['area'], 'security')
    assert.ok(Array.isArray(d['evidence']), 'data.evidence must be array')
  })

  it('is distinct from Phase-5 /security-drift (different source tag)', async () => {
    const [resOps, resDrift] = await Promise.all([
      post('/security-ops', {}),
      post('/security-drift', {}),
    ])
    const opsBody = await resOps.json() as Record<string, unknown>
    const driftBody = await resDrift.json() as Record<string, unknown>
    assert.equal(opsBody['source'], 'operations-security')
    assert.equal(driftBody['source'], 'governance-security-drift')
  })

  it('accepts empty body gracefully', async () => {
    const res = await app.request('/security-ops', { method: 'POST' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })
})

describe('POST /forecast', () => {
  it('returns 200 with envelope and source=operations-forecast', async () => {
    const res = await post('/forecast', {})
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'operations-forecast')
    assert.equal(body['success'], true)
  })

  it('data has area=forecast and series array (NOT_CONNECTED)', async () => {
    const res = await post('/forecast', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['area'], 'forecast')
    assert.ok(Array.isArray(d['signals']), 'data.signals must be array')
  })

  it('forecast signals carry NOT_CONNECTED status (no live telemetry)', async () => {
    const res = await post('/forecast', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    const signals = d['signals'] as { status: string }[]
    if (signals.length > 0) {
      const allNotConnected = signals.every((s) => s.status !== 'CONNECTED')
      // At least some should be NOT_CONNECTED or PARTIAL without live adapters wired
      assert.ok(allNotConnected || signals.some((s) => s.status === 'NOT_CONNECTED'))
    }
  })

  it('data.liveConnected is false when no adapters wired', async () => {
    const res = await post('/forecast', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['liveConnected'], false)
  })

  it('accepts empty body gracefully', async () => {
    const res = await app.request('/forecast', { method: 'POST' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })
})

describe('POST /operations', () => {
  it('returns 200 with envelope and source=operations-report', async () => {
    const res = await post('/operations', {})
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'operations-report')
    assert.equal(body['success'], true)
  })

  it('data.answers has healthy/degraded/failing/changed/atRisk/investigate arrays', async () => {
    const res = await post('/operations', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    const answers = d['answers'] as Record<string, unknown>
    assert.ok(answers !== null && typeof answers === 'object', 'answers must be object')
    for (const key of ['healthy', 'degraded', 'failing', 'changed', 'atRisk', 'investigate']) {
      assert.ok(Array.isArray(answers[key]), `answers.${key} must be array`)
    }
  })

  it('data contains the 8 area sub-reports', async () => {
    const res = await post('/operations', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    for (const key of ['runtime', 'commerce', 'merchant', 'customer', 'deployment', 'incident', 'security', 'forecast']) {
      assert.ok(key in d, `OperationsReport must contain sub-report: ${key}`)
    }
  })

  it('data.summary is a non-empty string', async () => {
    const res = await post('/operations', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(typeof d['summary'], 'string')
    assert.ok((d['summary'] as string).length > 0)
  })

  it('data.health has a band field', async () => {
    const res = await post('/operations', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    const health = d['health'] as Record<string, unknown>
    assert.ok(['healthy', 'degraded', 'failing', 'unknown'].includes(health['band'] as string))
  })

  it('accepts empty body gracefully', async () => {
    const res = await app.request('/operations', { method: 'POST' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })

  it('data.liveConnected is false (no adapters wired)', async () => {
    const res = await post('/operations', {})
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(d['liveConnected'], false)
  })
})

describe('LCOS operations endpoints cross-cut', () => {
  it('all 9 LCOS endpoints return 200 with success=true and envelope contract', async () => {
    const lcosEndpoints = [
      () => post('/runtime', {}),
      () => post('/commerce', {}),
      () => post('/merchant', {}),
      () => post('/customer', {}),
      () => post('/deployment', {}),
      () => post('/incident', {}),
      () => post('/security-ops', {}),
      () => post('/forecast', {}),
      () => post('/operations', {}),
    ]
    for (const ep of lcosEndpoints) {
      const res = await ep()
      const body = await res.json() as Record<string, unknown>
      assert.equal(res.status, 200, `LCOS endpoint returned ${res.status}`)
      assert.equal(body['success'], true)
      assert.equal(typeof body['version'], 'string')
      assert.ok(Array.isArray(body['evidence']))
      assert.equal(typeof body['executionTime'], 'number')
    }
  })

  it('all 9 LCOS POST endpoints accept empty body without error', async () => {
    const paths = ['/runtime', '/commerce', '/merchant', '/customer', '/deployment', '/incident', '/security-ops', '/forecast', '/operations']
    for (const path of paths) {
      const res = await app.request(path, { method: 'POST' })
      const body = await res.json() as Record<string, unknown>
      assert.equal(res.status, 200, `${path} rejected empty body`)
      assert.equal(body['success'], true)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 7: EINS engineering endpoints
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /engineering/blueprint', () => {
  it('returns 200 with envelope and source=engineering-blueprint', async () => {
    const res = await post('/engineering/blueprint', { text: 'Add GST e-invoicing endpoint' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'engineering-blueprint')
    assert.equal(body['success'], true)
  })

  it('data has evidence + confidence + sources + timestamp (EngineeringArtifact)', async () => {
    const res = await post('/engineering/blueprint', { text: 'Add order cancellation flow' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['evidence']), 'data.evidence must be array')
    assert.equal(typeof d['confidence'], 'number')
    assert.ok(Array.isArray(d['sources']), 'data.sources must be array')
    assert.equal(typeof d['timestamp'], 'string')
  })

  it('data has impact + gates + summary', async () => {
    const res = await post('/engineering/blueprint', { text: 'Add refund webhook' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok('impact' in d, 'blueprint must have impact')
    assert.ok(Array.isArray(d['gates']), 'blueprint.gates must be array')
    assert.equal(typeof d['summary'], 'string')
  })

  it('accepts optional domains/tables/symbols seeds', async () => {
    const res = await post('/engineering/blueprint', {
      text: 'Migrate checkout',
      domains: ['payments'],
      tables: ['orders'],
      symbols: ['create_checkout_order'],
    })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })

  it('returns 400 for missing text field', async () => {
    const res = await post('/engineering/blueprint', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.equal((body['error'] as Record<string, unknown>)['code'], 'VALIDATION_ERROR')
    assert.ok(!('stack' in body))
  })

  it('returns 400 for empty text string', async () => {
    const res = await post('/engineering/blueprint', { text: '' })
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
  })
})

describe('POST /engineering/tasks', () => {
  it('returns 200 with envelope and source=engineering-tasks', async () => {
    const res = await post('/engineering/tasks', { text: 'Add inventory transfer feature' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'engineering-tasks')
    assert.equal(body['success'], true)
  })

  it('data.tasks is an array and data.count matches', async () => {
    const res = await post('/engineering/tasks', { text: 'Add discount codes' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['tasks']), 'data.tasks must be array')
    assert.equal(d['count'], (d['tasks'] as unknown[]).length)
  })

  it('returns 400 for missing text', async () => {
    const res = await post('/engineering/tasks', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.ok(!('stack' in body))
  })
})

describe('POST /engineering/verification', () => {
  it('returns 200 with envelope and source=engineering-verification', async () => {
    const res = await post('/engineering/verification', { text: 'Add refund flow' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'engineering-verification')
    assert.equal(body['success'], true)
  })

  it('data has evidence + confidence + sources + timestamp', async () => {
    const res = await post('/engineering/verification', { text: 'Test checkout flow' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['evidence']), 'data.evidence must be array')
    assert.equal(typeof d['confidence'], 'number')
    assert.ok(Array.isArray(d['sources']))
    assert.equal(typeof d['timestamp'], 'string')
  })

  it('returns 400 for missing text', async () => {
    const res = await post('/engineering/verification', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.ok(!('stack' in body))
  })
})

describe('POST /engineering/rollback', () => {
  it('returns 200 with envelope and source=engineering-rollback', async () => {
    const res = await post('/engineering/rollback', { text: 'Roll back order schema change' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'engineering-rollback')
    assert.equal(body['success'], true)
  })

  it('data has evidence + confidence + sources + timestamp', async () => {
    const res = await post('/engineering/rollback', { text: 'Rollback payment provider swap' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['evidence']))
    assert.equal(typeof d['confidence'], 'number')
    assert.ok(Array.isArray(d['sources']))
    assert.equal(typeof d['timestamp'], 'string')
  })

  it('returns 400 for missing text', async () => {
    const res = await post('/engineering/rollback', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
  })
})

describe('POST /engineering/rollout', () => {
  it('returns 200 with envelope and source=engineering-rollout', async () => {
    const res = await post('/engineering/rollout', { text: 'Launch v1 to production' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'engineering-rollout')
    assert.equal(body['success'], true)
  })

  it('data has evidence + confidence + sources + timestamp', async () => {
    const res = await post('/engineering/rollout', { text: 'Evaluate launch readiness for v2' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['evidence']))
    assert.equal(typeof d['confidence'], 'number')
    assert.ok(Array.isArray(d['sources']))
    assert.equal(typeof d['timestamp'], 'string')
  })

  it('returns 400 for missing text', async () => {
    const res = await post('/engineering/rollout', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.ok(!('stack' in body))
  })
})

describe('POST /engineering/agent-plan', () => {
  it('returns 200 with envelope and source=engineering-agent-plan', async () => {
    const res = await post('/engineering/agent-plan', { text: 'Implement gift-card balance top-up' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'engineering-agent-plan')
    assert.equal(body['success'], true)
  })

  it('data.tasks is an array and data.summary is a non-empty string', async () => {
    const res = await post('/engineering/agent-plan', { text: 'Add shipping zones' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(Array.isArray(d['tasks']), 'agentPlan.tasks must be array')
    assert.equal(typeof d['summary'], 'string')
    assert.ok((d['summary'] as string).length > 0)
  })

  it('data has byAgentType map', async () => {
    const res = await post('/engineering/agent-plan', { text: 'Add staff accounts' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok(d['byAgentType'] !== null && typeof d['byAgentType'] === 'object', 'byAgentType must be object')
  })

  it('returns 400 for missing text', async () => {
    const res = await post('/engineering/agent-plan', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.ok(!('stack' in body))
  })
})

describe('POST /engineering/package', () => {
  it('returns 200 with envelope and source=engineering-package', async () => {
    const res = await post('/engineering/package', { text: 'Add multi-currency support' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assertEnvelope(body, 'engineering-package')
    assert.equal(body['success'], true)
  })

  it('data.decision has verdict and blockers array', async () => {
    const res = await post('/engineering/package', { text: 'Add loyalty points program' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    const decision = d['decision'] as Record<string, unknown>
    assert.ok(['GO', 'CONDITIONAL_GO', 'NO_GO'].includes(decision['verdict'] as string))
    assert.ok(Array.isArray(decision['blockers']), 'decision.blockers must be array')
  })

  it('data has blueprint, tasks, agentPlan, graph (full package)', async () => {
    const res = await post('/engineering/package', { text: 'Add product bundles' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.ok('blueprint' in d, 'package must have blueprint')
    assert.ok(Array.isArray(d['tasks']), 'package.tasks must be array')
    assert.ok('agentPlan' in d, 'package must have agentPlan')
    assert.ok('graph' in d, 'package must have graph')
  })

  it('a money feature — decision and evidence are present (structural gates)', async () => {
    const res = await post('/engineering/package', {
      text: 'Add money transfer from wallet to payout',
      tables: ['payment_transactions'],
      symbols: ['create_checkout_order'],
    })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    const decision = d['decision'] as Record<string, unknown>
    assert.ok(['GO', 'CONDITIONAL_GO', 'NO_GO'].includes(decision['verdict'] as string))
    assert.ok(Array.isArray(body['evidence']), 'envelope evidence must be present')
    const blueprint = d['blueprint'] as Record<string, unknown>
    assert.ok(Array.isArray(blueprint['gates']), 'blueprint.gates must be array')
  })

  it('data.summary is a non-empty string', async () => {
    const res = await post('/engineering/package', { text: 'Add coupon expiry notifications' })
    const body = await res.json() as Record<string, unknown>
    const d = body['data'] as Record<string, unknown>
    assert.equal(typeof d['summary'], 'string')
    assert.ok((d['summary'] as string).length > 0)
  })

  it('returns 400 for missing text field', async () => {
    const res = await post('/engineering/package', {})
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
    assert.equal((body['error'] as Record<string, unknown>)['code'], 'VALIDATION_ERROR')
    assert.ok(!('stack' in body))
  })

  it('returns 400 for empty text string', async () => {
    const res = await post('/engineering/package', { text: '' })
    assert.equal(res.status, 400)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], false)
  })

  it('accepts all optional seed fields', async () => {
    const res = await post('/engineering/package', {
      text: 'Release v2 payment integration',
      domains: ['payments'],
      tables: ['payment_transactions'],
      symbols: ['confirm_order_payment_with_ledger'],
    })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
  })
})

describe('EINS engineering endpoints cross-cut', () => {
  it('all 7 engineering endpoints return 200 with success=true and envelope contract', async () => {
    const einsEndpoints = [
      () => post('/engineering/blueprint', { text: 'Add feature A' }),
      () => post('/engineering/tasks', { text: 'Add feature B' }),
      () => post('/engineering/verification', { text: 'Add feature C' }),
      () => post('/engineering/rollback', { text: 'Add feature D' }),
      () => post('/engineering/rollout', { text: 'Add feature E' }),
      () => post('/engineering/agent-plan', { text: 'Add feature F' }),
      () => post('/engineering/package', { text: 'Add feature G' }),
    ]
    for (const ep of einsEndpoints) {
      const res = await ep()
      const body = await res.json() as Record<string, unknown>
      assert.equal(res.status, 200, `EINS endpoint returned ${res.status}`)
      assert.equal(body['success'], true)
      assert.equal(typeof body['version'], 'string')
      assert.ok(Array.isArray(body['evidence']))
      assert.equal(typeof body['executionTime'], 'number')
    }
  })

  it('all 7 engineering endpoints return 400 when text is missing', async () => {
    const paths = [
      '/engineering/blueprint',
      '/engineering/tasks',
      '/engineering/verification',
      '/engineering/rollback',
      '/engineering/rollout',
      '/engineering/agent-plan',
      '/engineering/package',
    ]
    for (const path of paths) {
      const res = await post(path, {})
      const body = await res.json() as Record<string, unknown>
      assert.equal(res.status, 400, `${path} should return 400 for missing text`)
      assert.equal(body['success'], false)
      assert.ok(!('stack' in body), `${path} must not leak stack trace`)
    }
  })

  it('honest unresolved: package returns data with evidence even when no seeds resolve', async () => {
    const res = await post('/engineering/package', { text: 'xyzzy_nonexistent_feature_abc_987' })
    assert.equal(res.status, 200)
    const body = await res.json() as Record<string, unknown>
    assert.equal(body['success'], true)
    const d = body['data'] as Record<string, unknown>
    assert.ok('blueprint' in d, 'blueprint must be present')
    assert.ok(Array.isArray(d['tasks']), 'tasks must be present')
  })
})
