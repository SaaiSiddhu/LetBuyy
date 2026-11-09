// Synthetic public Gateway contract; contains no private file/scan/provider payload.
const kycSiteA = '8a55c36a-1460-42bb-8fa4-f499c92b5c01';
const kycSiteB = '8a55c36a-1460-42bb-8fa4-f499c92b5c02';
const kycDocumentA = '8a55c36a-1460-42bb-8fa4-f499c92b5c11';
Map<String, dynamic> publicKycDocument(
  String site, {
  String id = kycDocumentA,
  String status = 'submitted',
  String kind = 'bank_proof',
  String? reference,
}) => {
  'id': id,
  'site_id': site,
  'document_type': kind,
  'status': status,
  'provider': 'letbuyy_sandbox_kyc',
  'provider_mode': 'sandbox',
  'provider_reference': reference,
  'has_private_upload': true,
  'evidence_scan_status': 'pending',
  'document_number_last4': '1234',
  'created_at': '2026-11-06T00:00:00Z',
  'updated_at': '2026-11-06T00:00:00+00:00',
};
Map<String, dynamic> publicKycOverview(
  String site, {
  List<Object?>? documents,
  String status = 'in_progress',
  bool privateUpload = true,
  bool india = false,
}) => {
  'site_id': site,
  'overall_status': status,
  'provider_mode': 'sandbox',
  'private_upload_available': privateUpload,
  'india_direct_upload_available': india,
  'documents': documents ?? [publicKycDocument(site)],
  'required_documents': [
    {
      'document_type': 'bank_proof',
      'title': 'Bank proof',
      'required': true,
      'status': 'submitted',
    },
  ],
};
