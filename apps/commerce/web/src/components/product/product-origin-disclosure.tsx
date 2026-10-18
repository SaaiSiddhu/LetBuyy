type ProductOriginDisclosureProps = {
    countryOfOrigin?: string;
    importerDetails?: string;
};

export function ProductOriginDisclosure({ countryOfOrigin, importerDetails }: ProductOriginDisclosureProps) {
    const origin = countryOfOrigin?.trim();
    const importer = importerDetails?.trim();

    if (!origin && !importer) return null;

    return (
        <section aria-labelledby="product-origin-disclosure-title" className="rounded-lg border border-theme-border p-3 text-sm">
            <h3 id="product-origin-disclosure-title" className="mb-2 font-semibold">Origin and importer information</h3>
            <dl className="space-y-2">
                {origin && (
                    <div>
                        <dt className="font-medium">Country of origin</dt>
                        <dd className="text-theme-secondary">{origin}</dd>
                    </div>
                )}
                {importer && (
                    <div>
                        <dt className="font-medium">Importer details</dt>
                        <dd className="whitespace-pre-line text-theme-secondary">{importer}</dd>
                    </div>
                )}
            </dl>
            <p className="mt-2 text-xs text-theme-muted">Provided by the seller; not independently verified by LetBuyy.</p>
        </section>
    );
}
