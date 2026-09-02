import 'package:flutter/material.dart';
import 'dart:ui';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:video_player/video_player.dart';
import 'package:intl/intl.dart';

/// Professional Admin screen for moderating reels
class AdminReelsScreen extends StatefulWidget {
  const AdminReelsScreen({super.key});

  @override
  State<AdminReelsScreen> createState() => _AdminReelsScreenState();
}

class _AdminReelsScreenState extends State<AdminReelsScreen> with SingleTickerProviderStateMixin {
  final ReelService _reelService = ReelService();
  late TabController _tabController;
  int _pendingCount = 0;
  int _activeCount = 0;
  int _rejectedCount = 0;
  
  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }
  
  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }
  
  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDarkMode = themeProvider.isDarkMode;
    
    return Scaffold(
      backgroundColor: isDarkMode ? AppColors.backgroundDark : AppColors.background,
      body: Column(
        children: [
          _buildHeader(isDarkMode),
          _buildStatsRow(isDarkMode),
          _buildTabBar(isDarkMode),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildPendingTab(isDarkMode),
                _buildActiveTab(isDarkMode),
                _buildRejectedTab(isDarkMode),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildHeader(bool isDarkMode) {
    return Container(
      padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: isDarkMode 
            ? [AppColors.surfaceDark, AppColors.backgroundDark]
            : [Colors.white, AppColors.background],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                gradient: AppColors.primaryGradient,
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.3),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: const Icon(
                Icons.video_library_rounded,
                color: Colors.white,
                size: 28,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Reels Moderation',
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                      color: isDarkMode ? Colors.white : AppColors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Review and approve seller video content',
                    style: TextStyle(
                      fontSize: 14,
                      color: isDarkMode ? Colors.white60 : AppColors.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: () => setState(() {}),
              icon: Icon(
                Icons.refresh_rounded,
                color: isDarkMode ? Colors.white70 : AppColors.textSecondary,
              ),
              tooltip: 'Refresh',
            ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildStatsRow(bool isDarkMode) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      child: Row(
        children: [
          _buildStatCard(
            isDarkMode,
            'Pending Review',
            _pendingCount.toString(),
            Icons.pending_actions_rounded,
            AppColors.warning,
          ),
          const SizedBox(width: 12),
          _buildStatCard(
            isDarkMode,
            'Published',
            _activeCount.toString(),
            Icons.check_circle_rounded,
            AppColors.success,
          ),
          const SizedBox(width: 12),
          _buildStatCard(
            isDarkMode,
            'Rejected',
            _rejectedCount.toString(),
            Icons.cancel_rounded,
            AppColors.error,
          ),
        ],
      ),
    );
  }
  
  Widget _buildStatCard(bool isDarkMode, String label, String value, IconData icon, Color color) {
    return Expanded(
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isDarkMode 
                  ? Colors.white.withValues(alpha: 0.05)
                  : Colors.white.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: color.withValues(alpha: 0.3),
                width: 1,
              ),
              boxShadow: [
                BoxShadow(
                  color: color.withValues(alpha: 0.1),
                  blurRadius: 20,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: color.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(icon, color: color, size: 18),
                    ),
                    const Spacer(),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [color, color.withValues(alpha: 0.8)],
                        ),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: color.withValues(alpha: 0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      child: Text(
                        value,
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: isDarkMode ? Colors.white70 : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
  
  Widget _buildTabBar(bool isDarkMode) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 24),
      decoration: BoxDecoration(
        color: isDarkMode ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: TabBar(
        controller: _tabController,
        labelColor: Colors.white,
        unselectedLabelColor: isDarkMode ? Colors.white54 : AppColors.textSecondary,
        indicatorSize: TabBarIndicatorSize.tab,
        dividerColor: Colors.transparent,
        indicator: BoxDecoration(
          gradient: AppColors.primaryGradient,
          borderRadius: BorderRadius.circular(12),
        ),
        indicatorPadding: const EdgeInsets.all(4),
        labelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
        tabs: [
          Tab(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.pending_outlined, size: 18),
                const SizedBox(width: 6),
                const Text('Pending'),
                if (_pendingCount > 0) ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.warning,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      _pendingCount.toString(),
                      style: const TextStyle(fontSize: 10, color: Colors.white),
                    ),
                  ),
                ],
              ],
            ),
          ),
          const Tab(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.check_circle_outline, size: 18),
                SizedBox(width: 6),
                Text('Active'),
              ],
            ),
          ),
          const Tab(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.cancel_outlined, size: 18),
                SizedBox(width: 6),
                Text('Rejected'),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildPendingTab(bool isDarkMode) {
    return StreamBuilder<List<ReelModel>>(
      stream: _reelService.getPendingReels(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        
        final reels = snapshot.data ?? [];
        
        // Update count
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_pendingCount != reels.length) {
            setState(() => _pendingCount = reels.length);
          }
        });
        
        if (reels.isEmpty) {
          return _buildEmptyState(
            isDarkMode,
            Icons.inbox_rounded,
            'No Pending Reels',
            'All reels have been reviewed. Great job! 🎉',
            color: AppColors.success,
          );
        }
        
        return _buildReelsList(reels, isDarkMode, isPending: true);
      },
    );
  }
  
  Widget _buildActiveTab(bool isDarkMode) {
    return StreamBuilder<List<ReelModel>>(
      stream: _reelService.getReelsFeed(limit: 50),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        
        final reels = snapshot.data ?? [];
        
        // Update count
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_activeCount != reels.length) {
            setState(() => _activeCount = reels.length);
          }
        });
        
        if (reels.isEmpty) {
          return _buildEmptyState(
            isDarkMode,
            Icons.videocam_off_rounded,
            'No Active Reels',
            'No reels are currently published',
            color: AppColors.info,
          );
        }
        
        return _buildReelsList(reels, isDarkMode, isPending: false);
      },
    );
  }
  
  Widget _buildRejectedTab(bool isDarkMode) {
    return StreamBuilder<List<ReelModel>>(
      stream: _reelService.getRejectedReels(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Center(child: CircularProgressIndicator());
        }
        
        final reels = snapshot.data ?? [];
        
        // Update count
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (_rejectedCount != reels.length) {
            setState(() => _rejectedCount = reels.length);
          }
        });
        
        if (reels.isEmpty) {
          return _buildEmptyState(
            isDarkMode,
            Icons.block_rounded,
            'No Rejected Reels',
            'All rejected reels will appear here',
            color: AppColors.error,
          );
        }
        
        return _buildReelsList(reels, isDarkMode, isPending: false, isRejected: true);
      },
    );
  }
  
  Widget _buildReelsList(List<ReelModel> reels, bool isDarkMode, {required bool isPending, bool isRejected = false}) {
    return ListView.builder(
      padding: const EdgeInsets.all(24),
      itemCount: reels.length,
      itemBuilder: (context, index) {
        return _buildReelModerationCard(
          reels[index], 
          isDarkMode, 
          isPending: isPending,
          isRejected: isRejected,
        );
      },
    );
  }
  
  Widget _buildEmptyState(bool isDarkMode, IconData icon, String title, String subtitle, {required Color color}) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              icon,
              size: 64,
              color: color,
            ),
          ),
          const SizedBox(height: 24),
          Text(
            title,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: isDarkMode ? Colors.white : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isDarkMode ? Colors.white54 : AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildReelModerationCard(ReelModel reel, bool isDarkMode, {
    required bool isPending, 
    bool isRejected = false,
  }) {
    final dateFormat = DateFormat('MMM dd, yyyy • hh:mm a');
    
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: isDarkMode ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Video preview with overlay
          _buildVideoPreview(reel, isDarkMode),
          
          // Content section
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Seller & Product info row
                _buildProductInfoRow(reel, isDarkMode),
                
                const SizedBox(height: 16),
                
                // Caption
                if (reel.caption.isNotEmpty) ...[
                  Text(
                    reel.caption,
                    style: TextStyle(
                      fontSize: 14,
                      height: 1.5,
                      color: isDarkMode ? Colors.white70 : AppColors.textSecondary,
                    ),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 12),
                ],
                
                // Hashtags
                if (reel.hashtags.isNotEmpty) ...[
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: reel.hashtags.map((tag) => Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        '#$tag',
                        style: TextStyle(
                          color: AppColors.primary,
                          fontSize: 12,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    )).toList(),
                  ),
                  const SizedBox(height: 16),
                ],
                
                // Metadata row
                _buildMetadataRow(reel, isDarkMode, dateFormat),
                
                const SizedBox(height: 20),
                
                // Rejection reason if rejected
                if (isRejected && reel.moderationNote != null && reel.moderationNote!.isNotEmpty) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: AppColors.error.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.error.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.info_outline, color: AppColors.error, size: 20),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'Rejection Reason: ${reel.moderationNote}',
                            style: TextStyle(
                              color: AppColors.error,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
                
                // Action buttons
                if (isPending)
                  _buildPendingActions(reel, isDarkMode)
                else if (!isRejected)
                  _buildActiveActions(reel, isDarkMode),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildVideoPreview(ReelModel reel, bool isDarkMode) {
    return GestureDetector(
      onTap: () => _showReelPreview(reel),
      child: Container(
        height: 220,
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            // Thumbnail
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
              child: reel.thumbnailUrl != null
                ? Image.network(reel.thumbnailUrl!, fit: BoxFit.cover)
                : reel.productImage.isNotEmpty
                  ? Image.network(reel.productImage, fit: BoxFit.cover)
                  : Container(color: Colors.grey.shade900),
            ),
            
            // Gradient overlay
            Container(
              decoration: BoxDecoration(
                borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
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
            
            // Play button
            Center(
              child: Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.play_arrow_rounded,
                  size: 48,
                  color: Colors.white,
                ),
              ),
            ),
            
            // Source type badge (Instagram/YouTube/Upload)
            Positioned(
              top: 12,
              left: 12,
              child: _buildSourceTypeBadge(reel),
            ),
            
            // Status badge
            Positioned(
              top: 12,
              right: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: _getStatusColor(reel.status),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: _getStatusColor(reel.status).withValues(alpha: 0.4),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _getStatusIcon(reel.status),
                      color: Colors.white,
                      size: 14,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      reel.status.displayName.toUpperCase(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            
            // Duration badge
            Positioned(
              bottom: 12,
              right: 12,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.videocam_rounded, color: Colors.white, size: 14),
                    const SizedBox(width: 4),
                    Text(
                      _formatDuration(reel.duration),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            
            // External link indicator
            if (reel.externalUrl != null && reel.externalUrl!.isNotEmpty)
              Positioned(
                bottom: 12,
                left: 12,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.info.withValues(alpha: 0.9),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.link_rounded, color: Colors.white, size: 14),
                      const SizedBox(width: 4),
                      const Text(
                        'EMBED',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
  
  Widget _buildSourceTypeBadge(ReelModel reel) {
    IconData icon;
    Color bgColor;
    String label;
    
    switch (reel.sourceType) {
      case 'instagram':
        icon = Icons.camera_alt_rounded;
        bgColor = const Color(0xFFE4405F); // Instagram pink
        label = 'INSTAGRAM';
        break;
      case 'youtube':
        icon = Icons.play_circle_filled_rounded;
        bgColor = const Color(0xFFFF0000); // YouTube red
        label = 'SHORTS';
        break;
      default:
        icon = Icons.cloud_upload_rounded;
        bgColor = AppColors.primary;
        label = 'UPLOAD';
    }
    
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: bgColor.withValues(alpha: 0.4),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 14),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildProductInfoRow(ReelModel reel, bool isDarkMode) {
    return Row(
      children: [
        // Product thumbnail
        Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.1),
                blurRadius: 8,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Image.network(
              reel.productImage,
              width: 60,
              height: 60,
              fit: BoxFit.cover,
              errorBuilder: (_, __, ___) => Container(
                width: 60,
                height: 60,
                color: Colors.grey.shade300,
                child: const Icon(Icons.image_not_supported, color: Colors.grey),
              ),
            ),
          ),
        ),
        const SizedBox(width: 16),
        
        // Product & seller info
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                reel.productName,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: isDarkMode ? Colors.white : AppColors.textPrimary,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      '₹${reel.displayPrice.toStringAsFixed(0)}',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                  if (reel.hasDiscount) ...[
                    const SizedBox(width: 8),
                    Text(
                      '₹${reel.productPrice.toStringAsFixed(0)}',
                      style: TextStyle(
                        fontSize: 12,
                        decoration: TextDecoration.lineThrough,
                        color: isDarkMode ? Colors.white38 : Colors.grey,
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 4),
              Row(
                children: [
                  Icon(
                    Icons.store_rounded,
                    size: 12,
                    color: isDarkMode ? Colors.white54 : AppColors.textTertiary,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    'Seller: ${reel.sellerId.substring(0, 8)}...',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDarkMode ? Colors.white54 : AppColors.textTertiary,
                    ),
                  ),
                ],
              ),
              // Show external URL if available
              if (reel.externalUrl != null && reel.externalUrl!.isNotEmpty) ...[
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(
                      reel.sourceType == 'instagram' ? Icons.camera_alt : Icons.play_circle_outline,
                      size: 12,
                      color: reel.sourceType == 'instagram' 
                          ? const Color(0xFFE4405F)
                          : const Color(0xFFFF0000),
                    ),
                    const SizedBox(width: 4),
                    Expanded(
                      child: Text(
                        reel.externalUrl!,
                        style: TextStyle(
                          fontSize: 11,
                          color: AppColors.info,
                          decoration: TextDecoration.underline,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
  
  Widget _buildMetadataRow(ReelModel reel, bool isDarkMode, DateFormat dateFormat) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isDarkMode ? Colors.white.withValues(alpha: 0.05) : Colors.grey.shade50,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          _buildMetaItem(
            Icons.access_time_rounded,
            dateFormat.format(reel.createdAt),
            isDarkMode,
          ),
          const Spacer(),
          _buildMetaItem(
            Icons.visibility_rounded,
            'Views',
            isDarkMode,
          ),
          const SizedBox(width: 16),
          _buildMetaItem(
            Icons.favorite_rounded,
            'Likes',
            isDarkMode,
          ),
        ],
      ),
    );
  }
  
  Widget _buildMetaItem(IconData icon, String text, bool isDarkMode) {
    return Row(
      children: [
        Icon(
          icon,
          size: 16,
          color: isDarkMode ? Colors.white54 : AppColors.textTertiary,
        ),
        const SizedBox(width: 6),
        Text(
          text,
          style: TextStyle(
            fontSize: 12,
            color: isDarkMode ? Colors.white54 : AppColors.textTertiary,
          ),
        ),
      ],
    );
  }
  
  Widget _buildPendingActions(ReelModel reel, bool isDarkMode) {
    return Row(
      children: [
        Expanded(
          child: ElevatedButton.icon(
            onPressed: () => _approveReel(reel),
            icon: const Icon(Icons.check_circle_rounded, size: 20),
            label: const Text('Approve', style: TextStyle(fontWeight: FontWeight.bold)),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.success,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
              elevation: 0,
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: OutlinedButton.icon(
            onPressed: () => _showRejectDialog(reel),
            icon: const Icon(Icons.cancel_rounded, size: 20),
            label: const Text('Reject', style: TextStyle(fontWeight: FontWeight.bold)),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.error,
              padding: const EdgeInsets.symmetric(vertical: 14),
              side: BorderSide(color: AppColors.error, width: 2),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
      ],
    );
  }
  
  Widget _buildActiveActions(ReelModel reel, bool isDarkMode) {
    return Row(
      children: [
        Expanded(
          child: OutlinedButton.icon(
            onPressed: () => _showReelPreview(reel),
            icon: const Icon(Icons.play_arrow_rounded, size: 20),
            label: const Text('Preview'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.primary,
              padding: const EdgeInsets.symmetric(vertical: 12),
              side: BorderSide(color: AppColors.primary),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: OutlinedButton.icon(
            onPressed: () => _removeReel(reel),
            icon: const Icon(Icons.delete_rounded, size: 20),
            label: const Text('Remove'),
            style: OutlinedButton.styleFrom(
              foregroundColor: AppColors.error,
              padding: const EdgeInsets.symmetric(vertical: 12),
              side: BorderSide(color: AppColors.error),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
        ),
      ],
    );
  }
  
  String _formatDuration(int seconds) {
    final minutes = seconds ~/ 60;
    final secs = seconds % 60;
    return '${minutes.toString().padLeft(2, '0')}:${secs.toString().padLeft(2, '0')}';
  }
  
  Color _getStatusColor(ReelStatus status) {
    switch (status) {
      case ReelStatus.active:
        return AppColors.success;
      case ReelStatus.pending:
        return AppColors.warning;
      case ReelStatus.processing:
        return AppColors.info;
      case ReelStatus.rejected:
        return AppColors.error;
      case ReelStatus.removed:
        return Colors.grey;
    }
  }
  
  IconData _getStatusIcon(ReelStatus status) {
    switch (status) {
      case ReelStatus.active:
        return Icons.check_circle;
      case ReelStatus.pending:
        return Icons.schedule;
      case ReelStatus.processing:
        return Icons.hourglass_top;
      case ReelStatus.rejected:
        return Icons.cancel;
      case ReelStatus.removed:
        return Icons.delete;
    }
  }
  
  void _showReelPreview(ReelModel reel) {
    showDialog(
      context: context,
      barrierDismissible: true,
      builder: (context) => _ReelPreviewDialog(reel: reel),
    );
  }
  
  Future<void> _approveReel(ReelModel reel) async {
    try {
      await _reelService.updateReelStatus(
        reelId: reel.id,
        status: ReelStatus.active,
      );
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.check_circle, color: Colors.white),
                const SizedBox(width: 12),
                const Text('Reel approved successfully!'),
              ],
            ),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error approving reel: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }
  
  void _showRejectDialog(ReelModel reel) {
    final reasonController = TextEditingController();
    String? selectedReason;
    final reasons = [
      'Inappropriate content',
      'Poor video quality',
      'Misleading product information',
      'Violates community guidelines',
      'Copyright infringement',
      'Other',
    ];
    
    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppColors.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.cancel_rounded, color: AppColors.error),
              ),
              const SizedBox(width: 12),
              const Text('Reject Reel'),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Select a reason for rejection:',
                style: TextStyle(fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: reasons.map((reason) => ChoiceChip(
                  label: Text(reason, style: const TextStyle(fontSize: 12)),
                  selected: selectedReason == reason,
                  selectedColor: AppColors.error.withValues(alpha: 0.2),
                  onSelected: (selected) {
                    setState(() => selectedReason = selected ? reason : null);
                  },
                )).toList(),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: reasonController,
                maxLines: 3,
                decoration: InputDecoration(
                  hintText: 'Additional notes (optional)...',
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(color: AppColors.primary),
                  ),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: selectedReason != null ? () async {
                Navigator.pop(context);
                final reason = selectedReason! + 
                  (reasonController.text.isNotEmpty ? ': ${reasonController.text}' : '');
                await _rejectReel(reel, reason);
              } : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.error,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: const Text('Reject'),
            ),
          ],
        ),
      ),
    );
  }
  
  Future<void> _rejectReel(ReelModel reel, String reason) async {
    try {
      await _reelService.updateReelStatus(
        reelId: reel.id,
        status: ReelStatus.rejected,
        moderationNote: reason,
      );
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Reel rejected'),
            backgroundColor: AppColors.error,
            behavior: SnackBarBehavior.floating,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error rejecting reel: $e')),
        );
      }
    }
  }
  
  Future<void> _removeReel(ReelModel reel) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: AppColors.warning),
            const SizedBox(width: 12),
            const Text('Remove Reel'),
          ],
        ),
        content: const Text(
          'Are you sure you want to remove this reel? This action will hide it from public view.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
            ),
            child: const Text('Remove'),
          ),
        ],
      ),
    );
    
    if (confirmed == true) {
      try {
        await _reelService.updateReelStatus(
          reelId: reel.id,
          status: ReelStatus.removed,
        );
        
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: const Text('Reel removed successfully'),
              behavior: SnackBarBehavior.floating,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          );
        }
      } catch (e) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text('Error removing reel: $e')),
          );
        }
      }
    }
  }
}

/// Full-screen dialog to preview reel video
class _ReelPreviewDialog extends StatefulWidget {
  final ReelModel reel;
  
  const _ReelPreviewDialog({required this.reel});

  @override
  State<_ReelPreviewDialog> createState() => _ReelPreviewDialogState();
}

class _ReelPreviewDialogState extends State<_ReelPreviewDialog> {
  VideoPlayerController? _controller;
  bool _isInitialized = false;
  bool _isPlaying = false;
  
  @override
  void initState() {
    super.initState();
    _initializePlayer();
  }
  
  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }
  
  Future<void> _initializePlayer() async {
    _controller = VideoPlayerController.networkUrl(Uri.parse(widget.reel.videoUrl));
    
    try {
      await _controller!.initialize();
      _controller!.setLooping(true);
      _controller!.play();
      
      _controller!.addListener(() {
        if (mounted) {
          setState(() => _isPlaying = _controller!.value.isPlaying);
        }
      });
      
      if (mounted) setState(() => _isInitialized = true);
    } catch (e) {
      debugPrint('❌ Error initializing video: $e');
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(20),
      child: Container(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.of(context).size.height * 0.8,
          maxWidth: 400,
        ),
        decoration: BoxDecoration(
          color: Colors.black,
          borderRadius: BorderRadius.circular(24),
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: AspectRatio(
            aspectRatio: 9 / 16,
            child: Stack(
              children: [
                // Video player
                if (_isInitialized && _controller != null)
                  GestureDetector(
                    onTap: () {
                      if (_controller!.value.isPlaying) {
                        _controller!.pause();
                      } else {
                        _controller!.play();
                      }
                    },
                    child: VideoPlayer(_controller!),
                  )
                else
                  const Center(
                    child: CircularProgressIndicator(color: Colors.white),
                  ),
                
                // Play/Pause overlay
                if (_isInitialized && !_isPlaying)
                  Center(
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.5),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.play_arrow_rounded,
                        size: 48,
                        color: Colors.white,
                      ),
                    ),
                  ),
                
                // Top bar with close button
                Positioned(
                  top: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.7),
                          Colors.transparent,
                        ],
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Preview',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        IconButton(
                          icon: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.close, color: Colors.white, size: 20),
                          ),
                          onPressed: () => Navigator.pop(context),
                        ),
                      ],
                    ),
                  ),
                ),
                
                // Bottom product info
                Positioned(
                  bottom: 0,
                  left: 0,
                  right: 0,
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.8),
                          Colors.transparent,
                        ],
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.reel.productName,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '₹${widget.reel.displayPrice.toStringAsFixed(0)}',
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 14,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
