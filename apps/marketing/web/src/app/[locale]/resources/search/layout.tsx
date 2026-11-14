import type { Metadata } from 'next'
import { localizeMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return localizeMetadata({
    title: 'Search resources',
    description: 'Find LetBuyy guides by topic and reading time.',
    robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
  }, (await params).locale, '/resources/search')
}

export default function Layout({ children }: { children: React.ReactNode }) { return children }
