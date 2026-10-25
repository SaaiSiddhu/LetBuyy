import { z } from 'zod';
import { JsonRecordSchema, ThemeSchema, UuidSchema } from '@letbuyy/shared-types';
import { ThemeBundlePackageMetadataSchema } from './theme-bundle';

const version = ThemeBundlePackageMetadataSchema.shape.version.refine(value => value === value.trim()
    && !/[\u0000-\u001f\u007f]/.test(value), 'Use the exact package version.');

/** Actual install_owned_theme_v1 receipt. Optional metadata is retained; identity is mandatory. */
export const ThemeInstallReceiptSchema = z.object({
    theme_instance_id: UuidSchema,
    theme_package_id: UuidSchema,
    theme_package_version_id: UuidSchema,
    installed_version: version,
    already_installed: z.boolean(),
    theme: ThemeSchema.pick({ id: true, slug: true, name: true }).extend({ version }).passthrough(),
    installation: JsonRecordSchema.nullable().optional(),
    release: JsonRecordSchema.optional(),
}).passthrough().superRefine((receipt, context) => {
    if (receipt.theme.version !== receipt.installed_version) context.addIssue({ code: 'custom', path: ['theme', 'version'], message: 'The receipt versions disagree.' });
});
export type ThemeInstallReceipt = z.infer<typeof ThemeInstallReceiptSchema>;
export type ThemeInstallExpectation = Partial<{
    slug: ThemeInstallReceipt['theme']['slug'];
    version: ThemeInstallReceipt['installed_version'];
    packageId: ThemeInstallReceipt['theme_package_id'];
    packageVersionId: ThemeInstallReceipt['theme_package_version_id'];
}>;
const sameUuid = (left: string, right: string) => left.toLowerCase() === right.toLowerCase();
export function confirmThemeInstallReceipt(input: unknown, expected: ThemeInstallExpectation = {}) {
    const parsed = ThemeInstallReceiptSchema.safeParse(input);
    if (!parsed.success) throw new Error('The install response did not confirm the actual theme instance and package version. Check your library and retry.');
    const receipt = parsed.data;
    if ((expected.slug && receipt.theme.slug !== expected.slug) || (expected.version && receipt.installed_version !== expected.version)
        || (expected.packageId && !sameUuid(receipt.theme_package_id, expected.packageId))
        || (expected.packageVersionId && !sameUuid(receipt.theme_package_version_id, expected.packageVersionId))) {
        throw new Error('The selected package version was not confirmed. Refresh theme details and check your library before retrying.');
    }
    return { receipt, instanceId: receipt.theme_instance_id, slug: receipt.theme.slug,
        packageId: receipt.theme_package_id, packageVersionId: receipt.theme_package_version_id, version: receipt.installed_version };
}

const LibraryIdentitySchema = z.object({ instance_id: UuidSchema, slug: ThemeSchema.shape.slug,
    theme_package_version_id: UuidSchema, instance_status: z.enum(['installed', 'active']) }).passthrough();
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
/** Caller must request this library through the canonical owned-store API before announcing Add. */
export function confirmThemeInstallLibraryReadback(input: unknown, receiptInput: ThemeInstallReceipt) {
    const receipt = ThemeInstallReceiptSchema.parse(receiptInput);
    const envelope = record(input), payload = record(envelope.data);
    const rows = Array.isArray(envelope.themes) ? envelope.themes : Array.isArray(payload.themes) ? payload.themes : Array.isArray(envelope.data) ? envelope.data : [];
    for (const row of rows) {
        const parsed = LibraryIdentitySchema.safeParse(row);
        if (parsed.success && sameUuid(parsed.data.instance_id, receipt.theme_instance_id) && parsed.data.slug === receipt.theme.slug
            && sameUuid(parsed.data.theme_package_version_id, receipt.theme_package_version_id)) return parsed.data;
    }
    throw new Error('The added instance and package version could not be confirmed in this store’s library. Retry to confirm it.');
}
