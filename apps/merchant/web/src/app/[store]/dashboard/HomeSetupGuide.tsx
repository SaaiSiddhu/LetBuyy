'use client'

import Image from 'next/image'
import { ArrowRight, RotateCw, Store } from 'lucide-react'
import { Button } from '@letbuyy/ui'
import { MerchantNavigationLink } from '@/components/MerchantNavigationLink'
import TrialBanner, { getTrialDaysLeft } from '@/components/TrialBanner'
import styles from './HomeSetupGuide.module.css'

export interface HomeSetupStep {
    id: string
    title: string
    description: string
    actionText: string
    actionLink: string
    art: 'details' | 'product' | 'theme' | 'payments' | 'shipping' | 'taxes' | 'domain' | 'launch'
    complete: boolean
    available: boolean
    tracked: boolean
    optional?: boolean
    group?: 'main' | 'additional'
    detail?: string
}

interface HomeSetupGuideProps {
    store: string
    storeName: string
    isStore: boolean
    isDraft: boolean
    trialEndsAt: string | null
    trialStatus: string | null
    steps: HomeSetupStep[]
    compact?: boolean
    onRetry: () => void
    isRefreshing: boolean
}

export default function HomeSetupGuide({ store, storeName, isStore, isDraft, trialEndsAt, trialStatus, steps, compact = false, onRetry, isRefreshing }: HomeSetupGuideProps) {
    const tracked = steps.filter(step => step.tracked)
    const complete = tracked.filter(step => step.available && step.complete).length
    const unavailable = tracked.filter(step => !step.available).length
    const next = tracked.find(step => step.available && !step.complete)
    const primary = steps.filter(step => step.group !== 'additional')
    const additional = steps.filter(step => step.group === 'additional')
    const trialDaysLeft = getTrialDaysLeft(trialEndsAt, trialStatus)

    return (
        <section className={styles.guide} aria-labelledby="home-setup-heading">
            <div className={`${styles.hero} ${compact ? styles.heroCompact : ''}`}>
                <div className={styles.heroCopy}>
                    <span className={styles.eyebrow}>Home · {isStore ? 'Store setup' : 'Site setup'}</span>
                    <h1 id="home-setup-heading">{compact ? `Keep ${storeName} ready` : `Finish setting up ${storeName}`}</h1>
                    <p>{unavailable > 0
                        ? `${unavailable} setup ${unavailable === 1 ? 'check needs' : 'checks need'} a fresh result. Your saved work is unchanged.`
                        : next
                            ? 'A few focused steps will prepare your storefront for customers.'
                            : 'Review your setup and keep your storefront current.'}</p>
                </div>
                <div className={styles.heroActions}>
                    <div className={styles.progressCopy}>
                        <strong>{complete} of {tracked.length} steps complete</strong>
                        {unavailable > 0 && <span>{unavailable} could not be checked</span>}
                    </div>
                    <progress className={styles.progress} value={complete} max={Math.max(tracked.length, 1)} aria-label="Setup progress" />
                    {next && <MerchantNavigationLink className={styles.continueButton} href={`/${store}/${next.actionLink}`}>
                        Continue setup <ArrowRight size={16} aria-hidden="true" />
                    </MerchantNavigationLink>}
                </div>
            </div>

            {(isDraft || (trialDaysLeft !== null && trialEndsAt)) && <div className={styles.statusGrid}>
                {isDraft && <aside className={styles.draftNotice} aria-label="Storefront publication status">
                    <span className={styles.draftIcon}><Store size={18} aria-hidden="true" /></span>
                    <div className={styles.draftCopy}>
                        <span className={styles.noticeEyebrow}>Storefront status</span>
                        <strong>Draft — not visible to visitors</strong>
                        <span>Finish setup, then review your storefront before publishing.</span>
                    </div>
                    <MerchantNavigationLink href={`/${store}/online-store/themes`} className={styles.noticeLink}>
                        Review launch <ArrowRight size={15} aria-hidden="true" />
                    </MerchantNavigationLink>
                </aside>}
                {trialDaysLeft !== null && trialEndsAt && <TrialBanner storeSlug={store} trialEndsAt={trialEndsAt} trialStatus={trialStatus} />}
            </div>}

            <div className={styles.sectionHeading}>
                <h2>{isStore ? 'Store setup' : 'Site setup'}</h2>
                <span>{primary.length} setup tasks</span>
            </div>
            <div className={styles.grid}>
                {primary.map((step, index) => <StepCard key={step.id} step={step} store={store} isNext={next?.id === step.id} onRetry={onRetry} isRefreshing={isRefreshing} priority={index < 3} />)}
            </div>

            {additional.length > 0 && <>
                <div className={styles.sectionHeading}><h2>Finish and publish</h2><span>Review your address and publication status</span></div>
                <div className={styles.optionalGrid}>
                    {additional.map(step => <StepCard key={step.id} step={step} store={store} isNext={next?.id === step.id} onRetry={onRetry} isRefreshing={isRefreshing} compact />)}
                </div>
            </>}
        </section>
    )
}

function StepCard({ step, store, isNext, onRetry, isRefreshing, priority = false, compact = false }: {
    step: HomeSetupStep
    store: string
    isNext: boolean
    onRetry: () => void
    isRefreshing: boolean
    priority?: boolean
    compact?: boolean
}) {
    const status = !step.available ? 'unknown' : step.complete ? 'complete' : isNext ? 'next' : step.optional ? 'optional' : 'pending'
    const statusText = status === 'unknown' ? 'Couldn’t verify'
        : status === 'complete' ? 'Complete'
            : status === 'next' ? 'Up next'
                : status === 'optional' ? 'Recommended' : 'Not started'

    return <article className={`${styles.card} ${styles[status]} ${compact ? styles.cardCompact : ''}`}>
        <div className={styles.cardContent}>
            <span className={styles.status}>{statusText}</span>
            <h3>{step.title}</h3>
            <p>{!step.available ? 'We couldn’t check this step. Retry to confirm its current state.' : step.complete && step.detail ? step.detail : step.description}</p>
            <div className={styles.cardActions}>
                {!step.available && <Button unstyled type="button" className={styles.retryButton} onClick={onRetry} disabled={isRefreshing}>
                    <RotateCw size={14} aria-hidden="true" /> {isRefreshing ? 'Checking…' : 'Retry check'}
                </Button>}
                <MerchantNavigationLink href={`/${store}/${step.actionLink}`} className={isNext ? styles.primaryLink : styles.secondaryLink}>
                    {step.complete ? 'Review' : step.actionText}<ArrowRight size={14} aria-hidden="true" />
                </MerchantNavigationLink>
            </div>
        </div>
        <div className={styles.art} aria-hidden="true">
            <Image src={`/activation/home-v2/${step.art}.png`} alt="" fill sizes={compact ? '112px' : '(max-width: 768px) 105px, 140px'} priority={priority} className={styles.artImage} />
        </div>
    </article>
}
