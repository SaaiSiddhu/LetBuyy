'use client';

import React from 'react';
import { Banner, DesignSystemRoot, Input, Page, PageHeader, SaveBar, Section } from './index';

export default { title: 'Merchant/Existing form workflow', parameters: { layout: 'fullscreen' } };

function FormSpecimen({ state, uncertain = false }: { state: 'saved' | 'unsaved' | 'saving'; uncertain?: boolean }) {
    return <DesignSystemRoot surface="admin" theme="light">
        <Page as="main">
            <PageHeader title="General" primaryAction={state === 'saving' ? { label: 'Save', loading: true, loadingLabel: 'Saving changes' } : undefined} />
            <Section variant="grouped" title="Store details">
                <p>Presentation fixture. Merchant integration tests verify persistence and departure decisions.</p>
                <Input label="Store name" defaultValue="Example store" />
            </Section>
            {uncertain && <Banner variant="warning" title="Save not confirmed">Keep this page open and retry the original command before discarding.</Banner>}
            <SaveBar state={state} onSave={() => {}} onDiscard={() => {}} discardDisabled={uncertain} saveLabel={uncertain ? 'Retry pending save' : 'Save'} />
        </Page>
    </DesignSystemRoot>;
}

export const Clean = () => <FormSpecimen state="saved" />;
export const Dirty = () => <FormSpecimen state="unsaved" />;
export const Saving = () => <FormSpecimen state="saving" />;
export const Unconfirmed = () => <FormSpecimen state="unsaved" uncertain />;

export function InteractiveSettings() {
    const [saved, setSaved] = React.useState('Example store');
    const [value, setValue] = React.useState(saved);
    const [saving, setSaving] = React.useState(false);
    return <DesignSystemRoot surface="admin" theme="light"><Page as="main">
        <PageHeader recipe="settings" identity="settings" title="General" showDescription description="Existing Settings layout, shared surfaces and controls." />
        <Section variant="grouped" title="Store details" description="The same heading and boundary as the main workspace.">
            <Input label="Store name" value={value} onChange={e => setValue(e.target.value)} required helperText="Shown to customers." error={!value.trim() ? 'Enter a store name' : undefined} />
        </Section>
        <SaveBar state={saving ? 'saving' : value === saved ? 'saved' : 'unsaved'} saveDisabled={!value.trim()} onSave={async () => { setSaving(true); await new Promise(resolve => setTimeout(resolve, 800)); setSaved(value); setSaving(false); }} onDiscard={() => setValue(saved)} />
    </Page></DesignSystemRoot>;
}
