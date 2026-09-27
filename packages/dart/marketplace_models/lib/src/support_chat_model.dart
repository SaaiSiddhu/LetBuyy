// packages/models/lib/src/support_chat_model.dart
// 💬 SUPPORT TICKET VOCABULARY

// Phase 1R (Firebase removal, final pass): SupportConversation/SupportMessage (Firestore-shaped,
// with Timestamp-coupled toMap/fromMap) and the ConversationStatus/SenderType enums were only
// ever consumed by SupportChatService and the two support screens' now-deleted live-chat UI --
// all removed as genuinely dead once support chat was disconnected (no canonical backend owns
// this capability yet; see support_chat_screen.dart's own disposition comment). SupportTicketType
// survives because the honest "not available yet" stub screens and routes.dart still use it purely
// as categorization vocabulary (e.g. "Topic: Return Appeal") -- it carries no Firebase coupling of
// its own and never did.
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
