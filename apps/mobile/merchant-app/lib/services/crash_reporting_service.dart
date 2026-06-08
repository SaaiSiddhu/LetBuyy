import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:letbuyy_models/merchant_contracts.dart';
import 'package:shared_preferences/shared_preferences.dart';

typedef CrashContextProvider = String? Function();

abstract class CrashReportingSink {
  Future<void> record(CrashReport report);
  Future<List<CrashReport>> pendingReports();
}

class CrashReport {
  CrashReport({
    required this.id,
    required this.occurredAt,
    required this.errorType,
    required String message,
    required String stackTrace,
    required this.environment,
    required this.release,
    this.storeId,
    this.userId,
    this.source = 'merchant_mobile',
    this.fatal = false,
    TelemetryMetadata metadata = const {},
  }) : message = sanitizeCrashText(message, maxLength: 500),
       stackTrace = sanitizeCrashText(stackTrace, maxLength: 6000),
       metadata = sanitizeTelemetryMetadata(metadata);

  final String id;
  final DateTime occurredAt;
  final String errorType;
  final String message;
  final String stackTrace;
  final String environment;
  final String release;
  final String? storeId;
  final String? userId;
  final String source;
  final bool fatal;
  final TelemetryMetadata metadata;

  Map<String, Object?> toJson() => {
    'id': id,
    'occurred_at': occurredAt.toUtc().toIso8601String(),
    'error_type': errorType,
    'message': message,
    'stack_trace': stackTrace,
    'environment': environment,
    'release': release,
    'store_id': storeId,
    'user_id': userId,
    'source': source,
    'fatal': fatal,
    'metadata': metadata,
  };

  factory CrashReport.fromJson(Map<String, dynamic> json) {
    return CrashReport(
      id: json['id']?.toString() ?? '',
      occurredAt:
          DateTime.tryParse(json['occurred_at']?.toString() ?? '') ??
          DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
      errorType: json['error_type']?.toString() ?? 'Error',
      message: json['message']?.toString() ?? 'Unhandled error',
      stackTrace: json['stack_trace']?.toString() ?? '',
      environment: json['environment']?.toString() ?? 'development',
      release: json['release']?.toString() ?? 'unknown',
      storeId: _optionalString(json['store_id']),
      userId: _optionalString(json['user_id']),
      source: json['source']?.toString() ?? 'merchant_mobile',
      fatal: json['fatal'] == true,
      metadata: sanitizeTelemetryMetadata(
        Map<String, Object?>.from(json['metadata'] as Map? ?? const {}),
      ),
    );
  }
}

class MemoryCrashReportingSink implements CrashReportingSink {
  MemoryCrashReportingSink({this.capacity = 50});

  final int capacity;
  final List<CrashReport> _reports = <CrashReport>[];

  @override
  Future<void> record(CrashReport report) async {
    _reports.add(report);
    if (_reports.length > capacity) {
      _reports.removeRange(0, _reports.length - capacity);
    }
  }

  @override
  Future<List<CrashReport>> pendingReports() async {
    return List<CrashReport>.unmodifiable(_reports);
  }
}

class SharedPreferencesCrashReportingSink implements CrashReportingSink {
  SharedPreferencesCrashReportingSink._(this._prefs, {this.capacity = 50});

  static const storageKey = 'letbuyy.crash_reports';

  final SharedPreferences _prefs;
  final int capacity;

  static Future<SharedPreferencesCrashReportingSink> open({
    int capacity = 50,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    return SharedPreferencesCrashReportingSink._(prefs, capacity: capacity);
  }

  @override
  Future<void> record(CrashReport report) async {
    final reports = await pendingReports();
    final next = [...reports, report];
    final trimmed = next.length > capacity
        ? next.sublist(next.length - capacity)
        : next;
    await _prefs.setString(
      storageKey,
      jsonEncode(trimmed.map((report) => report.toJson()).toList()),
    );
  }

  @override
  Future<List<CrashReport>> pendingReports() async {
    final raw = _prefs.getString(storageKey);
    if (raw == null || raw.isEmpty) return const <CrashReport>[];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return const <CrashReport>[];
    return decoded
        .whereType<Map>()
        .map((item) => CrashReport.fromJson(Map<String, dynamic>.from(item)))
        .toList(growable: false);
  }
}

class CompositeCrashReportingSink implements CrashReportingSink {
  CompositeCrashReportingSink(this._sinks);

  final List<CrashReportingSink> _sinks;

  @override
  Future<void> record(CrashReport report) async {
    Object? firstError;
    for (final sink in _sinks) {
      try {
        await sink.record(report);
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError != null) throw firstError;
  }

  @override
  Future<List<CrashReport>> pendingReports() {
    return _sinks.isEmpty
        ? Future.value(const <CrashReport>[])
        : _sinks.first.pendingReports();
  }
}

class SentryCrashReportingSink implements CrashReportingSink {
  SentryCrashReportingSink._({
    required this.endpoint,
    required String publicKey,
    http.Client? client,
  }) : _publicKey = publicKey,
       _client = client ?? http.Client();

  final Uri endpoint;
  final String _publicKey;
  final http.Client _client;

  factory SentryCrashReportingSink.fromDsn(String dsn, {http.Client? client}) {
    final uri = Uri.parse(dsn.trim());
    final publicKey = uri.userInfo.split(':').first.trim();
    final segments = uri.pathSegments
        .where((segment) => segment.trim().isNotEmpty)
        .toList(growable: false);
    if (!uri.hasScheme || uri.host.isEmpty || publicKey.isEmpty) {
      throw const FormatException('Invalid crash reporting DSN');
    }
    if (segments.isEmpty) {
      throw const FormatException('Crash reporting DSN missing project id');
    }
    final projectId = segments.last;
    final prefix = segments.length > 1
        ? '/${segments.take(segments.length - 1).join('/')}'
        : '';
    final endpoint = uri.replace(
      userInfo: '',
      path: '$prefix/api/$projectId/store/',
      query: null,
      fragment: null,
    );
    return SentryCrashReportingSink._(
      endpoint: endpoint,
      publicKey: publicKey,
      client: client,
    );
  }

  @override
  Future<void> record(CrashReport report) async {
    final response = await _client.post(
      endpoint,
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth':
            'Sentry sentry_version=7, sentry_client=letbuyy-merchant-mobile/1.0, sentry_key=$_publicKey',
      },
      body: jsonEncode(_toSentryPayload(report)),
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw StateError('Crash provider rejected report');
    }
  }

  @override
  Future<List<CrashReport>> pendingReports() async {
    return const <CrashReport>[];
  }

  Map<String, Object?> _toSentryPayload(CrashReport report) => {
    'event_id': report.id
        .replaceAll(RegExp(r'[^a-fA-F0-9]'), '')
        .padRight(32, '0')
        .substring(0, 32),
    'timestamp': report.occurredAt.toUtc().toIso8601String(),
    'platform': 'dart',
    'logger': 'merchant_mobile',
    'level': report.fatal ? 'fatal' : 'error',
    'environment': report.environment,
    'release': report.release,
    'message': report.message,
    'exception': {
      'values': [
        {'type': report.errorType, 'value': report.message},
      ],
    },
    if (report.userId != null) 'user': {'id': report.userId},
    'tags': {
      if (report.storeId != null) 'store_id': report.storeId,
      'source': report.source,
    },
    'extra': {'stack_trace': report.stackTrace, ...report.metadata},
  };
}

class CrashReportingService extends ChangeNotifier {
  CrashReportingService({
    required CrashReportingSink sink,
    required String environment,
    required String release,
    CrashContextProvider? storeIdProvider,
    CrashContextProvider? userIdProvider,
    DateTime Function()? clock,
  }) : _sink = sink,
       _environment = environment,
       _release = release,
       _storeIdProvider = storeIdProvider,
       _userIdProvider = userIdProvider,
       _clock = clock ?? DateTime.now;

  final CrashReportingSink _sink;
  final String _environment;
  final String _release;
  final CrashContextProvider? _storeIdProvider;
  final CrashContextProvider? _userIdProvider;
  final DateTime Function() _clock;

  int _sequence = 0;
  int _failedReports = 0;
  String? _lastError;

  int get failedReports => _failedReports;
  String? get lastError => _lastError;

  Future<void> recordFlutterError(
    FlutterErrorDetails details, {
    bool fatal = false,
  }) {
    final exception = details.exception;
    return recordError(
      exception,
      details.stack ?? StackTrace.current,
      fatal: fatal,
      source: 'flutter_framework',
      metadata: {
        'library': details.library,
        'context': details.context?.toDescription(),
      },
    );
  }

  Future<void> recordError(
    Object error,
    StackTrace stackTrace, {
    bool fatal = false,
    String source = 'merchant_mobile',
    TelemetryMetadata metadata = const {},
  }) async {
    final report = CrashReport(
      id: _nextReportId(),
      occurredAt: _clock(),
      errorType: error.runtimeType.toString(),
      message: error.toString(),
      stackTrace: stackTrace.toString(),
      environment: _environment,
      release: _release,
      storeId: _storeIdProvider?.call(),
      userId: _userIdProvider?.call(),
      source: source,
      fatal: fatal,
      metadata: metadata,
    );
    try {
      await _sink.record(report);
      _lastError = null;
    } catch (error) {
      _failedReports += 1;
      _lastError = error.toString();
    } finally {
      notifyListeners();
    }
  }

  Future<List<CrashReport>> pendingReports() {
    return _sink.pendingReports();
  }

  String _nextReportId() {
    _sequence += 1;
    return 'crash${_clock().microsecondsSinceEpoch}$_sequence';
  }
}

Future<CrashReportingSink> buildMerchantCrashReportingSink({
  required String sentryDsn,
  required bool sentryEnabled,
}) async {
  final localSink = await SharedPreferencesCrashReportingSink.open();
  if (!sentryEnabled) return localSink;
  try {
    return CompositeCrashReportingSink([
      localSink,
      SentryCrashReportingSink.fromDsn(sentryDsn),
    ]);
  } on FormatException {
    return localSink;
  }
}

String sanitizeCrashText(String input, {int maxLength = 1000}) {
  var output = input;
  output = output.replaceAll(
    RegExp(r'SKIP_NEEDS_HUMAN_[A-Z0-9_]+'),
    'configuration unavailable',
  );
  output = output.replaceAll(RegExp(r'S-0\d{2}'), 'capability unavailable');
  output = output.replaceAll(
    RegExp(r'SkipNeedsBackendException', caseSensitive: false),
    'capability unavailable',
  );
  output = output.replaceAll(
    RegExp(r'needs backend contract', caseSensitive: false),
    'capability unavailable',
  );
  output = output.replaceAllMapped(
    RegExp(
      r'(token|secret|password|authorization|cookie)\s*[:=]\s*[^,\s)]+',
      caseSensitive: false,
    ),
    (match) => '${match.group(1)}=[redacted]',
  );
  output = output.trim();
  return output.length <= maxLength ? output : output.substring(0, maxLength);
}

String? _optionalString(Object? value) {
  final string = value?.toString();
  return string == null || string.isEmpty ? null : string;
}
