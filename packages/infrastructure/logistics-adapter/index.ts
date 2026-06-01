export type LogisticsProviderName = 'shiprocket' | 'delhivery' | 'pickrr';
export type LogisticsMode = 'test' | 'live';
export type ShipmentStatus =
  | 'label_created'
  | 'ready_to_ship'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'cancelled';

export interface LogisticsAddress {
  name: string;
  phone?: string | null;
  email?: string | null;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface LogisticsParcel {
  weightGrams: number;
  lengthCm?: number;
  widthCm?: number;
  heightCm?: number;
}

export interface CreateShippingLabelInput {
  orderId: string;
  orderNumber: string;
  idempotencyKey: string;
  pickup?: LogisticsAddress | null;
  destination: LogisticsAddress;
  parcels: LogisticsParcel[];
  metadata?: Record<string, string>;
}

export interface ShippingLabelResult {
  provider: LogisticsProviderName;
  carrier: string;
  providerShipmentId: string;
  trackingNumber: string;
  trackingUrl: string;
  labelUrl: string;
  status: ShipmentStatus;
  testMode: boolean;
}

export interface ShipmentTrackingInput {
  trackingNumber: string;
}

export interface ShipmentTrackingEvent {
  status: ShipmentStatus;
  location?: string;
  occurredAt: string;
  description: string;
}

export interface ShipmentTrackingResult {
  provider: LogisticsProviderName;
  carrier: string;
  trackingNumber: string;
  trackingUrl: string;
  status: ShipmentStatus;
  events: ShipmentTrackingEvent[];
  testMode: boolean;
}

export interface LogisticsProvider {
  name: LogisticsProviderName;
  createLabel(input: CreateShippingLabelInput): Promise<ShippingLabelResult>;
  getTracking(input: ShipmentTrackingInput): Promise<ShipmentTrackingResult>;
}

export interface LogisticsProviderCredentials {
  apiKey?: string;
  token?: string;
  username?: string;
  password?: string;
}

export interface LogisticsProviderOptions {
  mode?: LogisticsMode;
  credentials?: LogisticsProviderCredentials;
  now?: () => Date;
}

export interface FulfillmentTrackingFields {
  carrier: string;
  tracking_number: string;
  tracking_url: string;
}

const PROVIDER_CONFIG: Record<LogisticsProviderName, { carrier: string; trackingPrefix: string; trackingBaseUrl: string }> = {
  shiprocket: {
    carrier: 'Shiprocket',
    trackingPrefix: 'SR',
    trackingBaseUrl: 'https://shiprocket.co/tracking',
  },
  delhivery: {
    carrier: 'Delhivery',
    trackingPrefix: 'DLV',
    trackingBaseUrl: 'https://www.delhivery.com/track-v2/package',
  },
  pickrr: {
    carrier: 'Pickrr',
    trackingPrefix: 'PKR',
    trackingBaseUrl: 'https://pickrr.com/tracking',
  },
};

function normalizeMode(options: LogisticsProviderOptions): LogisticsMode {
  return options.mode || 'test';
}

function assertLiveCredentials(provider: LogisticsProviderName, options: LogisticsProviderOptions) {
  if (normalizeMode(options) === 'test') return;
  const credentials = options.credentials || {};
  if (!credentials.apiKey && !credentials.token && !(credentials.username && credentials.password)) {
    throw new Error(`${provider} logistics live mode requires provider credentials`);
  }
}

function safeToken(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 24) || 'ORDER';
}

function normalizeParcel(parcel: LogisticsParcel): LogisticsParcel {
  return {
    weightGrams: Math.max(1, Math.round(parcel.weightGrams)),
    lengthCm: parcel.lengthCm ? Math.max(1, Math.round(parcel.lengthCm)) : undefined,
    widthCm: parcel.widthCm ? Math.max(1, Math.round(parcel.widthCm)) : undefined,
    heightCm: parcel.heightCm ? Math.max(1, Math.round(parcel.heightCm)) : undefined,
  };
}

function createTrackingNumber(provider: LogisticsProviderName, orderNumber: string, idempotencyKey: string): string {
  const config = PROVIDER_CONFIG[provider];
  return `${config.trackingPrefix}${safeToken(orderNumber)}${safeToken(idempotencyKey).slice(0, 8)}`;
}

function trackingUrl(provider: LogisticsProviderName, trackingNumber: string): string {
  const config = PROVIDER_CONFIG[provider];
  if (provider === 'pickrr') return `${config.trackingBaseUrl}/#/?tracking_id=${encodeURIComponent(trackingNumber)}`;
  return `${config.trackingBaseUrl}/${encodeURIComponent(trackingNumber)}`;
}

function labelUrl(provider: LogisticsProviderName, shipmentId: string): string {
  return `https://logistics.test.letbuyy.store/${provider}/labels/${encodeURIComponent(shipmentId)}.pdf`;
}

function createScaffoldLogisticsProvider(provider: LogisticsProviderName, options: LogisticsProviderOptions = {}): LogisticsProvider {
  const mode = normalizeMode(options);
  const config = PROVIDER_CONFIG[provider];
  assertLiveCredentials(provider, options);

  return {
    name: provider,

    async createLabel(input) {
      if (!input.destination.line1 || !input.destination.city || !input.destination.postalCode) {
        throw new Error(`${config.carrier} label creation requires a destination address`);
      }
      const parcel = normalizeParcel(input.parcels[0] || { weightGrams: 500 });
      const trackingNumber = createTrackingNumber(provider, input.orderNumber, input.idempotencyKey);
      const providerShipmentId = `${provider}_${safeToken(input.orderId)}_${parcel.weightGrams}`;

      return {
        provider,
        carrier: config.carrier,
        providerShipmentId,
        trackingNumber,
        trackingUrl: trackingUrl(provider, trackingNumber),
        labelUrl: labelUrl(provider, providerShipmentId),
        status: 'label_created',
        testMode: mode === 'test',
      };
    },

    async getTracking(input) {
      const now = (options.now || (() => new Date()))().toISOString();
      return {
        provider,
        carrier: config.carrier,
        trackingNumber: input.trackingNumber,
        trackingUrl: trackingUrl(provider, input.trackingNumber),
        status: 'label_created',
        events: [
          {
            status: 'label_created',
            occurredAt: now,
            description: `${config.carrier} shipment label is ready`,
          },
        ],
        testMode: mode === 'test',
      };
    },
  };
}

export function createShiprocketLogisticsProvider(options: LogisticsProviderOptions = {}): LogisticsProvider {
  return createScaffoldLogisticsProvider('shiprocket', options);
}

export function createDelhiveryLogisticsProvider(options: LogisticsProviderOptions = {}): LogisticsProvider {
  return createScaffoldLogisticsProvider('delhivery', options);
}

export function createPickrrLogisticsProvider(options: LogisticsProviderOptions = {}): LogisticsProvider {
  return createScaffoldLogisticsProvider('pickrr', options);
}

export function createLogisticsProvider(
  provider: LogisticsProviderName,
  options: LogisticsProviderOptions = {},
): LogisticsProvider {
  switch (provider) {
    case 'shiprocket':
      return createShiprocketLogisticsProvider(options);
    case 'delhivery':
      return createDelhiveryLogisticsProvider(options);
    case 'pickrr':
      return createPickrrLogisticsProvider(options);
    default:
      throw new Error(`Unsupported logistics provider: ${provider satisfies never}`);
  }
}

export function toFulfillmentTrackingFields(result: ShippingLabelResult): FulfillmentTrackingFields {
  return {
    carrier: result.carrier,
    tracking_number: result.trackingNumber,
    tracking_url: result.trackingUrl,
  };
}
