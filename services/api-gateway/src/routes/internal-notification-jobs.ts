import { Hono } from 'hono';
import type { Env } from '../index';
import { admittedNotificationRequest } from '../lib/notification-internal-request';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { AppError } from '../lib/errors';

const router = new Hono<{ Bindings: Env }>();
router.post('/execute', async c => {
  const body = admittedNotificationRequest(c.req.raw);
  if (!body) throw new AppError('Invalid notification request', 401, 'UNAUTHORIZED');
  const { data, error } = await getSupabaseAdmin(c).rpc('notification_worker_operation_v1', {
    p_operation: body.operation, p_worker_id: body.worker_id,
    p_job_id: 'job_id' in body ? body.job_id : null, p_payload: body.payload,
  });
  if (error) {
    // SQL diagnostics and private snapshots never enter an error response.
    if (error.code === '22023') throw new AppError('Notification job is unavailable', 409, 'NOTIFICATION_JOB_REFUSED');
    throw new AppError('Notification processing is temporarily unavailable', 503, 'NOTIFICATION_JOB_UNAVAILABLE');
  }
  return c.json(success({ result: data }));
});
export default router;
