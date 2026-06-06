import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../models/store_model.dart';
import '../../services/cms_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart';
import 'post_editor_screen.dart';

class BlogScreen extends StatefulWidget {
  const BlogScreen({super.key});

  @override
  State<BlogScreen> createState() => _BlogScreenState();
}

class _BlogScreenState extends State<BlogScreen> {
  static const _postStatuses = [
    'all',
    'draft',
    'published',
    'scheduled',
    'archived',
  ];
  static const _commentStatuses = [
    'all',
    'pending',
    'approved',
    'rejected',
    'spam',
  ];

  StoreModel? _store;
  List<BlogPostContract> _posts = const [];
  List<BlogCommentContract> _comments = const [];
  String _mode = 'posts';
  String _postStatus = 'all';
  String _commentStatus = 'all';
  bool _isLoading = true;
  bool _isBusy = false;
  String? _error;

  bool get _showingComments => _mode == 'comments';

  @override
  void initState() {
    super.initState();
    _loadBlog();
  }

  Future<void> _loadBlog() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final store = await context.read<StoreContext>().ensureSelectedStore();
      if (store == null) {
        if (!mounted) return;
        setState(() {
          _store = null;
          _posts = const [];
          _comments = const [];
        });
        return;
      }

      final cms = context.read<CmsService>();
      if (_showingComments) {
        final comments = await cms.fetchBlogComments(
          store.id,
          status: _commentStatus,
        );
        if (!mounted) return;
        setState(() {
          _store = store;
          _comments = comments;
        });
      } else {
        final posts = await cms.fetchBlogPosts(store.id, status: _postStatus);
        if (!mounted) return;
        setState(() {
          _store = store;
          _posts = posts;
        });
      }
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = 'Unable to load blog: $error');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _openEditor(BlogPostContract? post) async {
    final store = _store;
    if (store == null || _isBusy) return;
    final changed = await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (_) => PostEditorScreen(storeId: store.id, post: post),
      ),
    );
    if (changed == true) await _loadBlog();
  }

  Future<void> _togglePublished(BlogPostContract post) async {
    final nextStatus = post.status == 'published' ? 'draft' : 'published';
    await _runAction(() async {
      await context.read<CmsService>().updateBlogPostStatus(post, nextStatus);
      _showMessage(
        nextStatus == 'published' ? 'Post published' : 'Post moved to draft',
        isSuccess: true,
      );
      await _loadBlog();
    });
  }

  Future<void> _archivePost(BlogPostContract post) async {
    final confirmed = await _confirm(
      title: 'Archive post?',
      message: 'Archive "${post.title}" and hide it from the storefront blog.',
      action: 'Archive',
    );
    if (confirmed != true) return;
    await _runAction(() async {
      await context.read<CmsService>().deleteBlogPost(post.id);
      _showMessage('Post archived', isSuccess: true);
      await _loadBlog();
    });
  }

  Future<void> _moderateComment(
    BlogCommentContract comment,
    String status,
  ) async {
    await _runAction(() async {
      await context.read<CmsService>().moderateBlogComment(comment, status);
      _showMessage('Comment marked ${_statusLabel(status)}', isSuccess: true);
      await _loadBlog();
    });
  }

  Future<void> _deleteComment(BlogCommentContract comment) async {
    final confirmed = await _confirm(
      title: 'Delete comment?',
      message: 'Remove this comment from moderation queues.',
      action: 'Delete',
    );
    if (confirmed != true) return;
    await _runAction(() async {
      await context.read<CmsService>().deleteBlogComment(comment.id);
      _showMessage('Comment deleted', isSuccess: true);
      await _loadBlog();
    });
  }

  Future<void> _runAction(Future<void> Function() action) async {
    if (_isBusy) return;
    setState(() => _isBusy = true);
    try {
      await action();
    } catch (error) {
      if (mounted) _showMessage('$error', isError: true);
    } finally {
      if (mounted) setState(() => _isBusy = false);
    }
  }

  Future<bool?> _confirm({
    required String title,
    required String message,
    required String action,
  }) {
    final colors = AppThemeColors.of(context);
    return showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        backgroundColor: colors.card,
        title: Text(title, style: TextStyle(color: colors.textPrimary)),
        content: Text(message, style: TextStyle(color: colors.textSecondary)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: Text(action),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      floatingActionButton: _store == null || _showingComments
          ? null
          : FloatingActionButton.extended(
              onPressed: _isBusy ? null : () => _openEditor(null),
              backgroundColor: LetbuyyColorTokens.brandPrimary,
              foregroundColor: LetbuyyColorTokens.white,
              icon: const Icon(Icons.add_rounded),
              label: const Text('New post'),
            ),
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: RefreshIndicator(
            onRefresh: _loadBlog,
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
              children: [
                _buildHeader(colors),
                const SizedBox(height: 14),
                _buildModeToggle(colors),
                const SizedBox(height: 12),
                _showingComments
                    ? _buildFilters(colors, _commentStatuses, _commentStatus)
                    : _buildFilters(colors, _postStatuses, _postStatus),
                const SizedBox(height: 16),
                if (_isLoading)
                  _buildLoading(colors)
                else if (_error != null)
                  _buildError(colors)
                else if (_store == null)
                  _buildMessagePanel(
                    colors,
                    icon: Icons.store_mall_directory_outlined,
                    title: 'No store selected',
                    message: 'Select a store before editing blog content.',
                  )
                else if (_showingComments)
                  _buildCommentList(colors)
                else
                  _buildPostList(colors),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(AppThemeColors colors) {
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Blog',
                style: TextStyle(
                  color: colors.textPrimary,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                ),
              ),
              Text(
                _store?.name ?? 'Select a store',
                style: TextStyle(color: colors.textSecondary, fontSize: 12),
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: _isLoading || _isBusy ? null : _loadBlog,
          icon: Icon(Icons.refresh_rounded, color: colors.textPrimary),
          tooltip: 'Refresh blog',
        ),
      ],
    );
  }

  Widget _buildModeToggle(AppThemeColors colors) {
    return Row(
      children: [
        _modeButton(colors, mode: 'posts', label: 'Posts'),
        const SizedBox(width: 8),
        _modeButton(colors, mode: 'comments', label: 'Comments'),
      ],
    );
  }

  Widget _modeButton(
    AppThemeColors colors, {
    required String mode,
    required String label,
  }) {
    final selected = _mode == mode;
    return Expanded(
      child: OutlinedButton(
        onPressed: _isBusy
            ? null
            : () async {
                setState(() => _mode = mode);
                await _loadBlog();
              },
        style: OutlinedButton.styleFrom(
          backgroundColor: selected
              ? LetbuyyColorTokens.brandPrimary.withValues(alpha: 0.16)
              : colors.surfaceVariant,
          side: BorderSide(
            color: selected ? LetbuyyColorTokens.brandPrimary : colors.divider,
          ),
          foregroundColor: selected
              ? LetbuyyColorTokens.brandPrimary
              : colors.textSecondary,
        ),
        child: Text(label),
      ),
    );
  }

  Widget _buildFilters(
    AppThemeColors colors,
    List<String> statuses,
    String current,
  ) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: statuses.map((status) {
          final selected = status == current;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              selected: selected,
              label: Text(_statusLabel(status)),
              onSelected: _isBusy
                  ? null
                  : (_) async {
                      setState(() {
                        if (_showingComments) {
                          _commentStatus = status;
                        } else {
                          _postStatus = status;
                        }
                      });
                      await _loadBlog();
                    },
              selectedColor: LetbuyyColorTokens.brandPrimary.withValues(
                alpha: 0.18,
              ),
              backgroundColor: colors.surfaceVariant,
              labelStyle: TextStyle(
                color: selected
                    ? LetbuyyColorTokens.brandPrimary
                    : colors.textSecondary,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
              side: BorderSide(
                color: selected
                    ? LetbuyyColorTokens.brandPrimary
                    : colors.divider,
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildPostList(AppThemeColors colors) {
    if (_posts.isEmpty) {
      return _buildMessagePanel(
        colors,
        icon: Icons.edit_note_outlined,
        title: 'No posts yet',
        message: 'Create articles, guides, updates, or announcements.',
      );
    }
    return Column(children: _posts.map(_buildPostCard).toList());
  }

  Widget _buildCommentList(AppThemeColors colors) {
    if (_comments.isEmpty) {
      return _buildMessagePanel(
        colors,
        icon: Icons.forum_outlined,
        title: 'No comments',
        message: 'Blog comments that need moderation will appear here.',
      );
    }
    return Column(children: _comments.map(_buildCommentCard).toList());
  }

  Widget _buildPostCard(BlogPostContract post) {
    final colors = AppThemeColors.of(context);
    final preview = post.excerpt.isNotEmpty ? post.excerpt : post.content;
    final isPublished = post.status == 'published';
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: _panelDecoration(colors),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      post.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '/blog/${post.slug.isEmpty ? 'untitled' : post.slug}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textSecondary,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              _StatusPill(
                text: _statusLabel(post.status),
                color: _statusColor(post.status, colors),
              ),
            ],
          ),
          if (preview.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              preview,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: colors.textSecondary, fontSize: 13),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(
                  _postMeta(post),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: colors.textTertiary, fontSize: 11),
                ),
              ),
              IconButton(
                onPressed: _isBusy ? null : () => _openEditor(post),
                icon: const Icon(Icons.edit_outlined, size: 18),
                color: colors.textPrimary,
                tooltip: 'Edit post',
              ),
              IconButton(
                onPressed: _isBusy ? null : () => _togglePublished(post),
                icon: Icon(
                  isPublished
                      ? Icons.unpublished_outlined
                      : Icons.cloud_upload_outlined,
                  size: 18,
                ),
                color: LetbuyyColorTokens.brandPrimary,
                tooltip: isPublished ? 'Move to draft' : 'Publish post',
              ),
              IconButton(
                onPressed: _isBusy ? null : () => _archivePost(post),
                icon: const Icon(Icons.archive_outlined, size: 18),
                color: colors.error,
                tooltip: 'Archive post',
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCommentCard(BlogCommentContract comment) {
    final colors = AppThemeColors.of(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: _panelDecoration(colors),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  comment.authorName.isEmpty
                      ? comment.email
                      : comment.authorName,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              _StatusPill(
                text: _statusLabel(comment.status),
                color: _statusColor(comment.status, colors),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            comment.postTitle.isEmpty ? 'Blog comment' : comment.postTitle,
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 10),
          Text(
            comment.body,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(color: colors.textSecondary, fontSize: 13),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _commentAction(
                colors,
                label: 'Approve',
                icon: Icons.check_circle_outline_rounded,
                onTap: () => _moderateComment(comment, 'approved'),
              ),
              _commentAction(
                colors,
                label: 'Reject',
                icon: Icons.block_rounded,
                onTap: () => _moderateComment(comment, 'rejected'),
              ),
              _commentAction(
                colors,
                label: 'Spam',
                icon: Icons.report_outlined,
                onTap: () => _moderateComment(comment, 'spam'),
              ),
              _commentAction(
                colors,
                label: 'Delete',
                icon: Icons.delete_outline_rounded,
                onTap: () => _deleteComment(comment),
                destructive: true,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _commentAction(
    AppThemeColors colors, {
    required String label,
    required IconData icon,
    required VoidCallback onTap,
    bool destructive = false,
  }) {
    return TextButton.icon(
      onPressed: _isBusy ? null : onTap,
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: TextButton.styleFrom(
        backgroundColor: colors.surfaceVariant,
        foregroundColor: destructive ? colors.error : colors.textPrimary,
      ),
    );
  }

  Widget _buildLoading(AppThemeColors colors) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: _panelDecoration(colors),
      child: const Center(child: CircularProgressIndicator()),
    );
  }

  Widget _buildError(AppThemeColors colors) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: _panelDecoration(colors),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.error_outline_rounded, color: colors.error),
          const SizedBox(height: 10),
          Text(
            _error!,
            style: TextStyle(color: colors.textPrimary, fontSize: 13),
          ),
          const SizedBox(height: 12),
          TextButton.icon(
            onPressed: _loadBlog,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Retry'),
          ),
        ],
      ),
    );
  }

  Widget _buildMessagePanel(
    AppThemeColors colors, {
    required IconData icon,
    required String title,
    required String message,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: _panelDecoration(colors),
      child: Column(
        children: [
          Icon(icon, color: colors.textSecondary, size: 32),
          const SizedBox(height: 8),
          Text(
            title,
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            message,
            textAlign: TextAlign.center,
            style: TextStyle(color: colors.textSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }

  BoxDecoration _panelDecoration(AppThemeColors colors) {
    return BoxDecoration(
      color: colors.card,
      borderRadius: BorderRadius.circular(16),
      border: Border.all(color: colors.divider),
    );
  }

  String _postMeta(BlogPostContract post) {
    final updated = _formatDate(
      post.optionalString('published_at') ?? post.optionalString('updated_at'),
    );
    final readTime = post.readingTimeMin == 0
        ? null
        : '${post.readingTimeMin} min read';
    return [updated, readTime].whereType<String>().join(' • ');
  }

  String? _formatDate(String? raw) {
    final parsed = raw == null ? null : DateTime.tryParse(raw);
    if (parsed == null) return null;
    return DateFormat('MMM d, yyyy').format(parsed.toLocal());
  }

  String _statusLabel(String status) {
    switch (status) {
      case 'all':
        return 'All';
      case 'draft':
        return 'Draft';
      case 'published':
        return 'Published';
      case 'scheduled':
        return 'Scheduled';
      case 'archived':
        return 'Archived';
      case 'pending':
        return 'Pending';
      case 'approved':
        return 'Approved';
      case 'rejected':
        return 'Rejected';
      case 'spam':
        return 'Spam';
      default:
        return status;
    }
  }

  Color _statusColor(String status, AppThemeColors colors) {
    switch (status) {
      case 'published':
      case 'approved':
        return colors.success;
      case 'archived':
      case 'rejected':
      case 'spam':
        return colors.error;
      case 'scheduled':
      case 'draft':
      case 'pending':
        return colors.warning;
      default:
        return LetbuyyColorTokens.brandPrimary;
    }
  }

  void _showMessage(
    String message, {
    bool isSuccess = false,
    bool isError = false,
  }) {
    if (!mounted) return;
    final colors = AppThemeColors.of(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: isError
            ? colors.error
            : (isSuccess ? colors.success : colors.card),
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.all(16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.text, required this.color});

  final String text;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        text,
        style: TextStyle(
          color: color,
          fontSize: 10,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}
