export interface RuntimeTelemetryDataPoint {
  indexes?: Array<ArrayBuffer | string | null>;
  doubles?: number[];
  blobs?: Array<ArrayBuffer | string | null>;
}

export interface RuntimeTelemetryDatasetBinding {
  writeDataPoint(event?: RuntimeTelemetryDataPoint): void;
}

export interface RuntimeTelemetryDataPointInput {
  metricName: string;
  runtimeName: string;
  environment?: string | null;
  deploymentEnv?: string | null;
  telemetryEnv?: string | null;
  siteId?: string | null;
  requestId?: string | null;
  traceId?: string | null;
  blobs?: Array<string | null | undefined>;
  doubles?: number[];
  index?: string | null;
}

export const RUNTIME_TELEMETRY_SCHEMA_VERSION = 'letbuyy-runtime-telemetry-v1';

const MAX_ANALYTICS_ENGINE_BLOBS = 20;
const MAX_ANALYTICS_ENGINE_DOUBLES = 20;
const MAX_ANALYTICS_ENGINE_STRING_LENGTH = 512;

function safeTelemetryString(value: string | null | undefined, fallback = ''): string {
  const normalized = typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
  return normalized.length > MAX_ANALYTICS_ENGINE_STRING_LENGTH
    ? normalized.slice(0, MAX_ANALYTICS_ENGINE_STRING_LENGTH)
    : normalized;
}

function safeTelemetryNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function runtimeTelemetryDataPoint(input: RuntimeTelemetryDataPointInput): RuntimeTelemetryDataPoint {
  const blobs = [
    RUNTIME_TELEMETRY_SCHEMA_VERSION,
    input.metricName,
    input.runtimeName,
    input.environment || '',
    input.deploymentEnv || input.environment || '',
    input.telemetryEnv || input.environment || '',
    input.siteId || '',
    input.requestId || '',
    input.traceId || '',
    ...(input.blobs || []),
  ].slice(0, MAX_ANALYTICS_ENGINE_BLOBS).map((value) => safeTelemetryString(value));

  const doubles = (input.doubles || [1])
    .slice(0, MAX_ANALYTICS_ENGINE_DOUBLES)
    .map(safeTelemetryNumber);

  const index = safeTelemetryString(
    input.index || input.siteId || `${input.runtimeName}:${input.environment || 'unknown'}`,
    'letbuyy-runtime',
  );

  return {
    indexes: [index],
    doubles,
    blobs,
  };
}

export function writeRuntimeTelemetryDataPoint(
  binding: RuntimeTelemetryDatasetBinding | null | undefined,
  input: RuntimeTelemetryDataPointInput,
): boolean {
  if (!binding) return false;
  binding.writeDataPoint(runtimeTelemetryDataPoint(input));
  return true;
}
