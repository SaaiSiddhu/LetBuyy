'use client'

import type { CopyVariables } from '@/lib/i18n/copy-format'
import { useCopy } from './useCopy'

/** A small locale-aware text leaf for shared server/client presentation. */
export default function Copy({ text, values }: { text?: string | null; values?: CopyVariables }) {
    const { t } = useCopy()
    return t(text ?? '', values)
}
