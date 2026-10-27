// /store/[subdomain]/customers/register — Dedicated register page for Liquid-engine stores.
// The dedicated page exists so the Liquid theme can offer canonical buyer sign-in/registration at
// this store's account entry point. Existing per-store password customers can still use login and
// link their verified account from settings.
import { notFound, redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { StoreService } from '@/lib/store-service';
import { buildStoreMetadata } from '@/lib/seo';

export const revalidate = 60;

type Props = {
    params: Promise<{ subdomain: string }>;
    searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return { title: 'Create Account' };
    return buildStoreMetadata(store, {
        title: `Create Account | ${store.name}`,
        description: `Create a ${store.name} account.`,
        path: '/customers/register',
    });
}

export default async function CustomerRegisterPage({ params }: Props) {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return notFound();
    redirect(`/api/buyer-auth/start?${new URLSearchParams({screen:'register',return_to:`/store/${subdomain}/account`})}`);

}
