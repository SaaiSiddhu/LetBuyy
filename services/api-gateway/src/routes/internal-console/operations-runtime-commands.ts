import { Hono } from 'hono';
import type { Env } from '../../index';
import { ValidationError } from '../../lib/errors';
import { success } from '../../lib/supabase';
import { ConsoleRuntimeCommandHistoryQuerySchema,readConsoleRuntimeCommandHistory } from '../../execution/console-runtime-command-history-execution.adapter';
// GET history only inside the existing bridge-validated private Console perimeter.
// Generic command submission, claims and execution remain unavailable/unchanged.
const router=new Hono<{Bindings:Env}>();
router.use('*',async(c,next)=>{c.header('Cache-Control','no-store');await next();});
router.get('/runtime/control-commands',async c=>{
 const query=ConsoleRuntimeCommandHistoryQuerySchema.safeParse(c.req.query());
 if(!query.success)throw new ValidationError('Invalid runtime command history query.');
 return c.json(success(await readConsoleRuntimeCommandHistory(c,query.data)));
});
export default router;
