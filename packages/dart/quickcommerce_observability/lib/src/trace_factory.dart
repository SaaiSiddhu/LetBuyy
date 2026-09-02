import 'dart:math';

import 'package:quickcommerce_domain/quickcommerce_domain.dart';

import 'trace_context.dart';

final class TraceFactory {
  TraceFactory({Random? random}) : _random = random ?? Random.secure();

  final Random _random;

  TraceContext createContext() {
    return TraceContext(traceId: _next('trace'), requestId: _next('req'));
  }

  TraceId createTraceId() => TraceId(createContext().traceId);

  IdempotencyKey createIdempotencyKey([String prefix = 'idem']) {
    return IdempotencyKey(_next(prefix));
  }

  String _next(String prefix) {
    final timestamp = DateTime.now().microsecondsSinceEpoch.toRadixString(36);
    final entropy = List<int>.generate(12, (_) => _random.nextInt(36))
        .map((value) => value.toRadixString(36))
        .join();
    return '$prefix-$timestamp-$entropy';
  }
}
