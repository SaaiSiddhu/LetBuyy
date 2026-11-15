import { canonicalizeExecutionPayload, parseDomainEventPayload } from '@letbuyy/event-core';
import type { MediaRegistrationInput, MediaMetadataUpdate } from '@letbuyy/shared-types';
import type { Env } from '../index';
import type { OwnedStoreScope } from '../lib/tenant-context';
import { bindOwnedTenantActor, withTenantTx } from '../lib/tenant-transaction';
import { AppError, ForbiddenError } from '../lib/errors';

type Claim = { id: string; siteId: string; requestHash: string };
type Command = { operation: 'create'; input: MediaRegistrationInput; objectKey: string; mediaType: string }
    | { operation: 'update'; id: string; input: MediaMetadataUpdate }
    | { operation: 'delete'; id: string };
type Reply = { body: Record<string, unknown>; statusCode: 200 | 201 };

/** Complete the existing HTTP receipt and its Media effects in one canonical
 * RLS/GUC transaction. A lost COMMIT acknowledgement is recovered by the same
 * receipt; no URL/filename matching, compensating deletes or second receipt. */
export async function commitMediaCommand(env: Env, scope: OwnedStoreScope, claim: Claim | undefined, command: Command): Promise<Reply> {
    if (!claim || claim.siteId !== scope.siteId) throw new AppError('The original media receipt is unavailable', 503, 'MEDIA_COMMAND_UNCONFIRMED');
    const method = command.operation === 'create' ? 'POST' : command.operation === 'update' ? 'PATCH' : 'DELETE';
    const receiptScope = `http:${method}:/media${command.operation === 'create' ? '' : `/${command.id}`}`;
    let stage = 'tenant-context';
    try {
        return await withTenantTx(env, scope.tenant, async tx => {
            await bindOwnedTenantActor(tx, scope);
            // Serialize ownership changes with every effect, including replay.
            stage = 'owner-lock';
            const owners = await tx.unsafe(`SELECT id FROM public.sites WHERE id=$1::uuid AND deleted_at IS NULL
                AND(custom_user_id=$2::uuid OR user_id=$2::uuid) FOR SHARE`, [scope.siteId, scope.customUser.id]);
            if (owners.length !== 1) throw new ForbiddenError('Your access to this store changed');
            stage = 'receipt-lock';
            const receipts = await tx.unsafe(`SELECT status,response_body,status_code,resource_type,
                locked_until>clock_timestamp() AS lease_active FROM public.idempotency_keys
                WHERE id=$1::uuid AND site_id=$2::uuid AND request_hash=$3 AND scope=$4 AND deleted_at IS NULL FOR UPDATE`,
            [claim.id, scope.siteId, claim.requestHash, receiptScope]);
            const receipt = receipts[0];
            if (receipts.length !== 1) throw new AppError('The original media receipt is unavailable', 503, 'MEDIA_COMMAND_UNCONFIRMED');
            if (receipt.status === 'completed' && receipt.response_body && (receipt.status_code === 200 || receipt.status_code === 201)) {
                return { body: receipt.response_body as Record<string, unknown>, statusCode: receipt.status_code };
            }
            const saved = receipt.response_body as { media_progress?: { version?: unknown; actor_id?: unknown } } | null;
            if (receipt.resource_type !== 'media_command_pending' || saved?.media_progress?.version !== 1
                || saved.media_progress.actor_id !== scope.customUser.id) {
                throw new AppError('The original media outcome needs review. Keep its saved request.', 409, 'MEDIA_COMMAND_NEEDS_REVIEW');
            }
            if (receipt.status !== 'processing' || receipt.lease_active !== true) {
                throw new AppError('The original media receipt changed. Retry the same request.', 409, 'MEDIA_COMMAND_CONFLICT');
            }

            let body: Record<string, unknown>, mediaId: string;
            const statusCode = command.operation === 'create' ? 201 : 200;
            if (command.operation === 'create') {
                const input = command.input;
                if (input.store_id !== scope.siteId) throw new ForbiddenError('The selected store changed');
                stage = 'library-insert';
                const rows = await tx.unsafe(`INSERT INTO public.media(store_id,uploaded_by,filename,original_name,url,
                    thumbnail_url,mime_type,size_bytes,width,height,alt_text,caption,folder,media_type,tags)
                    SELECT $1::uuid,$2::uuid,v->>'filename',coalesce(nullif(v->>'original_name',''),v->>'filename'),v->>'url',
                    nullif(v->>'thumbnail_url',''),v->>'mime_type',coalesce((v->>'size_bytes')::bigint,0),
                    (v->>'width')::integer,(v->>'height')::integer,v->>'alt_text',v->>'caption',coalesce(v->>'folder','/'),$4,
                    ARRAY(SELECT jsonb_array_elements_text(coalesce(v->'tags','[]'::jsonb)))
                    FROM(SELECT $3::text::jsonb AS v)input RETURNING to_jsonb(media) AS row`,
                [scope.siteId, scope.customUser.id, JSON.stringify(input), command.mediaType]);
                const row = rows[0]?.row as Record<string, unknown> | undefined;
                if (rows.length !== 1 || typeof row?.id !== 'string') throw new Error('Media insert was not confirmed');
                mediaId = row.id;
                const assetType = ['image', 'video', 'font', 'icon'].includes(command.mediaType) ? command.mediaType : 'file';
                stage = 'registry-insert';
                const assets = await tx.unsafe(`INSERT INTO public.media_assets(store_id,site_id,asset_type,storage_provider,
                    storage_path,object_key,public_url,filename,content_type,size_bytes,processing_status,processed_at,
                    checksum_sha256,source_channel,metadata)
                    VALUES($1::uuid,$1::uuid,$2,'r2',$3,$3,$4,$5,$6,$7::bigint,'processed',clock_timestamp(),$8,$9,$10::text::jsonb)
                    RETURNING id,object_key,processing_status`,
                [scope.siteId, assetType, command.objectKey, input.url, input.original_name || input.filename,
                    input.mime_type, input.size_bytes ?? 0, input.checksum_sha256 ?? null, input.channel ?? 'web',
                    JSON.stringify({source: 'media-route', filename: input.filename})]);
                if (assets.length !== 1 || typeof assets[0]?.id !== 'string') throw new Error('Media asset was not confirmed');
                const asset = assets[0];
                stage = 'outbox-insert';
                const event = parseDomainEventPayload('media.processed', {site_id: scope.siteId, media_id: mediaId,
                    asset_id: asset.id, object_key: command.objectKey, content_type: input.mime_type, size_bytes: input.size_bytes ?? 0});
                await tx.unsafe(`INSERT INTO public.outbox_events(store_id,site_id,aggregate_type,aggregate_id,event_type,
                    payload,idempotency_key,request_id,actor_id,schema_version)VALUES($1::uuid,$1::uuid,'media',$2,'media.processed',
                    $3::text::jsonb,$4,$5,$6::uuid,1)`, [scope.siteId, mediaId, JSON.stringify(event),
                    `media.processed:${scope.siteId}:${mediaId}`, scope.tenant.requestId, scope.customUser.id]);
                body = {success: true, data: {...row, storage_key: command.objectKey, asset}};
            } else {
                mediaId = command.id;
                const rows = await tx.unsafe(`SELECT id FROM public.media WHERE id=$1::uuid AND store_id=$2::uuid
                    AND deleted_at IS NULL FOR UPDATE`, [mediaId, scope.siteId]);
                if (rows.length !== 1) throw new ForbiddenError('Not authorized');
                if (command.operation === 'delete') {
                    await tx.unsafe('DELETE FROM public.media WHERE id=$1::uuid AND store_id=$2::uuid', [mediaId, scope.siteId]);
                    // Physical objects retain the existing separate cleanup policy.
                    body = {data: {deleted: true}};
                } else {
                    const updated = await tx.unsafe(`UPDATE public.media SET
                        alt_text=CASE WHEN $3::text::jsonb ? 'alt_text' THEN $3::text::jsonb->>'alt_text' ELSE alt_text END,
                        caption=CASE WHEN $3::text::jsonb ? 'caption' THEN $3::text::jsonb->>'caption' ELSE caption END,
                        folder=CASE WHEN $3::text::jsonb ? 'folder' THEN $3::text::jsonb->>'folder' ELSE folder END,
                        filename=CASE WHEN $3::text::jsonb ? 'filename' THEN $3::text::jsonb->>'filename' ELSE filename END,
                        tags=CASE WHEN $3::text::jsonb ? 'tags' THEN ARRAY(SELECT jsonb_array_elements_text($3::text::jsonb->'tags')) ELSE tags END
                        WHERE id=$1::uuid AND store_id=$2::uuid RETURNING to_jsonb(media) AS row`,
                    [mediaId, scope.siteId, JSON.stringify(command.input)]);
                    if (updated.length !== 1 || !updated[0]?.row) throw new Error('Media update was not confirmed');
                    body = {success: true, data: updated[0].row};
                }
            }
            const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalizeExecutionPayload(body)));
            const responseHash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('');
            stage = 'receipt-completion';
            const completed = await tx.unsafe(`UPDATE public.idempotency_keys SET status='completed',resource_type='media',
                response_body=$1::text::jsonb,status_code=$2,response_hash=$3,resource_id=$4::uuid,locked_until=NULL
                WHERE id=$5::uuid AND site_id=$6::uuid AND request_hash=$7 AND status='processing' RETURNING id`,
            [JSON.stringify(body), statusCode, responseHash, mediaId, claim.id, scope.siteId, claim.requestHash]);
            if (completed.length !== 1) throw new Error('Media acknowledgement was not confirmed');
            return {body, statusCode};
        });
    } catch (error) {
        if (error instanceof AppError) throw error;
        if ((error as {code?: string} | null)?.code === '42501') throw new ForbiddenError('Your access to this store changed');
        const code = (error as {code?: unknown} | null)?.code;
        console.error(JSON.stringify({level: 'error', event: 'media_command_unconfirmed', request_id: scope.tenant.requestId,
            stage, sqlstate: typeof code === 'string' && /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'unclassified'}));
        throw new AppError('The media outcome could not be confirmed. Retry its original saved request.', 503, 'MEDIA_COMMAND_UNCONFIRMED');
    }
}
