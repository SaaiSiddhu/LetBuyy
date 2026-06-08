import { oidcSkeletonResponse } from '@/lib/identity-foundation/oidc-disabled'

export function GET(request: Request) {
    return oidcSkeletonResponse('openid-configuration', request)
}
