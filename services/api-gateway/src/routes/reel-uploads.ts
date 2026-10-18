import { Hono } from 'hono';
import type { Env } from '../index';
import { success } from '../lib/supabase';
import { AppError } from '../lib/errors';
import { ReelUploadAdapter, readReelUploadJson } from '../execution/reel-upload.adapter';

const router = new Hono<{ Bindings: Env }>();
router.use('*', async (c, next) => { c.header('Cache-Control', 'private, no-store'); await next(); });
router.get('/capabilities', async c => c.json(success(await new ReelUploadAdapter(c).capabilities(c.req.query('store_id')))));
router.get('/', async c => c.json(success(await new ReelUploadAdapter(c).list(c.req.query('store_id')))));
router.get('/:id', async c => c.json(success(await new ReelUploadAdapter(c).read(c.req.query('store_id'), c.req.param('id')))));
router.post('/', async c => {
  const command = await readReelUploadJson(c.req.raw);
  const key = c.req.header('X-Idempotency-Key');
  if (key && (!command || typeof command !== 'object' || !('idempotency_key' in command) || command.idempotency_key !== key)) throw new AppError('Request key mismatch.', 409, 'REEL_UPLOAD_IDEMPOTENCY_CONFLICT');
  return c.json(success(await new ReelUploadAdapter(c).begin(c.req.query('store_id'), command)), 201);
});
router.post('/:id', async c => c.json(success(await new ReelUploadAdapter(c).transfer(c.req.query('store_id'), c.req.param('id'), await readReelUploadJson(c.req.raw), null))));
router.put('/:id/content', async c => c.json(success(await new ReelUploadAdapter(c).transfer(c.req.query('store_id'), c.req.param('id'), {
  idempotency_key: c.req.header('X-Idempotency-Key'), expected_version: Number(c.req.header('X-Reel-Upload-Version')),
}, c.req.raw))));
export default router;
