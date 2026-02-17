import { createClient } from '@supabase/supabase-js';
import StorefrontLanding from './storefront-landing';
import type { Metadata } from 'next';

// ─── SEO Metadata ──────────────────────────────────────────────
export const metadata: Metadata = {
  title: 'LetBuyy — Discover Sites Built by the Community',
  description:
    'Explore stores, blogs, portfolios, resumes & landing pages built on LetBuyy. ' +
    'Find your favorite site or create your own in minutes.',
  openGraph: {
    title: 'LetBuyy — Discover Sites Built by the Community',
    description: 'Explore the LetBuyy community. Find sites or create your own.',
    url: 'https://storefront.letbuyy.store',
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

// ─── Email Masking ─────────────────────────────────────────────
function maskEmail(email: string): string {
  const atIndex = email.indexOf('@');
  if (atIndex === -1) return '••••@unknown';
  const local = email.substring(0, atIndex);
  const domain = email.substring(atIndex);
  const visible = local.slice(0, 2);
  const maskLength = Math.min(Math.max(local.length - 2, 1), 5);
  const masked = '••'.repeat(maskLength);
  return `${visible}${masked}${domain}`;
}

// ─── ISR: Revalidate every 5 minutes ──────────────────────────
export const revalidate = 300;

// ─── Page Component ────────────────────────────────────────────
export default async function Home() {
  let stores: any[] = [];
  let stats = {
    totalStores: 0,
    totalThemes: 0,
    totalProducts: 0,
    totalOrders: 0,
  };

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // 1. Fetch recent stores with owner info
    const { data: storesRaw } = await supabase
      .from('sites')
      .select(`
                store_name,
                name,
                logo_url,
                theme_id,
                status,
                site_type,
                created_at,
                users_custom!sites_custom_user_id_fkey (
                    full_name,
                    email
                )
            `)
      .in('status', ['draft', 'published'])
      .order('created_at', { ascending: false })
      .limit(12);

    // 2. Fetch platform stats (parallel queries)
    const [storesCount, themesCount, productsCount, ordersCount] =
      await Promise.all([
        supabase
          .from('sites')
          .select('*', { count: 'exact', head: true })
          .not('status', 'eq', 'suspended'),
        supabase
          .from('online_store_themes')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('products')
          .select('*', { count: 'exact', head: true }),
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true }),
      ]);

    // 3. Transform data
    stores = (storesRaw || []).map((s: any) => ({
      storeName: s.store_name,
      displayName: s.name || s.store_name,
      subdomain: s.store_name,
      logoUrl: s.logo_url,
      themeId: s.theme_id,
      status: s.status,
      siteType: s.site_type,
      createdAt: s.created_at,
      ownerName: s.users_custom?.full_name || null,
      maskedEmail: maskEmail(s.users_custom?.email || 'unknown@email.com'),
    }));

    stats = {
      totalStores: storesCount.count || 0,
      totalThemes: themesCount.count || 0,
      totalProducts: productsCount.count || 0,
      totalOrders: ordersCount.count || 0,
    };
  } catch (error) {
    console.error('[Landing] Data fetch failed:', error);
    // Page still renders with empty state
  }

  return <StorefrontLanding stores={stores} stats={stats} />;
}
