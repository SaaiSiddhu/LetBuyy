'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useId, useState } from 'react';
import { ArrowRight, Input, Menu } from '@letbuyy/ui';
import type { Theme } from '@letbuyy/theme-engine';
import { formatThemePrice } from '@/lib/utils';

const STUDIES = [
    { id: 'living', name: 'Considered living', subject: 'Home & interiors', headline: 'Objects with a little more meaning.', copy: 'Warm photography, generous space, and an editorial approach to a home collection.' },
    { id: 'wardrobe', name: 'Everyday studio', subject: 'Fashion & apparel', headline: 'Good pieces. Your own story.', copy: 'A collection-led direction with clear product discovery and confident, simple typography.' },
    { id: 'care', name: 'Daily ritual', subject: 'Beauty & wellness', headline: 'A little care, every day.', copy: 'An image-led direction for product stories, considered ingredients, and everyday rituals.' },
] as const;

function StyleStudyPreview({ study }: { study: typeof STUDIES[number] }) {
    return <span className="theme-style-sample" data-look={study.id} aria-hidden="true">
        <span className="theme-style-mini-nav"><b>{study.name}</b><span>Shop&nbsp;&nbsp; Journal&nbsp;&nbsp; <Menu size={10} /></span></span>
        <span className="theme-style-mini-hero"><Image src={`/showcase/${study.id}.webp`} alt="" fill sizes="280px" /><span><small>{study.subject}</small><strong>{study.headline}</strong><span>Explore the collection ↗</span></span></span>
        <span className="theme-style-mini-title"><b>The everyday edit</b><span>View all ↗</span></span>
        <span className="theme-style-mini-products">{[`${study.id}-detail`, study.id].map((photo,index)=><span key={photo}><span><Image src={`/showcase/${photo}.webp`} alt="" fill sizes="140px" /></span><span>{index ? 'Made for everyday' : 'The considered collection'}</span></span>)}</span>
        <span className="theme-style-mini-story"><span>A little detail makes all the difference.</span><Image src={`/showcase/${study.id}-detail.webp`} alt="" width={80} height={80} /></span>
    </span>;
}

/** UI preview selection only. Style studies are explicitly separate from published presets. */
export default function ThemeStyleGallery({ theme }: { theme: Theme }) {
    const group = useId();
    const [selection, setSelection] = useState('published');
    const study = STUDIES.find(item => item.id === selection);
    const options = [{ id: 'published', name: 'Core default', subject: 'Published preset' }, ...STUDIES];
    return <div className="theme-style-gallery">
        <div className="theme-style-gallery-intro"><div><span className="theme-style-theme-name">{theme.name}</span><span className="theme-style-gallery-count">1 published preset · {STUDIES.length} style studies</span></div><span className="theme-style-gallery-price">{formatThemePrice(theme)}</span></div>
        <fieldset className="theme-style-options"><legend className="sr-only">Choose a theme style to inspect</legend>{options.map(option => <label className="theme-style-choice" data-selected={selection === option.id} key={option.id}>
            <Input unstyled className="sr-only" type="radio" name={group} value={option.id} checked={selection === option.id} onChange={()=>setSelection(option.id)} />
            <span className="theme-style-preview">{option.id === 'published' ? <Image src={theme.thumbnail_url} alt={`${theme.name} published default preset screenshot`} fill sizes="280px" /> : <StyleStudyPreview study={STUDIES.find(item => item.id === option.id)!} />}<span className="theme-style-selected" aria-hidden="true">Selected</span></span>
            <span className="theme-style-choice-caption"><strong>{option.name}</strong><span>{option.id === 'published' ? 'Published preset' : `${option.subject} · Style study`}</span></span>
        </label>)}</fieldset>
        <div className="theme-style-selection-detail"><div aria-live="polite"><h3>{study?.name || 'Core default'}</h3><p>{study?.copy || 'Inspect the published theme, its included features, and the available preview before choosing.'}</p></div><Link className="marketplace-action" href={study ? '/guides/customize-your-theme' : `/themes/${encodeURIComponent(theme.slug)}`}>{study ? 'Explore customisation' : 'View theme details'}<ArrowRight size={18} aria-hidden="true" /></Link></div>
        <p className="theme-style-gallery-note">Style studies are visual inspiration. Make your own design choices in the merchant editor.</p>
    </div>;
}
