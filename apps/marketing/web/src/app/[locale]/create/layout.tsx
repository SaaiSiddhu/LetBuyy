import type { Metadata } from 'next'
import { localizeMetadata } from '@/lib/i18n/metadata'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return localizeMetadata({
    title: 'Create your site',
    description: 'Choose a site type and continue to your LetBuyy account.',
    robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
  }, (await params).locale, '/create')
}

export default function Layout({ children }: { children: React.ReactNode }) { return children }
