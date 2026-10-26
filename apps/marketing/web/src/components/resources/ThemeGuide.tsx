
import Copy from '@/components/i18n/Copy'
import Image from 'next/image'
import { ArrowRight, Check, Eye, LayoutGrid, Monitor, Palette, Smartphone } from '@letbuyy/ui'
import { resourceHeadingId } from '@/lib/resources/headings'
import type { ContentBlock } from '@/lib/resources/types'
import { THEME_ARTWORK, SECTION_ARTWORK } from '@/lib/resources/artwork'
import ArticleBody from './ArticleBody'
import styles from './theme-guide.module.css'

const STOREFRONTS = Object.values(THEME_ARTWORK)

/** Decorative storefront studies, not previews of purchasable themes. */
function StorefrontStudy({ variant = 0 }: { variant?: number }) {
  return (
    <div className={styles.study} aria-hidden="true">
      <Image src={STOREFRONTS[variant % STOREFRONTS.length]} alt="" width={1536} height={1024} sizes="(max-width: 699px) 90vw, 480px" loading="eager" unoptimized />
    </div>
  )
}

export function ThemeGuideHero() {
  return (
    <figure className={styles.heroArtwork}>
      <div className={styles.heroArtCanvas} aria-hidden="true">
        <span className={styles.artIndex}><Copy text={"THE STOREFRONT DESIGN STUDIO"} /></span>
        <Image src={THEME_ARTWORK.custom} alt="" width={1536} height={1024} sizes="(max-width: 700px) 90vw, 520px" priority unoptimized className={styles.heroImage} />
        <div className={styles.artNote}><Palette size={16} /><span><Copy text={"Your brand."} /><br /><strong><Copy text={"Every detail."} /></strong></span></div>
        <div className={styles.artSwatches}><i /><i /><i /><i /><i /></div>
      </div>
      <figcaption><Copy text={"One design layer. A storefront that feels like you."} /></figcaption>
    </figure>
  )
}

function EditorIllustration() {
  return (
    <figure className={styles.editorFigure}>
      <div className={styles.editor} aria-hidden="true">
        <div className={styles.editorToolbar}><span><Monitor size={14} /> <Copy text={"Desktop preview"} /></span><Smartphone size={15} /><span className={styles.draftLabel}><Copy text={"Draft"} /></span></div>
        <div className={styles.editorWorkspace}>
          <div className={styles.editorPreview}><StorefrontStudy /></div>
          <div className={styles.editorSettings}><span><Copy text={"Customize"} /></span><strong><Copy text={"Make it your own"} /></strong><label><Copy text={"COLORS"} /></label><div className={styles.editorSwatches}><i /><i /><i /></div><label><Copy text={"TYPOGRAPHY"} /></label><b>Aa <small><Copy text={"Brand type"} /></small></b><label><Copy text={"SECTIONS"} /></label>{['Header', 'Hero image', 'Product grid'].map(label => <div className={styles.editorLayer} key={label}><LayoutGrid size={12} /><Copy text={label} /><Eye size={12} /></div>)}</div>
        </div>
      </div>
      <figcaption><Copy text={"Illustrative editor layout · preview on the left, customization on the right."} /></figcaption>
    </figure>
  )
}

function SectionIllustration() {
  return (
    <div className={styles.sectionIllustration} aria-hidden="true">
      {SECTION_ARTWORK.map(({ label, src }, index) => (
        <div className={styles.sectionTile} key={label}><span>{String(index + 1).padStart(2, '0')}<LayoutGrid size={15} /></span><div className={styles.sectionArtwork}><Image src={src} alt="" width={1536} height={1024} sizes="(max-width: 699px) 45vw, 260px" loading="eager" unoptimized /></div><b><Copy text={label} /></b></div>
      ))}
    </div>
  )
}

function PublishingIllustration() {
  return (
    <ol className={styles.publishFlow} aria-label="Theme publishing stages">
      {[
        { label: 'Draft', detail: 'Only you', icon: Palette },
        { label: 'Preview', detail: 'Your team', icon: Eye },
        { label: 'Published', detail: 'Your visitors', icon: Check },
      ].map(({ label, detail, icon: Icon }, index) => <li key={label}><span className={styles.flowIcon}><Icon size={20} /></span><strong><Copy text={label} /></strong><span><Copy text={detail} /></span>{index < 2 && <ArrowRight className={styles.flowArrow} size={18} aria-hidden="true" />}</li>)}
    </ol>
  )
}

/** The article remains the content authority; sections retain every original block. */
export function ThemeGuideContent({ body }: { body: ContentBlock[] }) {
  const sections: Array<{ id: string; heading: string; blocks: ContentBlock[] }> = []
  const introduction: ContentBlock[] = []
  for (const block of body) {
    if (block.type === 'h2') sections.push({ id: block.id ?? resourceHeadingId(block.text), heading: block.text, blocks: [block] })
    else if (sections.length) sections[sections.length - 1].blocks.push(block)
    else introduction.push(block)
  }

  return (
    <div id="article-body" className={styles.content}>
      <div className={styles.introduction}><span className={styles.eyebrow}><Copy text={"Designed around your business"} /></span><ArticleBody body={introduction} id="theme-guide-introduction" /></div>
      {sections.map((section, index) => (
        <section key={section.heading} className={styles.chapter} aria-labelledby={section.id}>
          <div className={styles.chapterEyebrow}><span>{String(index + 1).padStart(2, '0')}</span><span><Copy text={["Choose your foundation", "Make it your own", "Build your pages", "Bring it to life"][index]} /></span></div>
          {section.id === 'theme-types' ? (
            <>
              <ArticleBody body={section.blocks.filter(block => block.type !== 'ul')} id={`theme-guide-section-${index}`} />
              {section.blocks.filter((block): block is Extract<ContentBlock, { type: 'ul' }> => block.type === 'ul').map((block, listIndex) => (
                <ul className={styles.typeGrid} key={listIndex}>{block.items.map((item, itemIndex) => {
                  const separator = item.indexOf(':') + 1
                  return <li key={item}><StorefrontStudy variant={itemIndex} /><p><strong>{item.slice(0, separator)}</strong>{item.slice(separator)}</p></li>
                })}</ul>
              ))}
            </>
          ) : (
            <>
              <ArticleBody body={section.blocks.slice(0, 1)} id={`theme-guide-heading-${index}`} />
              {section.id === 'the-theme-editor' && <EditorIllustration />}
              {section.id === 'sections-modular-page-building' && <SectionIllustration />}
              {section.id === 'publishing-changes' && <PublishingIllustration />}
              <div className={section.id === 'the-theme-editor' ? styles.editorCopy : undefined}><ArticleBody body={section.blocks.slice(1)} id={`theme-guide-section-${index}`} /></div>
            </>
          )}
        </section>
      ))}
    </div>
  )
}
