'use client';
import { useEffect, useState, useCallback, useMemo, type CSSProperties } from 'react';
interface Props { storeName: string; tagline?: string; logoUrl?: string; launchDate?: string; }

function seededUnit(index: number, salt: number) {
    const value = Math.sin((index + 1) * salt) * 10000;
    return value - Math.floor(value);
}

const PARTICLE_STYLES: CSSProperties[] = Array.from({ length: 35 }, (_, i) => ({
    position: 'absolute',
    width: 1 + seededUnit(i, 12.9898) * 1.5,
    height: 1 + seededUnit(i, 78.233) * 1.5,
    borderRadius: '50%',
    background: '#fff',
    opacity: .06 + seededUnit(i, 37.719) * .1,
    top: `${seededUnit(i, 19.19) * 100}%`,
    left: `${seededUnit(i, 47.47) * 100}%`,
    animation: `pf ${5 + seededUnit(i, 91.17) * 8}s ease-in-out ${seededUnit(i, 53.31) * 4}s infinite alternate`,
}));

function useCountdown(td?: string) {
    const tgt = useMemo(() => { if (td) return new Date(td); const d = new Date(); d.setDate(d.getDate() + 14); return d; }, [td]);
    const calc = useCallback(() => { const df = Math.max(0, tgt.getTime() - Date.now()); return { d: Math.floor(df / 86400000), h: Math.floor((df / 3600000) % 24), m: Math.floor((df / 60000) % 60), s: Math.floor((df / 1000) % 60) }; }, [tgt]);
    const [t, setT] = useState(calc);
    useEffect(() => { const i = setInterval(() => setT(calc), 1000); return () => clearInterval(i); }, [calc]);
    return t;
}

const POSTS = [
    { title: 'The Future of Design', tag: 'Design', read: '5 min', gradient: 'linear-gradient(135deg,#f97316,#fb923c)' },
    { title: 'Building at Scale', tag: 'Engineering', read: '8 min', gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
    { title: 'Growth Strategies', tag: 'Business', read: '4 min', gradient: 'linear-gradient(135deg,#ec4899,#f472b6)' },
    { title: 'AI & Automation', tag: 'Tech', read: '6 min', gradient: 'linear-gradient(135deg,#6366f1,#818cf8)' },
];

export default function BlogComingSoon({ storeName, tagline, logoUrl, launchDate }: Props) {
    const ok = true;
    const [mx, setMx] = useState(0.5);
    const [my, setMy] = useState(0.5);
    const [email, setEmail] = useState('');
    const [done, setDone] = useState(false);
    const [ap, setAp] = useState(0);
    const t = useCountdown(launchDate);

    useEffect(() => { const i = setInterval(() => setAp(p => (p + 1) % POSTS.length), 3000); return () => clearInterval(i); }, []);
    useEffect(() => { const fn = (e: MouseEvent) => { setMx(e.clientX / window.innerWidth); setMy(e.clientY / window.innerHeight); }; window.addEventListener('mousemove', fn); return () => window.removeEventListener('mousemove', fn); }, []);
    const submit = (e: React.FormEvent) => { e.preventDefault(); if (!email.includes('@')) return; setDone(true); setTimeout(() => { setDone(false); setEmail(''); }, 3000); };
    const px = (mx - 0.5) * 15, py = (my - 0.5) * 15;

    return (
        <div style={{ height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#030014', color: '#fff', overflow: 'hidden', position: 'relative', fontFamily: "'Inter',-apple-system,sans-serif" }}>
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: .025, pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '128px' }} />
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', width: '150%', height: '150%', top: '-25%', left: '-25%', background: `radial-gradient(600px at ${28 + px * .4}% ${18 + py * .4}%,rgba(249,115,22,.18),transparent 60%),radial-gradient(500px at ${72 - px * .3}% ${55 - py * .3}%,rgba(236,72,153,.12),transparent 60%),radial-gradient(400px at ${50 + px * .2}% ${82 + py * .2}%,rgba(99,102,241,.08),transparent 60%)`, transition: 'background .4s ease-out' }} />
                <div style={{ position: 'absolute', top: 0, left: '-50%', width: '200%', height: '100%', background: 'linear-gradient(105deg,transparent 40%,rgba(249,115,22,.03) 45%,rgba(236,72,153,.04) 50%,rgba(99,102,241,.03) 55%,transparent 60%)', animation: 'au 12s ease-in-out infinite alternate' }} />
            </div>
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: .035, backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)', backgroundSize: '50px 50px', mask: 'radial-gradient(ellipse 60% 60% at 50% 50%,black 20%,transparent 70%)', WebkitMask: 'radial-gradient(ellipse 60% 60% at 50% 50%,black 20%,transparent 70%)' }} />
            {ok && <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>{PARTICLE_STYLES.map((style, i) => (<div key={i} style={style} />))}</div>}

            <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(12px,3dvh,24px) clamp(16px,4vw,32px)', gap: 'clamp(8px,1.5dvh,16px)' }}>
                {/* NAV */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(8px,1.5dvh,16px) clamp(12px,3vw,24px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px,1vw,10px)' }}>
                        {logoUrl ? <img src={logoUrl} alt="" style={{ width: 'clamp(24px,3.5vw,32px)', height: 'clamp(24px,3.5vw,32px)', borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 'clamp(24px,3.5vw,32px)', height: 'clamp(24px,3.5vw,32px)', borderRadius: 8, background: 'linear-gradient(135deg,#f97316,#fb923c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(10px,1.5vw,14px)', fontWeight: 800 }}>{storeName.charAt(0)}</div>}
                        <span style={{ fontWeight: 700, fontSize: 'clamp(11px,1.5vw,14px)', letterSpacing: '-.02em' }}>{storeName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: 'clamp(3px,.5dvh,6px) clamp(8px,1.5vw,14px)', borderRadius: 999, background: 'rgba(249,115,22,.1)', border: '1px solid rgba(249,115,22,.2)' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#f97316', animation: 'pulse 2s ease-in-out infinite' }} />
                        <span style={{ fontSize: 'clamp(8px,1.1vw,11px)', fontWeight: 600, color: '#fdba74', letterSpacing: '.06em', textTransform: 'uppercase' }}>Blog</span>
                    </div>
                </div>

                <h1 style={{ fontSize: 'clamp(2rem,7vw,4.5rem)', fontWeight: 900, lineHeight: 1, textAlign: 'center', letterSpacing: '-.04em', background: 'linear-gradient(135deg,#fff 0%,#fed7aa 40%,#f97316 80%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 2px 12px rgba(249,115,22,.15))', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .1s both' : 'none' }}>{storeName}</h1>
                <p style={{ fontSize: 'clamp(.78rem,1.8vw,1.1rem)', color: 'rgba(255,255,255,.5)', lineHeight: 1.6, textAlign: 'center', maxWidth: 420, animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .2s both' : 'none' }}>{tagline || 'Stories, insights & ideas — our blog is brewing.'}</p>

                {/* COUNTDOWN */}
                <div style={{ display: 'flex', gap: 'clamp(4px,1vw,10px)', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .3s both' : 'none' }}>
                    {[{ v: t.d, l: 'DAYS' }, { v: t.h, l: 'HRS' }, { v: t.m, l: 'MIN' }, { v: t.s, l: 'SEC' }].map((x, i) => (<div key={x.l} style={{ display: 'contents' }}><div style={{ minWidth: 'clamp(48px,8vw,72px)', padding: 'clamp(6px,1.2dvh,14px) clamp(4px,.8vw,8px)', borderRadius: 'clamp(10px,1.5dvh,16px)', textAlign: 'center', background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)', backdropFilter: 'blur(8px)' }}><div style={{ fontSize: 'clamp(1.1rem,3vw,2rem)', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: 'clamp(1px,.3dvh,4px)', background: 'linear-gradient(135deg,#fed7aa,#f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{String(x.v).padStart(2, '0')}</div><div style={{ fontSize: 'clamp(7px,1vw,10px)', fontWeight: 600, letterSpacing: '.08em', color: 'rgba(255,255,255,.3)' }}>{x.l}</div></div>{i < 3 && <span style={{ fontSize: 'clamp(.8rem,1.5vw,1.3rem)', fontWeight: 200, color: 'rgba(255,255,255,.12)', alignSelf: 'center' }}>:</span>}</div>))}
                </div>

                {/* BLOG POST CARDS */}
                <div style={{ display: 'flex', gap: 'clamp(6px,1vw,12px)', justifyContent: 'center', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .4s both' : 'none' }}>
                    {POSTS.map((p, i) => {
                        const active = i === ap; return (
                            <button key={i} onClick={() => setAp(i)} style={{ width: 'clamp(70px,14vw,130px)', padding: 'clamp(8px,1.2dvh,14px) clamp(6px,.8vw,10px)', borderRadius: 'clamp(12px,1.5dvh,18px)', border: `1px solid ${active ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.04)'}`, background: active ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.015)', cursor: 'pointer', textAlign: 'left', color: '#fff', fontFamily: 'inherit', transition: 'all .4s cubic-bezier(.16,1,.3,1)', transform: `scale(${active ? 1.06 : .96}) translateY(${active ? -3 : 0}px)`, opacity: active ? 1 : .45, boxShadow: active ? '0 12px 30px rgba(0,0,0,.25)' : 'none' }}>
                                <div style={{ width: '100%', height: 'clamp(6px,.8dvh,10px)', borderRadius: 3, background: active ? p.gradient : 'rgba(255,255,255,.06)', marginBottom: 'clamp(6px,.8dvh,10px)', transition: 'all .4s ease' }} />
                                <div style={{ fontSize: 'clamp(6px,.85vw,9px)', fontWeight: 700, letterSpacing: '.06em', color: active ? '#fdba74' : 'rgba(255,255,255,.3)', textTransform: 'uppercase', marginBottom: 2 }}>{p.tag}</div>
                                <div style={{ fontSize: 'clamp(8px,1.1vw,11px)', fontWeight: 700, color: 'rgba(255,255,255,.85)', lineHeight: 1.25, marginBottom: 3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflow: 'hidden' }}>{p.title}</div>
                                <div style={{ fontSize: 'clamp(6px,.8vw,9px)', fontWeight: 500, color: 'rgba(255,255,255,.25)' }}>{p.read} read</div>
                            </button>
                        );
                    })}
                </div>

                {/* TOPICS */}
                <div style={{ display: 'flex', gap: 'clamp(6px,1vw,14px)', flexWrap: 'wrap', justifyContent: 'center', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .5s both' : 'none' }}>
                    {['Ideas', 'Technology', 'Growth', 'Design', 'Culture'].map(f => (<span key={f} style={{ padding: 'clamp(3px,.5dvh,6px) clamp(8px,1.2vw,14px)', borderRadius: 8, fontSize: 'clamp(8px,1.1vw,11px)', fontWeight: 600, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', color: 'rgba(255,255,255,.45)' }}>{f}</span>))}
                </div>

                {/* EMAIL */}
                <div style={{ width: '100%', maxWidth: 'min(420px,90vw)', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .55s both' : 'none' }}>
                    {done ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 'clamp(8px,1.2dvh,12px)', borderRadius: 14, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', color: '#86efac', fontSize: 'clamp(11px,1.4vw,14px)', fontWeight: 600 }}>Subscribed! First post incoming.</div> : (
                        <form onSubmit={submit} style={{ display: 'flex', gap: 'clamp(4px,.6vw,8px)', padding: 'clamp(3px,.4dvh,5px)', borderRadius: 'clamp(12px,1.5dvh,16px)', background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)' }}>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="enter@youremail.com" required style={{ flex: 1, padding: 'clamp(8px,1dvh,12px) clamp(10px,2vw,16px)', borderRadius: 'clamp(10px,1.2dvh,14px)', border: 'none', background: 'transparent', color: '#fff', fontSize: 'clamp(11px,1.4vw,14px)', outline: 'none', fontFamily: 'inherit', minWidth: 0 }} />
                            <button type="submit" style={{ padding: 'clamp(8px,1dvh,12px) clamp(12px,2.5vw,24px)', borderRadius: 'clamp(10px,1.2dvh,14px)', border: 'none', background: 'linear-gradient(135deg,#f97316,#fb923c)', color: '#fff', fontWeight: 700, fontSize: 'clamp(10px,1.3vw,13px)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', boxShadow: '0 6px 20px rgba(249,115,22,.3)' }}>Subscribe</button>
                        </form>
                    )}
                </div>

                {/* STATS */}
                <div style={{ display: 'flex', gap: 'clamp(16px,4vw,40px)', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .6s both' : 'none' }}>
                    {[{ v: '50+', l: 'Articles' }, { v: '12K', l: 'Readers' }, { v: 'Weekly', l: 'Updates' }].map(s => (<div key={s.l} style={{ textAlign: 'center' }}><div style={{ fontSize: 'clamp(.85rem,2vw,1.3rem)', fontWeight: 800, lineHeight: 1, background: 'linear-gradient(135deg,#fed7aa,#fdba74)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{s.v}</div><div style={{ fontSize: 'clamp(7px,1vw,10px)', fontWeight: 500, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1 }}>{s.l}</div></div>))}
                </div>

                <p style={{ fontSize: 'clamp(8px,1.1vw,11px)', color: 'rgba(255,255,255,.18)', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .65s both' : 'none' }}>Powered by <a href="https://letbuyy.store" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(253,186,116,.45)', textDecoration: 'none', fontWeight: 700 }}>LetBuyy</a></p>
            </div>

            <style>{`
                @keyframes fu{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
                @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}
                @keyframes sh{from{transform:translateX(-200%)}to{transform:translateX(300%)}}
                @keyframes pf{from{transform:translateY(0) translateX(0)}to{transform:translateY(-20px) translateX(8px)}}
                @keyframes au{from{transform:translateX(-10%)}to{transform:translateX(10%)}}
                input::placeholder{color:rgba(255,255,255,.22)!important}
                *{box-sizing:border-box;margin:0;padding:0}
                html,body{overflow:hidden;height:100dvh}
            `}</style>
        </div>
    );
}
