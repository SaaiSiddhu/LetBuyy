import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

/** Public signing association. Never guess Play signing or reuse a debug fingerprint. */
export function GET() {
    const fingerprints = (process.env.LETBUYY_ANDROID_APP_LINKS_SHA256 || '').split(',').map(value => value.trim().toUpperCase()).filter(Boolean)
    if (!fingerprints.length || fingerprints.some(value => !/^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/.test(value))) {
        return NextResponse.json([], { status: 503, headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: 'com.letbuyy.store', sha256_cert_fingerprints: [...new Set(fingerprints)] } }], { headers: { 'Cache-Control': 'public, max-age=300' } })
}
