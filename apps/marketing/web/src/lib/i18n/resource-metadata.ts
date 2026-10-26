import type { Author, Category } from '../resources/types'
import { createCopy } from './copy'

export function localizeCategory(source: Category, language: string): Category {
    const t = createCopy(language)
    return { ...source, label: t(source.label), description: t(source.description) }
}

export function localizeAuthor(source: Author, language: string): Author {
    const t = createCopy(language)
    return { ...source, role: t(source.role), bio: t(source.bio) }
}
