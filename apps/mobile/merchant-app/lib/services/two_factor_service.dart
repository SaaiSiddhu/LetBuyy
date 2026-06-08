import 'package:flutter/foundation.dart';

import 'api_client.dart';

class TwoFactorService extends ChangeNotifier {
  TwoFactorService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Map<String, dynamic>? _overview;
  Map<String, dynamic>? get overview =>
      _overview == null ? null : Map.unmodifiable(_overview!);

  List<Map<String, dynamic>> get factors => _listOfMaps(_overview?['factors']);

  List<Map<String, dynamic>> get sessions =>
      _listOfMaps(_overview?['sessions']);

  bool get isEnabled => _overview?['mfa_enabled'] == true;

  Future<Map<String, dynamic>> fetchOverview() async {
    _isLoading = true;
    notifyListeners();
    try {
      final response = await _api.twoFactor.overview();
      _overview = Map<String, dynamic>.from(response);
      return _overview!;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<Map<String, dynamic>> enrollTotp() async {
    final response = await _api.twoFactor.enrollTotp();
    return Map<String, dynamic>.from(response);
  }

  Future<Map<String, dynamic>> verifyTotp({
    required String factorId,
    required String code,
  }) async {
    final response = await _api.twoFactor.verifyTotp({
      'factor_id': factorId,
      'code': code,
    });
    await fetchOverview();
    return Map<String, dynamic>.from(response);
  }

  Future<Map<String, dynamic>> disable({
    required String factorId,
    String? code,
  }) async {
    final response = await _api.twoFactor.disable({
      'factor_id': factorId,
      if (code != null && code.isNotEmpty) 'code': code,
    });
    await fetchOverview();
    return Map<String, dynamic>.from(response);
  }

  static List<Map<String, dynamic>> _listOfMaps(Object? value) {
    if (value is! List) return const [];
    return value
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList(growable: false);
  }
}
