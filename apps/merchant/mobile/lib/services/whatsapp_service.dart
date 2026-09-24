import 'package:flutter/foundation.dart';

import 'api_client.dart';

class WhatsAppUnavailableException implements Exception {
  const WhatsAppUnavailableException([
    this.message = 'WhatsApp messages are unavailable right now.',
  ]);

  final String message;

  @override
  String toString() => message;
}

class WhatsAppService extends ChangeNotifier {
  WhatsAppService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  List<Map<String, dynamic>> _timeline = [];
  List<Map<String, dynamic>> get timeline => List.unmodifiable(_timeline);

  Future<Map<String, dynamic>> fetchStatus(String storeId) async {
    return _friendlyUnavailable(() => _api.whatsapp.status(storeId: storeId));
  }

  Future<List<Map<String, dynamic>>> fetchTimeline(
    String storeId, {
    String? customerEmail,
    String? customerPhone,
  }) async {
    _isLoading = true;
    notifyListeners();
    try {
      final rows = await _friendlyUnavailable(
        () => _api.whatsapp.timeline(
          storeId: storeId,
          customerEmail: customerEmail,
          customerPhone: customerPhone,
        ),
      );
      _timeline = rows;
      return _timeline;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> sendTemplate({
    required String storeId,
    String? customerEmail,
    String? customerPhone,
    required String template,
    Map<String, dynamic> variables = const {},
    String? message,
  }) async {
    final response = await _friendlyUnavailable(
      () => _api.whatsapp.send({
        'store_id': storeId,
        if (customerEmail != null && customerEmail.trim().isNotEmpty)
          'customer_email': customerEmail.trim(),
        if (customerPhone != null && customerPhone.trim().isNotEmpty)
          'customer_phone': customerPhone.trim(),
        'template': template,
        'variables': variables,
        if (message != null && message.trim().isNotEmpty)
          'message': message.trim(),
        'idempotency_key':
            'wa_${DateTime.now().microsecondsSinceEpoch}_$template',
      }),
    );
    final row = response['message'];
    if (row is Map) {
      _timeline = [Map<String, dynamic>.from(row), ..._timeline];
      notifyListeners();
    }
    return response;
  }

  Future<T> _friendlyUnavailable<T>(Future<T> Function() action) async {
    try {
      return await action();
    } on ApiException catch (error) {
      if (error.code == 'WHATSAPP_UNAVAILABLE' ||
          error.code == 'CUSTOMER_PHONE_REQUIRED') {
        throw const WhatsAppUnavailableException();
      }
      rethrow;
    }
  }
}
