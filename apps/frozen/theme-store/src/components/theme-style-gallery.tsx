'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, Button, Input, Menu } from '@letbuyy/ui';
import type { Theme } from '@letbuyy/theme-engine';
import { formatThemePrice } from '@/lib/utils';

const STUDIES = [
    { id: 'living', name: 'Considered living', subject: 'Home & interiors', headline: 'Objects with a little more meaning.' },
    { id: 'wardrobe', name: 'Everyday studio', subject: 'Fashion & apparel', headline: 'Good pieces. Your own story.' },
    { id: 'care', name: 'Daily ritual', subject: 'Beauty & wellness', headline: 'A little care, every day.' },
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
    const track = useRef<HTMLDivElement>(null);
    const [selection, setSelection] = useState('published');
    const study = STUDIES.find(item => item.id === selection);
    const options = [{ id: 'published', name: 'Core default', subject: 'Published preset' }, ...STUDIES];
    const selectedIndex = options.findIndex(option => option.id === selection);
    function selectStyle(id: string) {
        setSelection(id);
        const target = track.current?.querySelector<HTMLElement>(`[data-style="${id}"]`);
        if (target && track.current) track.current.scrollTo({ left: target.offsetLeft, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    return <div className="theme-style-gallery">
        <div className="theme-style-gallery-intro"><div><span className="theme-style-theme-name">{theme.name}</span><span className="theme-style-gallery-count">1 published preset · {STUDIES.length} style studies</span></div><span className="theme-style-gallery-price">{formatThemePrice(theme)}</span></div>
        <fieldset className="theme-style-picker"><legend className="sr-only">Choose a theme style to inspect</legend><div className="theme-style-options" ref={track}>{options.map(option => <label className="theme-style-choice" data-style={option.id} data-selected={selection === option.id} key={option.id}>
            <Input unstyled className="sr-only" type="radio" name={group} value={option.id} checked={selection === option.id} onChange={()=>selectStyle(option.id)} />
            <span className="theme-style-preview"><span className="theme-style-device-top" aria-hidden="true"><i /></span><span className="theme-style-screen">{option.id === 'published' ? <Image src={theme.thumbnail_url} alt={`${theme.name} published listing image`} fill sizes="(max-width: 767px) 76vw, 300px" /> : <StyleStudyPreview study={STUDIES.find(item => item.id === option.id)!} />}</span></span>
            <span className="theme-style-choice-caption"><strong>{option.name}</strong><span>{option.id === 'published' ? 'Published preset' : `${option.subject} · Style study`}</span></span>
        </label>)}</div></fieldset>
        <div className="theme-style-gallery-toolbar"><span className="theme-style-page-count" aria-live="polite">{String(selectedIndex + 1).padStart(2, '0')} <span>/ {String(options.length).padStart(2, '0')}</span></span><Link className="marketplace-text-link" href={study ? '/guides/customize-your-theme' : `/themes/${encodeURIComponent(theme.slug)}`}>{study ? 'Explore customisation' : 'View Core theme'}<ArrowRight size={16} aria-hidden="true" /></Link><div className="theme-style-gallery-controls"><Button variant="secondary" size="icon" aria-label="Previous style" disabled={selectedIndex === 0} onClick={()=>selectStyle(options[selectedIndex - 1].id)}><ArrowLeft size={18} aria-hidden="true" /></Button><Button variant="secondary" size="icon" aria-label="Next style" disabled={selectedIndex === options.length - 1} onClick={()=>selectStyle(options[selectedIndex + 1].id)}><ArrowRight size={18} aria-hidden="true" /></Button></div></div>
        <p className="theme-style-gallery-note">Style studies are visual inspiration. The default shows the published listing image.</p>
    </div>;
}
