// Marketplace home-banner contracts (phase CAP-FB-BANNERS; schema: migration 228).
//
// Every vocabulary and pattern below repeats 228's CHECK constraints verbatim, so a bad value is
// rejected at the edge with a typed error instead of surfacing as a Postgres CHECK failure. The
// bodies are `.strict()`: a client cannot smuggle `id`, `created_at` or an unknown column past the
// operator API.

import { z } from 'zod';

// 228: image_url ~ '^https://'. Rejecting http here is not belt-and-braces — the URL is rendered by
// the mobile client, and a plain-http image is a mixed-content failure or a downgrade.
const httpsUrl = z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .regex(/^https:\/\/\S+$/, 'must be an https URL');

// 228: target_route ~ '^(/[^/]|https://)'. A single leading slash is an in-app route; '//host' is a
// protocol-relative external link and 'javascript:' a launcher hazard, so both are refused.
const targetRoute = z
    .string()
    .trim()
    .min(1)
    .max(2048)
    .regex(/^(\/[^/]|https:\/\/)/, 'must be an in-app route (/path) or an https URL');

const colorHex = z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, 'must be a #RRGGBB colour');
const aspectRatioType = z.enum(['wide', 'square', 'tall']);
const pixels = z.coerce.number().int().positive().max(20000);

export const CreateMarketplaceBannerSchema = z
    .object({
        title: z.string().trim().min(1).max(200),
        subtitle: z.string().trim().max(500).default(''),
        image_url: httpsUrl,
        icon_name: z.string().trim().min(1).max(100).nullable().optional(),
        target_route: targetRoute.nullable().optional(),
        color_hex: colorHex.nullable().optional(),
        image_width: pixels.nullable().optional(),
        image_height: pixels.nullable().optional(),
        aspect_ratio_type: aspectRatioType.nullable().optional(),
        position: z.coerce.number().int().min(0).default(0),
        is_active: z.boolean().default(true),
    })
    .strict();

export const UpdateMarketplaceBannerSchema = z
    .object({
        title: z.string().trim().min(1).max(200).optional(),
        subtitle: z.string().trim().max(500).optional(),
        image_url: httpsUrl.optional(),
        icon_name: z.string().trim().min(1).max(100).nullable().optional(),
        target_route: targetRoute.nullable().optional(),
        color_hex: colorHex.nullable().optional(),
        image_width: pixels.nullable().optional(),
        image_height: pixels.nullable().optional(),
        aspect_ratio_type: aspectRatioType.nullable().optional(),
        position: z.coerce.number().int().min(0).optional(),
        is_active: z.boolean().optional(),
    })
    .strict()
    // An empty PATCH would round-trip the row and report success while changing nothing; that reads
    // to an operator as "my edit was saved".
    .refine((body) => Object.keys(body).length > 0, { message: 'at least one field is required' });

export const ListMarketplaceBannersOperatorQuery = z.object({
    // z.coerce.boolean() treats the literal string "false" as truthy (Boolean("false") === true), so
    // a query-string flag is parsed from its two literal values rather than coerced (217/ADM-3).
    is_active: z
        .enum(['true', 'false'])
        .optional()
        .transform((v) => (v === undefined ? undefined : v === 'true')),
});

export type CreateMarketplaceBannerInput = z.infer<typeof CreateMarketplaceBannerSchema>;
export type UpdateMarketplaceBannerInput = z.infer<typeof UpdateMarketplaceBannerSchema>;
export type ListMarketplaceBannersOperatorInput = z.infer<typeof ListMarketplaceBannersOperatorQuery>;
