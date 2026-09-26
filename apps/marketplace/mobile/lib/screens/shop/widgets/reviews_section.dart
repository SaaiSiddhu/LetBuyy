import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';
import 'package:letbuyy_marketplace_models/letbuyy_marketplace_models.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';
import 'add_review_dialog.dart';

class ReviewsSection extends StatefulWidget {
  final String productId;
  final String productName;
  final bool isDark;

  const ReviewsSection({
    super.key,
    required this.productId,
    required this.productName,
    required this.isDark,
  });

  @override
  State<ReviewsSection> createState() => _ReviewsSectionState();
}

class _ReviewsSectionState extends State<ReviewsSection> {
  ReviewModel? _userExistingReview;
  bool _isCheckingExistingReview = true;
  
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadData();
    });
  }
  
  Future<void> _loadData() async {
    // Check for existing user review
    await _checkForExistingUserReview();
  }
  
  Future<void> _checkForExistingUserReview() async {
    if (!mounted) return;
    
    try {
      final authService = context.read<AuthService>();
      final currentUserId = authService.getCurrentUserId();
      
      if (currentUserId == null) {
        if (mounted) setState(() => _isCheckingExistingReview = false);
        return;
      }
      
      // Use DatabaseService to check for existing review
      final databaseService = context.read<DatabaseService>();
      final existingReview = await databaseService.getUserProductReview(
        widget.productId, 
        currentUserId,
      );
      
      if (mounted) {
        setState(() {
          _userExistingReview = existingReview;
          _isCheckingExistingReview = false;
        });
      }
    } catch (e) {
      debugPrint('Error checking existing review: $e');
      if (mounted) setState(() => _isCheckingExistingReview = false);
    }
  }

  void _showAddOrEditReviewDialog() {
    showDialog(
      context: context,
      builder: (ctx) {
        return MultiProvider(
          providers: [
            Provider.value(value: context.read<AuthService>()),
            Provider.value(value: context.read<DatabaseService>()),
            ChangeNotifierProvider.value(value: context.read<ThemeProvider>()),
          ],
          child: AddReviewDialog(
            productId: widget.productId,
            productName: widget.productName,
            reviewToEdit: _userExistingReview, // ✅ Pass existing review for edit mode
          ),
        );
      },
    ).then((_) {
      // Refresh after dialog closes to update button state
      _checkForExistingUserReview();
    });
  }

  @override
  Widget build(BuildContext context) {
    final accentColor = widget.isDark ? AppColors.primaryLight : AppColors.primary;
    final bool hasExistingReview = _userExistingReview != null;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header Row
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Customer Reviews',
              style: AppTextStyles.titleLarge.copyWith(
                fontWeight: FontWeight.bold,
                color: widget.isDark ? Colors.white : Colors.black87,
              ),
            ),
            _isCheckingExistingReview
                ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                : TextButton.icon(
                    onPressed: _showAddOrEditReviewDialog,
                    icon: Icon(
                      hasExistingReview ? Icons.edit_outlined : Icons.add_comment_outlined, 
                      size: 16, 
                      color: accentColor,
                    ),
                    label: Text(
                      hasExistingReview ? 'Edit Review' : 'Add Review', 
                      style: TextStyle(color: accentColor, fontWeight: FontWeight.bold),
                    ),
                    style: TextButton.styleFrom(
                      backgroundColor: accentColor.withValues(alpha: 0.1),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    ),
                  ),
          ],
        ),
        const SizedBox(height: 24),

        // Phase 1R corrective (C2): ReviewProvider was entirely FirebaseFirestore-backed with no
        // canonical successor. getReviewsStream() built a raw Firestore stream directly and
        // unguarded (crash risk on this screen, product_details_screen.dart -- confirmed the same
        // class of bug as sponsored_products_banner.dart); loadReviewStats() meant the stats
        // section above would otherwise spin forever, since nothing would ever populate it. Both
        // dropped; this always renders the honest empty state below instead.
        Expanded(child: _buildEmptyState()),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.reviews_outlined, size: 60, color: widget.isDark ? Colors.grey[700] : Colors.grey[300]),
          const SizedBox(height: 16),
          Text(
            'No Reviews Yet',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: widget.isDark ? Colors.white70 : Colors.black87),
          ),
          const SizedBox(height: 8),
          Text(
            'Be the first to share your thoughts!',
            style: TextStyle(color: widget.isDark ? Colors.grey[500] : Colors.grey[600]),
          ),
        ],
      ),
    );
  }
}