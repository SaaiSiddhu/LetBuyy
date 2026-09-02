enum LogLevel { debug, info, warning, error }

final class StructuredLogEvent {
  const StructuredLogEvent({
    required this.level,
    required this.message,
    required this.timestamp,
    this.traceId,
    this.requestId,
    this.fields = const {},
  });

  final LogLevel level;
  final String message;
  final DateTime timestamp;
  final String? traceId;
  final String? requestId;
  final Map<String, Object?> fields;

  Map<String, Object?> toJson() => {
        'level': level.name,
        'message': message,
        'timestamp': timestamp.toUtc().toIso8601String(),
        if (traceId != null) 'trace_id': traceId,
        if (requestId != null) 'request_id': requestId,
        ...fields,
      };
}

abstract interface class StructuredLogger {
  void write(StructuredLogEvent event);
}

final class BufferingStructuredLogger implements StructuredLogger {
  BufferingStructuredLogger({this.maxEvents = 200});

  final int maxEvents;
  final List<StructuredLogEvent> _events = [];

  List<StructuredLogEvent> get events => List.unmodifiable(_events);

  @override
  void write(StructuredLogEvent event) {
    _events.add(event);
    if (_events.length > maxEvents) {
      _events.removeAt(0);
    }
  }
}
