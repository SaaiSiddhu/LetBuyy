'use client'

import Copy from '@/components/i18n/Copy'

import { usePathname, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useRef, type KeyboardEvent } from 'react'
import { ArrowRight, Button, Input, Search, X } from '@letbuyy/ui'
import { useCopy } from '@/components/i18n/useCopy'
import { localizeArticleSummary } from '@/lib/i18n/article-summary'
import Link from '@/components/i18n/LocaleLink'
import Image from 'next/image'
import ResourceArticleArtwork from '@/components/resources/ResourceArticleArtwork'
import { getEditorialScene } from '@/lib/resources/artwork'
import visualStyles from '@/components/resources/resource-list-visuals.module.css'
import { CATEGORIES, getCategory } from '@/lib/resources/categories'
import { ARTICLES } from '@/lib/resources/articles'
import {
  filterResourceArticles,
  getResourceResultPage,
  readResourceSearch,
  RESOURCE_READING_LENGTHS,
  RESOURCE_SUGGESTIONS,
} from '@/lib/resources/resource-search'

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="container res-v3-search-page" role="status"><Copy text={"Loading resource search…"} /></div>}>
      <ResourceSearch />
    </Suspense>
  )
}

function ResourceSearch() {
  const { t, locale } = useCopy()
  const params = useSearchParams()
  const pathname = usePathname()
  const state = readResourceSearch(params)
  const translatedArticles = ARTICLES.map(a => localizeArticleSummary(a, locale.language.code))
  const localMatches = filterResourceArticles(translatedArticles, state)
  const sourceMatches = filterResourceArticles(ARTICLES, state)
  const matchSlugs = new Set([...localMatches, ...sourceMatches].map(a => a.slug))
  const results = translatedArticles.filter(a => matchSlugs.has(a.slug))
  const resultPage = getResourceResultPage(results, state.page)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLUListElement>(null)
  const resultsHeadingRef = useRef<HTMLHeadingElement>(null)
  const hasFilters = Boolean(state.category || state.length)

  // Next integrates the native history API with search params. Replacing the
  // current entry keeps typing out of Back history and preserves the query on return.
  function updateSearch(changes: Record<string, string>, paging = false) {
    const next = new URLSearchParams(params.toString())
    if (!paging) next.delete('page')
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    const query = next.toString()
    window.history.replaceState(null, '', `${pathname}${query ? `?${query}` : ''}`)
  }

  function focusResults(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown' && resultsRef.current) {
      event.preventDefault()
      resultsRef.current.querySelector<HTMLAnchorElement>('a')?.focus()
    } else if (event.key === 'Escape') {
      inputRef.current?.blur()
    }
  }

  function navigateResults(event: KeyboardEvent<HTMLUListElement>) {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return
    const links = Array.from(event.currentTarget.querySelectorAll<HTMLAnchorElement>('a'))
    const current = links.findIndex(link => link === document.activeElement)
    if (current < 0) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      links[Math.min(current + 1, links.length - 1)]?.focus()
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (current === 0) inputRef.current?.focus()
      else links[current - 1]?.focus()
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      links[event.key === 'Home' ? 0 : links.length - 1]?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      inputRef.current?.focus()
    }
  }

  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && !event.altKey) {
        // A modal owns keyboard focus while open.
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) return
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function changePage(page: number) {
    updateSearch({ page: page === 1 ? '' : String(page) }, true)
    resultsHeadingRef.current?.focus()
  }

  const countText = state.query.trim() ? t('{count} guides for “{query}”', { count: results.length, query: state.query.trim() }) : t('{count} guides in the library', { count: results.length })

  return (
    <div className={`res-v3-search-page ${visualStyles.searchPage}`}>
      <div className="container res-search-container">
        <nav className="rc-article-breadcrumb res-search-breadcrumb" aria-label="Breadcrumb">
          <Link href="/resources"><Copy text={"Resources"} /></Link><span aria-hidden="true">›</span><span aria-current="page"><Copy text={"Search"} /></span>
        </nav>
        <div className={visualStyles.searchHeader}><div><h1 className="res-v3-search-heading"><Copy text={"Search resources"} /></h1>
        <p className="res-v3-search-sub"><Copy text={"Find guides, tutorials, and playbooks for Indian merchants"} /></p></div><Image src={getEditorialScene('search').thumbnailSrc} alt="" width={1536} height={1024} sizes="200px" loading="eager" unoptimized className={visualStyles.searchHero} /></div>

        <div className="res-v3-search-wrap" role="search" aria-label="Resource library">
          <div className="res-v3-search-input-row">
            <Search className="res-v3-search-icon" size={18} aria-hidden="true" />
            <Input
              unstyled
              ref={inputRef}
              className="res-v3-search-input"
              type="search"
              placeholder={t('Search articles, guides, topics…')}
              value={state.query}
              onChange={event => updateSearch({ q: event.target.value })}
              onKeyDown={focusResults}
              aria-label={t('Search resources')}
              aria-describedby="resource-search-help"
              aria-controls={results.length ? 'search-results' : undefined}
            />
            {state.query && (
              <Button unstyled type="button" className="res-v3-search-clear" aria-label={t('Clear search')}
                onClick={() => { updateSearch({ q: '' }); inputRef.current?.focus() }}>
                <X size={16} aria-hidden="true" />
              </Button>
            )}
            <kbd className="res-v3-kbd" aria-hidden="true">Ctrl / ⌘ K</kbd>
          </div>
          <p id="resource-search-help" className="res-search-help"><Copy text={"Use ↓ to reach results, ↑ / ↓ to browse, and Enter to open a guide."} /></p>

          <div className="res-v3-search-filters" role="group" aria-label="Filters">
            <div className="res-v3-filter-group" role="group" aria-label="Category">
              <span className="res-v3-filter-label"><Copy text={"Category:"} /></span>
              <Button unstyled type="button" className={`res-v3-filter-chip${!state.category ? ' active' : ''}`}
                aria-pressed={!state.category} onClick={() => updateSearch({ category: '' })}><Copy text={"All"} /></Button>
              {CATEGORIES.map(category => (
                <Button unstyled key={category.slug} type="button"
                  className={`res-v3-filter-chip${state.category === category.slug ? ' active' : ''}`}
                  aria-pressed={state.category === category.slug}
                  onClick={() => updateSearch({ category: category.slug })}>{t(category.label)}</Button>
              ))}
            </div>
            <div className="res-v3-filter-group" role="group" aria-label="Reading time">
              <span className="res-v3-filter-label"><Copy text={"Length:"} /></span>
              <Button unstyled type="button" className={`res-v3-filter-chip${!state.length ? ' active' : ''}`}
                aria-pressed={!state.length} onClick={() => updateSearch({ length: '' })}><Copy text={"Any"} /></Button>
              {RESOURCE_READING_LENGTHS.map(length => (
                <Button unstyled key={length.value} type="button"
                  className={`res-v3-filter-chip${state.length === length.value ? ' active' : ''}`}
                  aria-pressed={state.length === length.value}
                  onClick={() => updateSearch({ length: length.value })}>{t(length.label)}</Button>
              ))}
              {hasFilters && <Button unstyled type="button" className="res-search-reset"
                onClick={() => updateSearch({ category: '', length: '' })}><Copy text={"Clear filters"} /></Button>}
            </div>
          </div>
        </div>

        {!state.query.trim() && !hasFilters && (
          <div className="res-search-suggestions" role="group" aria-label="Suggested searches">
            <span><Copy text={"Try a topic"} /></span>
            {RESOURCE_SUGGESTIONS.map(query => (
              <Button unstyled key={query} type="button" className="res-v3-trending-chip"
                onClick={() => { updateSearch({ q: query }); inputRef.current?.focus() }}>{query}</Button>
            ))}
          </div>
        )}

        <div className="res-search-results-heading">
          <h2 ref={resultsHeadingRef} tabIndex={-1}><Copy text={"Guides"} /></h2>
          <p role="status" aria-live="polite" aria-atomic="true">{countText}</p>
        </div>

        {results.length > 0 ? (
          <>
            <ul id="search-results" ref={resultsRef} className="res-v3-search-results" aria-label="Resource guides" onKeyDown={navigateResults}>
              {resultPage.articles.map(article => (
                <li key={article.slug}>
                  <Link href={`/resources/${article.category}/${article.slug}`} className={`res-v3-search-result ${visualStyles.searchResult}`}>
                    <div className={visualStyles.searchArtwork}><ResourceArticleArtwork slug={article.slug} thumbnail /></div>
                    <div className="res-v3-result-body">
                      <p className="res-v3-result-meta">{t(getCategory(article.category)?.label ?? '')}<span aria-hidden="true">·</span>{article.readingTime} <Copy text={"min read"} /></p>
                      <h3 className="res-v3-result-title">{article.title}</h3>
                      <p className="res-v3-result-sub">{article.description}</p>
                    </div>
                    <ArrowRight className="res-v3-result-arrow" size={17} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ul>
            <nav className="res-search-pagination" aria-label="Search result pages">
              <span>{t('Showing {start}–{end} of {count}', { start: resultPage.start + 1, end: resultPage.start + resultPage.articles.length, count: results.length })}</span>
              {resultPage.pageCount > 1 && <div>
                <Button unstyled type="button" disabled={resultPage.page === 1} onClick={() => changePage(resultPage.page - 1)}><Copy text={"Previous"} /></Button>
                <span>{t('Page {page} of {count}', { page: resultPage.page, count: resultPage.pageCount })}</span>
                <Button unstyled type="button" disabled={resultPage.page === resultPage.pageCount} onClick={() => changePage(resultPage.page + 1)}><Copy text={"Next"} /></Button>
              </div>}
            </nav>
          </>
        ) : (
          <div className="res-v3-search-empty">
            <Search size={34} aria-hidden="true" />
            <h3><Copy text={"No matching guides"} /></h3>
            <p>{t(hasFilters ? 'Try a different topic or remove the reading-time and category filters.' : 'Try fewer words or a different topic.')}</p>
            {hasFilters && <Button unstyled type="button" className="res-search-reset" onClick={() => updateSearch({ category: '', length: '' })}><Copy text={"Clear filters"} /></Button>}
          </div>
        )}
      </div>
    </div>
  )
}
