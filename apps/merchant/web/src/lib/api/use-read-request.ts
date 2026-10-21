'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export function useDebouncedValue(value: string, delay = 250) {
    const [applied, setApplied] = useState(value)
    useEffect(() => {
        const timer = setTimeout(() => setApplied(value), delay)
        return () => clearTimeout(timer)
    }, [value, delay])
    return applied
}

/** A read may update its page only while it owns the current scope and sequence. */
export function useReadRequest(identity: string) {
    const current = useRef({ identity, sequence: 0, active: false, controller: null as AbortController | null })
    useLayoutEffect(() => {
        const scope = { identity, sequence: 0, active: true, controller: null as AbortController | null }
        current.current = scope
        return () => { scope.active = false; scope.sequence++; scope.controller?.abort() }
    }, [identity])

    return useCallback(() => {
        const scope = current.current
        if (scope.identity !== identity || !scope.active) {
            return { signal: AbortSignal.abort(), isCurrent: () => false }
        }
        scope.controller?.abort()
        const controller = new AbortController()
        scope.controller = controller
        const sequence = ++scope.sequence
        return {
            signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15_000)]),
            isCurrent: () => scope.active && current.current === scope && scope.sequence === sequence && !controller.signal.aborted,
        }
    }, [identity])
}
