export type IdentityRightRequestType = 'access' | 'correction' | 'erasure' | 'consent_withdrawal';

export interface IdentityRightsRequest {
  id: string;
  principalId: string;
  type: IdentityRightRequestType;
  consentId?: string;
  requestedAt: string;
  status: 'received' | 'verified' | 'completed' | 'rejected';
}

export interface CryptoShredPlan {
  principalId: string;
  erasePrincipal: false;
  revokeCredentials: boolean;
  deleteLegacyRows: false;
  shredKeyRefs: string[];
  humanRequired?: 'HR-LEGAL-DPDP-PA';
}

export function planIdentityErasure(request: IdentityRightsRequest, keyRefs: string[]): CryptoShredPlan {
  return {
    principalId: request.principalId,
    erasePrincipal: false,
    revokeCredentials: request.type === 'erasure',
    deleteLegacyRows: false,
    shredKeyRefs: request.type === 'erasure' ? keyRefs : [],
    humanRequired: 'HR-LEGAL-DPDP-PA',
  };
}
