'use client';

import { useMemo, useState, type FormEvent } from 'react';
import type { AppVersion, MarketplaceApp, MarketplaceReviewRecord } from '@letbuyy/shared-types';
import { Button, Clock, Input, Send, Textarea } from '@letbuyy/ui';

interface DeveloperAppVersionManagerProps {
    app: MarketplaceApp;
    initialVersions?: AppVersion[];
    latestReview?: MarketplaceReviewRecord | null;
}

function formatStatus(value: string | null | undefined): string {
    return String(value || 'draft').replace(/_/g, ' ');
}

function versionDate(version: AppVersion): string {
    const date = version.released_at || version.submitted_at || version.created_at;
    return date ? new Date(date).toLocaleDateString('en-IN') : 'No date';
}

function nextPatchVersion(current: string | null | undefined): string {
    const parts = String(current || '1.0.0').split('.').map((part) => Number(part));
    if (parts.length >= 3 && parts.every((part) => Number.isFinite(part))) {
        parts[2] += 1;
        return parts.slice(0, 3).join('.');
    }
    return `${current || '1.0.0'}-next`;
}

export function DeveloperAppVersionManager({ app, initialVersions = [], latestReview }: DeveloperAppVersionManagerProps) {
    const [versions, setVersions] = useState<AppVersion[]>(initialVersions);
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [savingListing, setSavingListing] = useState(false);
    const [submittingVersion, setSubmittingVersion] = useState(false);
    const [listingForm, setListingForm] = useState({
        name: app.name || '',
        tagline: app.tagline || '',
        app_url: app.app_url || '',
        privacy_policy_url: app.privacy_policy_url || app.privacy_url || '',
        documentation_url: app.documentation_url || '',
    });
    const [versionForm, setVersionForm] = useState({
        version: nextPatchVersion(app.current_version || app.version),
        release_notes: '',
        changelog: '',
        rollout_percentage: '100',
    });
    const latestVersion = useMemo(() => versions[0] || null, [versions]);

    async function postDeveloperAction(body: Record<string, unknown>) {
        const response = await fetch('/api/developers/apps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });
        const payload = await response.json();
        if (!response.ok) {
            const responseError = payload?.error?.message || payload?.error || 'Request failed';
            throw new Error(String(responseError));
        }
        return payload.data;
    }

    async function handleListingSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSavingListing(true);
        setError(null);
        setMessage(null);
        try {
            await postDeveloperAction({
                action: 'update_app',
                app_id: app.id,
                app: listingForm,
            });
            setMessage('Listing update submitted for review.');
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Listing update failed');
        } finally {
            setSavingListing(false);
        }
    }

    async function handleVersionSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setSubmittingVersion(true);
        setError(null);
        setMessage(null);
        try {
            const result = await postDeveloperAction({
                action: 'create_version',
                app_id: app.id,
                version: {
                    version: versionForm.version,
                    release_notes: versionForm.release_notes,
                    changelog: versionForm.changelog.split('\n').map((item) => item.trim()).filter(Boolean),
                    rollout_percentage: Number(versionForm.rollout_percentage || 100),
                },
            });
            if (result?.version) {
                setVersions((current) => [result.version, ...current.filter((item) => item.id !== result.version.id)]);
            }
            setVersionForm((current) => ({
                version: nextPatchVersion(current.version),
                release_notes: '',
                changelog: '',
                rollout_percentage: '100',
            }));
            setMessage('Version submitted for review.');
        } catch (requestError) {
            setError(requestError instanceof Error ? requestError.message : 'Version submission failed');
        } finally {
            setSubmittingVersion(false);
        }
    }

    return (
        <div className="dashboard-version-panel">
            <div className="dashboard-version-panel__header">
                <div>
                    <div className="dev-stat-label">Current version</div>
                    <strong>{app.current_version || app.version || '1.0.0'}</strong>
                </div>
                <span className="marketplace-badge marketplace-badge--neutral">
                    {latestReview ? formatStatus(latestReview.status) : formatStatus(latestVersion?.status)}
                </span>
            </div>

            <form className="dashboard-version-form" onSubmit={handleListingSubmit}>
                <Input
                    label="App name"
                    value={listingForm.name}
                    onChange={(event) => setListingForm((current) => ({ ...current, name: event.target.value }))}
                />
                <Input
                    label="Tagline"
                    value={listingForm.tagline}
                    onChange={(event) => setListingForm((current) => ({ ...current, tagline: event.target.value }))}
                />
                <Input
                    label="App URL"
                    value={listingForm.app_url}
                    onChange={(event) => setListingForm((current) => ({ ...current, app_url: event.target.value }))}
                />
                <Input
                    label="Privacy URL"
                    value={listingForm.privacy_policy_url}
                    onChange={(event) => setListingForm((current) => ({ ...current, privacy_policy_url: event.target.value }))}
                />
                <Input
                    label="Docs URL"
                    value={listingForm.documentation_url}
                    onChange={(event) => setListingForm((current) => ({ ...current, documentation_url: event.target.value }))}
                />
                <Button type="submit" disabled={savingListing}>
                    <Send size={14} />
                    {savingListing ? 'Submitting' : 'Submit listing update'}
                </Button>
            </form>

            <form className="dashboard-version-form" onSubmit={handleVersionSubmit}>
                <div className="dashboard-version-form__row">
                    <Input
                        label="New version"
                        value={versionForm.version}
                        onChange={(event) => setVersionForm((current) => ({ ...current, version: event.target.value }))}
                    />
                    <Input
                        label="Rollout %"
                        type="number"
                        min={0}
                        max={100}
                        value={versionForm.rollout_percentage}
                        onChange={(event) => setVersionForm((current) => ({ ...current, rollout_percentage: event.target.value }))}
                    />
                </div>
                <Textarea
                    label="Release notes"
                    value={versionForm.release_notes}
                    onChange={(event) => setVersionForm((current) => ({ ...current, release_notes: event.target.value }))}
                />
                <Textarea
                    label="Changelog"
                    helperText="One item per line."
                    value={versionForm.changelog}
                    onChange={(event) => setVersionForm((current) => ({ ...current, changelog: event.target.value }))}
                />
                <Button type="submit" disabled={submittingVersion || !versionForm.release_notes.trim()}>
                    <Clock size={14} />
                    {submittingVersion ? 'Submitting' : 'Submit new version'}
                </Button>
            </form>

            {message && <p className="marketplace-panel-copy marketplace-icon-success">{message}</p>}
            {error && <p className="marketplace-panel-copy marketplace-icon-critical">{error}</p>}

            <div className="dashboard-version-history">
                {versions.length === 0 ? (
                    <p className="marketplace-panel-copy">No version history yet.</p>
                ) : (
                    versions.slice(0, 4).map((version) => (
                        <div key={version.id} className="dashboard-version-row">
                            <div>
                                <strong>{version.version}</strong>
                                <p className="marketplace-panel-copy">{version.release_notes || 'No release notes'}</p>
                            </div>
                            <div className="dashboard-version-row__meta">
                                <span className="marketplace-badge marketplace-badge--neutral">{formatStatus(version.status)}</span>
                                <span>{version.rollout_percentage}%</span>
                                <span>{versionDate(version)}</span>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
