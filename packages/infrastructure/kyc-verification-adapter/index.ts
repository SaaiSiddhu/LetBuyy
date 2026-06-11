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

export class KycProviderUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'KycProviderUnavailableError';
  }
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
  if (credentials.mode === 'live') {
    throw new KycProviderUnavailableError(
      'KYC_LIVE_PROVIDER_UNAVAILABLE: live KYC provider integration is unavailable until SKIP-CAP-KYC-LIVE-PROVIDER ships',
    );
  }

  return {
    async verifyDocument(input) {
      return sandboxResult(credentials, input);
    },
    async refreshStatus(input) {
      return sandboxResult(credentials, input);
    },
  };
}
