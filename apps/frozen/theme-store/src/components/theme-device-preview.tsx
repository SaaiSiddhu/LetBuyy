'use client';

import Image from 'next/image';
import { useId, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Button, Monitor, Smartphone } from '@letbuyy/ui';
import type { Theme } from '@letbuyy/theme-engine';

export default function ThemeDevicePreview({ theme, renderImages = true }: { theme: Pick<Theme, 'name' | 'thumbnail_url' | 'screenshots'>; renderImages?: boolean }) {
    const id = useId();
    const track = useRef<HTMLDivElement>(null);
    const [active, setActive] = useState(0);
    const [failedImages, setFailedImages] = useState<string[]>([]);
    const images = Array.from(new Set([theme.thumbnail_url, ...theme.screenshots].filter(Boolean)));
    const slides = [{ device: 'phone', src: images[0] }, ...(images.length ? images : [undefined]).map(src => ({ device: 'desktop', src }))];
    function select(index: number) {
        const next = Math.max(0, Math.min(slides.length - 1, index));
        setActive(next);
        track.current?.scrollTo({ left: track.current.clientWidth * next, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    }
    return <section className="catalog-device-preview" aria-label={`${theme.name} screenshot carousel`}>
        <div className="catalog-device-tabs" role="group" aria-label="Screenshot frame">
            <Button unstyled type="button" aria-pressed={slides[active].device === 'phone'} aria-controls={id} onClick={()=>select(0)}><Smartphone size={15} aria-hidden="true" />Phone</Button>
            <Button unstyled type="button" aria-pressed={slides[active].device === 'desktop'} aria-controls={id} onClick={()=>select(1)}><Monitor size={15} aria-hidden="true" />Desktop</Button>
        </div>
        <div id={id} className="catalog-device-track" ref={track} onScroll={()=>{if(track.current?.clientWidth){const index=Math.round(track.current.scrollLeft/track.current.clientWidth);if(index!==active)setActive(Math.max(0,Math.min(slides.length-1,index)));}}}>
            {slides.map((slide,index)=><div className="catalog-device-slide" role="group" aria-roledescription="slide" aria-label={`${index+1} of ${slides.length}`} aria-hidden={index!==active} key={`${slide.device}-${index}`}><div className={`catalog-device-frame catalog-device-${slide.device}`}><div className="catalog-device-chrome" aria-hidden="true">{slide.device==='phone'?<i/>:<><i/><i/><i/><span>Theme screenshot</span></>}</div><div className="catalog-device-screen">{renderImages&&slide.src&&!failedImages.includes(slide.src)?<Image src={slide.src} alt={`${theme.name} listing screenshot in a ${slide.device} frame`} fill sizes="(max-width: 639px) 90vw, 520px" onError={()=>{if(slide.src)setFailedImages(current=>current.includes(slide.src!)?current:[...current,slide.src!]);}} />:<div className="catalog-device-no-image" role="img" aria-label={`${theme.name} listing image unavailable`}>Screenshot unavailable</div>}</div></div>{slide.device==='desktop'&&<div className="catalog-device-stand" aria-hidden="true"/>}</div>)}
        </div>
        <div className="catalog-device-controls"><Button variant="ghost" size="icon" aria-label={`Previous ${theme.name} screenshot`} disabled={active===0} onClick={()=>select(active-1)}><ArrowLeft size={16} aria-hidden="true"/></Button><span aria-live="polite">{active+1} / {slides.length}<span> · Listing images in device frames</span></span><Button variant="ghost" size="icon" aria-label={`Next ${theme.name} screenshot`} disabled={active===slides.length-1} onClick={()=>select(active+1)}><ArrowRight size={16} aria-hidden="true"/></Button></div>
    </section>;
}
