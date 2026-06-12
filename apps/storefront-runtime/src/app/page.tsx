import StorefrontLanding from './storefront-landing';
import type { Metadata } from 'next';
import { createStorefrontApiClient } from '@/lib/api/client';

type StoreShowcase = {
  storeName: string;
  displayName: string;
  subdomain: string;
  logoUrl: string | null;
  themeId: string | null;
  status: 'draft' | 'published';
  siteType: string;
  createdAt: string;
  ownerName: string | null;
  maskedEmail: string;
};

// ─── SEO Metadata ──────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'LetBuyy — Discover Sites Built by the Community',
  description:
    'Explore stores, blogs, portfolios, resumes & landing pages built on LetBuyy. ' +
    'Find your favorite site or create your own in minutes.',
  openGraph: {
    title: 'LetBuyy — Discover Sites Built by the Community',
    description: 'Explore the LetBuyy community. Find sites or create your own.',
    url: 'https://storefront.letbuyy.com',
    siteName: 'LetBuyy',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LetBuyy — Discover Sites Built by the Community',
    description: 'Explore the LetBuyy community. Find sites or create your own.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

// ─── ISR: Revalidate every 5 minutes ──────────────────────────
export const revalidate = 300;
export const dynamic = 'force-dynamic';

// ─── Page Component ────────────────────────────────────────────
export default async function Home() {
  let stores: StoreShowcase[] = [];
  let stats = {
    totalStores: 0,
    totalThemes: 0,
    totalProducts: 0,
    totalOrders: 0,
  };

  try {
    const directory = await createStorefrontApiClient().storefront.directory();
    const storesRaw = directory.stores;

    stores = storesRaw.map((s: Record<string, unknown>) => {
      return {
        storeName: (s.store_name as string) || '',
        displayName: ((s.name || s.store_name) as string) || '',
        subdomain: (s.store_name as string) || '',
        logoUrl: (s.logo_url as string) || null,
        themeId: (s.theme_id as string) || null,
        status: s.status === 'draft' ? 'draft' : 'published',
        siteType: (s.site_type as string) || 'store',
        createdAt: (s.created_at as string) || new Date(0).toISOString(),
        ownerName: null,
        maskedEmail: '••••',
      };
    });

    stats = { ...stats, ...(directory.stats || {}) };
  } catch (error) {
    console.error('[Landing] Data fetch failed:', error);
    // Page still renders with empty state
  }

  return <StorefrontLanding stores={stores} stats={stats} />;
}
