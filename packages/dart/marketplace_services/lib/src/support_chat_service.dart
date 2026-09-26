// packages/services/lib/src/support_chat_service.dart
// 💬 SUPPORT CHAT SERVICE
// Handles customer support conversations

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/foundation.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';

class SupportChatService {
  FirebaseFirestore get _firestore => FirebaseFirestore.instance;

  // Collection references
  CollectionReference<Map<String, dynamic>> get _conversationsRef =>
      _firestore.collection('support_conversations');

  CollectionReference<Map<String, dynamic>> _messagesRef(String conversationId) =>
      _conversationsRef.doc(conversationId).collection('messages');

  // ═══════════════════════════════════════════════════════════════════════════
  // CONVERSATION OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /// Create a new support conversation
  Future<SupportConversation> createConversation({
    required String userId,
    required String userName,
    String? userEmail,
    String? userPhone,
    String? userImage,
    required SupportTicketType type,
    required String subject,
    String? initialMessage,
    Map<String, dynamic>? metadata,
  }) async {
    try {
      final now = DateTime.now();
      final docRef = _conversationsRef.doc();

      final conversation = SupportConversation(
        id: docRef.id,
        userId: userId,
        userName: userName,
        userEmail: userEmail,
        userPhone: userPhone,
        userImage: userImage,
        status: ConversationStatus.open,
        type: type,
        subject: subject,
        lastMessage: initialMessage,
        lastMessageSender: userName,
        unreadByAdmin: initialMessage != null ? 1 : 0,
        unreadByUser: 0,
        createdAt: now,
        updatedAt: now,
        metadata: metadata,
      );

      await docRef.set(conversation.toMap());

      // Send initial message if provided
      if (initialMessage != null && initialMessage.isNotEmpty) {
        await sendMessage(
          conversationId: docRef.id,
          senderId: userId,
          senderName: userName,
          senderType: SenderType.customer,
          message: initialMessage,
        );
      }

      debugPrint('✅ Created support conversation: ${docRef.id}');
      return conversation;
    } catch (e) {
      debugPrint('❌ Error creating conversation: $e');
      rethrow;
    }
  }

  /// Get or create a conversation for an existing context (e.g., return appeal)
  Future<SupportConversation> getOrCreateConversation({
    required String userId,
    required String userName,
    String? userEmail,
    required SupportTicketType type,
    required String subject,
    Map<String, dynamic>? metadata,
    String? contextId,  // e.g., returnId for return appeals
  }) async {
    // Try to find existing open conversation with same context
    if (contextId != null) {
      final existing = await _conversationsRef
          .where('userId', isEqualTo: userId)
          .where('type', isEqualTo: type.name)
          .where('status', isEqualTo: 'open')
          .where('metadata.contextId', isEqualTo: contextId)
          .limit(1)
          .get();

      if (existing.docs.isNotEmpty) {
        return SupportConversation.fromMap(
          existing.docs.first.data(),
          existing.docs.first.id,
        );
      }
    }

    // Create new conversation
    return createConversation(
      userId: userId,
      userName: userName,
      userEmail: userEmail,
      type: type,
      subject: subject,
      metadata: {
        ...?metadata,
        if (contextId != null) 'contextId': contextId,
      },
    );
  }

  /// Find any existing open conversation for user of specific type
  Future<SupportConversation?> findOpenConversation({
    required String userId,
    SupportTicketType? type,
    String? contextId,
  }) async {
    try {
      // Simple query with just userId to avoid composite index issues
      // We filter the rest in memory
      final snapshot = await _conversationsRef
          .where('userId', isEqualTo: userId)
          .get();
      
      if (snapshot.docs.isEmpty) return null;

      // Convert to list and filter
      List<SupportConversation> conversations = snapshot.docs
          .map((doc) => SupportConversation.fromMap(doc.data(), doc.id))
          .where((conv) => conv.isOpen) // Only open conversations
          .toList();

      // Filter by type if provided
      if (type != null) {
        conversations = conversations.where((conv) => conv.type == type).toList();
      }

      // Filter by contextId if provided
      if (contextId != null) {
        conversations = conversations
            .where((conv) => conv.metadata?['contextId'] == contextId)
            .toList();
      }

      if (conversations.isEmpty) return null;

      // Sort by updatedAt descending and return most recent
      conversations.sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
      
      debugPrint('🔍 Found ${conversations.length} matching open conversation(s)');
      return conversations.first;
    } catch (e) {
      debugPrint('❌ Error finding conversation: $e');
      return null;
    }
  }

  /// Get a single conversation by ID
  Future<SupportConversation?> getConversation(String conversationId) async {
    try {
      final doc = await _conversationsRef.doc(conversationId).get();
      if (!doc.exists) return null;
      return SupportConversation.fromMap(doc.data()!, doc.id);
    } catch (e) {
      debugPrint('❌ Error getting conversation: $e');
      return null;
    }
  }

  /// Stream a single conversation for real-time updates
  Stream<SupportConversation?> getConversationStream(String conversationId) {
    return _conversationsRef.doc(conversationId).snapshots().map((doc) {
      if (!doc.exists) return null;
      return SupportConversation.fromMap(doc.data()!, doc.id);
    });
  }

  /// Stream all conversations (for admin)
  Stream<List<SupportConversation>> getAllConversations({
    ConversationStatus? status,
  }) {
    Query<Map<String, dynamic>> query = _conversationsRef
        .orderBy('updatedAt', descending: true);

    if (status != null) {
      query = query.where('status', isEqualTo: status.name);
    }

    return query.snapshots().map((snapshot) {
      return snapshot.docs
          .map((doc) => SupportConversation.fromMap(doc.data(), doc.id))
          .toList();
    });
  }

  /// Stream conversations for a specific user
  Stream<List<SupportConversation>> getUserConversations(String userId) {
    return _conversationsRef
        .where('userId', isEqualTo: userId)
        .orderBy('updatedAt', descending: true)
        .snapshots()
        .map((snapshot) {
          return snapshot.docs
              .map((doc) => SupportConversation.fromMap(doc.data(), doc.id))
              .toList();
        });
  }

  /// Close a conversation
  Future<void> closeConversation(String conversationId) async {
    await _conversationsRef.doc(conversationId).update({
      'status': ConversationStatus.closed.name,
      'updatedAt': FieldValue.serverTimestamp(),
    });
    debugPrint('✅ Closed conversation: $conversationId');
  }

  /// Reopen a conversation
  Future<void> reopenConversation(String conversationId) async {
    await _conversationsRef.doc(conversationId).update({
      'status': ConversationStatus.open.name,
      'updatedAt': FieldValue.serverTimestamp(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGE OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  /// Send a message
  Future<SupportMessage> sendMessage({
    required String conversationId,
    required String senderId,
    required String senderName,
    required SenderType senderType,
    required String message,
    List<String> attachments = const [],
  }) async {
    try {
      final now = DateTime.now();
      final docRef = _messagesRef(conversationId).doc();

      final supportMessage = SupportMessage(
        id: docRef.id,
        conversationId: conversationId,
        senderId: senderId,
        senderName: senderName,
        senderType: senderType,
        message: message,
        attachments: attachments,
        timestamp: now,
      );

      await docRef.set(supportMessage.toMap());

      // Update conversation with last message
      await _conversationsRef.doc(conversationId).update({
        'lastMessage': message.length > 100 ? '${message.substring(0, 100)}...' : message,
        'lastMessageSender': senderName,
        'updatedAt': FieldValue.serverTimestamp(),
        // Increment unread count for recipient
        if (senderType == SenderType.customer)
          'unreadByAdmin': FieldValue.increment(1),
        if (senderType == SenderType.admin)
          'unreadByUser': FieldValue.increment(1),
      });

      debugPrint('✅ Sent message in conversation: $conversationId');
      return supportMessage;
    } catch (e) {
      debugPrint('❌ Error sending message: $e');
      rethrow;
    }
  }

  /// Stream messages for a conversation
  Stream<List<SupportMessage>> getMessages(String conversationId) {
    return _messagesRef(conversationId)
        .orderBy('timestamp', descending: false)
        .snapshots()
        .map((snapshot) {
          return snapshot.docs
              .map((doc) => SupportMessage.fromMap(doc.data(), doc.id))
              .toList();
        });
  }

  /// Mark messages as read (for user viewing)
  Future<void> markMessagesAsReadByUser(String conversationId) async {
    await _conversationsRef.doc(conversationId).update({
      'unreadByUser': 0,
    });
  }

  /// Mark messages as read (for admin viewing)
  Future<void> markMessagesAsReadByAdmin(String conversationId) async {
    await _conversationsRef.doc(conversationId).update({
      'unreadByAdmin': 0,
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COUNTS & UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  /// Get total unread count for admin
  Stream<int> getAdminUnreadCount() {
    return _conversationsRef
        .where('status', isEqualTo: 'open')
        .snapshots()
        .map((snapshot) {
          int total = 0;
          for (var doc in snapshot.docs) {
            total += (doc.data()['unreadByAdmin'] as int?) ?? 0;
          }
          return total;
        });
  }

  /// Get unread count for a specific user
  Stream<int> getUserUnreadCount(String userId) {
    return _conversationsRef
        .where('userId', isEqualTo: userId)
        .where('status', isEqualTo: 'open')
        .snapshots()
        .map((snapshot) {
          int total = 0;
          for (var doc in snapshot.docs) {
            total += (doc.data()['unreadByUser'] as int?) ?? 0;
          }
          return total;
        });
  }

  /// Get open conversation count for admin
  Stream<int> getOpenConversationCount() {
    return _conversationsRef
        .where('status', isEqualTo: 'open')
        .snapshots()
        .map((snapshot) => snapshot.docs.length);
  }
}
