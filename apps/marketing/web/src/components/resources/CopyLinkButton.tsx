'use client'


import { useCopy } from '@/components/i18n/useCopy'
import Copy from '@/components/i18n/Copy'

import { useState } from 'react'
import { Button } from '@letbuyy/ui'

export default function CopyLinkButton() {
  const { t } = useCopy()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: ignore
    }
  }

  return (
    <Button
      unstyled
      type="button"
      onClick={copy}
      className="rc-copy-link-btn"
      aria-label={t("Copy article link")}
    >
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <Copy text={"Copied!"} /></>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <Copy text={"Copy link"} /></>
      )}
    </Button>
  )
}
