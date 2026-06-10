# Gateway sub-router stubs (DRAFT — copy into `services/api-gateway/src/` and finalize)

These are copy-paste starting points for the new internal-ops route groups, mirroring the **existing** patterns in `services/api-gateway/src/routes/operations.ts` (RBAC guard, Zod schemas, `getSupabaseAdmin`, `success`/`paginated`, `ValidationError`). They are intentionally kept here as Markdown so they do **not** compile until you move them.

## Mount rule (critical — do NOT edit `index.ts`)

`/v1/operations` is already mounted in `index.ts` (`api.route('/operations', operationsRouter)`). Mount new internal sub-routers **inside `operations.ts`** so `index.ts` is untouched:

```ts
// near the bottom of services/api-gateway/src/routes/operations.ts, before `export default router;`
import riskRouter from './operations/risk';
import trustSafetyRouter from './operations/trust-safety';
import supportRouter from './operations/support';
router.route('/risk', riskRouter);                 // -> /v1/operations/risk/*
router.route('/trust-safety', trustSafetyRouter);  // -> /v1/operations/trust-safety/*
router.route('/support', supportRouter);           // -> /v1/operations/support/*
```

`operations.ts` already applies `router.use('*', requireRoleCategory('ops'), requireSuperAdmin)` at the top. Sub-routers inherit that; add a **narrower** category guard per domain (e.g. `requireRoleCategory('risk')`) once you extend `src/middleware/rbac.ts` additively with the new categories.

## `src/routes/operations/risk.ts` (stub)

```ts
import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../../index';
import { getSupabaseAdmin, success, paginated } from '../../lib/supabase';
import { ValidationError } from '../../lib/errors';
import { getRequestId } from '../../lib/tenant-context';
import { requireRoleCategory } from '../../middleware/rbac';
import { writeInternalAudit } from '../../lib/internal-audit'; // add per mission §INF-03
import {
  RiskScoreListQuerySchema,
  RecordRiskSignalSchema,
  RiskManualActionSchema,
} from '../../schemas/risk.schema'; // add per mission §6

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;

// Narrower guard than the parent ops router (extend RbacRoleCategory with 'risk' first).
router.use('*', requireRoleCategory('risk'));

function actorId(c: AppContext): string { return c.get('auth').user.id; }

// GET /v1/operations/risk/scores — banded list / queue
router.get('/scores', async (c) => {
  const query = RiskScoreListQuerySchema.parse(Object.fromEntries(new URL(c.req.url).searchParams));
  const db = getSupabaseAdmin(c.env);
  const from = (query.page - 1) * query.limit;
  let q = db.from('risk_scores').select('*', { count: 'exact' }).is('deleted_at', null);
  if (query.band) q = q.eq('band', query.band);
  const { data, count, error } = await q.order('computed_at', { ascending: false }).range(from, from + query.limit - 1);
  if (error) throw new ValidationError(error.message);
  return paginated(c, data ?? [], { page: query.page, limit: query.limit, total: count ?? 0 });
});

// POST /v1/operations/risk/signals — ingest a signal (idempotent on (entity, signal_key, observed_at))
router.post('/signals', async (c) => {
  const body = RecordRiskSignalSchema.parse(await c.req.json());
  const db = getSupabaseAdmin(c.env);
  const { data, error } = await db.from('risk_signals').insert(body).select().single();
  if (error) throw new ValidationError(error.message);
  return success(c, data);
});

// POST /v1/operations/risk/entities/:id/action — manual block / clear (lead + reason + audit)
router.post('/entities/:id/action', async (c) => {
  const body = RiskManualActionSchema.parse(await c.req.json()); // { action, reason, entity_type }
  const db = getSupabaseAdmin(c.env);
  const entityId = c.req.param('id');
  const { data, error } = await db.from('risk_action_events').insert({
    entity_type: body.entity_type, entity_id: entityId, action: body.action,
    actor_type: 'employee', actor_id: actorId(c), reason: body.reason,
  }).select().single();
  if (error) throw new ValidationError(error.message);
  await writeInternalAudit(c, { domain: 'risk', action: body.action, subject_type: body.entity_type, subject_id: entityId, reason: body.reason, request_id: getRequestId(c) });
  return success(c, data);
});

export default router;
```

## `src/routes/operations/trust-safety.ts` (stub — case lifecycle + segregation of duty)

```ts
import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env } from '../../index';
import { getSupabaseAdmin, success } from '../../lib/supabase';
import { ValidationError, ForbiddenError } from '../../lib/errors';
import { requireRoleCategory } from '../../middleware/rbac';
import { writeInternalAudit } from '../../lib/internal-audit';
import { OpenCaseSchema, EnforceSchema, AppealDecisionSchema } from '../../schemas/trust-safety.schema';

const router = new Hono<{ Bindings: Env }>();
type AppContext = Context<{ Bindings: Env }>;
function actorId(c: AppContext): string { return c.get('auth').user.id; }

router.use('*', requireRoleCategory('trust-safety'));

// POST /v1/operations/trust-safety/cases — open a case
router.post('/cases', async (c) => {
  const body = OpenCaseSchema.parse(await c.req.json());
  const db = getSupabaseAdmin(c.env);
  const { data, error } = await db.from('ts_cases').insert({ ...body, opened_by: actorId(c) }).select().single();
  if (error) throw new ValidationError(error.message);
  await db.from('ts_case_events').insert({ case_id: data.id, event_type: 'opened', actor_id: actorId(c) });
  await writeInternalAudit(c, { domain: 'trust_safety', case_ref: data.case_ref, action: 'open', subject_type: body.subject_type, subject_id: body.subject_id });
  return success(c, data);
});

// POST /v1/operations/trust-safety/cases/:id/enforce — suspend/takedown (lead + reason + dual-control)
router.post('/cases/:id/enforce', async (c) => {
  const body = EnforceSchema.parse(await c.req.json()); // { action, target_type, target_id, reason, second_approver_id }
  if (!body.reason) throw new ValidationError('reason required');
  // TODO dual-control: verify body.second_approver_id is a distinct lead-tier actor.
  const db = getSupabaseAdmin(c.env);
  const caseId = c.req.param('id');
  const { data, error } = await db.from('ts_takedowns').insert({
    case_id: caseId, target_type: body.target_type, target_id: body.target_id,
    action: body.action, enforced_by: actorId(c), reason: body.reason,
  }).select().single();
  if (error) throw new ValidationError(error.message);
  await db.from('ts_cases').update({ status: 'enforced', decided_by: actorId(c), decided_at: new Date().toISOString() }).eq('id', caseId);
  await db.from('ts_case_events').insert({ case_id: caseId, event_type: 'enforced', actor_id: actorId(c), reason: body.reason });
  await writeInternalAudit(c, { domain: 'trust_safety', action: 'enforce', subject_type: body.target_type, subject_id: body.target_id, reason: body.reason });
  return success(c, data);
});

// POST /v1/operations/trust-safety/appeals/:id/decide — SEGREGATION OF DUTY enforced here
router.post('/appeals/:id/decide', async (c) => {
  const body = AppealDecisionSchema.parse(await c.req.json()); // { status: 'upheld'|'overturned', decision_reason }
  const db = getSupabaseAdmin(c.env);
  const appealId = c.req.param('id');
  const { data: appeal } = await db.from('ts_appeals').select('*, ts_cases!inner(decided_by)').eq('id', appealId).single();
  if (appeal?.ts_cases?.decided_by === actorId(c)) {
    throw new ForbiddenError('Appeal reviewer must differ from the enforcing reviewer (segregation of duty).');
  }
  const { data, error } = await db.from('ts_appeals').update({
    status: body.status, reviewer_id: actorId(c), decided_at: new Date().toISOString(), decision_reason: body.decision_reason,
  }).eq('id', appealId).select().single();
  if (error) throw new ValidationError(error.message);
  await writeInternalAudit(c, { domain: 'trust_safety', action: `appeal_${body.status}`, subject_type: 'case', subject_id: appeal.case_id, reason: body.decision_reason });
  return success(c, data);
});

export default router;
```

## `src/schemas/risk.schema.ts` (stub)

```ts
import { z } from 'zod';
const entity = z.enum(['merchant','store','payment','app','theme','developer']);
export const RiskScoreListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  band: z.enum(['low','medium','high']).optional(),
});
export const RecordRiskSignalSchema = z.object({
  entity_type: entity, entity_id: z.string().uuid(), site_id: z.string().uuid().nullable().optional(),
  signal_key: z.string().min(1).max(120), value: z.number().optional(), context: z.record(z.string(), z.unknown()).optional(),
});
export const RiskManualActionSchema = z.object({
  entity_type: entity, action: z.enum(['manual_block','clear','escalate_ts']), reason: z.string().min(3).max(2000),
});
```

## Finalize checklist
- [ ] Extend `RbacRoleCategory` in `src/middleware/rbac.ts` with `risk`, `trust-safety`, `support`, `reviewer`, `finance`, `devrel` (additive).
- [ ] Add `src/lib/internal-audit.ts` (`writeInternalAudit`) writing `audit_logs` + `case_audit_events`.
- [ ] Add `ForbiddenError` if not already exported from `src/lib/errors.ts` (else reuse the existing 403 error type).
- [ ] Confirm `getSupabaseAdmin`/`success`/`paginated`/`getRequestId` signatures in `src/lib/`.
- [ ] Mount sub-routers inside `operations.ts` (never edit `index.ts`).
- [ ] Add unit tests: Zod reject, RBAC denial, audit-write assertion, SoD denial on appeals.
