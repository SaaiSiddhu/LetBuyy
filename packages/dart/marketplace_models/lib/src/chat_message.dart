// lib/models/chat_message.dart
import 'package:intl/intl.dart';

enum MessageType { user, ai, system, loading, error }

class ChatMessage {
  final String id;
  final String text;
  final String sessionId;
  final MessageType messageType;
  final DateTime timestamp;
  final List<Map<String, dynamic>>? products;
  final List<Map<String, dynamic>>? orders;
  final List<String>? quickReplies;
  final String? replyTo;
  final String category;
  final Map<String, dynamic>? data;
  final int? rating;
  final String? ratingFeedback;
  final bool isBookmarked;
  final Map<String, int>? reactions;
  final String? errorMessage;

  ChatMessage({
    required this.id,
    required this.text,
    required this.sessionId,
    required this.messageType,
    required this.timestamp,
    this.products,
    this.orders,
    this.quickReplies,
    this.replyTo,
    this.category = 'general',
    this.data,
    this.rating,
    this.ratingFeedback,
    this.isBookmarked = false,
    this.reactions,
    this.errorMessage,
  });

  // Factory constructors
  factory ChatMessage.user({
    required String text,
    required String sessionId,
    String? replyTo,
    String category = 'user_query',
  }) {
    return ChatMessage(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      text: text,
      sessionId: sessionId,
      messageType: MessageType.user,
      timestamp: DateTime.now(),
      replyTo: replyTo,
      category: category,
    );
  }

  factory ChatMessage.ai({
    required String text,
    required String sessionId,
    List<Map<String, dynamic>>? products,
    List<Map<String, dynamic>>? orders,
    List<String>? quickReplies,
    String category = 'ai_response',
    Map<String, dynamic>? data,
  }) {
    return ChatMessage(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      text: text,
      sessionId: sessionId,
      messageType: MessageType.ai,
      timestamp: DateTime.now(),
      products: products,
      orders: orders,
      quickReplies: quickReplies,
      category: category,
      data: data,
    );
  }

  factory ChatMessage.loading({
    required String sessionId,
    String category = 'system',
  }) {
    return ChatMessage(
      id: 'loading_${DateTime.now().millisecondsSinceEpoch}',
      text: '',
      sessionId: sessionId,
      messageType: MessageType.loading,
      timestamp: DateTime.now(),
      category: category,
    );
  }

  factory ChatMessage.error({
    required String text,
    required String sessionId,
    String? errorMessage,
    String category = 'error',  // ADD DEFAULT PARAMETER
  }) {
    return ChatMessage(
      id: DateTime.now().millisecondsSinceEpoch.toString(),
      text: text,
      sessionId: sessionId,
      messageType: MessageType.error,
      timestamp: DateTime.now(),
      category: category,
      errorMessage: errorMessage,
    );
  }

  // Getters
  bool get isUser => messageType == MessageType.user;
  bool get isAI => messageType == MessageType.ai;
  bool get isError => messageType == MessageType.error;
  bool get isLoading => messageType == MessageType.loading;
  bool get isRated => rating != null;
  bool get hasProducts => products?.isNotEmpty ?? false;
  bool get hasOrders => orders?.isNotEmpty ?? false;
  bool get hasQuickReplies => quickReplies?.isNotEmpty ?? false;
  bool get hasSuggestions => data?['suggestions'] != null;
  int get productCount => products?.length ?? 0;

  String get formattedTime => DateFormat('hh:mm a').format(timestamp);

  /// Plain-map serialization, used for local persistence (see AIChatService's own doc comments --
  /// there is no canonical chat-history backend yet, so this is not a wire contract with any
  /// server).
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'text': text,
      'sessionId': sessionId,
      'messageType': messageType.name,
      'timestamp': timestamp.toIso8601String(),
      'products': products,
      'orders': orders,
      'quickReplies': quickReplies,
      'replyTo': replyTo,
      'category': category,
      'data': data,
      'rating': rating,
      'ratingFeedback': ratingFeedback,
      'isBookmarked': isBookmarked,
      'reactions': reactions,
      'errorMessage': errorMessage,
    };
  }

  // C3 (Firebase SDK removal, 27 September 2026 review continuation): replaces
  // fromFirestore(DocumentSnapshot) (its only caller, AIChatService.loadSessionHistory, is itself
  // being retired the same pass -- see that file's own doc comments). Duck-types a `.toDate()`
  // timestamp the same way product_model.dart's _parseTimestamp does, in case a real Firestore
  // Timestamp value is ever handed in, while also accepting the ISO-8601 string toMap() above
  // produces and a raw epoch-millisecond int. An unparseable or missing timestamp falls back to
  // "now" for a message being decoded right now, never to a silently fabricated past date.
  factory ChatMessage.fromMap(Map<String, dynamic> data, {String? id}) {
    return ChatMessage(
      id: data['id'] ?? id ?? '',
      text: data['text'] ?? '',
      sessionId: data['sessionId'] ?? '',
      messageType: MessageType.values.firstWhere(
        (e) => e.name == data['messageType'],
        orElse: () => MessageType.system,
      ),
      timestamp: _parseTimestamp(data['timestamp']),
      products: (data['products'] as List?)?.cast<Map<String, dynamic>>(),
      orders: (data['orders'] as List?)?.cast<Map<String, dynamic>>(),
      quickReplies: (data['quickReplies'] as List?)?.cast<String>(),
      replyTo: data['replyTo'],
      category: data['category'] ?? 'general',
      data: data['data'] as Map<String, dynamic>?,
      rating: data['rating'],
      ratingFeedback: data['ratingFeedback'],
      isBookmarked: data['isBookmarked'] ?? false,
      reactions: (data['reactions'] as Map<String, dynamic>?)?.map(
        (key, value) => MapEntry(key, value as int),
      ),
      errorMessage: data['errorMessage'],
    );
  }

  static DateTime _parseTimestamp(Object? value) {
    if (value == null) return DateTime.now();
    if (value is DateTime) return value;
    if (value is String) return DateTime.tryParse(value) ?? DateTime.now();
    if (value is int) return DateTime.fromMillisecondsSinceEpoch(value);
    try {
      return (value as dynamic).toDate() as DateTime;
    } catch (_) {
      return DateTime.now();
    }
  }

  ChatMessage copyWith({
    String? text,
    List<Map<String, dynamic>>? products,
    List<Map<String, dynamic>>? orders,
    List<String>? quickReplies,
    int? rating,
    String? ratingFeedback,
    bool? isBookmarked,
    Map<String, int>? reactions,
  }) {
    return ChatMessage(
      id: id,
      text: text ?? this.text,
      sessionId: sessionId,
      messageType: messageType,
      timestamp: timestamp,
      products: products ?? this.products,
      orders: orders ?? this.orders,
      quickReplies: quickReplies ?? this.quickReplies,
      replyTo: replyTo,
      category: category,
      data: data,
      rating: rating ?? this.rating,
      ratingFeedback: ratingFeedback ?? this.ratingFeedback,
      isBookmarked: isBookmarked ?? this.isBookmarked,
      reactions: reactions ?? this.reactions,
      errorMessage: errorMessage,
    );
  }
}
