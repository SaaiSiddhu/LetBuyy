import { HttpError } from '../runtime/errors';
import type { AuthContext, Env, RoutePolicy } from '../runtime/types';
import { constantTimeEqual } from '../security/constant_time';

type SupabaseUserPayload = {
  readonly user?: {
    readonly id?: string;
    readonly email?: string;
    readonly phone?: string;
    readonly app_metadata?: {
      readonly roles?: readonly string[];
      readonly role?: string;
    };
    readonly user_metadata?: {
      readonly roles?: readonly string[];
      readonly role?: string;
    };
  };
};

export async function authenticate(request: Request, env: Env, policy: RoutePolicy): Promise<AuthContext | null> {
  if (policy.auth === 'none' || policy.auth === 'webhook') {
    return null;
  }

  if (policy.auth === 'service') {
    return requireServiceToken(request, env);
  }

  const token = getBearerToken(request);
  const response = await fetch(`${env.SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/user`, {
    headers: {
      authorization: `Bearer ${token}`,
      apikey: env.SUPABASE_ANON_KEY,
      'x-client-info': 'agrimore-api-gateway',
    },
  });

  if (!response.ok) {
    throw new HttpError(401, 'auth.invalid_token', 'Supabase token validation failed.');
  }

  const payload = (await response.json()) as SupabaseUserPayload;
  if (!payload.user?.id) {
    throw new HttpError(401, 'auth.invalid_token', 'Supabase token did not contain a user.');
  }

  const roles = extractRoles(payload);
  if (policy.auth === 'admin' && !roles.some((role) => role === 'admin' || role === 'super_admin')) {
    throw new HttpError(403, 'auth.permission_denied', 'Admin permission is required.');
  }

  return {
    userId: payload.user.id,
    email: payload.user.email,
    roles,
    token,
  };
}

export function requireRole(context: AuthContext | null, allowedRoles: readonly string[]): void {
  if (!context) {
    throw new HttpError(401, 'auth.unauthenticated', 'Authentication is required.');
  }

  if (!context.roles.some((role) => allowedRoles.includes(role))) {
    throw new HttpError(403, 'auth.permission_denied', 'User does not have the required role.');
  }
}

function getBearerToken(request: Request): string {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new HttpError(401, 'auth.unauthenticated', 'Bearer authorization is required.');
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (token.length < 16) {
    throw new HttpError(401, 'auth.invalid_token', 'Bearer token is malformed.');
  }
  return token;
}

function requireServiceToken(request: Request, env: Env): AuthContext {
  const configuredToken = env.SERVICE_AUTH_TOKEN;
  const presentedToken = request.headers.get('x-service-token') ?? '';

  if (!configuredToken || !presentedToken || !constantTimeEqual(configuredToken, presentedToken)) {
    throw new HttpError(403, 'auth.service_denied', 'Service credentials are invalid.');
  }

  return {
    userId: 'service',
    roles: ['service'],
    token: presentedToken,
  };
}

function extractRoles(payload: SupabaseUserPayload): readonly string[] {
  const appRoles = payload.user?.app_metadata?.roles;
  const appRole = payload.user?.app_metadata?.role;
  const userRoles = payload.user?.user_metadata?.roles;
  const userRole = payload.user?.user_metadata?.role;

  const roles = new Set<string>();
  for (const role of appRoles ?? []) {
    roles.add(role);
  }
  if (appRole) {
    roles.add(appRole);
  }
  for (const role of userRoles ?? []) {
    roles.add(role);
  }
  if (userRole) {
    roles.add(userRole);
  }
  if (roles.size === 0) {
    roles.add('customer');
  }
  return [...roles].sort();
}
