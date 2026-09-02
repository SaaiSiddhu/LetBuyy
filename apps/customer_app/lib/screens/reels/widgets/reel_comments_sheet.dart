import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:provider/provider.dart';

/// Instagram-style comments bottom sheet for reels
class ReelCommentsSheet extends StatefulWidget {
  final String reelId;
  final String sellerId;
  final VoidCallback? onClose;

  const ReelCommentsSheet({
    super.key,
    required this.reelId,
    required this.sellerId,
    this.onClose,
  });

  /// Show the comments sheet
  static Future<void> show(
    BuildContext context, {
    required String reelId,
    required String sellerId,
    VoidCallback? onClose,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => ReelCommentsSheet(
        reelId: reelId,
        sellerId: sellerId,
        onClose: onClose,
      ),
    );
  }

  @override
  State<ReelCommentsSheet> createState() => _ReelCommentsSheetState();
}

class _ReelCommentsSheetState extends State<ReelCommentsSheet> {
  final ReelService _reelService = ReelService();
  final TextEditingController _commentController = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  
  bool _isSubmitting = false;
  String? _replyingToId;
  String? _replyingToName;

  @override
  void dispose() {
    _commentController.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  Future<void> _submitComment() async {
    final text = _commentController.text.trim();
    if (text.isEmpty) return;

    final user = FirebaseAuth.instance.currentUser;
    if (user == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please login to comment')),
      );
      return;
    }

    setState(() => _isSubmitting = true);

    // Get user info
    final userDoc = await FirebaseFirestore.instance
        .collection('users')
        .doc(user.uid)
        .get();
    final userData = userDoc.data() ?? {};
    final userName = userData['displayName'] ?? userData['name'] ?? 'User';
    final userAvatar = userData['photoUrl'] ?? userData['avatar'];

    if (_replyingToId != null) {
      // Check if current user is the seller
      final isSeller = user.uid == widget.sellerId;
      
      if (isSeller) {
        await _reelService.addSellerReply(
          reelId: widget.reelId,
          parentCommentId: _replyingToId!,
          sellerId: user.uid,
          sellerName: userName,
          sellerAvatar: userAvatar,
          text: text,
        );
      } else {
        await _reelService.addComment(
          reelId: widget.reelId,
          userId: user.uid,
          userName: userName,
          userAvatar: userAvatar,
          text: text,
          parentCommentId: _replyingToId,
        );
      }
    } else {
      await _reelService.addComment(
        reelId: widget.reelId,
        userId: user.uid,
        userName: userName,
        userAvatar: userAvatar,
        text: text,
      );
    }

    _commentController.clear();
    _cancelReply();
    setState(() => _isSubmitting = false);
    HapticFeedback.lightImpact();
  }

  void _startReply(String commentId, String userName) {
    setState(() {
      _replyingToId = commentId;
      _replyingToName = userName;
    });
    _focusNode.requestFocus();
  }

  void _cancelReply() {
    setState(() {
      _replyingToId = null;
      _replyingToName = null;
    });
  }

  Future<void> _toggleLike(ReelCommentModel comment) async {
    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId == null) return;

    HapticFeedback.lightImpact();
    
    if (comment.hasUserLiked(userId)) {
      await _reelService.unlikeComment(commentId: comment.id, userId: userId);
    } else {
      await _reelService.likeComment(commentId: comment.id, userId: userId);
    }
  }

  Future<void> _deleteComment(ReelCommentModel comment) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Comment?'),
        content: const Text('This action cannot be undone.'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete', style: TextStyle(color: AppColors.error)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      await _reelService.deleteComment(
        commentId: comment.id,
        reelId: widget.reelId,
      );
      HapticFeedback.mediumImpact();
    }
  }

  Future<void> _togglePin(ReelCommentModel comment) async {
    HapticFeedback.mediumImpact();
    
    if (comment.isPinned) {
      await _reelService.unpinComment(comment.id);
    } else {
      final success = await _reelService.pinComment(
        commentId: comment.id,
        reelId: widget.reelId,
      );
      if (!success && mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Maximum 3 pinned comments allowed')),
        );
      }
    }
  }

  /// Toggle seller "❤️ by creator" like on a comment
  Future<void> _toggleCreatorLike(ReelCommentModel comment) async {
    final userId = FirebaseAuth.instance.currentUser?.uid;
    if (userId != widget.sellerId) return; // Only seller can do this
    
    HapticFeedback.mediumImpact();
    
    if (comment.likedBySeller) {
      await _reelService.sellerUnlikeComment(commentId: comment.id);
    } else {
      await _reelService.sellerLikeComment(
        commentId: comment.id,
        sellerId: widget.sellerId,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final currentUserId = FirebaseAuth.instance.currentUser?.uid;
    final isSeller = currentUserId == widget.sellerId;

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      minChildSize: 0.4,
      maxChildSize: 0.9,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              // Handle
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[400],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Header
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Comments',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: isDark ? Colors.white : Colors.black,
                      ),
                    ),
                    IconButton(
                      icon: Icon(
                        Icons.close,
                        color: isDark ? Colors.white70 : Colors.black54,
                      ),
                      onPressed: () {
                        widget.onClose?.call();
                        Navigator.pop(context);
                      },
                    ),
                  ],
                ),
              ),

              const Divider(height: 1),

              // Comments List
              Expanded(
                child: StreamBuilder<List<ReelCommentModel>>(
                  stream: _reelService.getComments(widget.reelId),
                  builder: (context, snapshot) {
                    if (snapshot.connectionState == ConnectionState.waiting) {
                      return const Center(
                        child: CircularProgressIndicator(),
                      );
                    }

                    final comments = snapshot.data ?? [];

                    if (comments.isEmpty) {
                      return Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.chat_bubble_outline,
                              size: 64,
                              color: Colors.grey[400],
                            ),
                            const SizedBox(height: 16),
                            Text(
                              'No comments yet',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                                color: isDark ? Colors.white70 : Colors.black54,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text(
                              'Be the first to comment!',
                              style: TextStyle(
                                color: Colors.grey[500],
                              ),
                            ),
                          ],
                        ),
                      );
                    }

                    return ListView.builder(
                      controller: scrollController,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      itemCount: comments.length,
                      itemBuilder: (context, index) {
                        return _CommentTile(
                          comment: comments[index],
                          isDark: isDark,
                          currentUserId: currentUserId,
                          isSeller: isSeller,
                          onReply: () => _startReply(
                            comments[index].id,
                            comments[index].userName,
                          ),
                          onLike: () => _toggleLike(comments[index]),
                          onDelete: () => _deleteComment(comments[index]),
                          onPin: () => _togglePin(comments[index]),
                          onCreatorLike: () => _toggleCreatorLike(comments[index]),
                          reelService: _reelService,
                        );
                      },
                    );
                  },
                ),
              ),

              // Reply indicator
              if (_replyingToName != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  color: isDark ? Colors.grey[900] : Colors.grey[100],
                  child: Row(
                    children: [
                      Text(
                        'Replying to @$_replyingToName',
                        style: TextStyle(
                          color: isDark ? Colors.white70 : Colors.black54,
                          fontSize: 13,
                        ),
                      ),
                      const Spacer(),
                      GestureDetector(
                        onTap: _cancelReply,
                        child: Icon(
                          Icons.close,
                          size: 18,
                          color: isDark ? Colors.white54 : Colors.black45,
                        ),
                      ),
                    ],
                  ),
                ),

              // Input Field
              Container(
                padding: EdgeInsets.only(
                  left: 16,
                  right: 16,
                  top: 12,
                  bottom: MediaQuery.of(context).padding.bottom + 12,
                ),
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF262626) : Colors.white,
                  border: Border(
                    top: BorderSide(
                      color: isDark ? Colors.white12 : Colors.grey[200]!,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    // Avatar
                    CircleAvatar(
                      radius: 18,
                      backgroundColor: AppColors.primary.withValues(alpha: 0.2),
                      child: Icon(
                        Icons.person,
                        size: 20,
                        color: AppColors.primary,
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Text Field
                    Expanded(
                      child: TextField(
                        controller: _commentController,
                        focusNode: _focusNode,
                        style: TextStyle(
                          color: isDark ? Colors.white : Colors.black,
                        ),
                        decoration: InputDecoration(
                          hintText: _replyingToName != null
                              ? 'Reply to @$_replyingToName...'
                              : 'Add a comment...',
                          hintStyle: TextStyle(
                            color: isDark ? Colors.white38 : Colors.grey[500],
                          ),
                          border: InputBorder.none,
                          isDense: true,
                          contentPadding:
                              const EdgeInsets.symmetric(vertical: 10),
                        ),
                        maxLines: 4,
                        minLines: 1,
                        textInputAction: TextInputAction.send,
                        onSubmitted: (_) => _submitComment(),
                      ),
                    ),

                    // Send Button
                    GestureDetector(
                      onTap: _isSubmitting ? null : _submitComment,
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          shape: BoxShape.circle,
                        ),
                        child: _isSubmitting
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(
                                Icons.send_rounded,
                                color: Colors.white,
                                size: 18,
                              ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

/// Individual comment tile with replies
class _CommentTile extends StatefulWidget {
  final ReelCommentModel comment;
  final bool isDark;
  final String? currentUserId;
  final bool isSeller;
  final VoidCallback onReply;
  final VoidCallback onLike;
  final VoidCallback onDelete;
  final VoidCallback onPin;
  final VoidCallback onCreatorLike;
  final ReelService reelService;

  const _CommentTile({
    required this.comment,
    required this.isDark,
    this.currentUserId,
    required this.isSeller,
    required this.onReply,
    required this.onLike,
    required this.onDelete,
    required this.onPin,
    required this.onCreatorLike,
    required this.reelService,
  });

  @override
  State<_CommentTile> createState() => _CommentTileState();
}

class _CommentTileState extends State<_CommentTile> {
  bool _showReplies = false;

  @override
  Widget build(BuildContext context) {
    final canDelete = widget.currentUserId == widget.comment.userId ||
        widget.isSeller;
    final hasLiked = widget.currentUserId != null &&
        widget.comment.hasUserLiked(widget.currentUserId!);

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Pinned indicator
          if (widget.comment.isPinned)
            Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Icon(Icons.push_pin, size: 14, color: AppColors.primary),
                  const SizedBox(width: 4),
                  Text(
                    'Pinned by creator',
                    style: TextStyle(
                      color: AppColors.primary,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),

          // Main comment row
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Avatar
              CircleAvatar(
                radius: 18,
                backgroundColor: widget.comment.isSellerReply
                    ? AppColors.primary.withValues(alpha: 0.2)
                    : Colors.grey[300],
                backgroundImage: widget.comment.userAvatar != null
                    ? NetworkImage(widget.comment.userAvatar!)
                    : null,
                child: widget.comment.userAvatar == null
                    ? Icon(
                        Icons.person,
                        size: 18,
                        color: widget.isDark ? Colors.white54 : Colors.grey[600],
                      )
                    : null,
              ),
              const SizedBox(width: 12),

              // Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Username and time
                    Row(
                      children: [
                        Text(
                          widget.comment.userName,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                            color: widget.isDark ? Colors.white : Colors.black,
                          ),
                        ),
                        if (widget.comment.isSellerReply) ...[
                          const SizedBox(width: 6),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.primary.withValues(alpha: 0.15),
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: Text(
                              'Creator',
                              style: TextStyle(
                                color: AppColors.primary,
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                        const SizedBox(width: 8),
                        Text(
                          widget.comment.timeAgo,
                          style: TextStyle(
                            color: Colors.grey[500],
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),

                    // Comment text
                    Text(
                      widget.comment.text,
                      style: TextStyle(
                        fontSize: 14,
                        color: widget.isDark ? const Color(0xDDFFFFFF) : Colors.black87,
                        height: 1.3,
                      ),
                    ),
                    
                    // ❤️ by creator badge (Instagram-style)
                    if (widget.comment.likedBySeller) ...[
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          Icon(
                            Icons.favorite,
                            size: 12,
                            color: AppColors.errorLight,
                          ),
                          const SizedBox(width: 4),
                          Text(
                            'Liked by creator',
                            style: TextStyle(
                              color: AppColors.errorLight,
                              fontSize: 11,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ],
                    const SizedBox(height: 8),

                    // Actions
                    Row(
                      children: [
                        // Like
                        GestureDetector(
                          onTap: widget.onLike,
                          child: Row(
                            children: [
                              Icon(
                                hasLiked
                                    ? Icons.favorite
                                    : Icons.favorite_border,
                                size: 16,
                                color: hasLiked ? AppColors.error : Colors.grey[500],
                              ),
                              if (widget.comment.likes > 0) ...[
                                const SizedBox(width: 4),
                                Text(
                                  '${widget.comment.likes}',
                                  style: TextStyle(
                                    color: Colors.grey[500],
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: 16),

                        // Reply
                        GestureDetector(
                          onTap: widget.onReply,
                          child: Text(
                            'Reply',
                            style: TextStyle(
                              color: Colors.grey[500],
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),

                        // Pin (seller only)
                        if (widget.isSeller) ...[
                          const SizedBox(width: 16),
                          GestureDetector(
                            onTap: widget.onPin,
                            child: Text(
                              widget.comment.isPinned ? 'Unpin' : 'Pin',
                              style: TextStyle(
                                color: AppColors.primary,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          // Creator Like (seller only)
                          const SizedBox(width: 16),
                          GestureDetector(
                            onTap: widget.onCreatorLike,
                            child: Row(
                              children: [
                                Icon(
                                  widget.comment.likedBySeller
                                      ? Icons.favorite
                                      : Icons.favorite_border,
                                  size: 14,
                                  color: widget.comment.likedBySeller
                                      ? AppColors.errorLight
                                      : AppColors.primary,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  widget.comment.likedBySeller ? 'Unlike' : '❤️',
                                  style: TextStyle(
                                    color: widget.comment.likedBySeller
                                        ? AppColors.errorLight
                                        : AppColors.primary,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        // Delete
                        if (canDelete) ...[
                          const SizedBox(width: 16),
                          GestureDetector(
                            onTap: widget.onDelete,
                            child: Icon(
                              Icons.delete_outline,
                              size: 16,
                              color: Colors.grey[500],
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),

          // Show replies toggle
          StreamBuilder<List<ReelCommentModel>>(
            stream: widget.reelService.getCommentReplies(widget.comment.id),
            builder: (context, snapshot) {
              final replies = snapshot.data ?? [];
              if (replies.isEmpty) return const SizedBox.shrink();

              return Column(
                children: [
                  GestureDetector(
                    onTap: () => setState(() => _showReplies = !_showReplies),
                    child: Padding(
                      padding: const EdgeInsets.only(left: 48, top: 8),
                      child: Row(
                        children: [
                          Container(
                            width: 24,
                            height: 1,
                            color: Colors.grey[400],
                          ),
                          const SizedBox(width: 8),
                          Text(
                            _showReplies
                                ? 'Hide replies'
                                : 'View ${replies.length} ${replies.length == 1 ? 'reply' : 'replies'}',
                            style: TextStyle(
                              color: Colors.grey[500],
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Replies list
                  if (_showReplies)
                    Padding(
                      padding: const EdgeInsets.only(left: 40),
                      child: Column(
                        children: replies
                            .map((reply) => _ReplyTile(
                                  reply: reply,
                                  isDark: widget.isDark,
                                  currentUserId: widget.currentUserId,
                                  isSeller: widget.isSeller,
                                ))
                            .toList(),
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

/// Compact reply tile
class _ReplyTile extends StatelessWidget {
  final ReelCommentModel reply;
  final bool isDark;
  final String? currentUserId;
  final bool isSeller;

  const _ReplyTile({
    required this.reply,
    required this.isDark,
    this.currentUserId,
    required this.isSeller,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: 14,
            backgroundColor: reply.isSellerReply
                ? AppColors.primary.withValues(alpha: 0.2)
                : Colors.grey[300],
            child: Icon(
              Icons.person,
              size: 14,
              color: isDark ? Colors.white54 : Colors.grey[600],
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      reply.userName,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                        color: isDark ? Colors.white : Colors.black,
                      ),
                    ),
                    if (reply.isSellerReply) ...[
                      const SizedBox(width: 4),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 4,
                          vertical: 1,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: Text(
                          'Creator',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 9,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ],
                    const SizedBox(width: 6),
                    Text(
                      reply.timeAgo,
                      style: TextStyle(color: Colors.grey[500], fontSize: 11),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  reply.text,
                  style: TextStyle(
                    fontSize: 13,
                    color: isDark ? Colors.white70 : Colors.black87,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
