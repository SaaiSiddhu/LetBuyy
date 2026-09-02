class ApiEnvironment {
  const ApiEnvironment({
    required this.apiBaseUrl,
    required this.realtimeUrl,
  });

  final Uri apiBaseUrl;
  final Uri realtimeUrl;
}
