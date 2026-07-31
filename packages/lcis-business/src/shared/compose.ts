/**
 * Internal composition helpers shared by the LBIS services. These enforce the no-fabrication
 * law in ONE place: notConnectedMetric() is the ONLY way a BusinessMetric is constructed, and
 * it always sets value:null / connection:NOT_CONNECTED. mapFinding() maps an operations
 * OperationalFinding into a BusinessFinding, preserving its honest connection status.
 */
import { type Evidence, evidence, notConnected } from '@letbuyy/lcis-core';
import type { BusinessFinding, BusinessMetric, Severity } from './types';

/** The single constructor for a business magnitude — always NOT_CONNECTED, never a number. */
export function notConnectedMetric(
  key: string,
  label: string,
  unit: string,
  liveSource: string,
  backedBy: readonly string[],
): BusinessMetric {
  const ev: Evidence[] = [notConnected(key, liveSource)];
  for (const b of backedBy) {
    ev.push(evidence('artifact-field', `backs:${key}`, `structurally backed by ${b}`, 'graphify-out'));
  }
  return { key, label, unit, value: null, connection: 'NOT_CONNECTED', liveSource, backedBy, evidence: ev };
}

interface OpsFindingLike {
  readonly id: string;
  readonly severity: Severity;
  readonly subject: string;
  readonly title: string;
  readonly detail: string;
  readonly status: string;
  readonly evidence: readonly Evidence[];
}

/** Map an operations OperationalFinding into a BusinessFinding, preserving its connection. */
export function mapFinding(area: string, f: OpsFindingLike): BusinessFinding {
  return {
    id: `${area}-${f.id}`,
    area,
    severity: f.severity,
    subject: f.subject,
    title: f.title,
    detail: f.detail,
    connection: f.status === 'CONNECTED' ? 'CONNECTED' : 'NOT_CONNECTED',
    evidence: f.evidence,
  };
}

/** A structural finding derived by LBIS itself (not from ops) — always evidence-cited. */
export function structuralFinding(
  area: string,
  id: string,
  severity: Severity,
  subject: string,
  title: string,
  detail: string,
  connection: 'CONNECTED' | 'NOT_CONNECTED',
  ev: readonly Evidence[],
): BusinessFinding {
  return { id: `${area}-${id}`, area, severity, subject, title, detail, connection, evidence: ev };
}

/** Safe ops-finding gather: any error degrades to [] (honest), never a throw. */
export function safeFindings(fn: () => readonly OpsFindingLike[]): readonly OpsFindingLike[] {
  try {
    return fn();
  } catch {
    return [];
  }
}
