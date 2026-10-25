import Image from 'next/image'

const ILLUSTRATIONS = {
    launch: '/illustrations/commerce-launch-v1.png',
    support: '/illustrations/merchant-support-v1.png',
    library: '/illustrations/resource-library-v1.png',
    essentials: '/illustrations/commerce-essentials-v1.png',
} as const

interface MarketingIllustrationProps {
    artwork: keyof typeof ILLUSTRATIONS
    className?: string
    sizes?: string
}

/** Supporting art is decorative; all content and actions remain real HTML. */
export default function MarketingIllustration({ artwork, className = '', sizes = '(max-width: 640px) 80vw, 448px' }: MarketingIllustrationProps) {
    return (
        <div className={`marketing-illustration ${className}`} aria-hidden="true">
            <Image
                src={ILLUSTRATIONS[artwork]}
                alt=""
                width={1536}
                height={1024}
                sizes={sizes}
                loading="lazy"
            />
        </div>
    )
}
