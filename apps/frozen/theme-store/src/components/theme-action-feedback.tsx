'use client';

import { useEffect, type MouseEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { Button, Package, useToast } from '@letbuyy/ui';

type InstallErrorCode = '' | 'missing_store' | 'purchase_required' | 'install_failed' | string;

function installErrorMessage(error: InstallErrorCode) {
    if (error === 'purchase_required') return 'Purchase this theme before installing it.';
    if (error === 'missing_store') return 'Choose a store before installing.';
    if (error === 'missing_confirmation') return 'Confirm the install impact before continuing.';
    if (error === 'install_failed') return 'Theme installation failed. Try another store or contact support.';
    return 'Theme installation could not be completed.';
}

export function ThemeInstallFeedbackToast({
    error = '',
    installed = '',
    themeName = 'Theme',
}: {
    error?: InstallErrorCode;
    installed?: string;
    themeName?: string;
}) {
    const { notify } = useToast();

    useEffect(() => {
        if (error) {
            notify({
                title: 'Theme install needs attention',
                description: installErrorMessage(error),
                variant: error === 'missing_store' ? 'warning' : 'critical',
            });
            return;
        }

        if (installed) {
            notify({
                title: 'Theme installed',
                description: `${themeName || installed} is now available in your store library.`,
                variant: 'success',
            });
        }
    }, [error, installed, notify, themeName]);

    return null;
}

export function ThemePurchaseSuccessToast({ themeSlug }: { themeSlug?: string }) {
    const { notify } = useToast();

    useEffect(() => {
        notify({
            title: 'Purchase complete',
            description: themeSlug
                ? `${themeSlug} is ready to install.`
                : 'Your theme is ready to install.',
            variant: 'success',
        });
    }, [notify, themeSlug]);

    return null;
}

export function ThemeInstallSubmitButton() {
    const { pending } = useFormStatus();
    const { notify } = useToast();

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
        const form = event.currentTarget.form;
        if (form && !form.reportValidity()) {
            event.preventDefault();
            notify({
                title: 'Choose a store',
                description: 'Select a store before installing this theme.',
                variant: 'warning',
            });
            return;
        }

        notify({
            title: 'Installing theme',
            description: 'Applying this theme to the selected store.',
            variant: 'info',
        });
    };

    return (
        <Button unstyled
            type="submit"
            disabled={pending}
            onClick={handleClick}
            className="btn-primary w-full py-3 flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
            <Package className="w-4 h-4" aria-hidden="true" />
            {pending ? 'Installing...' : 'Install Theme'}
        </Button>
    );
}
