import type { MerchantKycDocumentStatus, MerchantKycProviderMode } from '@letbuyy/infrastructure/kyc-verification-adapter';

export interface KycEvidenceStatusRow {
    status: 'draft' | MerchantKycDocumentStatus;
    provider: string;
    provider_mode: MerchantKycProviderMode;
    provider_reference?: string | null;
    metadata?: Record<string, unknown> | null;
}

export function hasLiveProviderEvidence(row: KycEvidenceStatusRow): boolean {
    return row.status === 'verified' && row.provider_mode === 'live'
        && (row.provider === 'signzy' || row.provider === 'hyperverge')
        && Boolean(row.provider_reference) && row.metadata?.provider_verified === true
        && typeof row.metadata?.private_object_key === 'string'
        && row.metadata.malware_scan_status === 'clean'
        && !row.metadata.provider_unavailable && !row.metadata.sandbox;
}

export function effectiveKycDocumentStatus(row: KycEvidenceStatusRow): 'draft' | MerchantKycDocumentStatus {
    return row.status === 'verified' && !hasLiveProviderEvidence(row) ? 'needs_review' : row.status;
}
