import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Widget to select a reel for Reels Boost campaigns
/// Shows a grid of seller's existing reels with preview thumbnails
class ReelPickerWidget extends StatefulWidget {
  final String sellerId;
  final String? selectedReelId;
  final Function(String reelId, String? reelTitle) onSelected;

  const ReelPickerWidget({
    super.key,
    required this.sellerId,
    this.selectedReelId,
    required this.onSelected,
  });

  @override
  State<ReelPickerWidget> createState() => _ReelPickerWidgetState();
}

class _ReelPickerWidgetState extends State<ReelPickerWidget> {
  List<Map<String, dynamic>> _reels = [];
  bool _isLoading = true;
  String? _selectedReelId;

  @override
  void initState() {
    super.initState();
    _selectedReelId = widget.selectedReelId;
    _loadSellerReels();
  }

  Future<void> _loadSellerReels() async {
    setState(() => _isLoading = true);
    try {
      // Fetch seller's reels from Firestore
      final snapshot = await FirebaseFirestore.instance
          .collection('reels')
          .where('sellerId', isEqualTo: widget.sellerId)
          .where('status', isEqualTo: 'active')
          .orderBy('createdAt', descending: true)
          .limit(20)
          .get();

      setState(() {
        _reels = snapshot.docs.map((doc) {
          final data = doc.data();
          return {
            'id': doc.id,
            'thumbnailUrl': data['thumbnailUrl'] ?? data['videoUrl'],
            'title': data['title'] ?? data['description'] ?? 'Reel',
            'views': data['viewCount'] ?? 0,
            'likes': data['likeCount'] ?? 0,
          };
        }).toList();
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('Error loading reels: $e');
      setState(() {
        _reels = [];
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    if (_isLoading) {
      return Container(
        padding: const EdgeInsets.all(40),
        child: const Center(child: CircularProgressIndicator()),
      );
    }

    if (_reels.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
          ),
        ),
        child: Column(
          children: [
            Icon(
              Icons.videocam_off_rounded,
              size: 48,
              color: Colors.grey.withValues(alpha: 0.5),
            ),
            const SizedBox(height: 12),
            Text(
              'No Reels Found',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: isDark ? Colors.white : const Color(0xFF111827),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Upload reels first from the Reels section',
              style: TextStyle(
                fontSize: 12,
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Select Reel to Boost',
          style: TextStyle(
            fontWeight: FontWeight.w700,
            color: isDark ? Colors.white : const Color(0xFF111827),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          'Your reel will be shown to more viewers',
          style: TextStyle(
            fontSize: 12,
            color: isDark ? Colors.grey[500] : Colors.grey[600],
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 160,
          child: ListView.builder(
            scrollDirection: Axis.horizontal,
            itemCount: _reels.length,
            itemBuilder: (context, index) {
              final reel = _reels[index];
              final isSelected = _selectedReelId == reel['id'];

              return GestureDetector(
                onTap: () {
                  setState(() => _selectedReelId = reel['id']);
                  widget.onSelected(reel['id'], reel['title']);
                },
                child: AnimatedContainer(
                  duration: 200.ms,
                  width: 100,
                  margin: const EdgeInsets.only(right: 10),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: isSelected ? AppColors.primary : Colors.transparent,
                      width: 3,
                    ),
                    boxShadow: isSelected
                        ? [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.3),
                              blurRadius: 8,
                              offset: const Offset(0, 4),
                            ),
                          ]
                        : null,
                  ),
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      // Thumbnail
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: reel['thumbnailUrl'] != null
                            ? Image.network(
                                reel['thumbnailUrl'],
                                fit: BoxFit.cover,
                                errorBuilder: (_, __, ___) => _buildPlaceholder(isDark),
                              )
                            : _buildPlaceholder(isDark),
                      ),
                      // Gradient overlay
                      Positioned.fill(
                        child: Container(
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(10),
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
                      ),
                      // Stats
                      Positioned(
                        left: 6,
                        right: 6,
                        bottom: 6,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _buildStat(Icons.visibility, '${reel['views']}'),
                            _buildStat(Icons.favorite, '${reel['likes']}'),
                          ],
                        ),
                      ),
                      // Selected indicator
                      if (isSelected)
                        Positioned(
                          top: 6,
                          right: 6,
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.check,
                              color: Colors.white,
                              size: 14,
                            ),
                          ),
                        ),
                    ],
                  ),
                ).animate(delay: (50 * index).ms).fadeIn().slideX(begin: 0.1),
              );
            },
          ),
        ),
        if (_selectedReelId != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.check_circle, color: AppColors.primary, size: 16),
                const SizedBox(width: 6),
                Text(
                  'Reel selected',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildPlaceholder(bool isDark) {
    return Container(
      color: isDark ? Colors.grey[800] : Colors.grey[300],
      child: Center(
        child: Icon(
          Icons.videocam_rounded,
          color: isDark ? Colors.grey[600] : Colors.grey[500],
          size: 32,
        ),
      ),
    );
  }

  Widget _buildStat(IconData icon, String value) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: Colors.white, size: 12),
        const SizedBox(width: 2),
        Text(
          value,
          style: const TextStyle(
            fontSize: 10,
            color: Colors.white,
            fontWeight: FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
