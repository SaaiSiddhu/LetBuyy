'use client'

import { useCopyContext } from './CopyProvider'

export function useCopy() {
    return useCopyContext()
}
