'use client'

// Domain Center — shared presentational atoms. All status/score values come from
// the domain-model single source of truth; this file only renders them.

import { useCallback } from 'react'
import { Badge, Button, Check, Copy, useToast } from '@letbuyy/ui'
import {
    type DomainStatus,
    type SslState,
    healthScoreBand,
    sslLabel,
    sslVariant,
    statusLabel,
    statusVariant,
} from '@/lib/domains/domain-model'

export function DomainStatusBadge({ status }: { status: DomainStatus }) {
    return <Badge label={statusLabel(status)} variant={statusVariant(status)} />
}

export function SslBadge({ ssl }: { ssl: SslState }) {
    return <Badge label={sslLabel(ssl)} variant={sslVariant(ssl)} />
}

export function HealthMeter({ score, showLabel = true }: { score: number; showLabel?: boolean }) {
    const band = healthScoreBand(score)
    return (
        <div className="domains-health">
            <progress
                className={`domains-health-track domains-health-track--${band.variant}`}
                value={score}
                max={100}
                aria-label={`Domain health score: ${score} out of 100`}
            />
            {showLabel && (
                <div className="domains-health-meta">
                    <span className="domains-health-score">{score}</span>
                    <span className={`domains-health-band domains-health-band--${band.variant}`}>{band.label}</span>
                </div>
            )}
        </div>
    )
}

export type RecordState = 'verified' | 'pending' | 'mismatch' | 'unknown'

interface DnsRecordRowProps {
    type: string
    host: string
    value: string
    state?: RecordState
    message?: string | null
}

export function DnsRecordRow({ type, host, value, state = 'unknown', message }: DnsRecordRowProps) {
    const { notify } = useToast()
    const copy = useCallback(async (text: string, label: string) => {
        try {
            await navigator.clipboard.writeText(text)
            notify({ title: 'Copied', description: `${label} copied to clipboard`, variant: 'success' })
        } catch {
            notify({ title: 'Copy failed', description: 'Select and copy the value manually.', variant: 'warning' })
        }
    }, [notify])

    const stateLabel = state === 'verified' ? 'Correct' : state === 'mismatch' ? 'Needs update' : state === 'pending' ? 'Not found yet' : '—'
    const stateClass = state === 'verified' ? 'ok' : state === 'mismatch' ? 'bad' : 'pending'

    return (
        <div className="domains-record">
            <div className="domains-record-head">
                <span className="domains-record-type">{type}</span>
                <span className={`domains-record-state domains-record-state--${stateClass}`}>
                    {state === 'verified' && <Check className="letbuyy-icon" aria-hidden="true" />}
                    {stateLabel}
                </span>
            </div>
            <div className="domains-record-grid">
                <div className="domains-record-field">
                    <span className="domains-record-label">Host / Name</span>
                    <div className="domains-record-valrow">
                        <code className="domains-record-value">{host}</code>
                        <Button variant="ghost" size="sm" onClick={() => void copy(host, 'Host')} aria-label="Copy host">
                            <Copy className="letbuyy-icon" aria-hidden="true" />
                        </Button>
                    </div>
                </div>
                <div className="domains-record-field">
                    <span className="domains-record-label">Value / Points to</span>
                    <div className="domains-record-valrow">
                        <code className="domains-record-value">{value}</code>
                        <Button variant="ghost" size="sm" onClick={() => void copy(value, 'Value')} aria-label="Copy value">
                            <Copy className="letbuyy-icon" aria-hidden="true" />
                        </Button>
                    </div>
                </div>
            </div>
            {message && <p className="domains-record-msg">{message}</p>}
        </div>
    )
}

/** Wizard step indicator. */
export function StepDots({ steps, current }: { steps: ReadonlyArray<{ key: string; label: string }>; current: number }) {
    return (
        <ol className="domains-steps" aria-label="Connect domain progress">
            {steps.map((step, index) => {
                const state = index < current ? 'done' : index === current ? 'active' : 'todo'
                return (
                    <li key={step.key} className={`domains-step domains-step--${state}`}>
                        <span className="domains-step-dot">{index < current ? <Check className="letbuyy-icon" aria-hidden="true" /> : index + 1}</span>
                        <span className="domains-step-label">{step.label}</span>
                    </li>
                )
            })}
        </ol>
    )
}
