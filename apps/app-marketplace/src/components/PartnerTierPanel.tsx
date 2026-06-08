import { Award, CheckCircle2 } from '@letbuyy/ui';
import type { PartnerTier } from '@letbuyy/shared-types';

interface PartnerTierPanelProps {
    tiers: PartnerTier[];
}

function formatTier(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export function PartnerTierPanel({ tiers }: PartnerTierPanelProps) {
    const activeTier = tiers.find((tier) => tier.status === 'active') || tiers[0] || null;
    const metrics = activeTier?.metrics as { published_apps?: number; installs?: number; avg_rating?: number } | null;

    return (
        <div className="partner-tier-panel">
            <div className="partner-tier-panel__icon">
                <Award size={18} aria-hidden="true" />
            </div>
            <div>
                <h2 className="marketplace-panel-title marketplace-panel-title--sm">Partner tier</h2>
                {activeTier ? (
                    <>
                        <strong>{formatTier(activeTier.tier)} partner</strong>
                        <p className="marketplace-panel-copy">{activeTier.reason || 'Tier is awarded from current marketplace metrics.'}</p>
                        <div className="marketplace-row marketplace-row--wrap">
                            <span className="marketplace-badge marketplace-badge--neutral">
                                <CheckCircle2 size={12} aria-hidden="true" />
                                {Number(metrics?.published_apps || 0).toLocaleString('en-IN')} published apps
                            </span>
                            <span className="marketplace-badge marketplace-badge--neutral">
                                {Number(metrics?.installs || 0).toLocaleString('en-IN')} installs
                            </span>
                            <span className="marketplace-badge marketplace-badge--neutral">
                                {Number(metrics?.avg_rating || 0).toFixed(1)} avg rating
                            </span>
                        </div>
                    </>
                ) : (
                    <p className="marketplace-panel-copy">Partner tier will appear after marketplace metrics are available.</p>
                )}
            </div>
        </div>
    );
}
