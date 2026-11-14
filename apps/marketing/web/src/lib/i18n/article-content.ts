import { createHash } from 'node:crypto'
import type { Article, ContentBlock } from '@/lib/resources/types'
import { resourceHeadingId } from '../resources/headings'
import { ARTICLE_CONTENT } from './article-catalog'

function mapBlock(block: ContentBlock, t: (text: string) => string): ContentBlock {
    switch (block.type) {
        case 'code': return block.lang === 'text' ? { ...block, text: t(block.text) } : { ...block } // Translate prose prompts; preserve executable examples.
        case 'p': return { ...block, text: t(block.text), ...(block.references ? { references: block.references.map(reference => ({ ...reference, label: t(reference.label) })) } : {}) }
        case 'h2': case 'h3': return { ...block, id: block.id ?? resourceHeadingId(block.text), text: t(block.text) }
        case 'blockquote': return { ...block, text: t(block.text), ...(block.cite ? { cite: t(block.cite) } : {}) }
        case 'ul': case 'ol': return { ...block, items: block.items.map(t) }
        case 'callout': case 'insight': return { ...block, title: t(block.title), text: t(block.text) }
        case 'table': return { ...block, headers: block.headers.map(t), rows: block.rows.map(row => row.map(t)) }
        case 'checklist': return { ...block, ...(block.title ? { title: t(block.title) } : {}), items: block.items.map(item => ({ ...item, text: t(item.text) })) }
        case 'metric': return { ...block, metrics: block.metrics.map(metric => ({ ...metric, label: t(metric.label), value: t(metric.value), ...(metric.change ? { change: t(metric.change) } : {}) })) }
        case 'timeline': return { ...block, items: block.items.map(item => ({ ...item, title: t(item.title), text: t(item.text) })) }
        case 'commerce-example': return { ...block, scenario: t(block.scenario), result: t(block.result), ...(block.metric ? { metric: t(block.metric) } : {}) }
        case 'ai-recommendation': return { ...block, title: t(block.title), items: block.items.map(t) }
    }
}

function mapArticle(source: Article, t: (text: string) => string): Article {
    return { ...source, title: t(source.title), subtitle: t(source.subtitle), description: t(source.description), body: source.body.map(block => mapBlock(block, t)) }
}

export function articleSourceText(source: Article): string[] {
    const values: string[] = []
    mapArticle(source, text => { values.push(text); return text })
    return values
}

export function articleSourceHash(source: Article): string {
    return createHash('sha256').update(JSON.stringify(articleSourceText(source))).digest('hex')
}

export function localizeArticleContent(source: Article, language: string): { article: Article; translated: boolean } {
    const entry = ARTICLE_CONTENT[language]?.[source.slug]
    if (!entry) return { article: source, translated: false }
    const sourceText = articleSourceText(source)
    if (entry.sourceHash !== articleSourceHash(source) || entry.values.length !== sourceText.length || entry.values.some((value, index) => sourceText[index].trim() && !value.trim())) {
        throw new Error(`Outdated or incomplete article translation: ${language}/${source.slug}`)
    }
    let cursor = 0
    return { article: mapArticle(source, () => entry.values[cursor++]), translated: true }
}
