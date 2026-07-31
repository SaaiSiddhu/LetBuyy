/**
 * The single composed input EAOS overlays execution state onto: the EINS EngineeringPackage.
 * buildEngineeringPackage() reuses lcis-engineering's facade verbatim (compose, never reimplement);
 * the seven EAOS services are pure, synchronous transforms over the resulting package.
 */
import type { LcisEngine } from '@letbuyy/lcis-core';
import { createEngineeringEngine, type EngineeringPackage, type FeatureRequest } from '@letbuyy/lcis-engineering';
import { defaultNow } from './envelope';

export async function buildEngineeringPackage(
  core: LcisEngine,
  req: FeatureRequest,
  now: () => string = defaultNow,
): Promise<EngineeringPackage> {
  return createEngineeringEngine({ core, now }).generateFullEngineeringPackage(req);
}

export function isEngineeringPackage(x: unknown): x is EngineeringPackage {
  return (
    typeof x === 'object' &&
    x !== null &&
    'blueprint' in x &&
    'tasks' in x &&
    'graph' in x &&
    'agentPlan' in x &&
    'decision' in x
  );
}
