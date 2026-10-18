// lib/screens/chat/ai_chat_screen.dart
import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_api_client/letbuyy_api_client.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'widgets/message_bubble.dart';
import 'package:letbuyy_marketplace/widgets/premium_scaffold.dart';
import 'package:letbuyy_marketplace/auth/buyer_sign_in_controller.dart';
import 'chat_history_screen.dart';

class AIChatScreen extends StatelessWidget {
  const AIChatScreen({super.key, this.service});

  /// Optional local transport seam; ordinary routes use the existing singleton.
  final AIChatService? service;

  @override
  Widget build(BuildContext context) {
    final signIn = context.watch<BuyerSignInController>();
    final chat = service ?? AIChatService.instance;
    chat.configure(
      client: context.read<ApiClient>(),
      accounts: context.read<BuyerAccountApi>(),
    );
    chat.updateAuth(
      buyerId: signIn.buyerId,
      sessionToken: signIn.token,
      email: signIn.email,
    );
    // Disposing the actor's subtree also disposes input, focus, reply, loading,
    // and scroll state. A token refresh for the same principal keeps that subtree.
    return _ActorAIChatScreen(
      key: ValueKey((chat, signIn.buyerId)),
      service: chat,
      sessionToken: signIn.token,
    );
  }
}

class _ActorAIChatScreen extends HookWidget {
  const _ActorAIChatScreen({
    super.key,
    required this.service,
    required this.sessionToken,
  });
  final AIChatService service;
  final String? sessionToken;

  @override
  Widget build(BuildContext context) {
    final textController = useTextEditingController();
    final scrollController = useScrollController();
    final focusNode = useFocusNode();

    final chat = _useAIChat(
      context: context,
      scrollController: scrollController,
      inputController: textController,
      aiService: service,
      sessionToken: sessionToken,
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
                          chat.actions.showSnack(
                            'Message copied',
                            isError: false,
                          );
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
                      child: const Icon(
                        Icons.arrow_downward,
                        color: AppColors.white,
                      ),
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
  required TextEditingController inputController,
  required AIChatService aiService,
  required String? sessionToken,
}) {
  final messages = useState<List<ChatMessage>>([]);
  final isLoading = useState(false);
  final isInitializing = useState(true);
  final sessionStats = useState<Map<String, int>>({});
  final replyToMessageId = useState<String?>(null);
  final runId = useRef(0);
  final ownedEpoch = useRef(aiService.epoch);
  final scrollTimer = useRef<Timer?>(null);
  final isGuest = !aiService.isSignedIn;

  bool current(int run, int epoch) =>
      context.mounted && runId.value == run && aiService.isCurrent(epoch);

  void scrollToBottom({Duration delay = Duration.zero}) {
    final run = runId.value;
    scrollTimer.value?.cancel();
    scrollTimer.value = Timer(delay, () {
      if (!context.mounted ||
          runId.value != run ||
          !scrollController.hasClients)
        return;
      scrollController.animateTo(
        scrollController.position.maxScrollExtent,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    });
  }

  void showSnack(String msg, {required bool isError}) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isError ? AppColors.error : AppColors.success,
      ),
    );
  }

  Future<void> initializeChat() async {
    final run = runId.value;
    final epoch = aiService.epoch;
    ownedEpoch.value = epoch;
    isInitializing.value = true;
    try {
      await aiService.initSession();
      if (!current(run, epoch)) return;
      final id = aiService.currentSessionId;
      await aiService.loadSessionHistory(id);
      if (!current(run, epoch)) return;
      final greeting = ChatMessage.ai(
        text: isGuest
            ? '**LetBuyy shopping help**\n\nSign in to request the server assistant. Availability depends on an approved server profile. Product facts remain available in the catalog.'
            : '**LetBuyy shopping help**\n\nThe assistant is available only with an approved server profile and request allowance. Only your message and short excerpts from up to eight visible chat messages are submitted. Profile, orders and support records are not added. Product prices and stock must be verified in the catalog.',
        sessionId: id,
        quickReplies: ['Show all products', 'Best deals', 'Categories'],
        category: 'greeting',
      );
      messages.value = [greeting];
      if (!isGuest) await aiService.saveMessage(greeting, expectedEpoch: epoch);
      if (!current(run, epoch)) return;
      sessionStats.value = aiService.getSessionStats();
      scrollToBottom(delay: const Duration(milliseconds: 300));
    } catch (_) {
      if (!current(run, epoch)) return;
      messages.value = [
        ChatMessage.error(
          text: 'Chat could not be initialized. Start a new chat to retry.',
          sessionId: aiService.initializedSessionId ?? '',
          errorMessage: 'Chat initialization failed.',
        ),
      ];
    } finally {
      if (current(run, epoch)) isInitializing.value = false;
    }
  }

  Future<void> sendMessage(String text) async {
    if (text.trim().isEmpty || isLoading.value || isInitializing.value) return;
    if (aiService.initializedSessionId == null) {
      await initializeChat();
      return;
    }
    final run = runId.value;
    final epoch = aiService.epoch;
    ownedEpoch.value = epoch;
    final id = aiService.currentSessionId;
    final userMessage = ChatMessage.user(
      text: text.trim(),
      sessionId: id,
      replyTo: replyToMessageId.value,
      category: 'user_query',
    );
    final loading = ChatMessage.loading(sessionId: id, category: 'system');
    isLoading.value = true;
    replyToMessageId.value = null;
    messages.value = [...messages.value, userMessage, loading];
    HapticFeedback.mediumImpact();
    scrollToBottom();
    if (!isGuest)
      await aiService.saveMessage(userMessage, expectedEpoch: epoch);
    if (!current(run, epoch)) return;
    try {
      final response = await aiService.processUserMessage(
        text,
        conversationHistory: messages.value
            .where((m) => m.id != loading.id)
            .toList(),
      );
      if (!current(run, epoch)) return;
      messages.value = [
        ...messages.value.where((m) => m.id != loading.id),
        response,
      ];
      if (!isGuest) await aiService.saveMessage(response, expectedEpoch: epoch);
      if (current(run, epoch)) sessionStats.value = aiService.getSessionStats();
    } catch (_) {
      if (!current(run, epoch)) return;
      messages.value = [
        ...messages.value.where((m) => m.id != loading.id),
        ChatMessage.error(
          text: 'Something went wrong. Please try again.',
          sessionId: id,
          errorMessage: 'Message could not be completed.',
        ),
      ];
    } finally {
      if (current(run, epoch)) {
        isLoading.value = false;
        scrollToBottom(delay: const Duration(milliseconds: 200));
      }
    }
  }

  Future<void> startNewChat() async {
    final run = runId.value;
    final epoch = aiService.epoch;
    final confirmed =
        isGuest ||
        await showDialog<bool>(
              context: context,
              builder: (dialogContext) => AlertDialog(
                title: const Text('Start New Chat?'),
                content: const Text(
                  'Chat history is only available in this session. Start a new conversation?',
                ),
                actions: [
                  TextButton(
                    onPressed: () => Navigator.pop(dialogContext, false),
                    child: const Text('Cancel'),
                  ),
                  FilledButton(
                    onPressed: () => Navigator.pop(dialogContext, true),
                    child: const Text('Start New'),
                  ),
                ],
              ),
            ) ==
            true;
    if (!confirmed || !current(run, epoch)) return;
    runId.value++;
    inputController.clear();
    replyToMessageId.value = null;
    messages.value = [];
    sessionStats.value = {};
    isLoading.value = false;
    final pending = aiService.startNewSession();
    final newEpoch = aiService.epoch;
    ownedEpoch.value = newEpoch;
    final newRun = runId.value;
    await pending;
    if (!current(newRun, newEpoch)) return;
    await initializeChat();
  }

  Future<void> showHistory() async {
    final run = runId.value;
    final epoch = aiService.epoch;
    final selectedSession = await Navigator.push<String>(
      context,
      MaterialPageRoute(builder: (_) => const ChatHistoryScreen()),
    );
    if (selectedSession != null &&
        current(run, epoch) &&
        selectedSession == aiService.currentSessionId)
      await initializeChat();
  }

  useEffect(() {
    runId.value++;
    ownedEpoch.value = aiService.epoch;
    // Same-principal token refresh cancels old work and unlocks retry, while
    // retaining the principal's conversation and draft. Actor changes remount.
    isLoading.value = false;
    messages.value = messages.value
        .where((m) => m.messageType != MessageType.loading)
        .toList();
    if (messages.value.isEmpty) unawaited(initializeChat());
    return () {
      runId.value++;
      scrollTimer.value?.cancel();
      aiService.invalidatePending(expectedEpoch: ownedEpoch.value);
    };
  }, [sessionToken, aiService]);

  return (
    state: _AIChatState(
      messages: messages.value,
      isLoading: isLoading.value,
      isInitializing: isInitializing.value,
      isGuest: isGuest,
      sessionStats: sessionStats.value,
      replyToMessage: replyToMessageId.value == null
          ? null
          : messages.value.firstWhereOrNull(
              (m) => m.id == replyToMessageId.value,
            ),
    ),
    actions: _AIChatActions(
      sendMessage: sendMessage,
      startNewChat: startNewChat,
      showHistory: showHistory,
      setReplyTo: (id) => replyToMessageId.value = id,
      scrollToBottom: scrollToBottom,
      showSnack: showSnack,
    ),
  );
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
          CircularProgressIndicator(color: AppColors.primary, strokeWidth: 3),
          const SizedBox(height: 20),
          Text(
            'Loading conversation...',
            style: Theme.of(
              context,
            ).textTheme.bodyLarge?.copyWith(color: AppColors.textPrimary),
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
            onPressed: () => Navigator.pushReplacementNamed(context, '/login'),
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

  const _StatChip({
    required this.icon,
    required this.value,
    required this.label,
  });

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
        Text(label, style: const TextStyle(color: textColor, fontSize: 11)),
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
        final showTimestamp =
            index == 0 ||
            messages[index - 1].timestamp
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

  Future<void> _showMessageOptions(
    BuildContext context,
    ChatMessage message,
  ) async {
    final auth = context.read<BuyerSignInController>();
    final buyerId = auth.buyerId;
    final navigator = Navigator.of(context);
    ModalRoute<dynamic>? ownedRoute;
    void dismissOldActorOptions() {
      final route = ownedRoute;
      if (auth.buyerId != buyerId && route != null && route.isActive) {
        navigator.removeRoute(route);
      }
    }

    auth.addListener(dismissOldActorOptions);
    try {
      await showModalBottomSheet<void>(
        context: context,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (sheetContext) {
          ownedRoute = ModalRoute.of(sheetContext);
          if (auth.buyerId != buyerId) {
            scheduleMicrotask(dismissOldActorOptions);
            return const SizedBox.shrink();
          }
          return SafeArea(
            child: Wrap(
              children: [
                ListTile(
                  leading: const Icon(Icons.reply),
                  title: const Text('Reply'),
                  onTap: () {
                    Navigator.pop(sheetContext);
                    if (context.mounted && auth.buyerId == buyerId)
                      onReply(message.id);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.copy),
                  title: const Text('Copy'),
                  onTap: () {
                    Navigator.pop(sheetContext);
                    if (context.mounted && auth.buyerId == buyerId)
                      onCopy(message.text);
                  },
                ),
                ListTile(
                  leading: const Icon(Icons.share),
                  title: const Text('Share'),
                  onTap: () => Navigator.pop(sheetContext),
                ),
              ],
            ),
          );
        },
      );
    } finally {
      auth.removeListener(dismissOldActorOptions);
    }
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
              style: const TextStyle(color: AppColors.white, fontSize: 12),
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
          ),
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
                    border: Border.all(color: AppColors.borderLight, width: 1),
                  ),
                  child: TextField(
                    controller: controller,
                    focusNode: focusNode,
                    decoration: const InputDecoration(
                      hintText: 'Ask me anything...',
                      hintStyle: TextStyle(color: AppColors.textHint),
                      border: InputBorder.none,
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 20,
                        vertical: 12,
                      ),
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
