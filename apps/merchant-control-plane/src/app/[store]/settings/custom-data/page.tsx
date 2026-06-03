import { BackendNeededPane } from '@/components/settings/BackendNeededPane'

interface CustomDataSettingsPageProps {
    params: Promise<{ store: string }>
}

export default async function CustomDataSettingsPage({ params }: CustomDataSettingsPageProps) {
    const { store } = await params

    return (
        <BackendNeededPane
            store={store}
            title="Custom data"
            description="Define metafields and metaobjects that extend storefront, product, and content data."
            requirement="[SKIP - NEEDS BACKEND: metafields and metaobjects API]"
            details={[
                'Required read endpoint: `GET /api/stores/:store/custom-data` or `GET /v1/custom-data?store_id=:id` returning metafield definitions, metaobject definitions, and usage counts.',
                'Required mutation endpoints for definition create/update/delete and value lifecycle with tenant-scoped `site_id` ownership checks.',
                'No `metafields`, `metaobjects`, or custom-data gateway route was found in current services/packages.',
            ]}
        />
    )
}
