import type { MerchantKycDocumentStatus, MerchantKycProviderMode, VerifyKycDocumentResult } from '@letbuyy/infrastructure/kyc-verification-adapter';

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
        && row.metadata.profile_change_requires_resubmission !== true
        && !row.metadata.provider_unavailable && !row.metadata.sandbox;
}

export function acceptsLiveKycApproval(
    row: KycEvidenceStatusRow,
    result: Omit<VerifyKycDocumentResult, 'providerReference'> & { providerReference: string | null },
): boolean {
    // Provider output cannot supply or change the private object pointer or
    // scanner verdict. Both must come from the current stored evidence row.
    return hasLiveProviderEvidence({
        status: result.status,
        provider: result.provider,
        provider_mode: result.providerMode,
        provider_reference: result.providerReference,
        metadata: {
            ...row.metadata,
            provider_verified: result.metadata.provider_verified === true,
            provider_unavailable: result.metadata.provider_unavailable === true,
            sandbox: result.providerMode === 'sandbox',
        },
    });
}

export function effectiveKycDocumentStatus(row: KycEvidenceStatusRow): 'draft' | MerchantKycDocumentStatus {
    return row.status === 'verified' && !hasLiveProviderEvidence(row) ? 'needs_review' : row.status;
}
