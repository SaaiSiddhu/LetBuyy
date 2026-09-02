import type { RequestContext } from '../runtime/types';

type Primitive = string | number | boolean | null | undefined;
export type LogFields = Record<string, Primitive | readonly Primitive[]>;

export type Logger = {
  readonly info: (message: string, fields?: LogFields) => void;
  readonly warn: (message: string, fields?: LogFields) => void;
  readonly error: (message: string, fields?: LogFields) => void;
};

export function createLogger(baseFields: LogFields = {}): Logger {
  return {
    info: (message, fields = {}) => writeLog('info', message, baseFields, fields),
    warn: (message, fields = {}) => writeLog('warn', message, baseFields, fields),
    error: (message, fields = {}) => writeLog('error', message, baseFields, fields),
  };
}

export function requestLogFields(context: RequestContext, status: number, durationMs: number): LogFields {
  return {
    requestId: context.ids.requestId,
    traceId: context.ids.traceId,
    correlationId: context.ids.correlationId,
    route: context.route.policy.path,
    owner: context.route.policy.owner,
    userId: context.auth?.userId ?? null,
    clientIp: context.clientIp,
    deviceId: context.deviceId,
    status,
    durationMs,
  };
}

function writeLog(level: 'info' | 'warn' | 'error', message: string, ...fieldSets: readonly LogFields[]): void {
  const payload: LogFields & { level: string; message: string; timestamp: string } = {
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  for (const fields of fieldSets) {
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) {
        payload[key] = redact(key, value);
      }
    }
  }

  const serialized = JSON.stringify(payload);
  if (level === 'error') {
    console.error(serialized);
    return;
  }
  console.log(serialized);
}

function redact(key: string, value: LogFields[string]): LogFields[string] {
  const lowerKey = key.toLowerCase();
  if (lowerKey.includes('token') || lowerKey.includes('authorization') || lowerKey.includes('secret')) {
    return '[redacted]';
  }
  return value;
}
