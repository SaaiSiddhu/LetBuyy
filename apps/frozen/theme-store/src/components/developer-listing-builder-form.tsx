import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentType, InputHTMLAttributes } from 'react';
import { Button as UiButton, Input as UiInput, Select, Textarea } from '@letbuyy/ui';

interface DeveloperListingBuilderFormProps {
    action?: (formData: FormData) => void | Promise<void>;
    controls?: {
        Input?: ComponentType<InputHTMLAttributes<HTMLInputElement> & { unstyled?: boolean }>;
        Button?: ComponentType<ButtonHTMLAttributes<HTMLButtonElement> & { unstyled?: boolean }>;
    };
}

const inputClass = 'min-h-[44px] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]';
const labelClass = 'grid gap-[var(--lb-space-1)] text-[length:var(--lb-font-size-caption)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-color-text)]';
const legendClass = 'mb-[var(--lb-space-2)] text-[length:var(--lb-font-size-heading-3)] font-[var(--lb-font-weight-semibold)] text-[color:var(--lb-color-text)]';

export default function DeveloperListingBuilderForm({ action, controls }: DeveloperListingBuilderFormProps) {
    const Input = controls?.Input ?? UiInput;
    const Button = controls?.Button ?? UiButton;

    return (
        <form action={action} className="grid gap-[var(--lb-space-5)]" data-testid="developer-listing-builder-form">
            <fieldset className="grid gap-[var(--lb-space-3)] border-0 p-0">
                <legend className={legendClass}>Listing basics</legend>
                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                    <label className={labelClass}>
                        Theme name
                        <Input unstyled name="name" required minLength={3} maxLength={120} className={inputClass} />
                    </label>
                    <label className={labelClass}>
                        Slug
                        <Input unstyled name="slug" required minLength={3} maxLength={80} pattern="[a-z0-9][a-z0-9-]*" className={inputClass} />
                    </label>
                </div>
                <label className={labelClass}>
                    Short description
                    <Input unstyled name="short_description" required minLength={10} maxLength={280} className={inputClass} />
                </label>
                <label className={labelClass}>
                    Long description
                    <Textarea unstyled name="long_description" rows={5} maxLength={5000} className="rounded-[var(--lb-radius-md)] border border-[var(--lb-component-input-border)] bg-[var(--lb-component-input-bg)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]" />
                </label>
            </fieldset>

            <fieldset className="grid gap-[var(--lb-space-3)] border-0 p-0">
                <legend className={legendClass}>Catalog metadata</legend>
                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                    <label className={labelClass}>
                        Category
                        <Select
                            unstyled
                            name="category"
                            required
                            className={inputClass}
                            options={['store'].map((category) => ({ label: category, value: category }))}
                        />
                    </label>
                    <label className={labelClass}>
                        Industries
                        <Input unstyled name="industries" placeholder="fashion, retail" className={inputClass} />
                    </label>
                    <label className={labelClass}>
                        Tags
                        <Input unstyled name="tags" placeholder="minimal, conversion, editorial" className={inputClass} />
                    </label>
                    <label className={labelClass}>
                        Supported platforms
                        <Input unstyled name="supported_platforms" defaultValue="letbuyy,html,react" className={inputClass} />
                    </label>
                </div>
            </fieldset>

            <fieldset className="grid gap-[var(--lb-space-3)] border-0 p-0">
                <legend className={legendClass}>Assets and pricing</legend>
                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                    <label className={labelClass}>
                        Theme zip URL
                        <Input unstyled name="zip_url" placeholder="file:///tmp/theme.zip" className={inputClass} />
                    </label>
                    <label className={labelClass}>
                        Screenshot URLs
                        <Input unstyled name="screenshots" placeholder="https://..." className={inputClass} />
                    </label>
                    <label className={labelClass}>
                        Asset URLs
                        <Input unstyled name="asset_urls" placeholder="https://.../preview.png" className={inputClass} />
                    </label>
                    <label className={labelClass}>
                        Pricing type
                        <Select
                            unstyled
                            name="pricing_type"
                            className={inputClass}
                            options={[
                                { label: 'Free', value: 'free' },
                                { label: 'One-time INR', value: 'one_time' },
                            ]}
                        />
                    </label>
                    <label className={labelClass}>
                        Amount INR
                        <Input unstyled name="amount_inr" type="number" min="0" step="1" defaultValue="0" className={inputClass} />
                    </label>
                </div>
            </fieldset>

            <fieldset className="grid gap-[var(--lb-space-3)] border-0 p-0">
                <legend className={legendClass}>License tiers and review</legend>
                <Link href="/legal/creator-agreement" className="marketplace-text-link">Read the creator submission review document</Link>
                <p>Commercial programme terms remain subject to approval; this document is a review copy.</p>
                <div className="grid gap-[var(--lb-space-3)] md:grid-cols-2">
                    <label className={labelClass}>
                        Standard license tier
                        <Input unstyled name="license_standard" defaultValue="Standard" className={inputClass} />
                    </label>
                    <label className={labelClass}>
                        Extended license tier
                        <Input unstyled name="license_extended" defaultValue="Extended" className={inputClass} />
                    </label>
                </div>
                <div className="grid gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] p-[var(--lb-space-3)]">
                    <label className="flex min-h-[44px] items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]">
                        <Input unstyled name="agreement_accepted" type="checkbox" className="h-4 w-4" required />
                        Developer agreement accepted for this submission
                    </label>
                    <label className="flex min-h-[44px] items-center gap-[var(--lb-space-2)] text-[length:var(--lb-font-size-body)] text-[color:var(--lb-color-text)]">
                        <Input unstyled name="submit" type="checkbox" className="h-4 w-4" />
                        Submit for review now
                    </label>
                </div>
            </fieldset>

            <Button unstyled type="submit" className="inline-flex min-h-[var(--lb-density-button-height)] w-fit items-center justify-center rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-primary-border)] bg-[var(--lb-component-button-primary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-primary-text)]">
                Save listing
            </Button>
        </form>
    );
}
