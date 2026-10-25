
import Copy from '@/components/i18n/Copy'
import Image from 'next/image'
import { ArrowRight, Code2, FileText, Globe, LayoutGrid, Package, ShoppingBag, Store, Users } from '@letbuyy/ui'
import { resourceHeadingId } from '@/lib/resources/headings'
import type { ContentBlock } from '@/lib/resources/types'
import { SECTION_ARTWORK } from '@/lib/resources/artwork'
import ArticleBody from './ArticleBody'
import styles from './liquid-guide.module.css'

function TemplateFlow({ filter = false }: { filter?: boolean }) {
  return (
    <figure className={styles.templateFlow}>
      <div className={styles.flowPanel}><span><Code2 size={16} aria-hidden="true" /><Copy text={filter ? "Apply a filter" : "Read store data"} /></span><code>{filter ? '{{ product.title | upcase }}' : '{{ product.title }}'}</code></div>
      <ArrowRight className={styles.flowArrow} size={22} aria-hidden="true" />
      <div className={`${styles.flowPanel} ${styles.outputPanel}`}><span><Copy text={"Illustrative storefront output"} /></span><strong><Copy text={filter ? "CERAMIC VASE" : "Ceramic Vase"} /></strong></div>
      <figcaption><Copy text={filter ? "The filter transforms the display value." : "A template expression becomes storefront content."} /> <Copy text={"Example data."} /></figcaption>
    </figure>
  )
}

function ArchitectureIllustration() {
  return (
    <figure className={styles.architecture}>
      <div className={styles.architectureHeader}><FileText size={18} aria-hidden="true" /><span><Copy text={"One theme. Reusable layers."} /></span></div>
      <ol>{[
        ['layout', 'The page shell'],
        ['templates', 'The page type'],
        ['sections', 'The configurable blocks'],
        ['snippets', 'The reusable details'],
      ].map(([name, detail], index) => <li key={name}><span className={styles.layerNumber}>{String(index + 1).padStart(2, '0')}</span><code>{name}/</code><span><Copy text={detail} /></span>{index < 3 && <ArrowRight size={16} aria-hidden="true" />}</li>)}</ol>
      <figcaption><Copy text={"An illustrated map of the theme files described below."} /></figcaption>
    </figure>
  )
}

function SectionIllustrations() {
  return (
    <div className={styles.sectionGallery}>
      {[SECTION_ARTWORK[0], SECTION_ARTWORK[2]].map(art => <figure key={art.src}><Image src={art.src} alt="" width={1536} height={1024} sizes="(max-width: 600px) 90vw, 420px" loading="eager" unoptimized /><figcaption><LayoutGrid size={15} aria-hidden="true" /><Copy text={art.label} /><span><Copy text={"Configurable section illustration"} /></span></figcaption></figure>)}
    </div>
  )
}

const OBJECT_ICONS = [Package, LayoutGrid, ShoppingBag, Users, Store, Globe]

function ObjectCards({ items }: { items: string[] }) {
  return (
    <ul className={styles.objectCards}>{items.map((item, index) => {
      const Icon = OBJECT_ICONS[index % OBJECT_ICONS.length]
      const separator = item.indexOf(' — ')
      return <li key={item}><Icon size={20} aria-hidden="true" /><p>{separator < 0 ? item : <><code>{item.slice(0, separator)}</code>{item.slice(separator)}</>}</p></li>
    })}</ul>
  )
}

/** Composes the existing article blocks without changing prose, code, or anchors. */
export default function LiquidGuide({ body }: { body: ContentBlock[] }) {
  const introduction: ContentBlock[] = []
  const chapters: Array<{ id: string; heading: string; blocks: ContentBlock[] }> = []
  for (const block of body) {
    if (block.type === 'h2') chapters.push({ id: block.id ?? resourceHeadingId(block.text), heading: block.text, blocks: [block] })
    else if (chapters.length) chapters[chapters.length - 1].blocks.push(block)
    else introduction.push(block)
  }

  return (
    <div className={styles.body} id="article-body">
      <div className={styles.introduction}><span className={styles.kicker}><Copy text={"The developer’s field guide"} /></span><ArticleBody body={introduction} id="liquid-guide-introduction" /></div>
      {chapters.map((chapter, index) => (
        <section className={styles.chapter} key={chapter.heading}>
          <p className={styles.chapterLabel}><span>{String(index + 1).padStart(2, '0')}</span><Copy text={["Write the template", "Work with store data", "Shape the output", "Organise the theme", "Hand control to the merchant"][index]} /></p>
          <ArticleBody body={chapter.blocks.slice(0, 1)} id={`liquid-guide-heading-${index}`} />
          {chapter.id === 'liquid-syntax-basics' && <TemplateFlow />}
          {chapter.id === 'useful-filters' && <TemplateFlow filter />}
          {chapter.id === 'theme-architecture' && <ArchitectureIllustration />}
          {chapter.id === 'sections-the-merchant-customization-layer' && <SectionIllustrations />}
          {chapter.blocks.slice(1).map((block, blockIndex) => chapter.id === 'core-liquid-objects' && block.type === 'ul' ? <ObjectCards items={block.items} key={blockIndex} /> : <ArticleBody key={blockIndex} body={[block]} id={`liquid-guide-block-${index}-${blockIndex}`} />)}
        </section>
      ))}
    </div>
  )
}
