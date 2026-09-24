// lib/screens/shop/widgets/premium_image_gallery.dart
// Amazon/Flipkart-style premium image gallery with zoom and fullscreen

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:photo_view/photo_view.dart';
import 'package:photo_view/photo_view_gallery.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

class PremiumImageGallery extends StatefulWidget {
  final List<String> images;
  final bool isDark;
  final String? productName;
  final int? discountPercent;
  final bool isNew;
  final bool isTrending;

  const PremiumImageGallery({
    super.key,
    required this.images,
    required this.isDark,
    this.productName,
    this.discountPercent,
    this.isNew = false,
    this.isTrending = false,
  });

  @override
  State<PremiumImageGallery> createState() => _PremiumImageGalleryState();
}

class _PremiumImageGalleryState extends State<PremiumImageGallery> {
  int _currentIndex = 0;
  final PageController _pageController = PageController();

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _openFullscreen(int index) {
    HapticFeedback.mediumImpact();
    Navigator.push(
      context,
      PageRouteBuilder(
        opaque: false,
        pageBuilder: (context, animation, secondaryAnimation) {
          return _FullscreenGallery(
            images: widget.images,
            initialIndex: index,
            productName: widget.productName,
          );
        },
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.images.isEmpty) {
      return Container(
        height: 400,
        color: widget.isDark ? AppColors.surfaceDark : AppColors.surfaceVariant,
        child: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.image_not_supported_rounded,
                size: 64,
                color: widget.isDark ? Colors.grey[700] : Colors.grey[400],
              ),
              const SizedBox(height: 12),
              Text(
                'No images available',
                style: TextStyle(
                  color: widget.isDark ? Colors.grey[600] : Colors.grey[500],
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      children: [
        // Main Image
        Stack(
          children: [
            // Image Carousel
            GestureDetector(
              onTap: () => _openFullscreen(_currentIndex),
              child: Container(
                height: 400,
                color: widget.isDark ? AppColors.surfaceDark : AppColors.surfaceVariant,
                child: PageView.builder(
                  controller: _pageController,
                  onPageChanged: (index) {
                    setState(() => _currentIndex = index);
                    HapticFeedback.selectionClick();
                  },
                  itemCount: widget.images.length,
                  itemBuilder: (context, index) {
                    return Hero(
                      tag: 'product_image_$index',
                      child: CachedNetworkImage(
                        imageUrl: widget.images[index],
                        fit: BoxFit.contain,
                        placeholder: (context, url) => _buildShimmer(),
                        errorWidget: (context, url, error) => _buildErrorWidget(),
                      ),
                    );
                  },
                ),
              ),
            ),

            // Badges (Top Left)
            Positioned(
              top: 16,
              left: 16,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (widget.discountPercent != null && widget.discountPercent! > 0)
                    _buildBadge(
                      '${widget.discountPercent}% OFF',
                      AppColors.error,
                    ),
                  if (widget.isNew) ...[
                    const SizedBox(height: 8),
                    _buildBadge('NEW', AppColors.success),
                  ],
                  if (widget.isTrending) ...[
                    const SizedBox(height: 8),
                    _buildBadge('TRENDING', AppColors.warning),
                  ],
                ],
              ),
            ),

            // Zoom Icon (Top Right)
            Positioned(
              top: 16,
              right: 16,
              child: GestureDetector(
                onTap: () => _openFullscreen(_currentIndex),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.black.withValues(alpha: 0.5),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.zoom_out_map_rounded,
                    color: Colors.white,
                    size: 22,
                  ),
                ),
              ),
            ),

            // Page Indicator (Bottom)
            if (widget.images.length > 1)
              Positioned(
                bottom: 16,
                left: 0,
                right: 0,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(widget.images.length, (index) {
                    final isSelected = _currentIndex == index;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      margin: const EdgeInsets.symmetric(horizontal: 3),
                      width: isSelected ? 24 : 8,
                      height: 8,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(4),
                        color: isSelected
                            ? AppColors.primary
                            : Colors.grey.withValues(alpha: 0.5),
                      ),
                    );
                  }),
                ),
              ),
          ],
        ),

        // Thumbnail Strip
        if (widget.images.length > 1)
          Container(
            height: 72,
            margin: const EdgeInsets.only(top: 12),
            child: ListView.builder(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: widget.images.length,
              itemBuilder: (context, index) {
                final isSelected = _currentIndex == index;
                return GestureDetector(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    _pageController.animateToPage(
                      index,
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.easeInOut,
                    );
                  },
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    width: 64,
                    margin: const EdgeInsets.only(right: 10),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(
                        color: isSelected
                            ? AppColors.primary
                            : (widget.isDark ? AppColors.borderDark : AppColors.border),
                        width: isSelected ? 2.5 : 1,
                      ),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: CachedNetworkImage(
                        imageUrl: widget.images[index],
                        fit: BoxFit.cover,
                        placeholder: (context, url) => Container(
                          color: widget.isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant,
                        ),
                        errorWidget: (context, url, error) => Container(
                          color: widget.isDark ? Colors.grey[800] : Colors.grey[200],
                          child: const Icon(Icons.error, size: 20),
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }

  Widget _buildBadge(String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(4),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.3),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Text(
        text,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildShimmer() {
    return Container(
      color: widget.isDark ? Colors.grey[900] : Colors.grey[200],
      child: Center(
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: AppColors.primary.withValues(alpha: 0.5),
        ),
      ),
    );
  }

  Widget _buildErrorWidget() {
    return Container(
      color: widget.isDark ? Colors.grey[900] : Colors.grey[200],
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.broken_image_rounded,
            size: 48,
            color: Colors.grey[500],
          ),
          const SizedBox(height: 8),
          Text(
            'Image unavailable',
            style: TextStyle(
              color: Colors.grey[500],
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

// Fullscreen Gallery with Zoom
class _FullscreenGallery extends StatefulWidget {
  final List<String> images;
  final int initialIndex;
  final String? productName;

  const _FullscreenGallery({
    required this.images,
    required this.initialIndex,
    this.productName,
  });

  @override
  State<_FullscreenGallery> createState() => _FullscreenGalleryState();
}

class _FullscreenGalleryState extends State<_FullscreenGallery> {
  late int _currentIndex;
  late PageController _pageController;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      resizeToAvoidBottomInset: false, // 🔥 KEYBOARD FIX
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Gallery
          PhotoViewGallery.builder(
            scrollPhysics: const BouncingScrollPhysics(),
            pageController: _pageController,
            itemCount: widget.images.length,
            onPageChanged: (index) {
              setState(() => _currentIndex = index);
              HapticFeedback.selectionClick();
            },
            builder: (context, index) {
              return PhotoViewGalleryPageOptions(
                imageProvider: CachedNetworkImageProvider(widget.images[index]),
                initialScale: PhotoViewComputedScale.contained,
                minScale: PhotoViewComputedScale.contained,
                maxScale: PhotoViewComputedScale.covered * 3,
                heroAttributes: PhotoViewHeroAttributes(tag: 'product_image_$index'),
              );
            },
            backgroundDecoration: const BoxDecoration(
              color: Colors.black,
            ),
          ),

          // Top Bar
          Positioned(
            top: MediaQuery.of(context).padding.top,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
                  ),
                  if (widget.productName != null)
                    Expanded(
                      child: Text(
                        widget.productName!,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                      ),
                    ),
                  const SizedBox(width: 48), // Balance the close button
                ],
              ),
            ),
          ),

          // Bottom Indicator
          Positioned(
            bottom: MediaQuery.of(context).padding.bottom + 32,
            left: 0,
            right: 0,
            child: Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${_currentIndex + 1} / ${widget.images.length}',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
