'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, useInView, useReducedMotion } from 'framer-motion'
import {
  AppWindow, BarChart3, Button, CreditCard, MaterialIcon, Package, ShoppingBag, Store, Users,
  type LucideIcon,
} from '@letbuyy/ui'

type NID = 'storefront'|'orders'|'analytics'|'payments'|'inventory'|'customers'|'ai'|'apps'

const CX=280, CY=280, R=190, NR=30
function rpos(deg: number) {
  const θ = (deg - 90) * Math.PI / 180
  return { x: CX + R * Math.cos(θ), y: CY + R * Math.sin(θ) }
}

const GNODES: { id: NID; label: string; color: string; fill: string; deg: number; delay: number; links: NID[] }[] = [
  { id:'storefront', label:'Storefront', color:'rgb(20 184 166)',  fill:'rgba(20,184,166,0.14)',  deg:0,   delay:0,    links:['orders','analytics'] },
  { id:'orders',     label:'Orders',     color:'rgb(59 130 246)',  fill:'rgba(59,130,246,0.14)',  deg:45,  delay:0.08, links:['payments','inventory','analytics','customers'] },
  { id:'analytics',  label:'Analytics',  color:'rgb(139 92 246)', fill:'rgba(139,92,246,0.14)', deg:90,  delay:0.16, links:['orders','storefront'] },
  { id:'payments',   label:'Payments',   color:'rgb(16 185 129)', fill:'rgba(16,185,129,0.14)', deg:135, delay:0.24, links:['orders'] },
  { id:'inventory',  label:'Inventory',  color:'rgb(245 158 11)', fill:'rgba(245,158,11,0.14)', deg:180, delay:0.32, links:['orders'] },
  { id:'customers',  label:'Customers',  color:'rgb(236 72 153)', fill:'rgba(236,72,153,0.14)', deg:225, delay:0.40, links:['orders','analytics'] },
  { id:'ai',         label:'AI Copilot', color:'rgb(167 139 250)',fill:'rgba(167,139,250,0.14)',deg:270, delay:0.48, links:['analytics','inventory','orders'] },
  { id:'apps',       label:'Apps',       color:'rgb(6 182 212)',  fill:'rgba(6,182,212,0.14)',  deg:315, delay:0.56, links:['storefront'] },
]

const GNODES_ICONS: Record<NID, LucideIcon | null> = {
  storefront: Store,
  orders:     ShoppingBag,
  analytics:  BarChart3,
  payments:   CreditCard,
  inventory:  Package,
  customers:  Users,
  ai:         null,
  apps:       AppWindow,
}

function getConn(id: NID) {
  const s = new Set<NID>()
  const n = GNODES.find(n => n.id === id)
  n?.links.forEach(l => s.add(l))
  GNODES.forEach(n => { if (n.links.includes(id)) s.add(n.id) })
  return s
}

// ── Metrics ──────────────────────────────────────────────────────────────────
const METS = [
  { label:'Revenue Today', raw:84220, fmt:(v:number)=>`₹${v.toLocaleString('en-IN')}` },
  { label:'Orders',        raw:127,   fmt:(v:number)=>`${v}` },
  { label:'Products',      raw:348,   fmt:(v:number)=>`${v}` },
  { label:'Customers',     raw:2491,  fmt:(v:number)=>v.toLocaleString('en-IN') },
  { label:'Conversion',    raw:38,    fmt:(v:number)=>`${(v/10).toFixed(1)}%` },
  { label:'AOV',           raw:1820,  fmt:(v:number)=>`₹${v.toLocaleString('en-IN')}` },
  { label:'Inv. Value',    raw:184,   fmt:(v:number)=>v>=184?'₹18.4L':`₹${v}` },
  { label:'Staff Online',  raw:12,    fmt:(v:number)=>`${v}` },
]

function useCountUp(target: number, active: boolean) {
  const [v, setV] = useState(0)
  const raf = useRef<number>(0)
  useEffect(() => {
    if (!active) return
    const t0 = performance.now(), dur = 1300
    const tick = (t: number) => {
      const p = Math.min((t-t0)/dur, 1)
      setV(Math.round((1-Math.pow(1-p,3)) * target))
      if (p < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [active, target])
  return v
}

function MetItem({ m, active }: { m: typeof METS[0]; active: boolean }) {
  const v = useCountUp(m.raw, active)
  return (
    <div className="cop-met">
      <span className="cop-met-val">{active ? m.fmt(v) : m.fmt(m.raw)}</span>
      <span className="cop-met-lbl">{m.label}</span>
    </div>
  )
}

// ── Graph — pixel-identical to CommerceNetwork hero, with 3-state interactive selection ─
function CommerceGraph({ sel, onSel }: { sel: NID; onSel: (id: NID) => void }) {
  const [hov, setHov] = useState<NID|null>(null)
  const isReduced = useReducedMotion()
  const act = hov ?? sel
  const conn = getConn(act)

  // 3 states: active node | connected relative | unrelated dim
  const st = (id: NID): 'act'|'con'|'dim' =>
    id === act ? 'act' : conn.has(id) ? 'con' : 'dim'

  // Edge visual per state
  const edgeStroke = (id: NID) =>
    st(id) === 'act' ? `url(#cop-eg-${id})` :
    st(id) === 'con' ? GNODES.find(n=>n.id===id)!.color :
    'rgba(139,92,246,0.15)'
  const edgeWidth = (id: NID) => st(id) === 'act' ? 2 : st(id) === 'con' ? 1.25 : 0.75
  const edgeDash  = (id: NID) => st(id) === 'act' ? '8 4' : st(id) === 'con' ? '6 4' : '5 6'
  const edgeOp    = (id: NID) => st(id) === 'act' ? 0.85 : st(id) === 'con' ? 0.5 : 0.18

  // Node visual per state
  const nodeOp     = (id: NID) => st(id) === 'act' ? 1 : st(id) === 'con' ? 0.72 : 0.27
  const nodeRingOp = (id: NID) => st(id) === 'act' ? 0.3 : st(id) === 'con' ? 0.18 : 0.07
  const nodeSW     = (id: NID) => st(id) === 'act' ? 2 : st(id) === 'con' ? 1.5 : 1.25
  const nodeFill   = (id: NID) => st(id) === 'dim' ? 'rgba(255,255,255,0.025)' : GNODES.find(n=>n.id===id)!.fill
  const labelColor = (id: NID) => st(id) === 'act' ? GNODES.find(n=>n.id===id)!.color : st(id) === 'con' ? 'rgba(203,213,225,0.9)' : 'rgba(148,163,184,0.45)'

  return (
    <div className="cop-graph-wrap">
      <div className="cop-graph-canvas">
        <svg viewBox="0 0 560 560" fill="none" className="cop-graph-svg" aria-label="Commerce OS module graph" role="img">
          <defs>
            <radialGradient id="cop-hub-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(139,92,246,0.28)"/>
              <stop offset="100%" stopColor="rgba(139,92,246,0)"/>
            </radialGradient>
            {GNODES.map(n => {
              const p = rpos(n.deg)
              return (
                <g key={n.id}>
                  <linearGradient id={`cop-eg-${n.id}`} x1={CX} y1={CY} x2={p.x} y2={p.y} gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="rgba(139,92,246,0.6)"/>
                    <stop offset="100%" stopColor={n.color} stopOpacity="0.4"/>
                  </linearGradient>
                  <path id={`cop-p-${n.id}`} d={`M ${CX} ${CY} L ${p.x} ${p.y}`}/>
                </g>
              )
            })}
            <filter id="cop-glow-f" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="cop-eg-f" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="cop-pf" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="cop-hb" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Hub ambient breathing glow */}
          <circle cx={CX} cy={CY} r="130" fill="url(#cop-hub-glow)">
            {!isReduced && <>
              <animate attributeName="r" values="130;155;130" dur="4s" repeatCount="indefinite"/>
              <animate attributeName="opacity" values="0.9;0.55;0.9" dur="4s" repeatCount="indefinite"/>
            </>}
          </circle>

          {/* Edge soft glow layer */}
          {GNODES.map(n => (
            <line key={`eg-${n.id}`} x1={CX} y1={CY} x2={rpos(n.deg).x} y2={rpos(n.deg).y}
              stroke={n.color}
              strokeWidth={st(n.id) === 'act' ? 3 : st(n.id) === 'con' ? 2 : 1.5}
              opacity={st(n.id) === 'act' ? 0.18 : st(n.id) === 'con' ? 0.1 : 0.04}
              filter="url(#cop-eg-f)"
              style={{transition:'opacity 0.22s ease'}}/>
          ))}

          {/* Edge dashed lines — 3 states */}
          {GNODES.map(n => (
            <line key={`edge-${n.id}`} x1={CX} y1={CY} x2={rpos(n.deg).x} y2={rpos(n.deg).y}
              stroke={edgeStroke(n.id)}
              strokeWidth={edgeWidth(n.id)}
              strokeDasharray={edgeDash(n.id)}
              strokeLinecap="round"
              opacity={edgeOp(n.id)}
              style={{transition:'all 0.22s ease'}}/>
          ))}

          {/* Flow particles — active node only */}
          {!isReduced && GNODES.map(n => {
            if (st(n.id) !== 'act') return null
            return (
              <g key={`pt-${n.id}`} filter="url(#cop-pf)">
                <circle r="4" fill={n.color}>
                  <animateMotion dur={`${n.delay * 0.5 + 2.6}s`} repeatCount="indefinite">
                    <mpath href={`#cop-p-${n.id}`}/>
                  </animateMotion>
                </circle>
                <circle r="2.5" fill={n.color} opacity="0.5">
                  <animateMotion dur={`${n.delay * 0.5 + 2.9}s`} repeatCount="indefinite" begin={`${n.delay * 4 + 0.8}s`} keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                    <mpath href={`#cop-p-${n.id}`}/>
                  </animateMotion>
                </circle>
              </g>
            )
          })}

          {/* Satellite nodes — 3 states */}
          {GNODES.map(n => {
            const p = rpos(n.deg)
            return (
              <g key={`nd-${n.id}`}
                onClick={() => onSel(n.id)}
                onMouseEnter={() => setHov(n.id)}
                onMouseLeave={() => setHov(null)}
                style={{cursor:'pointer'}}
                role="button" tabIndex={0}
                aria-label={`Select ${n.label}`}
                aria-pressed={sel === n.id}
                onKeyDown={e => e.key === 'Enter' && onSel(n.id)}
              >
                {/* Pulse ring — active only */}
                {st(n.id) === 'act' && !isReduced && (
                  <circle cx={p.x} cy={p.y} r={NR+6} fill="none" stroke={n.color} strokeWidth="0.75" opacity="0">
                    <animate attributeName="r" values={`${NR+4};${NR+18};${NR+4}`} dur="3.8s" begin={`${(n.delay*4).toFixed(2)}s`} repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0;0.3;0" dur="3.8s" begin={`${(n.delay*4).toFixed(2)}s`} repeatCount="indefinite"/>
                  </circle>
                )}
                {/* Outer decorative ring */}
                <circle cx={p.x} cy={p.y} r={NR+4}
                  fill="none" stroke={n.color} strokeWidth="1"
                  opacity={nodeRingOp(n.id)}
                  style={{transition:'opacity 0.22s ease'}}/>
                {/* Node fill */}
                <circle cx={p.x} cy={p.y} r={NR}
                  fill={nodeFill(n.id)}
                  stroke={n.color}
                  strokeWidth={nodeSW(n.id)}
                  opacity={nodeOp(n.id)}
                  filter={st(n.id) === 'act' ? 'url(#cop-glow-f)' : undefined}
                  style={{transition:'all 0.22s ease'}}/>
              </g>
            )
          })}

          {/* Center hub */}
          <g aria-hidden="true">
            <circle cx={CX} cy={CY} r="60" fill="none" stroke="rgba(139,92,246,0.22)" strokeWidth="1">
              {!isReduced && <>
                <animate attributeName="r" values="60;78;60" dur="3.2s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.22;0;0.22" dur="3.2s" repeatCount="indefinite"/>
              </>}
            </circle>
            <circle cx={CX} cy={CY} r="52" fill="none" stroke="rgba(139,92,246,0.16)" strokeWidth="1">
              {!isReduced && <>
                <animate attributeName="r" values="52;66;52" dur="3.2s" begin="0.8s" repeatCount="indefinite"/>
                <animate attributeName="opacity" values="0.16;0;0.16" dur="3.2s" begin="0.8s" repeatCount="indefinite"/>
              </>}
            </circle>
            <circle cx={CX} cy={CY} r="50" fill="rgba(10,9,18,0.96)" stroke="rgba(139,92,246,0.55)" strokeWidth="1.5" filter="url(#cop-hb)"/>
            <circle cx={CX} cy={CY} r="50" fill="rgba(10,9,18,0.96)" stroke="rgba(139,92,246,0.55)" strokeWidth="1.5"/>
            <circle cx={CX} cy={CY} r="44" fill="rgba(139,92,246,0.12)"/>
          </g>

          {/* Node labels — 3-state colours */}
          {GNODES.map(n => {
            const p = rpos(n.deg)
            const anchor: 'start'|'middle'|'end' = p.x < CX-20 ? 'end' : p.x > CX+20 ? 'start' : 'middle'
            const lx = p.x < CX-20 ? p.x-NR-6 : p.x > CX+20 ? p.x+NR+6 : p.x
            const ly = p.y < CY ? p.y-NR-8 : p.y+NR+16
            return (
              <text key={`lbl-${n.id}`}
                x={lx} y={ly}
                textAnchor={anchor}
                fill={labelColor(n.id)}
                fontSize="11" fontWeight={st(n.id) === 'act' ? '700' : '500'}
                fontFamily="ui-sans-serif, system-ui, sans-serif"
                style={{transition:'fill 0.22s ease'}}
              >
                {n.label==='AI Copilot'?'AI':n.label}
              </text>
            )
          })}

          {/* Hub label */}
          <g aria-hidden="true">
            <text x={CX} y={CY-8} textAnchor="middle" dominantBaseline="central"
              fill="rgba(196,181,253,1)" fontSize="10" fontWeight="780"
              fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="0.08em">COMMERCE</text>
            <text x={CX} y={CY+8} textAnchor="middle" dominantBaseline="central"
              fill="rgba(196,181,253,1)" fontSize="10" fontWeight="780"
              fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="0.08em">OS</text>
          </g>
        </svg>

        {/* HTML icon overlays */}
        {GNODES.map(n => {
          const p = rpos(n.deg)
          const Icon = GNODES_ICONS[n.id]
          return (
            <div key={n.id} className="cop-gnode-icon"
              aria-hidden="true"
              style={{
                left:`${(p.x/560)*100}%`, top:`${(p.y/560)*100}%`,
                color:n.color,
                opacity: nodeOp(n.id),
                transition:'opacity 0.22s ease',
              }}>
              {n.id==='ai'
                ? <MaterialIcon name="assistant" size={18}/>
                : Icon ? <Icon width={18} height={18} strokeWidth={1.6}/> : null}
            </div>
          )
        })}
      </div>

      {/* Node legend pills */}
      <div className="cop-graph-legend" aria-label="Module selector">
        {GNODES.map(n => (
          <Button unstyled key={n.id} className={`cop-gleg-pill${sel===n.id?' cop-gleg-pill-act':''}`}
            style={sel===n.id?{borderColor:`color-mix(in srgb,${n.color} 55%,transparent)`,background:`color-mix(in srgb,${n.color} 12%,transparent)`,color:n.color}:{}}
            onClick={()=>onSel(n.id)} aria-pressed={sel===n.id}>
            <span className="cop-gleg-dot" style={{background:n.color}}/>
            {n.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

// ── Event feed (32 unique items for seamless infinite scroll) ─────────────────
const EVTS = [
  { t:'09:14', txt:'Order ORD-4831 placed — Priya Rajan',          c:'rgb(59 130 246)' },
  { t:'09:14', txt:'Inventory reserved — Sneakers ×1',          c:'rgb(245 158 11)' },
  { t:'09:15', txt:'Payment ₹2,840 captured via UPI',           c:'rgb(16 185 129)' },
  { t:'09:15', txt:'GST invoice INV-2024-0832 issued',           c:'rgb(20 184 166)' },
  { t:'09:16', txt:'Storefront analytics refreshed',            c:'rgb(139 92 246)' },
  { t:'09:16', txt:'Priya Rajan tagged as VIP',                 c:'rgb(236 72 153)' },
  { t:'09:17', txt:'AI: low stock — Hoodie (7 left)',           c:'rgb(167 139 250)' },
  { t:'09:17', txt:'Order ORD-4832 placed — COD ₹1,240',          c:'rgb(59 130 246)' },
  { t:'09:18', txt:'Razorpay webhook received',                 c:'rgb(16 185 129)' },
  { t:'09:19', txt:'Hoodie −3 after fulfilment',                c:'rgb(245 158 11)' },
  { t:'09:19', txt:'Shiprocket shipment SHP-4831 created',      c:'rgb(6 182 212)' },
  { t:'09:20', txt:'Conversion rate up to 3.8% (+0.4%)',        c:'rgb(139 92 246)' },
  { t:'09:21', txt:'Loyalty points granted — Arjun Mehta',     c:'rgb(236 72 153)' },
  { t:'09:21', txt:'Order ORD-4833 confirmed — Meera Kumar',       c:'rgb(59 130 246)' },
  { t:'09:22', txt:'Purchase order PO-2024-008 raised',         c:'rgb(245 158 11)' },
  { t:'09:22', txt:'Payment ₹4,180 confirmed via Card',         c:'rgb(16 185 129)' },
  { t:'09:23', txt:'AI: price sensitivity on Sport Tee',        c:'rgb(167 139 250)' },
  { t:'09:23', txt:'Customer moved to High Value segment',      c:'rgb(236 72 153)' },
  { t:'09:24', txt:'Storefront edge cache invalidated',         c:'rgb(20 184 166)' },
  { t:'09:24', txt:'Order ORD-4834 shipped via Delhivery',         c:'rgb(6 182 212)' },
  { t:'09:25', txt:'Daily revenue milestone ₹1L crossed',       c:'rgb(139 92 246)' },
  { t:'09:25', txt:'Coupon URBAN20 redeemed — ₹480 off',        c:'rgb(99 102 241)' },
  { t:'09:26', txt:'Inventory sync — 3 SKUs updated',           c:'rgb(245 158 11)' },
  { t:'09:26', txt:'Refund ₹840 initiated — Order ORD-4821',       c:'rgb(239 68 68)' },
  { t:'09:27', txt:'AI: churn risk — Rohan Kapoor',             c:'rgb(167 139 250)' },
  { t:'09:27', txt:'Order ORD-4835 placed — Vikram Singh',         c:'rgb(59 130 246)' },
  { t:'09:28', txt:'GST Q3 reconciliation data synced',         c:'rgb(20 184 166)' },
  { t:'09:28', txt:'Shiprocket rate fetch completed',           c:'rgb(6 182 212)' },
  { t:'09:29', txt:'Running Cap — top seller today',            c:'rgb(139 92 246)' },
  { t:'09:29', txt:'New customer Sunita Patel — first order',   c:'rgb(236 72 153)' },
  { t:'09:30', txt:'COD confirmation ₹3,240 received',          c:'rgb(16 185 129)' },
  { t:'09:30', txt:'AI queued 4 personalised recommendations',  c:'rgb(167 139 250)' },
]

function EventFeed() {
  const items = [...EVTS, ...EVTS]  // 64 items: 32 unique × 2 for seamless loop
  return (
    <div className="cop-live">
      <div className="cop-live-hd">
        <span className="cop-live-title">Live Activity</span>
        <span className="cop-live-count">{EVTS.length}+ events</span>
        <span className="cop-feed-pulse"/>
      </div>
      <div className="cop-live-scroll" aria-label="Live merchant activity" aria-live="polite">
        <div className="cop-live-list">
          {items.map((e, i) => (
            <div key={i} className="cop-live-row">
              <span className="cop-feed-time">{e.t}</span>
              <span className="cop-feed-pip" style={{background:e.c}} aria-hidden="true"/>
              <span className="cop-feed-txt">{e.txt}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Workspace previews ────────────────────────────────────────────────────────
function WTool({ title, badge, variant='default' }: { title:string; badge:string; variant?:'default'|'live'|'warn'|'ai' }) {
  return (
    <div className="ws-tool">
      <span className="ws-tool-title">{title}</span>
      <span className={`ws-badge ws-badge-${variant}`}>{badge}</span>
    </div>
  )
}

function WRow({ cols }: { cols: React.ReactNode[] }) {
  return (
    <div className="ws-row" style={{gridTemplateColumns:`repeat(${cols.length},auto)`}}>
      {cols.map((c, i) => <span key={i}>{c}</span>)}
    </div>
  )
}

function WKpis({ items }: { items: [string, string][] }) {
  return (
    <div className="ws-kpi-row">
      {items.map(([v, l]) => (
        <div key={l} className="ws-kpi"><b>{v}</b><span>{l}</span></div>
      ))}
    </div>
  )
}

function WS_Orders() {
  return (
    <div className="ws-inner">
      <WTool title="Orders Center" badge="● Live" variant="live"/>
      <div className="ws-pipe-row">
        {([['Pending','12','rgb(245 158 11)'],['Processing','8','rgb(99 102 241)'],['Shipped','21','rgb(6 182 212)'],['Delivered','6','rgb(52 211 153)']] as const).map(([l,n,c])=>(
          <div key={l} className="ws-pipe" style={{borderColor:`color-mix(in srgb,${c} 30%,transparent)`,background:`color-mix(in srgb,${c} 8%,transparent)`}}>
            <span className="ws-pipe-n" style={{color:c}}>{n}</span>
            <span className="ws-pipe-l" style={{color:c}}>{l}</span>
          </div>
        ))}
      </div>
      {([['ORD-4831','Priya Rajan','₹2,840','Shipped','rgb(6 182 212)'],['ORD-4830','Arjun Mehta','₹1,240','Processing','rgb(99 102 241)'],['ORD-4829','Meera Kumar','₹4,180','Delivered','rgb(52 211 153)']] as const).map(([id,nm,amt,st,c])=>(
        <div key={id} className="ws-row ws-row-4">
          <span className="ws-id">{id}</span>
          <span className="ws-name">{nm}</span>
          <span className="ws-amt">{amt}</span>
          <span className="ws-st" style={{color:c}}>{st}</span>
        </div>
      ))}
    </div>
  )
}

function WS_Products() {
  return (
    <div className="ws-inner">
      <WTool title="Catalog Manager" badge="348 products"/>
      {([['Classic Sneakers','UK-CLX-09B','142','Published',true],['Everyday Hoodie','EH-GRY-M','7','Low stock',false],['Running Cap','RC-NVY-OS','61','Published',true]] as const).map(([nm,sku,s,st,ok])=>(
        <div key={sku} className="ws-row ws-row-3">
          <div className="ws-prod-thumb"/>
          <div className="ws-stack"><span className="ws-name">{nm}</span><span className="ws-meta">{sku}</span></div>
          <span className="ws-st" style={{color:ok?'rgb(52 211 153)':'rgb(245 158 11)'}}>{st}</span>
        </div>
      ))}
      <div className="ws-kpi-row">
        <div className="ws-kpi"><b>₹18.4L</b><span>Inv. Value</span></div>
        <div className="ws-kpi"><b>92%</b><span>Ready</span></div>
        <div className="ws-kpi"><b>3</b><span>Collections</span></div>
      </div>
    </div>
  )
}

function WS_Payments() {
  return (
    <div className="ws-inner">
      <WTool title="Payments Center" badge="● Live" variant="live"/>
      {([['UPI','Razorpay','₹48,200',57,'rgb(99 102 241)'],['COD','Cash on Delivery','₹22,400',27,'rgb(245 158 11)'],['Cards','Visa / Mastercard','₹13,620',16,'rgb(16 185 129)']] as const).map(([l,sub,v,pct,c])=>(
        <div key={l} className="ws-pm-row">
          <span className="ws-pm-dot" style={{background:c}}/>
          <div className="ws-stack"><span className="ws-name">{l}</span><span className="ws-meta">{sub}</span></div>
          <div className="ws-pm-track"><div className="ws-pm-fill" style={{width:`${pct}%`,background:c}}/></div>
          <span className="ws-amt">{v}</span>
        </div>
      ))}
      <WKpis items={[['₹84,220','Today'],['GST','Ready'],['127','Txns']]}/>
    </div>
  )
}

function WS_Inventory() {
  return (
    <div className="ws-inner">
      <WTool title="Inventory & Ops" badge="1 low stock" variant="warn"/>
      {([['Classic Sneakers',142,200,false],['Everyday Hoodie',7,200,true],['Sport Tee',315,315,false]] as const).map(([nm,a,cap,low])=>(
        <div key={nm} className="ws-inv-row">
          <span className="ws-name">{nm}</span>
          <div className="ws-inv-track"><div className="ws-inv-fill" style={{width:`${(a/cap)*100}%`,background:low?'rgb(245 158 11)':'rgb(52 211 153)'}}/></div>
          <span className="ws-inv-n" style={{color:low?'rgb(245 158 11)':'rgb(52 211 153)'}}>{a}</span>
        </div>
      ))}
      <WKpis items={[['47','Orders today'],['PO-2024-007','Inbound']]}/>
    </div>
  )
}

function WS_Customers() {
  return (
    <div className="ws-inner">
      <WTool title="Customer Intelligence" badge="1,204 total"/>
      <div className="ws-seg-bar">
        {([[4,'rgb(139 92 246)'],[18,'rgb(99 102 241)'],[53,'rgb(6 182 212)'],[8,'rgb(52 211 153)'],[17,'rgb(245 158 11)']] as const).map(([p,c],i)=>(
          <span key={i} style={{width:`${p}%`,background:c}}/>
        ))}
      </div>
      {([['Priya Rajan','VIP','₹48,200','rgb(139 92 246)'],['Arjun Mehta','Loyal','₹12,400','rgb(99 102 241)'],['Meera Kumar','New','₹2,840','rgb(52 211 153)']] as const).map(([nm,seg,ltv,c])=>(
        <div key={nm} className="ws-row ws-row-4">
          <div className="ws-av" style={{background:c}}>{nm[0]}</div>
          <span className="ws-name">{nm}</span>
          <span className="ws-st" style={{color:c}}>{seg}</span>
          <span className="ws-amt">{ltv}</span>
        </div>
      ))}
    </div>
  )
}

function WS_Analytics() {
  const BARS = [42,58,51,74,68,83,91,77,88,96,84,92]
  return (
    <div className="ws-inner">
      <WTool title="Analytics Dashboard" badge="Last 12 days"/>
      <WKpis items={[['₹6.2L','Revenue'],['1,284','Orders'],['3.8%','Conversion']]}/>
      <div className="ws-bar-chart">
        {BARS.map((v,i)=>(
          <div key={i} className="ws-bar-col">
            <div className="ws-bar-fill" style={{height:`${(v/96)*100}%`}}/>
          </div>
        ))}
      </div>
    </div>
  )
}

function WS_AI() {
  return (
    <div className="ws-inner">
      <WTool title="AI Copilot" badge="3 signals" variant="ai"/>
      {([['Restock Everyday Hoodie','Inventory',94,'rgb(245 158 11)'],['Price sensitivity — Sport Tee','Pricing',87,'rgb(139 92 246)'],['Priya likely to churn','Retention',82,'rgb(236 72 153)']] as const).map(([l,t,c2,color])=>(
        <div key={l} className="ws-ai-row">
          <div className="ws-ai-dot" style={{background:color}}/>
          <div className="ws-stack"><span className="ws-name">{l}</span><span className="ws-meta" style={{color}}>{t}</span></div>
          <span className="ws-ai-conf">{c2}%</span>
        </div>
      ))}
    </div>
  )
}

function WS_Storefront() {
  return (
    <div className="ws-inner">
      <WTool title="Storefront" badge="● Published" variant="live"/>
      <div className="ws-sf-hero">
        <span className="ws-sf-name">Urban Kicks</span>
        <span className="ws-sf-tag">Sneakers for every stride</span>
      </div>
      <WKpis items={[['3.8%','Conversion'],['2,491','Visitors'],['Live','Status']]}/>
    </div>
  )
}

function WS_Apps() {
  return (
    <div className="ws-inner">
      <WTool title="Apps & Integrations" badge="3 installed"/>
      {([['Shiprocket','Shipping','Active','rgb(52 211 153)'],['Reviews Sync','Social Proof','Active','rgb(52 211 153)'],['Invoice Tools','GST','Pending','rgb(245 158 11)']] as const).map(([nm,cat,st,c])=>(
        <div key={nm} className="ws-row ws-row-3">
          <div className="ws-app-icon"/>
          <div className="ws-stack"><span className="ws-name">{nm}</span><span className="ws-meta">{cat}</span></div>
          <span className="ws-st" style={{color:c}}>{st}</span>
        </div>
      ))}
    </div>
  )
}

const WS_MAP: Record<NID, () => React.JSX.Element> = {
  storefront: WS_Storefront, orders: WS_Orders, analytics: WS_Analytics,
  payments: WS_Payments, inventory: WS_Inventory, customers: WS_Customers,
  ai: WS_AI, apps: WS_Apps,
}

function WorkspacePreview({ nid }: { nid: NID }) {
  const Comp = WS_MAP[nid]
  return (
    <div className="cop-ws">
      <div className="cop-ws-chrome">
        <div className="cop-ws-dots"><span/><span/><span/></div>
        <span className="cop-ws-url">merchant.letbuyy.com / {nid}</span>
      </div>
      <div className="cop-ws-body">
        <motion.div key={nid} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{duration:0.18}}>
          <Comp/>
        </motion.div>
      </div>
    </div>
  )
}

// ── Automation showcase — 6 flows, merchant-friendly language ─────────────────
const AUTO_FLOWS = [
  {
    key: 'order',
    event: 'Order Received',
    color: 'rgb(59 130 246)',
    steps: [
      { txt:'Stock count updated instantly',                      c:'rgb(245 158 11)' },
      { txt:'Order total confirmed and locked',                   c:'rgb(16 185 129)' },
      { txt:'GST tax invoice created automatically',              c:'rgb(20 184 166)' },
      { txt:'Customer history updated, loyalty points added',     c:'rgb(236 72 153)' },
      { txt:'Revenue dashboard refreshed in real time',           c:'rgb(139 92 246)' },
      { txt:'AI queues personalised offer for the buyer',         c:'rgb(167 139 250)' },
    ],
  },
  {
    key: 'payment',
    event: 'Payment Received',
    color: 'rgb(16 185 129)',
    steps: [
      { txt:'Payment verified and secured',                       c:'rgb(99 102 241)' },
      { txt:'Money recorded in your earnings',                    c:'rgb(16 185 129)' },
      { txt:'Bank confirmation received',                         c:'rgb(20 184 166)' },
      { txt:'Order automatically moves to fulfilment',            c:'rgb(59 130 246)' },
      { txt:'Your balance updated',                               c:'rgb(245 158 11)' },
      { txt:'Revenue added to your daily report',                 c:'rgb(139 92 246)' },
    ],
  },
  {
    key: 'refund',
    event: 'Refund Approved',
    color: 'rgb(239 68 68)',
    steps: [
      { txt:'Refund securely authorised by you',                  c:'rgb(99 102 241)' },
      { txt:'Refund amount deducted from your earnings',          c:'rgb(239 68 68)' },
      { txt:'Money sent back to customer\'s account',             c:'rgb(20 184 166)' },
      { txt:'Books balanced automatically — no manual entry',     c:'rgb(16 185 129)' },
      { txt:'Gift card credits restored to customer',             c:'rgb(6 182 212)' },
      { txt:'Customer notified via email and WhatsApp',           c:'rgb(236 72 153)' },
    ],
  },
  {
    key: 'lowstock',
    event: 'Running Low Alert',
    color: 'rgb(245 158 11)',
    steps: [
      { txt:'AI spots products running low before you do',        c:'rgb(167 139 250)' },
      { txt:'"Only a few left" badge appears on your store',      c:'rgb(59 130 246)' },
      { txt:'Restock suggestion sent to you immediately',         c:'rgb(6 182 212)' },
      { txt:'Shoppers see urgency — conversion goes up',          c:'rgb(16 185 129)' },
      { txt:'You get a push notification right away',             c:'rgb(236 72 153)' },
    ],
  },
  {
    key: 'customer',
    event: 'New Customer Joined',
    color: 'rgb(236 72 153)',
    steps: [
      { txt:'Account created and secured against bots',           c:'rgb(99 102 241)' },
      { txt:'Customer profile built automatically',               c:'rgb(139 92 246)' },
      { txt:'Personalised welcome email sent',                    c:'rgb(20 184 166)' },
      { txt:'Loyalty programme started for this customer',        c:'rgb(6 182 212)' },
      { txt:'AI tags them for personalised offers',               c:'rgb(167 139 250)' },
      { txt:'New customer counted in your growth dashboard',      c:'rgb(245 158 11)' },
    ],
  },
  {
    key: 'payout',
    event: 'Payout Sent',
    color: 'rgb(52 211 153)',
    steps: [
      { txt:'Your earnings calculated from all completed orders', c:'rgb(20 184 166)' },
      { txt:'You confirm the payout with one tap',                c:'rgb(99 102 241)' },
      { txt:'Amount verified before transfer',                    c:'rgb(52 211 153)' },
      { txt:'Money transferred directly to your bank',            c:'rgb(16 185 129)' },
      { txt:'Payout recorded in your books automatically',        c:'rgb(139 92 246)' },
      { txt:'You\'re notified the moment money lands',            c:'rgb(236 72 153)' },
    ],
  },
]

function AutomationShowcase() {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const [active, setActive] = useState(0)
  const flow = AUTO_FLOWS[active]

  return (
    <div ref={ref} className="cop-auto">
      <div className="cop-auto-hd">
        <p className="section-label">Automation</p>
        <h3 className="cop-auto-title">Every action updates the entire business.</h3>
        <p className="cop-auto-sub">One event. Six systems. Zero manual work.</p>
      </div>

      {/* Flow selector tabs */}
      <div className="cop-auto-tabs" role="tablist">
        {AUTO_FLOWS.map((f, i) => (
          <Button unstyled key={f.key}
            role="tab" aria-selected={active===i}
            className={`cop-auto-tab${active===i?' cop-auto-tab-act':''}`}
            style={active===i ? {
              borderColor:`color-mix(in srgb,${f.color} 40%,transparent)`,
              color:f.color,
              background:`color-mix(in srgb,${f.color} 10%,transparent)`,
            } : {}}
            onClick={()=>setActive(i)}>
            <span className="cop-auto-tab-dot" style={{background:f.color}} aria-hidden="true"/>
            {f.event}
          </Button>
        ))}
      </div>

      {/* Flow visualisation */}
      <div className="cop-auto-flow" role="tabpanel">
        <motion.div className="cop-auto-evt"
          key={flow.key}
          initial={{opacity:0,scale:0.94}}
          animate={inView?{opacity:1,scale:1}:{}}
          transition={{duration:0.35}}
          style={{
            borderColor:`color-mix(in srgb,${flow.color} 45%,transparent)`,
            background:`color-mix(in srgb,${flow.color} 8%,transparent)`,
          }}>
          <span className="cop-auto-evt-pill" style={{background:flow.color}}>{flow.event}</span>
          <p className="cop-auto-evt-sub">Triggered in your store</p>
        </motion.div>

        <div className="cop-auto-steps">
          {flow.steps.map((s, i) => (
            <motion.div key={s.txt} className="cop-auto-step"
              initial={{opacity:0,x:-8}}
              animate={inView?{opacity:1,x:0}:{}}
              transition={{duration:0.28,delay:i*0.06}}>
              <span className="cop-auto-step-num" style={{color:s.c}}>{i+1}</span>
              <span className="cop-auto-step-dot" style={{background:s.c}}/>
              <span className="cop-auto-step-txt">{s.txt}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Master Section ────────────────────────────────────────────────────────────
export function Features() {
  const [sel, setSel] = useState<NID>('orders')
  const selNode = GNODES.find(n => n.id === sel) || GNODES[0]
  const [activeTab, setActiveTab] = useState<'platform' | 'automation'>('platform')
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  const mRef = useRef<HTMLDivElement>(null)
  const metricsRef = useRef<HTMLDivElement>(null)
  const mInView = useInView(mRef, { once: true, margin: '-20px' })
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = metricsRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    const el = metricsRef.current
    if (!el) return
    updateScrollState()
    el.addEventListener('scroll', updateScrollState, { passive: true })
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateScrollState)
      ro.disconnect()
    }
  }, [updateScrollState])

  const scrollMetrics = (dir: 'left' | 'right') => {
    const el = metricsRef.current
    if (!el) return
    const amount = 220
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  return (
    <section className="copilot-section" id="platform" aria-label="Platform Architecture & Features">
      <div className="cop-wrap">

        {/* ── Section header ── */}
        <motion.div ref={ref} className="cop-header"
          initial={{opacity:0,y:20}} animate={inView?{opacity:1,y:0}:{}} transition={{duration:0.6}}>
          <p className="section-label">Architecture</p>
          <h2 className="section-title">Built as one connected system.</h2>
          <p className="section-sub">
            Every module communicates instantly through a shared event bus. No plugins to configure,
            no data silos, no sync delays.
          </p>
        </motion.div>

        <div ref={mRef} className="cop-metrics-wrap"
          data-scroll-left={canScrollLeft || undefined}
          data-scroll-right={canScrollRight || undefined}>
          {canScrollLeft && (
            <Button unstyled className="cop-metrics-arrow cop-metrics-arrow-l"
              onClick={() => scrollMetrics('left')} aria-label="Scroll metrics left">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M9 11L5 7l4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Button>
          )}

          <motion.div ref={metricsRef} className="cop-metrics"
            initial={{opacity:0,y:12}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.5,delay:0.1}}>
            {METS.map(m => <MetItem key={m.label} m={m} active={mInView}/>)}
          </motion.div>

          {canScrollRight && (
            <Button unstyled className="cop-metrics-arrow cop-metrics-arrow-r"
              onClick={() => scrollMetrics('right')} aria-label="Scroll metrics right">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M5 11l4-4-4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Button>
          )}
        </div>

        {/* ── Unified widget: graph (left) + workspace (right) ── */}
        <motion.div className="cop-unified"
          initial={{opacity:0,y:20}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.55,delay:0.1}}>

          {/* Chrome bar — spans full width of card */}
          <div className="cop-unified-chrome">
            <div className="cop-unified-brand">
              <span className="cop-unified-brand-dot" aria-hidden="true"/>
              <span className="cop-unified-brand-label">Commerce OS</span>
            </div>
            <motion.div
              key={sel}
              className="cop-unified-chip"
              initial={{opacity:0,scale:0.9}}
              animate={{opacity:1,scale:1}}
              transition={{duration:0.18}}
              style={{
                borderColor:`color-mix(in srgb,${selNode.color} 40%,transparent)`,
                color:selNode.color,
                background:`color-mix(in srgb,${selNode.color} 10%,transparent)`,
              }}>
              <span className="cop-unified-chip-dot" style={{background:selNode.color}}/>
              {selNode.label}
            </motion.div>
          </div>

          {/* Two-panel body */}
          <div className="cop-unified-panels">
            <div className="cop-uni-l">
              <CommerceGraph sel={sel} onSel={setSel}/>
            </div>
            <div className="cop-uni-r">
              <WorkspacePreview nid={sel}/>
            </div>
          </div>
        </motion.div>

        {/* ── Live Activity — full-width strip, 9 rows visible, 32+ unique items ── */}
        <motion.div
          initial={{opacity:0,y:16}} whileInView={{opacity:1,y:0}} viewport={{once:true}} transition={{duration:0.5,delay:0.18}}>
          <EventFeed/>
        </motion.div>

        <AutomationShowcase/>
      </div>
    </section>
  )
}

export default Features
