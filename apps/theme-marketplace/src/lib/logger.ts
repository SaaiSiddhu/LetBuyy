/* eslint-disable no-console */
/**
 * Minimal structured logger for theme-marketplace server code.
 *
 * Emits single-line JSON so logs are queryable in aggregation tooling. This is
 * the ONLY module permitted to call `console.*` (see the app eslint config's
 * `no-console` rule); all other code must use this logger.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

function emit(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry = {
        level,
        app: 'theme-marketplace',
        message,
        timestamp: new Date().toISOString(),
        ...(context ?? {}),
    };
    const line = JSON.stringify(entry);
    if (level === 'error' || level === 'warn') {
        console.error(line);
    } else {
        console.log(line);
    }
}

export const logger = {
    debug: (message: string, context?: Record<string, unknown>) => emit('debug', message, context),
    info: (message: string, context?: Record<string, unknown>) => emit('info', message, context),
    warn: (message: string, context?: Record<string, unknown>) => emit('warn', message, context),
    error: (message: string, context?: Record<string, unknown>) => emit('error', message, context),
};
