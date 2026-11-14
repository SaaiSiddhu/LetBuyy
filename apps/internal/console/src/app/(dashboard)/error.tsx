'use client';
import { Button } from '@letbuyy/ui';
import { AlertTriangle, RefreshCw } from 'lucide-react';
export default function WorkspaceError({ reset }: { reset: () => void }) {
    return <section className="p-6"><div className="space-y-4 rounded-lg border border-line bg-surface p-6" role="alert"><AlertTriangle size={24} className="text-warning" /><h1>We couldn’t load this workspace</h1><p className="text-subdued">Retry to reconnect. If the issue continues, check platform health or contact your administrator.</p><Button onClick={reset}><RefreshCw size={16} />Retry workspace</Button></div></section>;
}
