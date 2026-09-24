export type ContentBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'ol'; items: string[] }
  | { type: 'callout'; variant: 'tip' | 'warning' | 'info' | 'success'; title: string; text: string }
  | { type: 'code'; lang: string; text: string }
  | { type: 'blockquote'; text: string; cite?: string }
  | { type: 'table'; headers: string[]; rows: string[][] }
  // V4 rich editorial blocks
  | { type: 'insight'; title: string; text: string }
  | { type: 'checklist'; title?: string; items: Array<{ text: string; checked?: boolean }> }
  | { type: 'metric'; metrics: Array<{ label: string; value: string; change?: string; positive?: boolean }> }
  | { type: 'timeline'; items: Array<{ step: string; title: string; text: string }> }
  | { type: 'commerce-example'; scenario: string; result: string; metric?: string }
  | { type: 'ai-recommendation'; title: string; items: string[] }

export interface Author {
  slug: string
  name: string
  role: string
  bio: string
  avatar: string
  twitter?: string
  linkedin?: string
  articles?: string[]
}

export interface Category {
  slug: string
  label: string
  description: string
  icon: string
  color: string
  accent: string
}

export interface Article {
  slug: string
  category: string
  title: string
  subtitle: string
  description: string
  author: string
  publishedAt: string
  updatedAt: string
  tags: string[]
  readingTime: number
  featured?: boolean
  trending?: boolean
  body: ContentBlock[]
  relatedSlugs?: string[]
  seriesSlug?: string
  seriesPosition?: number
}

export interface ChangelogEntry {
  version: string
  date: string
  tag: 'feature' | 'fix' | 'improvement' | 'security' | 'breaking'
  title: string
  items: { type: 'feature' | 'fix' | 'improvement'; text: string }[]
}
