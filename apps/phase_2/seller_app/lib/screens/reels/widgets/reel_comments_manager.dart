import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:provider/provider.dart';

/// Filter options for comments
enum CommentFilter { all, pinned, unanswered }

/// Full-screen comments manager for sellers to manage reel comments
class ReelCommentsManager extends StatefulWidget {
  final String reelId;
  final String reelCaption;

  const ReelCommentsManager({
    super.key,
    required this.reelId,
    required this.reelCaption,
  });

  static Future<void> show(
    BuildContext context, {
    required String reelId,
    required String reelCaption,
  }) {
    return Navigator.of(context).push(
      MaterialPageRoute(
        builder: (context) => ReelCommentsManager(
          reelId: reelId,
          reelCaption: reelCaption,
        ),
      ),
    );
  }

  @override
  State<ReelCommentsManager> createState() => _ReelCommentsManagerState();
}

class _ReelCommentsManagerState extends State<ReelCommentsManager> {
  final ReelService _reelService = ReelService();
  final TextEditingController _replyController = TextEditingController();
  
  CommentFilter _currentFilter = CommentFilter.all;
  String? _replyingToId;
  String? _replyingToName;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _replyController.dispose();
    super.dispose();
  }

  Future<void> _toggleCreatorLike(ReelCommentModel comment) async {
    final sellerId = FirebaseAuth.instance.currentUser?.uid;
    if (sellerId == null) return;
    
    HapticFeedback.mediumImpact();
    
    if (comment.likedBySeller) {
      await _reelService.sellerUnlikeComment(commentId: comment.id);
    } else {
      await _reelService.sellerLikeComment(
        commentId: comment.id,
        sellerId: sellerId,
      );
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
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
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

  void _startReply(String commentId, String userName) {
    setState(() {
      _replyingToId = commentId;
      _replyingToName = userName;
    });
  }

  void _cancelReply() {
    setState(() {
      _replyingToId = null;
      _replyingToName = null;
      _replyController.clear();
    });
  }

  Future<void> _submitReply() async {
    if (_replyingToId == null || _replyController.text.trim().isEmpty) return;
    
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    setState(() => _isSubmitting = true);

    // Get seller info
    final sellerDoc = await FirebaseFirestore.instance
        .collection('sellers')
        .doc(user.uid)
        .get();
    final sellerData = sellerDoc.data() ?? {};
    final sellerName = sellerData['businessName'] ?? sellerData['name'] ?? 'Seller';
    final sellerAvatar = sellerData['logo'] ?? sellerData['avatar'];

    await _reelService.addSellerReply(
      reelId: widget.reelId,
      parentCommentId: _replyingToId!,
      sellerId: user.uid,
      sellerName: sellerName,
      sellerAvatar: sellerAvatar,
      text: _replyController.text.trim(),
    );

    _cancelReply();
    setState(() => _isSubmitting = false);
    HapticFeedback.lightImpact();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : Colors.white,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.backgroundDark : Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_ios_new,
            color: isDark ? Colors.white : Colors.black,
          ),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Comments',
              style: TextStyle(
                color: isDark ? Colors.white : Colors.black,
                fontWeight: FontWeight.w600,
                fontSize: 18,
              ),
            ),
            Text(
              widget.reelCaption.length > 30 
                  ? '${widget.reelCaption.substring(0, 30)}...'
                  : widget.reelCaption,
              style: TextStyle(
                color: isDark ? Colors.white54 : Colors.black54,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
      body: Column(
        children: [
          // Filter Chips
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: CommentFilter.values.map((filter) {
                final isSelected = _currentFilter == filter;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: FilterChip(
                    label: Text(_getFilterLabel(filter)),
                    selected: isSelected,
                    onSelected: (_) => setState(() => _currentFilter = filter),
                    backgroundColor: isDark ? Colors.grey[800] : Colors.grey[200],
                    selectedColor: AppColors.primary.withValues(alpha: 0.2),
                    labelStyle: TextStyle(
                      color: isSelected 
                          ? AppColors.primary 
                          : (isDark ? Colors.white70 : Colors.black87),
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                    ),
                    checkmarkColor: AppColors.primary,
                  ),
                );
              }).toList(),
            ),
          ),

          const Divider(height: 1),

          // Comments List
          Expanded(
            child: StreamBuilder<List<ReelCommentModel>>(
              stream: _reelService.getComments(widget.reelId),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                var comments = snapshot.data ?? [];
                
                // Apply filter
                comments = _filterComments(comments);

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
                          _currentFilter == CommentFilter.all
                              ? 'No comments yet'
                              : 'No ${_getFilterLabel(_currentFilter).toLowerCase()} comments',
                          style: TextStyle(
                            fontSize: 16,
                            color: isDark ? Colors.white54 : Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  );
                }

                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: comments.length,
                  separatorBuilder: (_, __) => const Divider(height: 32),
                  itemBuilder: (context, index) {
                    final comment = comments[index];
                    return _buildCommentCard(comment, isDark);
                  },
                );
              },
            ),
          ),

          // Reply input
          if (_replyingToId != null)
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
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      Text(
                        'Replying to @$_replyingToName',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const Spacer(),
                      GestureDetector(
                        onTap: _cancelReply,
                        child: Icon(Icons.close, size: 18, color: Colors.grey[500]),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _replyController,
                          style: TextStyle(color: isDark ? Colors.white : Colors.black),
                          decoration: InputDecoration(
                            hintText: 'Reply as seller...',
                            hintStyle: TextStyle(color: Colors.grey[500]),
                            border: InputBorder.none,
                            isDense: true,
                          ),
                          maxLines: 3,
                          minLines: 1,
                        ),
                      ),
                      const SizedBox(width: 12),
                      GestureDetector(
                        onTap: _isSubmitting ? null : _submitReply,
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
                              : const Icon(Icons.send_rounded, color: Colors.white, size: 18),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }

  String _getFilterLabel(CommentFilter filter) {
    switch (filter) {
      case CommentFilter.all:
        return 'All';
      case CommentFilter.pinned:
        return 'Pinned';
      case CommentFilter.unanswered:
        return 'Unanswered';
    }
  }

  List<ReelCommentModel> _filterComments(List<ReelCommentModel> comments) {
    switch (_currentFilter) {
      case CommentFilter.all:
        return comments;
      case CommentFilter.pinned:
        return comments.where((c) => c.isPinned).toList();
      case CommentFilter.unanswered:
        // For now, show non-seller replies (would need async check for proper implementation)
        return comments.where((c) => !c.isSellerReply).toList();
    }
  }

  Widget _buildCommentCard(ReelCommentModel comment, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Badges row
        if (comment.isPinned || comment.likedBySeller)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Wrap(
              spacing: 8,
              children: [
                if (comment.isPinned)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.push_pin, size: 12, color: AppColors.primary),
                        const SizedBox(width: 4),
                        Text(
                          'Pinned',
                          style: TextStyle(
                            color: AppColors.primary,
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                if (comment.likedBySeller)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.red.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.favorite, size: 12, color: Colors.red[400]),
                        const SizedBox(width: 4),
                        Text(
                          'Creator ❤️',
                          style: TextStyle(
                            color: Colors.red[400],
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),

        // Comment content
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Avatar
            CircleAvatar(
              radius: 20,
              backgroundColor: Colors.grey[300],
              backgroundImage: comment.userAvatar != null
                  ? CachedNetworkImageProvider(comment.userAvatar!)
                  : null,
              child: comment.userAvatar == null
                  ? Icon(Icons.person, size: 20, color: Colors.grey[600])
                  : null,
            ),
            const SizedBox(width: 12),

            // Content
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Text(
                        comment.userName,
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 14,
                          color: isDark ? Colors.white : Colors.black,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        comment.timeAgo,
                        style: TextStyle(
                          color: Colors.grey[500],
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    comment.text,
                    style: TextStyle(
                      fontSize: 14,
                      color: isDark ? Colors.white.withValues(alpha: 0.87) : Colors.black87,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 4),
                  if (comment.likes > 0)
                    Text(
                      '${comment.likes} likes',
                      style: TextStyle(
                        color: Colors.grey[500],
                        fontSize: 12,
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),

        // Action buttons
        Padding(
          padding: const EdgeInsets.only(top: 12, left: 52),
          child: Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _buildActionButton(
                icon: Icons.reply,
                label: 'Reply',
                onTap: () => _startReply(comment.id, comment.userName),
                isDark: isDark,
              ),
              _buildActionButton(
                icon: comment.likedBySeller ? Icons.favorite : Icons.favorite_border,
                label: comment.likedBySeller ? 'Liked' : '❤️ Like',
                onTap: () => _toggleCreatorLike(comment),
                isDark: isDark,
                isActive: comment.likedBySeller,
                activeColor: Colors.red[400],
              ),
              _buildActionButton(
                icon: Icons.push_pin,
                label: comment.isPinned ? 'Unpin' : 'Pin',
                onTap: () => _togglePin(comment),
                isDark: isDark,
                isActive: comment.isPinned,
                activeColor: AppColors.primary,
              ),
              _buildActionButton(
                icon: Icons.delete_outline,
                label: 'Delete',
                onTap: () => _deleteComment(comment),
                isDark: isDark,
                activeColor: Colors.red,
              ),
            ],
          ),
        ),

        // Show replies
        StreamBuilder<List<ReelCommentModel>>(
          stream: _reelService.getCommentReplies(comment.id),
          builder: (context, snapshot) {
            final replies = snapshot.data ?? [];
            if (replies.isEmpty) return const SizedBox.shrink();

            return Padding(
              padding: const EdgeInsets.only(left: 52, top: 12),
              child: Column(
                children: replies.map((reply) => _buildReplyCard(reply, isDark)).toList(),
              ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    required bool isDark,
    bool isActive = false,
    Color? activeColor,
  }) {
    final color = isActive ? (activeColor ?? AppColors.primary) : (isDark ? Colors.white54 : Colors.grey[600]);
    
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isActive 
              ? (activeColor ?? AppColors.primary).withValues(alpha: 0.1)
              : (isDark ? Colors.grey[800] : Colors.grey[100]),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 12,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildReplyCard(ReelCommentModel reply, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
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
              color: reply.isSellerReply ? AppColors.primary : Colors.grey[600],
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
                        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(3),
                        ),
                        child: Text(
                          'You',
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
                      style: TextStyle(color: Colors.grey[500], fontSize: 10),
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
