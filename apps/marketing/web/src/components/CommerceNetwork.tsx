'use client'

import { motion, useReducedMotion } from 'framer-motion'
import {
    BarChart3,
    CreditCard,
    MaterialIcon,
    Package,
    ShoppingBag,
    Store,
    Truck,
    Users,
    type LucideIcon,
} from '@letbuyy/ui'

interface CommerceNode {
    id: string
    label: string
    icon?: LucideIcon
    materialName?: string
    x: number
    y: number
    stroke: string
    fill: string
    delay: number
    particleDur: number
    particleBegin: number
}

const CX = 280
const CY = 280
const ORBIT_R = 190
const NODE_R = 30
const ICON_SIZE = 18

/** Clockwise from 12 o'clock: idx 0 = top, idx 2 = right, idx 4 = bottom, idx 6 = left */
function radialPos(idx: number, total = 8) {
    const θ = (idx * 2 * Math.PI) / total
    return {
        x: Math.round(CX + ORBIT_R * Math.sin(θ)),
        y: Math.round(CY - ORBIT_R * Math.cos(θ)),
    }
}

const NODES: CommerceNode[] = [
    { id: 'storefront', label: 'Storefront', icon: Store,       ...radialPos(0), stroke: 'rgb(20 184 166)',   fill: 'rgba(20,184,166,0.14)',   delay: 0,    particleDur: 2.6, particleBegin: 0 },
    { id: 'orders',     label: 'Orders',     icon: ShoppingBag, ...radialPos(1), stroke: 'rgb(59 130 246)',   fill: 'rgba(59,130,246,0.14)',   delay: 0.08, particleDur: 2.9, particleBegin: 0.8 },
    { id: 'payments',   label: 'Payments',   icon: CreditCard,  ...radialPos(2), stroke: 'rgb(16 185 129)',   fill: 'rgba(16,185,129,0.14)',   delay: 0.16, particleDur: 2.4, particleBegin: 1.6 },
    { id: 'analytics',  label: 'Analytics',  icon: BarChart3,   ...radialPos(3), stroke: 'rgb(139 92 246)',   fill: 'rgba(139,92,246,0.14)',   delay: 0.24, particleDur: 2.7, particleBegin: 0.4 },
    { id: 'inventory',  label: 'Inventory',  icon: Package,     ...radialPos(4), stroke: 'rgb(245 158 11)',   fill: 'rgba(245,158,11,0.14)',   delay: 0.32, particleDur: 2.5, particleBegin: 1.2 },
    { id: 'customers',  label: 'Customers',  icon: Users,       ...radialPos(5), stroke: 'rgb(236 72 153)',   fill: 'rgba(236,72,153,0.14)',   delay: 0.40, particleDur: 2.8, particleBegin: 2.0 },
    { id: 'ai',         label: 'AI',         materialName: 'assistant', ...radialPos(6), stroke: 'rgb(167 139 250)',  fill: 'rgba(167,139,250,0.14)',  delay: 0.48, particleDur: 3.0, particleBegin: 0.2 },
    { id: 'b2b',        label: 'B2B',        icon: Truck,       ...radialPos(7), stroke: 'rgb(6 182 212)',    fill: 'rgba(6,182,212,0.14)',    delay: 0.56, particleDur: 2.6, particleBegin: 1.4 },
]


export default function CommerceNetwork() {
    const isReduced = useReducedMotion()

    return (
        <div className="hero-network-wrap" aria-hidden="true">
            <motion.svg
                viewBox="0 0 560 560"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className="hero-network-svg"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.7, delay: 0.15 }}
            >
                <defs>
                    <radialGradient id="cn-hub-glow" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgba(139,92,246,0.28)" />
                        <stop offset="100%" stopColor="rgba(139,92,246,0)" />
                    </radialGradient>

                    {NODES.map(n => (
                        <linearGradient
                            key={n.id}
                            id={`cn-edge-${n.id}`}
                            x1={CX} y1={CY} x2={n.x} y2={n.y}
                            gradientUnits="userSpaceOnUse"
                        >
                            <stop offset="0%" stopColor="rgba(139,92,246,0.6)" />
                            <stop offset="100%" stopColor={n.stroke} stopOpacity="0.4" />
                        </linearGradient>
                    ))}

                    {NODES.map(n => (
                        <path key={n.id} id={`cn-path-${n.id}`} d={`M ${CX} ${CY} L ${n.x} ${n.y}`} />
                    ))}

                    <filter id="cn-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="4" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <filter id="cn-edge-glow" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <filter id="cn-particle-glow" x="-100%" y="-100%" width="300%" height="300%">
                        <feGaussianBlur stdDeviation="2.5" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <filter id="cn-hub-bloom" x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="6" result="blur" />
                        <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                </defs>

                {/* Hub ambient breathing glow */}
                <circle cx={CX} cy={CY} r="130" fill="url(#cn-hub-glow)">
                    {!isReduced && <>
                        <animate attributeName="r" values="130;155;130" dur="4s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.9;0.55;0.9" dur="4s" repeatCount="indefinite" />
                    </>}
                </circle>

                {/* Edge soft glow layer */}
                {NODES.map(n => (
                    <line
                        key={`glow-${n.id}`}
                        x1={CX} y1={CY} x2={n.x} y2={n.y}
                        stroke={n.stroke}
                        strokeWidth="2.5"
                        opacity="0.12"
                        filter="url(#cn-edge-glow)"
                    />
                ))}

                {/* Edge dashed lines */}
                {NODES.map(n => (
                    <line
                        key={n.id}
                        x1={CX} y1={CY} x2={n.x} y2={n.y}
                        stroke={`url(#cn-edge-${n.id})`}
                        strokeWidth="1.5"
                        strokeDasharray="5 5"
                        opacity="0.6"
                    />
                ))}

                {/* Flow particles */}
                {!isReduced && NODES.map(n => (
                    <g key={n.id} filter="url(#cn-particle-glow)">
                        <circle r="4" fill={n.stroke}>
                            <animateMotion dur={`${n.particleDur}s`} repeatCount="indefinite" begin={`${n.particleBegin}s`}>
                                <mpath href={`#cn-path-${n.id}`} />
                            </animateMotion>
                        </circle>
                        <circle r="2.5" fill={n.stroke} opacity="0.5">
                            <animateMotion dur={`${n.particleDur + 0.4}s`} repeatCount="indefinite" begin={`${n.particleBegin + 1.3}s`} keyPoints="1;0" keyTimes="0;1" calcMode="linear">
                                <mpath href={`#cn-path-${n.id}`} />
                            </animateMotion>
                        </circle>
                    </g>
                ))}

                {/* Satellite nodes */}
                {NODES.map(n => (
                    <motion.g
                        key={n.id}
                        initial={{ opacity: 0, scale: 0.4 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.45 + n.delay, ease: [0.34, 1.56, 0.64, 1] }}
                        style={{ transformOrigin: `${n.x}px ${n.y}px` }}
                    >
                        {/* Ambient pulse ring */}
                        {!isReduced && (
                            <circle cx={n.x} cy={n.y} r={NODE_R + 6} fill="none" stroke={n.stroke} strokeWidth="0.75" opacity="0">
                                <animate attributeName="r" values={`${NODE_R + 4};${NODE_R + 18};${NODE_R + 4}`} dur="3.8s" begin={`${(n.delay * 4).toFixed(2)}s`} repeatCount="indefinite" />
                                <animate attributeName="opacity" values="0;0.3;0" dur="3.8s" begin={`${(n.delay * 4).toFixed(2)}s`} repeatCount="indefinite" />
                            </circle>
                        )}
                        {/* Outer decorative ring */}
                        <circle cx={n.x} cy={n.y} r={NODE_R + 4} fill="none" stroke={n.stroke} strokeWidth="1" opacity="0.3" />
                        {/* Node fill */}
                        <circle cx={n.x} cy={n.y} r={NODE_R} fill={n.fill} stroke={n.stroke} strokeWidth="1.25" filter="url(#cn-glow)" />
                    </motion.g>
                ))}

                {/* Center hub */}
                <motion.g
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                    style={{ transformOrigin: `${CX}px ${CY}px` }}
                >
                    <circle cx={CX} cy={CY} r="60" fill="none" stroke="rgba(139,92,246,0.22)" strokeWidth="1">
                        {!isReduced && <>
                            <animate attributeName="r" values="60;78;60" dur="3.2s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.22;0;0.22" dur="3.2s" repeatCount="indefinite" />
                        </>}
                    </circle>
                    <circle cx={CX} cy={CY} r="52" fill="none" stroke="rgba(139,92,246,0.16)" strokeWidth="1">
                        {!isReduced && <>
                            <animate attributeName="r" values="52;66;52" dur="3.2s" begin="0.8s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.16;0;0.16" dur="3.2s" begin="0.8s" repeatCount="indefinite" />
                        </>}
                    </circle>
                    {/* Bloom layer for hub glow */}
                    <circle cx={CX} cy={CY} r="50" fill="rgba(10,9,18,0.96)" stroke="rgba(139,92,246,0.55)" strokeWidth="1.5" filter="url(#cn-hub-bloom)" />
                    {/* Crisp hub on top */}
                    <circle cx={CX} cy={CY} r="50" fill="rgba(10,9,18,0.96)" stroke="rgba(139,92,246,0.55)" strokeWidth="1.5" />
                    <circle cx={CX} cy={CY} r="44" fill="rgba(139,92,246,0.12)" />
                </motion.g>

                {/* Node labels */}
                {NODES.map(n => {
                    const anchor = n.x < CX - 20 ? 'end' : n.x > CX + 20 ? 'start' : 'middle'
                    const labelX = n.x < CX - 20 ? n.x - NODE_R - 6 : n.x > CX + 20 ? n.x + NODE_R + 6 : n.x
                    const labelY = n.y < CY ? n.y - NODE_R - 8 : n.y + NODE_R + 16
                    return (
                        <motion.text
                            key={n.id}
                            x={labelX} y={labelY}
                            textAnchor={anchor}
                            fill="rgba(148,163,184,0.85)"
                            fontSize="11" fontWeight="640"
                            fontFamily="ui-sans-serif, system-ui, sans-serif"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.4, delay: 0.7 + n.delay }}
                        >
                            {n.label}
                        </motion.text>
                    )
                })}

                {/* Hub label — dominantBaseline="central" places glyph midpoint at y, not baseline */}
                <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, delay: 0.3 }}>
                    <text x={CX} y={CY - 8} textAnchor="middle" dominantBaseline="central" fill="rgba(196,181,253,1)" fontSize="10" fontWeight="780" fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="0.08em">
                        COMMERCE
                    </text>
                    <text x={CX} y={CY + 8} textAnchor="middle" dominantBaseline="central" fill="rgba(196,181,253,1)" fontSize="10" fontWeight="780" fontFamily="ui-sans-serif, system-ui, sans-serif" letterSpacing="0.08em">
                        OS
                    </text>
                </motion.g>
            </motion.svg>

            {/* HTML icon overlays — outer div owns positioning+centering, inner motion.div owns animation */}
            {NODES.map(n => {
                const NodeIcon = n.icon
                return (
                    <div
                        key={n.id}
                        className="hero-network-icon"
                        style={{ left: `${(n.x / 560) * 100}%`, top: `${(n.y / 560) * 100}%`, color: n.stroke }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.4, delay: 0.5 + n.delay, ease: [0.34, 1.56, 0.64, 1] }}
                        >
                            {n.materialName
                                ? <MaterialIcon name={n.materialName} size={ICON_SIZE} />
                                : NodeIcon
                                    ? <NodeIcon width={ICON_SIZE} height={ICON_SIZE} strokeWidth={1.6} />
                                    : null
                            }
                        </motion.div>
                    </div>
                )
            })}
        </div>
    )
}
