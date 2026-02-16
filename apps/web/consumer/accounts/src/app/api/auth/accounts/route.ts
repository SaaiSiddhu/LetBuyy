import { NextResponse } from 'next/server'
import { getAccounts } from '@/lib/auth/cookies'

/**
 * GET /api/auth/accounts
 * Return the list of previously logged-in accounts from the encrypted
 * lb_accounts cookie. Used by the lookup page to display saved accounts
 * even after the user has logged out.
 */
export async function GET() {
    try {
        const accounts = await getAccounts()
        return NextResponse.json({ accounts })
    } catch {
        return NextResponse.json({ accounts: [] })
    }
}
