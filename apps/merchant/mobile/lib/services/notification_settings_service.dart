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

  factory NotificationSettings.fromPreferenceRows({
    required String storeId,
    required List<Map<String, dynamic>> rows,
  }) {
    var settings = NotificationSettings.defaults(storeId);
    for (final row in rows) {
      final channel = _stringValue(row['channel']);
      final category = _stringValue(row['category']);
      final enabled = _boolValue(row['enabled'], fallback: true);

      if (category == 'system') {
        if (channel == 'email') {
          settings = settings.copyWith(emailEnabled: enabled);
        } else if (channel == 'sms') {
          settings = settings.copyWith(smsEnabled: enabled);
        } else if (channel == 'push') {
          settings = settings.copyWith(pushEnabled: enabled);
        }
        continue;
      }

      if (channel != 'push') continue;
      settings = switch (category) {
        'order_created' ||
        'new_order' => settings.copyWith(orderCreated: enabled),
        'order_paid' || 'payment' => settings.copyWith(orderPaid: enabled),
        'low_stock' => settings.copyWith(lowStock: enabled),
        'refunds' || 'refund' => settings.copyWith(refunds: enabled),
        'customer_signup' ||
        'new_contact' => settings.copyWith(customerSignup: enabled),
        'marketing' => settings.copyWith(marketing: enabled),
        _ => settings,
      };
    }
    return settings;
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

  List<Map<String, dynamic>> toPreferenceRows() => [
    {
      'store_id': storeId,
      'channel': 'email',
      'category': 'system',
      'enabled': emailEnabled,
    },
    {
      'store_id': storeId,
      'channel': 'sms',
      'category': 'system',
      'enabled': smsEnabled,
    },
    {
      'store_id': storeId,
      'channel': 'push',
      'category': 'system',
      'enabled': pushEnabled,
    },
    {
      'store_id': storeId,
      'channel': 'push',
      'category': 'order_created',
      'enabled': orderCreated,
    },
    {
      'store_id': storeId,
      'channel': 'push',
      'category': 'order_paid',
      'enabled': orderPaid,
    },
    {
      'store_id': storeId,
      'channel': 'push',
      'category': 'low_stock',
      'enabled': lowStock,
    },
    {
      'store_id': storeId,
      'channel': 'push',
      'category': 'refunds',
      'enabled': refunds,
    },
    {
      'store_id': storeId,
      'channel': 'push',
      'category': 'customer_signup',
      'enabled': customerSignup,
    },
    {
      'store_id': storeId,
      'channel': 'push',
      'category': 'marketing',
      'enabled': marketing,
    },
  ];

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

class MerchantNotification {
  const MerchantNotification({
    required this.id,
    required this.userId,
    required this.type,
    required this.title,
    required this.message,
    required this.data,
    required this.actionUrl,
    required this.isRead,
    required this.createdAt,
  });

  factory MerchantNotification.fromJson(Map<String, dynamic> json) {
    return MerchantNotification(
      id: _stringValue(json['id']),
      userId: _stringValue(json['user_id']),
      type: _stringValue(json['type'], fallback: 'system'),
      title: _stringValue(json['title'], fallback: 'Notification'),
      message: _nullableString(json['message']),
      data: _mapValue(json['data']),
      actionUrl: _nullableString(json['action_url']),
      isRead: _boolValue(json['is_read']),
      createdAt:
          DateTime.tryParse(_stringValue(json['created_at'])) ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
    );
  }

  final String id;
  final String userId;
  final String type;
  final String title;
  final String? message;
  final Map<String, dynamic> data;
  final String? actionUrl;
  final bool isRead;
  final DateTime createdAt;

  MerchantNotification copyWith({bool? isRead}) {
    return MerchantNotification(
      id: id,
      userId: userId,
      type: type,
      title: title,
      message: message,
      data: data,
      actionUrl: actionUrl,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt,
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

  static String? _nullableString(Object? value) {
    final text = value?.toString().trim();
    return text == null || text.isEmpty ? null : text;
  }

  static String _stringValue(Object? value, {String fallback = ''}) {
    final text = value?.toString() ?? '';
    return text.isEmpty ? fallback : text;
  }
}

class NotificationSettingsService extends ChangeNotifier {
  NotificationSettingsService({required ApiClient api}) : _api = api;

  final ApiClient _api;

  NotificationSettings? _settings;
  NotificationSettings? get settings => _settings;

  List<MerchantNotification> _notifications = [];
  List<MerchantNotification> get notifications =>
      List.unmodifiable(_notifications);

  bool _inboxHasNext = false;
  bool get inboxHasNext => _inboxHasNext;

  int _unreadCount = 0;
  int get unreadCount => _unreadCount;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  Future<NotificationSettings> fetchSettings(String storeId) async {
    _isLoading = true;
    notifyListeners();

    try {
      final rows = await _api.notifications.getPreferences(storeId);
      _settings = rows.isEmpty
          ? NotificationSettings.defaults(storeId)
          : NotificationSettings.fromPreferenceRows(
              storeId: storeId,
              rows: rows,
            );
      return _settings!;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<List<MerchantNotification>> fetchInbox({
    bool? isRead,
    int page = 1,
    int limit = 20,
  }) async {
    _isLoading = true;
    notifyListeners();

    try {
      final response = await _api.notifications.list(
        isRead: isRead,
        page: page,
        limit: limit,
      );
      _notifications = response.data
          .map(MerchantNotification.fromJson)
          .toList(growable: false);
      _inboxHasNext = response.hasNext ?? response.hasMore;
      return _notifications;
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<int> fetchUnreadCount() async {
    _unreadCount = await _api.notifications.unreadCount();
    notifyListeners();
    return _unreadCount;
  }

  Future<void> markRead(String id) async {
    await _api.notifications.markRead(id);
    final wasUnread = _notifications.any(
      (item) => item.id == id && !item.isRead,
    );
    _notifications = _notifications
        .map((item) => item.id == id ? item.copyWith(isRead: true) : item)
        .toList(growable: false);
    if (wasUnread && _unreadCount > 0) _unreadCount--;
    notifyListeners();
  }

  Future<void> markAllRead() async {
    await _api.notifications.markAllRead();
    _notifications = _notifications
        .map((item) => item.copyWith(isRead: true))
        .toList(growable: false);
    _unreadCount = 0;
    notifyListeners();
  }

  Future<void> deleteNotification(String id) async {
    await _api.notifications.remove(id);
    final wasUnread = _notifications.any(
      (item) => item.id == id && !item.isRead,
    );
    _notifications = _notifications
        .where((item) => item.id != id)
        .toList(growable: false);
    if (wasUnread && _unreadCount > 0) _unreadCount--;
    notifyListeners();
  }

  Future<NotificationSettings> updateSettings(
    NotificationSettings settings,
  ) async {
    for (final row in settings.toPreferenceRows()) {
      await _api.notifications.upsertPreference(row);
    }
    _settings = settings;
    notifyListeners();
    return _settings!;
  }
}
