import type { Context } from 'hono';
import { UuidSchema } from '@letbuyy/shared-types';
import type { Env } from '../index';
import { AppError, ForbiddenError, ValidationError } from './errors';
import { resolveCustomUser } from './auth-user';
import { getSupabaseAdmin } from './supabase';
import { getRequestId, resolveTenantAccessProfile, type OwnedStoreScope } from './tenant-context';
import { evaluateStaffRequest } from '../middleware/staff-permission';

/** Collection metadata uses the existing product grant authority. Do not relax
 * the general owner scope, or the separately guarded manual-membership writer.
 * SQL repeats current authorization under locks before any read/effect/replay. */
export async function resolveCollectionStoreScope(c: Context<{ Bindings: Env }>, siteId: string,
    permission: 'products:read' | 'products:write'): Promise<OwnedStoreScope> {
    if (!UuidSchema.safeParse(siteId).success) throw new ValidationError('Select a valid collection store.');
    const authUser = c.get('auth').user, selected = c.req.header('X-Store-ID');
    if (selected && selected !== siteId || authUser.storeId && authUser.storeId !== siteId) throw new ForbiddenError('The selected store changed.');
    const db = getSupabaseAdmin(c), customUser = await resolveCustomUser(db, authUser);
    if (!customUser) throw new ForbiddenError('User profile not found');
    const decision = await evaluateStaffRequest(c, siteId, customUser.id, permission, 'enforce');
    if (decision.block) {
        if (decision.status === 503) throw new AppError('Your permissions could not be checked. Try again shortly.', 503, 'STAFF_PERMISSION_UNAVAILABLE');
        throw new ForbiddenError('Your current role does not permit this collection action.');
    }
    const access = await resolveTenantAccessProfile(db, siteId, customUser.id, [], []);
    const tenant = { ...access, siteId, userId: customUser.id, roles: [], permissions: [permission], requestId: getRequestId(c) };
    c.set('tenant', tenant);
    return { siteId, storeId: siteId, db, authUser, customUser, tenant };
}
