'use client';

import { useState } from 'react';
import { Button, ExternalLink, Monitor, Smartphone } from '@letbuyy/ui';

interface ThemeDemoProps {
    src: string | null;
    name: string;
    anonymous?: boolean;
}

export default function ThemeDemo({ src, name, anonymous = false }: ThemeDemoProps) {
    const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
    const [expanded, setExpanded] = useState(false);
    return <div className="marketplace-demo" data-device={device} data-expanded={expanded}>
        <div className="marketplace-demo-toolbar">
            <strong>{anonymous ? 'Sandbox store preview' : 'Live demo'}</strong>
            <div className="marketplace-demo-controls" role="group" aria-label="Preview display">
                <Button variant={device === 'desktop' ? 'secondary' : 'ghost'} size="icon" type="button" aria-label="Desktop preview" aria-pressed={device === 'desktop'} onClick={() => setDevice('desktop')}><Monitor aria-hidden="true" /></Button>
                <Button variant={device === 'mobile' ? 'secondary' : 'ghost'} size="icon" type="button" aria-label="Mobile preview" aria-pressed={device === 'mobile'} onClick={() => setDevice('mobile')}><Smartphone aria-hidden="true" /></Button>
                <Button variant="ghost" size="icon" type="button" aria-label={expanded ? 'Minimize demo' : 'Maximize demo'} aria-pressed={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? <Monitor aria-hidden="true" /> : <ExternalLink aria-hidden="true" />}</Button>
                {src && <a href={src} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="marketplace-demo-open" aria-label="Open preview in a new tab"><ExternalLink size={16} aria-hidden="true" /></a>}
            </div>
        </div>
        {src ? <div className="marketplace-demo-frame"><iframe title={`${name} ${anonymous ? 'anonymous sandbox preview' : 'live demo'}`} src={src} loading="lazy" sandbox="allow-same-origin allow-scripts allow-forms" referrerPolicy="no-referrer" data-testid={anonymous ? 'anonymous-preview-iframe' : 'theme-live-demo-iframe'} /></div> : <div className="marketplace-demo-unavailable" role="status"><h2>Demo unavailable</h2><p>Choose an available theme listing to open its public sample store.</p></div>}
        <p className="marketplace-demo-caption">Public sample content. Your store is unchanged.</p>
    </div>;
}
