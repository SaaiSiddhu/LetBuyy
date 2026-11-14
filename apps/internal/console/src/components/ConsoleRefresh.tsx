'use client';

import { Button } from '@letbuyy/ui';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

export function ConsoleRefresh({ label = 'Refresh workspace', compact = false }: { label?: string; compact?: boolean }) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    return (
        <Button unstyled type="button" className={compact ? 'console-icon-button' : 'console-secondary-button'}
            aria-label={pending ? 'Refreshing workspace' : label} title={label} disabled={pending}
            onClick={() => startTransition(() => router.refresh())}>
            <RefreshCw size={16} aria-hidden="true" className={pending ? 'motion-safe:animate-spin' : ''} />
            {!compact && <span>{pending ? 'Refreshing…' : label}</span>}
        </Button>
    );
}
