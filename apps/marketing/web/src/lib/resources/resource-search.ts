import type { Article } from './types'
import { CATEGORIES } from './categories'

export const RESOURCE_READING_LENGTHS = [
  { value: 'short', label: 'Up to 5 min', min: 0, max: 5 },
  { value: 'medium', label: '6–10 min', min: 6, max: 10 },
  { value: 'long', label: 'Over 10 min', min: 11, max: Infinity },
] as const

export type ResourceReadingLength = '' | typeof RESOURCE_READING_LENGTHS[number]['value']
export interface ResourceSearchState {
  query: string
  category: string
  length: ResourceReadingLength
  page: number
}

export const RESOURCE_PAGE_SIZE = 10
export const RESOURCE_SUGGESTIONS = ['UPI', 'GST invoices', 'inventory management', 'cart abandonment']

function normalize(text: string) {
  return text.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Match every search term across the guide's searchable fields, in any order. */
export function matchResourceArticles(articles: readonly Article[], query: string): Article[] {
  const terms = normalize(query).split(' ').filter(Boolean)
  if (!terms.length) return []
  return articles.filter(article => {
    const text = normalize([article.title, article.subtitle, article.description, article.category, ...article.tags].join(' '))
    return terms.every(term => text.includes(term))
  })
}

export function readResourceSearch(params: Pick<URLSearchParams, 'get'>): ResourceSearchState {
  const category = params.get('category') ?? ''
  const length = params.get('length') ?? ''
  const rawPage = params.get('page') ?? '1'
  return {
    query: params.get('q') ?? '',
    category: CATEGORIES.some(item => item.slug === category) ? category : '',
    length: RESOURCE_READING_LENGTHS.find(item => item.value === length)?.value ?? '',
    page: /^[1-9]\d{0,5}$/.test(rawPage) ? Number(rawPage) : 1,
  }
}

export function filterResourceArticles(articles: readonly Article[], state: ResourceSearchState): Article[] {
  const matches = state.query.trim() ? matchResourceArticles(articles, state.query) : [...articles]
  const length = RESOURCE_READING_LENGTHS.find(item => item.value === state.length)
  return matches.filter(article =>
    (!state.category || article.category === state.category) &&
    (!length || (article.readingTime >= length.min && article.readingTime <= length.max)),
  )
}

export function getResourceResultPage(articles: readonly Article[], requestedPage: number) {
  const pageCount = Math.max(1, Math.ceil(articles.length / RESOURCE_PAGE_SIZE))
  const page = Math.min(Math.max(1, requestedPage), pageCount)
  const start = (page - 1) * RESOURCE_PAGE_SIZE
  return { page, pageCount, start, articles: articles.slice(start, start + RESOURCE_PAGE_SIZE) }
}
