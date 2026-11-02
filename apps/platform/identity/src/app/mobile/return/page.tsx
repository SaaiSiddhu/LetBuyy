import { MobileAccountReturn } from '@/components/MobileAccountReturn'
export const dynamic = 'force-dynamic'
export default async function MobileReturnPage({ searchParams }: { searchParams: Promise<{ site?: string }> }) {
    const { site } = await searchParams
    return <MobileAccountReturn siteId={site} />
}
