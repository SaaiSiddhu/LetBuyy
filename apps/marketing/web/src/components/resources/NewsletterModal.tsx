'use client'


import { useCopy } from '@/components/i18n/useCopy'
import { useEffect, useRef, useState } from 'react'
import { Button, Modal } from '@letbuyy/ui'
import NewsletterAvailability from './NewsletterAvailability'

const OPEN_EVENT = 'letbuyy:newsletter-open'

export function openNewsletterModal(): void {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT))
}

export function SubscribeButton({ className, children }: { className?: string; children: React.ReactNode }) {
    return <Button unstyled type="button" className={className} onClick={openNewsletterModal}>{children}</Button>
}

export default function NewsletterModalHost() {
    const { t } = useCopy()
    const [open, setOpen] = useState(false)
    const returnFocusRef = useRef<HTMLElement | null>(null)
    useEffect(() => {
        const onOpen = () => {
            returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
            setOpen(true)
        }
        window.addEventListener(OPEN_EVENT, onOpen)
        return () => window.removeEventListener(OPEN_EVENT, onOpen)
    }, [])
    return (
        <Modal className="marketing-dialog" open={open} onClose={() => setOpen(false)} title={t('Commerce updates')} returnFocusRef={returnFocusRef}>
            <NewsletterAvailability />
        </Modal>
    )
}
