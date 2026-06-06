'use client'

import { useCallback } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'

export function useEditorUrl() {
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const selectedSection = searchParams.get('section')
    const selectedSetting = searchParams.get('setting')

    const setSelectedSection = useCallback((sectionId: string | null) => {
        const params = new URLSearchParams(searchParams.toString())
        if (sectionId) {
            params.set('section', sectionId)
        } else {
            params.delete('section')
        }
        params.delete('setting')
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, [searchParams, router, pathname])

    const setSelectedSetting = useCallback((settingKey: string | null) => {
        const params = new URLSearchParams(searchParams.toString())
        if (settingKey) {
            params.set('setting', settingKey)
        } else {
            params.delete('setting')
        }
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, [searchParams, router, pathname])

    const clearSelection = useCallback(() => {
        router.replace(pathname || '', { scroll: false })
    }, [router, pathname])

    return {
        selectedSection,
        selectedSetting,
        setSelectedSection,
        setSelectedSetting,
        clearSelection,
    }
}
