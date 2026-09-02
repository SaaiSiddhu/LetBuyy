import 'dart:async';
import 'dart:convert';

import 'package:quickcommerce_observability/quickcommerce_observability.dart';
import 'package:web_socket_channel/web_socket_channel.dart';

import 'realtime_channel.dart';

enum RealtimeConnectionPhase {
  disconnected,
  connecting,
  connected,
  reconnecting,
  unauthorized,
  degraded,
}

final class RealtimeConnectionState {
  const RealtimeConnectionState({
    required this.phase,
    required this.updatedAt,
    this.reason,
  });

  final RealtimeConnectionPhase phase;
  final DateTime updatedAt;
  final String? reason;
}

final class RealtimeMessage {
  const RealtimeMessage({
    required this.channel,
    required this.event,
    required this.payload,
    required this.receivedAt,
    this.eventId,
    this.version,
  });

  final RealtimeChannel channel;
  final String event;
  final Map<String, Object?> payload;
  final DateTime receivedAt;
  final String? eventId;
  final int? version;
}

abstract interface class RealtimeAuthTokenProvider {
  Future<String?> accessToken();
}

abstract interface class RealtimeClient {
  Stream<RealtimeConnectionState> watchConnection();
  Stream<RealtimeMessage> subscribe(RealtimeChannel channel);
  Future<void> connect();
  Future<void> disconnect();
}

final class ReconnectPolicy {
  const ReconnectPolicy({
    this.initialDelay = const Duration(milliseconds: 300),
    this.maxDelay = const Duration(seconds: 20),
  });

  final Duration initialDelay;
  final Duration maxDelay;

  Duration delayForAttempt(int attempt) {
    final multiplier = 1 << attempt.clamp(0, 6);
    final delay = initialDelay * multiplier;
    return delay > maxDelay ? maxDelay : delay;
  }
}

final class GatewayRealtimeClient implements RealtimeClient {
  GatewayRealtimeClient({
    required Uri realtimeUrl,
    required RealtimeAuthTokenProvider tokenProvider,
    required StructuredLogger logger,
    ReconnectPolicy reconnectPolicy = const ReconnectPolicy(),
  })  : _realtimeUrl = realtimeUrl,
        _tokenProvider = tokenProvider,
        _logger = logger,
        _reconnectPolicy = reconnectPolicy;

  final Uri _realtimeUrl;
  final RealtimeAuthTokenProvider _tokenProvider;
  final StructuredLogger _logger;
  final ReconnectPolicy _reconnectPolicy;
  final Map<String, StreamController<RealtimeMessage>> _subscriptions = {};
  final Map<String, WebSocketChannel> _roomChannels = {};
  final Map<String, StreamSubscription<Object?>> _roomSocketSubscriptions = {};
  final StreamController<RealtimeConnectionState> _connectionController =
      StreamController<RealtimeConnectionState>.broadcast();

  WebSocketChannel? _channel;
  StreamSubscription<Object?>? _socketSubscription;
  Timer? _heartbeatTimer;
  int _attempt = 0;
  bool _manuallyDisconnected = false;

  @override
  Stream<RealtimeConnectionState> watchConnection() {
    return _connectionController.stream;
  }

  @override
  Stream<RealtimeMessage> subscribe(RealtimeChannel channel) {
    final controller = _subscriptions.putIfAbsent(
      channel.name,
      () => StreamController<RealtimeMessage>.broadcast(
        onListen: () {
          _sendSubscribe(channel);
          _ensureOrderRoom(channel);
        },
      ),
    );
    _sendSubscribe(channel);
    _ensureOrderRoom(channel);
    return controller.stream;
  }

  @override
  Future<void> connect() async {
    _manuallyDisconnected = false;
    _emit(RealtimeConnectionPhase.connecting);
    final token = await _tokenProvider.accessToken();
    if (token == null || token.isEmpty) {
      _emit(RealtimeConnectionPhase.unauthorized, 'missing_token');
      return;
    }

    final uri = _realtimeUrl.replace(
      path: _joinPath(_realtimeUrl.path, '/v1/ws'),
      queryParameters: {
        ..._realtimeUrl.queryParameters,
        'access_token': token,
      },
    );

    try {
      _channel = WebSocketChannel.connect(uri);
      await _channel!.ready;
      _attempt = 0;
      _emit(RealtimeConnectionPhase.connected);
      _socketSubscription = _channel!.stream.listen(
        _handleMessage,
        onError: (Object error, StackTrace stackTrace) {
          _logger.write(
            StructuredLogEvent(
              level: LogLevel.warning,
              message: 'realtime_socket_error',
              timestamp: DateTime.now(),
              fields: {'error': error.toString()},
            ),
          );
          _scheduleReconnect('socket_error');
        },
        onDone: () => _scheduleReconnect('socket_closed'),
        cancelOnError: true,
      );
      _startHeartbeat();
      for (final channel in _subscriptions.keys) {
        _send({'type': 'subscribe', 'channel': channel});
      }
    } catch (error) {
      _logger.write(
        StructuredLogEvent(
          level: LogLevel.warning,
          message: 'realtime_connect_failed',
          timestamp: DateTime.now(),
          fields: {'error': error.toString()},
        ),
      );
      _scheduleReconnect('connect_failed');
    }
  }

  @override
  Future<void> disconnect() async {
    _manuallyDisconnected = true;
    _heartbeatTimer?.cancel();
    await _socketSubscription?.cancel();
    for (final subscription in _roomSocketSubscriptions.values) {
      await subscription.cancel();
    }
    for (final channel in _roomChannels.values) {
      await channel.sink.close();
    }
    _roomSocketSubscriptions.clear();
    _roomChannels.clear();
    await _channel?.sink.close();
    _emit(RealtimeConnectionPhase.disconnected);
  }

  void _sendSubscribe(RealtimeChannel channel) {
    _send({'type': 'subscribe', 'channel': channel.name});
  }

  void _handleMessage(Object? raw) {
    if (raw is! String) {
      return;
    }
    final decoded = jsonDecode(raw);
    if (decoded is! Map) {
      return;
    }
    final type = decoded['type'] as String?;
    if (type == 'pong') {
      return;
    }
    final channelName = decoded['channel'] as String?;
    if (channelName == null) {
      return;
    }
    final controller = _subscriptions[channelName];
    if (controller == null) {
      return;
    }
    controller.add(
      RealtimeMessage(
        channel: RealtimeChannel(
          scope: _scopeFromName(channelName),
          name: channelName,
        ),
        event: decoded['event'] as String? ?? type ?? 'message',
        payload: (decoded['payload'] as Map?)?.cast<String, Object?>() ??
            (decoded['snapshot'] as Map?)?.cast<String, Object?>() ??
            const <String, Object?>{},
        eventId: decoded['event_id'] as String?,
        version: decoded['version'] as int?,
        receivedAt: DateTime.now(),
      ),
    );
  }

  void _ensureOrderRoom(RealtimeChannel channel) {
    if (channel.scope != RealtimeChannelScope.delivery ||
        !channel.name.startsWith('delivery.live.')) {
      return;
    }
    if (_roomChannels.containsKey(channel.name)) {
      return;
    }
    unawaited(_connectOrderRoom(channel));
  }

  Future<void> _connectOrderRoom(RealtimeChannel channel) async {
    final token = await _tokenProvider.accessToken();
    if (token == null ||
        token.isEmpty ||
        _roomChannels.containsKey(channel.name)) {
      return;
    }
    final roomId = channel.name.split('.').last;
    final uri = _realtimeUrl.replace(
      path: _joinPath(_realtimeUrl.path, '/ws/orders/$roomId'),
      queryParameters: {
        ..._realtimeUrl.queryParameters,
        'token': token,
      },
    );

    try {
      final roomChannel = WebSocketChannel.connect(uri);
      _roomChannels[channel.name] = roomChannel;
      await roomChannel.ready;
      _roomSocketSubscriptions[channel.name] = roomChannel.stream.listen(
        (raw) => _handleRoomMessage(channel, raw),
        onError: (Object error, StackTrace stackTrace) {
          _logger.write(
            StructuredLogEvent(
              level: LogLevel.warning,
              message: 'realtime_order_room_error',
              timestamp: DateTime.now(),
              fields: {'channel': channel.name, 'error': error.toString()},
            ),
          );
          _roomChannels.remove(channel.name);
        },
        onDone: () {
          _roomChannels.remove(channel.name);
          _roomSocketSubscriptions.remove(channel.name);
        },
        cancelOnError: true,
      );
    } catch (error) {
      _roomChannels.remove(channel.name);
      _logger.write(
        StructuredLogEvent(
          level: LogLevel.warning,
          message: 'realtime_order_room_connect_failed',
          timestamp: DateTime.now(),
          fields: {'channel': channel.name, 'error': error.toString()},
        ),
      );
    }
  }

  void _handleRoomMessage(RealtimeChannel channel, Object? raw) {
    if (raw is! String) {
      return;
    }
    final decoded = jsonDecode(raw);
    if (decoded is! Map) {
      return;
    }
    final type = decoded['type'] as String?;
    if (type == 'pong') {
      return;
    }
    final snapshot = (decoded['snapshot'] as Map?)?.cast<String, Object?>() ??
        (decoded['payload'] as Map?)?.cast<String, Object?>() ??
        const <String, Object?>{};
    if (snapshot.isEmpty) {
      return;
    }
    final payload = <String, Object?>{
      ...snapshot,
      'deliveryId': snapshot['deliveryId'] ?? channel.name.split('.').last,
    };
    _subscriptions[channel.name]?.add(
      RealtimeMessage(
        channel: channel,
        event: decoded['event'] as String? ?? type ?? 'message',
        payload: payload,
        eventId: decoded['event_id'] as String?,
        version: decoded['version'] as int?,
        receivedAt: DateTime.now(),
      ),
    );
  }

  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      _send({'type': 'ping', 'sent_at': DateTime.now().toIso8601String()});
    });
  }

  void _scheduleReconnect(String reason) {
    if (_manuallyDisconnected) {
      return;
    }
    _heartbeatTimer?.cancel();
    _emit(RealtimeConnectionPhase.reconnecting, reason);
    final delay = _reconnectPolicy.delayForAttempt(_attempt++);
    Timer(delay, connect);
  }

  void _send(Map<String, Object?> payload) {
    final channel = _channel;
    if (channel == null) {
      return;
    }
    channel.sink.add(jsonEncode(payload));
  }

  void _emit(RealtimeConnectionPhase phase, [String? reason]) {
    _connectionController.add(
      RealtimeConnectionState(
        phase: phase,
        reason: reason,
        updatedAt: DateTime.now(),
      ),
    );
  }
}

RealtimeChannelScope _scopeFromName(String name) {
  if (name.startsWith('delivery.')) return RealtimeChannelScope.delivery;
  if (name.startsWith('rider.')) return RealtimeChannelScope.rider;
  if (name.startsWith('store.')) return RealtimeChannelScope.store;
  if (name.startsWith('ops.')) return RealtimeChannelScope.operations;
  return RealtimeChannelScope.user;
}

String _joinPath(String base, String suffix) {
  final normalizedBase =
      base.endsWith('/') ? base.substring(0, base.length - 1) : base;
  return '$normalizedBase$suffix';
}
