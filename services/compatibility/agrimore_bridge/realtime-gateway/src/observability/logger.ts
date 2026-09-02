export type LogFields = Record<string, string | number | boolean | null | undefined>;

export function log(level: 'info' | 'warn' | 'error', message: string, fields: LogFields = {}): void {
  const payload = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...fields,
  };
  const serialized = JSON.stringify(payload);
  if (level === 'error') {
    console.error(serialized);
    return;
  }
  console.log(serialized);
}
