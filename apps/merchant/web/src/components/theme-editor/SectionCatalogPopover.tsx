'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input } from '@letbuyy/ui'
import { Search, X } from 'lucide-react'
import type { EditorSectionCandidate, EditorSectionInsertionTarget } from '@letbuyy/theme-engine'
import styles from './section-catalog.module.css'

interface Props {
    target: EditorSectionInsertionTarget
    candidates: EditorSectionCandidate[]
    onChoose: (type: string) => void
    onClose: () => void
}

export default function SectionCatalogPopover({ target, candidates, onChoose, onClose }: Props) {
    const [query, setQuery] = useState('')
    const searchRef = useRef<HTMLInputElement>(null)
    useEffect(() => {
        const previous = document.activeElement
        searchRef.current?.focus()
        return () => {
            if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
        }
    }, [])

    const categories = useMemo(() => {
        const term = query.trim().toLocaleLowerCase()
        const filtered = candidates.filter((item) =>
            !term || `${item.name} ${item.description} ${item.category}`.toLocaleLowerCase().includes(term))
        return filtered.reduce<Record<string, EditorSectionCandidate[]>>((groups, item) => {
            (groups[item.category] ||= []).push(item)
            return groups
        }, {})
    }, [candidates, query])
    const count = Object.values(categories).reduce((sum, group) => sum + (group?.length || 0), 0)
    const location = target.position === 'end' ? `End of ${target.group}` : `${target.position} selected ${target.group} section`

    return <div className={styles.catalog} role="dialog" aria-label={`Add section: ${location}`} onKeyDown={event => {
        if (event.key === 'Escape') { event.stopPropagation(); onClose() }
    }}>
        <div className={styles.header}>
            <div><strong>Add section</strong><p>{location}</p></div>
            <Button unstyled type="button" aria-label="Close section catalog" onClick={onClose}><X size={16} aria-hidden="true" /></Button>
        </div>
        <label className={styles.search}>
            <Search size={16} aria-hidden="true" />
            <span className={styles.visuallyHidden}>Search sections</span>
            <Input unstyled ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search sections" />
        </label>
        <div className={styles.list}>
            {count ? Object.entries(categories).map(([category, items]) => <section key={category} aria-label={category}>
                <h3>{category}</h3>
                {items?.map(item => <Button unstyled type="button" key={item.type} className={styles.item}
                    disabled={!item.available} title={item.reason}
                    onClick={() => onChoose(item.type)}>
                    <span className={styles.preview} aria-hidden="true">Preview unavailable</span>
                    <span className={styles.copy}><strong>{item.name}</strong><small>{item.description}</small>
                        {!item.available && <small className={styles.reason}>{item.reason}</small>}
                    </span>
                </Button>)}
            </section>) : <p className={styles.empty}>{candidates.length ? 'No sections match your search.' : 'This theme has no addable sections.'}</p>}
        </div>
    </div>
}
