import { oidcSkeletonResponse } from '@/lib/identity-foundation/oidc-disabled'

export function POST(request: Request) {
    return oidcSkeletonResponse('oauth2/token', request)
}
