import { assertReadyFirstPartyStorefrontDomain } from '../../lib/first-party-storefront-domain';
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
// TENANCY:
//   1. The mounted auth middleware verifies the merchant session.
//   2. resolveOwnedStoreScope verifies its store binding and current ownership.
//   3. The adapter uses that resolved scope in canonical app_tenant transactions.
//
// READ-ONLY preview. POST writes exclusively via publish_theme_release RPC (via
// ThemeExecutionAdapter — specifically the publishVersionUpdate adapter method). No direct money table writes.
// ──────────────────────────────────────────────────────────────────────────────

import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../../index';
import { resolveOwnedStoreScope } from '../../lib/tenant-context';
import { sha256Hex } from '../../lib/crypto';
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
    /** Opaque confirmation binds the reviewed diff, current release and selected target. */
    confirm_diff_hash: z
        .string()
        .length(64)
        .regex(/^[0-9a-f]{64}$/, 'Must be a 64-character lowercase hex SHA-256'),
    idempotency_key: z.string().min(1).max(255),
    make_store_live: z.boolean().default(false),
    publish_message: z.string().trim().max(500).optional(),
});

export const themeUpdateConfirmationHash = (diff: unknown, currentReleaseId: string, targetPackageVersionId: string) =>
    sha256Hex(JSON.stringify({ diff, current_release_id: currentReleaseId, target_package_version_id: targetPackageVersionId }));

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
        const scope = await resolveOwnedStoreScope(c,storeId);
        const adapter = new ThemeExecutionAdapter(scope.db,scope.authUser.storeId,c.env);

        try {
            // Load current bundle (DB-scoped by storeId + themeSlug)
            const { currentDocument, currentReleaseId } = await adapter.loadCurrentReleaseBundle(scope, slug);
            // Load target through the resolved tenant's actual catalog policies and G4 gate.
            const nextBundle = await adapter.loadTargetPackageVersionBundle(targetPkgVersionId,scope,slug);
            // Compute diff — pure, no I/O, G4 + direction checks inside
            const diff = computeThemeUpdateDiff(currentDocument, nextBundle);
            // CAS token: the POST route verifies this hash against the applied diff
            const diffHash = await themeUpdateConfirmationHash(diff, currentReleaseId, targetPkgVersionId);

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
    //   1. Canonical resolveOwnedStoreScope — BEFORE any DB write.
    //   2. Load current release bundle → ThemeDocument.
    //   3. Load target package version bundle (G4 gate).
    //   4. planThemeSafeUpdate — pure merge (G4 + direction + downgrade inside).
    //   5. CAS guard — confirmation binds this diff, current release and selected target.
    //   6. fromThemeDocumentV2 — convert merged ThemeDocument back to LiquidThemePackageBundle.
    //   7. Publish — adapter repeats guards/receipt under the site lock and calls the existing publisher atomically.
    //
    // The adapter rechecks ownership, target availability, current release and retry
    // receipt under the site lock, then calls the existing publisher in that transaction.
    router.post('/:slug/update', async (c) => {
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

        const scope = await resolveOwnedStoreScope(c,storeId);
        const adapter = new ThemeExecutionAdapter(scope.db,scope.authUser.storeId,c.env);

        try {
            const nextBundle = await adapter.loadTargetPackageVersionBundle(targetPkgVersionId,scope,slug);
            const requestHash = await sha256Hex(JSON.stringify({storeId:scope.siteId,slug,targetPkgVersionId,confirmDiffHash,makeStoreLive,publishMessage:publishMessage||null}));
            // Exact response-loss retry survives its own committed baseline change.
            // Changed intent/key pairs conflict; current auth and availability were checked first.
            const replay = await adapter.findVersionUpdateReplay(scope,slug,idempotencyKey,requestHash);
            if (replay) return c.json({slug,target_package_version_id:targetPkgVersionId,release_id:replay.release_id,
                release_version:replay.release_version,published_at:replay.published_at,idempotent:true,
                diff:replay.diff,requires_confirmation:replay.requiresConfirmation});
            const { currentDocument, currentReleaseConfig, currentReleaseId } = await adapter.loadCurrentReleaseBundle(scope, slug);

            // Step 3: Pure merge — G4 + direction + downgrade guards fire here
            const result = planThemeSafeUpdate({ currentDocument, nextBundle });

            // Step 4: CAS guard — the caller's hash must match this diff exactly.
            const computedHash = await themeUpdateConfirmationHash(result.diff, currentReleaseId, targetPkgVersionId);
            if (computedHash !== confirmDiffHash) {
                // A same-key publication may commit after the first receipt read,
                // before this baseline read. Return that exact intent's receipt.
                const concurrentReplay = await adapter.findVersionUpdateReplay(scope,slug,idempotencyKey,requestHash);
                if (concurrentReplay) return c.json({slug,target_package_version_id:targetPkgVersionId,release_id:concurrentReplay.release_id,
                    release_version:concurrentReplay.release_version,published_at:concurrentReplay.published_at,idempotent:true,
                    diff:concurrentReplay.diff,requires_confirmation:concurrentReplay.requiresConfirmation});
                throw new ConflictError(
                    'confirm_diff_hash does not match the current diff — ' +
                        're-fetch /update-preview and confirm the latest diff',
                );
            }

            // Step 5: Convert merged ThemeDocument → LiquidThemePackageBundle for publishing
            const mergedBundle = fromThemeDocumentV2(result.updatedDoc);

            if (makeStoreLive) {
                const store = await adapter.verifyThemeEditorStore(scope.siteId, scope.customUser.id);
                await assertReadyFirstPartyStorefrontDomain(c.env, {
                    subdomain: store.subdomain || store.store_name || '', store_name: store.store_name,
                    published: store.published === true, status: store.status as 'draft' | 'published' | undefined,
                });
            }

            // Step 6: Commit the selected version, existing publisher and exact receipt together.
            const release = await adapter.publishVersionUpdateRelease({
                scope,
                themeSlug: slug,
                targetPackageVersionId:targetPkgVersionId,
                currentReleaseId,
                requestHash,
                confirmedDiffHash:confirmDiffHash,
                diff:result.diff,
                requiresConfirmation:result.requiresConfirmation,
                mergedBundle,
                currentReleaseConfig,
                idempotencyKey,
                publishMessage: publishMessage || null,
                makeStoreLive,
            });

            return c.json({
                slug,
                target_package_version_id: targetPkgVersionId,
                release_id: release.release_id,
                release_version: release.release_version,
                published_at: release.published_at,
                idempotent: release.idempotent,
                diff: release.diff,
                requires_confirmation: release.requiresConfirmation,
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
