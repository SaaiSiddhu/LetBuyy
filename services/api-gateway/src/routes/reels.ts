import { Hono } from 'hono';
import type { Env } from '../index';
import { success } from '../lib/supabase';
import { AppError } from '../lib/errors';
import { ReelMerchantCommandSchema } from '../schemas/reel.schema';
import { readReelRequest, ReelReviewAdapter } from '../execution/reel-review.adapter';

const router = new Hono<{ Bindings: Env }>();
router.use('*', async (c, next) => { c.header('Cache-Control', 'private, no-store'); await next(); });
for (const path of ['/', '/:id']) router.get(path, async c => c.json(success(await new ReelReviewAdapter(c).run({
  siteId: c.req.query('store_id'), reelId: c.req.param('id'), page: Number(c.req.query('page') ?? 1),
}))));
router.post('/:id', async c => {
  const parsed = ReelMerchantCommandSchema.safeParse(await readReelRequest(c));
  if (!parsed.success) throw new AppError('Invalid reel selection, version or request key.', 400, 'REEL_REQUEST_INVALID');
  return c.json(success(await new ReelReviewAdapter(c).run({ siteId: c.req.query('store_id'), reelId: c.req.param('id'), command: parsed.data })));
});
export default router;
