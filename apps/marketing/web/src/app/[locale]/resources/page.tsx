import { localizeMetadata } from '@/lib/i18n/metadata'

import Copy from '@/components/i18n/Copy'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from '@/components/i18n/LocaleLink'
import { ArrowRight, BookOpen, ChevronDown, Search, BarChart3, Code2, IndianRupee, Package, Rocket, ShoppingBag, Sparkles, Input, Button, type LucideIcon } from '@letbuyy/ui'
import NewsletterInline from '@/components/resources/NewsletterInline'
import { ARTICLES, CATEGORIES, LEARNING_PATHS, getFeaturedArticles, getLatestArticles, getArticlesByCategory } from '@/lib/resources/utils'
import { getCategory } from '@/lib/resources/categories'
import { getLearningPathArticles } from '@/lib/resources/learning-path-articles'
import { getArticleArtwork, getEditorialScene, getLearningPathArtwork } from '@/lib/resources/artwork'
import ResourceArticleArtwork from '@/components/resources/ResourceArticleArtwork'
import { localizeArticleSummary } from '@/lib/i18n/article-summary'
import { createCopy } from '@/lib/i18n/copy'
import { getLocale } from '@/lib/i18n/locales'
import { localePath } from '@/lib/i18n/routing'
import styles from './resources-home.module.css'

const sourceMetadata: Metadata = {
  title: 'Resources — Commerce guides for Indian merchants',
  description: 'Practical guides for starting, running, and growing an online business in India. Explore store setup, payments, operations, and more.',
  alternates: { canonical: '/resources' },
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
    return localizeMetadata(sourceMetadata, (await params).locale, "/resources")
}


const ICONS: Record<string, LucideIcon> = { ShoppingBag, TrendingUp: BarChart3, IndianRupee, Package, Sparkles, Code2, Rocket }
const PICKS = ['upi-vs-cod-india', 'first-100-orders-guide', 'inventory-management-guide']
const TOPICS: Record<string, string> = {
  ecommerce: 'Build a better store', growth: 'Find your next customer', payments: 'Make sense of payments',
  operations: 'Keep orders moving', 'ai-commerce': 'Explore commerce AI', developers: 'Work with the platform', platform: 'Get to know LetBuyy',
}
const PATH_COPY: Record<string, string> = {
  'start-selling-online': 'Set up your store, add products, and prepare for your first sale.',
  'first-100-orders': 'Find customers and improve the journey from browsing to buying.',
  'payments-mastery': 'Understand UPI, COD, invoicing, and returns.',
  'scale-your-operations': 'Bring inventory, fulfilment, and shipping into a daily routine.',
  'developer-foundations': 'Read about APIs, webhooks, Liquid themes, and integrations.',
}

export default async function ResourcesPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = getLocale((await params).locale)
  const t = createCopy(locale.language.code)
  const sourceFeatured = getFeaturedArticles(1)[0]
  const featured = sourceFeatured && localizeArticleSummary(sourceFeatured, locale.language.code)
  const picks = PICKS.flatMap(slug => ARTICLES.find(a => a.slug === slug) ?? []).map(a => localizeArticleSummary(a, locale.language.code))
  const latest = getLatestArticles(3).map(a => localizeArticleSummary(a, locale.language.code))

  return (
    <div className={styles.page}>
      <section className={styles.intro} aria-labelledby="resources-title">
        <div className="container">
          <div className={styles.masthead}>
            <div>
              <p className={styles.eyebrow}><Copy text={"THE LETBUYY RESOURCE LIBRARY"} /></p>
              <h1 id="resources-title"><Copy text={"A little know-how."} /><br /><span><Copy text={"A better business."} /></span></h1>
              <p className={styles.introText}><Copy text={"Practical reading for every part of running an online store in India. Start with a question. Leave with a next step."} /></p>
            </div>
            <div className={styles.find}>
              <form action={localePath(locale, '/resources/search')} role="search" className={styles.search}>
                <label htmlFor="library-search"><Copy text={"What are you working on?"} /></label>
                <div className={styles.searchField}>
                  <Search size={19} aria-hidden="true" />
                  <Input unstyled id="library-search" name="q" type="search" placeholder={t('Search resources…')} />
                  <Button unstyled type="submit" aria-label={t('Search the resource library')}><ArrowRight size={20} aria-hidden="true" /></Button>
                </div>
              </form>
              <p className={styles.quickLinks}><Copy text={"Explore"} />{' '}<Link href="/resources/tag/upi">UPI</Link><Link href="/resources/tag/gst">GST</Link><Link href="/resources/tag/cod">COD</Link><Link href="/resources/tag/inventory"><Copy text={"Inventory"} /></Link></p>
              <span className={styles.libraryNote}>{t('{guides} guides · {topics} topics · Made for Indian merchants', { guides: ARTICLES.length, topics: CATEGORIES.length })}</span>
            </div>
          </div>

          <div className={styles.frontPage}>
            {featured && (
              <Link href={`/resources/${featured.category}/${featured.slug}`} className={styles.feature}>
                <div className={styles.featureCopy}>
                  <p className={styles.eyebrow}><BookOpen size={15} aria-hidden="true" /> <Copy text={"THE STARTING POINT"} /></p>
                  <h2>{featured.title}</h2>
                  <p>{featured.subtitle}</p>
                  <span className={styles.featureAction}><Copy text={"Read the guide"} />{' '}<ArrowRight size={17} aria-hidden="true" /><span>{featured.readingTime} <Copy text={"min read"} /></span></span>
                </div>
                <div className={styles.featureArt} aria-hidden="true">
                  <span className={styles.artCaption}><Copy text={"FROM AN IDEA TO YOUR FIRST ORDER"} /></span>
                  <Image src="/illustrations/journey/growth-commerce-v2.webp" alt="" width={640} height={640} sizes="(max-width: 600px) 40vw, (max-width: 1000px) 32vw, 300px" priority />
                  <span className={styles.artFoot}><Copy text={"Your next chapter starts here."} /></span>
                </div>
              </Link>
            )}
            <aside className={styles.picks} aria-labelledby="picks-title">
              <p className={styles.eyebrow}><Copy text={"ON THE READING LIST"} /></p>
              <h2 id="picks-title"><Copy text={"Small reads. Useful next steps."} /></h2>
              <ol>{picks.map((article, i) => {
                const artwork = getArticleArtwork(article.slug)
                return (
                <li key={article.slug}>
                  <Link href={`/resources/${article.category}/${article.slug}`}>
                    <span className={styles.pickArt} aria-hidden="true">{artwork && <Image src={artwork.thumbnailSrc} alt="" width={artwork.width} height={artwork.height} sizes="100px" loading="eager" unoptimized />}</span>
                    <span><small><span className={styles.pickNumber}>0{i + 1}</span>{t(getCategory(article.category)?.label ?? '')} · {article.readingTime} <Copy text={"min"} /></small><strong>{article.title}</strong></span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              )})}</ol>
            </aside>
          </div>
        </div>
      </section>

      <section className={styles.section} id="topics" aria-labelledby="topics-title">
        <div className="container">
          <div className={styles.sectionHead}>
            <div><p className={styles.eyebrow}><Copy text={"FIND YOUR FOCUS"} /></p><h2 id="topics-title"><Copy text={"What’s on your mind?"} /></h2></div>
            <p><Copy text={"Go straight to the part of your business"} /><br className={styles.desktopBreak} /> <Copy text={"you want to work on."} /></p>
          </div>
          <div className={styles.topicGrid}>
            {CATEGORIES.map(cat => {
              const Icon = ICONS[cat.icon] ?? BookOpen
              return <Link key={cat.slug} href={`/resources/${cat.slug}`} className={styles.topic}>
                <Icon size={23} strokeWidth={1.5} aria-hidden="true" />
                <span><strong>{t(cat.label)}</strong><span>{t(TOPICS[cat.slug])}</span></span>
                <small>{t('{count} guides', { count: getArticlesByCategory(cat.slug).length })}</small><ArrowRight size={17} aria-hidden="true" />
              </Link>
            })}
            <Link href="/resources/changelog" className={`${styles.topic} ${styles.topicUpdates}`}>
              <span className={styles.updateDot} aria-hidden="true" /><span><strong><Copy text={"What’s new at LetBuyy"} /></strong><span><Copy text={"Browse the changelog"} /></span></span><ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className={`${styles.section} ${styles.pathsSection}`} id="learning-paths" aria-labelledby="paths-title">
        <div className={`container ${styles.pathsLayout}`}>
          <div className={styles.pathsIntro}>
            <p className={styles.eyebrow}><Copy text={"ONE STEP AT A TIME"} /></p>
            <h2 id="paths-title"><Copy text={"A reading plan."} /><br /><Copy text={"For the road ahead."} /></h2>
            <p><Copy text={"Not sure where to begin? Pick a goal and follow a short sequence of guides, at your own pace."} /></p>
            <span className={styles.pathNote}><BookOpen size={17} aria-hidden="true" /> <Copy text={"No sign-up. Just start reading."} /></span>
            <Image className={styles.readingJourney} src={getEditorialScene('learning').src} alt="An illustrated reading journey from a field guide to a storefront and first parcel." width={1536} height={1024} sizes="(max-width: 760px) 85vw, 350px" loading="eager" unoptimized />
          </div>
          <div className={styles.paths}>
            {LEARNING_PATHS.map((path, i) => {
              const articles = getLearningPathArticles(path).map(a => localizeArticleSummary(a, locale.language.code))
              const total = articles.reduce((sum, a) => sum + a.readingTime, 0)
              const art = getLearningPathArtwork(path.slug)
              return <details className={styles.path} key={path.slug} name="reading-plan" open={i === 0}>
                <summary>
                  {art && <span className={styles.pathArt} aria-hidden="true"><Image src={art.thumbnailSrc} alt="" width={art.width} height={art.height} sizes="110px" loading="eager" unoptimized /></span>}
                  <span className={styles.pathHeading}><strong><span className={styles.pathNumber}>0{i + 1}</span>{t(path.title)}</strong><small>{t('{count} guides', { count: articles.length })} · {total} {t('min')} · {t(path.level)}</small></span>
                  <ChevronDown size={19} className={styles.chevron} aria-hidden="true" />
                </summary>
                <div className={styles.pathBody}>
                  <p>{t(PATH_COPY[path.slug])}</p>
                  <ol>{articles.map((article, index) => {
                    const articleArt = getArticleArtwork(article.slug)
                    return <li key={article.slug}>
                    <Link href={`/resources/${article.category}/${article.slug}`}>
                      {articleArt && <span className={styles.pathGuideArt} aria-hidden="true"><Image src={articleArt.thumbnailSrc} alt="" width={articleArt.width} height={articleArt.height} sizes="80px" loading="eager" unoptimized /></span>}
                      <span className={styles.pathGuideCopy}><small><Copy text={"GUIDE"} />{' '}{String(index + 1).padStart(2, '0')} · {article.readingTime} <Copy text={"min"} /></small><strong>{article.title}</strong></span>
                      <ArrowRight size={14} aria-hidden="true" /></Link>
                  </li>})}</ol>
                </div>
              </details>
            })}
          </div>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="latest-title">
        <div className="container">
          <div className={styles.sectionHead}>
            <div><p className={styles.eyebrow}><Copy text={"FROM THE LIBRARY"} /></p><h2 id="latest-title"><Copy text={"More to get into."} /></h2></div>
            <Link href="/resources/search" className={styles.textLink}><Copy text={"Browse all guides"} />{' '}<ArrowRight size={17} aria-hidden="true" /></Link>
          </div>
          <div className={styles.articles}>{latest.map(article => <article key={article.slug}>
            <Link href={`/resources/${article.category}/${article.slug}`}>
              <ResourceArticleArtwork slug={article.slug} thumbnail />
              <span className={styles.articleMeta}>{t(getCategory(article.category)?.label ?? '')}<span>{article.readingTime} <Copy text={"min read"} /></span></span>
              <h3>{article.title}</h3><p>{article.subtitle}</p><span className={styles.textLink}><Copy text={"Read article"} />{' '}<ArrowRight size={16} aria-hidden="true" /></span>
            </Link>
          </article>)}</div>
          <div className={styles.follow}>
            <div><p className={styles.eyebrow}><Copy text={"KEEP A GOOD THING GOING"} /></p><h2><Copy text={"A place in your reading routine."} /></h2><p><Copy text={"Follow new guides and platform updates."} /></p></div>
            <div className={styles.followAction}><NewsletterInline /></div>
          </div>
        </div>
      </section>
    </div>
  )
}
