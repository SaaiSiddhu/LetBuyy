import { ThemeInstallReceiptSchema } from '@letbuyy/theme-engine';
/** A listing-to-install navigation must not silently select a promoted version. */
export function isRequestedInstallVersionCurrent(requested: unknown, current: unknown): boolean {
    const version = ThemeInstallReceiptSchema.shape.installed_version;
    const actual = version.safeParse(current);
    if (!actual.success) return false;
    if (requested === undefined) return true;
    const selected = version.safeParse(requested);
    return selected.success && selected.data === actual.data;
}
