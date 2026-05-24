'use client'

import { useState, useCallback } from 'react'

export interface TemplateConfig {
    sections: {
        header: SectionEntry
        footer: SectionEntry
        template: SectionEntry[]
    }
    themeSettings: Record<string, unknown>
}

export interface SectionEntry {
    id: string
    type: string
    visible: boolean
    settings: Record<string, unknown>
    blocks?: BlockEntry[]
}

export interface BlockEntry {
    id: string
    type: string
    settings: Record<string, unknown>
}

interface EditorHistoryState {
    past: TemplateConfig[]
    present: TemplateConfig
    future: TemplateConfig[]
}

const MAX_HISTORY = 50

export function useEditorHistory(initial: TemplateConfig) {
    const [history, setHistory] = useState<EditorHistoryState>({
        past: [],
        present: initial,
        future: [],
    })

    const pushState = useCallback((newState: TemplateConfig) => {
        setHistory(h => ({
            past: [...h.past.slice(-(MAX_HISTORY - 1)), h.present],
            present: newState,
            future: [],
        }))
    }, [])

    const undo = useCallback(() => {
        setHistory(h => {
            if (h.past.length === 0) return h
            const previous = h.past[h.past.length - 1]
            return {
                past: h.past.slice(0, -1),
                present: previous,
                future: [h.present, ...h.future],
            }
        })
    }, [])

    const redo = useCallback(() => {
        setHistory(h => {
            if (h.future.length === 0) return h
            const next = h.future[0]
            return {
                past: [...h.past, h.present],
                present: next,
                future: h.future.slice(1),
            }
        })
    }, [])

    const replaceState = useCallback((newState: TemplateConfig) => {
        setHistory({
            past: [],
            present: newState,
            future: [],
        })
    }, [])

    const canUndo = history.past.length > 0
    const canRedo = history.future.length > 0

    return {
        state: history.present,
        canUndo,
        canRedo,
        pushState,
        replaceState,
        undo,
        redo,
    }
}
