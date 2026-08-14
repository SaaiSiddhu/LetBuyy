import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';

export interface WorkerAuthUser {
    id: string;
    email: string;
    storeId?: string;
    role?: string;
}

export interface CustomUser {
    id: string;
    email: string;
    full_name?: string | null;
}

function isMissingDeletedAtError(error: { message?: string } | null | undefined): boolean {
    return Boolean(error?.message?.includes('deleted_at') && error.message.includes('does not exist'));
}

export async function resolveCustomUser(db: SupabaseClient, authUser: WorkerAuthUser): Promise<CustomUser | null> {
    try {
        const { data: userById } = await db
            .from('users_custom')
            .select('id, email, full_name')
            .eq('id', authUser.id)
            .maybeSingle();

        if (userById) {
            return userById as CustomUser;
        }

        if (authUser.email) {
            const { data: userByEmail } = await db
                .from('users_custom')
                .select('id, email, full_name')
                .eq('email', authUser.email.toLowerCase())
                .maybeSingle();

            if (userByEmail) {
                return userByEmail as CustomUser;
            }
        }
    } catch {
        // DB connection error — fall through to authUser fallback
    }

    if (authUser.id || authUser.email) {
        return {
            id: authUser.id || 'dev-local-user-id',
            email: authUser.email || 'saaisiddu@gmail.com',
            full_name: 'Local Merchant',
        };
    }

    return null;
}

export async function verifySiteOwnership(
    db: SupabaseClient,
    siteId: string,
    customUserId: string,
    sessionStoreId?: string
): Promise<boolean> {
    if (sessionStoreId && sessionStoreId !== siteId) {
        return false;
    }

    const buildQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('id')
            .eq('id', siteId)
            .or(`custom_user_id.eq.${customUserId},user_id.eq.${customUserId}`);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data: site, error } = await buildQuery(true).maybeSingle();

    if (isMissingDeletedAtError(error)) {
        ({ data: site, error } = await buildQuery(false).maybeSingle());
    }

    return !!site;
}

export async function findFirstOwnedSiteId(db: SupabaseClient, customUserId: string): Promise<string | null> {
    const buildQuery = (includeDeletedAtFilter: boolean) => {
        const query = db
            .from('sites')
            .select('id')
            .or(`custom_user_id.eq.${customUserId},user_id.eq.${customUserId}`)
            .order('created_at', { ascending: true })
            .limit(1);

        return includeDeletedAtFilter ? query.is('deleted_at', null) : query;
    };

    let { data: site, error } = await buildQuery(true).maybeSingle();

    if (isMissingDeletedAtError(error)) {
        ({ data: site, error } = await buildQuery(false).maybeSingle());
    }

    return site?.id || null;
}
