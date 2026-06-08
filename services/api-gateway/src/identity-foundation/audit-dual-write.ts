import type { AuditEmitResult, AuditEventCategory, AuditEventEnvelope } from '@letbuyy/audit-core';

export type CanonicalAuditActorType =
  | 'customer'
  | 'merchant'
  | 'partner'
  | 'platform_employee'
  | 'platform_operator'
  | 'service'
  | 'system'
  | 'webhook';

export interface AuditEventRow {
  event_id: string;
  category: AuditEventCategory;
  action: string;
  actor_type: CanonicalAuditActorType;
  actor_id?: string;
  actor_realm?: string;
  subject_type?: string;
  subject_id?: string;
  target_type: string;
  target_id?: string;
  site_id?: string;
  org_id?: string;
  correlation_id?: string;
  request_id?: string;
  session_id?: string;
  device_id?: string;
  ip_hash?: string;
  user_agent_hash?: string;
  risk_level: AuditEventEnvelope['riskLevel'];
  metadata: Record<string, unknown>;
  encrypted_pii?: Record<string, unknown>;
  seq?: number;
  prev_hash?: string;
  hash?: string;
  occurred_at: string;
}

export interface AuditHashChainInput {
  previousSeq?: number;
  previousHash?: string;
  anchorKid: string;
}

export interface AuditHashChainResult {
  seq: number;
  prevHash?: string;
  hash: string;
  anchorKid: string;
}

export interface AuditDualWriteExecution<Row = AuditEventRow> extends AuditEmitResult {
  canonicalRow?: Row;
  hashChain?: AuditHashChainResult;
}

export interface AuditDualWritePlan {
  featureEnabled: boolean;
  writeLegacy: boolean;
  writeCanonical: boolean;
  event: AuditEventEnvelope;
  canonicalRow: AuditEventRow;
}

export function planAuditDualWrite(event: AuditEventEnvelope, featureEnabled: boolean): AuditDualWritePlan {
  return {
    featureEnabled,
    writeLegacy: true,
    writeCanonical: featureEnabled,
    event,
    canonicalRow: toAuditEventRow(event),
  };
}

export function summarizeAuditDualWrite(plan: AuditDualWritePlan): AuditEmitResult {
  return {
    accepted: true,
    eventId: plan.event.eventId,
    legacyWritten: plan.writeLegacy,
    canonicalWritten: plan.writeCanonical,
  };
}

export function reconcileLegacyAuditActorType(input: string): CanonicalAuditActorType {
  switch (input) {
    case 'customer':
      return 'customer';
    case 'employee':
      return 'platform_employee';
    case 'super_admin':
      return 'platform_operator';
    case 'webhook':
      return 'webhook';
    case 'service':
      return 'service';
    case 'system':
      return 'system';
    case 'partner':
      return 'partner';
    case 'merchant':
    case 'user':
    default:
      return 'merchant';
  }
}

export function redactAuditMetadata(metadata: Record<string, unknown> = {}): {
  metadata: Record<string, unknown>;
  encryptedPii?: Record<string, unknown>;
} {
  const redacted: Record<string, unknown> = {};
  const encryptedPii: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (/(email|phone|mobile|address|ip|name)$/i.test(key)) {
      redacted[key] = '[redacted]';
      encryptedPii[key] = {
        placeholder: true,
        algorithm: 'identity-foundation-mock-envelope',
        value,
      };
    } else {
      redacted[key] = value;
    }
  }

  return Object.keys(encryptedPii).length > 0
    ? { metadata: redacted, encryptedPii }
    : { metadata: redacted };
}

export function toAuditEventRow(event: AuditEventEnvelope): AuditEventRow {
  const redacted = redactAuditMetadata(event.metadata);

  return {
    event_id: event.eventId,
    category: event.category,
    action: event.action,
    actor_type: reconcileLegacyAuditActorType(event.actor.type),
    actor_id: event.actor.id,
    actor_realm: event.actor.realm,
    subject_type: event.subject?.type,
    subject_id: event.subject?.id,
    target_type: event.target.type,
    target_id: event.target.id,
    site_id: event.target.siteId,
    org_id: event.target.orgId,
    correlation_id: event.correlationId,
    request_id: event.requestId,
    session_id: event.sessionId,
    device_id: event.deviceId,
    ip_hash: event.ipHash,
    user_agent_hash: event.userAgentHash,
    risk_level: event.riskLevel,
    metadata: redacted.metadata,
    encrypted_pii: redacted.encryptedPii,
    occurred_at: event.occurredAt,
  };
}

function stableSerialize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(',')}]`;

  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, nestedValue]) => `${JSON.stringify(key)}:${stableSerialize(nestedValue)}`)
    .join(',')}}`;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function computeAuditHashChain(
  row: AuditEventRow,
  input: AuditHashChainInput,
): Promise<AuditHashChainResult> {
  const seq = (input.previousSeq ?? 0) + 1;
  const body = stableSerialize({
    ...row,
    seq,
    prev_hash: input.previousHash,
    anchor_kid: input.anchorKid,
  });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));

  return {
    seq,
    prevHash: input.previousHash,
    hash: `sha256:${base64UrlEncode(new Uint8Array(digest))}`,
    anchorKid: input.anchorKid,
  };
}

export async function prepareCanonicalAuditRow(
  event: AuditEventEnvelope,
  chainInput: AuditHashChainInput,
): Promise<AuditEventRow> {
  const row = toAuditEventRow(event);
  const hashChain = await computeAuditHashChain(row, chainInput);

  return {
    ...row,
    seq: hashChain.seq,
    prev_hash: hashChain.prevHash,
    hash: hashChain.hash,
    metadata: {
      ...row.metadata,
      audit_anchor_kid: hashChain.anchorKid,
      audit_anchor_mode: 'mock-kms',
    },
  };
}

export async function emitAuditDualWrite(
  event: AuditEventEnvelope,
  input: {
    featureEnabled: boolean;
    chain?: AuditHashChainInput;
    writeCanonical?: (row: AuditEventRow) => Promise<void>;
    writeLegacy?: (event: AuditEventEnvelope) => Promise<void>;
  },
): Promise<AuditDualWriteExecution> {
  const plan = planAuditDualWrite(event, input.featureEnabled);
  await input.writeLegacy?.(event);

  if (!plan.writeCanonical) return summarizeAuditDualWrite(plan);

  const canonicalRow = input.chain
    ? await prepareCanonicalAuditRow(event, input.chain)
    : plan.canonicalRow;
  await input.writeCanonical?.(canonicalRow);

  return {
    accepted: true,
    eventId: event.eventId,
    legacyWritten: true,
    canonicalWritten: true,
    canonicalRow,
    hashChain: canonicalRow.seq && canonicalRow.hash
      ? {
          seq: canonicalRow.seq,
          prevHash: canonicalRow.prev_hash,
          hash: canonicalRow.hash,
          anchorKid: String(canonicalRow.metadata.audit_anchor_kid || 'mock-audit-anchor'),
        }
      : undefined,
  };
}
