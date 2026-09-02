import { log } from './observability/logger';
import { createRedis, type RealtimeEnv } from './redis/client';
import { keyspace } from './redis/keyspace';
import { RedisTtl } from './redis/ttl';
import { requireRealtimeAuth, authorizeChannel } from './realtime/auth';
import { deliveryIdFromChannel, getDeliveryLiveState, updateDeliveryLiveState } from './realtime/delivery_live';
import { cacheDispatchCandidates, cacheDispatchOffer } from './realtime/dispatch';
import { updateRiderPresence } from './realtime/presence';

export interface Env extends RealtimeEnv {
  readonly SUPABASE_SERVICE_ROLE_KEY?: string;
  readonly ORDER_TRACKER?: DurableObjectNamespace;
  readonly RIDER_LOCATION?: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();
    const traceId = request.headers.get('x-trace-id') ?? requestId;

    try {
      const url = new URL(request.url);
      if (url.pathname === '/health') {
        return json({ ok: true, service: 'realtime-gateway', environment: env.APP_ENV, requestId, traceId });
      }

      if (url.pathname.match(/^\/ws\/orders\/[^/]+$/) && request.method === 'GET') {
        return handleOrderSocket(request, env, traceId);
      }

      if (url.pathname === '/v1/rider/location' && request.method === 'POST') {
        return handleRiderLocation(request, env, traceId);
      }

      const redis = createRedis(env);
      if (!redis) {
        return json(
          {
            success: false,
            traceId,
            error: { code: 'redis.not_configured', message: 'Realtime Redis is not configured.' },
          },
          503,
        );
      }

      if (url.pathname === '/v1/ws') {
        return await handleWebSocket(request, env, redis, requestId, traceId);
      }

      const auth = await requireRealtimeAuth(request, env);

      if (url.pathname === '/v1/rider/heartbeat' && request.method === 'POST') {
        const payload = (await request.json()) as Parameters<typeof updateRiderPresence>[2];
        if (payload.riderId !== auth.userId && !auth.roles.some((role) => role === 'admin' || role === 'super_admin')) {
          return json({ success: false, traceId, error: { code: 'auth.permission_denied' } }, 403);
        }
        await updateRiderPresence(env, redis, payload);
        return json({ success: true, traceId, data: { ttlSeconds: RedisTtl.riderPresence } });
      }

      if (url.pathname.match(/^\/v1\/delivery\/[^/]+\/live$/) && request.method === 'POST') {
        const deliveryId = url.pathname.split('/')[3];
        const payload = (await request.json()) as Omit<Parameters<typeof updateDeliveryLiveState>[2], 'deliveryId'>;
        await updateDeliveryLiveState(env, redis, { ...payload, deliveryId });
        return json({ success: true, traceId, data: { ttlSeconds: RedisTtl.deliveryLive } });
      }

      if (url.pathname.match(/^\/v1\/dispatch\/[^/]+\/candidates$/) && request.method === 'POST') {
        const deliveryId = url.pathname.split('/')[3];
        const payload = (await request.json()) as { candidates: readonly { riderId: string; score: number }[] };
        await cacheDispatchCandidates(env, redis, deliveryId, payload.candidates);
        return json({ success: true, traceId, data: { ttlSeconds: RedisTtl.dispatchCandidates } });
      }

      if (url.pathname.match(/^\/v1\/dispatch\/[^/]+\/offers$/) && request.method === 'POST') {
        const deliveryId = url.pathname.split('/')[3];
        const payload = (await request.json()) as { riderId: string; attempt: number; expiresAt: string };
        await cacheDispatchOffer(env, redis, { ...payload, deliveryId });
        return json({ success: true, traceId, data: { ttlSeconds: RedisTtl.dispatchOffer } });
      }

      return json({ success: false, traceId, error: { code: 'route.not_found' } }, 404);
    } catch (error) {
      if (error instanceof Response) {
        return error;
      }
      log('error', 'realtime_request_failed', {
        requestId,
        traceId,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      return json({ success: false, traceId, error: { code: 'internal.unknown' } }, 500);
    } finally {
      ctx.waitUntil(
        Promise.resolve().then(() => {
          log('info', 'realtime_request_observed', { requestId, traceId });
        }),
      );
    }
  },
} satisfies ExportedHandler<Env>;

export class OrderTracker {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {
    this.state.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      return this.handleWebSocket(request);
    }

    if (request.method !== 'POST') {
      return json({ success: false, error: { code: 'route.not_found' } }, 404);
    }

    const payload = (await request.json()) as Record<string, unknown>;
    return this.updateSnapshot(orderTrackerPatchForPath(url.pathname, payload));
  }

  private async handleWebSocket(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    this.state.acceptWebSocket(server, ['order']);
    server.send(JSON.stringify({ type: 'connected', snapshot: await this.snapshot() }));
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): void {
    if (message === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', at: new Date().toISOString() }));
    }
  }

  private async updateSnapshot(patch: Record<string, unknown>): Promise<Response> {
    const snapshot = { ...(await this.snapshot()), ...patch };
    await this.state.storage.put('snapshot', snapshot);
    this.broadcast({ type: 'order.update', snapshot });
    return json({ success: true, data: snapshot });
  }

  private async snapshot(): Promise<Record<string, unknown>> {
    return (await this.state.storage.get<Record<string, unknown>>('snapshot')) ?? {};
  }

  private broadcast(payload: unknown): void {
    const message = JSON.stringify(payload);
    for (const session of this.state.getWebSockets('order')) {
      try {
        session.send(message);
      } catch {
        session.close(1011, 'broadcast_failed');
      }
    }
  }
}

export function riderLocationStateFromPayload(payload: Record<string, unknown>): {
  riderId?: string;
  orderId?: string;
  cityId?: string;
  status?: string;
  lat?: number;
  lng?: number;
  eta?: string;
} {
  return {
    riderId: stringValue(payload.riderId),
    orderId: stringValue(payload.orderId ?? payload.activeDeliveryId ?? payload.deliveryId),
    cityId: stringValue(payload.cityId),
    status: stringValue(payload.status),
    lat: numberValue(payload.lat ?? payload.latitude),
    lng: numberValue(payload.lng ?? payload.longitude),
    eta: stringValue(payload.eta),
  };
}

export function orderTrackerPatchForPath(
  path: string,
  payload: Record<string, unknown>,
  now = new Date().toISOString(),
): Record<string, unknown> {
  if (path.endsWith('/status')) {
    return { orderStatus: payload.status, lastUpdated: now };
  }
  if (path.endsWith('/location')) {
    return {
      riderId: payload.riderId,
      deliveryStatus: payload.status,
      riderLocation: { lat: payload.lat, lng: payload.lng },
      eta: payload.eta,
      lastUpdated: now,
    };
  }
  if (path.endsWith('/eta')) {
    return { eta: payload.eta, lastUpdated: now };
  }
  return { ...payload, lastUpdated: now };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export class RiderLocation {
  constructor(
    private readonly state: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return json({ success: false, error: { code: 'route.not_found' } }, 404);
    }

    const payload = riderLocationStateFromPayload((await request.json()) as Record<string, unknown>);
    const now = new Date().toISOString();
    const state = { ...payload, lastUpdated: now };
    await this.state.storage.put('location', state);

    if (payload.orderId && this.env.ORDER_TRACKER) {
      const id = this.env.ORDER_TRACKER.idFromName(payload.orderId);
      const tracker = this.env.ORDER_TRACKER.get(id);
      await tracker.fetch(`https://durable-object/orders/${payload.orderId}/location`, {
        method: 'POST',
        body: JSON.stringify({
          riderId: payload.riderId,
          status: payload.status,
          lat: payload.lat,
          lng: payload.lng,
          eta: payload.eta,
        }),
      });
    }

    await this.persistEveryThirtySeconds(state);
    return json({ success: true, data: state });
  }

  private async persistEveryThirtySeconds(payload: Record<string, unknown>): Promise<void> {
    const lastPersistedAt = (await this.state.storage.get<number>('lastPersistedAt')) ?? 0;
    if (Date.now() - lastPersistedAt < 30_000 || !this.env.SUPABASE_SERVICE_ROLE_KEY) {
      return;
    }
    await this.state.storage.put('lastPersistedAt', Date.now());
    await fetch(`${this.env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/outbox_events`, {
      method: 'POST',
      headers: {
        apikey: this.env.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${this.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'content-type': 'application/json',
        'content-profile': 'ops',
        'prefer': 'return=minimal',
      },
      body: JSON.stringify({
        aggregate_type: 'rider',
        aggregate_id: String(payload.riderId ?? crypto.randomUUID()),
        event_type: 'rider.location_updated',
        payload,
      }),
    });
  }
}

async function handleOrderSocket(request: Request, env: Env, traceId: string): Promise<Response> {
  if (!env.ORDER_TRACKER) {
    return json({ success: false, traceId, error: { code: 'durable_object.not_configured' } }, 503);
  }
  await requireRealtimeAuth(request, env);
  const orderId = new URL(request.url).pathname.split('/')[3];
  const id = env.ORDER_TRACKER.idFromName(orderId);
  return env.ORDER_TRACKER.get(id).fetch(request);
}

async function handleRiderLocation(request: Request, env: Env, traceId: string): Promise<Response> {
  if (!env.RIDER_LOCATION) {
    return json({ success: false, traceId, error: { code: 'durable_object.not_configured' } }, 503);
  }
  const auth = await requireRealtimeAuth(request, env);
  const body = (await request.json()) as Record<string, unknown>;
  const riderId = typeof body.riderId === 'string' ? body.riderId : auth.userId;
  if (riderId !== auth.userId && !auth.roles.some((role) => role === 'admin' || role === 'super_admin')) {
    return json({ success: false, traceId, error: { code: 'auth.permission_denied' } }, 403);
  }
  const normalized = riderLocationStateFromPayload({ ...body, riderId });
  if (normalized.cityId && normalized.lat != null && normalized.lng != null) {
    const redis = createRedis(env);
    if (redis) {
      await updateRiderPresence(env, redis, {
        riderId,
        cityId: normalized.cityId,
        status: normalized.status === 'on_trip' ? 'on_trip' : 'available',
        latitude: normalized.lat,
        longitude: normalized.lng,
        activeDeliveryId:
          stringValue(body.activeDeliveryId ?? body.deliveryId) ?? normalized.orderId,
      });
    }
  }
  const id = env.RIDER_LOCATION.idFromName(riderId);
  return env.RIDER_LOCATION.get(id).fetch('https://durable-object/rider/location', {
    method: 'POST',
    body: JSON.stringify({ ...body, riderId }),
  });
}

async function handleWebSocket(
  request: Request,
  env: Env,
  redis: NonNullable<ReturnType<typeof createRedis>>,
  requestId: string,
  traceId: string,
): Promise<Response> {
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return json({ success: false, traceId, error: { code: 'websocket.upgrade_required' } }, 426);
  }

  const auth = await requireRealtimeAuth(request, env);
  const url = new URL(request.url);
  const channel = url.searchParams.get('channel') ?? '';
  if (channel && !authorizeChannel(channel, auth)) {
    return json({ success: false, traceId, error: { code: 'realtime.channel_forbidden' } }, 403);
  }

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  const connectionId = crypto.randomUUID();
  const keys = keyspace({ environment: env.APP_ENV });
  const subscribedChannels = new Set<string>();
  if (channel) {
    subscribedChannels.add(channel);
  }

  server.accept();
  await redis.hset(keys.websocketSession(connectionId), {
    user_id: auth.userId,
    channel,
    connected_at: new Date().toISOString(),
    request_id: requestId,
    trace_id: traceId,
  });
  await redis.expire(keys.websocketSession(connectionId), RedisTtl.websocketSession);

  const deliveryId = deliveryIdFromChannel(channel);
  const snapshot = deliveryId ? await getDeliveryLiveState(env, redis, deliveryId) : null;
  server.send(
    JSON.stringify({
      type: 'connected',
      requestId,
      traceId,
      connectionId,
      channel,
      snapshot,
      reconnectPolicy: { mode: 'reconcile_from_postgres_on_stale_snapshot' },
    }),
  );

  server.addEventListener('message', (event) => {
    if (event.data === 'ping') {
      server.send(JSON.stringify({ type: 'pong', traceId, at: new Date().toISOString() }));
      return;
    }
    if (typeof event.data !== 'string') {
      return;
    }
    void handleSocketMessage(event.data, {
      auth,
      env,
      redis,
      server,
      traceId,
      subscribedChannels,
    });
  });

  server.addEventListener('close', () => {
    void redis.expire(keys.websocketSession(connectionId), 1);
  });

  return new Response(null, { status: 101, webSocket: client });
}

async function handleSocketMessage(
  raw: string,
  context: {
    readonly auth: Awaited<ReturnType<typeof requireRealtimeAuth>>;
    readonly env: Env;
    readonly redis: NonNullable<ReturnType<typeof createRedis>>;
    readonly server: WebSocket;
    readonly traceId: string;
    readonly subscribedChannels: Set<string>;
  },
): Promise<void> {
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    context.server.send(
      JSON.stringify({ type: 'error', traceId: context.traceId, error: { code: 'message.invalid_json' } }),
    );
    return;
  }
  if (!decoded || typeof decoded !== 'object') {
    return;
  }
  const message = decoded as { type?: unknown; channel?: unknown };
  if (message.type !== 'subscribe' || typeof message.channel !== 'string') {
    return;
  }
  if (!authorizeChannel(message.channel, context.auth)) {
    context.server.send(
      JSON.stringify({
        type: 'error',
        traceId: context.traceId,
        channel: message.channel,
        error: { code: 'realtime.channel_forbidden' },
      }),
    );
    return;
  }
  context.subscribedChannels.add(message.channel);
  const deliveryId = deliveryIdFromChannel(message.channel);
  const snapshot = deliveryId ? await getDeliveryLiveState(context.env, context.redis, deliveryId) : null;
  context.server.send(
    JSON.stringify({
      type: 'subscribed',
      event: 'snapshot',
      traceId: context.traceId,
      channel: message.channel,
      snapshot,
    }),
  );
}

function json(payload: unknown, status = 200): Response {
  return Response.json(payload, {
    status,
    headers: {
      'cache-control': 'no-store',
    },
  });
}
