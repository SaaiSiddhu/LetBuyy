'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Button, Input } from '@letbuyy/ui'
import Link from '@/components/i18n/LocaleLink'
import ArticleCard from '@/components/resources/ArticleCard'
import { CATEGORIES, getCategory } from '@/lib/resources/categories'
import { searchArticles, getAllTags } from '@/lib/resources/utils'
import type { Article } from '@/lib/resources/types'

const TRENDING_SEARCHES = ['upi payments', 'gst invoice', 'cart abandonment', 'inventory management', 'COD strategy', 'shopify alternative']
const READING_TIME_FILTERS = [
  { label: 'Quick read', max: 5 },
  { label: '5–10 min', min: 5, max: 10 },
  { label: '10+ min', min: 10 },
]

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [timeFilter, setTimeFilter] = useState<{ label: string; min?: number; max?: number } | null>(null)
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const topTags = getAllTags().slice(0, 12)

  const applyFilters = useCallback((articles: Article[]) => {
    let results = articles
    if (categoryFilter) results = results.filter(a => a.category === categoryFilter)
    if (timeFilter) {
      results = results.filter(a => {
        if (timeFilter.min && a.readingTime < timeFilter.min) return false
        if (timeFilter.max && a.readingTime > timeFilter.max) return false
        return true
      })
    }
    return results
  }, [categoryFilter, timeFilter])

  const rawResults = query.length >= 1 ? searchArticles(query) : []
  const results = applyFilters(rawResults)

  useEffect(() => {
    setActiveIdx(-1)
  }, [query, categoryFilter, timeFilter])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setQuery('')
      inputRef.current?.blur()
    }
  }

  // Global Cmd+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const showEmpty = query.length >= 1 && results.length === 0
  const showResults = results.length > 0

  return (
    <div className="res-v3-search-page">
      <div className="container" style={{ maxWidth: 780 }}>
        {/* Breadcrumb */}
        <nav className="rc-article-breadcrumb" style={{ marginBottom: 24 }} aria-label="Breadcrumb">
          <Link href="/resources">Resources</Link>
          <span aria-hidden="true">›</span>
          <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Search</span>
        </nav>

        <h1 className="res-v3-search-heading">Search resources</h1>
        <p className="res-v3-search-sub">Find guides, tutorials, and playbooks for Indian merchants</p>

        {/* Search input */}
        <div className="res-v3-search-wrap" role="search">
          <div className="res-v3-search-input-row">
            <svg className="res-v3-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <Input
              unstyled
              ref={inputRef}
              className="res-v3-search-input"
              type="search"
              placeholder="Search articles, guides, topics…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              aria-label="Search resources"
              aria-autocomplete="list"
              aria-controls="search-results"
              role="combobox"
              aria-expanded={showResults}
            />
            {query && (
              <Button
                unstyled
                type="button"
                className="res-v3-search-clear"
                onClick={() => { setQuery(''); inputRef.current?.focus() }}
                aria-label="Clear search"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </Button>
            )}
            <kbd className="res-v3-kbd" aria-label="Keyboard shortcut: Command K">⌘K</kbd>
          </div>

          {/* Filters */}
          <div className="res-v3-search-filters" role="group" aria-label="Filters">
            <div className="res-v3-filter-group">
              <span className="res-v3-filter-label">Category:</span>
              <Button
                unstyled
                type="button"
                className={`res-v3-filter-chip${!categoryFilter ? ' active' : ''}`}
                onClick={() => setCategoryFilter('')}
              >All</Button>
              {CATEGORIES.map(cat => (
                <Button
                  unstyled
                  key={cat.slug}
                  type="button"
                  className={`res-v3-filter-chip${categoryFilter === cat.slug ? ' active' : ''}`}
                  onClick={() => setCategoryFilter(categoryFilter === cat.slug ? '' : cat.slug)}
                  style={categoryFilter === cat.slug ? { borderColor: cat.color, color: cat.color, background: cat.accent } : {}}
                >
                  {cat.label}
                </Button>
              ))}
            </div>
            <div className="res-v3-filter-group">
              <span className="res-v3-filter-label">Length:</span>
              <Button
                unstyled
                type="button"
                className={`res-v3-filter-chip${!timeFilter ? ' active' : ''}`}
                onClick={() => setTimeFilter(null)}
              >Any</Button>
              {READING_TIME_FILTERS.map(f => (
                <Button
                  unstyled
                  key={f.label}
                  type="button"
                  className={`res-v3-filter-chip${timeFilter?.label === f.label ? ' active' : ''}`}
                  onClick={() => setTimeFilter(timeFilter?.label === f.label ? null : f as typeof timeFilter)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Results */}
        {showResults && (
          <div id="search-results" className="res-v3-search-results" role="listbox" aria-label="Search results">
            <div className="res-v3-results-meta">
              <span>{results.length} result{results.length !== 1 ? 's' : ''} for &ldquo;{query}&rdquo;</span>
              {results.length > 0 && <span style={{ color: 'var(--text-subtle)', fontSize: 12 }}>Use ↑↓ to navigate, Enter to open</span>}
            </div>
            {results.map((article, idx) => {
              const cat = getCategory(article.category)
              return (
                <Link
                  key={article.slug}
                  href={`/resources/${article.slug}`}
                  className={`res-v3-result-item${idx === activeIdx ? ' active' : ''}`}
                  role="option"
                  aria-selected={idx === activeIdx}
                  onMouseEnter={() => setActiveIdx(idx)}
                >
                  <div className="res-v3-result-content">
                    <div className="res-v3-result-cat" style={{ color: cat?.color }}>
                      {cat?.label} · {article.readingTime} min read
                    </div>
                    <div className="res-v3-result-title">{article.title}</div>
                    <div className="res-v3-result-excerpt">{article.description}</div>
                  </div>
                  <svg className="res-v3-result-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {showEmpty && (
          <div className="res-v3-search-empty">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-subtle)', marginBottom: 12 }} aria-hidden="true">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No results found</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              Try different keywords or{' '}
              {categoryFilter && <Button unstyled type="button" onClick={() => setCategoryFilter('')} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}>clear category filter</Button>}
            </p>
          </div>
        )}

        {/* Trending + tags — shown when no query */}
        {query.length < 1 && (
          <div className="res-v3-search-discover">
            <div className="res-v3-discover-section">
              <p className="res-v3-discover-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }}>
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                Trending searches
              </p>
              <div className="res-v3-discover-chips">
                {TRENDING_SEARCHES.map(s => (
                  <Button
                    unstyled
                    key={s}
                    type="button"
                    className="res-v3-trending-chip"
                    onClick={() => { setQuery(s); inputRef.current?.focus() }}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            </div>

            <div className="res-v3-discover-section">
              <p className="res-v3-discover-label">Popular topics</p>
              <div className="rc-tags-cloud">
                {topTags.map(({ tag, count }) => (
                  <Link key={tag} href={`/resources/tag/${tag}`} className="rc-tag">
                    #{tag}
                    <span style={{ opacity: 0.55, fontSize: 10, marginLeft: 3 }}>{count}</span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="res-v3-discover-section">
              <p className="res-v3-discover-label">Browse categories</p>
              <div className="res-v3-discover-cats">
                {CATEGORIES.map(cat => (
                  <Button
                    unstyled
                    key={cat.slug}
                    type="button"
                    className="res-v3-filter-chip"
                    onClick={() => { setCategoryFilter(cat.slug); inputRef.current?.focus() }}
                    style={{ borderColor: `${cat.color}30`, color: cat.color }}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
