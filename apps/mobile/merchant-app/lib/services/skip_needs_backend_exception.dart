class SkipNeedsBackendException implements Exception {
  const SkipNeedsBackendException(this.id, this.message);

  final String id;
  final String message;

  static const userMessage =
      'This action is not available in the mobile app yet.';

  @override
  String toString() => userMessage;
}
