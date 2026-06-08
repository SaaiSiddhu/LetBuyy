import { getSupabaseAdmin } from './supabase';

export async function listOwnedStoreIds(
    db: ReturnType<typeof getSupabaseAdmin>,
    userId: string,
    sessionStoreId?: string,
) {
    let query = db
        .from('sites')
        .select('id')
        .or(`custom_user_id.eq.${userId},user_id.eq.${userId}`)
        .is('deleted_at', null);

    if (sessionStoreId) query = query.eq('id', sessionStoreId);

    const { data, error } = await query;
    if (error) throw new Error(`Store ownership lookup failed: ${error.message}`);

    return (data || []).map((store) => store.id as string);
}
