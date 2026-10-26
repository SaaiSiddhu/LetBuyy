'use client';

import Image from 'next/image';
import {useEffect,useRef,useState} from 'react';
import {Button,Search,Heart} from '@letbuyy/ui';

const DESIGNS=[
    {key:'wardrobe',name:'Everyday wardrobe',title:'Made for everyday.',category:'Fashion',layout:'split'},
    {key:'care',name:'Thoughtful care',title:'A little care, daily.',category:'Beauty',layout:'editorial'},
    {key:'living',name:'Considered living',title:'Room to slow down.',category:'Home',layout:'immersive'},
    {key:'pantry',name:'The everyday pantry',title:'Good things, simply.',category:'Food',layout:'split'},
    {key:'play',name:'A little play',title:'Make room for play.',category:'Lifestyle',layout:'editorial'},
    {key:'outdoors',name:'Outside together',title:'Find your next move.',category:'Sport',layout:'immersive'},
] as const;

function DesignRow({reverse=false}:{reverse?:boolean}) {
    const items=reverse?[...DESIGNS.slice(3),...DESIGNS.slice(0,3)]:DESIGNS;
    return <div className="marketplace-showcase-row" data-direction={reverse?'right':'left'}>
        <div className="marketplace-showcase-track">{[false,true].map(duplicate=><ul className="marketplace-showcase-group" key={String(duplicate)} aria-hidden={duplicate?true:undefined} aria-label={duplicate?undefined:'Sample design inspiration'}>
            {items.map((design,index)=><li className="marketplace-showcase-card" key={design.key}>
                <div className="marketplace-sample-site" data-layout={design.layout} aria-hidden="true">
                    <div className="marketplace-sample-nav"><strong>{design.name}</strong><span>Explore &nbsp; Our story &nbsp; Contact</span><span><Search size={7} aria-hidden="true"/><Heart size={7} aria-hidden="true"/></span></div>
                    <div className="marketplace-sample-hero"><div className="marketplace-sample-copy"><span>{design.category}</span><strong>{design.title}</strong><i>Discover the collection</i></div><div className="marketplace-sample-photo"><Image src={`/showcase/${design.key}.webp`} alt="" fill sizes="(max-width: 640px) 140px, 220px" loading={!duplicate&&index<2?'eager':'lazy'} quality={65}/></div></div>
                    <div className="marketplace-sample-bottom"><span>Thoughtful details.<br/>Your own story.</span><Image src={`/showcase/${design.key}-detail.webp`} alt="" width={240} height={160} sizes="80px" loading="lazy" quality={60}/><span>Discover more</span></div>
                </div>
                <span className="sr-only">{design.name} — illustrative sample design</span>
            </li>)}
        </ul>)}</div>
    </div>;
}

export default function ThemeShowcase(){
    const ref=useRef<HTMLElement>(null);
    const [paused,setPaused]=useState(false);
    const [reduced,setReduced]=useState(false);
    const [inView,setInView]=useState(true);
    const [documentVisible,setDocumentVisible]=useState(true);
    useEffect(()=>{
        const media=window.matchMedia('(prefers-reduced-motion: reduce)');
        const syncMotion=()=>setReduced(media.matches);
        const syncVisibility=()=>setDocumentVisible(document.visibilityState!=='hidden');
        syncMotion();syncVisibility();
        media.addEventListener('change',syncMotion);
        document.addEventListener('visibilitychange',syncVisibility);
        const observer=typeof IntersectionObserver!=='undefined'?new IntersectionObserver(entries=>setInView(entries[0]?.isIntersecting??false),{threshold:0}):null;
        if(ref.current)observer?.observe(ref.current);
        return()=>{media.removeEventListener('change',syncMotion);document.removeEventListener('visibilitychange',syncVisibility);observer?.disconnect();};
    },[]);
    return <section ref={ref} className="marketplace-showcase" aria-label="Animated sample theme lookbook" aria-describedby="theme-showcase-description" data-paused={paused||reduced||!inView||!documentVisible}>
        <div className="marketplace-showcase-window"><DesignRow/><DesignRow reverse/></div>
        <p className="marketplace-showcase-label">Sample design inspiration</p>
        <p id="theme-showcase-description" className="sr-only">Illustrative designs using LetBuyy sample imagery. Browse the catalog for currently available themes. Animation pauses on hover or keyboard focus.</p>
        <Button className="marketplace-showcase-pause" variant="secondary" size="sm" type="button" disabled={reduced} aria-label={reduced?'Animation disabled for reduced motion':paused?'Resume theme animation':'Pause theme animation'} aria-pressed={paused||reduced} onClick={()=>setPaused(value=>!value)}>{reduced?'Motion reduced':paused?'Play':'Pause'}</Button>
    </section>;
}
