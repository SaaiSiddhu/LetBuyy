'use client';

import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Input, Upload } from '@letbuyy/ui';
import { cn } from '@/lib/utils';

const THEME_UPLOAD_MAX_BYTES = 512 * 1024;

function getUploadErrorMessage(payload: Record<string, unknown> | null) {
    const errorValue = payload?.error;

    if (typeof errorValue === 'string') return errorValue;
    if (errorValue && typeof errorValue === 'object' && !Array.isArray(errorValue)) {
        const message = (errorValue as Record<string, unknown>).message;
        if (typeof message === 'string') return message;
    }

    return 'Theme package upload failed';
}

export default function ThemeUploadPanel() {
    const router = useRouter();
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [agreementAccepted, setAgreementAccepted] = useState(false);

    const handleBundleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file || uploading) return;

        if (!agreementAccepted) {
            setUploadStatus(null);
            setUploadError('Accept the developer submission terms before uploading a package.');
            event.target.value = '';
            return;
        }

        if (file.size > THEME_UPLOAD_MAX_BYTES) {
            setUploadStatus(null);
            setUploadError('Theme package JSON must be 512 KB or smaller.');
            event.target.value = '';
            return;
        }

        setUploading(true);
        setUploadStatus(null);
        setUploadError(null);

        try {
            const bundle = JSON.parse(await file.text()) as unknown;
            if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
                throw new Error('Theme package must be a JSON object');
            }

            const response = await fetch('/api/themes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bundle }),
            });
            const payload = await response.json().catch(() => null) as Record<string, unknown> | null;

            if (!response.ok) {
                throw new Error(getUploadErrorMessage(payload));
            }

            const theme = payload?.theme && typeof payload.theme === 'object' && !Array.isArray(payload.theme)
                ? payload.theme as Record<string, unknown>
                : {};
            const themeName = typeof theme.name === 'string' && theme.name.trim() ? theme.name : 'theme package';
            setUploadStatus(`Uploaded ${themeName}`);
            router.refresh();
        } catch (error) {
            setUploadError(error instanceof Error ? error.message : 'Theme package upload failed');
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    return (
        <Card layout="stack" className="gap-[var(--lb-space-3)] p-[var(--lb-density-card-padding)]">
            <div className="space-y-[var(--lb-space-1)]">
                <h2 className="m-0 text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-semibold)] leading-[var(--lb-line-height-body)] text-[color:var(--lb-color-text)]">
                    Theme package upload
                </h2>
                <p className="m-0 text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                    Portable JSON themes are validated by the marketplace API. Use the developer console for review status, scanner status, payout readiness, and commercial metadata.
                </p>
            </div>

            {uploadStatus && (
                <p className="m-0 rounded-[var(--lb-radius-md)] border border-[var(--lb-component-banner-success-border)] bg-[var(--lb-component-banner-success-bg)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-component-banner-success-text)]">
                    {uploadStatus}
                </p>
            )}

            {uploadError && (
                <p className="m-0 rounded-[var(--lb-radius-md)] border border-[var(--lb-component-banner-danger-border)] bg-[var(--lb-component-banner-danger-bg)] px-[var(--lb-space-3)] py-[var(--lb-space-2)] text-[length:var(--lb-font-size-caption)] text-[color:var(--lb-component-banner-danger-text)]">
                    {uploadError}
                </p>
            )}

            <label className="flex items-start gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-color-border)] bg-[var(--lb-color-surface-subdued)] p-[var(--lb-space-3)] text-[length:var(--lb-font-size-caption)] leading-[var(--lb-line-height-caption)] text-[color:var(--lb-color-text-subdued)]">
                <Input unstyled
                    type="checkbox"
                    checked={agreementAccepted}
                    onChange={(event) => setAgreementAccepted(event.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[var(--lb-color-border)] accent-[var(--lb-color-primary)]"
                />
                <span>
                    I confirm this JSON package is mine to submit and understand that marketplace review, malware scanning, and commercial approval are not completed by this local upload.
                </span>
            </label>

            <label className={cn(
                'inline-flex h-[var(--lb-density-button-height)] cursor-pointer items-center justify-center gap-[var(--lb-space-2)] rounded-[var(--lb-radius-md)] border border-[var(--lb-component-button-secondary-border)] bg-[var(--lb-component-button-secondary-bg)] px-[var(--lb-space-3)] text-[length:var(--lb-font-size-body)] font-[var(--lb-font-weight-medium)] text-[color:var(--lb-component-button-secondary-text)] transition-colors hover:bg-[var(--lb-component-button-secondary-hover)] focus-within:ring-2 focus-within:ring-[var(--lb-color-focus-ring)]',
                uploading && 'pointer-events-none opacity-70',
                !agreementAccepted && 'cursor-not-allowed opacity-60',
            )}>
                <Upload className="h-[var(--lb-size-icon-inline)] w-[var(--lb-size-icon-inline)]" aria-hidden="true" />
                {uploading ? 'Uploading' : 'Upload JSON'}
                <Input unstyled
                    type="file"
                    accept="application/json,.json"
                    className="sr-only"
                    disabled={uploading || !agreementAccepted}
                    onChange={handleBundleUpload}
                />
            </label>
        </Card>
    );
}
