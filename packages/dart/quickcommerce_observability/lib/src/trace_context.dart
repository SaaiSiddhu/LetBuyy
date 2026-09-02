class TraceContext {
  const TraceContext({
    required this.traceId,
    required this.requestId,
  });

  final String traceId;
  final String requestId;

  Map<String, String> toHeaders() {
    return {
      'x-trace-id': traceId,
      'x-request-id': requestId,
    };
  }
}
