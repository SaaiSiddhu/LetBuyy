import { HttpError } from '../runtime/errors';
import type { RoutePolicy } from '../runtime/types';

export function enforceBodyLimit(request: Request, policy: RoutePolicy): void {
  if (policy.method === 'GET' || policy.method === 'OPTIONS') {
    return;
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength) {
    const bytes = Number.parseInt(contentLength, 10);
    if (Number.isFinite(bytes) && bytes > policy.bodyLimitBytes) {
      throw new HttpError(
        413,
        'request.body_too_large',
        'Request body exceeds the route limit.',
        false,
        { bodyLimitBytes: policy.bodyLimitBytes },
      );
    }
  }
}
