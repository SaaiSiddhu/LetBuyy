// ============================================================
// VALIDATION MIDDLEWARE — Zod schema validation factory
// ============================================================

import { createMiddleware } from 'hono/factory';
import { z } from 'zod';
import type { Env } from '../index';

type ValidationTarget = 'json' | 'query' | 'param';

declare module 'hono' {
    interface ContextVariableMap {
        validatedBody: unknown;
        validatedQuery: unknown;
        validatedParam: unknown;
    }
}

/**
 * Creates a Hono middleware that validates the request body, query, or params
 * against a Zod schema. On failure, returns 400 with structured errors.
 *
 * Usage:
 *   router.post('/products', validate('json', CreateProductSchema), async (c) => {
 *       const body = c.get('validatedBody') as z.infer<typeof CreateProductSchema>;
 *   });
 */
export function validate<T extends z.ZodType>(target: ValidationTarget, schema: T) {
    return createMiddleware<{ Bindings: Env }>(async (c, next) => {
        let data: unknown;

        try {
            switch (target) {
                case 'json':
                    data = await c.req.json();
                    break;
                case 'query':
                    data = Object.fromEntries(
                        new URL(c.req.url).searchParams.entries()
                    );
                    break;
                case 'param':
                    data = c.req.param();
                    break;
            }
        } catch {
            return c.json(
                {
                    error: {
                        code: 'INVALID_INPUT',
                        message: `Invalid ${target} data`,
                    },
                },
                400
            );
        }

        const result = schema.safeParse(data);

        if (!result.success) {
            const issues = result.error.issues.map((issue) => ({
                field: issue.path.join('.'),
                message: issue.message,
                code: issue.code,
            }));

            return c.json(
                {
                    error: {
                        code: 'VALIDATION_ERROR',
                        message: 'Request validation failed',
                        details: issues,
                    },
                },
                400
            );
        }

        // Set validated data on context
        switch (target) {
            case 'json':
                c.set('validatedBody', result.data);
                break;
            case 'query':
                c.set('validatedQuery', result.data);
                break;
            case 'param':
                c.set('validatedParam', result.data);
                break;
        }

        await next();
    });
}
