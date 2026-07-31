import { redirect } from 'next/navigation'

interface LocalizationSettingsPageProps {
    params: Promise<{ store: string }>
}

// Languages & localization now lives inside the General settings page.
// This route is kept as a permanent redirect so existing links/bookmarks resolve.
export default async function LocalizationSettingsPage({ params }: LocalizationSettingsPageProps) {
    const { store } = await params
    redirect(`/${store}/settings/general`)
}
