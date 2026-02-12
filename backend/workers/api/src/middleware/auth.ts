import { createMiddleware } from 'hono/factory';
import { createClient } from '@supabase/supabase-js';
import type { Env } from '../index';

interface AuthContext {
    user: {
        id: string;
        email: string;
        role?: string;
    };
}

declare module 'hono' {
    interface ContextVariableMap {
        auth: AuthContext;
    }
}

export const authMiddleware = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
        const authHeader = c.req.header('Authorization');

        if (!authHeader?.startsWith('Bearer ')) {
            return c.json(
                {
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Missing or invalid authorization header',
                    },
                },
                401
            );
        }

        const token = authHeader.slice(7);

        try {
            const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY);

            const {
                data: { user },
                error,
            } = await supabase.auth.getUser(token);

            if (error || !user) {
                return c.json(
                    {
                        error: {
                            code: 'UNAUTHORIZED',
                            message: 'Invalid or expired token',
                        },
                    },
                    401
                );
            }

            c.set('auth', {
                user: {
                    id: user.id,
                    email: user.email!,
                    role: user.user_metadata?.role,
                },
            });

            await next();
        } catch (err) {
            console.error('Auth error:', err);
            return c.json(
                {
                    error: {
                        code: 'UNAUTHORIZED',
                        message: 'Authentication failed',
                    },
                },
                401
            );
        }
    }
);
