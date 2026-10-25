import React from 'react';
import { summarizeProductFacts, type ProductNicheFacts, type AcceptedPersonalization, type ProductVariant } from '@letbuyy/commerce-core';

/** Receives only validated facts/choices saved on this order line, never a live product. */
export function NicheOrderFacts({ facts, personalization, options, itemName, className = '' }: {
    facts?: ProductNicheFacts | null;
    personalization?: AcceptedPersonalization | null;
    options?: ProductVariant['options'] | null;
    className?: string;
    itemName?: string;
}) {
    const id = React.useId();
    const sections = summarizeProductFacts(facts, personalization, options);
    if (sections.length === 1 && sections[0].id === 'unavailable') return <p className={`mt-2 text-sm ${className}`}>Product details were not recorded with this order.</p>;
    return <details className={`mt-3 min-w-0 border-t pt-2 text-sm ${className}`}>
        <summary className="min-h-11 cursor-pointer py-2 font-medium focus-visible:outline-2 focus-visible:outline-offset-2">Saved product details{itemName ? ` for ${itemName}` : ''}</summary>
        <div className="min-w-0 space-y-4 pb-2">
            {sections.map(section => <section key={section.id} aria-labelledby={`${id}-${section.id}`} className="min-w-0 space-y-2">
                <h3 id={`${id}-${section.id}`} className="font-semibold">{section.title}</h3>
                <dl className="min-w-0 space-y-2">
                    {section.rows.map((row, index) => <div key={`${section.id}-${index}`} className="grid min-w-0 gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                        <dt className="min-w-0 break-words font-medium">{row.label}</dt>
                        <dd className="m-0 min-w-0 whitespace-pre-wrap break-words">{row.value}</dd>
                    </div>)}
                </dl>
            </section>)}
        </div>
    </details>;
}
