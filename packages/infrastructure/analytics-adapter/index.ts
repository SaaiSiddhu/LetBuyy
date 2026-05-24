export interface AnalyticsEventInput {
  provider: 'internal' | 'posthog' | 'segment' | 'mixpanel' | 'custom';
  eventName: string;
  siteId?: string;
  actorId?: string;
  properties: Record<string, unknown>;
  occurredAt?: string;
}

export interface AnalyticsAdapterPort {
  track(input: AnalyticsEventInput): Promise<void>;
}
