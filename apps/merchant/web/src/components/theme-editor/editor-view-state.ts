/** Editable UI projection of the canonical theme document; never an API DTO. */
export type BlockEntry = {
    id: string
    type: string
    order: number
    visible: boolean
    settings: Record<string, unknown>
    children?: BlockEntry[]
}

export type SectionEntry = {
    id: string
    type: string
    order: number
    visible: boolean
    settings: Record<string, unknown>
    blocks: BlockEntry[]
}

export type EditorState = {
    experienceId?: string
    themeSettings: Record<string, unknown>
    sections: {
        header: SectionEntry[]
        footer: SectionEntry[]
        template: SectionEntry[]
    }
}

export type EditorSelection =
    | { kind: 'section'; sectionId: string }
    | { kind: 'block'; sectionId: string; blockId: string }
    | { kind: 'theme'; groupKey: string }
