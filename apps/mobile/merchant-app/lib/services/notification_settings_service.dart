import 'package:flutter/foundation.dart';

import 'api_client.dart';

class NotificationSettings {
  const NotificationSettings({
    required this.storeId,
    required this.emailEnabled,
    required this.smsEnabled,
    required this.pushEnabled,
    required this.orderCreated,
    required this.orderPaid,
    required this.lowStock,
    required this.refunds,
    required this.customerSignup,
    required this.marketing,
  });

  factory NotificationSettings.fromJson(Map<String, dynamic> json) {
    final channels = _mapValue(json['channels']);
    final events = _mapValue(json['events'] ?? json['preferences']);
    return NotificationSettings(
      storeId: _stringValue(json['store_id']),
      emailEnabled: _boolValue(
        channels['email'] ?? json['email_enabled'],
        fallback: true,
      ),
      smsEnabled: _boolValue(channels['sms'] ?? json['sms_enabled']),
      pushEnabled: _boolValue(
        channels['push'] ?? json['push_enabled'],
        fallback: true,
      ),
      orderCreated: _boolValue(
        events['order_created'] ?? json['order_created'],
        fallback: true,
      ),
      orderPaid: _boolValue(
        events['order_paid'] ?? json['order_paid'],
        fallback: true,
      ),
      lowStock: _boolValue(
        events['low_stock'] ?? json['low_stock'],
        fallback: true,
      ),
      refunds: _boolValue(events['refunds'] ?? json['refunds'], fallback: true),
      customerSignup: _boolValue(
        events['customer_signup'] ?? json['customer_signup'],
        fallback: true,
      ),
      marketing: _boolValue(events['marketing'] ?? json['marketing']),
    );
  }

  factory NotificationSettings.defaults(String storeId) {
    return NotificationSettings(
      storeId: storeId,
      emailEnabled: true,
      smsEnabled: false,
      pushEnabled: true,
      orderCreated: true,
      orderPaid: true,
      lowStock: true,
      refunds: true,
      customerSignup: true,
      marketing: false,
    );
  }

  final String storeId;
  final bool emailEnabled;
  final bool smsEnabled;
  final bool pushEnabled;
  final bool orderCreated;
  final bool orderPaid;
  final bool lowStock;
  final bool refunds;
  final bool customerSignup;
  final bool marketing;

  Map<String, dynamic> toJson() => {
    'store_id': storeId,
    'channels': {'email': emailEnabled, 'sms': smsEnabled, 'push': pushEnabled},
    'events': {
      'order_created': orderCreated,
      'order_paid': orderPaid,
      'low_stock': lowStock,
      'refunds': refunds,
      'customer_signup': customerSignup,
      'marketing': marketing,
    },
  };

  NotificationSettings copyWith({
    bool? emailEnabled,
    bool? smsEnabled,
    bool? pushEnabled,
    bool? orderCreated,
    bool? orderPaid,
    bool? lowStock,
    bool? refunds,
    bool? customerSignup,
    bool? marketing,
  }) {
    return NotificationSettings(
      storeId: storeId,
      emailEnabled: emailEnabled ?? this.emailEnabled,
      smsEnabled: smsEnabled ?? this.smsEnabled,
      pushEnabled: pushEnabled ?? this.pushEnabled,
      orderCreated: orderCreated ?? this.orderCreated,
      orderPaid: orderPaid ?? this.orderPaid,
      lowStock: lowStock ?? this.lowStock,
      refunds: refunds ?? this.refunds,
      customerSignup: customerSignup ?? this.customerSignup,
      marketing: marketing ?? this.marketing,
    );
  }

  static Map<String, dynamic> _mapValue(Object? value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return const {};
  }

  static bool _boolValue(Object? value, {bool fallback = false}) {
    return value is bool ? value : fallback;
  }

  static String _stringValue(Object? value) {
    return value?.toString() ?? '';
  }
}

class NotificationSettingsService extends ChangeNotifier {
  NotificationSettingsService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  NotificationSettings? _settings;
  NotificationSettings? get settings => _settings;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<NotificationSettings> fetchSettings(String storeId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final json = await _api.notifications.getPreferences(storeId);
      _settings = json.isEmpty
          ? NotificationSettings.defaults(storeId)
          : NotificationSettings.fromJson({'store_id': storeId, ...json});
      return _settings!;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<NotificationSettings> updateSettings(
    NotificationSettings settings,
  ) async {
    final json = await _api.notifications.updatePreferences(settings.toJson());
    _settings = json.isEmpty
        ? settings
        : NotificationSettings.fromJson({...settings.toJson(), ...json});
    notifyListeners();
    return _settings!;
  }
}
