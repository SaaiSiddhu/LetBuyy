import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
// apps/marketplace/lib/screens/support/support_conversations_screen.dart
// 📬 SUPPORT CONVERSATIONS SCREEN
// Shows user's chat history with support team

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import '../../providers/auth_provider.dart';
import 'support_chat_screen.dart';
import '../../widgets/premium_scaffold.dart';

class SupportConversationsScreen extends StatefulWidget {
  final bool showNewChatButton;
  final SupportTicketType? newChatType;
  final String? newChatSubject;
  final String? newChatMessage;
  final Map<String, dynamic>? newChatMetadata;

  const SupportConversationsScreen({
    super.key,
    this.showNewChatButton = true,
    this.newChatType,
    this.newChatSubject,
    this.newChatMessage,
    this.newChatMetadata,
  });

  @override
  State<SupportConversationsScreen> createState() => _SupportConversationsScreenState();
}

class _SupportConversationsScreenState extends State<SupportConversationsScreen> {
  final SupportChatService _chatService = SupportChatService();

  @override
  void initState() {
    super.initState();
    // If we have pre-filled data for a new chat, check for existing or start new
    if (widget.newChatType != null && widget.newChatSubject != null) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _handleNewChatRequest());
    }
  }

  Future<void> _handleNewChatRequest() async {
    final user = context.read<AuthProvider>().currentUser;
    if (user == null) return;

    // Check for existing open conversation with same context
    final existingConversations = await _chatService
        .getUserConversations(user.uid)
        .first;

    // Find an open conversation with matching type
    SupportConversation? matchingConversation;
    for (final conv in existingConversations) {
      if (conv.isOpen && conv.type == widget.newChatType) {
        // Check if context matches (e.g., same return appeal)
        final contextId = widget.newChatMetadata?['contextId'] as String?;
        if (contextId != null && conv.metadata?['contextId'] == contextId) {
          matchingConversation = conv;
          break;
        } else if (contextId == null) {
          matchingConversation = conv; // Use any open conversation of same type
          break;
        }
      }
    }

    if (!mounted) return;

    if (matchingConversation != null) {
      // Navigate to existing conversation
      _openChat(matchingConversation);
    } else {
      // Create new conversation
      _startNewChat();
    }
  }

  void _openChat(SupportConversation conversation) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => SupportChatScreen(
          conversationId: conversation.id,
        ),
      ),
    );
  }

  void _startNewChat({SupportTicketType? type, String? subject}) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => SupportChatScreen(
          ticketType: type ?? widget.newChatType ?? SupportTicketType.general,
          subject: subject ?? widget.newChatSubject ?? 'Support Request',
          initialMessage: widget.newChatMessage,
          metadata: widget.newChatMetadata,
        ),
      ),
    );
  }

  void _showNewChatOptions() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1A1F2C) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[400],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              'What can we help you with?',
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            ...SupportTicketType.values.map((type) => _buildTicketTypeOption(type, isDark)),
            SizedBox(height: MediaQuery.of(ctx).padding.bottom + 8),
          ],
        ),
      ),
    );
  }

  Widget _buildTicketTypeOption(SupportTicketType type, bool isDark) {
    return ListTile(
      leading: Text(type.icon, style: const TextStyle(fontSize: 24)),
      title: Text(
        type.displayName,
        style: TextStyle(
          color: isDark ? Colors.white : Colors.black,
          fontWeight: FontWeight.w500,
        ),
      ),
      trailing: Icon(Icons.arrow_forward_ios, size: 16, color: Colors.grey[400]),
      onTap: () {
        Navigator.pop(context);
        _startNewChat(type: type, subject: type.displayName);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final user = context.watch<AuthProvider>().currentUser;

    if (user == null) {
      return Scaffold(
        backgroundColor: isDark ? const Color(0xFF0A0E14) : const Color(0xFFF5F7FA),
        appBar: AppBar(title: const Text('Support')),
        body: const Center(child: Text('Please login to access support')),
      );
    }

    return PremiumScaffold(
    // resizeToAvoidBottomInset handled internally
    // backgroundColor handled internally
    appBar: _buildAppBar(isDark),
    body: _buildBody(isDark, user.uid),
    floatingActionButton: widget.showNewChatButton ? FloatingActionButton.extended(
      onPressed: _showNewChatOptions,
      backgroundColor: AppColors.primary,
      icon: const Icon(Icons.add_comment, color: Colors.white),
      label: const Text('New Chat', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
    ) : null,
  );
}

  PreferredSizeWidget _buildAppBar(bool isDark) {
    return AppBar(
      backgroundColor: isDark ? const Color(0xFF1A1F2C) : Colors.white,
      elevation: 0,
      leading: IconButton(
        icon: Icon(Icons.arrow_back, color: isDark ? Colors.white : Colors.black),
        onPressed: () => Navigator.pop(context),
      ),
      title: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(Icons.support_agent, color: AppColors.primary, size: 20),
          ),
          const SizedBox(width: 12),
          Text(
            'Support',
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBody(bool isDark, String userId) {
    return StreamBuilder<List<SupportConversation>>(
      stream: _chatService.getUserConversations(userId),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        final conversations = snapshot.data ?? [];

        if (conversations.isEmpty) {
          return _buildEmptyState(isDark);
        }

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: conversations.length,
          itemBuilder: (context, index) {
            final conv = conversations[index];
            return _ConversationCard(
              conversation: conv,
              isDark: isDark,
              onTap: () => _openChat(conv),
            ).animate(delay: (index * 50).ms).fadeIn().slideX(begin: -0.05);
          },
        );
      },
    );
  }

  Widget _buildEmptyState(bool isDark) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.support_agent, size: 64, color: AppColors.primary),
            ),
            const SizedBox(height: 24),
            Text(
              'Need Help?',
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black,
                fontSize: 22,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Our support team is here to help you with any questions or issues.',
              style: TextStyle(
                color: isDark ? Colors.white54 : Colors.grey[600],
                fontSize: 14,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 32),
            ElevatedButton.icon(
              onPressed: _showNewChatOptions,
              icon: const Icon(Icons.chat_bubble_outline),
              label: const Text('Start a Conversation'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONVERSATION CARD
// ═══════════════════════════════════════════════════════════════════════════

class _ConversationCard extends StatelessWidget {
  final SupportConversation conversation;
  final bool isDark;
  final VoidCallback onTap;

  const _ConversationCard({
    required this.conversation,
    required this.isDark,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final timeAgo = _getTimeAgo(conversation.updatedAt);

    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: conversation.hasUnreadForUser
              ? Border.all(color: AppColors.primary, width: 2)
              : Border.all(color: isDark ? Colors.white10 : Colors.grey[200]!),
          boxShadow: isDark
              ? null
              : [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: _getTypeColor(conversation.type).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(conversation.type.icon, style: const TextStyle(fontSize: 18)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        conversation.subject,
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black,
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 2),
                      Text(
                        conversation.type.displayName,
                        style: TextStyle(
                          color: isDark ? Colors.white54 : Colors.grey[600],
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
                // Status badge
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: conversation.isOpen
                        ? AppColors.success.withValues(alpha: 0.1)
                        : Colors.grey.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 6,
                        height: 6,
                        decoration: BoxDecoration(
                          color: conversation.isOpen ? AppColors.success : Colors.grey,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        conversation.isOpen ? 'Active' : 'Closed',
                        style: TextStyle(
                          color: conversation.isOpen ? AppColors.success : Colors.grey,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            // Last message preview
            if (conversation.lastMessage != null) ...[
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: isDark ? Colors.white.withValues(alpha: 0.03) : Colors.grey[50],
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    Icon(
                      Icons.chat_bubble_outline,
                      size: 14,
                      color: isDark ? Colors.white38 : Colors.grey[500],
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        conversation.lastMessage!,
                        style: TextStyle(
                          color: isDark ? Colors.white70 : Colors.grey[700],
                          fontSize: 13,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ],

            // Footer
            const SizedBox(height: 12),
            Row(
              children: [
                Icon(Icons.access_time, size: 14, color: Colors.grey[500]),
                const SizedBox(width: 4),
                Text(
                  timeAgo,
                  style: TextStyle(color: Colors.grey[500], fontSize: 11),
                ),
                const Spacer(),
                // Unread badge
                if (conversation.hasUnreadForUser)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${conversation.unreadByUser} new',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                const SizedBox(width: 8),
                Icon(
                  Icons.arrow_forward_ios,
                  size: 14,
                  color: isDark ? Colors.white38 : Colors.grey,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _getTimeAgo(DateTime dateTime) {
    final now = DateTime.now();
    final diff = now.difference(dateTime);

    if (diff.inMinutes < 1) return 'Just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return DateFormat('MMM d').format(dateTime);
  }

  Color _getTypeColor(SupportTicketType type) {
    switch (type) {
      case SupportTicketType.general:
        return AppColors.info;
      case SupportTicketType.orderIssue:
        return AppColors.warning;
      case SupportTicketType.returnAppeal:
        return AppColors.accent;
      case SupportTicketType.payment:
        return AppColors.success;
      case SupportTicketType.technical:
        return AppColors.error;
      case SupportTicketType.account:
        return AppColors.primary;
    }
  }
}
