// apps/admin/lib/screens/support/admin_chat_screen.dart
// 💬 ADMIN CHAT SCREEN
// Admin replies to customer support conversations

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

class AdminChatScreen extends StatefulWidget {
  final SupportConversation conversation;

  const AdminChatScreen({super.key, required this.conversation});

  @override
  State<AdminChatScreen> createState() => _AdminChatScreenState();
}

class _AdminChatScreenState extends State<AdminChatScreen> {
  final SupportChatService _chatService = SupportChatService();
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();

  bool _isSending = false;
  late SupportConversation _conversation;

  // Quick reply templates
  final List<String> _quickReplies = [
    "Thank you for contacting us! I'll help you with this.",
    "I've looked into your issue and here's what I found:",
    "Your request has been processed successfully.",
    "Is there anything else I can help you with?",
    "I've escalated this to our team. We'll update you soon.",
  ];

  @override
  void initState() {
    super.initState();
    _conversation = widget.conversation;
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
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

  Future<void> _sendMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty || _isSending) return;

    setState(() => _isSending = true);
    _messageController.clear();

    try {
      await _chatService.sendMessage(
        conversationId: _conversation.id,
        senderId: 'admin',
        senderName: 'Support Team',
        senderType: SenderType.admin,
        message: text,
      );
      _scrollToBottom();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Failed to send: $e'), backgroundColor: Colors.red),
      );
      _messageController.text = text;
    } finally {
      setState(() => _isSending = false);
    }
  }

  Future<void> _closeConversation() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Close Conversation?'),
        content: const Text('This will mark the conversation as resolved. The customer can still send new messages.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.green),
            child: const Text('Mark Resolved'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await _chatService.closeConversation(_conversation.id);
      setState(() {
        _conversation = _conversation.copyWith(status: ConversationStatus.closed);
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Conversation marked as resolved'), backgroundColor: Colors.green),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0A0E14) : const Color(0xFFF5F7FA),
      appBar: _buildAppBar(isDark),
      body: Column(
        children: [
          // Customer info bar
          _buildCustomerInfoBar(isDark),
          // Status bar if closed
          if (!_conversation.isOpen) _buildClosedBanner(isDark),
          // Messages
          Expanded(child: _buildMessageList(isDark)),
          // Quick replies
          if (_conversation.isOpen) _buildQuickReplies(isDark),
          // Input
          if (_conversation.isOpen) _buildInputBar(isDark),
        ],
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(bool isDark) {
    return AppBar(
      backgroundColor: isDark ? const Color(0xFF1A1F2C) : Colors.white,
      elevation: 1,
      leading: IconButton(
        icon: Icon(Icons.arrow_back, color: isDark ? Colors.white : Colors.black),
        onPressed: () => Navigator.pop(context),
      ),
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _conversation.userName,
            style: TextStyle(
              color: isDark ? Colors.white : Colors.black,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          Text(
            _conversation.subject,
            style: TextStyle(
              color: isDark ? Colors.white54 : Colors.grey,
              fontSize: 12,
            ),
          ),
        ],
      ),
      actions: [
        if (_conversation.isOpen)
          IconButton(
            icon: const Icon(Icons.check_circle_outline, color: Colors.green),
            tooltip: 'Mark as Resolved',
            onPressed: _closeConversation,
          ),
        PopupMenuButton(
          icon: Icon(Icons.more_vert, color: isDark ? Colors.white : Colors.black),
          itemBuilder: (context) => [
            if (!_conversation.isOpen)
              PopupMenuItem(
                value: 'reopen',
                child: const Row(
                  children: [
                    Icon(Icons.refresh, color: Colors.orange),
                    SizedBox(width: 8),
                    Text('Reopen Ticket'),
                  ],
                ),
              ),
            const PopupMenuItem(
              value: 'info',
              child: Row(
                children: [
                  Icon(Icons.info_outline, color: Colors.blue),
                  SizedBox(width: 8),
                  Text('Ticket Info'),
                ],
              ),
            ),
          ],
          onSelected: (value) async {
            if (value == 'reopen') {
              await _chatService.reopenConversation(_conversation.id);
              setState(() {
                _conversation = _conversation.copyWith(status: ConversationStatus.open);
              });
            } else if (value == 'info') {
              _showTicketInfo();
            }
          },
        ),
      ],
    );
  }

  Widget _buildCustomerInfoBar(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.teal.withValues(alpha: 0.1),
        border: Border(
          bottom: BorderSide(color: Colors.teal.withValues(alpha: 0.2)),
        ),
      ),
      child: Row(
        children: [
          CircleAvatar(
            radius: 18,
            backgroundColor: Colors.teal,
            backgroundImage: _conversation.userImage != null
                ? NetworkImage(_conversation.userImage!)
                : null,
            child: _conversation.userImage == null
                ? Text(
                    _conversation.userName[0].toUpperCase(),
                    style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  )
                : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      _conversation.type.icon,
                      style: const TextStyle(fontSize: 14),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      _conversation.type.displayName,
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87,
                        fontWeight: FontWeight.w500,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
                if (_conversation.userEmail != null)
                  Text(
                    _conversation.userEmail!,
                    style: TextStyle(color: Colors.grey[600], fontSize: 11),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: _conversation.isOpen
                  ? Colors.orange.withValues(alpha: 0.1)
                  : Colors.green.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Text(
              _conversation.status.displayName,
              style: TextStyle(
                color: _conversation.isOpen ? Colors.orange : Colors.green,
                fontSize: 11,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildClosedBanner(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      color: Colors.green.withValues(alpha: 0.1),
      child: Row(
        children: [
          const Icon(Icons.check_circle, color: Colors.green, size: 18),
          const SizedBox(width: 8),
          Text(
            'Ticket resolved',
            style: TextStyle(color: Colors.green[700], fontSize: 12),
          ),
          const Spacer(),
          TextButton.icon(
            onPressed: () async {
              await _chatService.reopenConversation(_conversation.id);
              setState(() {
                _conversation = _conversation.copyWith(status: ConversationStatus.open);
              });
            },
            icon: const Icon(Icons.refresh, size: 16),
            label: const Text('Reopen'),
            style: TextButton.styleFrom(
              foregroundColor: Colors.orange,
              padding: const EdgeInsets.symmetric(horizontal: 8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMessageList(bool isDark) {
    return StreamBuilder<List<SupportMessage>>(
      stream: _chatService.getMessages(_conversation.id),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting && !snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        final messages = snapshot.data ?? [];

        if (messages.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.chat_bubble_outline, size: 48, color: Colors.grey[400]),
                const SizedBox(height: 16),
                Text('No messages yet', style: TextStyle(color: Colors.grey[600])),
              ],
            ),
          );
        }

        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToBottom());

        return ListView.builder(
          controller: _scrollController,
          padding: const EdgeInsets.all(16),
          itemCount: messages.length,
          itemBuilder: (context, index) {
            final message = messages[index];
            return _MessageBubble(
              message: message,
              isDark: isDark,
            ).animate(delay: (50 * (messages.length - index)).ms).fadeIn().slideY(begin: 0.1);
          },
        );
      },
    );
  }

  Widget _buildQuickReplies(bool isDark) {
    return Container(
      height: 40,
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 16),
        itemCount: _quickReplies.length,
        itemBuilder: (context, index) {
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ActionChip(
              label: Text(
                _quickReplies[index].length > 30
                    ? '${_quickReplies[index].substring(0, 30)}...'
                    : _quickReplies[index],
                style: const TextStyle(fontSize: 11),
              ),
              backgroundColor: isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey[100],
              onPressed: () => _messageController.text = _quickReplies[index],
            ),
          );
        },
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
                  hintText: 'Type your reply...',
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
            color: Colors.teal,
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
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.send, color: Colors.white, size: 22),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showTicketInfo() {
    final dateFormat = DateFormat('MMM d, yyyy h:mm a');
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        final isDark = Theme.of(ctx).brightness == Brightness.dark;
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1A1F2C) : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
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
                'Ticket Details',
                style: TextStyle(
                  color: isDark ? Colors.white : Colors.black,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 16),
              _infoRow('Ticket ID', _conversation.id.substring(0, 8)),
              _infoRow('Customer', _conversation.userName),
              if (_conversation.userEmail != null)
                _infoRow('Email', _conversation.userEmail!),
              if (_conversation.userPhone != null)
                _infoRow('Phone', _conversation.userPhone!),
              _infoRow('Type', _conversation.type.displayName),
              _infoRow('Status', _conversation.status.displayName),
              _infoRow('Created', dateFormat.format(_conversation.createdAt)),
              _infoRow('Last Update', dateFormat.format(_conversation.updatedAt)),
              SizedBox(height: MediaQuery.of(ctx).padding.bottom + 8),
            ],
          ),
        );
      },
    );
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          SizedBox(
            width: 100,
            child: Text(label, style: const TextStyle(color: Colors.grey)),
          ),
          Expanded(
            child: Text(
              value,
              style: const TextStyle(fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MESSAGE BUBBLE
// ═══════════════════════════════════════════════════════════════════════════

class _MessageBubble extends StatelessWidget {
  final SupportMessage message;
  final bool isDark;

  const _MessageBubble({required this.message, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final isAdmin = message.isAdmin;
    final timeFormat = DateFormat('hh:mm a');

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        mainAxisAlignment: isAdmin ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          if (!isAdmin) ...[
            CircleAvatar(
              radius: 14,
              backgroundColor: Colors.grey[300],
              child: const Icon(Icons.person, size: 16, color: Colors.grey),
            ),
            const SizedBox(width: 8),
          ],
          Flexible(
            child: Container(
              constraints: BoxConstraints(
                maxWidth: MediaQuery.of(context).size.width * 0.7,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: isAdmin
                    ? Colors.teal
                    : (isDark ? Colors.white.withValues(alpha: 0.1) : Colors.white),
                borderRadius: BorderRadius.only(
                  topLeft: const Radius.circular(16),
                  topRight: const Radius.circular(16),
                  bottomLeft: Radius.circular(isAdmin ? 16 : 4),
                  bottomRight: Radius.circular(isAdmin ? 4 : 16),
                ),
                boxShadow: isAdmin
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
                  Text(
                    message.message,
                    style: TextStyle(
                      color: isAdmin ? Colors.white : (isDark ? Colors.white : Colors.black87),
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    timeFormat.format(message.timestamp),
                    style: TextStyle(
                      color: isAdmin ? Colors.white70 : Colors.grey,
                      fontSize: 10,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (isAdmin) ...[
            const SizedBox(width: 8),
            CircleAvatar(
              radius: 14,
              backgroundColor: Colors.teal,
              child: const Icon(Icons.support_agent, size: 14, color: Colors.white),
            ),
          ],
        ],
      ),
    );
  }
}
