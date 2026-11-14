import { BRAND_SOCIAL_IMAGE } from '@/lib/brand-assets'
import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ResourcesNav from '@/components/resources/ResourcesNav'
import ResourcesScrollRestoration from '@/components/resources/ResourcesScrollRestoration'
import NewsletterModalHost from '@/components/resources/NewsletterModal'
import { localizeMetadata } from '@/lib/i18n/metadata'
import '../../resources.css'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return localizeMetadata({
    title: 'Resources — Commerce guides for Indian merchants',
    description: 'Guides, tutorials, API docs, and platform updates for Indian ecommerce merchants and developers.',
    openGraph: { type: 'website', images: [BRAND_SOCIAL_IMAGE] },
  }, (await params).locale, '/resources')
}

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="resources-shell">
      <ResourcesScrollRestoration />
      <Header />
      <ResourcesNav />
      <main style={{ paddingTop: 0 }}>{children}</main>
      <Footer />
      <NewsletterModalHost />
    </div>
  )
}
