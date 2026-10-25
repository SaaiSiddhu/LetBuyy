import type { ReplaceNavigationInput } from '@letbuyy/cms-core';
import type { Env } from '../index';
import { AppError, ForbiddenError, ValidationError } from '../lib/errors';
import { withTenantTx, TenantTransactionUnavailableError } from '../lib/tenant-transaction';

/** A failed replacement must leave the previous menu intact. */
export async function replaceNavigation(env: Env, actorId: string, requestId: string, input: ReplaceNavigationInput) {
    try {
        return await withTenantTx(env, { siteId: input.store_id, requestId }, async sql => {
            const site = await sql.unsafe('SELECT id FROM sites WHERE id=$1::uuid AND custom_user_id=$2::uuid AND deleted_at IS NULL FOR UPDATE', [input.store_id, actorId]);
            if (!site.length) throw new ForbiddenError('Your access to this store changed.');
            await sql.unsafe('SELECT set_config($1,$2,true)', ['app.actor_id', actorId]);
            let menus = await sql.unsafe('SELECT id FROM navigation_menus WHERE store_id=$1::uuid AND handle=$2 AND deleted_at IS NULL FOR UPDATE', [input.store_id, input.location]);
            if (!menus.length) {
                menus = await sql.unsafe("INSERT INTO navigation_menus(store_id,handle,location,name,status) VALUES($1::uuid,$2,$2,$3,'active') RETURNING id", [input.store_id, input.location, input.name || `${input.location} menu`]);
            }
            const menuId = String(menus[0].id);
            const identifiers = new Map<string, string>();
            const rows = input.items.map(item => ({ item, id: crypto.randomUUID() }));
            for (const { item, id } of rows) {
                if (!item.id) continue;
                if (identifiers.has(item.id)) throw new ValidationError('A navigation item is duplicated.');
                const existing = await sql.unsafe('SELECT id FROM navigation_menu_items WHERE id=$1::uuid AND menu_id=$2::uuid AND store_id=$3::uuid AND deleted_at IS NULL', [item.id, menuId, input.store_id]);
                if (!existing.length) throw new ValidationError('A navigation item is unavailable. Reload the menu.');
                identifiers.set(item.id, id);
            }
            for (const { item } of rows) {
                if (item.parent_item_id && (!identifiers.has(item.parent_item_id) || item.parent_item_id === item.id)) throw new ValidationError('A navigation parent is unavailable. Reload the menu.');
                const visited = new Set<string>();
                let parent = item.parent_item_id;
                while (parent) {
                    if (visited.has(parent)) throw new ValidationError('Navigation cannot contain a parent cycle.');
                    visited.add(parent);
                    parent = input.items.find(candidate => candidate.id === parent)?.parent_item_id;
                }
            }
            await sql.unsafe('UPDATE navigation_menu_items SET deleted_at=now(),is_visible=false WHERE menu_id=$1::uuid AND store_id=$2::uuid AND deleted_at IS NULL', [menuId, input.store_id]);
            // Insert roots first, then connect remapped parents inside the same transaction.
            for (const [index, { item, id }] of rows.entries()) {
                await sql.unsafe(`INSERT INTO navigation_menu_items(id,menu_id,store_id,label,url,target_type,target_resource_id,sort_order,is_visible,open_in_new_tab,metadata)
                  VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,'{}'::jsonb)`,
                [id,menuId,input.store_id,item.label,item.url,item.target_type,item.target_resource_id || null,item.sort_order ?? index,item.is_visible,item.open_in_new_tab]);
            }
            for (const { item, id } of rows) {
                if (item.parent_item_id) await sql.unsafe('UPDATE navigation_menu_items SET parent_item_id=$1::uuid WHERE id=$2::uuid AND store_id=$3::uuid AND menu_id=$4::uuid', [identifiers.get(item.parent_item_id)!,id,input.store_id,menuId]);
            }
            return { replaced: true, menu_id: menuId, count: input.items.length };
        });
    } catch (error) {
        if (error instanceof AppError) throw error;
        if (error instanceof TenantTransactionUnavailableError) throw new AppError('Navigation saving is temporarily unavailable. Keep your changes and retry.', 503, 'NAVIGATION_SAVE_UNAVAILABLE');
        const code = (error as { code?: string })?.code;
        if (code === '23503' || code === '23514' || code?.startsWith('22')) throw new ValidationError('The navigation items are invalid. Your previous menu has been kept.');
        throw new AppError('Navigation could not be saved. Your previous menu has been kept.', 500, 'NAVIGATION_SAVE_FAILED');
    }
}
