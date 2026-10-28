// Phase Q — Theme Library Management Schemas
//
// Request contracts for the site-scoped theme library operations
// (list/create/duplicate/rename/archive/delete-unpublished). They live here, not in the
// gateway, because `theme-engine` is the single contract source for the theme domain
// (THEME-R3, THEME-R5) and `services/api-gateway/src/schemas/theme.schema.ts` is an
// extracted facade that may only re-export — `domain-boundary-validator` fails the build
// if that facade declares a contract of its own.
//
// Every operation carries `store_id` as a UUID so the gateway can resolve and verify site
// ownership before any DB mutation; validation here is shape-only and never a substitute
// for that ownership check.

import { z } from 'zod';
import { ThemeSchema } from '@letbuyy/shared-types';

const UuidField = z.string().uuid('Must be a valid UUID');
const ThemeNameField = z.string().min(1, 'Name is required').max(120, 'Name must be 120 characters or fewer').trim();

/** GET /themes/library?store_id= */
export const ListSiteThemesQuerySchema = z.object({
  store_id: UuidField,
});
export type ListSiteThemesQueryInput = z.infer<typeof ListSiteThemesQuerySchema>;

/** POST /themes/library/create */
export const CreateSiteThemeSchema = z.object({
  store_id: UuidField,
  name: ThemeNameField,
  template_slug: z.string().trim().min(1).max(120).optional(),
});
export type CreateSiteThemeInput = z.infer<typeof CreateSiteThemeSchema>;

/** POST /themes/:slug/duplicate */
export const DuplicateSiteThemeSchema = z.object({
  store_id: UuidField,
  name: ThemeNameField.optional(),
});
export type DuplicateSiteThemeInput = z.infer<typeof DuplicateSiteThemeSchema>;

/** PATCH /themes/:slug/rename */
export const RenameSiteThemeSchema = z.object({
  store_id: UuidField,
  name: ThemeNameField,
});
export type RenameSiteThemeInput = z.infer<typeof RenameSiteThemeSchema>;

/** POST /themes/:slug/archive */
export const ArchiveSiteThemeSchema = z.object({
  store_id: UuidField,
});
export type ArchiveSiteThemeInput = z.infer<typeof ArchiveSiteThemeSchema>;

/** DELETE /themes/:slug/unpublished?store_id= */
export const DeleteUnpublishedThemeQuerySchema = z.object({
  store_id: UuidField,
});
export type DeleteUnpublishedThemeQueryInput = z.infer<typeof DeleteUnpublishedThemeQuerySchema>;


/** Owned library presentation; version is the captured package, not catalog latest. */
export const SiteThemeLibraryItemSchema = z.object({
  slug: z.string(), name: z.string(), thumbnail_url: z.string().nullable().optional(),
  version: ThemeSchema.shape.version.nullable().optional(),
  instance_status: z.enum(['active', 'installed', 'inactive', 'archived', 'deleted']),
  installed_at: z.string().nullable(), last_published_at: z.string().nullable(), last_modified_at: z.string().nullable(),
  hasDraft: z.boolean(), isCurrentlyPublished: z.boolean(), updateAvailable: z.boolean(),
  theme_package_version_id: z.string().nullable(),
});
export type SiteThemeLibraryItem = z.infer<typeof SiteThemeLibraryItemSchema>;

/** Database-proven first-party inclusion and canonical custom-design allowance. */
export const ThemeLibraryAllowanceSchema = z.object({
  included_themes: z.array(z.string().min(1)).max(10),
  custom_used: z.number().int().nonnegative(),
  custom_limit: z.number().int().nonnegative().nullable(),
  plan_name: z.string().min(1),
});
export type ThemeLibraryAllowance = z.infer<typeof ThemeLibraryAllowanceSchema>;
