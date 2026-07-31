/**
 * Verification module barrel export.
 * Public surface: VerificationService + the relevant contract types.
 *
 * Contract types (Verification, VerificationStatus, Gap, Evidence) are re-exported
 * from the canonical contracts module — consumers should prefer that source.
 * They are also re-exported here for ergonomic single-import access.
 */
export { VerificationService } from './VerificationService';
export type { Verification, VerificationStatus, Gap, Evidence } from '../contracts/index';
