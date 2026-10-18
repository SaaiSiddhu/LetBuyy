import 'package:flutter/foundation.dart';

import 'api_client.dart';

class KycService extends ChangeNotifier {
  KycService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Map<String, dynamic>? _overview;
  Map<String, dynamic>? get overview =>
      _overview == null ? null : Map.unmodifiable(_overview!);

  List<Map<String, dynamic>> get documents =>
      _listOfMaps(_overview?['documents']);

  Future<Map<String, dynamic>> fetchOverview(String storeId) async {
    _isLoading = true;
    notifyListeners();
    try {
      final response = await _api.kyc.overview(query: {'store_id': storeId});
      _overview = Map<String, dynamic>.from(response);
      return _overview!;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> submitDocument({
    required String storeId,
    required String documentType,
    String? documentNumberLast4,
    String? fileUrl,
    String? fileName,
  }) async {
    final response = await _api.kyc.submitDocument({
      'store_id': storeId,
      'document_type': documentType,
      if (documentNumberLast4 != null && documentNumberLast4.isNotEmpty)
        'document_number_last4': documentNumberLast4,
      if (fileUrl != null && fileUrl.isNotEmpty) 'file_url': fileUrl,
      if (fileName != null && fileName.isNotEmpty) 'file_name': fileName,
      'idempotency_key':
          'mobile-kyc-$storeId-$documentType-${DateTime.now().microsecondsSinceEpoch}',
    });
    final overview = response['overview'];
    if (overview is Map) _overview = Map<String, dynamic>.from(overview);
    notifyListeners();
    return response;
  }

  Future<Map<String, dynamic>> refreshDocument(
    String documentId,
    String storeId,
  ) async {
    final response = await _api.kyc.refreshDocument(documentId);
    final overview = response['overview'];
    if (overview is Map) {
      _overview = Map<String, dynamic>.from(overview);
    } else {
      await fetchOverview(storeId);
    }
    notifyListeners();
    return response;
  }

  static List<Map<String, dynamic>> _listOfMaps(Object? value) {
    if (value is! List) return const [];
    return value
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList(growable: false);
  }
}
