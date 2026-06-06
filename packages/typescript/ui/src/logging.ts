/* eslint-disable no-console */

export type StructuredLogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface StructuredLogger {
    debug(message: string, context?: Record<string, unknown>): void
    info(message: string, context?: Record<string, unknown>): void
    warn(message: string, context?: Record<string, unknown>): void
    error(message: string, context?: Record<string, unknown>): void
}

export function createStructuredLogger(app: string): StructuredLogger {
    function emit(level: StructuredLogLevel, message: string, context?: Record<string, unknown>): void {
        const entry = {
            level,
            app,
            message,
            timestamp: new Date().toISOString(),
            ...(context ?? {}),
        }
        const line = JSON.stringify(entry)
        if (level === 'error' || level === 'warn') {
            console.error(line)
        } else {
            console.log(line)
        }
    }

    return {
        debug: (message, context) => emit('debug', message, context),
        info: (message, context) => emit('info', message, context),
        warn: (message, context) => emit('warn', message, context),
        error: (message, context) => emit('error', message, context),
    }
}
