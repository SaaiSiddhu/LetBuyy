/**
 * EmailAdapter tests — 20 cases covering:
 *   - NOT_CONNECTED honesty (missing RESEND_API_KEY, names exact var)
 *   - CONNECTED via MockHttpClient (domains, facts)
 *   - Both capabilities: domains, verification
 *   - Zod validation of responses (happy path + shape mismatch → ERROR)
 *   - All checks() findings: email-domain-unverified (high), email-no-domains (medium),
 *     email-inventory (info) — fires on crafted fixture AND absent on clean fixture
 *   - probe() success and probe() failure → health ERROR
 *   - Determinism: two collect() calls with same mocks produce identical JSON
 *   - Read-only source scan: no write/exec/spawn/fetch in src/email/
 *   - metadata: name/requiredEnv/capabilities exact
 *   - NOT CONNECTED evidence for delivery metrics is honest
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import {
  CredentialProvider,
  MockHttpClient,
  type AdapterDeps,
} from '../src/shared/index';
import { EmailAdapter } from '../src/email/EmailAdapter';
import {
  ResendDomainSchema,
  ResendDomainsResponseSchema,
  ResendProbeResponseSchema,
} from '../src/email/types';
import type { EmailPayload } from '../src/email/types';

const FIXED_NOW = '2026-07-04T00:00:00.000Z';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** A fully verified domain — the clean-fixture case. */
const DOMAIN_VERIFIED = {
  id: 'dom_letbuyy',
  name: 'letbuyy.com',
  status: 'verified',
  region: 'us-east-1',
  created_at: '2026-01-15T08:00:00.000Z',
};

/** An unverified domain — triggers email-domain-unverified. */
const DOMAIN_PENDING = {
  id: 'dom_pending',
  name: 'mail.letbuyy.com',
  status: 'pending',
  region: 'us-east-1',
  created_at: '2026-06-01T12:00:00.000Z',
};

/** A domain in failure state — also triggers email-domain-unverified. */
const DOMAIN_FAILURE = {
  id: 'dom_failure',
  name: 'transact.letbuyy.com',
  status: 'failure',
  created_at: '2026-05-20T09:30:00.000Z',
};

const MOCK_DOMAINS_ALL_VERIFIED = {
  data: [DOMAIN_VERIFIED],
};

const MOCK_DOMAINS_MIXED = {
  data: [DOMAIN_VERIFIED, DOMAIN_PENDING],
};

const MOCK_DOMAINS_NONE_VERIFIED = {
  data: [DOMAIN_PENDING, DOMAIN_FAILURE],
};

const MOCK_DOMAINS_EMPTY = {
  data: [],
};

function makeMockHttp(
  domainsBody: unknown = MOCK_DOMAINS_ALL_VERIFIED,
  domainsStatus?: number,
): MockHttpClient {
  return new MockHttpClient([
    {
      match: (u) => u.includes('/domains'),
      body: domainsBody,
      ...(domainsStatus !== undefined ? { status: domainsStatus } : {}),
    },
  ]);
}

function connected(
  env: Record<string, string> = { RESEND_API_KEY: 're_test_key' },
  domainsBody: unknown = MOCK_DOMAINS_ALL_VERIFIED,
): AdapterDeps {
  return {
    http: makeMockHttp(domainsBody),
    creds: new CredentialProvider(env),
    now: () => FIXED_NOW,
  };
}

function disconnected(): AdapterDeps {
  return {
    http: makeMockHttp(),
    creds: new CredentialProvider({}),
    now: () => FIXED_NOW,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('(1) NOT_CONNECTED when RESEND_API_KEY absent — names the exact env var', async () => {
  const a = new EmailAdapter(disconnected());
  const h = await a.health();
  assert.equal(h.status, 'NOT_CONNECTED');
  assert.equal(h.latencyMs, null);
  assert.match(h.detail, /RESEND_API_KEY/);
  assert.ok(h.missingEnvVars.includes('RESEND_API_KEY'));
  assert.ok(
    h.evidence.some((e) => e.kind === 'not-connected' && e.source === 'RESEND_API_KEY'),
    'should have a not-connected evidence citing RESEND_API_KEY',
  );
});

test('(2) NOT_CONNECTED → collect returns empty payload with confidence 0', async () => {
  const a = new EmailAdapter(disconnected());
  const s = await a.collect();
  assert.equal(s.status, 'NOT_CONNECTED');
  assert.equal(s.confidence, 0);
  assert.deepEqual(s.payload, {});
});

test('(3) NOT_CONNECTED → verify returns no findings', async () => {
  const a = new EmailAdapter(disconnected());
  const v = await a.verify();
  assert.equal(v.status, 'NOT_CONNECTED');
  assert.equal(v.findings.length, 0);
});

test('(4) probe() succeeds with valid key and correct domains response', async () => {
  const a = new EmailAdapter(connected());
  const h = await a.health();
  assert.equal(h.status, 'CONNECTED');
  assert.ok(h.latencyMs !== null && h.latencyMs >= 0);
  assert.match(h.detail, /reachable/i);
});

test('(5) probe() fails when /domains returns unexpected shape', async () => {
  const badHttp = new MockHttpClient([
    { match: (u) => u.includes('/domains'), body: { not_data: true } },
  ]);
  const a = new EmailAdapter({
    http: badHttp,
    creds: new CredentialProvider({ RESEND_API_KEY: 're_bad' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
  assert.match(h.detail, /probe failed|unexpected response shape/);
});

test('(6) probe() fails when /domains returns HTTP 401', async () => {
  const http401 = new MockHttpClient([
    { match: (u) => u.includes('/domains'), body: {}, status: 401 },
  ]);
  const a = new EmailAdapter({
    http: http401,
    creds: new CredentialProvider({ RESEND_API_KEY: 're_invalid' }),
    now: () => FIXED_NOW,
  });
  const h = await a.health();
  assert.equal(h.status, 'ERROR');
});

test('(7) gather happy path — collect returns CONNECTED with correct shape', async () => {
  const a = new EmailAdapter(connected());
  const s = await a.collect();
  assert.equal(s.status, 'CONNECTED');
  assert.equal(s.adapter, 'email');
  assert.equal(s.source, 'Resend');
  assert.ok(s.confidence > 0 && s.confidence <= 0.95);
  const p = s.payload as EmailPayload;
  assert.ok(Array.isArray(p.domains));
  assert.ok(Array.isArray(p.facts));
});

test('(8) gather — emits email-domain facts for each domain', async () => {
  const a = new EmailAdapter(connected({ RESEND_API_KEY: 're_test' }, MOCK_DOMAINS_MIXED));
  const s = await a.collect();
  const p = s.payload as EmailPayload;
  const domainFacts = p.facts.filter((f) => f.kind === 'email-domain');
  assert.equal(domainFacts.length, 2, 'should emit one email-domain fact per domain');
});

test('(9) gather — email-domain fact detail includes status for unverified domain', async () => {
  const a = new EmailAdapter(connected({ RESEND_API_KEY: 're_test' }, MOCK_DOMAINS_MIXED));
  const s = await a.collect();
  const p = s.payload as EmailPayload;
  const pendingFact = p.facts.find(
    (f) => f.kind === 'email-domain' && f.subject === 'mail.letbuyy.com',
  );
  assert.ok(pendingFact, 'should have a fact for mail.letbuyy.com');
  assert.match(pendingFact!.detail, /pending/);
  assert.match(pendingFact!.detail, /NOT VERIFIED/);
});

test('(10) gather — delivery metrics honestly stated as NOT CONNECTED in evidence', async () => {
  const a = new EmailAdapter(connected());
  const s = await a.collect();
  const deliveryEv = s.evidence.find(
    (e) => typeof e.detail === 'string' && e.detail.includes('NOT CONNECTED'),
  );
  assert.ok(deliveryEv, 'should cite delivery metrics as NOT CONNECTED in evidence');
});

test('(11) Zod: invalid /domains shape → collect returns ERROR status', async () => {
  const badHttp = new MockHttpClient([
    { match: (u) => u.includes('/domains'), body: { data: 'not-an-array' } },
  ]);
  const a = new EmailAdapter({
    http: badHttp,
    creds: new CredentialProvider({ RESEND_API_KEY: 're_test' }),
    now: () => FIXED_NOW,
  });
  const s = await a.collect();
  assert.equal(s.status, 'ERROR');
  assert.equal(s.confidence, 0);
});

test('(12) checks: email-domain-unverified (high) fires for non-verified domain', async () => {
  const a = new EmailAdapter(connected({ RESEND_API_KEY: 're_test' }, MOCK_DOMAINS_NONE_VERIFIED));
  const v = await a.verify();
  const unverified = v.findings.filter((f) => f.kind === 'email-domain-unverified');
  assert.ok(unverified.length >= 1, 'should have at least one unverified finding');
  assert.ok(
    unverified.every((f) => f.severity === 'high'),
    'all email-domain-unverified findings must be high severity',
  );
  assert.ok(
    unverified.some((f) => f.subject === 'mail.letbuyy.com'),
    'should flag mail.letbuyy.com',
  );
  assert.ok(unverified[0]!.evidence.length > 0, 'finding must cite evidence');
});

test('(13) checks: email-domain-unverified does NOT fire when all domains verified', async () => {
  const a = new EmailAdapter(connected({ RESEND_API_KEY: 're_test' }, MOCK_DOMAINS_ALL_VERIFIED));
  const v = await a.verify();
  const unverified = v.findings.filter((f) => f.kind === 'email-domain-unverified');
  assert.equal(unverified.length, 0, 'should have no unverified findings when all domains are verified');
});

test('(14) checks: email-no-domains (medium) fires when domains list is empty', async () => {
  const a = new EmailAdapter(connected({ RESEND_API_KEY: 're_test' }, MOCK_DOMAINS_EMPTY));
  const v = await a.verify();
  const noDomains = v.findings.filter((f) => f.kind === 'email-no-domains');
  assert.ok(noDomains.length >= 1, 'should flag no domains configured');
  assert.equal(noDomains[0]!.severity, 'medium');
  assert.ok(noDomains[0]!.evidence.length > 0);
});

test('(15) checks: email-no-domains does NOT fire when domains are present', async () => {
  const a = new EmailAdapter(connected({ RESEND_API_KEY: 're_test' }, MOCK_DOMAINS_MIXED));
  const v = await a.verify();
  const noDomains = v.findings.filter((f) => f.kind === 'email-no-domains');
  assert.equal(noDomains.length, 0, 'should not flag no-domains when domains exist');
});

test('(16) checks: email-inventory (info) fires when domains present', async () => {
  const a = new EmailAdapter(connected({ RESEND_API_KEY: 're_test' }, MOCK_DOMAINS_ALL_VERIFIED));
  const v = await a.verify();
  const inv = v.findings.filter((f) => f.kind === 'email-inventory' && f.severity === 'info');
  assert.ok(inv.length >= 1, 'should emit an email-inventory info finding');
  assert.match(inv[0]!.detail, /NOT CONNECTED/, 'inventory detail should mention delivery metrics NOT CONNECTED');
  assert.ok(inv[0]!.evidence.length > 0);
});

test('(17) checks: email-inventory does NOT fire when domains list is empty', async () => {
  const a = new EmailAdapter(connected({ RESEND_API_KEY: 're_test' }, MOCK_DOMAINS_EMPTY));
  const v = await a.verify();
  const inv = v.findings.filter((f) => f.kind === 'email-inventory');
  assert.equal(inv.length, 0, 'no inventory finding when no domains');
});

test('(18) determinism — two collect() calls with same mocks produce identical JSON', async () => {
  const a1 = new EmailAdapter(connected({ RESEND_API_KEY: 're_test' }, MOCK_DOMAINS_MIXED));
  const a2 = new EmailAdapter(connected({ RESEND_API_KEY: 're_test' }, MOCK_DOMAINS_MIXED));
  const s1 = await a1.collect();
  const s2 = await a2.collect();
  assert.equal(JSON.stringify(s1), JSON.stringify(s2), 'two collect() calls must produce identical JSON');
});

test('(19) metadata: name=email, displayName, requiredEnv, capabilities exact', () => {
  const a = new EmailAdapter(connected());
  const md = a.metadata();
  assert.equal(md.name, 'email');
  assert.equal(md.displayName, 'Email (Resend)');
  assert.equal(md.sourceOfTruth, 'Resend');
  assert.ok(md.requiredEnv.includes('RESEND_API_KEY'));
  assert.equal(md.requiredEnv.length, 1, 'only RESEND_API_KEY is required');
  assert.ok(md.capabilities.includes('domains'), 'must list domains capability');
  assert.ok(md.capabilities.includes('verification'), 'must list verification capability');
});

test('(20) read-only source scan — no write/exec/spawn/eval/fetch in src/email/', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const emailSrc = join(here, '..', 'src', 'email');
  const FORBIDDEN =
    /child_process|\bspawn\s*\(|\bexecSync\b|\bexec\s*\(|\beval\s*\(|new Function|writeFileSync|appendFileSync|\bwriteFile\s*\(|rmSync|unlinkSync|\bfetch\s*\(/;
  const offenders: string[] = [];
  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) out.push(...walk(p));
      else if (e.endsWith('.ts')) out.push(p);
    }
    return out;
  }
  for (const f of walk(emailSrc)) {
    if (FORBIDDEN.test(readFileSync(f, 'utf8'))) offenders.push(f);
  }
  assert.deepEqual(offenders, [], `forbidden primitives in: ${offenders.join(', ')}`);
});

// ── Zod schema unit tests ─────────────────────────────────────────────────────

test('(21) Zod: ResendDomainSchema accepts valid verified domain', () => {
  const r = ResendDomainSchema.safeParse(DOMAIN_VERIFIED);
  assert.ok(r.success);
  assert.equal(r.data.status, 'verified');
  assert.equal(r.data.name, 'letbuyy.com');
});

test('(22) Zod: ResendDomainSchema coerces unknown status via .catch', () => {
  const r = ResendDomainSchema.safeParse({ id: 'x', name: 'test.com', status: 'unknown_future_status' });
  assert.ok(r.success, 'should succeed via .catch fallback');
  assert.equal(r.data.status, 'not_started', 'unknown status should fall back to not_started');
});

test('(23) Zod: ResendDomainsResponseSchema rejects non-array data field', () => {
  const r = ResendDomainsResponseSchema.safeParse({ data: 'not-array' });
  assert.ok(!r.success, 'should reject non-array data');
});

test('(24) Zod: ResendProbeResponseSchema accepts any array in data', () => {
  const r = ResendProbeResponseSchema.safeParse({ data: [{ anything: true }] });
  assert.ok(r.success);
});

test('(25) Zod: ResendProbeResponseSchema rejects missing data field', () => {
  const r = ResendProbeResponseSchema.safeParse({ other: [] });
  assert.ok(!r.success, 'should reject response without data field');
});
