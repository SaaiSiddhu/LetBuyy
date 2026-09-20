// lib/screens/chat/widgets/message_bubble.dart
import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'product_card_horizontal.dart';
import 'quick_reply_chip.dart';
import 'typing_indicator.dart';
import 'order_card_renderer.dart';

class MessageBubble extends HookWidget {
  final ChatMessage message;
  final Function(String)? onQuickReply;
  final Function(String)? onOrderTap;
  final Function(int)? onRate;
  final VoidCallback? onBookmark;
  final VoidCallback? onCopy;

  const MessageBubble({
    super.key,
    required this.message,
    this.onQuickReply,
    this.onOrderTap,
    this.onRate,
    this.onBookmark,
    this.onCopy,
  });

  @override
  Widget build(BuildContext context) {
    // --- Animation with Hooks ---
    final animationController = useAnimationController(
      duration: const Duration(milliseconds: 300),
    );

    final fadeAnimation = useMemoized(
      () => Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: animationController, curve: Curves.easeOut),
      ),
      [animationController],
    );

    final slideAnimation = useMemoized(
      () => Tween<Offset>(
        begin: Offset(message.isUser ? 0.3 : -0.3, 0),
        end: Offset.zero,
      ).animate(
        CurvedAnimation(parent: animationController, curve: Curves.easeOut),
      ),
      [animationController],
    );

    useEffect(() {
      animationController.forward();
      return null;
    }, [animationController]);

    // --- Widget Build Logic ---
    if (message.messageType == MessageType.loading) {
      return const Align(
        alignment: Alignment.centerLeft,
        child: Padding(
          padding: EdgeInsets.symmetric(vertical: 4.0),
          child: TypingIndicator(),
        ),
      );
    }

    if (message.messageType == MessageType.system) {
      return const SizedBox.shrink(); // Don't render system messages
    }

    return FadeTransition(
      opacity: fadeAnimation,
      child: SlideTransition(
        position: slideAnimation,
        child: Align(
          alignment:
              message.isUser ? Alignment.centerRight : Alignment.centerLeft,
          child: Container(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.of(context).size.width * 0.85,
            ),
            margin: const EdgeInsets.symmetric(vertical: 4),
            child: Column(
              crossAxisAlignment: message.isUser
                  ? CrossAxisAlignment.end
                  : CrossAxisAlignment.start,
              children: [
                _buildMessageContent(context, message),

                // ✅ FIXED: Order List with proper null handling
                if (message.hasOrders && onOrderTap != null) ...[
                  const SizedBox(height: 12),
                  OrderCardRenderer(
                    message: message,
                    onOrderTap: onOrderTap!,
                  ),
                ],

                // ✅ Product List
                if (message.hasProducts) ...[
                  const SizedBox(height: 12),
                  _buildProductsList(message),
                ],

                // ✅ Quick Replies
                if (message.hasQuickReplies) ...[
                  const SizedBox(height: 12),
                  _buildQuickReplies(message, onQuickReply),
                ],

                // ✅ Suggestions
                if (message.hasSuggestions) ...[
                  const SizedBox(height: 12),
                  _buildSuggestions(context, message),
                ],

                // ✅ AI Message Actions
                if (message.isAI) ...[
                  const SizedBox(height: 8),
                  _buildMessageActions(
                    context,
                    message,
                    onRate,
                    onBookmark,
                    onCopy,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------
// Private Helper Functions
// -----------------------------------------------------------------

Widget _buildMessageContent(
    BuildContext context, ChatMessage message) {
  final borderRadius = BorderRadius.only(
    topLeft: const Radius.circular(20),
    topRight: const Radius.circular(20),
    bottomLeft: Radius.circular(message.isUser ? 20 : 4),
    bottomRight: Radius.circular(message.isUser ? 4 : 20),
  );

  // Color scheme based on message type
  final (bubbleColor, textColor, timeColor, gradient) = () {
    if (message.isUser) {
      return (
        Colors.transparent, // Will be covered by gradient
        AppColors.white,
        AppColors.white.withValues(alpha: 0.8),
        LinearGradient(
          colors: [
            AppColors.primary,
            AppColors.primaryLight,
          ],
        ),
      );
    } else if (message.isError) {
      return (
        AppColors.error.withValues(alpha: 0.1),
        AppColors.error,
        AppColors.error.withValues(alpha: 0.7),
        null as LinearGradient?,
      );
    } else {
      return (
        AppColors.surfaceVariant,
        AppColors.textPrimary,
        AppColors.textTertiary,
        null as LinearGradient?,
      );
    }
  }();

  return Container(
    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    decoration: BoxDecoration(
      gradient: gradient,
      color: bubbleColor,
      borderRadius: borderRadius,
      boxShadow: [
        BoxShadow(
          color: AppColors.shadowLight,
          blurRadius: 6,
          offset: const Offset(0, 2),
        ),
      ],
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Use Markdown for AI messages, simple Text for user
        if (message.isAI || message.isError)
          MarkdownBody(
            data: message.text,
            selectable: true,
            styleSheet: MarkdownStyleSheet(
              p: TextStyle(
                fontSize: 14,
                height: 1.5,
                color: textColor,
              ),
              a: TextStyle(
                color: message.isUser ? AppColors.white : AppColors.primary,
                decoration: TextDecoration.underline,
                fontSize: 14,
              ),
              em: TextStyle(
                color: textColor.withValues(alpha: 0.8),
                fontStyle: FontStyle.italic,
              ),
              strong: TextStyle(
                color: textColor,
                fontWeight: FontWeight.w700,
              ),
              h1: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w700,
                color: textColor,
              ),
              h2: TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: textColor,
              ),
              h3: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: textColor,
              ),
              listBullet: TextStyle(color: textColor),
            ),
          )
        else
          Text(
            message.text,
            style: TextStyle(
              color: textColor,
              height: 1.5,
              fontSize: 14,
            ),
          ),
        const SizedBox(height: 6),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              message.formattedTime,
              style: TextStyle(
                color: timeColor,
                fontSize: 11,
                fontWeight: FontWeight.w400,
              ),
            ),
            if (message.isBookmarked) ...[
              const SizedBox(width: 4),
              Icon(
                Icons.bookmark,
                size: 12,
                color: message.isUser ? timeColor : AppColors.ratingActive,
              ),
            ],
          ],
        ),
      ],
    ),
  );
}

Widget _buildProductsList(ChatMessage message) {
  return SizedBox(
    height: 220,
    child: ListView.builder(
      scrollDirection: Axis.horizontal,
      itemCount: message.productCount,
      padding: const EdgeInsets.symmetric(horizontal: 0),
      itemBuilder: (context, index) {
        final product = message.products![index];
        return Padding(
          padding: EdgeInsets.only(right: index < message.productCount - 1 ? 12 : 0),
          child: ProductCardHorizontal(product: product),
        );
      },
    ),
  );
}

Widget _buildQuickReplies(
    ChatMessage message, Function(String)? onQuickReply) {
  return Wrap(
    spacing: 8,
    runSpacing: 8,
    children: message.quickReplies?.map((reply) {
      return QuickReplyChip(
        label: reply,
        onTap: () => onQuickReply?.call(reply),
      );
    }).toList() ?? [],
  );
}

Widget _buildSuggestions(BuildContext context, ChatMessage message) {
  final suggestions = (message.data != null &&
          message.data!['suggestions'] is List)
      ? List<String>.from(message.data!['suggestions'] as List)
      : <String>[];

  if (suggestions.isEmpty) return const SizedBox.shrink();

  return Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: AppColors.accent.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(12),
      border: Border.all(
        color: AppColors.accent.withValues(alpha: 0.3),
        width: 1,
      ),
    ),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(
              Icons.tips_and_updates,
              size: 16,
              color: AppColors.accent,
            ),
            const SizedBox(width: 8),
            Text(
              'Suggestions:',
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontWeight: FontWeight.w600,
                fontSize: 12,
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        ...suggestions.map(
          (s) => Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Text(
              '• $s',
              style: const TextStyle(
                color: AppColors.textSecondary,
                fontSize: 12,
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

Widget _buildMessageActions(
  BuildContext context,
  ChatMessage message,
  Function(int)? onRate,
  VoidCallback? onBookmark,
  VoidCallback? onCopy,
) {
  return Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      // Star rating display
      if (message.isRated)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: AppColors.ratingActive.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.star, size: 12, color: AppColors.ratingActive),
              const SizedBox(width: 4),
              Text(
                '${message.rating}',
                style: const TextStyle(
                  color: AppColors.ratingActive,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        )
      else
        TextButton.icon(
          onPressed: () => _showRatingDialog(context, onRate),
          icon: const Icon(Icons.star_outline, size: 14),
          label: const Text(
            'Rate',
            style: TextStyle(fontSize: 12),
          ),
          style: TextButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            minimumSize: Size.zero,
            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            foregroundColor: AppColors.textTertiary,
          ),
        ),

      // Bookmark button
      IconButton(
        icon: Icon(
          message.isBookmarked ? Icons.bookmark : Icons.bookmark_outline,
          size: 16,
          color: message.isBookmarked
              ? AppColors.ratingActive
              : AppColors.textTertiary,
        ),
        padding: EdgeInsets.zero,
        constraints: const BoxConstraints(),
        onPressed: onBookmark,
        splashRadius: 16,
      ),

      // Copy button
      IconButton(
        icon: const Icon(
          Icons.copy_outlined,
          size: 16,
          color: AppColors.textTertiary,
        ),
        padding: EdgeInsets.zero,
        constraints: const BoxConstraints(),
        onPressed: onCopy,
        splashRadius: 16,
      ),
    ],
  );
}

void _showRatingDialog(BuildContext context, Function(int)? onRate) {
  showDialog(
    context: context,
    builder: (context) => AlertDialog(
      title: const Text('Rate this response'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('How helpful was this answer?'),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: List.generate(5, (index) {
              final rating = index + 1;
              return IconButton(
                icon: Icon(
                  Icons.star,
                  color: AppColors.ratingActive,
                  size: 32,
                ),
                onPressed: () {
                  onRate?.call(rating);
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text('Thanks for rating! ($rating/5)'),
                      duration: const Duration(seconds: 2),
                      backgroundColor: AppColors.success,
                    ),
                  );
                },
              );
            }),
          ),
        ],
      ),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
      ],
    ),
  );
}