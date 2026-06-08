import Link from 'next/link';
import { ArrowRight, Mail } from '@letbuyy/ui';

type InfoPlaceholderProps = {
    eyebrow: string;
    title: string;
    body: string;
    primaryLabel?: string;
    primaryHref?: string;
};

export default function InfoPlaceholder({
    eyebrow,
    title,
    body,
    primaryLabel = 'Contact support',
    primaryHref = 'mailto:support@letbuyy.com',
}: InfoPlaceholderProps) {
    const isMailLink = primaryHref.startsWith('mailto:');
    const PrimaryIcon = isMailLink ? Mail : ArrowRight;

    return (
        <div className="container-main py-16 md:py-24">
            <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-bg-card p-8 shadow-sm">
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary-light">{eyebrow}</p>
                <h1 className="mb-4 text-3xl font-bold text-text-heading md:text-4xl">{title}</h1>
                <p className="mb-8 text-base leading-relaxed text-text-muted">{body}</p>
                {isMailLink ? (
                    <a href={primaryHref} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm">
                        {primaryLabel}
                        <PrimaryIcon className="h-4 w-4" aria-hidden="true" />
                    </a>
                ) : (
                    <Link href={primaryHref} className="btn-primary inline-flex items-center gap-2 px-5 py-3 text-sm">
                        {primaryLabel}
                        <PrimaryIcon className="h-4 w-4" aria-hidden="true" />
                    </Link>
                )}
            </div>
        </div>
    );
}
