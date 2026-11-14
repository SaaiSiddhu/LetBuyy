import { createMiddleware } from 'hono/factory';
import type { Env } from '../index';
import { timingSafeEqualText } from '../lib/crypto';

/** Server transport credential; human authority is checked separately per route. */
export const consoleBridge = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const expected = c.env.PLATFORM_CONSOLE_API_TOKEN;
    const authorization = c.req.header('Authorization');
    const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : c.req.header('X-Platform-Console-Token');
    if (!expected) return c.json({ error: { code: 'CONSOLE_TOKEN_NOT_CONFIGURED', message: 'Platform console API token is not configured.' } }, 503);
    if (!token || !timingSafeEqualText(token, expected)) return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid platform console token.' } }, 401);
    await next();
});
