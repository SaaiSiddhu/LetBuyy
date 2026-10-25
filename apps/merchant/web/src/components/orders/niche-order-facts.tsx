import React from 'react';
import { summarizeProductFacts, type ProductNicheFacts, type AcceptedPersonalization, type ProductVariant } from '@letbuyy/commerce-core';

/** Historical order-line facts; no current catalog fetch or alternate fulfillment authority. */
export function NicheOrderFacts({ facts, personalization, options, itemName, className = '' }: {
    facts?: ProductNicheFacts | null;
    personalization?: AcceptedPersonalization | null;
    options?: ProductVariant['options'] | null;
    className?: string;
    itemName?: string;
}) {
    const id = React.useId();
    const sections = summarizeProductFacts(facts, personalization, options);
    if (sections.length === 1 && sections[0].id === 'unavailable') return <p className={`mt-[var(--lb-space-2)] text-[length:var(--lb-font-size-small)] text-[var(--lb-color-text-secondary)] ${className}`}>Product details were not recorded with this order.</p>;
    return <details className={`mt-[var(--lb-space-3)] min-w-0 border-t border-[var(--lb-color-border)] pt-[var(--lb-space-2)] text-[length:var(--lb-font-size-small)] leading-[var(--lb-line-height-body)] ${className}`}>
        <summary className="min-h-[var(--lb-size-control-lg)] cursor-pointer py-[var(--lb-space-2)] font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)] focus-visible:outline-2 focus-visible:outline-offset-2">Saved product details{itemName ? ` for ${itemName}` : ''}</summary>
        <div className="min-w-0 space-y-[var(--lb-space-4)] pb-[var(--lb-space-2)]">
            {sections.map(section => <section key={section.id} aria-labelledby={`${id}-${section.id}`} className="min-w-0 space-y-[var(--lb-space-2)]">
                <h3 id={`${id}-${section.id}`} className="font-[var(--lb-font-weight-semibold)] text-[var(--lb-color-text)]">{section.title}</h3>
                <dl className="min-w-0 space-y-[var(--lb-space-2)]">
                    {section.rows.map((row, index) => <div key={`${section.id}-${index}`} className="grid min-w-0 gap-[var(--lb-space-1)] md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                        <dt className="min-w-0 break-words font-[var(--lb-font-weight-medium)] text-[var(--lb-color-text)]">{row.label}</dt>
                        <dd className="m-0 min-w-0 whitespace-pre-wrap break-words text-[var(--lb-color-text-secondary)]">{row.value}</dd>
                    </div>)}
                </dl>
            </section>)}
        </div>
    </details>;
}
