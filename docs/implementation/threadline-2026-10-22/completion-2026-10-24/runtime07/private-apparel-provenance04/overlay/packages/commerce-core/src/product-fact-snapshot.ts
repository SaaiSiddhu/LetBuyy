import { z } from 'zod';
import { ApparelFactsSchema } from './apparel';
import { UuidSchema } from '@letbuyy/shared-types';
import { PRODUCT_NICHE_FACT_SCHEMAS, ProductVariantMetadataSchema } from './niche-product-facts';
import { AcceptedPersonalizationSchema, PersonalizationDraftSchema, personalizationFingerprintInput, reviewPersonalization, type PersonalizationIssue } from './madeyours-facts';
import { FoodFactsSchema } from './pantry-facts';
import { resolveToyFacts } from './playfield-facts';
import { resolveFurnitureFacts } from './habitat-facts';
import { resolveSportsMeasurements } from './trailmark-facts';
import { mergeBooksVariantFacts } from './marginalia-facts';

const factSchemas = PRODUCT_NICHE_FACT_SCHEMAS;
const encodedSize = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).byteLength;
/** Strict order-only facts. Absent information is omitted, never replaced by current catalog data. */
const SnapshotFactsSchema = z.object({
  toys: factSchemas.toys.optional(), electronics: factSchemas.electronics.optional(),
  food: factSchemas.food.optional(), furniture: factSchemas.furniture.optional(),
  gifts: factSchemas.gifts.optional(), personalization: factSchemas.personalization.optional(),
  beauty: factSchemas.beauty.optional(), sports: factSchemas.sports.optional(), books: factSchemas.books.optional(),
  apparel: ApparelFactsSchema.optional(),
}).strict().superRefine((facts, context) => {
  for (const [key, value] of Object.entries(facts)) if (value !== undefined && encodedSize(value) > 64 * 1024)
    context.addIssue({ code: 'custom', path: [key], message: 'Order item facts exceed the supported namespace size.' });
  if (encodedSize(facts) > 128 * 1024) context.addIssue({ code: 'custom', message: 'Order item facts exceed the supported total size.' });
});

export const ProductFactSnapshotSchema = z.object({
  version: z.literal(1), facts: SnapshotFactsSchema, personalization: AcceptedPersonalizationSchema.optional(),
  selected_options: z.array(z.object({ name: z.string().min(1).max(100), value: z.string().min(1).max(200) }).strict()).max(10).optional(),
}).strict().superRefine((snapshot, context) => {
  const optionNames = snapshot.selected_options?.map(option => option.name) ?? [];
  if (new Set(optionNames).size !== optionNames.length) context.addIssue({ code: 'custom', path: ['selected_options'], message: 'A saved option name must identify exactly one value.' });
  const facts = snapshot.facts.personalization;
  const accepted = snapshot.personalization;
  if (!facts && !accepted) return;
  if (!facts || !accepted || facts.revision !== accepted.facts_revision) {
    context.addIssue({ code: 'custom', path: ['personalization'], message: 'Reviewed personalization must match its frozen facts revision.' });
    return;
  }
  const review = reviewPersonalization(facts, { method_id: accepted.method.id, style_id: accepted.style.id, placement_id: accepted.placement.id, text: accepted.text });
  if (!review.valid || JSON.stringify(review.accepted) !== JSON.stringify(accepted)) context.addIssue({ code: 'custom', path: ['personalization'], message: 'Reviewed personalization must exactly match its frozen method, style and placement.' });
});
export type ProductFactSnapshot = z.infer<typeof ProductFactSnapshotSchema>;

/** Only a buyer's draft and observed capability revision cross the cart boundary. */
export const PersonalizationCartDraftSchema = PersonalizationDraftSchema.extend({
  facts_revision: z.number().int().min(1).max(2147483647),
  review_fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
}).strict();
export type PersonalizationCartDraft = z.infer<typeof PersonalizationCartDraftSchema>;

/** Reference guard for the SAME canonical product writer. SQL must repeat this under its row lock. */
export function validatePersonalizationRevisionTransition(previous: unknown, next: unknown):
  { ok: true; changed: boolean; invalidatesReview: boolean } |
  { ok: false; code: 'INVALID_PERSONALIZATION_FACTS' | 'REVISION_DECREASED' | 'REVISION_NOT_ADVANCED' } {
  const before = factSchemas.personalization.safeParse(previous);
  const after = factSchemas.personalization.safeParse(next);
  if (next !== undefined && !after.success) return { ok: false, code: 'INVALID_PERSONALIZATION_FACTS' };
  // Invalid historical facts could not have produced a valid review; deliberate clear/repair is allowed.
  if (!before.success || !after.success) {
    const changed = previous !== undefined || next !== undefined;
    return { ok: true, changed, invalidatesReview: changed };
  }
  if (after.data.revision < before.data.revision) return { ok: false, code: 'REVISION_DECREASED' };
  const { revision: beforeRevision, ...beforeMeaning } = before.data;
  const { revision: afterRevision, ...afterMeaning } = after.data;
  const meaningChanged = JSON.stringify(beforeMeaning) !== JSON.stringify(afterMeaning);
  if (meaningChanged && afterRevision <= beforeRevision) return { ok: false, code: 'REVISION_NOT_ADVANCED' };
  const changed = meaningChanged || afterRevision !== beforeRevision;
  return { ok: true, changed, invalidatesReview: changed };
}

const uuid = UuidSchema.transform(value => value.toLowerCase());
export const PersonalizationReviewQuerySchema = z.object({ variant_id: uuid.optional() }).strict();
export const PersonalizationReviewContextSchema = z.object({
  product_id: uuid, variant_id: uuid.nullable(), facts: factSchemas.personalization,
  facts_revision: z.number().int().min(1).max(2147483647), review_fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
}).strict().refine(context => context.facts_revision === context.facts.revision, { message: 'The review context must match its supplied facts revision.', path: ['facts_revision'] });
export type PersonalizationReviewContext = z.infer<typeof PersonalizationReviewContextSchema>;
/** SERVER input: fetch/authorize these rows by durable UUID; never bind this object from a client body. */
const CatalogSnapshotSourceSchema = z.object({
  product_id: uuid,
  product_version: z.number().int().min(1).max(2147483647),
  product_metadata: z.unknown().optional(),
  has_variants: z.boolean(),
  selected_variant: z.object({ id: uuid, product_id: uuid, metadata: z.unknown().optional(), options: z.record(z.string().min(1).max(100), z.string().min(1).max(200)).refine(value => Object.keys(value).length <= 10).optional() }).strict().nullable().optional(),
  personalization: z.unknown().optional(),
}).strict();
export type ProductFactSnapshotSource = z.input<typeof CatalogSnapshotSourceSchema>;
type ErrorCode = 'INVALID_CATALOG_CONTEXT' | 'VARIANT_REQUIRED' | 'VARIANT_MISMATCH' | 'INVALID_FACTS' | 'FACTS_CONFLICT' | 'PERSONALIZATION_REQUIRED' | 'PERSONALIZATION_UNAVAILABLE' | 'PERSONALIZATION_STALE' | 'PERSONALIZATION_INVALID';
export type PreparedProductFactSnapshot = {
  ok: true; product_id: string; variant_id: string | null; product_version: number;
  snapshot: ProductFactSnapshot; configuration_fingerprint: string | null; snapshot_fingerprint: string;
} | { ok: false; error: { code: ErrorCode; message: string; issues?: PersonalizationIssue[] } };
const failure = (code: ErrorCode, message: string, issues?: PersonalizationIssue[]): PreparedProductFactSnapshot => ({ ok: false, error: { code, message, ...(issues ? { issues } : {}) } });

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
/** Publicly echoable stale-review guard, not authorization or proof supplied by a client.
 * Only the server producer may supply the observed product version and canonical facts.
 * Including the version also invalidates reviews across removal/re-addition of identical facts.
 */
export async function personalizationReviewFingerprint(input: unknown): Promise<string | null> {
  const parsed = z.object({ product_id: uuid, variant_id: uuid.nullable(), product_version: z.number().int().min(1).max(2147483647), facts: factSchemas.personalization }).strict().safeParse(input);
  if (!parsed.success) return null;
  return sha256(JSON.stringify(['letbuyy-personalization-review-v2', parsed.data.product_id, parsed.data.variant_id, parsed.data.product_version, parsed.data.facts]));
}
function metadataRecord(value: unknown): Record<string, unknown> | null {
  if (value == null) return {};
  return typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
/** Keep private siblings out, but reject malformed declared facts rather than silently lose fulfillment data. */
function catalogFacts(value: unknown): z.infer<typeof SnapshotFactsSchema> | null {
  const metadata = metadataRecord(value);
  if (!metadata) return null;
  const selected: Record<string, unknown> = {};
  for (const name of Object.keys(factSchemas)) {
    const field = Object.getOwnPropertyDescriptor(metadata, name);
    if (!field) continue;
    if (!('value' in field)) return null;
    if (field.value !== undefined) selected[name] = field.value;
  }
  const apparel = Object.getOwnPropertyDescriptor(metadata, 'apparel');
  if (apparel) {
    if (!('value' in apparel)) return null;
    if (apparel.value !== undefined) selected.apparel = apparel.value;
  }
  const parsed = SnapshotFactsSchema.safeParse(selected);
  return parsed.success ? parsed.data : null;
}

/** Private cart/order helper only. This performs no query, cart merge, price calculation, write or logging. */
export async function prepareProductFactSnapshot(input: unknown): Promise<PreparedProductFactSnapshot> {
  const parsed = CatalogSnapshotSourceSchema.safeParse(input);
  if (!parsed.success) return failure('INVALID_CATALOG_CONTEXT', 'Canonical product identity, version and selected variant are required.');
  const source = parsed.data, variant = source.selected_variant;
  if (source.has_variants && !variant) return failure('VARIANT_REQUIRED', 'Select a current variant before continuing.');
  if (variant && (!source.has_variants || variant.product_id !== source.product_id)) return failure('VARIANT_MISMATCH', 'The selected variant does not belong to this product.');
  const facts = catalogFacts(source.product_metadata);
  if (!facts) return failure('INVALID_FACTS', 'The current product facts are invalid. Review the product before continuing.');
  const variantParsed = ProductVariantMetadataSchema.safeParse(variant?.metadata ?? {});
  if (!variantParsed.success) return failure('INVALID_FACTS', 'The selected variant facts are invalid. Review the product before continuing.');
  const selected = variantParsed.data;
  if (facts.food || selected.food) facts.food = FoodFactsSchema.parse({ ...facts.food, netQuantity: source.has_variants ? selected.food?.netQuantity ?? null : facts.food?.netQuantity ?? null });
  if (facts.toys || selected.toys) {
    const resolved = resolveToyFacts(facts.toys, selected.toys);
    if (resolved) facts.toys = resolved; else delete facts.toys;
  }
  if (facts.furniture || selected.furniture) facts.furniture = resolveFurnitureFacts(facts.furniture ?? {}, selected.furniture);
  if (selected.sports && !facts.sports) return failure('FACTS_CONFLICT', 'Selected equipment measurements require supplied common activity and equipment facts.');
  if (facts.sports && selected.sports) facts.sports = { ...facts.sports, ...resolveSportsMeasurements(facts.sports, selected.sports) };
  if (selected.books) {
    const resolved = mergeBooksVariantFacts(facts.books ?? null, selected.books);
    if (!resolved) return failure('FACTS_CONFLICT', 'The selected edition conflicts with the product kind.');
    facts.books = resolved;
  }
  let accepted: z.infer<typeof AcceptedPersonalizationSchema> | undefined;
  if (!facts.personalization && source.personalization !== undefined) return failure('PERSONALIZATION_UNAVAILABLE', 'This product does not currently offer the requested personalization.');
  if (facts.personalization) {
    if (source.personalization === undefined) return failure('PERSONALIZATION_REQUIRED', 'Review the required personalization before continuing.');
    const draft = PersonalizationCartDraftSchema.safeParse(source.personalization);
    if (!draft.success) return failure('PERSONALIZATION_INVALID', 'Supply a reviewed draft and its current personalization revision.');
    if (draft.data.facts_revision !== facts.personalization.revision) return failure('PERSONALIZATION_STALE', 'Personalization choices changed. Reload the product and review your details again.');
    const currentReview = await personalizationReviewFingerprint({ product_id: source.product_id, variant_id: variant?.id ?? null, product_version: source.product_version, facts: facts.personalization });
    if (currentReview !== draft.data.review_fingerprint) return failure('PERSONALIZATION_STALE', 'Product facts changed. Reload the product and review your details again.');
    const { facts_revision: _revision, review_fingerprint: _reviewFingerprint, ...textDraft } = draft.data;
    const review = reviewPersonalization(facts.personalization, textDraft);
    if (!review.valid) return failure('PERSONALIZATION_INVALID', 'Review the personalization details before continuing.', review.issues);
    accepted = review.accepted;
  }
  const selectedOptions = variant?.options ? Object.entries(variant.options).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([name, value]) => ({ name, value })) : [];
  const stored = ProductFactSnapshotSchema.safeParse({ version: 1, facts, ...(selectedOptions.length ? { selected_options: selectedOptions } : {}), ...(accepted ? { personalization: accepted } : {}) });
  if (!stored.success) return failure('FACTS_CONFLICT', 'The selected product facts cannot form a valid fulfillment snapshot.');
  // Zod clones data. JSON removes omitted/undefined measurement keys before hashing and freezing.
  const snapshot = JSON.parse(JSON.stringify(stored.data)) as ProductFactSnapshot;
  const variantId = variant?.id ?? null;
  const configurationFingerprint = accepted ? await sha256(JSON.stringify(['letbuyy-personalization-v1', source.product_id, variantId, personalizationFingerprintInput(accepted)])) : null;
  const snapshotFingerprint = await sha256(JSON.stringify(['letbuyy-product-facts-v1', source.product_id, variantId, source.product_version, snapshot]));
  return { ok: true, product_id: source.product_id, variant_id: variantId, product_version: source.product_version, snapshot: deepFreeze(snapshot), configuration_fingerprint: configurationFingerprint, snapshot_fingerprint: snapshotFingerprint };
}

/** Authorized buyer/merchant order readback only; no fallback to mutable catalog facts. */
export function readProductFactSnapshot(value: unknown): ProductFactSnapshot | null {
  const parsed = ProductFactSnapshotSchema.safeParse(value);
  return parsed.success ? deepFreeze(parsed.data) : null;
}
