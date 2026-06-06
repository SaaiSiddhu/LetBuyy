class SkipNeedsBackendException implements Exception {
  const SkipNeedsBackendException(this.id, this.message);

  final String id;
  final String message;

  @override
  String toString() => 'SKIP-NEEDS-BACKEND: $id: $message';
}
