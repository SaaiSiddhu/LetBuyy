class RequestMetadata {
  const RequestMetadata({
    required this.traceId,
    this.idempotencyKey,
    this.deviceId,
    this.appVersion,
    this.platform,
  });

  final String traceId;
  final String? idempotencyKey;
  final String? deviceId;
  final String? appVersion;
  final String? platform;

  Map<String, String> toHeaders() {
    return {
      'x-trace-id': traceId,
      if (idempotencyKey != null) 'x-idempotency-key': idempotencyKey!,
      if (deviceId != null) 'x-device-id': deviceId!,
      if (appVersion != null) 'x-app-version': appVersion!,
      if (platform != null) 'x-platform': platform!,
    };
  }
}
