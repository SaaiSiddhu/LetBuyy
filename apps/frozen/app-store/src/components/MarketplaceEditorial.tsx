import Image from 'next/image';
import Link from 'next/link';
import type { ComponentType, ReactNode } from 'react';
import { ArrowRight } from '@letbuyy/ui';

interface SectionHeaderProps {
    actionHref?: string;
    actionLabel?: string;
    body?: string;
    eyebrow?: string;
    title: string;
}

export function SectionHeader({ actionHref, actionLabel, body, eyebrow, title }: SectionHeaderProps) {
    return (
        <div className="marketplace-section-header marketplace-section-header--parity">
            <div>
                {eyebrow ? <span className="marketplace-eyebrow">{eyebrow}</span> : null}
                <h2>{title}</h2>
                {body ? <p>{body}</p> : null}
            </div>
            {actionHref && actionLabel ? (
                <Link href={actionHref} className="marketplace-section-action">
                    {actionLabel}
                    <ArrowRight size={15} aria-hidden="true" />
                </Link>
            ) : null}
        </div>
    );
}

interface StoryCardProps {
    ctaLabel?: string;
    eyebrow: string;
    href: string;
    imageAlt?: string;
    imageUrl?: string | null;
    title: string;
}

export function StoryCard({ ctaLabel = 'Read story', eyebrow, href, imageAlt = '', imageUrl, title }: StoryCardProps) {
    return (
        <Link href={href} className="story-card">
            <div className="story-card__media" aria-hidden={!imageAlt}>
                {imageUrl ? (
                    <Image src={imageUrl} alt={imageAlt} width={720} height={420} sizes="(max-width: 768px) 100vw, 360px" />
                ) : (
                    <span className="story-card__media-fallback" />
                )}
            </div>
            <div className="story-card__body">
                <span className="marketplace-eyebrow">{eyebrow}</span>
                <h3>{title}</h3>
                <span className="story-card__cta">
                    {ctaLabel}
                    <ArrowRight size={14} aria-hidden="true" />
                </span>
            </div>
        </Link>
    );
}

interface TestimonialProps {
    appName?: string;
    attribution: string;
    quote: string;
    role?: string;
}

export function Testimonial({ appName, attribution, quote, role }: TestimonialProps) {
    return (
        <figure className="marketplace-testimonial">
            <blockquote>{quote}</blockquote>
            <figcaption>
                <strong>{attribution}</strong>
                {role ? <span>{role}</span> : null}
                {appName ? <span>Uses {appName}</span> : null}
            </figcaption>
        </figure>
    );
}

interface ValuePropProps {
    body: string;
    icon?: ComponentType<{ size?: number; 'aria-hidden'?: boolean | 'true' | 'false' }>;
    title: string;
}

export function ValueProp({ body, icon: Icon, title }: ValuePropProps) {
    return (
        <article className="value-prop">
            {Icon ? (
                <span className="value-prop__icon">
                    <Icon size={19} aria-hidden="true" />
                </span>
            ) : null}
            <h3>{title}</h3>
            <p>{body}</p>
        </article>
    );
}

interface VideoHeroProps {
    children?: ReactNode;
    posterUrl?: string | null;
    videoUrl?: string | null;
}

export function VideoHero({ children, posterUrl, videoUrl }: VideoHeroProps) {
    return (
        <div className="video-hero">
            {videoUrl ? (
                <video className="video-hero__media" autoPlay muted loop playsInline poster={posterUrl ?? undefined}>
                    <source src={videoUrl} />
                </video>
            ) : posterUrl ? (
                <Image src={posterUrl} alt="" fill sizes="100vw" className="video-hero__poster" />
            ) : (
                <span className="video-hero__fallback" aria-hidden="true" />
            )}
            <div className="video-hero__content">{children}</div>
        </div>
    );
}
