import Link from 'next/link';
import { Accordion } from '@letbuyy/ui';
import type { MarketplaceFaq } from '@/lib/marketplace-content';

export default function MarketplaceFaqs({ items, expanded = false }: { items: MarketplaceFaq[]; expanded?: boolean }) {
    return <Accordion multiple defaultValue={expanded ? items.map(item => item.id) : []} items={items.map(item => ({
        id: item.id, title: item.question,
        content: <div className="marketplace-faq-answer"><p>{item.answer}</p><Link className="marketplace-text-link" href={item.href}>{item.linkLabel}</Link></div>,
    }))} />;
}
