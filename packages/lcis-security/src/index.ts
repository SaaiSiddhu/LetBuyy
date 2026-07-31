/**
 * @letbuyy/lcis-security — LSAS, the Security Analytics System (LCIS Phase 14).
 *
 * Read-only, deterministic security intelligence composed over governance (drift/compliance),
 * operations (live signals), the dependency twin (attack graph), change tracking (security
 * timeline), and adapter secret/webhook posture: threats, vulnerabilities, an attack graph,
 * secret/token/identity analytics, abuse detection, compliance analytics, a security timeline,
 * weighted risk scoring, health, and advisory-only recommendations. Never mutates; live
 * security signals stay NOT_CONNECTED with their exact source.
 */
export * from './shared/index';
export { ThreatIntelligenceService } from './threat/index';
export { AttackGraphService } from './attack/index';
export { IdentitySecretService } from './identity/index';
export { AbuseComplianceService } from './abuse/index';
export { SecurityTimelineService } from './timeline/index';
export { RiskScoringService, type RiskScoringInput } from './risk/index';
export {
  createSecurityAnalyticsEngine,
  getSecurityAnalyticsEngine,
  resetSecurityAnalyticsEngine,
  type SecurityAnalyticsEngine,
  type SecurityAnalyticsEngineOptions,
} from './engine';
