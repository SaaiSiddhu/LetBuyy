// apps/marketplace/lib/screens/support/support_chat_screen.dart
// 💬 SUPPORT CHAT SCREEN
// Customer chat with support team

import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace/widgets/premium_scaffold.dart';

class SupportChatScreen extends StatefulWidget {
  final String? conversationId;
  final SupportTicketType? ticketType;
  final String? subject;
  final String? initialMessage;
  final Map<String, dynamic>? metadata;

  const SupportChatScreen({
    super.key,
    this.conversationId,
    this.ticketType,
    this.subject,
    this.initialMessage,
    this.metadata,
  });

  @override
  State<SupportChatScreen> createState() => _SupportChatScreenState();
}

class _SupportChatScreenState extends State<SupportChatScreen> {
  final SupportChatService _chatService = SupportChatService();
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  SupportConversation? _conversation;
  bool _isLoading = true;
  // Never set true anymore: _sendMessage's actual send logic was dead code, removed above.
  final bool _isSending = false;
  StreamSubscription? _conversationSubscription;

  @override
  void initState() {
    super.initState();
    _initConversation();
  }

  @override
  void dispose() {
    _conversationSubscription?.cancel();
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  // Phase 1R corrective (C2): was gated on context.read<AuthProvider>().currentUser
  // (AuthProvider, entirely FirebaseAuth-backed) -- always null now, since canonical "Sign in
  // with LetBuyy" never touches FirebaseAuth. This already always returned here before reaching
  // SupportChatService (itself entirely FirebaseFirestore-backed, with no canonical successor);
  // kept that same early return instead of a dead provider reference. The `_conversation == null`
  // branch in build() already renders an honest state for this (see below).
  Future<void> _initConversation() async {
    setState(() => _isLoading = false);
  }

  /// Listen for real-time conversation status updates (e.g., when admin closes)
  void _startConversationListener(String conversationId) {
    _conversationSubscription = _chatService
        .getConversationStream(conversationId)
        .listen((updatedConversation) {
      if (updatedConversation != null && mounted) {
        final statusChanged = _conversation?.status != updatedConversation.status;
        setState(() {
          _conversation = updatedConversation;
        });
        if (statusChanged) {
          debugPrint('📡 Conversation status updated: ${updatedConversation.status}');
        }
      }
    });
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  // Phase 1R corrective (C2): was gated on context.read<AuthProvider>().currentUser after the
  // _conversation == null check below -- since _initConversation() never sets _conversation
  // anymore (see above), that check alone already always returns before this is reached.
  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _conversation == null || _isSending) return;
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return PremiumScaffold(
      // resizeToAvoidBottomInset handled internally
      // backgroundColor handled internally
      appBar: _buildAppBar(isDark),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _conversation == null
              ? _buildNoConversation(isDark)
              : Column(
                  children: [
                    // Conversation status bar
                    if (!_conversation!.isOpen) _buildClosedBanner(isDark),
                    // Messages
                    Expanded(child: _buildMessageList(isDark)),
                    // Input
                    if (_conversation!.isOpen)
                      _buildInputBar(isDark),
                  ],
                ),
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
          // Support avatar
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.primary, AppColors.primaryDark],
              ),
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(Icons.support_agent, size: 18, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Support Team',
                  style: TextStyle(
                    color: isDark ? Colors.white : Colors.black,
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (_conversation != null)
                  Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: _conversation!.isOpen ? AppColors.success : Colors.grey,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _conversation!.isOpen ? 'Active • Usually replies quickly' : 'Resolved',
                        style: TextStyle(
                          color: isDark ? Colors.white54 : Colors.grey[600],
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
      actions: [
        // Info button only - no close option for customers
        if (_conversation != null)
          IconButton(
            icon: Icon(Icons.info_outline, color: isDark ? Colors.white70 : Colors.grey[600]),
            onPressed: () => _showConversationInfo(),
          ),
      ],
    );
  }

  void _showConversationInfo() {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (_) => Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: isDark ? const Color(0xFF1A1F2C) : Colors.white,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[400],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.support_agent, size: 40, color: AppColors.primary),
            ),
            const SizedBox(height: 16),
            Text(
              'Conversation Details',
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 16),
            _buildInfoRow('Ticket ID', '#${_conversation!.id.substring(0, 8).toUpperCase()}', isDark),
            _buildInfoRow('Type', _conversation!.type.displayName, isDark),
            _buildInfoRow('Subject', _conversation!.subject, isDark),
            _buildInfoRow('Status', _conversation!.isOpen ? 'Active' : 'Resolved', isDark),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.info.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: AppColors.info, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'Our support team typically responds within 2-4 hours during business hours.',
                      style: TextStyle(
                        color: AppColors.infoDark,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(height: MediaQuery.of(context).padding.bottom + 16),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(color: isDark ? Colors.white54 : Colors.grey[600], fontSize: 13),
          ),
          Text(
            value,
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black,
              fontWeight: FontWeight.w500,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildClosedBanner(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.success.withValues(alpha: 0.15),
            AppColors.primary.withValues(alpha: 0.1),
          ],
        ),
        border: Border(
          bottom: BorderSide(color: AppColors.success.withValues(alpha: 0.2)),
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.success.withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.check_circle, color: AppColors.success, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Conversation Resolved',
                      style: TextStyle(
                        color: AppColors.success,
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'This ticket has been closed by our support team',
                      style: TextStyle(color: AppColors.success, fontSize: 12),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () async {
                await _chatService.reopenConversation(_conversation!.id);
                setState(() {
                  _conversation = _conversation!.copyWith(
                    status: ConversationStatus.open,
                  );
                });
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('Conversation reopened! You can now send messages.'),
                      backgroundColor: AppColors.primary,
                    ),
                  );
                }
              },
              icon: const Icon(Icons.replay, size: 18),
              label: const Text('Reopen Conversation'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: BorderSide(color: AppColors.primary),
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNoConversation(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.error_outline, size: 64, color: Colors.grey[400]),
          const SizedBox(height: 16),
          const Text('Unable to start conversation'),
          const SizedBox(height: 24),
          ElevatedButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Go Back'),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageList(bool isDark) {
    return StreamBuilder<List<SupportMessage>>(
      stream: _chatService.getMessages(_conversation!.id),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        final messages = snapshot.data ?? [];

        if (messages.isEmpty) {
          return _buildEmptyChat(isDark);
        }

        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());

        return ListView.builder(
          controller: _scrollController,
          padding: const EdgeInsets.all(16),
          itemCount: messages.length,
          itemBuilder: (context, index) {
            final message = messages[index];
            final showDate = index == 0 ||
                !_isSameDay(messages[index - 1].timestamp, message.timestamp);

            return Column(
              children: [
                if (showDate) _buildDateDivider(message.timestamp, isDark),
                _MessageBubble(
                  message: message,
                  isDark: isDark,
                ).animate(delay: (50 * (messages.length - index)).ms).fadeIn().slideY(begin: 0.1),
              ],
            );
          },
        );
      },
    );
  }

  bool _isSameDay(DateTime a, DateTime b) {
    return a.year == b.year && a.month == b.month && a.day == b.day;
  }

  Widget _buildDateDivider(DateTime date, bool isDark) {
    final now = DateTime.now();
    final isToday = _isSameDay(date, now);
    final isYesterday = _isSameDay(date, now.subtract(const Duration(days: 1)));

    String label;
    if (isToday) {
      label = 'Today';
    } else if (isYesterday) {
      label = 'Yesterday';
    } else {
      label = DateFormat('MMM d, yyyy').format(date);
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 16),
      child: Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey[200],
            borderRadius: BorderRadius.circular(12),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: isDark ? Colors.white60 : Colors.grey[600],
              fontSize: 12,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmptyChat(bool isDark) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.support_agent, size: 48, color: AppColors.primary),
          ),
          const SizedBox(height: 16),
          Text(
            'Start the conversation',
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Send a message to connect with our support team',
            style: TextStyle(color: isDark ? Colors.white54 : Colors.grey[600]),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildInputBar(bool isDark) {
    return Container(
      padding: EdgeInsets.fromLTRB(16, 12, 16, MediaQuery.of(context).padding.bottom + 12),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1F2C) : Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              decoration: BoxDecoration(
                color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey[100],
                borderRadius: BorderRadius.circular(24),
              ),
              child: TextField(
                controller: _messageController,
                maxLines: null,
                textCapitalization: TextCapitalization.sentences,
                style: TextStyle(color: isDark ? Colors.white : Colors.black),
                decoration: InputDecoration(
                  hintText: 'Type a message...',
                  hintStyle: TextStyle(color: isDark ? Colors.white38 : Colors.grey),
                  border: InputBorder.none,
                  contentPadding: const EdgeInsets.symmetric(vertical: 12),
                ),
                onSubmitted: (_) => _sendMessage(),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Material(
            color: AppColors.primary,
            borderRadius: BorderRadius.circular(24),
            child: InkWell(
              onTap: _isSending ? null : _sendMessage,
              borderRadius: BorderRadius.circular(24),
              child: Container(
                padding: const EdgeInsets.all(12),
                child: _isSending
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.send, color: Colors.white, size: 22),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE WIDGET
// ═══════════════════════════════════════════════════════════════════════════

class _MessageBubble extends StatelessWidget {
  final SupportMessage message;
  final bool isDark;

  const _MessageBubble({
    required this.message,
    required this.isDark,
  });

  @override
  Widget build(BuildContext context) {
    final isCustomer = message.isCustomer;
    final timeFormat = DateFormat('hh:mm a');

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: isCustomer ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isCustomer) ...[
            CircleAvatar(
              radius: 16,
              backgroundColor: AppColors.primary,
              child: const Icon(Icons.support_agent, size: 18, color: Colors.white),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.75,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isCustomer
                    ? AppColors.primary
                    : (isDark ? Colors.white.withValues(alpha: 0.1) : Colors.white),
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(16),
                  topRight: const Radius.circular(16),
                  bottomLeft: Radius.circular(isCustomer ? 16 : 4),
                  bottomRight: Radius.circular(isCustomer ? 4 : 16),
                ),
                boxShadow: isCustomer
                    ? null
                    : [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05),
                          blurRadius: 5,
                          offset: const Offset(0, 2),
                        ),
                      ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (!isCustomer)
                    Text(
                      message.senderName,
                      style: TextStyle(
                        color: AppColors.primary,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  if (!isCustomer) const SizedBox(height: 4),
                  Text(
                    message.message,
                    style: TextStyle(
                      color: isCustomer ? Colors.white : (isDark ? Colors.white : Colors.black87),
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    timeFormat.format(message.timestamp),
                    style: TextStyle(
                      color: isCustomer ? Colors.white70 : Colors.grey,
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (isCustomer) const SizedBox(width: 8),
        ],
      ),
    );
  }
}
