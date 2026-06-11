'use client';
import { Button, Input } from '@letbuyy/ui';
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
    background: 'rgb(255 255 255)',
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

const PROJECTS = [
    { name: 'Brand Identity', category: 'Branding', gradient: 'linear-gradient(135deg,rgb(244 63 94),rgb(251 113 133))' },
    { name: 'Mobile App UI', category: 'UI/UX', gradient: 'linear-gradient(135deg,rgb(99 102 241),rgb(129 140 248))' },
    { name: 'Web Redesign', category: 'Web', gradient: 'linear-gradient(135deg,rgb(16 185 129),rgb(52 211 153))' },
    { name: 'Motion Reel', category: 'Motion', gradient: 'linear-gradient(135deg,rgb(245 158 11),rgb(251 191 36))' },
    { name: '3D Renders', category: '3D Art', gradient: 'linear-gradient(135deg,rgb(139 92 246),rgb(167 139 250))' },
];

export default function PortfolioComingSoon({ storeName, tagline, logoUrl, launchDate }: Props) {
    const ok = true;
    const [mx, setMx] = useState(0.5);
    const [my, setMy] = useState(0.5);
    const [email, setEmail] = useState('');
    const [done, setDone] = useState(false);
    const [ap, setAp] = useState(0);
    const t = useCountdown(launchDate);

    useEffect(() => { const i = setInterval(() => setAp(p => (p + 1) % PROJECTS.length), 2800); return () => clearInterval(i); }, []);
    useEffect(() => { const fn = (e: MouseEvent) => { setMx(e.clientX / window.innerWidth); setMy(e.clientY / window.innerHeight); }; window.addEventListener('mousemove', fn); return () => window.removeEventListener('mousemove', fn); }, []);
    const submit = (e: React.FormEvent) => { e.preventDefault(); if (!email.includes('@')) return; setDone(true); setTimeout(() => { setDone(false); setEmail(''); }, 3000); };
    const px = (mx - 0.5) * 15, py = (my - 0.5) * 15;

    return (
        <div style={{ height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column', background: 'rgb(3 0 20)', color: 'rgb(255 255 255)', overflow: 'hidden', position: 'relative', fontFamily: "'Inter',-apple-system,sans-serif" }}>
            {/* NOISE */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, opacity: .025, pointerEvents: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`, backgroundSize: '128px' }} />
            {/* MESH */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', width: '150%', height: '150%', top: '-25%', left: '-25%', background: `radial-gradient(600px at ${28 + px * .4}% ${18 + py * .4}%,rgba(244,63,94,.15),transparent 60%),radial-gradient(500px at ${72 - px * .3}% ${55 - py * .3}%,rgba(168,85,247,.12),transparent 60%),radial-gradient(400px at ${50 + px * .2}% ${82 + py * .2}%,rgba(99,102,241,.08),transparent 60%)`, transition: 'background .4s ease-out' }} />
                <div style={{ position: 'absolute', top: 0, left: '-50%', width: '200%', height: '100%', background: 'linear-gradient(105deg,transparent 40%,rgba(244,63,94,.03) 45%,rgba(168,85,247,.04) 50%,rgba(99,102,241,.03) 55%,transparent 60%)', animation: 'au 12s ease-in-out infinite alternate' }} />
            </div>
            {/* GRID */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none', opacity: .035, backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px)', backgroundSize: '50px 50px', mask: 'radial-gradient(ellipse 60% 60% at 50% 50%,black 20%,transparent 70%)', WebkitMask: 'radial-gradient(ellipse 60% 60% at 50% 50%,black 20%,transparent 70%)' }} />
            {/* PARTICLES */}
            {ok && <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>{PARTICLE_STYLES.map((style, i) => (<div key={i} style={style} />))}</div>}

            <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'clamp(12px,3dvh,24px) clamp(16px,4vw,32px)', gap: 'clamp(8px,1.5dvh,16px)' }}>
                {/* NAV */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'clamp(8px,1.5dvh,16px) clamp(12px,3vw,24px)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(6px,1vw,10px)' }}>
                        {logoUrl ? <img src={logoUrl} alt="" style={{ width: 'clamp(24px,3.5vw,32px)', height: 'clamp(24px,3.5vw,32px)', borderRadius: 8, objectFit: 'cover' }} /> : <div style={{ width: 'clamp(24px,3.5vw,32px)', height: 'clamp(24px,3.5vw,32px)', borderRadius: 8, background: 'linear-gradient(135deg,rgb(244 63 94),rgb(251 113 133))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 'clamp(10px,1.5vw,14px)', fontWeight: 800 }}>{storeName.charAt(0)}</div>}
                        <span style={{ fontWeight: 700, fontSize: 'clamp(11px,1.5vw,14px)', letterSpacing: '-.02em' }}>{storeName}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: 'clamp(3px,.5dvh,6px) clamp(8px,1.5vw,14px)', borderRadius: 999, background: 'rgba(244,63,94,.1)', border: '1px solid rgba(244,63,94,.2)' }}>
                        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'rgb(244 63 94)', animation: 'pulse 2s ease-in-out infinite' }} />
                        <span style={{ fontSize: 'clamp(8px,1.1vw,11px)', fontWeight: 600, color: 'rgb(253 164 175)', letterSpacing: '.06em', textTransform: 'uppercase' }}>Portfolio</span>
                    </div>
                </div>

                {/* HEADING */}
                <h1 style={{ fontSize: 'clamp(2rem,7vw,4.5rem)', fontWeight: 900, lineHeight: 1, textAlign: 'center', letterSpacing: '-.04em', background: 'linear-gradient(135deg,rgb(255 255 255) 0%,rgb(254 205 211) 40%,rgb(244 63 94) 80%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', filter: 'drop-shadow(0 2px 12px rgba(244,63,94,.15))', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .1s both' : 'none' }}>{storeName}</h1>
                <p style={{ fontSize: 'clamp(.78rem,1.8vw,1.1rem)', color: 'rgba(255,255,255,.5)', lineHeight: 1.6, textAlign: 'center', maxWidth: 420, animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .2s both' : 'none' }}>{tagline || 'This portfolio is not open yet. Published work will appear after the owner opens it.'}</p>

                {/* COUNTDOWN */}
                <div style={{ display: 'flex', gap: 'clamp(4px,1vw,10px)', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .3s both' : 'none' }}>
                    {[{ v: t.d, l: 'DAYS' }, { v: t.h, l: 'HRS' }, { v: t.m, l: 'MIN' }, { v: t.s, l: 'SEC' }].map((x, i) => (<div key={x.l} style={{ display: 'contents' }}><div style={{ minWidth: 'clamp(48px,8vw,72px)', padding: 'clamp(6px,1.2dvh,14px) clamp(4px,.8vw,8px)', borderRadius: 'clamp(10px,1.5dvh,16px)', textAlign: 'center', background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.05)', backdropFilter: 'blur(8px)' }}><div style={{ fontSize: 'clamp(1.1rem,3vw,2rem)', fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', marginBottom: 'clamp(1px,.3dvh,4px)', background: 'linear-gradient(135deg,rgb(254 205 211),rgb(244 63 94))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{String(x.v).padStart(2, '0')}</div><div style={{ fontSize: 'clamp(7px,1vw,10px)', fontWeight: 600, letterSpacing: '.08em', color: 'rgba(255,255,255,.3)' }}>{x.l}</div></div>{i < 3 && <span style={{ fontSize: 'clamp(.8rem,1.5vw,1.3rem)', fontWeight: 200, color: 'rgba(255,255,255,.12)', alignSelf: 'center' }}>:</span>}</div>))}
                </div>

                {/* PROJECT SHOWCASE */}
                <div style={{ display: 'flex', gap: 'clamp(6px,1vw,12px)', justifyContent: 'center', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .4s both' : 'none' }}>
                    {PROJECTS.map((p, i) => {
                        const active = i === ap; return (
                            <Button unstyled key={i} onClick={() => setAp(i)} style={{ width: 'clamp(56px,11vw,100px)', padding: 'clamp(6px,1dvh,12px) clamp(4px,.5vw,8px)', borderRadius: 'clamp(10px,1.3dvh,16px)', border: `1px solid ${active ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.04)'}`, background: active ? 'rgba(255,255,255,.05)' : 'rgba(255,255,255,.015)', cursor: 'pointer', textAlign: 'center', color: 'rgb(255 255 255)', fontFamily: 'inherit', transition: 'all .4s cubic-bezier(.16,1,.3,1)', transform: `scale(${active ? 1.08 : .95}) translateY(${active ? -4 : 0}px)`, opacity: active ? 1 : .45, boxShadow: active ? '0 12px 30px rgba(0,0,0,.25)' : 'none' }}>
                                <div style={{ width: '100%', aspectRatio: '4/3', borderRadius: 'clamp(6px,.8dvh,10px)', background: active ? p.gradient : 'rgba(255,255,255,.06)', marginBottom: 'clamp(4px,.5dvh,8px)', transition: 'all .4s ease' }} />
                                <div style={{ fontSize: 'clamp(6px,.85vw,9px)', fontWeight: 700, letterSpacing: '.06em', color: active ? 'rgb(253 164 175)' : 'rgba(255,255,255,.3)', textTransform: 'uppercase', marginBottom: 1 }}>{p.category}</div>
                                <div style={{ fontSize: 'clamp(7px,1vw,10px)', fontWeight: 600, color: 'rgba(255,255,255,.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                            </Button>
                        );
                    })}
                </div>

                {/* SKILLS */}
                <div style={{ display: 'flex', gap: 'clamp(6px,1vw,14px)', flexWrap: 'wrap', justifyContent: 'center', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .5s both' : 'none' }}>
                    {['Branding', 'UI/UX Design', 'Web Development', 'Motion Graphics', '3D Art'].map(f => (<span key={f} style={{ padding: 'clamp(3px,.5dvh,6px) clamp(8px,1.2vw,14px)', borderRadius: 8, fontSize: 'clamp(8px,1.1vw,11px)', fontWeight: 600, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', color: 'rgba(255,255,255,.45)' }}>{f}</span>))}
                </div>

                {/* EMAIL */}
                <div style={{ width: '100%', maxWidth: 'min(420px,90vw)', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .55s both' : 'none' }}>
                    {done ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 'clamp(8px,1.2dvh,12px)', borderRadius: 14, background: 'rgba(34,197,94,.08)', border: '1px solid rgba(34,197,94,.2)', color: 'rgb(134 239 172)', fontSize: 'clamp(11px,1.4vw,14px)', fontWeight: 600 }}>You&apos;ll be the first to see it!</div> : (
                        <form onSubmit={submit} style={{ display: 'flex', gap: 'clamp(4px,.6vw,8px)', padding: 'clamp(3px,.4dvh,5px)', borderRadius: 'clamp(12px,1.5dvh,16px)', background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)' }}>
                            <Input unstyled type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="enter@youremail.com" required style={{ flex: 1, padding: 'clamp(8px,1dvh,12px) clamp(10px,2vw,16px)', borderRadius: 'clamp(10px,1.2dvh,14px)', border: 'none', background: 'transparent', color: 'rgb(255 255 255)', fontSize: 'clamp(11px,1.4vw,14px)', outline: 'none', fontFamily: 'inherit', minWidth: 0 }} />
                            <Button unstyled type="submit" style={{ padding: 'clamp(8px,1dvh,12px) clamp(12px,2.5vw,24px)', borderRadius: 'clamp(10px,1.2dvh,14px)', border: 'none', background: 'linear-gradient(135deg,rgb(244 63 94),rgb(251 113 133))', color: 'rgb(255 255 255)', fontWeight: 700, fontSize: 'clamp(10px,1.3vw,13px)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', boxShadow: '0 6px 20px rgba(244,63,94,.3)' }}>Notify Me</Button>
                        </form>
                    )}
                </div>

                {/* STATS */}
                <div style={{ display: 'flex', gap: 'clamp(16px,4vw,40px)', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .6s both' : 'none' }}>
                    {[{ v: '50+', l: 'Projects' }, { v: '12', l: 'Awards' }, { v: '8yr', l: 'Experience' }].map(s => (<div key={s.l} style={{ textAlign: 'center' }}><div style={{ fontSize: 'clamp(.85rem,2vw,1.3rem)', fontWeight: 800, lineHeight: 1, background: 'linear-gradient(135deg,rgb(254 205 211),rgb(253 164 175))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{s.v}</div><div style={{ fontSize: 'clamp(7px,1vw,10px)', fontWeight: 500, color: 'rgba(255,255,255,.25)', textTransform: 'uppercase', letterSpacing: '.06em', marginTop: 1 }}>{s.l}</div></div>))}
                </div>

                {/* PROGRESS */}
                {ok && <div style={{ width: '100%', maxWidth: 'min(280px,70vw)', animation: 'fu 1s cubic-bezier(.16,1,.3,1) .65s both' }}><div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3, fontSize: 'clamp(7px,1vw,10px)', fontWeight: 600, color: 'rgba(255,255,255,.25)' }}><span>Portfolio Setup</span><span style={{ color: 'rgb(253 164 175)' }}>82%</span></div><div style={{ height: 3, borderRadius: 2, background: 'rgba(255,255,255,.04)', overflow: 'hidden' }}><div style={{ width: '82%', height: '100%', borderRadius: 2, background: 'linear-gradient(90deg,rgb(244 63 94),rgb(251 113 133),rgb(253 164 175))', position: 'relative' }}><div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.4),transparent)', animation: 'sh 2.5s linear infinite' }} /></div></div></div>}

                <p style={{ fontSize: 'clamp(8px,1.1vw,11px)', color: 'rgba(255,255,255,.18)', animation: ok ? 'fu 1s cubic-bezier(.16,1,.3,1) .7s both' : 'none' }}>Powered by <a href="https://letbuyy.com" target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(253,164,175,.45)', textDecoration: 'none', fontWeight: 700 }}>LetBuyy</a></p>
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
