'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function SettingsPage() {
    const { store } = useParams<{ store: string }>()
    const router = useRouter()

    useEffect(() => {
        router.replace(`/${store}/settings/general`)
    }, [store, router])

    return null
}
