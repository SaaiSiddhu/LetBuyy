// Canonical Dart mirror of MerchantKyc{Overview,Document,Requirement}Schema.
// Public projection only: private object/provider payload fields are rejected.
const merchantKycDocumentTypes = {
  'business_pan',
  'gst_certificate',
  'bank_proof',
  'address_proof',
  'identity_proof',
};
const merchantKycDocumentStatuses = {
  'draft',
  'submitted',
  'needs_review',
  'verified',
  'rejected',
};
const merchantKycEvidenceScanStatuses = {'pending', 'clean', 'rejected'};
const _modes = {'sandbox', 'live'};
Never _badKyc() =>
    throw const FormatException('Verification details could not be confirmed.');
Map<String, dynamic> _object(Object? value, Set<String> allowed) {
  if (value is! Map ||
      value.keys.any((key) => key is! String || !allowed.contains(key)))
    _badKyc();
  return Map<String, dynamic>.from(value);
}

bool _uuid(Object? value) =>
    value is String &&
    (RegExp(
          r'^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[1-8][a-fA-F0-9]{3}-[89aAbB][a-fA-F0-9]{3}-[a-fA-F0-9]{12}$',
        ).hasMatch(value) ||
        value == '00000000-0000-0000-0000-000000000000' ||
        value.toLowerCase() == 'ffffffff-ffff-ffff-ffff-ffffffffffff');
bool _date(Object? value) {
  if (value is! String) return false;
  final match = RegExp(
    r'^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})$',
  ).firstMatch(value);
  if (match == null) return false;
  final year = int.parse(match[1]!),
      month = int.parse(match[2]!),
      day = int.parse(match[3]!);
  final date = DateTime.utc(year, month, day);
  return date.year == year &&
      date.month == month &&
      date.day == day &&
      int.parse(match[4]!) < 24 &&
      int.parse(match[5]!) < 60 &&
      int.parse(match[6] ?? '0') < 60 &&
      DateTime.tryParse(value) != null;
}

void _optionalText(Map<String, dynamic> value, Iterable<String> fields) {
  for (final field in fields)
    if (value[field] != null && value[field] is! String) _badKyc();
}

Object? _freezeKyc(Object? value) => value is Map
    ? Map<String, dynamic>.unmodifiable(
        value.map((k, v) => MapEntry(k as String, _freezeKyc(v))),
      )
    : value is List
    ? List<Object?>.unmodifiable(value.map(_freezeKyc))
    : value;
Map<String, dynamic> _frozen(Map<String, dynamic> value) =>
    _freezeKyc(value) as Map<String, dynamic>;

class MerchantKycDocument {
  MerchantKycDocument._(this._json);
  final Map<String, dynamic> _json;
  factory MerchantKycDocument.fromJson(
    Object? value, {
    String? expectedSiteId,
  }) {
    final row = _object(value, {
      'id',
      'site_id',
      'document_type',
      'status',
      'provider',
      'provider_mode',
      'provider_reference',
      'has_private_upload',
      'evidence_scan_status',
      'provider_unavailable',
      'requires_resubmission',
      'document_number_last4',
      'rejection_reason',
      'submitted_at',
      'verified_at',
      'rejected_at',
      'created_at',
      'updated_at',
      'deleted_at',
    });
    if (!_uuid(row['id']) ||
        !_uuid(row['site_id']) ||
        (expectedSiteId != null && row['site_id'] != expectedSiteId) ||
        !merchantKycDocumentTypes.contains(row['document_type']) ||
        !merchantKycDocumentStatuses.contains(row['status']) ||
        !_modes.contains(row['provider_mode']) ||
        row['provider'] is! String ||
        (row['provider'] as String).isEmpty ||
        (row['provider'] as String).length > 80 ||
        row['has_private_upload'] is! bool ||
        !_date(row['created_at']) ||
        !_date(row['updated_at']))
      _badKyc();
    for (final field in ['provider_unavailable', 'requires_resubmission'])
      if (row.containsKey(field) && row[field] is! bool) _badKyc();
    for (final field in [
      'submitted_at',
      'verified_at',
      'rejected_at',
      'deleted_at',
    ])
      if (row[field] != null && !_date(row[field])) _badKyc();
    if (row['evidence_scan_status'] != null &&
        !merchantKycEvidenceScanStatuses.contains(row['evidence_scan_status']))
      _badKyc();
    _optionalText(row, [
      'provider_reference',
      'document_number_last4',
      'rejection_reason',
    ]);
    return MerchantKycDocument._(_frozen(row));
  }
  Map<String, dynamic> toJson() => _json;
}

class MerchantKycOverview {
  MerchantKycOverview._(this._json);
  final Map<String, dynamic> _json;
  factory MerchantKycOverview.fromJson(
    Object? value, {
    String? expectedSiteId,
  }) {
    final row = _object(value, {
      'site_id',
      'overall_status',
      'provider_mode',
      'private_upload_available',
      'india_direct_upload_available',
      'required_documents',
      'documents',
      'next_action',
    });
    if (!_uuid(row['site_id']) ||
        (expectedSiteId != null && row['site_id'] != expectedSiteId) ||
        !{
          'not_started',
          'in_progress',
          'needs_review',
          'verified',
          'rejected',
        }.contains(row['overall_status']) ||
        !_modes.contains(row['provider_mode']) ||
        row['private_upload_available'] is! bool ||
        (row.containsKey('india_direct_upload_available') &&
            row['india_direct_upload_available'] is! bool))
      _badKyc();
    _optionalText(row, ['next_action']);
    final docs = row.containsKey('documents') ? row['documents'] : <Object?>[];
    final requirements = row.containsKey('required_documents')
        ? row['required_documents']
        : <Object?>[];
    if (docs is! List || requirements is! List) _badKyc();
    final ids = <String>{};
    row['documents'] = [
      for (final raw in docs)
        MerchantKycDocument.fromJson(
          raw,
          expectedSiteId: row['site_id'] as String,
        ).toJson(),
    ];
    for (final doc in row['documents'] as List<Map<String, dynamic>>)
      if (!ids.add(doc['id'] as String)) _badKyc();
    row['required_documents'] = [
      for (final raw in requirements) _requirement(raw),
    ];
    return MerchantKycOverview._(_frozen(row));
  }
  static Map<String, dynamic> _requirement(Object? value) {
    final row = _object(value, {
      'document_type',
      'title',
      'required',
      'status',
    });
    if (!merchantKycDocumentTypes.contains(row['document_type']) ||
        row['title'] is! String ||
        (row['title'] as String).isEmpty ||
        row['required'] is! bool ||
        (row['status'] != null &&
            !merchantKycDocumentStatuses.contains(row['status'])))
      _badKyc();
    return row;
  }

  Map<String, dynamic> toJson() => _json;
}
