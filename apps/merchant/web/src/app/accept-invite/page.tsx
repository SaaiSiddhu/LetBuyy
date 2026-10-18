import { getSessionUser } from '@/lib/auth/session'
import { getAccountsUrl } from '@/lib/public-urls'
import { AcceptStaffInvitation } from './accept-invite-client'

export const dynamic = 'force-dynamic'
export default async function AcceptInvitePage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
    const query = await searchParams
    const user = await getSessionUser()
    return <AcceptStaffInvitation token={typeof query.token === 'string' ? query.token : ''} email={user?.email || null} accountsUrl={getAccountsUrl('/lookup')} />
}
