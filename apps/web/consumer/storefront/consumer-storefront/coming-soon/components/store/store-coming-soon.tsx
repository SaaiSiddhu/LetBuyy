'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
interface Props { storeName: string; tagline?: string; logoUrl?: string; launchDate?: string; }

function useCountdown(td?: string) {
    const tgt = useMemo(() => { if (td) return new Date(td); const d = new Date(); d.setDate(d.getDate() + 14); return d; }, [td]);
    const calc = useCallback(() => { const df = Math.max(0, tgt.getTime() - Date.now()); return { d: Math.floor(df / 86400000), h: Math.floor((df / 3600000) % 24), m: Math.floor((df / 60000) % 60), s: Math.floor((df / 1000) % 60) }; }, [tgt]);
    const [t, setT] = useState(calc);
    useEffect(() => { const i = setInterval(() => setT(calc), 1000); return () => clearInterval(i); }, [calc]);
    return t;
}

const PRODUCTS = [
    { name: 'Limited Edition Sneakers', price: '\u20B94,999', tag: 'NEW', gradient: 'linear-gradient(135deg,#6366f1,#818cf8)' },
    { name: 'Premium Hoodie', price: '\u20B92,499', tag: 'HOT', gradient: 'linear-gradient(135deg,#ec4899,#f472b6)' },
    { name: 'Designer Watch', price: '\u20B98,999', tag: 'SOON', gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)' },
    { name: 'Wireless Earbuds Pro', price: '\u20B93,499', tag: 'NEW', gradient: 'linear-gradient(135deg,#10b981,#34d399)' },
];

export default function StoreComingSoon({ storeName, tagline, logoUrl, launchDate }: Props) {
    const [ok, setOk] = useState(false);
    const [mx, setMx] = useState(0.5);
    const [my, setMy] = useState(0.5);
    const [email, setEmail] = useState('');
    const [done, setDone] = useState(false);
    const [ap, setAp] = useState(0);
    const t = useCountdown(launchDate);

    useEffect(() => { setOk(true); }, []);
    useEffect(() => { const i = setInterval(() => setAp(p => (p + 1) % PRODUCTS.length), 3000); return () => clearInterval(i); }, []);
    useEffect(() => { const fn = (e: MouseEvent) => { setMx(e.clientX / window.innerWidth); setMy(e.clientY / window.innerHeight); }; window.addEventListener('mousemove', fn); return () => window.removeEventListener('mousemove', fn); }, []);
    const submit = (e: React.FormEvent) => { e.preventDefault(); if (!email.includes('@')) return; setDone(true); setTimeout(() => { setDone(false); setEmail(''); }, 3000); };
    const px = (mx - 0.5) * 15, py = (my - 0.5) * 15;

    return (
        <div style={{ height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column', background: '#030014', color: '#fff', overflow: 'hidden', position: 'relative', fontFamily: "'Inter',-apple-system,sans-serif" }}>
            {/* NOISE */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: .025, pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '128px' }} />
            {/* MESH */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', width: '150%', height: '150%', top: '-25%', left: '-25%', background: `radial-gradient(600px at ${28 + px * .4}% ${18 + py * .4}%,rgba(99,102,241,.18),transparent 60%),radial-gradient(500px at ${72 - px * .3}% ${55 - py * .3}%,rgba(168,85,247,.14),transparent 60%),radial-gradient(400px at ${50 + px * .2}% ${82 + py * .2}%,rgba(236,72,153,.08),transparent 60%)`, transition: 'background .4s ease-out' }} />
                <div style={{ position: 'absolute', top: 0, left: '-50%', width: '200%', height: '100%', background: 'linear-gradient(105deg,transparent 40%,rgba(99,102,241,.03) 45%,rgba(168,85,247,.04) 50%,rgba(236,72,153,.03) 55%,transparent 60%)', animation: 'au 12s ease-in-out infinite alternate' }} />
            </div>
            {/* GRID */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: .035, backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)', backgroundSize: '50px 50px', mask: 'radial-gradient(ellipse 60% 60% at 50% 50%,black 20%,transparent 70%)', WebkitMask: 'radial-gradient(ellipse 60% 60% at 50% 50%,black 20%,transparent 70%)' }} />
            {/* PARTICLES */}
            {ok && <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>{Array.from({ length: 35 }, (_, i) => (<div key={i} style={{ position: 'absolute', width: 1 + Math.random() * 1.5, height: 1 + Math.random() * 1.5, borderRadius: '50%', background: '#fff', opacity: .06 + Math.random() * .1, top: `${Math.random() * 100}%`, left: `${Math.random() * 100}%`, animation: `pf ${5 + Math.random() * 8}s ease-in-out ${Math.random() * 4}s infinite alternate` }} />))}</div>}

            {/* CONTENT */}
            <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(12px,3dvh,24px) clamp(16px,4vw,32px)', gap: 'clamp(8px,1.5dvh,16px)' }}>
                {/* NAV */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(8px,1.5dvh,16px) clamp(12px,3vw,24px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px,1vw,10px)' }}>
                        {logoUrl ? <img src={logoUrl} alt="" style={{ width: 'clamp(24px,3.5vw,32px)', height: 'clamp(24px,3.5vw,32px)', borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 'clamp(24px,3.5vw,32px)', height: 'clamp(24px,3.5vw,32px)', borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(10px,1.5vw,14px)', fontWeight: 800 }}>{storeName.charAt(0)}</div>}
                        <span style={{ fontWeight: 700, fontSize: 'clamp(11px,1.5vw,14px)', letterSpacing: '-.02em' }}>{storeName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: 'clamp(3px,.5dvh,6px) clamp(8px,1.5vw,14px)', borderRadius: 999, background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.2)' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#6366f1', animation: 'pulse 2s ease-in-out infinite' }} />
                        <span style={{ fontSize: 'clamp(8px,1.1vw,11px)', fontWeight: 600, color: '#a5b4fc', letterSpacing: '.06em', textTransform: 'uppercase' }}>Store</span>
                    </div>
                </div>

                {/* HEADING */}
                <h1 style={{ fontSize: 'clamp(2rem,7vw,4.5rem)', fontWeight: 900, lineHeight: 1, textAlign: 'center', letterSpacing: '-.04em', background: 'linear-gradient(135deg,#fff 0%,#c7d2fe 40%,#818cf8 80%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 2px 12px rgba(99,102,241,.15))', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .1s both' : 'none' }}>{storeName}</h1>
                <p style={{ fontSize: 'clamp(.78rem,1.8vw,1.1rem)', color: 'rgba(255,255,255,.5)', lineHeight: 1.6, textAlign: 'center', maxWidth: 420, animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .2s both' : 'none' }}>{tagline || "We're curating something extraordinary. Premium products & exclusive deals."}</p>

                {/* COUNTDOWN */}
                <div style={{ display: 'flex', gap: 'clamp(4px,1vw,10px)', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .3s both' : 'none' }}>
                    {[{ v: t.d, l: 'DAYS' }, { v: t.h, l: 'HRS' }, { v: t.m, l: 'MIN' }, { v: t.s, l: 'SEC' }].map((x, i) => (<div key={x.l} style={{ display: 'contents' }}><div style={{ minWidth: 'clamp(48px,8vw,72px)', padding: 'clamp(6px,1.2dvh,14px) clamp(4px,.8vw,8px)', borderRadius: 'clamp(10px,1.5dvh,16px)', textAlign: 'center', background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)', backdropFilter: 'blur(8px)' }}><div style={{ fontSize: 'clamp(1.1rem,3vw,2rem)', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: 'clamp(1px,.3dvh,4px)', background: 'linear-gradient(135deg,#c7d2fe,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{String(x.v).padStart(2, '0')}</div><div style={{ fontSize: 'clamp(7px,1vw,10px)', fontWeight: 600, letterSpacing: '.08em', color: 'rgba(255,255,255,.3)' }}>{x.l}</div></div>{i < 3 && <span style={{ fontSize: 'clamp(.8rem,1.5vw,1.3rem)', fontWeight: 200, color: 'rgba(255,255,255,.12)', alignSelf: 'center' }}>:</span>}</div>))}
                </div>

                {/* PRODUCT CAROUSEL */}
                <div style={{ display: 'flex', gap: 'clamp(6px,1vw,12px)', justifyContent: 'center', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .4s both' : 'none' }}>
                    {PRODUCTS.map((p, i) => {
                        const active = i === ap; return (
                            <button key={i} onClick={() => setAp(i)} style={{ width: 'clamp(65px,13vw,120px)', padding: 'clamp(8px,1.2dvh,14px) clamp(4px,.6vw,10px)', borderRadius: 'clamp(12px,1.5dvh,18px)', border: `1px solid ${active ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.04)'}`, background: active ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.015)', cursor: 'pointer', textAlign: 'center', color: '#fff', fontFamily: 'inherit', transition: 'all .4s cubic-bezier(.16,1,.3,1)', transform: `scale(${active ? 1.08 : .95}) translateY(${active ? -4 : 0}px)`, opacity: active ? 1 : .45, boxShadow: active ? '0 12px 30px rgba(0,0,0,.25)' : 'none' }}>
                                <div style={{ width: 'clamp(28px,5vw,44px)', height: 'clamp(28px,5vw,44px)', borderRadius: 'clamp(8px,1dvh,12px)', background: active ? p.gradient : 'rgba(255,255,255,.06)', margin: '0 auto clamp(4px,.5dvh,8px)', transition: 'all .4s ease' }} />
                                <div style={{ fontSize: 'clamp(6px,.9vw,9px)', fontWeight: 700, letterSpacing: '.08em', padding: '1px clamp(4px,.6vw,8px)', borderRadius: 4, background: active ? 'rgba(99,102,241,.15)' : 'transparent', color: active ? '#a5b4fc' : 'rgba(255,255,255,.3)', display: 'inline-block', marginBottom: 'clamp(2px,.3dvh,4px)' }}>{p.tag}</div>
                                <div style={{ fontSize: 'clamp(7px,1vw,10px)', fontWeight: 600, color: 'rgba(255,255,255,.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                                <div style={{ fontSize: 'clamp(8px,1.2vw,12px)', fontWeight: 800, marginTop: 1, background: 'linear-gradient(135deg,#c7d2fe,#818cf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{p.price}</div>
                            </button>
                        );
                    })}
                </div>

                {/* FEATURES */}
                <div style={{ display: 'flex', gap: 'clamp(6px,1vw,14px)', flexWrap: 'wrap', justifyContent: 'center', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .5s both' : 'none' }}>
                    {['Secure Checkout', 'Fast Shipping', 'Premium Quality', 'Launch Rewards'].map(f => (<span key={f} style={{ padding: 'clamp(3px,.5dvh,6px) clamp(8px,1.2vw,14px)', borderRadius: 8, fontSize: 'clamp(8px,1.1vw,11px)', fontWeight: 600, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', color: 'rgba(255,255,255,.45)' }}>{f}</span>))}
                </div>

                {/* EMAIL */}
                <div style={{ width: '100%', maxWidth: 'min(420px,90vw)', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .55s both' : 'none' }}>
                    {done ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 'clamp(8px,1.2dvh,12px)', borderRadius: 14, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', color: '#86efac', fontSize: 'clamp(11px,1.4vw,14px)', fontWeight: 600 }}>You&apos;re on the list!</div> : (
                        <form onSubmit={submit} style={{ display: 'flex', gap: 'clamp(4px,.6vw,8px)', padding: 'clamp(3px,.4dvh,5px)', borderRadius: 'clamp(12px,1.5dvh,16px)', background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)' }}>
                            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="enter@youremail.com" required style={{ flex: 1, padding: 'clamp(8px,1dvh,12px) clamp(10px,2vw,16px)', borderRadius: 'clamp(10px,1.2dvh,14px)', border: 'none', background: 'transparent', color: '#fff', fontSize: 'clamp(11px,1.4vw,14px)', outline: 'none', fontFamily: 'inherit', minWidth: 0 }} />
                            <button type="submit" style={{ padding: 'clamp(8px,1dvh,12px) clamp(12px,2.5vw,24px)', borderRadius: 'clamp(10px,1.2dvh,14px)', border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 700, fontSize: 'clamp(10px,1.3vw,13px)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', boxShadow: '0 6px 20px rgba(99,102,241,.3)' }}>Notify Me</button>
                        </form>
                    )}
                </div>

                {/* STATS */}
                <div style={{ display: 'flex', gap: 'clamp(16px,4vw,40px)', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .6s both' : 'none' }}>
                    {[{ v: '2,400+', l: 'Waitlist' }, { v: '150+', l: 'Products' }, { v: '4.9', l: 'Rating' }].map(s => (<div key={s.l} style={{ textAlign: 'center' }}><div style={{ fontSize: 'clamp(.85rem,2vw,1.3rem)', fontWeight: 800, lineHeight: 1, background: 'linear-gradient(135deg,#e0e7ff,#a5b4fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{s.v}</div><div style={{ fontSize: 'clamp(7px,1vw,10px)', fontWeight: 500, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1 }}>{s.l}</div></div>))}
                </div>

                {/* PROGRESS */}
                {ok && <div style={{ width: '100%', maxWidth: 'min(280px,70vw)', animation: 'fu 1s cubic-bezier(.16,1,.3,1) .65s both' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 'clamp(7px,1vw,10px)', fontWeight: 600, color: 'rgba(255,255,255,.25)' }}><span>Store Setup</span><span style={{ color: '#a5b4fc' }}>78%</span></div><div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,.04)', overflow: 'hidden' }}><div style={{ width: '78%', height: '100%', borderRadius: 2, background: 'linear-gradient(90deg,#6366f1,#8b5cf6,#a855f7)', position: 'relative' }}><div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent)', animation: 'sh 2.5s linear infinite' }} /></div></div></div>}

                {/* POWERED */}
                <p style={{ fontSize: 'clamp(8px,1.1vw,11px)', color: 'rgba(255,255,255,.18)', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .7s both' : 'none' }}>Powered by <a href="https://letbuyy.store" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(165,180,252,.45)', textDecoration: 'none', fontWeight: 700 }}>LetBuyy</a></p>
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
