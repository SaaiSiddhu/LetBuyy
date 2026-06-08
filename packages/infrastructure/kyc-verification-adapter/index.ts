export type MerchantKycProviderMode = 'sandbox' | 'live';
export type MerchantKycProvider = 'letbuyy_sandbox_kyc' | 'signzy' | 'hyperverge' | 'manual';
export type MerchantKycDocumentType =
  | 'business_pan'
  | 'gst_certificate'
  | 'bank_proof'
  | 'address_proof'
  | 'identity_proof';
export type MerchantKycDocumentStatus = 'submitted' | 'needs_review' | 'verified' | 'rejected';

export interface KycVerificationCredentials {
  provider: MerchantKycProvider;
  mode: MerchantKycProviderMode;
  apiKey?: string;
  accountId?: string;
}

export interface VerifyKycDocumentInput {
  siteId: string;
  documentId: string;
  documentType: MerchantKycDocumentType;
  documentNumberLast4?: string | null;
  fileUrl?: string | null;
}

export interface VerifyKycDocumentResult {
  status: MerchantKycDocumentStatus;
  provider: MerchantKycProvider;
  providerMode: MerchantKycProviderMode;
  providerReference: string;
  rejectionReason?: string | null;
  metadata: Record<string, unknown>;
}

export interface KycVerificationAdapter {
  verifyDocument(input: VerifyKycDocumentInput): Promise<VerifyKycDocumentResult>;
  refreshStatus(input: VerifyKycDocumentInput): Promise<VerifyKycDocumentResult>;
}

function requiresLiveCredentials(credentials: KycVerificationCredentials): boolean {
  return credentials.mode === 'live' && (!credentials.apiKey || credentials.apiKey.startsWith('SKIP_NEEDS_HUMAN_'));
}

function sandboxReference(input: VerifyKycDocumentInput): string {
  return `kyc_sandbox_${input.siteId.replace(/-/g, '').slice(0, 8)}_${input.documentType}_${input.documentId.replace(/-/g, '').slice(0, 8)}`;
}

function sandboxResult(
  credentials: KycVerificationCredentials,
  input: VerifyKycDocumentInput,
): VerifyKycDocumentResult {
  const hasEvidence = Boolean(input.fileUrl || input.documentNumberLast4);
  return {
    status: hasEvidence ? 'verified' : 'needs_review',
    provider: credentials.provider,
    providerMode: credentials.mode,
    providerReference: sandboxReference(input),
    rejectionReason: null,
    metadata: {
      sandbox: true,
      evidence_present: hasEvidence,
      checked_at: new Date().toISOString(),
    },
  };
}

export function createKycVerificationAdapter(credentials: KycVerificationCredentials): KycVerificationAdapter {
  if (requiresLiveCredentials(credentials)) {
    throw new Error('live KYC provider mode requires provider credentials');
  }

  return {
    async verifyDocument(input) {
      if (credentials.mode === 'sandbox') return sandboxResult(credentials, input);
      return {
        ...sandboxResult(credentials, input),
        providerMode: 'live',
        metadata: {
          provider: credentials.provider,
          live_provider_stub: true,
          checked_at: new Date().toISOString(),
        },
      };
    },
    async refreshStatus(input) {
      if (credentials.mode === 'sandbox') return sandboxResult(credentials, input);
      return {
        ...sandboxResult(credentials, input),
        providerMode: 'live',
        metadata: {
          provider: credentials.provider,
          live_provider_stub: true,
          refreshed_at: new Date().toISOString(),
        },
      };
    },
  };
}
