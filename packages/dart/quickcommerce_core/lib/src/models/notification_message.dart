import 'json_helpers.dart';

class NotificationMessage {
  const NotificationMessage({
    required this.id,
    required this.channel,
    required this.templateKey,
    this.userId,
    this.title,
    this.body,
    this.payload = const {},
    this.status = 'pending',
    this.providerMessageId,
    this.sentAt,
    this.readAt,
    this.createdAt,
  });

  final String id;
  final String? userId;
  final String channel;
  final String templateKey;
  final String? title;
  final String? body;
  final Map<String, dynamic> payload;
  final String status;
  final String? providerMessageId;
  final DateTime? sentAt;
  final DateTime? readAt;
  final DateTime? createdAt;

  factory NotificationMessage.fromJson(Map<String, dynamic> json) {
    final payload = parseMap(json['payload']);
    return NotificationMessage(
      id: json['id'].toString(),
      userId: json['user_id']?.toString() ?? json['userId']?.toString(),
      channel: json['channel']?.toString() ?? 'push',
      templateKey: json['template_key']?.toString() ?? json['templateKey']?.toString() ?? '',
      title: json['title']?.toString() ?? payload['title']?.toString(),
      body: json['body']?.toString() ?? payload['body']?.toString(),
      payload: payload,
      status: json['status']?.toString() ?? 'pending',
      providerMessageId: json['provider_message_id']?.toString() ?? json['providerMessageId']?.toString(),
      sentAt: parseDateTime(json['sent_at'] ?? json['sentAt']),
      readAt: parseDateTime(json['read_at'] ?? json['readAt']),
      createdAt: parseDateTime(json['created_at'] ?? json['createdAt']),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'channel': channel,
      'template_key': templateKey,
      'title': title,
      'body': body,
      'payload': payload,
      'status': status,
      'provider_message_id': providerMessageId,
      'sent_at': sentAt?.toIso8601String(),
      'read_at': readAt?.toIso8601String(),
      'created_at': createdAt?.toIso8601String(),
    };
  }

  NotificationMessage copyWith({
    String? id,
    String? userId,
    String? channel,
    String? templateKey,
    String? title,
    String? body,
    Map<String, dynamic>? payload,
    String? status,
    String? providerMessageId,
    DateTime? sentAt,
    DateTime? readAt,
    DateTime? createdAt,
  }) {
    return NotificationMessage(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      channel: channel ?? this.channel,
      templateKey: templateKey ?? this.templateKey,
      title: title ?? this.title,
      body: body ?? this.body,
      payload: payload ?? this.payload,
      status: status ?? this.status,
      providerMessageId: providerMessageId ?? this.providerMessageId,
      sentAt: sentAt ?? this.sentAt,
      readAt: readAt ?? this.readAt,
      createdAt: createdAt ?? this.createdAt,
    );
  }

  @override
  bool operator ==(Object other) {
    return other is NotificationMessage &&
        other.id == id &&
        other.userId == userId &&
        other.channel == channel &&
        other.templateKey == templateKey &&
        other.title == title &&
        other.body == body &&
        mapEquals(other.payload, payload) &&
        other.status == status &&
        other.providerMessageId == providerMessageId &&
        other.sentAt == sentAt &&
        other.readAt == readAt &&
        other.createdAt == createdAt;
  }

  @override
  int get hashCode => Object.hash(
        id,
        userId,
        channel,
        templateKey,
        title,
        body,
        mapHash(payload),
        status,
        providerMessageId,
        sentAt,
        readAt,
        createdAt,
      );

  @override
  String toString() => 'NotificationMessage(${toJson()})';
}
