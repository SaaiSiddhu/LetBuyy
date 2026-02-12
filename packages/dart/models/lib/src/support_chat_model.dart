// packages/models/lib/src/support_chat_model.dart
// 💬 SUPPORT CHAT MODELS
// Models for customer support conversations

import 'package:cloud_firestore/cloud_firestore.dart';

// ═══════════════════════════════════════════════════════════════════════════
// ENUMS
// ═══════════════════════════════════════════════════════════════════════════

enum ConversationStatus {
  open,
  closed,
  pending;

  String get displayName {
    switch (this) {
      case ConversationStatus.open:
        return 'Open';
      case ConversationStatus.closed:
        return 'Closed';
      case ConversationStatus.pending:
        return 'Pending';
    }
  }
}

enum SupportTicketType {
  general,
  orderIssue,
  returnAppeal,
  payment,
  technical,
  account;

  String get displayName {
    switch (this) {
      case SupportTicketType.general:
        return 'General Inquiry';
      case SupportTicketType.orderIssue:
        return 'Order Issue';
      case SupportTicketType.returnAppeal:
        return 'Return Appeal';
      case SupportTicketType.payment:
        return 'Payment Problem';
      case SupportTicketType.technical:
        return 'Technical Issue';
      case SupportTicketType.account:
        return 'Account Help';
    }
  }

  String get icon {
    switch (this) {
      case SupportTicketType.general:
        return '💬';
      case SupportTicketType.orderIssue:
        return '📦';
      case SupportTicketType.returnAppeal:
        return '🔄';
      case SupportTicketType.payment:
        return '💳';
      case SupportTicketType.technical:
        return '🔧';
      case SupportTicketType.account:
        return '👤';
    }
  }
}

enum SenderType {
  customer,
  admin;
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPPORT CONVERSATION MODEL
// ═══════════════════════════════════════════════════════════════════════════

class SupportConversation {
  final String id;
  final String userId;
  final String userName;
  final String? userEmail;
  final String? userPhone;
  final String? userImage;
  final ConversationStatus status;
  final SupportTicketType type;
  final String subject;
  final String? lastMessage;
  final String? lastMessageSender;
  final int unreadByAdmin;
  final int unreadByUser;
  final DateTime createdAt;
  final DateTime updatedAt;
  final Map<String, dynamic>? metadata; // For order/return context

  SupportConversation({
    required this.id,
    required this.userId,
    required this.userName,
    this.userEmail,
    this.userPhone,
    this.userImage,
    this.status = ConversationStatus.open,
    this.type = SupportTicketType.general,
    required this.subject,
    this.lastMessage,
    this.lastMessageSender,
    this.unreadByAdmin = 0,
    this.unreadByUser = 0,
    required this.createdAt,
    required this.updatedAt,
    this.metadata,
  });

  // Getters
  bool get isOpen => status == ConversationStatus.open;
  bool get hasUnreadForAdmin => unreadByAdmin > 0;
  bool get hasUnreadForUser => unreadByUser > 0;

  Map<String, dynamic> toMap() {
    return {
      'userId': userId,
      'userName': userName,
      'userEmail': userEmail,
      'userPhone': userPhone,
      'userImage': userImage,
      'status': status.name,
      'type': type.name,
      'subject': subject,
      'lastMessage': lastMessage,
      'lastMessageSender': lastMessageSender,
      'unreadByAdmin': unreadByAdmin,
      'unreadByUser': unreadByUser,
      'createdAt': Timestamp.fromDate(createdAt),
      'updatedAt': Timestamp.fromDate(updatedAt),
      'metadata': metadata,
    };
  }

  factory SupportConversation.fromMap(Map<String, dynamic> map, String docId) {
    return SupportConversation(
      id: docId,
      userId: map['userId'] ?? '',
      userName: map['userName'] ?? 'Unknown',
      userEmail: map['userEmail'],
      userPhone: map['userPhone'],
      userImage: map['userImage'],
      status: ConversationStatus.values.firstWhere(
        (e) => e.name == map['status'],
        orElse: () => ConversationStatus.open,
      ),
      type: SupportTicketType.values.firstWhere(
        (e) => e.name == map['type'],
        orElse: () => SupportTicketType.general,
      ),
      subject: map['subject'] ?? 'Support Request',
      lastMessage: map['lastMessage'],
      lastMessageSender: map['lastMessageSender'],
      unreadByAdmin: map['unreadByAdmin'] ?? 0,
      unreadByUser: map['unreadByUser'] ?? 0,
      createdAt: (map['createdAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      updatedAt: (map['updatedAt'] as Timestamp?)?.toDate() ?? DateTime.now(),
      metadata: map['metadata'] as Map<String, dynamic>?,
    );
  }

  SupportConversation copyWith({
    ConversationStatus? status,
    String? lastMessage,
    String? lastMessageSender,
    int? unreadByAdmin,
    int? unreadByUser,
    DateTime? updatedAt,
  }) {
    return SupportConversation(
      id: id,
      userId: userId,
      userName: userName,
      userEmail: userEmail,
      userPhone: userPhone,
      userImage: userImage,
      status: status ?? this.status,
      type: type,
      subject: subject,
      lastMessage: lastMessage ?? this.lastMessage,
      lastMessageSender: lastMessageSender ?? this.lastMessageSender,
      unreadByAdmin: unreadByAdmin ?? this.unreadByAdmin,
      unreadByUser: unreadByUser ?? this.unreadByUser,
      createdAt: createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      metadata: metadata,
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SUPPORT MESSAGE MODEL
// ═══════════════════════════════════════════════════════════════════════════

class SupportMessage {
  final String id;
  final String conversationId;
  final String senderId;
  final String senderName;
  final SenderType senderType;
  final String message;
  final List<String> attachments;
  final DateTime? readAt;
  final DateTime timestamp;

  SupportMessage({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.senderName,
    required this.senderType,
    required this.message,
    this.attachments = const [],
    this.readAt,
    required this.timestamp,
  });

  // Getters
  bool get isCustomer => senderType == SenderType.customer;
  bool get isAdmin => senderType == SenderType.admin;
  bool get isRead => readAt != null;
  bool get hasAttachments => attachments.isNotEmpty;

  Map<String, dynamic> toMap() {
    return {
      'conversationId': conversationId,
      'senderId': senderId,
      'senderName': senderName,
      'senderType': senderType.name,
      'message': message,
      'attachments': attachments,
      'readAt': readAt != null ? Timestamp.fromDate(readAt!) : null,
      'timestamp': Timestamp.fromDate(timestamp),
    };
  }

  factory SupportMessage.fromMap(Map<String, dynamic> map, String docId) {
    return SupportMessage(
      id: docId,
      conversationId: map['conversationId'] ?? '',
      senderId: map['senderId'] ?? '',
      senderName: map['senderName'] ?? 'Unknown',
      senderType: SenderType.values.firstWhere(
        (e) => e.name == map['senderType'],
        orElse: () => SenderType.customer,
      ),
      message: map['message'] ?? '',
      attachments: List<String>.from(map['attachments'] ?? []),
      readAt: (map['readAt'] as Timestamp?)?.toDate(),
      timestamp: (map['timestamp'] as Timestamp?)?.toDate() ?? DateTime.now(),
    );
  }

  SupportMessage copyWith({
    DateTime? readAt,
  }) {
    return SupportMessage(
      id: id,
      conversationId: conversationId,
      senderId: senderId,
      senderName: senderName,
      senderType: senderType,
      message: message,
      attachments: attachments,
      readAt: readAt ?? this.readAt,
      timestamp: timestamp,
    );
  }
}
