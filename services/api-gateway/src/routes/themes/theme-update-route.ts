// ──────────────────────────────────────────────────────────────────────────────
// Phase AB — Tenant-safe theme VERSION UPDATE routes.
//
// Mounted via mountThemeUpdateRoutes(router) in themes.ts.
// Full paths (prefixed with /v1/themes):
//   GET  /:slug/update-preview?store_id=<uuid>&target_package_version_id=<uuid>
//   POST /:slug/update  body: { store_id, target_package_version_id,
//                               confirm_diff_hash, idempotency_key,
//                               make_store_live?, publish_message? }
//
// NO-DATA-LOSS LAW (paramount):
//   planThemeSafeUpdate (packages/theme-engine) preserves all merchant-authored
//   content across version updates. Sections removed from the new bundle that held
//   merchant content appear in diff.conflicts and set requiresDuplicateBeforeApply.
//   The POST route requires the caller to supply confirm_diff_hash (CAS guard)
//   so no update is applied without explicit merchant acknowledgement of the diff.
//
// G4 GATE:
//   computeThemeUpdateDiff / planThemeSafeUpdate both call
//   isThemeBundleSchemaCompatible internally. Unknown/future schema versions are
//   REJECTED with UpdateVersionRejectedError → 422 UNPROCESSABLE_ENTITY.
//   Downgrades are REJECTED with UpdateDowngradeError → 422.
//
// TENANCY (identical to media-library.ts):
//   1. resolveCustomUser — rejects customer HS256 tokens (no users_custom row → 403)
//   2. verifySiteOwnership — rejects cross-tenant access (403)
//   3. All DB reads are scoped by the verified storeId, never a caller-supplied value.
//
// READ-ONLY preview. POST writes exclusively via publish_theme_release RPC (via
// ThemeExecutionAdapter — specifically the publishVersionUpdate adapter method). No direct money table writes.
// ──────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../index';
import { resolveCustomUser, verifySiteOwnership } from '../../lib/auth-user';
import { sha256Hex } from '../../lib/crypto';
import { getSupabaseAdmin } from '../../lib/supabase';
import { ThemeExecutionAdapter } from '../../execution/theme-execution.adapter';
import { ConflictError, NotFoundError, ValidationError } from '../../lib/errors';
import {
    computeThemeUpdateDiff,
    fromThemeDocumentV2,
    planThemeSafeUpdate,
    UpdateDowngradeError,
    UpdateVersionRejectedError,
} from '@letbuyy/theme-engine';

// ── Validation schemas ─────────────────────────────────────────────────────────

const UpdatePreviewQuerySchema = z.object({
    store_id: z.string().uuid(),
    target_package_version_id: z.string().uuid(),
});

const UpdatePostBodySchema = z.object({
    store_id: z.string().uuid(),
    target_package_version_id: z.string().uuid(),
    /** SHA-256 hex digest of JSON.stringify(diff) returned by GET /update-preview. */
    confirm_diff_hash: z
        .string()
        .length(64)
        .regex(/^[0-9a-f]{64}$/, 'Must be a 64-character lowercase hex SHA-256'),
    idempotency_key: z.string().min(1).max(255),
    make_store_live: z.boolean().default(false),
    publish_message: z.string().trim().max(500).optional(),
});

// ── Error response helpers ─────────────────────────────────────────────────────

function updateVersionRejectedResponse(err: UpdateVersionRejectedError) {
    return {
        error: {
            code: 'UPDATE_VERSION_REJECTED',
            message: err.message,
            target_version: err.targetVersion,
            reason: err.reason,
        },
    } as const;
}

function updateDowngradeResponse(err: UpdateDowngradeError) {
    return {
        error: {
            code: 'UPDATE_DOWNGRADE',
            message: err.message,
            from_version: err.fromVersion,
            to_version: err.toVersion,
        },
    } as const;
}

// ── Route factory ──────────────────────────────────────────────────────────────

export function mountThemeUpdateRoutes(router: Hono<{ Bindings: Env }>): void {
    // ── GET /:slug/update-preview ────────────────────────────────────────────────
    // Compute and return the update diff WITHOUT applying it.
    // Returns diff + diff_hash so the merchant can review the change before committing.
    // The caller must pass this exact diff_hash back to POST /update as confirm_diff_hash.
    router.get('/:slug/update-preview', async (c) => {
        const auth = c.get('auth');
        const slug = c.req.param('slug');

        const parsed = UpdatePreviewQuerySchema.safeParse({
            store_id: c.req.query('store_id'),
            target_package_version_id: c.req.query('target_package_version_id'),
        });

        if (!parsed.success) {
            return c.json(
                {
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid query parameters',
                        details: parsed.error.issues.map((i) => ({
                            field: i.path.join('.'),
                            message: i.message,
                        })),
                    },
                },
                400,
            );
        }

        const { store_id: storeId, target_package_version_id: targetPkgVersionId } = parsed.data;
        const db = getSupabaseAdmin(c);

        // TENANCY CHECK 1: Merchant gate.
        // resolveCustomUser queries users_custom (merchant table).
        // Customer HS256 tokens have no row → null → 403.
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) {
            return c.json(
                { error: { code: 'FORBIDDEN', message: 'User profile not found' } },
                403,
            );
        }

        // TENANCY CHECK 2: Site ownership — cross-tenant access rejected.
        const ownsStore = await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json(
                { error: { code: 'FORBIDDEN', message: 'Not authorized' } },
                403,
            );
        }

        const adapter = new ThemeExecutionAdapter(db);

        try {
            // Load current bundle (DB-scoped by storeId + themeSlug)
            const { currentDocument } = await adapter.loadCurrentReleaseBundle(storeId, slug);
            // Load target bundle (global catalog row; G4 gate inside parseLiquidThemePackageBundle)
            const nextBundle = await adapter.loadTargetPackageVersionBundle(targetPkgVersionId);
            // Compute diff — pure, no I/O, G4 + direction checks inside
            const diff = computeThemeUpdateDiff(currentDocument, nextBundle);
            // CAS token: the POST route verifies this hash against the applied diff
            const diffHash = await sha256Hex(JSON.stringify(diff));

            return c.json({
                slug,
                target_package_version_id: targetPkgVersionId,
                diff,
                diff_hash: diffHash,
            });
        } catch (err) {
            if (err instanceof UpdateVersionRejectedError) {
                return c.json(updateVersionRejectedResponse(err), 422);
            }
            if (err instanceof UpdateDowngradeError) {
                return c.json(updateDowngradeResponse(err), 422);
            }
            if (err instanceof NotFoundError) {
                return c.json(
                    { error: { code: 'NOT_FOUND', message: (err as Error).message } },
                    404,
                );
            }
            if (err instanceof ValidationError) {
                return c.json(
                    { error: { code: 'VALIDATION_ERROR', message: (err as Error).message } },
                    422,
                );
            }
            throw err;
        }
    });

    // ── POST /:slug/update ───────────────────────────────────────────────────────
    // Apply the safe update and publish a new release.
    //
    // Flow:
    //   1. Auth guards (resolveCustomUser + verifySiteOwnership) — BEFORE any DB write.
    //   2. Load current release bundle → ThemeDocument.
    //   3. Load target package version bundle (G4 gate).
    //   4. planThemeSafeUpdate — pure merge (G4 + direction + downgrade inside).
    //   5. CAS guard — confirm_diff_hash must match sha256(JSON.stringify(result.diff)).
    //   6. fromThemeDocumentV2 — convert merged ThemeDocument back to LiquidThemePackageBundle.
    //   7. Publish — adapter handles idempotency pre-check → publishReleaseSnapshot → post-enrich.
    //
    // TOCTOU RESIDUAL: the CAS guard is TS-level only. Two concurrent POSTs with the
    // same hash both pass step 5. Full closure requires a DB-level lock inside the
    // publish_theme_release RPC (ARB-gated follow-up). This is a known accepted limitation.
    router.post('/:slug/update', async (c) => {
        const auth = c.get('auth');
        const slug = c.req.param('slug');

        let body: unknown;
        try {
            body = await c.req.json();
        } catch {
            return c.json(
                { error: { code: 'VALIDATION_ERROR', message: 'Request body must be valid JSON' } },
                400,
            );
        }

        const parsed = UpdatePostBodySchema.safeParse(body);
        if (!parsed.success) {
            return c.json(
                {
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Invalid request body',
                        details: parsed.error.issues.map((i) => ({
                            field: i.path.join('.'),
                            message: i.message,
                        })),
                    },
                },
                400,
            );
        }

        const {
            store_id: storeId,
            target_package_version_id: targetPkgVersionId,
            confirm_diff_hash: confirmDiffHash,
            idempotency_key: idempotencyKey,
            make_store_live: makeStoreLive,
            publish_message: publishMessage,
        } = parsed.data;

        const requestId =
            c.res.headers.get('X-Request-ID') ||
            c.req.header('X-Request-ID') ||
            crypto.randomUUID();
        const db = getSupabaseAdmin(c);

        // TENANCY CHECK 1: Merchant gate — BEFORE any write.
        const customUser = await resolveCustomUser(db, auth.user);
        if (!customUser) {
            return c.json(
                { error: { code: 'FORBIDDEN', message: 'User profile not found' } },
                403,
            );
        }

        // TENANCY CHECK 2: Site ownership — cross-tenant access rejected BEFORE any DB write.
        const ownsStore = await verifySiteOwnership(db, storeId, customUser.id, auth.user.storeId);
        if (!ownsStore) {
            return c.json(
                { error: { code: 'FORBIDDEN', message: 'Not authorized' } },
                403,
            );
        }

        const adapter = new ThemeExecutionAdapter(db);

        try {
            // Step 1: Load current bundle (DB-scoped by storeId + themeSlug)
            const { currentDocument, currentReleaseConfig } =
                await adapter.loadCurrentReleaseBundle(storeId, slug);

            // Step 2: Load target bundle (G4 gate inside)
            const nextBundle = await adapter.loadTargetPackageVersionBundle(targetPkgVersionId);

            // Step 3: Pure merge — G4 + direction + downgrade guards fire here
            const result = planThemeSafeUpdate({ currentDocument, nextBundle });

            // Step 4: CAS guard — the caller's hash must match this diff exactly.
            // (TOCTOU residual: TS-level only; concurrent POSTs both pass — accepted limitation.)
            const computedHash = await sha256Hex(JSON.stringify(result.diff));
            if (computedHash !== confirmDiffHash) {
                throw new ConflictError(
                    'confirm_diff_hash does not match the current diff — ' +
                        're-fetch /update-preview and confirm the latest diff',
                );
            }

            // Step 5: Convert merged ThemeDocument → LiquidThemePackageBundle for publishing
            const mergedBundle = fromThemeDocumentV2(result.updatedDoc);

            // Step 6: Publish (idempotency pre-check → publishReleaseSnapshot → post-enrich)
            const release = await adapter.publishVersionUpdateRelease({
                storeId,
                themeSlug: slug,
                mergedBundle,
                currentReleaseConfig,
                userId: customUser.id,
                idempotencyKey,
                publishMessage: publishMessage || null,
                makeStoreLive,
                requestId,
            });

            return c.json({
                slug,
                target_package_version_id: targetPkgVersionId,
                release_id: release.release_id,
                release_version: release.release_version,
                published_at: release.published_at,
                idempotent: release.idempotent,
                diff: result.diff,
                requires_confirmation: result.requiresConfirmation,
            });
        } catch (err) {
            if (err instanceof UpdateVersionRejectedError) {
                return c.json(updateVersionRejectedResponse(err), 422);
            }
            if (err instanceof UpdateDowngradeError) {
                return c.json(updateDowngradeResponse(err), 422);
            }
            if (err instanceof ConflictError) {
                return c.json(
                    {
                        error: {
                            code: 'DIFF_HASH_MISMATCH',
                            message: (err as Error).message,
                        },
                    },
                    409,
                );
            }
            if (err instanceof NotFoundError) {
                return c.json(
                    { error: { code: 'NOT_FOUND', message: (err as Error).message } },
                    404,
                );
            }
            if (err instanceof ValidationError) {
                return c.json(
                    { error: { code: 'VALIDATION_ERROR', message: (err as Error).message } },
                    422,
                );
            }
            throw err;
        }
    });
}
