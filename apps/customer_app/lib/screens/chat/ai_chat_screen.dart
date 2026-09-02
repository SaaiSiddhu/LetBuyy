// lib/screens/chat/ai_chat_screen.dart
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:intl/intl.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'widgets/message_bubble.dart';
import 'package:letbuyy_marketplace/widgets/premium_scaffold.dart';
import 'chat_history_screen.dart';

class AIChatScreen extends HookWidget {
  const AIChatScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final textController = useTextEditingController();
    final scrollController = useScrollController();
    final focusNode = useFocusNode();

    final chat = _useAIChat(
      context: context,
      scrollController: scrollController,
    );

    final showScrollToBottom = useState(false);

    useEffect(() {
      void scrollListener() {
        final show =
            scrollController.hasClients && scrollController.offset > 200;
        if (show != showScrollToBottom.value) {
          showScrollToBottom.value = show;
        }
      }

      scrollController.addListener(scrollListener);
      return () => scrollController.removeListener(scrollListener);
    }, [scrollController]);

    final theme = Theme.of(context);
    final colorScheme = theme.colorScheme;

    return PremiumScaffold(
      // resizeToAvoidBottomInset handled internally
      // backgroundColor handled internally
      appBar: _ChatAppBar(
        onNewChat: chat.actions.startNewChat,
        onHistory: chat.actions.showHistory,
        messageCount: chat.state.messages.length,
      ),
      body: chat.state.isInitializing
          ? const _LoadingState()
          : Stack(
              children: [
                Column(
                  children: [
                    if (chat.state.isGuest) const _GuestModeBanner(),
                    if (chat.state.sessionStats.isNotEmpty &&
                        !chat.state.isGuest)
                      _SessionStatsBar(stats: chat.state.sessionStats),
                    Expanded(
                      child: _MessageList(
                        scrollController: scrollController,
                        messages: chat.state.messages,
                        onQuickReply: (reply) {
                          textController.text = reply;
                          chat.actions.sendMessage(reply);
                        },
                        onReply: chat.actions.setReplyTo,
                        onCopy: (text) {
                          Clipboard.setData(ClipboardData(text: text));
                          chat.actions.showSnack('Message copied',
                              isError: false);
                        },
                      ),
                    ),
                    // PremiumScaffold handles keyboard insets automatically
                    Padding(
                      padding: EdgeInsets.zero,
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (chat.state.replyToMessage != null)
                            _ReplyingToBar(
                              message: chat.state.replyToMessage!,
                              onCancel: () => chat.actions.setReplyTo(null),
                            ),
                          _ChatInputArea(
                            controller: textController,
                            focusNode: focusNode,
                            isLoading: chat.state.isLoading,
                            onSend: chat.actions.sendMessage,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                if (showScrollToBottom.value)
                  Positioned(
                    right: 16,
                    bottom: 90,
                    child: FloatingActionButton.small(
                      onPressed: chat.actions.scrollToBottom,
                      backgroundColor: AppColors.primary,
                      child: const Icon(Icons.arrow_downward,
                          color: AppColors.white),
                    ),
                  ),
              ],
            ),
    );
  }
}

class _AIChatState {
  final List<ChatMessage> messages;
  final bool isLoading;
  final bool isInitializing;
  final bool isGuest;
  final Map<String, int> sessionStats;
  final ChatMessage? replyToMessage;

  _AIChatState({
    required this.messages,
    required this.isLoading,
    required this.isInitializing,
    required this.isGuest,
    required this.sessionStats,
    this.replyToMessage,
  });
}

class _AIChatActions {
  final Future<void> Function(String) sendMessage;
  final Future<void> Function() startNewChat;
  final Future<void> Function() showHistory;
  final void Function(String?) setReplyTo;
  final void Function() scrollToBottom;
  final void Function(String, {required bool isError}) showSnack;

  _AIChatActions({
    required this.sendMessage,
    required this.startNewChat,
    required this.showHistory,
    required this.setReplyTo,
    required this.scrollToBottom,
    required this.showSnack,
  });
}

({_AIChatState state, _AIChatActions actions}) _useAIChat({
  required BuildContext context,
  required ScrollController scrollController,
}) {
  final messages = useState<List<ChatMessage>>([]);
  final isLoading = useState(false);
  final isInitializing = useState(true);
  final isGuest = useState(false);
  final sessionStats = useState<Map<String, int>>({});
  final replyToMessageId = useState<String?>(null);

  // ✅ FIXED: Use the singleton .instance
  final aiService = useMemoized(() => AIChatService.instance);

  void scrollToBottom({Duration delay = Duration.zero}) {
    Future.delayed(delay, () {
      if (!context.mounted || !scrollController.hasClients) return;
      scrollController.animateTo(
        scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    });
  }

  void showSnack(String msg, {required bool isError}) {
    if (!context.mounted) return;

    final backgroundColor = isError ? AppColors.error : AppColors.success;
    final textColor = AppColors.white;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          msg,
          style: TextStyle(color: textColor, fontWeight: FontWeight.w500),
        ),
        backgroundColor: backgroundColor,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  void showGuestModeDialog() {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text(
          'Guest Mode: Chat history won\'t be saved. Login to keep your chats.',
          style: TextStyle(color: AppColors.white),
        ),
        backgroundColor: AppColors.warning,
        duration: const Duration(seconds: 5),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        margin: const EdgeInsets.all(16),
        action: SnackBarAction(
          label: 'Login',
          textColor: AppColors.white,
          onPressed: () =>
              Navigator.pushReplacementNamed(context, '/login'),
        ),
      ),
    );
  }

  Future<void> loadSessionStats() async {
    try {
      sessionStats.value = aiService.getSessionStats();
    } catch (e) {
      debugPrint('Session stats error: $e');
    }
  }

  Future<void> initializeChat([String? sessionId]) async {
    isInitializing.value = true;
    try {
      if (sessionId != null) {
        // Load a specific session from history
        final history = await aiService.loadSessionHistory(sessionId);
        messages.value = history;
      } else {
        // Load the current, persistent session
        final currentSessionId = aiService.currentSessionId;
        final history = await aiService.loadSessionHistory(currentSessionId);
        if (history.isNotEmpty && !isGuest.value) {
          messages.value = history;
        } else {
          // No history, or is guest, so show greeting
          final greeting = ChatMessage.ai(
            text: isGuest.value
                ? '**Welcome to LetBuyy!** 🛒\n\nYou are in Guest Mode with limited features.\n\nFeatures available:\n- Browse products\n- View categories\n- Check available coupons\n\n*Login to save chat history and track orders.*'
                : '**Welcome to LetBuyy!** 🛒\n\nI\'m your smart shopping assistant. How can I help you today?\n\n**What I can do:**\n- 🛍️ Find products for you\n- 📦 Track your orders\n- 🎟️ Show you active coupons\n- 📚 Browse categories\n- ❓ Answer questions',
            sessionId: currentSessionId,
            quickReplies: ['Show all products', 'Best deals', 'Categories'],
            category: 'greeting',
          );
          messages.value = [greeting];
          if (!isGuest.value) await aiService.saveMessage(greeting);
        }
      }
      scrollToBottom(delay: const Duration(milliseconds: 300));
      if (!isGuest.value) await loadSessionStats();
    } catch (e) {
      debugPrint('Initialize chat error: $e');
      messages.value = [
        ChatMessage.error(
          text: 'Failed to load chat history. Please refresh or try again.',
          sessionId: aiService.currentSessionId,
          errorMessage: e.toString(),
        )
      ];
    } finally {
      isInitializing.value = false;
    }
  }

  // ✅ ADDED THIS FUNCTION BACK (it's crucial for persistence)
  Future<void> checkAuthAndInitialize() async {
    try {
      // ✅ MUST CALL INITSESSION() FIRST
      await aiService.initSession();

      final user = FirebaseAuth.instance.currentUser;
      isGuest.value = user == null;
      if (isGuest.value) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          showGuestModeDialog();
        });
      }
      // Now initializeChat() will use the correct persistent session ID
      await initializeChat();
    } catch (e) {
      debugPrint('Auth check failed: $e');
      showSnack('Failed to initialize chat.', isError: true);
      isInitializing.value = false;
    }
  }

  Future<void> sendMessage(String text) async {
    if (text.trim().isEmpty) return;

    HapticFeedback.mediumImpact();

    final userMessage = ChatMessage.user(
      text: text.trim(),
      sessionId: aiService.currentSessionId, // Uses persistent getter
      replyTo: replyToMessageId.value,
      category: 'user_query',
    );

    isLoading.value = true;
    replyToMessageId.value = null;

    final loading = ChatMessage.loading(
      sessionId: aiService.currentSessionId, // Uses persistent getter
      category: 'system',
    );
    messages.value = [...messages.value, userMessage, loading];
    scrollToBottom();

    if (!isGuest.value) await aiService.saveMessage(userMessage);

    try {
      final aiResponse = await aiService.processUserMessage(
        text,
        conversationHistory:
            messages.value.where((m) => m.id != loading.id).toList(),
      );

      messages.value = [
        ...messages.value.where((m) => m.id != loading.id),
        aiResponse
      ];

      if (!isGuest.value) {
        await aiService.saveMessage(aiResponse);
        await loadSessionStats();
      }
    } catch (e) {
      debugPrint('AI message error: $e');
      messages.value = [
        ...messages.value.where((m) => m.id != loading.id),
        ChatMessage.error(
          text: 'Something went wrong. Please try again.',
          sessionId: aiService.currentSessionId, // Uses persistent getter
          errorMessage: e.toString(),
        )
      ];
    } finally {
      isLoading.value = false;
      scrollToBottom(delay: const Duration(milliseconds: 200));
    }
  }

  Future<void> startNewChat() async {
    if (isGuest.value) {
      await aiService.startNewSession(); // Now async
      await initializeChat();
      return;
    }

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Start New Chat?'),
        content: const Text(
          'Your current chat will be saved in history. Start a new conversation?',
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: const Text('Cancel')),
          FilledButton(
              onPressed: () => Navigator.pop(context, true),
              child: const Text('Start New')),
        ],
      ),
    );

    if (confirmed == true) {
      await aiService.startNewSession(); // Now async
      await initializeChat();
      HapticFeedback.mediumImpact();
      showSnack('New chat started!', isError: false);
    }
  }

  Future<void> showHistory() async {
    if (isGuest.value) {
      showSnack('Login to access chat history', isError: true);
      return;
    }

    final selectedSession = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => const ChatHistoryScreen()),
    );

    if (selectedSession != null) {
      // This will now load the old session AND make it the new active one
      await initializeChat(selectedSession);
    }
  }

  void setReplyTo(String? messageId) {
    replyToMessageId.value = messageId;
  }

  useEffect(() {
    // ✅ Make sure the correct init function is called
    checkAuthAndInitialize();
    return null;
  }, []);

  final state = _AIChatState(
    messages: messages.value,
    isLoading: isLoading.value,
    isInitializing: isInitializing.value,
    isGuest: isGuest.value,
    sessionStats: sessionStats.value,
    replyToMessage: replyToMessageId.value == null
        ? null
        : messages.value.firstWhereOrNull(
            (m) => m.id == replyToMessageId.value),
  );

  final actions = _AIChatActions(
    sendMessage: sendMessage,
    startNewChat: startNewChat,
    showHistory: showHistory,
    setReplyTo: setReplyTo,
    scrollToBottom: scrollToBottom,
    showSnack: showSnack,
  );

  return (state: state, actions: actions);
}

// ... (Rest of the file, _ChatAppBar, _LoadingState, etc., remains the same) ...
class _ChatAppBar extends StatelessWidget implements PreferredSizeWidget {
  final VoidCallback onNewChat;
  final VoidCallback onHistory;
  final int messageCount;

  const _ChatAppBar({
    required this.onNewChat,
    required this.onHistory,
    required this.messageCount,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return AppBar(
      elevation: 0,
      backgroundColor: AppColors.primary,
      foregroundColor: AppColors.white,
      title: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'LetBuyy AI Chat', // ✅ FIXED: Changed from "Agrimate AI Chat"
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: AppColors.white,
            ),
          ),
          Text(
            '$messageCount Messages in this chat',
            style: const TextStyle(
              fontSize: 12,
              color: AppColors.textLightTertiary,
              fontWeight: FontWeight.w400,
            ),
          ),
        ],
      ),
      actions: [
        IconButton(
          icon: const Icon(Icons.history_rounded),
          tooltip: 'Chat History',
          onPressed: onHistory,
        ),
        IconButton(
          icon: const Icon(Icons.add_comment_rounded),
          tooltip: 'New Chat',
          onPressed: onNewChat,
        ),
      ],
    );
  }

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight + 8);
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          CircularProgressIndicator(
            color: AppColors.primary,
            strokeWidth: 3,
          ),
          const SizedBox(height: 20),
          Text(
            'Loading conversation...',
            style: Theme.of(context).textTheme.bodyLarge?.copyWith(
              color: AppColors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _GuestModeBanner extends StatelessWidget {
  const _GuestModeBanner();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: const BoxDecoration(
        color: AppColors.warning,
        border: Border(
          bottom: BorderSide(color: AppColors.borderLight, width: 1),
        ),
      ),
      child: Row(
        children: [
          Icon(Icons.info_outline, color: AppColors.white, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'Guest Mode – Limited features enabled',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: AppColors.white,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          TextButton(
            onPressed: () =>
                Navigator.pushReplacementNamed(context, '/login'),
            child: const Text(
              'Login',
              style: TextStyle(
                color: AppColors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SessionStatsBar extends StatelessWidget {
  final Map<String, int> stats;

  const _SessionStatsBar({required this.stats});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: const BoxDecoration(
        color: AppColors.primaryLight,
        border: Border(
          bottom: BorderSide(color: AppColors.borderLight, width: 0.5),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _StatChip(
            icon: Icons.chat_bubble_outline,
            value: '${stats['totalMessages'] ?? 0}',
            label: 'Messages',
          ),
          _StatChip(
            icon: Icons.shopping_bag_outlined,
            value: '${stats['productViews'] ?? 0}',
            label: 'Products',
          ),
          _StatChip(
            icon: Icons.person_outline,
            value: '${stats['userMessages'] ?? 0}',
            label: 'You',
          ),
        ],
      ),
    );
  }
}

class _StatChip extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;

  const _StatChip(
      {required this.icon, required this.value, required this.label});

  @override
  Widget build(BuildContext context) {
    const textColor = AppColors.white;
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: textColor),
        const SizedBox(width: 6),
        Text(
          value,
          style: const TextStyle(
            fontWeight: FontWeight.w600,
            color: textColor,
            fontSize: 13,
          ),
        ),
        const SizedBox(width: 4),
        Text(
          label,
          style: const TextStyle(
            color: textColor,
            fontSize: 11,
          ),
        ),
      ],
    );
  }
}

class _MessageList extends StatelessWidget {
  final ScrollController scrollController;
  final List<ChatMessage> messages;
  final void Function(String) onQuickReply;
  final void Function(String) onReply;
  final void Function(String) onCopy;

  const _MessageList({
    required this.scrollController,
    required this.messages,
    required this.onQuickReply,
    required this.onReply,
    required this.onCopy,
  });

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      controller: scrollController,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
      itemCount: messages.length,
      itemBuilder: (context, index) {
        final message = messages[index];
        final showTimestamp = index == 0 ||
            messages[index - 1]
                    .timestamp
                    .difference(message.timestamp)
                    .inMinutes >
                5;

        return Column(
          children: [
            if (showTimestamp) _buildTimestamp(context, message.timestamp),
            GestureDetector(
              onLongPress: () => _showMessageOptions(context, message),
              child: MessageBubble(
                message: message,
                onQuickReply: onQuickReply,
                onBookmark: () {},
                onRate: (_) {},
                onCopy: () => onCopy(message.text),
              ),
            ),
            const SizedBox(height: 12),
          ],
        );
      },
    );
  }

  Widget _buildTimestamp(BuildContext context, DateTime timestamp) {
    final formatted = DateFormat('MMM d, yyyy – hh:mm a').format(timestamp);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Text(
        formatted,
        style: Theme.of(context).textTheme.bodySmall?.copyWith(
          color: AppColors.textTertiary,
          fontSize: 11,
        ),
      ),
    );
  }

  void _showMessageOptions(BuildContext context, ChatMessage message) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (_) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.reply),
              title: const Text('Reply'),
              onTap: () {
                Navigator.pop(context);
                onReply(message.id);
              },
            ),
            ListTile(
              leading: const Icon(Icons.copy),
              title: const Text('Copy'),
              onTap: () {
                Navigator.pop(context);
                onCopy(message.text);
              },
            ),
            ListTile(
              leading: const Icon(Icons.share),
              title: const Text('Share'),
              onTap: () {
                Navigator.pop(context);
                // Implement share functionality
              },
            ),
          ],
        ),
      ),
    );
  }
}

class _ReplyingToBar extends StatelessWidget {
  final ChatMessage message;
  final VoidCallback onCancel;

  const _ReplyingToBar({required this.message, required this.onCancel});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: const BoxDecoration(
        color: AppColors.primaryLight,
        border: Border(
          top: BorderSide(color: AppColors.borderLight, width: 0.5),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.reply, size: 18, color: AppColors.white),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message.text.replaceAll('\n', ' '),
              style: const TextStyle(
                color: AppColors.white,
                fontSize: 12,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          IconButton(
            icon: const Icon(Icons.close, size: 18, color: AppColors.white),
            onPressed: onCancel,
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(),
          ),
        ],
      ),
    );
  }
}

class _ChatInputArea extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final bool isLoading;
  final void Function(String) onSend;

  const _ChatInputArea({
    required this.controller,
    required this.focusNode,
    required this.isLoading,
    required this.onSend,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: AppColors.white,
        boxShadow: [
          BoxShadow(
            color: AppColors.shadowLight,
            blurRadius: 10,
            offset: Offset(0, -5),
          )
        ],
      ),
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: Container(
                  decoration: BoxDecoration(
                    color: AppColors.surfaceVariant,
                    borderRadius: BorderRadius.circular(25),
                    border: Border.all(
                      color: AppColors.borderLight,
                      width: 1,
                    ),
                  ),
                  child: TextField(
                    controller: controller,
                    focusNode: focusNode,
                    decoration: const InputDecoration(
                      hintText: 'Ask me anything...',
                      hintStyle: TextStyle(color: AppColors.textHint),
                      border: InputBorder.none,
                      contentPadding:
                          EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    ),
                    textInputAction: TextInputAction.send,
                    // ✅ FIXED: Clear controller on submit
                    onSubmitted: isLoading
                        ? null
                        : (text) {
                            if (text.trim().isNotEmpty) {
                              onSend(text);
                              controller.clear();
                            }
                          },
                    enabled: !isLoading,
                    maxLines: null,
                    textCapitalization: TextCapitalization.sentences,
                    style: const TextStyle(
                      color: AppColors.textPrimary,
                      fontSize: 14,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                child: Material(
                  color: isLoading
                      ? AppColors.surfaceVariant
                      : AppColors.primary,
                  borderRadius: BorderRadius.circular(25),
                  child: InkWell(
                    // ✅ FIXED: Clear controller on tap
                    onTap: isLoading
                        ? null
                        : () {
                            if (controller.text.trim().isNotEmpty) {
                              onSend(controller.text);
                              controller.clear();
                            }
                          },
                    borderRadius: BorderRadius.circular(25),
                    child: SizedBox(
                      width: 50,
                      height: 50,
                      child: isLoading
                          ? Padding(
                              padding: const EdgeInsets.all(12),
                              child: CircularProgressIndicator(
                                strokeWidth: 2.5,
                                valueColor: const AlwaysStoppedAnimation<Color>(
                                  AppColors.primary,
                                ),
                              ),
                            )
                          : const Icon(
                              Icons.send,
                              color: AppColors.white,
                              size: 20,
                            ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

extension ListExtension<T> on List<T> {
  T? firstWhereOrNull(bool Function(T) test) {
    try {
      return firstWhere(test);
    } catch (e) {
      return null;
    }
  }
}