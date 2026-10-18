import { Hono } from 'hono';
import type { Env } from '../../index';
import { ValidationError } from '../../lib/errors';
import { success } from '../../lib/supabase';
import { ConsoleOncallSchedulesQuerySchema, readConsoleOncallSchedules } from '../../execution/console-oncall-schedules-execution.adapter';
import { readConsoleCurrentOncall } from '../../execution/console-current-oncall-execution.adapter';

// Mounted only inside the existing bridge-validated private Console perimeter.
// No legacy router, generic bearer exception or caller-supplied authority.
const router = new Hono<{ Bindings: Env }>();
router.use('*', async (c, next) => { c.header('Cache-Control', 'no-store'); await next(); });
router.get('/oncall/current', async c => {
    if (Object.keys(c.req.query()).length) throw new ValidationError('The current rotation read does not accept query parameters.');
    return c.json(success({ schedule: await readConsoleCurrentOncall(c) }));
});
router.get('/oncall/schedules', async c => {
    const query = ConsoleOncallSchedulesQuerySchema.safeParse(c.req.query());
    if (!query.success) throw new ValidationError('Invalid on-call schedule query.');
    return c.json(success(await readConsoleOncallSchedules(c, query.data)));
});
export default router;
