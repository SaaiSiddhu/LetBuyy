import 'package:quickcommerce_api/quickcommerce_api.dart';

final class StoreEnvironment {
  const StoreEnvironment({
    required this.name,
    required this.apiBaseUrl,
    required this.realtimeUrl,
    required this.sentryDsn,
    required this.traceSampleRate,
    required this.defaultStoreId,
  });

  final String name;
  final Uri apiBaseUrl;
  final Uri realtimeUrl;
  final String sentryDsn;
  final double traceSampleRate;
  final String defaultStoreId;

  ApiEnvironment toApiEnvironment() =>
      ApiEnvironment(apiBaseUrl: apiBaseUrl, realtimeUrl: realtimeUrl);

  factory StoreEnvironment.fromCompileTime() {
    return StoreEnvironment(
      name: const String.fromEnvironment('APP_ENV', defaultValue: 'local'),
      apiBaseUrl: Uri.parse(
        const String.fromEnvironment(
          'PUBLIC_API_BASE_URL',
          defaultValue: 'http://localhost:8787',
        ),
      ),
      realtimeUrl: Uri.parse(
        const String.fromEnvironment(
          'PUBLIC_REALTIME_URL',
          defaultValue: 'ws://localhost:8788',
        ),
      ),
      sentryDsn: const String.fromEnvironment('SENTRY_DSN'),
      traceSampleRate: double.tryParse(
            const String.fromEnvironment('TRACE_SAMPLE_RATE',
                defaultValue: '0.1'),
          ) ??
          0.1,
      defaultStoreId: const String.fromEnvironment(
        'DEFAULT_STORE_ID',
        defaultValue: '00000000-0000-4000-8000-000000000301',
      ),
    );
  }
}
