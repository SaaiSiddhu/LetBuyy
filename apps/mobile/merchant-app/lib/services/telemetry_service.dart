import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:letbuyy_models/merchant_contracts.dart';
import 'package:shared_preferences/shared_preferences.dart';

typedef TelemetryValueProvider = String? Function();

abstract class MerchantTelemetrySink {
  Future<void> record(MerchantTelemetryEvent event);
  Future<List<MerchantTelemetryEvent>> pendingEvents();
}

class MemoryTelemetrySink implements MerchantTelemetrySink {
  MemoryTelemetrySink({this.capacity = 200});

  final int capacity;
  final List<MerchantTelemetryEvent> _events = <MerchantTelemetryEvent>[];

  @override
  Future<void> record(MerchantTelemetryEvent event) async {
    _events.add(event);
    if (_events.length > capacity) {
      _events.removeRange(0, _events.length - capacity);
    }
  }

  @override
  Future<List<MerchantTelemetryEvent>> pendingEvents() async {
    return List<MerchantTelemetryEvent>.unmodifiable(_events);
  }
}

class SharedPreferencesTelemetrySink implements MerchantTelemetrySink {
  SharedPreferencesTelemetrySink._(this._prefs, {this.capacity = 200});

  static const storageKey = 'letbuyy.telemetry.events';

  final SharedPreferences _prefs;
  final int capacity;

  static Future<SharedPreferencesTelemetrySink> open({
    int capacity = 200,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    return SharedPreferencesTelemetrySink._(prefs, capacity: capacity);
  }

  @override
  Future<void> record(MerchantTelemetryEvent event) async {
    final events = await pendingEvents();
    final next = [...events, event];
    final trimmed = next.length > capacity
        ? next.sublist(next.length - capacity)
        : next;
    await _prefs.setString(
      storageKey,
      jsonEncode(trimmed.map((event) => event.toJson()).toList()),
    );
  }

  @override
  Future<List<MerchantTelemetryEvent>> pendingEvents() async {
    final raw = _prefs.getString(storageKey);
    if (raw == null || raw.isEmpty) return const <MerchantTelemetryEvent>[];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return const <MerchantTelemetryEvent>[];
    return decoded
        .whereType<Map>()
        .map(
          (item) =>
              MerchantTelemetryEvent.fromJson(Map<String, dynamic>.from(item)),
        )
        .toList(growable: false);
  }
}

class TelemetryService extends ChangeNotifier {
  TelemetryService({
    required MerchantTelemetrySink sink,
    TelemetryValueProvider? storeIdProvider,
    TelemetryValueProvider? userIdProvider,
    DateTime Function()? clock,
  }) : _sink = sink,
       _storeIdProvider = storeIdProvider,
       _userIdProvider = userIdProvider,
       _clock = clock ?? DateTime.now;

  final MerchantTelemetrySink _sink;
  final TelemetryValueProvider? _storeIdProvider;
  final TelemetryValueProvider? _userIdProvider;
  final DateTime Function() _clock;

  int _sequence = 0;
  int _failedEvents = 0;
  String? _lastError;

  int get failedEvents => _failedEvents;
  String? get lastError => _lastError;

  Future<void> track(
    String name, {
    String? storeId,
    String? userId,
    String? route,
    TelemetryMetadata metadata = const {},
  }) async {
    final event = MerchantTelemetryEvent(
      id: _nextEventId(),
      name: name,
      occurredAt: _clock(),
      storeId: storeId ?? _storeIdProvider?.call(),
      userId: userId ?? _userIdProvider?.call(),
      route: route,
      metadata: metadata,
    );
    try {
      await _sink.record(event);
      _lastError = null;
    } catch (error) {
      _failedEvents += 1;
      _lastError = error.toString();
    } finally {
      notifyListeners();
    }
  }

  Future<void> trackScreenView(
    String route, {
    TelemetryMetadata metadata = const {},
  }) {
    return track(
      MerchantTelemetryEventNames.screenViewed,
      route: route,
      metadata: metadata,
    );
  }

  Future<void> trackAction(
    String action, {
    String? route,
    TelemetryMetadata metadata = const {},
  }) {
    return track(
      MerchantTelemetryEventNames.actionTriggered,
      route: route,
      metadata: {'action': action, ...metadata},
    );
  }

  Future<List<MerchantTelemetryEvent>> pendingEvents() {
    return _sink.pendingEvents();
  }

  String _nextEventId() {
    _sequence += 1;
    return 'mobile:${_clock().microsecondsSinceEpoch}:$_sequence';
  }
}

class TelemetryNavigatorObserver extends NavigatorObserver {
  TelemetryNavigatorObserver(this.telemetry);

  final TelemetryService telemetry;

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    _trackRoute(route);
  }

  @override
  void didReplace({Route<dynamic>? newRoute, Route<dynamic>? oldRoute}) {
    if (newRoute != null) _trackRoute(newRoute);
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    if (previousRoute != null) _trackRoute(previousRoute);
  }

  void _trackRoute(Route<dynamic> route) {
    final name = route.settings.name;
    if (name == null || name.isEmpty) return;
    unawaited(telemetry.trackScreenView(name));
  }
}
