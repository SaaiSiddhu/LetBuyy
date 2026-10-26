import { ARTICLES } from './articles'
import type { LearningPath } from './learning-paths'

/** A learning path is a sequence, independent of the catalogue's display order. */
export function getLearningPathArticles(path: Pick<LearningPath, 'articleSlugs'>) {
  return path.articleSlugs.flatMap(slug => ARTICLES.find(article => article.slug === slug) ?? [])
}
