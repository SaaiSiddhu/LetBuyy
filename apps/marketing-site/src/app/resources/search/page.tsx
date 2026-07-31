'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
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
            <input
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
              <button
                type="button"
                className="res-v3-search-clear"
                onClick={() => { setQuery(''); inputRef.current?.focus() }}
                aria-label="Clear search"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
            <kbd className="res-v3-kbd" aria-label="Keyboard shortcut: Command K">⌘K</kbd>
          </div>

          {/* Filters */}
          <div className="res-v3-search-filters" role="group" aria-label="Filters">
            <div className="res-v3-filter-group">
              <span className="res-v3-filter-label">Category:</span>
              <button
                type="button"
                className={`res-v3-filter-chip${!categoryFilter ? ' active' : ''}`}
                onClick={() => setCategoryFilter('')}
              >All</button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.slug}
                  type="button"
                  className={`res-v3-filter-chip${categoryFilter === cat.slug ? ' active' : ''}`}
                  onClick={() => setCategoryFilter(categoryFilter === cat.slug ? '' : cat.slug)}
                  style={categoryFilter === cat.slug ? { borderColor: cat.color, color: cat.color, background: cat.accent } : {}}
                >
                  {cat.label}
                </button>
              ))}
            </div>
            <div className="res-v3-filter-group">
              <span className="res-v3-filter-label">Length:</span>
              <button
                type="button"
                className={`res-v3-filter-chip${!timeFilter ? ' active' : ''}`}
                onClick={() => setTimeFilter(null)}
              >Any</button>
              {READING_TIME_FILTERS.map(f => (
                <button
                  key={f.label}
                  type="button"
                  className={`res-v3-filter-chip${timeFilter?.label === f.label ? ' active' : ''}`}
                  onClick={() => setTimeFilter(timeFilter?.label === f.label ? null : f as typeof timeFilter)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Results count */}
        {query.length >= 1 && (
          <p className="res-v3-search-count" aria-live="polite">
            {showResults
              ? `${results.length} result${results.length !== 1 ? 's' : ''} for "${query}"`
              : `No results for "${query}"`
            }
            {(categoryFilter || timeFilter) && ' (filtered)'}
          </p>
        )}

        {/* Results list */}
        {showResults && (
          <div id="search-results" className="res-v3-search-results" role="listbox" aria-label="Search results">
            {results.slice(0, 12).map((article, i) => {
              const cat = getCategory(article.category)!
              return (
                <Link
                  key={article.slug}
                  href={`/resources/${article.category}/${article.slug}`}
                  className={`res-v3-search-result${activeIdx === i ? ' highlighted' : ''}`}
                  role="option"
                  aria-selected={activeIdx === i}
                >
                  <div className="res-v3-result-accent" style={{ background: cat.color }} aria-hidden="true" />
                  <div className="res-v3-result-body">
                    <div className="res-v3-result-meta">
                      <span className="rc-card-chip" style={{ background: cat.accent, color: cat.color }}>{cat.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{article.readingTime} min read</span>
                    </div>
                    <p className="res-v3-result-title">{article.title}</p>
                    <p className="res-v3-result-sub">{article.subtitle}</p>
                  </div>
                  <svg className="res-v3-result-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" />
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
              {categoryFilter && <button type="button" onClick={() => setCategoryFilter('')} style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: 0 }}>clear category filter</button>}
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
                  <button
                    key={s}
                    type="button"
                    className="res-v3-trending-chip"
                    onClick={() => { setQuery(s); inputRef.current?.focus() }}
                  >
                    {s}
                  </button>
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
                  <button
                    key={cat.slug}
                    type="button"
                    className="res-v3-filter-chip"
                    onClick={() => { setCategoryFilter(cat.slug); inputRef.current?.focus() }}
                    style={{ borderColor: `${cat.color}30`, color: cat.color }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
