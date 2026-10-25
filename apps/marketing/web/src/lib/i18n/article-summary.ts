import type { Article } from '../resources/types'
import summaries from './article-summaries.json'
const SUMMARIES: Record<string, Record<string, string[]>> = summaries

/** Client-safe listing copy. Full source-locked body validation runs on article routes and in the catalogue tests. */
export function localizeArticleSummary(source: Article, language: string): Article {
    const entry = SUMMARIES[language]?.[source.slug]
    if (!entry) return source
    return { ...source, title: entry[0], subtitle: entry[1], description: entry[2] }
}
