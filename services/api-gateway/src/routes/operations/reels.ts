import { Hono } from 'hono';
import type { Env } from '../../index';
import { success } from '../../lib/supabase';
import { AppError } from '../../lib/errors';
import { ReelReviewerCommandSchema } from '../../schemas/reel.schema';
import { readReelRequest, ReelReviewAdapter } from '../../execution/reel-review.adapter';

// Protected Gateway transport plus canonical bound Console human session, live
// review scope, MFA and permission snapshot; shared service bearer grants no review.
const router = new Hono<{ Bindings: Env }>();
router.use('*', async (c, next) => { c.header('Cache-Control', 'private, no-store'); await next(); });
for (const path of ['/', '/:id']) router.get(path, async c => c.json(success(await new ReelReviewAdapter(c).run({
  operator: true, reelId: c.req.param('id'), page: Number(c.req.query('page') ?? 1),
}))));
router.post('/:id', async c => {
  const parsed = ReelReviewerCommandSchema.safeParse(await readReelRequest(c));
  if (!parsed.success) throw new AppError('Invalid review command.', 400, 'REEL_REQUEST_INVALID');
  return c.json(success(await new ReelReviewAdapter(c).run({ operator: true, siteId: c.req.query('store_id'), reelId: c.req.param('id'), command: parsed.data })));
});
export default router;
