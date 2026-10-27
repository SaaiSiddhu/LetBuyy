import StorefrontLanding from './storefront-landing';
import type { Metadata } from 'next';
import { createStorefrontApiClient } from '@/lib/api/client';

import type { StorefrontDirectoryPayload } from '@letbuyy/shared-types';

// ─── SEO Metadata ──────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'LetBuyy — Discover Stores Built by the Community',
  description:
    'Explore public stores built on LetBuyy. ' +
    'Find your favorite store or create your own.',
  openGraph: {
    title: 'LetBuyy — Discover Stores Built by the Community',
    description: 'Explore public LetBuyy stores or create your own.',
    url: 'https://storefront.letbuyy.com',
    siteName: 'LetBuyy',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LetBuyy — Discover Stores Built by the Community',
    description: 'Explore public LetBuyy stores or create your own.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

// Public eligibility is checked on every request; unavailable is not an empty directory.
export const dynamic = 'force-dynamic';

export default async function Home() {
  let directory: StorefrontDirectoryPayload | null = null;
  try {
    directory = await createStorefrontApiClient().storefront.directory();
  } catch {
    console.error(JSON.stringify({ event: 'storefront.directory_unavailable' }));
  }
  return <StorefrontLanding stores={directory?.stores ?? []} stats={directory?.stats ?? null} directoryAvailable={directory !== null} />;
}
