'use client';

import { useId, useState } from 'react';
import Link from 'next/link';
import { Button, Drawer, Input, Select, ListFilter } from '@letbuyy/ui';

export interface CatalogFilterValues {
    query: string;
    category: string;
    pricing: string;
    sort: string;
    industry: string;
    layout: string;
    tag: string;
    feature: string;
    priceMin?: number;
    priceMax?: number;
}

interface Option { value: string; label: string }
interface CatalogFilterPanelProps {
    values: CatalogFilterValues;
    industries: string[];
    categories: Option[];
    pricing: Option[];
    layouts: string[];
    sorting: Option[];
    activeCount: number;
}

function FilterForm({ values, industries, categories, pricing, layouts, sorting }: CatalogFilterPanelProps) {
    const id = useId();
    return <form action="/themes" method="get" className="marketplace-filter-fields">
        <label className="marketplace-field" htmlFor={`${id}-search`}>Search themes<Input unstyled id={`${id}-search`} name="q" type="search" defaultValue={values.query} maxLength={80} placeholder="Name, style, or feature" /></label>
        <label className="marketplace-field" htmlFor={`${id}-sort`}>Sort by<Select unstyled id={`${id}-sort`} name="sort" defaultValue={values.sort} options={sorting} /></label>
        <label className="marketplace-field" htmlFor={`${id}-category`}>Theme category<Select unstyled id={`${id}-category`} name="category" defaultValue={values.category} options={categories} /></label>
        <label className="marketplace-field" htmlFor={`${id}-price`}>Price<Select unstyled id={`${id}-price`} name="pricing" defaultValue={values.pricing === 'one_time' ? 'paid' : values.pricing} options={[...pricing, {value:'subscription',label:'Subscription'}]} /></label>
        <label className="marketplace-field" htmlFor={`${id}-industry`}>Industry<Select unstyled id={`${id}-industry`} name="industry" defaultValue={values.industry} options={[{value:'',label:'All industries'},...Array.from(new Set([...industries,...(values.industry?[values.industry]:[])])).map(value=>({value,label:value.replaceAll('-',' ')}))]} /></label>
        <details className="catalog-filter-group" open={Boolean(values.layout||values.feature||values.tag)}><summary>Layout and features</summary><div><label className="marketplace-field" htmlFor={`${id}-layout`}>Layout<Select unstyled id={`${id}-layout`} name="layout" defaultValue={values.layout} options={[{value:'',label:'All layouts'},...Array.from(new Set([...layouts,...(values.layout?[values.layout]:[])])).map(value=>({value,label:value.replaceAll('-',' ')}))]} /></label><label className="marketplace-field" htmlFor={`${id}-feature`}>Feature<Input unstyled id={`${id}-feature`} name="feature" defaultValue={values.feature} maxLength={80} placeholder="For example, colour swatches" /></label><label className="marketplace-field" htmlFor={`${id}-tag`}>Style or tag<Input unstyled id={`${id}-tag`} name="tag" defaultValue={values.tag} maxLength={80} placeholder="For example, minimal" /></label></div></details>
        <details className="catalog-filter-group" open={values.priceMin!==undefined||values.priceMax!==undefined}><summary>Price range</summary>
        <div className="marketplace-filter-price-range">
            <label className="marketplace-field" htmlFor={`${id}-min`}>Min price (₹)<Input unstyled id={`${id}-min`} name="price_min" type="number" min={0} step={1} defaultValue={values.priceMin} placeholder="0" /></label>
            <label className="marketplace-field" htmlFor={`${id}-max`}>Max price (₹)<Input unstyled id={`${id}-max`} name="price_max" type="number" min={0} step={1} defaultValue={values.priceMax} placeholder="Any" /></label>
        </div>
        </details>
        <div className="marketplace-filter-actions"><Button type="submit">Apply filters</Button><Link className="marketplace-text-link" href="/themes">Clear all</Link></div>
    </form>;
}

export default function CatalogFilterPanel(props: CatalogFilterPanelProps) {
    const [open, setOpen] = useState(false);
    return <>
        <div className="marketplace-mobile-filter-trigger" data-testid="mobile-theme-filter-sheet">
            <Button variant="secondary" onClick={() => setOpen(true)} aria-haspopup="dialog" aria-expanded={open}><ListFilter size={16} aria-hidden="true" /> Filter and sort{props.activeCount > 0 ? ` (${props.activeCount})` : ''}</Button>
        </div>
        <aside className="marketplace-desktop-filter" aria-label="Theme filters"><div className="catalog-filter-heading"><h2>Refine your search</h2><p>Find a design around your content and budget.</p></div><FilterForm {...props} /></aside>
        <Drawer title="Filter and sort themes" description="Choose the price, style, and features your store needs." className="marketplace-filter-drawer" open={open} onClose={() => setOpen(false)} side="right" size="md"><FilterForm {...props} /></Drawer>
    </>;
}
