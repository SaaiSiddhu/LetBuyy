import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class AppBadgeService {
  static const MethodChannel defaultChannel = MethodChannel(
    'com.letbuyy.store/app_badge',
  );

  static const Set<String> openOrderStatuses = {
    'pending',
    'confirmed',
    'processing',
    'paid',
    'packed',
    'ready_to_ship',
    'shipped',
  };

  final MethodChannel _channel;

  const AppBadgeService({MethodChannel channel = defaultChannel})
    : _channel = channel;

  Future<int> syncOpenOrderBadgeFromStatusCounts(
    Map<String, int> statusCounts,
  ) async {
    final count = openOrderCountFromStatusCounts(statusCounts);
    await setBadgeCount(count);
    return count;
  }

  Future<void> setBadgeCount(int count) async {
    final safeCount = count < 0 ? 0 : count;
    try {
      await _channel.invokeMethod<void>('setBadgeCount', {'count': safeCount});
    } on MissingPluginException {
      // Native app badge APIs are not present in Flutter unit tests.
    } on PlatformException catch (error) {
      debugPrint('App badge update unavailable: ${error.code}');
    }
  }

  Future<void> clearBadge() => setBadgeCount(0);

  static int openOrderCountFromStatusCounts(Map<String, int> statusCounts) {
    var total = 0;
    for (final entry in statusCounts.entries) {
      final status = entry.key.toLowerCase().trim();
      if (openOrderStatuses.contains(status)) {
        total += entry.value;
      }
    }
    return total;
  }
}
