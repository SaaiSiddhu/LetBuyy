import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'widgets/reel_comments_manager.dart';
import 'create_reel_screen.dart';

/// Screen for sellers to view and manage their reels
class SellerReelsScreen extends StatefulWidget {
  const SellerReelsScreen({super.key});

  @override
  State<SellerReelsScreen> createState() => _SellerReelsScreenState();
}

class _SellerReelsScreenState extends State<SellerReelsScreen> {
  final ReelService _reelService = ReelService();
  final String _sellerId = FirebaseAuth.instance.currentUser?.uid ?? '';
  
  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDarkMode = themeProvider.isDarkMode;
    
    return Scaffold(
      backgroundColor: isDarkMode ? AppColors.backgroundDark : AppColors.background,
      appBar: _buildAppBar(isDarkMode),
      body: _buildBody(isDarkMode),
      floatingActionButton: _buildFAB(isDarkMode),
    );
  }
  
  PreferredSizeWidget _buildAppBar(bool isDarkMode) {
    return AppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      title: Text(
        'My Reels',
        style: TextStyle(
          color: isDarkMode ? Colors.white : AppColors.textPrimary,
          fontWeight: FontWeight.bold,
        ),
      ),
      actions: [
        IconButton(
          icon: Icon(
            Icons.analytics_outlined,
            color: isDarkMode ? Colors.white70 : AppColors.textSecondary,
          ),
          onPressed: _showAnalytics,
        ),
      ],
    );
  }
  
  Widget _buildBody(bool isDarkMode) {
    return StreamBuilder<List<ReelModel>>(
      stream: _reelService.getSellerReels(_sellerId),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        
        if (snapshot.hasError) {
          return Center(
            child: Text(
              'Error loading reels',
              style: TextStyle(color: isDarkMode ? Colors.white70 : AppColors.textSecondary),
            ),
          );
        }
        
        final reels = snapshot.data ?? [];
        
        if (reels.isEmpty) {
          return _buildEmptyState(isDarkMode);
        }
        
        return _buildReelsGrid(reels, isDarkMode);
      },
    );
  }
  
  Widget _buildEmptyState(bool isDarkMode) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.videocam_off_outlined,
            size: 80,
            color: isDarkMode ? Colors.white24 : Colors.grey.shade300,
          ),
          const SizedBox(height: 16),
          Text(
            'No Reels Yet',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: isDarkMode ? Colors.white : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Create your first product reel to\nboost engagement and sales!',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isDarkMode ? Colors.white54 : AppColors.textSecondary,
            ),
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: _createReel,
            icon: const Icon(Icons.add),
            label: const Text('Create Reel'),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildReelsGrid(List<ReelModel> reels, bool isDarkMode) {
    return GridView.builder(
      padding: const EdgeInsets.all(16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        childAspectRatio: 9 / 16,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: reels.length,
      itemBuilder: (context, index) {
        return _buildReelCard(reels[index], isDarkMode);
      },
    );
  }
  
  Widget _buildReelCard(ReelModel reel, bool isDarkMode) {
    return GestureDetector(
      onTap: () => _showReelDetails(reel),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          color: isDarkMode ? AppColors.surfaceDark : Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.1),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Thumbnail or placeholder
            if (reel.thumbnailUrl != null)
              Image.network(
                reel.thumbnailUrl!,
                fit: BoxFit.cover,
              )
            else if (reel.productImage.isNotEmpty)
              Image.network(
                reel.productImage,
                fit: BoxFit.cover,
              )
            else
              Container(
                color: isDarkMode ? Colors.grey.shade800 : Colors.grey.shade200,
                child: const Icon(Icons.play_circle_outline, size: 48),
              ),
            
            // Gradient overlay
            Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.7),
                  ],
                ),
              ),
            ),
            
            // Status badge
            Positioned(
              top: 8,
              left: 8,
              child: _buildStatusBadge(reel.status),
            ),
            
            // Product info
            Positioned(
              bottom: 8,
              left: 8,
              right: 8,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    reel.productName,
                    style: const TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '₹${reel.displayPrice.toStringAsFixed(0)}',
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            
            // Play icon
            const Center(
              child: Icon(
                Icons.play_circle_filled,
                color: Colors.white70,
                size: 48,
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildStatusBadge(ReelStatus status) {
    Color color;
    String text = status.displayName;
    
    switch (status) {
      case ReelStatus.active:
        color = AppColors.success;
        break;
      case ReelStatus.pending:
        color = AppColors.warning;
        break;
      case ReelStatus.processing:
        color = AppColors.info;
        break;
      case ReelStatus.rejected:
        color = AppColors.error;
        break;
      case ReelStatus.removed:
        color = Colors.grey;
        break;
    }
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.9),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
  
  Widget _buildFAB(bool isDarkMode) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 80), // Space above floating bottom nav
      child: Container(
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFFE91E63), Color(0xFFFF5722)], // Pink to Orange for reels
          ),
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFFE91E63).withValues(alpha: 0.4),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
            BoxShadow(
              color: const Color(0xFFFF5722).withValues(alpha: 0.3),
              blurRadius: 30,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: _createReel,
            borderRadius: BorderRadius.circular(20),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.videocam_rounded, color: Colors.white, size: 20),
                  ),
                  const SizedBox(width: 12),
                  const Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'New Reel',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                        ),
                      ),
                      Text(
                        'Showcase your products',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 11,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(width: 8),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.15),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.arrow_forward_rounded, 
                        color: Colors.white, size: 16),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
  
  void _createReel() {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => const CreateReelScreen()),
    );
  }
  
  void _showReelDetails(ReelModel reel) {
    // TODO: Navigate to reel detail/analytics screen
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _ReelDetailsSheet(reel: reel, reelService: _reelService),
    );
  }
  
  void _showAnalytics() async {
    final analytics = await _reelService.getSellerReelAnalytics(_sellerId);
    if (!mounted) return;
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reel Analytics'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            _buildAnalyticRow('Total Reels', '${analytics['totalReels'] ?? 0}'),
            _buildAnalyticRow('Total Views', '${analytics['totalViews'] ?? 0}'),
            _buildAnalyticRow('Total Likes', '${analytics['totalLikes'] ?? 0}'),
            _buildAnalyticRow('Add to Cart', '${analytics['totalAddToCart'] ?? 0}'),
            _buildAnalyticRow('Revenue', '₹${(analytics['totalRevenue'] ?? 0).toStringAsFixed(0)}'),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Close'),
          ),
        ],
      ),
    );
  }
  
  Widget _buildAnalyticRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label),
          Text(value, style: const TextStyle(fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

/// Bottom sheet showing reel details
class _ReelDetailsSheet extends StatelessWidget {
  final ReelModel reel;
  final ReelService reelService;
  
  const _ReelDetailsSheet({required this.reel, required this.reelService});
  
  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    
    return Container(
      height: MediaQuery.of(context).size.height * 0.5,
      decoration: BoxDecoration(
        color: isDarkMode ? AppColors.surfaceDark : Colors.white,
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
              color: Colors.grey.shade400,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Product name
                  Text(
                    reel.productName,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: isDarkMode ? Colors.white : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '₹${reel.displayPrice.toStringAsFixed(0)}',
                    style: TextStyle(
                      fontSize: 16,
                      color: isDarkMode ? Colors.white70 : AppColors.textSecondary,
                    ),
                  ),
                  
                  const SizedBox(height: 16),
                  
                  // Caption
                  if (reel.caption.isNotEmpty) ...[
                    Text(
                      reel.caption,
                      style: TextStyle(
                        color: isDarkMode ? Colors.white70 : AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                  
                  // Hashtags
                  if (reel.hashtags.isNotEmpty)
                    Wrap(
                      spacing: 8,
                      children: reel.hashtags.map((tag) => Chip(
                        label: Text('#$tag', style: const TextStyle(fontSize: 12)),
                        padding: EdgeInsets.zero,
                        materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      )).toList(),
                    ),
                  
                  const Spacer(),
                  
                  // Actions
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            Navigator.pop(context);
                            ReelCommentsManager.show(
                              context,
                              reelId: reel.id,
                              reelCaption: reel.caption,
                            );
                          },
                          icon: const Icon(Icons.comment_outlined),
                          label: const Text('Comments'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => Navigator.pop(context),
                          icon: const Icon(Icons.edit_outlined),
                          label: const Text('Edit'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () async {
                            Navigator.pop(context);
                            await reelService.deleteReel(reel.id, reel.sellerId);
                          },
                          icon: const Icon(Icons.delete_outline),
                          label: const Text('Delete'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.error,
                            foregroundColor: Colors.white,
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

