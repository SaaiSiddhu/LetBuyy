import { oidcSkeletonResponse } from '@/lib/identity-foundation/oidc-disabled'

export function GET(request: Request) {
    return oidcSkeletonResponse('oauth2/authorize', request)
}
