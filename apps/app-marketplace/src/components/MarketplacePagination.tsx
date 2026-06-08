import Link from 'next/link';

type PageToken = number | 'ellipsis';

interface MarketplacePaginationProps {
    basePath: string;
    currentPage: number;
    query?: Record<string, string | number | string[] | undefined>;
    totalPages: number;
}

function clampPage(page: number, totalPages: number): number {
    return Math.min(Math.max(page, 1), Math.max(totalPages, 1));
}

function pageTokens(currentPage: number, totalPages: number): PageToken[] {
    const current = clampPage(currentPage, totalPages);
    const pages = new Set<number>([1, totalPages, current - 1, current, current + 1]);

    if (current <= 4) {
        pages.add(2);
        pages.add(3);
        pages.add(4);
    }

    if (current >= totalPages - 3) {
        pages.add(totalPages - 1);
        pages.add(totalPages - 2);
        pages.add(totalPages - 3);
    }

    const sortedPages = Array.from(pages)
        .filter((page) => page >= 1 && page <= totalPages)
        .sort((a, b) => a - b);

    const tokens: PageToken[] = [];
    for (const page of sortedPages) {
        const previous = tokens[tokens.length - 1];
        if (typeof previous === 'number' && page - previous > 1) {
            tokens.push('ellipsis');
        }
        tokens.push(page);
    }

    return tokens;
}

function pageHref(basePath: string, page: number, query: MarketplacePaginationProps['query']): string {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query ?? {})) {
        if (value === undefined || value === '') continue;
        if (Array.isArray(value)) {
            for (const item of value) {
                if (item) params.append(key, item);
            }
            continue;
        }
        params.set(key, String(value));
    }

    if (page > 1) {
        params.set('page', String(page));
    } else {
        params.delete('page');
    }

    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
}

export function MarketplacePagination({
    basePath,
    currentPage,
    query,
    totalPages,
}: MarketplacePaginationProps) {
    if (totalPages <= 1) return null;

    const current = clampPage(currentPage, totalPages);
    const previousPage = clampPage(current - 1, totalPages);
    const nextPage = clampPage(current + 1, totalPages);
    const tokens = pageTokens(current, totalPages);

    return (
        <nav className="marketplace-pagination marketplace-pagination--numbered" aria-label="Pagination">
            <Link
                className={`marketplace-pagination__control ${current === 1 ? 'marketplace-pagination__control--disabled' : ''}`}
                href={pageHref(basePath, previousPage, query)}
                aria-disabled={current === 1}
                tabIndex={current === 1 ? -1 : undefined}
            >
                Previous
            </Link>

            <ol className="marketplace-pagination__pages">
                {tokens.map((token, index) => {
                    if (token === 'ellipsis') {
                        return (
                            <li key={`ellipsis-${index}`} aria-hidden="true" className="marketplace-pagination__ellipsis">
                                ...
                            </li>
                        );
                    }

                    const active = token === current;
                    return (
                        <li key={token}>
                            <Link
                                href={pageHref(basePath, token, query)}
                                aria-current={active ? 'page' : undefined}
                                className={active ? 'active' : undefined}
                            >
                                {token}
                            </Link>
                        </li>
                    );
                })}
            </ol>

            <Link
                className={`marketplace-pagination__control ${current === totalPages ? 'marketplace-pagination__control--disabled' : ''}`}
                href={pageHref(basePath, nextPage, query)}
                aria-disabled={current === totalPages}
                tabIndex={current === totalPages ? -1 : undefined}
            >
                Next
            </Link>
        </nav>
    );
}
