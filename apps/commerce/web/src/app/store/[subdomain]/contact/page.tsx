// /store/[subdomain]/contact — Renders the Liquid `contact` template (contact-form.liquid).
//
// The section is a plain HTML form (no-JS: `action="/contact" method="post"`), so the POST target
// has to be this exact pathname. Next's App Router cannot have both a page.tsx and a route.ts at
// the same segment, so the POST is intercepted one layer up, in proxy.ts (handleContactSubmit),
// mirroring the existing /store-access/password pattern — it proxies to the EXISTING gateway
// endpoint POST /v1/contacts (contacts.ts, already public + already tenant-scoped by store_id),
// never writing to the database from this app. After submit, proxy.ts redirects back here with a
// `?contact=sent|error` query flag, read below only to render a plain confirmation line — the
// Liquid section itself has no success/error slot to fill (packages/theme-engine is out of scope
// for this phase).
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { StoreService } from '@/lib/store-service';
import { buildStoreMetadata } from '@/lib/seo';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import StorefrontCompositionEngine from '@/lib/theme-engine/composition-engine';
import type { SectionRenderData } from '@/lib/theme-engine/types';

type Props = {
    params: Promise<{ subdomain: string }>;
    searchParams?: Promise<{ contact?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return { title: 'Contact' };
    return buildStoreMetadata(store, {
        title: `Contact Us | ${store.name}`,
        description: `Get in touch with ${store.name}.`,
        path: '/contact',
    });
}

export default async function ContactPage({ params, searchParams }: Props) {
    const { subdomain } = await params;
    const query = await searchParams;
    const store = await StoreService.getStoreBySubdomain(subdomain);
    if (!store) return notFound();

    const plan = resolveStorefrontTemplate(store, {
        type: 'contact',
        templateKey: 'contact',
        path: `/store/${subdomain}/contact`,
        subdomain,
    });
    if (plan.liquidTemplateMiss) return notFound();

    return (
        <>
            {query?.contact === 'sent' && (
                <p role="status" className="lb-contact-status" style={{ padding: '16px', color: 'var(--text-secondary, rgb(107 114 128))' }}>
                    Thanks — your message has been sent.
                </p>
            )}
            {query?.contact === 'error' && (
                <p role="alert" className="lb-contact-status" style={{ padding: '16px', color: 'var(--text-secondary, rgb(107 114 128))' }}>
                    We could not send that message. Please check the form and try again.
                </p>
            )}
            <StorefrontCompositionEngine
                store={store}
                plan={plan}
                sectionData={new Map<string, SectionRenderData>()}
            />
        </>
    );
}
