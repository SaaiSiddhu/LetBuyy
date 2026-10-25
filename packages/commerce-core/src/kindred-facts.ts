import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1).max(max);
const key = text(40).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a short lowercase category key.');
const keys = z.array(key).max(12).superRefine((items, ctx) => {
  if (new Set(items).size !== items.length) ctx.addIssue({ code: 'custom', message: 'Category keys must be unique.' });
});
const contents = z.array(z.object({
  label: text(160),
  quantity: z.number().int().min(1).max(100),
  detail: text(1000).optional(),
  care: text(1000).optional(),
}).strict()).min(1).max(30).superRefine((items, ctx) => {
  const seen = new Set<string>();
  for (const [index, item] of items.entries()) {
    const label = item.label.normalize('NFKC').toLocaleLowerCase('en');
    if (seen.has(label)) ctx.addIssue({ code: 'custom', path: [index, 'label'], message: 'Combine repeated contents in one quantity row.' });
    seen.add(label);
  }
});

/** Merchant-authored ready-made set facts. No pricing, inventory, messages or recipient profiling. */
export const GiftFactsSchema = z.object({
  schemaVersion: z.literal(1).default(1),
  occasions: keys.optional(),
  recipients: keys.optional(),
  suitabilityNote: text(500).optional(),
  contents: contents.optional(),
  mediaRoles: z.object({
    openBox: z.number().int().min(0).max(19).optional(),
    closedBox: z.number().int().min(0).max(19).optional(),
  }).strict().refine(value => value.openBox !== undefined || value.closedBox !== undefined, 'Supply an image role or omit mediaRoles.')
    .refine(value => value.openBox === undefined || value.closedBox === undefined || value.openBox !== value.closedBox, 'Open and closed box images must be different.').optional(),
}).strict().superRefine((facts, ctx) => {
  if (!facts.occasions?.length && !facts.recipients?.length && !facts.suitabilityNote && !facts.contents?.length && !facts.mediaRoles) {
    ctx.addIssue({ code: 'custom', message: 'Supply merchant-authored gift facts or omit the gifts namespace.' });
  }
  if (JSON.stringify(facts).length > 16000) ctx.addIssue({ code: 'custom', message: 'Gift facts must fit within 16000 characters.' });
});
export type GiftFacts = z.infer<typeof GiftFactsSchema>;

/** Only the deliberate gifts namespace is public; malformed historical metadata remains unavailable. */
export function readGiftFacts(metadata: unknown): GiftFacts | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
  const field = Object.getOwnPropertyDescriptor(metadata, 'gifts');
  if (!field || !('value' in field)) return null;
  const value: unknown = field.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const prototype: unknown = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return null;
  const result = GiftFactsSchema.safeParse(value);
  return result.success ? result.data : null;
}

const mediaRoleNames = ['openBox', 'closedBox'] as const;
function suppliedImage(images: readonly string[], index: number): string | null {
  if (!Number.isInteger(index) || index < 0 || index > 19 || index >= images.length) return null;
  const image = images[index];
  return typeof image === 'string' && image.trim().length > 0 ? image : null;
}

/** Use after merging a product write with its current images; leaf bounds alone are insufficient. */
export function validateGiftMediaRoles(facts: GiftFacts | null | undefined, images: readonly string[]): boolean {
  if (facts == null) return true;
  const result = GiftFactsSchema.safeParse(facts);
  if (!result.success) return false;
  return mediaRoleNames.every(role => {
    const index = result.data.mediaRoles?.[role];
    return index === undefined || suppliedImage(images, index) !== null;
  });
}

/** An implicit image edit follows exact URL identity; it never guesses a replacement photograph. */
export function rebindGiftMediaRoles(
  existingFacts: GiftFacts | null | undefined,
  oldImages: readonly string[],
  newImages: readonly string[],
): GiftFacts | null {
  if (existingFacts == null) return null;
  const output = structuredClone(existingFacts);
  delete output.mediaRoles;
  const roles: NonNullable<GiftFacts['mediaRoles']> = {};
  for (const role of mediaRoleNames) {
    const sourceIndex = existingFacts.mediaRoles?.[role];
    if (sourceIndex === undefined) continue;
    const source = suppliedImage(oldImages, sourceIndex);
    if (source === null) continue;
    const matches = newImages.flatMap((image, index) => image === source ? [index] : []);
    if (matches.length === 1 && suppliedImage(newImages, matches[0]) !== null) roles[role] = matches[0];
  }
  // Two semantic views converging on one file cannot retain distinct, truthful roles.
  if (roles.openBox !== undefined && roles.openBox === roles.closedBox) {
    delete roles.openBox;
    delete roles.closedBox;
  }
  if (Object.keys(roles).length > 0) output.mediaRoles = roles;
  const result = GiftFactsSchema.safeParse(output);
  return result.success ? result.data : null;
}
