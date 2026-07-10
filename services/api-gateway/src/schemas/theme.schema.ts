export {
  ThemeBlockSchema as ThemeBlockContractSchema,
  ThemeBundleSchema as ThemeBundleContractSchema,
  ThemeSchema as ThemeContractSchema,
  ThemeSectionSchema as ThemeSectionContractSchema,
  ThemeTemplateSchema as ThemeTemplateContractSchema,
  type Theme,
  type ThemeBlock,
  type ThemeBundle,
  type ThemeSection,
  type ThemeTemplate,
} from '@letbuyy/shared-types';

export {
  ThemeSlugParamSchema,
  ThemeStoreQuerySchema,
  InstallThemeSchema,
  SaveThemeDraftSchema,
  PublishThemeSchema,
  PreviewTokenSchema,
  RollbackThemeReleaseSchema,
  UploadThemePackageSchema,
  ThemePurchaseOrderSchema,
  ThemePurchaseVerifySchema,
  ThemeReviewCreateSchema,
  ThemeReviewReplySchema,
  ThemeReportSchema,
  ThemeRefundRequestSchema,
  ThemeMarketplaceSettingsSchema,
  ThemeSavedSearchSchema,
  ThemeDeveloperListingSchema,
  ValidateThemeDocumentSchema,
  type InstallThemeInput,
  type SaveThemeDraftInput,
  type PublishThemeInput,
  type PreviewTokenInput,
  type RollbackThemeReleaseInput,
  type UploadThemePackageInput,
  type ThemePurchaseOrderInput,
  type ThemePurchaseVerifyInput,
  type ThemeReviewCreateInput,
  type ThemeReviewReplyInput,
  type ThemeReportInput,
  type ThemeRefundRequestInput,
  type ThemeMarketplaceSettingsInput,
  type ThemeSavedSearchInput,
  type ThemeDeveloperListingInput,
  type ValidateThemeDocumentInput,
} from '@letbuyy/theme-engine';

// ─── Phase Q — Theme Library Management Schemas ───────────────────────────────
// These schemas are gateway-layer validations for site-scoped theme library
// operations (create/duplicate/rename/archive/delete). All require store_id as
// UUID so the gateway can verify site ownership before any DB mutation.
import { z } from 'zod';

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
