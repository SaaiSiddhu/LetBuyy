import 'package:quickcommerce_api/quickcommerce_api.dart';

final class RiderEnvironment {
  const RiderEnvironment({
    required this.name,
    required this.apiBaseUrl,
    required this.realtimeUrl,
    required this.sentryDsn,
    required this.traceSampleRate,
    required this.defaultLatitude,
    required this.defaultLongitude,
  });

  final String name;
  final Uri apiBaseUrl;
  final Uri realtimeUrl;
  final String sentryDsn;
  final double traceSampleRate;
  final double defaultLatitude;
  final double defaultLongitude;

  ApiEnvironment toApiEnvironment() =>
      ApiEnvironment(apiBaseUrl: apiBaseUrl, realtimeUrl: realtimeUrl);

  factory RiderEnvironment.fromCompileTime() {
    return RiderEnvironment(
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
            const String.fromEnvironment(
              'TRACE_SAMPLE_RATE',
              defaultValue: '0.1',
            ),
          ) ??
          0.1,
      defaultLatitude: double.tryParse(
            const String.fromEnvironment(
              'DEFAULT_RIDER_LATITUDE',
              defaultValue: '12.9716',
            ),
          ) ??
          12.9716,
      defaultLongitude: double.tryParse(
            const String.fromEnvironment(
              'DEFAULT_RIDER_LONGITUDE',
              defaultValue: '77.5946',
            ),
          ) ??
          77.5946,
    );
  }
}
