import { z } from 'zod';
import { PersonalizationFactsSchema, PersonalizationDraftSchema, AcceptedPersonalizationSchema, type PersonalizationFacts, type PersonalizationDraft, type AcceptedPersonalization } from '@letbuyy/shared-types';
export { PersonalizationFactsSchema, PersonalizationDraftSchema, AcceptedPersonalizationSchema, type PersonalizationFacts, type PersonalizationDraft, type AcceptedPersonalization } from '@letbuyy/shared-types';

/** Project only the validated namespace; private and malformed metadata never become public facts. */
export function readPersonalizationFacts(metadata: unknown): PersonalizationFacts | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata) || !Object.prototype.hasOwnProperty.call(metadata, 'personalization')) return null;
  const parsed = PersonalizationFactsSchema.safeParse((metadata as Record<string, unknown>).personalization);
  return parsed.success ? parsed.data : null;
}

export interface PersonalizationIssue {
  field: 'configuration' | keyof PersonalizationDraft;
  code: 'INVALID_INPUT' | 'METHOD_UNAVAILABLE' | 'STYLE_UNAVAILABLE' | 'PLACEMENT_UNAVAILABLE' | 'NORMALIZE_TEXT' | 'INVALID_CHARACTERS' | 'INVALID_LENGTH';
  message: string;
  suggested_text?: string;
}
export type PersonalizationReview = { valid: true; accepted: AcceptedPersonalization; fingerprintInput: string; graphemes: number } | { valid: false; issues: PersonalizationIssue[]; graphemes?: number };
const segmenter = new Intl.Segmenter('und', { granularity: 'grapheme' });
export const countPersonalizationGraphemes = (value: string): number => Array.from(segmenter.segment(value)).length;

/** Deterministic INPUT to a server digest, never a security hash or a client authority. */
export function personalizationFingerprintInput(accepted: AcceptedPersonalization): string {
  return JSON.stringify([accepted.version, accepted.facts_revision, accepted.method.id, accepted.style.id, accepted.placement.id, accepted.text]);
}

/** The server must call this against current catalog facts before accepting or pricing a line. */
export function reviewPersonalization(factsInput: unknown, input: unknown): PersonalizationReview {
  const facts = PersonalizationFactsSchema.safeParse(factsInput);
  const draft = PersonalizationDraftSchema.safeParse(input);
  if (!facts.success || !draft.success) return { valid: false, issues: [{ field: 'configuration', code: 'INVALID_INPUT', message: 'Personalization information is missing or invalid. Reload the product and try again.' }] };
  const value = draft.data;
  const method = facts.data.methods.find(item => item.id === value.method_id);
  if (!method) return { valid: false, issues: [{ field: 'method_id', code: 'METHOD_UNAVAILABLE', message: 'Choose a personalization method available for this product.' }] };
  const style = method.styles.find(item => item.id === value.style_id);
  const placement = method.placements.find(item => item.id === value.placement_id);
  const issues: PersonalizationIssue[] = [];
  if (!style) issues.push({ field: 'style_id', code: 'STYLE_UNAVAILABLE', message: 'Choose a style available for this method.' });
  if (!placement) issues.push({ field: 'placement_id', code: 'PLACEMENT_UNAVAILABLE', message: 'Choose a placement available for this method.' });
  const normalized = value.text.normalize('NFC');
  if (normalized !== value.text) issues.push({ field: 'text', code: 'NORMALIZE_TEXT', message: 'This text needs Unicode normalization. Review the suggested text before accepting it.', suggested_text: normalized });
  const allowed = method.character_set === 'latin-name' ? /^[A-Za-z '\-]+$/u : /^[\p{L}\p{M} '\-]+$/u;
  if (!allowed.test(value.text) || !/\p{L}/u.test(value.text) || /[\p{Cc}\p{Cf}\p{Cs}]/u.test(value.text)) issues.push({ field: 'text', code: 'INVALID_CHARACTERS', message: method.character_set === 'latin-name' ? 'Use A–Z letters, spaces, apostrophes or hyphens. Include at least one letter.' : 'Use letters, spaces, apostrophes or hyphens. Include at least one letter.' });
  const graphemes = countPersonalizationGraphemes(value.text);
  if (graphemes < method.min_graphemes || graphemes > method.max_graphemes) issues.push({ field: 'text', code: 'INVALID_LENGTH', message: `Use ${method.min_graphemes}–${method.max_graphemes} characters. You entered ${graphemes}.` });
  if (issues.length || !style || !placement) return { valid: false, issues, graphemes };
  const accepted: AcceptedPersonalization = { version: 1, facts_revision: facts.data.revision, method: { id: method.id, label: method.label }, style: { ...style }, placement: { ...placement }, text: value.text };
  return { valid: true, accepted, fingerprintInput: personalizationFingerprintInput(accepted), graphemes };
}

export interface PersonalizationDraftState {
  draft: PersonalizationDraft;
  review: PersonalizationReview;
  lastValidPreview: AcceptedPersonalization | null;
}
/** Invalid edits retain their exact text while the illustration keeps the last valid configuration. */
export function updatePersonalizationDraft(facts: unknown, draft: PersonalizationDraft, previous?: PersonalizationDraftState): PersonalizationDraftState {
  const review = reviewPersonalization(facts, draft);
  const parsedFacts = PersonalizationFactsSchema.safeParse(facts);
  const prior = previous?.lastValidPreview;
  return { draft: { ...draft }, review, lastValidPreview: review.valid ? review.accepted : parsedFacts.success && prior?.facts_revision === parsedFacts.data.revision ? prior : null };
}
