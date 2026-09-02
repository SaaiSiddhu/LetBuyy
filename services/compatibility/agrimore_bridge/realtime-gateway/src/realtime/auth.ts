import type { RealtimeEnv } from '../redis/client';

export type RealtimeAuth = {
  readonly userId: string;
  readonly roles: readonly string[];
  readonly token: string;
};

type SupabaseUserPayload = {
  readonly user?: {
    readonly id?: string;
    readonly app_metadata?: {
      readonly role?: string;
      readonly roles?: readonly string[];
    };
    readonly user_metadata?: {
      readonly role?: string;
      readonly roles?: readonly string[];
    };
  };
};

export async function requireRealtimeAuth(request: Request, env: RealtimeEnv): Promise<RealtimeAuth> {
  const token = bearerToken(request);
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
    headers: {
      authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
      'x-client-info': 'agrimore-realtime-gateway',
    },
  });

  if (!response.ok) {
    throw new Response('Unauthorized', { status: 401 });
  }

  const payload = (await response.json()) as SupabaseUserPayload;
  if (!payload.user?.id) {
    throw new Response('Unauthorized', { status: 401 });
  }

  return {
    userId: payload.user.id,
    roles: extractRoles(payload),
    token,
  };
}

export function authorizeChannel(channel: string, auth: RealtimeAuth): boolean {
  const [scope, subject, id] = channel.split('.');
  if (scope === 'user' && id === auth.userId) {
    return true;
  }
  if (scope === 'rider' && subject === 'offer' && id === auth.userId) {
    return true;
  }
  if (scope === 'delivery' && subject === 'live') {
    return auth.roles.some((role) => ['customer', 'rider', 'store_operator', 'admin', 'super_admin'].includes(role));
  }
  if (scope === 'store' && subject === 'queue') {
    return auth.roles.some((role) => ['store_operator', 'admin', 'super_admin'].includes(role));
  }
  if (scope === 'ops' && subject === 'city') {
    return auth.roles.some((role) => ['admin', 'super_admin'].includes(role));
  }
  return false;
}

function bearerToken(request: Request): string {
  const authorization = request.headers.get('authorization');
  if (authorization?.startsWith('Bearer ')) {
    return authorization.slice('Bearer '.length).trim();
  }

  const url = new URL(request.url);
  const token = url.searchParams.get('token') ?? url.searchParams.get('access_token');
  if (token && token.length > 16) {
    return token;
  }

  throw new Response('Unauthorized', { status: 401 });
}

function extractRoles(payload: SupabaseUserPayload): readonly string[] {
  const roles = new Set<string>();
  for (const role of payload.user?.app_metadata?.roles ?? []) {
    roles.add(role);
  }
  for (const role of payload.user?.user_metadata?.roles ?? []) {
    roles.add(role);
  }
  if (payload.user?.app_metadata?.role) {
    roles.add(payload.user.app_metadata.role);
  }
  if (payload.user?.user_metadata?.role) {
    roles.add(payload.user.user_metadata.role);
  }
  if (roles.size === 0) {
    roles.add('customer');
  }
  return [...roles].sort();
}
