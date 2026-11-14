'use client'

import { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function OnlineStoreRedirect() {
    const params = useParams()
    const router = useRouter()
    const store = params.store as string

    useEffect(() => {
        router.replace(`/${store}/online-store/themes`)
    }, [store, router])

    return null
}
