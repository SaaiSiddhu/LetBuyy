import { Input, Button } from '@letbuyy/ui';
import type { StorefrontRouteContext } from './types';

export function StorefrontProductOriginFilter({
    route,
    editorMode = false,
}: {
    route: StorefrontRouteContext;
    editorMode?: boolean;
}) {
    if (editorMode || (route.type !== 'collection' && route.type !== 'search')) return null;

    const pathname = (route.path || '/').split('?')[0] || '/';
    const currentOrigin = route.searchParams?.country_of_origin || '';
    const preserved: [string, string][] = [];
    for (const key of ['search', 'category', 'page']) {
        const value = route.searchParams?.[key];
        if (value) preserved.push([key, value]);
    }
    const clearParams = new URLSearchParams(preserved);
    const clearHref = clearParams.size > 0 ? `${pathname}?${clearParams.toString()}` : pathname;

    return (
        <section className="lb-collection-filter" aria-label="Filter products by country of origin">
            <form className="lb-collection-filter__form" method="get" action={pathname}>
                {preserved.map(([name, value]) => <Input unstyled key={name} type="hidden" name={name} value={value} />)}
                <label className="lb-collection-filter__label" htmlFor="lb-product-origin-filter">Country of origin</label>
                <Input unstyled
                    id="lb-product-origin-filter"
                    className="lb-collection-filter__input"
                    name="country_of_origin"
                    type="text"
                    autoComplete="off"
                    maxLength={100}
                    defaultValue={currentOrigin}
                    placeholder="Enter a country"
                />
                <Button unstyled className="lb-collection-filter__submit" type="submit">Apply filter</Button>
                {currentOrigin && <a className="lb-collection-filter__clear" href={clearHref}>Clear origin filter</a>}
            </form>
        </section>
    );
}
