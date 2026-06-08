import { ChevronRight } from '@letbuyy/ui';
import Link from 'next/link';

interface MarketplaceBreadcrumb {
    label: string;
    href?: string;
}

export function MarketplaceBreadcrumbs({ items }: { items: MarketplaceBreadcrumb[] }) {
    return (
        <nav className="marketplace-breadcrumb" aria-label="Breadcrumb">
            <ol>
                {items.map((item, index) => {
                    const isLast = index === items.length - 1;
                    return (
                        <li key={`${item.label}-${index}`}>
                            {item.href && !isLast ? (
                                <Link href={item.href}>{item.label}</Link>
                            ) : (
                                <span aria-current={isLast ? 'page' : undefined}>{item.label}</span>
                            )}
                            {!isLast && <ChevronRight size={13} aria-hidden="true" />}
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
