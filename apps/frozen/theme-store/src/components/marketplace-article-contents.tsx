import Link from 'next/link';
import { ChevronDown, ArrowLeft } from '@letbuyy/ui';

interface ContentsItem { id: string; title: string }
export default function MarketplaceArticleContents({ items, label, backHref, backLabel }: {
    items: ContentsItem[]; label: string; backHref: string; backLabel: string;
}) {
    const links = <ol>{items.map((item, index) => <li key={item.id}><a href={`#${item.id}`}><span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span>{item.title}</span></a></li>)}</ol>;
    const back = <Link href={backHref} className="marketplace-contents-back"><ArrowLeft size={14} aria-hidden="true" />{backLabel}</Link>;
    return <aside className="marketplace-contents marketplace-article-contents">
        <div className="marketplace-contents-desktop"><p>{label}</p><nav aria-label={label}>{links}</nav>{back}</div>
        <details className="marketplace-contents-mobile"><summary><span>{label}</span><span>{items.length} sections</span><ChevronDown size={16} aria-hidden="true" /></summary><nav aria-label={label}>{links}</nav>{back}</details>
    </aside>;
}
