'use client';

import { useEffect, useState, useTransition } from 'react';
import { Button, Heart } from '@letbuyy/ui';

interface SaveAppButtonProps {
    appId: string;
    appName: string;
    source?: string;
}

export function SaveAppButton({ appId, appName, source = 'app_detail' }: SaveAppButtonProps) {
    const [saved, setSaved] = useState(false);
    const [message, setMessage] = useState('');
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        let mounted = true;
        fetch('/api/apps/search?kind=saved_apps')
            .then((response) => response.ok ? response.json() : null)
            .then((payload: { saved_apps?: Array<{ app_id?: string }> } | null) => {
                if (!mounted) return;
                setSaved(Boolean(payload?.saved_apps?.some((item) => item.app_id === appId)));
            })
            .catch(() => undefined);
        return () => {
            mounted = false;
        };
    }, [appId]);

    function toggleSaved() {
        startTransition(async () => {
            setMessage('');
            const response = saved
                ? await fetch('/api/apps/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'unsave_app', app_id: appId }),
                }).catch(() => null)
                : await fetch('/api/apps/search', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'save_app',
                        saved_app: { app_id: appId, source, metadata: { app_name: appName } },
                    }),
                }).catch(() => null);

            if (!response?.ok) {
                setMessage('Sign in to save apps.');
                return;
            }
            setSaved((current) => !current);
            setMessage(saved ? 'Removed from saved apps.' : 'Saved.');
        });
    }

    return (
        <div className="save-app-control">
            <Button type="button" variant="secondary" onClick={toggleSaved} disabled={pending} aria-pressed={saved}>
                <Heart size={15} aria-hidden="true" fill={saved ? 'currentColor' : 'none'} />
                {pending ? 'Saving' : saved ? 'Saved' : 'Save app'}
            </Button>
            {message && <span className="save-app-control__message">{message}</span>}
        </div>
    );
}
