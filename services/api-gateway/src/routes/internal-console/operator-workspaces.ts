import { Hono } from 'hono';
import type { Env } from '../../index';
import { bindConsoleOperatorIdentity } from '../../identity-foundation/console-session-repository';
import { requireConsolePermission } from '../../identity-foundation/console-approval-repository';
import operationsRouter from '../operations';
import incidentCommandRouter from '../operations/incident-command';
import rbacRouter from '../operations/rbac';
import riskRouter from '../operations/risk';
import listingRouter from '../operations/marketplace-listings';
import supportRouter from '../operations/support';

// Reuse the existing operator handlers. This adapter supplies a verified human
// identity where the Console bridge cannot serve as a legacy user bearer token.
// Exact route admission prevents exposing generic runtime commands, outbox
// execution, provider dispatch or the frozen third-party app platform.
const admitted: Record<string, RegExp[]> = {
    GET: [/^\/support\/(?:overview|assignees|tickets(?:\/[0-9a-f-]{36})?|macros)$/i, /^\/rbac\/(break-glass|access-reviews)$/, /^\/risk\/overview$/, /^\/runtime\/(overview|incidents)$/,
        /^\/postmortems$/, /^\/marketplace-listings(?:\/(?:reviewers|[0-9a-f-]{36}))?$/i],
    POST: [/^\/support\/recovery$/, /^\/support\/tickets(?:\/[0-9a-f-]{36}\/(?:messages|escalate|resolve|csat))?$/i, /^\/rbac\/(break-glass|access-reviews)$/, /^\/rbac\/break-glass\/[0-9a-f-]{36}\/expire$/i,
        /^\/runtime\/incidents$/, /^\/runtime\/incidents\/[^/]+\/(events|page)$/,
        /^\/oncall\/schedules$/, /^\/postmortems$/,
        /^\/marketplace-listings\/[0-9a-f-]{36}\/(claim|assign|approve|reject|take-down)$/i],
    PATCH: [/^\/support\/tickets\/[0-9a-f-]{36}\/assign$/i, /^\/runtime\/incidents\/[^/]+\/status$/],
};
const router = new Hono<{ Bindings: Env }>();
router.use('*', async (c, next) => {
    const path = c.req.path.replace(/^\/v1\/internal\/console\/operator/, '');
    if (!(admitted[c.req.method] || []).some(pattern => pattern.test(path))) return c.notFound();
    c.header('Cache-Control', 'no-store');
    await next();
});
router.use('*', bindConsoleOperatorIdentity);
router.use('*', async(c,next)=>{
    if(c.req.method!=='GET'){
        const path=c.req.path.replace(/^\/v1\/internal\/console\/operator/,'');
        const scope=path.startsWith('/support/')?(path.endsWith('/assign')?'support:manage':path.endsWith('/recovery')?'support:view':'support:reply'):path.startsWith('/rbac/')?'rbac:manage':path.startsWith('/marketplace-listings/')
            ?(path.endsWith('/assign')?'review:assign':'review:decide'):'incident:command';
        await requireConsolePermission(c,scope);
    }
    await next();
});
router.route('/support', supportRouter);
router.route('/rbac', rbacRouter);
router.route('/risk', riskRouter);
router.route('/marketplace-listings', listingRouter);
router.route('/', incidentCommandRouter);
router.route('/', operationsRouter);
export default router;
