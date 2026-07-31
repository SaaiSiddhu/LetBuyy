import { ARTICLES } from './articles'
import { CATEGORIES } from './categories'
import { AUTHORS } from './authors'
import { LEARNING_PATHS } from './learning-paths'
import type { Article, Author, Category } from './types'

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function getArticlesByCategory(cat: string): Article[] {
  return ARTICLES.filter(a => a.category === cat)
}

export function getFeaturedArticles(limit = 6): Article[] {
  return ARTICLES.filter(a => a.featured).slice(0, limit)
}

export function getTrendingArticles(limit = 5): Article[] {
  return ARTICLES.filter(a => a.trending).slice(0, limit)
}

export function getLatestArticles(limit = 9): Article[] {
  return [...ARTICLES]
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, limit)
}

export function getArticleBySlug(category: string, slug: string): Article | undefined {
  return ARTICLES.find(a => a.category === category && a.slug === slug)
}

export function getRelatedArticles(slugs: string[], excludeSlug?: string): Article[] {
  return ARTICLES
    .filter(a => slugs.includes(a.slug) && a.slug !== excludeSlug)
    .slice(0, 3)
}

export function getArticlesByTag(tag: string): Article[] {
  return ARTICLES.filter(a => a.tags.includes(tag))
}

export function searchArticles(query: string): Article[] {
  const q = query.toLowerCase().trim()
  if (!q) return []
  return ARTICLES.filter(a =>
    a.title.toLowerCase().includes(q) ||
    a.subtitle.toLowerCase().includes(q) ||
    a.description.toLowerCase().includes(q) ||
    a.tags.some(t => t.includes(q)) ||
    a.category.includes(q)
  )
}

export function getAllTags(): Array<{ tag: string; count: number }> {
  const counts = new Map<string, number>()
  ARTICLES.forEach(a => a.tags.forEach(t => counts.set(t, (counts.get(t) ?? 0) + 1)))
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
}

export function getAuthorArticles(authorSlug: string): Article[] {
  return ARTICLES.filter(a => a.author === authorSlug)
}

export function generateStaticArticleParams(): { category: string; slug: string }[] {
  return ARTICLES.map(a => ({ category: a.category, slug: a.slug }))
}

export function generateStaticCategoryParams(): { category: string }[] {
  return CATEGORIES.map(c => ({ category: c.slug }))
}

export function generateStaticTagParams(): { tag: string }[] {
  return getAllTags().map(({ tag }) => ({ tag }))
}

export function getAllArticlesForSitemap(): Article[] {
  return ARTICLES
}

export function getArticleDifficulty(slug: string): 'beginner' | 'intermediate' | 'advanced' | null {
  for (const path of LEARNING_PATHS) {
    if (path.articleSlugs.includes(slug)) return path.level
  }
  return null
}

export function getPrevNextInCategory(category: string, slug: string): { prev: Article | null; next: Article | null } {
  const articles = getArticlesByCategory(category)
  const idx = articles.findIndex(a => a.slug === slug)
  return {
    prev: idx > 0 ? articles[idx - 1] : null,
    next: idx < articles.length - 1 ? articles[idx + 1] : null,
  }
}

export function getSeriesArticles(seriesSlug: string): Article[] {
  return ARTICLES
    .filter(a => a.seriesSlug === seriesSlug)
    .sort((a, b) => (a.seriesPosition ?? 0) - (b.seriesPosition ?? 0))
}

export function getCategoryArticleCount(): Record<string, number> {
  const counts: Record<string, number> = {}
  ARTICLES.forEach(a => { counts[a.category] = (counts[a.category] ?? 0) + 1 })
  return counts
}

export function getTopArticlesPerCategory(limit = 2): Record<string, Article[]> {
  const result: Record<string, Article[]> = {}
  CATEGORIES.forEach(cat => {
    result[cat.slug] = ARTICLES
      .filter(a => a.category === cat.slug)
      .slice(0, limit)
  })
  return result
}

export { ARTICLES, CATEGORIES, AUTHORS, LEARNING_PATHS }
export type { Article, Author, Category }
