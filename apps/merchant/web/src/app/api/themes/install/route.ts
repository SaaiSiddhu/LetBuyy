import { NextRequest, NextResponse } from 'next/server'
import { createMerchantApiClient, merchantApiErrorResponse } from '@/lib/api/client'
import { resolveOwnedStoreId } from '@/lib/stores/resolve-owned-store'
import { confirmMarketplaceInstallReceipt, MarketplaceInstallSchema } from '@/lib/themes/marketplace-contract'

/**
 * POST /api/themes/install
 * 
 * Installs a theme to a store:
 * Creates a private library instance through the canonical installer.
 * The current live theme, products and publication are unchanged.
 * 
 * Body: { storeId: string, themeSlug?: string, bundle?: object }
 */
export async function POST(request: NextRequest) {
    try {
        const parsed = MarketplaceInstallSchema.safeParse(await request.json().catch(() => null))
        if (!parsed.success) return NextResponse.json({ error: { code: 'VALIDATION_ERROR', message: 'Choose a destination store and a valid theme package.' } }, { status: 400 })
        const { themeSlug, bundle, expectedVersion, expectedPackageId, expectedPackageVersionId } = parsed.data
        // Legacy callers may supply a UUID; both paths resolve through the owned-store API.
        const resolved = await resolveOwnedStoreId(parsed.data.store_name || parsed.data.storeId || '')
        if (resolved.error) return resolved.error
        const storeId = resolved.storeId

        // A raw package is copied into this store's private namespace. Importing
        // Core must never grant permission to replace the platform's Core row.
        const packageRecord = bundle?.package && typeof bundle.package === 'object' && !Array.isArray(bundle.package)
            ? bundle.package as Record<string, unknown> : null
        const scopedBundle = bundle && packageRecord && typeof packageRecord.slug === 'string'
            ? { ...bundle, package: { ...packageRecord, slug: `private-${storeId}-${packageRecord.slug}` } }
            : bundle
        const client = createMerchantApiClient()
        const upload = bundle
            ? await client.themes.uploadPackage({
                bundle: scopedBundle as Record<string, unknown>,
                store_id: storeId,
                submission_mode: 'private_install',
            })
            : null
        const installSlug = upload?.theme.slug || themeSlug

        if (upload && (!MarketplaceInstallSchema.shape.expectedVersion.unwrap().safeParse(upload.version?.version).success
            || !MarketplaceInstallSchema.shape.expectedPackageId.unwrap().safeParse(upload.package?.id).success
            || !MarketplaceInstallSchema.shape.expectedPackageVersionId.unwrap().safeParse(upload.version?.id).success)) {
            return NextResponse.json({ error: { code: 'THEME_UPLOAD_UNCONFIRMED', message: 'The private package version was not confirmed. Retry the same upload before adding it.' } }, { status: 503 })
        }

        if (!installSlug) {
            return NextResponse.json(
                { error: 'Theme slug could not be resolved' },
                { status: 400 }
            )
        }

        const version = expectedVersion || upload?.version?.version
        const packageId = expectedPackageId || upload?.package?.id
        const packageVersionId = expectedPackageVersionId || upload?.version?.id
        const payload = await client.themes.install(installSlug, {
            store_id: storeId,
            config_overrides: {},
            ...(version ? { expected_version: version } : {}),
            ...(packageId ? { expected_package_id: packageId } : {}),
            ...(packageVersionId ? { expected_package_version_id: packageVersionId } : {}),
        })
        try { confirmMarketplaceInstallReceipt(payload, { slug: installSlug, version, packageId, packageVersionId }) }
        catch { return NextResponse.json({ error: { code: 'THEME_INSTALL_UNCONFIRMED', message: 'No confirmed installed instance and package version were returned. Check your library and retry the same Add request.' } }, { status: 503 }) }
        return NextResponse.json({ ...payload, success: true, uploaded: upload || undefined })
    } catch (err) {
        return merchantApiErrorResponse(err)
    }
}
