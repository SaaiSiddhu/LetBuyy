import Image from 'next/image'
import styles from './support-experience.module.css'

const ARTWORK = {
  grievance: '/illustrations/support/grievance-care-studio-v1.webp',
  support: '/illustrations/support/support-care-studio-v1.webp',
  contact: '/illustrations/support/contact-conversation-studio-v1.webp',
  security: '/illustrations/support/security-data-studio-v1.webp',
} as const

/** Editorial art supports the real text and controls; it does not imply a resolved case. */
export default function SupportIllustration({ kind }: { kind: keyof typeof ARTWORK }) {
  return <div className={styles.illustration} aria-hidden="true"><Image src={ARTWORK[kind]} alt="" width={1536} height={1024} sizes="(max-width: 760px) 90vw, 460px" loading="eager" unoptimized /></div>
}
