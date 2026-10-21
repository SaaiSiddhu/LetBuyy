import { redirect } from 'next/navigation'

export default async function OnlineStoreRedirect({ params }: { params: Promise<{ store: string }> }) {
    const { store } = await params
    redirect(`/${encodeURIComponent(store)}/online-store/themes`)
}
