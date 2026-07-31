import type { Metadata } from 'next'
import Header from '@/components/Header'
import Footer from '@/components/Footer'
import ResourcesNav from '@/components/resources/ResourcesNav'
import { getMarketingSiteUrl } from '@/lib/public-urls'

export const metadata: Metadata = {
  title: {
    default: 'Resources — Commerce guides for Indian merchants',
    template: '%s | LetBuyy Resources',
  },
  description: 'Guides, tutorials, API docs, and platform updates for Indian ecommerce merchants and developers.',
  metadataBase: new URL(getMarketingSiteUrl()),
  openGraph: {
    type: 'website',
    siteName: 'LetBuyy',
    locale: 'en_IN',
  },
}

export default function ResourcesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <ResourcesNav />
      <main style={{ paddingTop: 0 }}>{children}</main>
      <Footer />
    </>
  )
}
