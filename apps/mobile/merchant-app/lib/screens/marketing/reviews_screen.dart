import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../app/store_context.dart';

import '../../services/review_service.dart';
import '../../theme/app_theme_colors.dart';
import '../../theme/letbuyy_color_tokens.dart' as mobile_tokens;

class ReviewsScreen extends StatefulWidget {
  const ReviewsScreen({super.key});

  @override
  State<ReviewsScreen> createState() => _ReviewsScreenState();
}

class _ReviewsScreenState extends State<ReviewsScreen> {
  static const _statuses = ['all', 'pending', 'approved', 'rejected'];

  List<ProductReviewContract> _reviews = const [];
  String _status = 'all';
  String? _storeId;
  String? _error;
  bool _isLoading = true;

  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      _storeId ??=
          (await context.read<StoreContext>().ensureSelectedStore())?.id;
      if (_storeId == null) {
        if (mounted) {
          setState(() {
            _reviews = const [];
            _isLoading = false;
          });
        }
        return;
      }

      final reviews = await context.read<ReviewService>().fetchReviews(
        _storeId!,
        status: _status,
      );
      if (mounted) {
        setState(() {
          _reviews = reviews;
          _isLoading = false;
        });
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: Column(
            children: [
              _header(),
              _statusFilters(),
              Expanded(child: _isLoading ? _loading() : _body()),
            ],
          ),
        ),
      ),
    );
  }

  Widget _header() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 8, 8, 8),
      child: Row(
        children: [
          IconButton(
            tooltip: 'Back',
            icon: Icon(Icons.arrow_back_rounded, color: colors.textPrimary),
            onPressed: () => Navigator.maybePop(context),
          ),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Reviews',
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  'Moderate product feedback',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12),
                ),
              ],
            ),
          ),
          IconButton(
            tooltip: 'Refresh reviews',
            icon: Icon(Icons.refresh_rounded, color: colors.textSecondary),
            onPressed: _load,
          ),
        ],
      ),
    );
  }

  Widget _statusFilters() {
    final counts = <String, int>{'all': _reviews.length};
    for (final review in _reviews) {
      counts[review.status] = (counts[review.status] ?? 0) + 1;
    }

    return SizedBox(
      height: 48,
      child: ListView.separated(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
        scrollDirection: Axis.horizontal,
        itemBuilder: (context, index) {
          final status = _statuses[index];
          final selected = _status == status;
          return ChoiceChip(
            selected: selected,
            onSelected: (_) {
              setState(() => _status = status);
              _load();
            },
            label: Text('${_titleCase(status)} ${counts[status] ?? 0}'),
            backgroundColor: colors.card,
            selectedColor: mobile_tokens.LetbuyyColorTokens.brandPrimary
                .withValues(alpha: 0.16),
            side: BorderSide(
              color: selected
                  ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                  : colors.cardBorder,
            ),
            labelStyle: TextStyle(
              color: selected
                  ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                  : colors.textPrimary,
              fontWeight: FontWeight.w700,
            ),
          );
        },
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemCount: _statuses.length,
      ),
    );
  }

  Widget _body() {
    if (_error != null) {
      return _centerState(
        Icons.error_outline_rounded,
        'Could not load reviews',
        _error!,
      );
    }
    if (_reviews.isEmpty) {
      return RefreshIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(24, 80, 24, 24),
          children: [
            _centerState(
              Icons.rate_review_outlined,
              'No reviews yet',
              'Product reviews will appear here for approval and moderation.',
              compact: true,
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        itemCount: _reviews.length,
        itemBuilder: (context, index) => _reviewCard(_reviews[index]),
      ),
    );
  }

  Widget _reviewCard(ProductReviewContract review) {
    final statusColor = _statusColor(review.status);
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                backgroundColor: statusColor.withValues(alpha: 0.12),
                child: Icon(Icons.star_rounded, color: statusColor),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      review.productName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    Text(
                      '${review.customerName} - ${review.customerEmail}',
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
              _statusChip(_titleCase(review.status), statusColor),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Icon(
                Icons.star_rounded,
                color: mobile_tokens.LetbuyyColorTokens.warning,
                size: 18,
              ),
              const SizedBox(width: 4),
              Text(
                review.ratingLabel,
                style: TextStyle(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w800,
                ),
              ),
              if (review.isVerified) ...[
                const SizedBox(width: 10),
                _metaChip('Verified', Icons.verified_outlined),
              ],
              if (review.helpfulCount > 0) ...[
                const SizedBox(width: 10),
                _metaChip(
                  '${review.helpfulCount} helpful',
                  Icons.thumb_up_outlined,
                ),
              ],
            ],
          ),
          const SizedBox(height: 10),
          Text(
            review.title,
            style: TextStyle(
              color: colors.textPrimary,
              fontWeight: FontWeight.w800,
              fontSize: 16,
            ),
          ),
          if (review.body.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              review.body,
              style: TextStyle(color: colors.textSecondary, height: 1.4),
            ),
          ],
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (review.status != 'approved')
                _actionButton(
                  'Approve',
                  Icons.check_circle_outline,
                  () => _moderate(review, 'approved'),
                ),
              if (review.status != 'rejected')
                _actionButton(
                  'Reject',
                  Icons.block_flipped,
                  () => _moderate(review, 'rejected'),
                  destructive: true,
                ),
              _actionButton(
                'Reply',
                Icons.reply_outlined,
                () => _reply(review),
              ),
              _actionButton(
                'Delete',
                Icons.delete_outline,
                () => _delete(review),
                destructive: true,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _actionButton(
    String label,
    IconData icon,
    VoidCallback onPressed, {
    bool destructive = false,
  }) {
    final tone = destructive ? colors.error : colors.textPrimary;
    return OutlinedButton.icon(
      onPressed: onPressed,
      icon: Icon(icon, size: 18),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: tone,
        side: BorderSide(color: colors.cardBorder),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
    );
  }

  Widget _statusChip(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: color,
          fontSize: 12,
          fontWeight: FontWeight.w800,
        ),
      ),
    );
  }

  Widget _metaChip(String label, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: colors.cardBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: colors.textSecondary),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              color: colors.textSecondary,
              fontSize: 11,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _loading() {
    return Center(
      child: CircularProgressIndicator(
        color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
      ),
    );
  }

  Widget _centerState(
    IconData icon,
    String title,
    String message, {
    bool compact = false,
  }) {
    return Center(
      child: Padding(
        padding: EdgeInsets.all(compact ? 0 : 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, color: colors.textTertiary, size: 42),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: colors.textPrimary,
                fontSize: 18,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _moderate(ProductReviewContract review, String status) async {
    try {
      final updated = await context.read<ReviewService>().moderateReview(
        review,
        status,
      );
      setState(() {
        _reviews = _reviews
            .map((item) => item.id == updated.id ? updated : item)
            .toList(growable: false);
      });
      _showSnack('Review marked ${_titleCase(status)}.');
    } catch (error) {
      _showSnack('Could not update review: $error');
    }
  }

  Future<void> _delete(ProductReviewContract review) async {
    try {
      await context.read<ReviewService>().deleteReview(review);
      setState(() {
        _reviews = _reviews.where((item) => item.id != review.id).toList();
      });
      _showSnack('Review deleted.');
    } catch (error) {
      _showSnack('Could not delete review: $error');
    }
  }

  Future<void> _reply(ProductReviewContract review) async {
    final controller = TextEditingController();
    final message = await showDialog<String>(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Reply to review'),
          content: TextField(
            controller: controller,
            minLines: 3,
            maxLines: 5,
            decoration: const InputDecoration(
              labelText: 'Reply',
              border: OutlineInputBorder(),
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(context, controller.text.trim()),
              child: const Text('Send reply'),
            ),
          ],
        );
      },
    );
    controller.dispose();
    if (message == null || message.isEmpty) return;

    try {
      await context.read<ReviewService>().replyToReview(
        ReviewReplyInput(reviewId: review.id, message: message),
      );
      _showSnack('Reply sent.');
    } catch (error) {
      _showSnack('Could not send reply: $error');
    }
  }

  void _showSnack(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: colors.snackbarBackground,
      ),
    );
  }

  Color _statusColor(String status) {
    switch (status) {
      case 'approved':
        return colors.success;
      case 'rejected':
        return colors.error;
      case 'pending':
        return colors.warning;
      default:
        return mobile_tokens.LetbuyyColorTokens.brandPrimary;
    }
  }

  String _titleCase(String value) {
    if (value.isEmpty) return value;
    return '${value[0].toUpperCase()}${value.substring(1)}';
  }
}
