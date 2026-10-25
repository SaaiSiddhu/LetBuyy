import { getCmsString, normalizeStorefrontPageRecord, pageBodyToContent, seoFromPageInput, slugifyCmsTitle,
    type CreatePageInput, type UpdatePageInput, type CmsStorefrontPageRecord } from '@letbuyy/cms-core';
import type { Env } from '../index';
import { AppError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';
import { withTenantTx, TenantTransactionUnavailableError } from '../lib/tenant-transaction';

/** Page, revision, publication pointer and navigation are one committed save. */
export async function saveStorefrontPage(env: Env, actorId: string, storeId: string, requestId: string,
    input: CreatePageInput | UpdatePageInput, pageId?: string) {
    try {
        return await withTenantTx(env, { siteId: storeId, requestId }, async sql => {
            const sites = await sql.unsafe('SELECT id FROM sites WHERE id=$1::uuid AND custom_user_id=$2::uuid AND deleted_at IS NULL FOR UPDATE', [storeId, actorId]);
            if (!sites.length) throw new ForbiddenError('Your access to this store changed.');
            await sql.unsafe('SELECT set_config($1,$2,true)', ['app.actor_id', actorId]);
            const previousRows = pageId ? await sql.unsafe('SELECT * FROM storefront_pages WHERE id=$1::uuid AND store_id=$2::uuid AND deleted_at IS NULL FOR UPDATE', [pageId, storeId]) : [];
            if (pageId && !previousRows.length) throw new NotFoundError('Page not found');
            const previous = previousRows[0] as unknown as CmsStorefrontPageRecord | undefined;
            const content = input.body !== undefined ? pageBodyToContent(input.body) : previous?.content || {};
            const seo = { ...previous?.seo, ...seoFromPageInput({
                seo_title: input.seo_title !== undefined ? input.seo_title : getCmsString(previous?.seo || {}, 'title'),
                seo_description: input.seo_description !== undefined ? input.seo_description : getCmsString(previous?.seo || {}, 'description'),
            }) };
            const title = input.title ?? previous?.title ?? 'Untitled page';
            const slug = input.slug ?? previous?.slug ?? slugifyCmsTitle(title);
            const status = input.status ?? previous?.status ?? 'draft';
            const id = pageId || crypto.randomUUID();
            const pageType = input.page_type ?? previous?.page_type ?? 'custom';
            const publishedAt = input.status === 'published' ? new Date().toISOString() : previous?.published_at || null;
            const rows = previous ? await sql.unsafe(`UPDATE storefront_pages SET title=$3,slug=$4,status=$5,page_type=$6,content=$7::jsonb,seo=$8::jsonb,published_at=$9::timestamptz,updated_by=$10::uuid WHERE id=$1::uuid AND store_id=$2::uuid RETURNING *`,
                [id,storeId,title,slug,status,pageType,JSON.stringify(content),JSON.stringify(seo),publishedAt,actorId])
                : await sql.unsafe(`INSERT INTO storefront_pages(id,store_id,title,slug,status,page_type,content,seo,published_at,created_by,updated_by) VALUES($1::uuid,$2::uuid,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::timestamptz,$10::uuid,$10::uuid) RETURNING *`,
                [id,storeId,title,slug,status,pageType,JSON.stringify(content),JSON.stringify(seo),publishedAt,actorId]);
            const revisions = await sql.unsafe(`INSERT INTO storefront_page_revisions(page_id,store_id,revision_number,title,slug,seo,content,template_key,created_by)
              SELECT $1::uuid,$2::uuid,COALESCE(MAX(revision_number),0)+1,$3,$4,$5::jsonb,$6::jsonb,$7,$8::uuid FROM storefront_page_revisions WHERE page_id=$1::uuid AND store_id=$2::uuid RETURNING id`,
                [id,storeId,title,slug,JSON.stringify(seo),JSON.stringify(content),previous?.assigned_template_key || null,actorId]);
            if (status === 'published') await sql.unsafe('UPDATE storefront_pages SET published_revision_id=$3::uuid WHERE id=$1::uuid AND store_id=$2::uuid', [id,storeId,revisions[0].id]);
            const existing = await sql.unsafe("SELECT id,is_visible FROM navigation_menu_items WHERE store_id=$1::uuid AND target_type='page' AND target_resource_id=$2 AND deleted_at IS NULL", [storeId,id]);
            const showInNav = input.show_in_nav ?? existing.length > 0;
            if (!showInNav || status === 'archived') {
                await sql.unsafe("UPDATE navigation_menu_items SET is_visible=false,deleted_at=now() WHERE store_id=$1::uuid AND target_type='page' AND target_resource_id=$2 AND deleted_at IS NULL", [storeId,id]);
            } else if (existing.length) {
                await sql.unsafe("UPDATE navigation_menu_items SET label=$3,url=$4,is_visible=$5 WHERE store_id=$1::uuid AND target_type='page' AND target_resource_id=$2 AND deleted_at IS NULL", [storeId,id,title,`/${slug}`,status === 'published']);
            } else {
                let menus = await sql.unsafe("SELECT id FROM navigation_menus WHERE store_id=$1::uuid AND handle='main' AND deleted_at IS NULL", [storeId]);
                if (!menus.length) menus = await sql.unsafe("INSERT INTO navigation_menus(store_id,handle,location,name,status) VALUES($1::uuid,'main','main','Main menu','active') RETURNING id", [storeId]);
                await sql.unsafe("INSERT INTO navigation_menu_items(menu_id,store_id,label,url,target_type,target_resource_id,is_visible) VALUES($1::uuid,$2::uuid,$3,$4,'page',$5,$6)", [menus[0].id,storeId,title,`/${slug}`,id,status === 'published']);
            }
            return normalizeStorefrontPageRecord({ ...rows[0], show_in_nav: showInNav } as unknown as CmsStorefrontPageRecord);
        });
    } catch (error) {
        if (error instanceof AppError) throw error;
        if (error instanceof TenantTransactionUnavailableError) throw new AppError('Page saving is temporarily unavailable. Keep your changes and retry.',503,'PAGE_SAVE_UNAVAILABLE');
        if ((error as {code?: string})?.code === '23505') throw new ValidationError('This page URL is already in use.');
        throw new AppError('The page could not be saved. Your previous page has been kept.',500,'PAGE_SAVE_FAILED');
    }
}
