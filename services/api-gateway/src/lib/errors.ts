// ============================================================
// APPLICATION ERRORS — Typed error hierarchy
// ============================================================

/**
 * Base application error with HTTP status code and error code.
 * Used by the global error handler to return structured responses.
 */
export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;
    public readonly details?: unknown;

    constructor(message: string, statusCode: number, code: string, details?: unknown) {
        super(message);
        this.name = 'AppError';
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
    }
}

export class ValidationError extends AppError {
    constructor(message: string, details?: unknown) {
        super(message, 400, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}

export class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404, 'NOT_FOUND');
        this.name = 'NotFoundError';
    }
}

export class ForbiddenError extends AppError {
    constructor(message = 'Not authorized') {
        super(message, 403, 'FORBIDDEN');
        this.name = 'ForbiddenError';
    }
}

export class ConflictError extends AppError {
    constructor(message: string) {
        super(message, 409, 'CONFLICT');
        this.name = 'ConflictError';
    }
}

export class HumanRequiredError extends AppError {
    constructor(message: string, details?: unknown) {
        super(message, 503, 'HUMAN_REQUIRED', details);
        this.name = 'HumanRequiredError';
    }
}

export class InsufficientStockError extends AppError {
    constructor(product: string, available: number, requested: number) {
        super(
            `Insufficient stock for "${product}": ${available} available, ${requested} requested`,
            400,
            'INSUFFICIENT_STOCK'
        );
        this.name = 'InsufficientStockError';
    }
}

/**
 * Converts an AppError into a structured JSON response object.
 * Used by the global error handler in index.ts.
 */
export function formatAppError(err: AppError) {
    return {
        body: {
            error: {
                code: err.code,
                message: err.message,
                ...(err.details ? { details: err.details } : {}),
            },
        },
        status: err.statusCode,
    };
}
