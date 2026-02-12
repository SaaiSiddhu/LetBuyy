import 'package:flutter/material.dart';
import '../../theme/app_theme_colors.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../models/store_model.dart';
import 'preview_sections/preview_header.dart';
import 'preview_sections/preview_hero.dart';
import 'preview_sections/preview_products.dart';
import 'preview_sections/preview_footer.dart';
import 'preview_sections/preview_about.dart';
import 'preview_sections/preview_testimonials.dart';
import 'preview_sections/preview_newsletter.dart';

/// Website-like preview of the store
/// Renders sections in order with tap-to-edit overlays
class WebsitePreview extends StatelessWidget {
  final StoreModel? store;
  final List<SectionModel> sections;
  final String? selectedSectionId;
  final ValueChanged<SectionModel>? onSectionTap;
  final ValueChanged<SectionModel>? onSectionUpdate;
  final void Function(SectionModel section, int direction)? onMoveSection;
  final VoidCallback? onAddSection;
  final double zoomLevel; // Browser-like zoom level (0.5 to 1.5)
  final String deviceMode; // 'phone', 'tablet', 'laptop'

  const WebsitePreview({
    super.key,
    this.store,
    required this.sections,
    this.selectedSectionId,
    this.onSectionTap,
    this.onSectionUpdate,
    this.onMoveSection,
    this.onAddSection,
    this.zoomLevel = 1.0,
    this.deviceMode = 'phone',
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    // Sort sections: header first, footer last, rest by order
    final sortedSections = List<SectionModel>.from(sections);
    sortedSections.sort((a, b) {
      if (a.type == SectionType.header) return -1;
      if (b.type == SectionType.header) return 1;
      if (a.type == SectionType.footer) return 1;
      if (b.type == SectionType.footer) return -1;
      return a.order.compareTo(b.order);
    });

    // Filter visible sections
    final visibleSections = sortedSections.where((s) => s.isVisible).toList();

    // Browser-like zoom: render at virtual width, then scale to fit frame
    return LayoutBuilder(
      builder: (context, constraints) {
        final frameWidth = constraints.maxWidth;
        // At 50% zoom: render at 2x width, scale down = smaller elements
        // At 100% zoom: render at 1x width = normal
        // At 150% zoom: render at 0.67x width, scale up = larger elements
        final virtualWidth = frameWidth / zoomLevel;
        
        return Container(
          decoration: const BoxDecoration(color: Colors.white),
          clipBehavior: Clip.antiAlias,
          child: SingleChildScrollView(
            physics: const ClampingScrollPhysics(),
            child: SizedBox(
              width: frameWidth, // Always fill the frame width
              child: FittedBox(
                fit: BoxFit.fitWidth,
                alignment: Alignment.topCenter,
                child: SizedBox(
                  width: virtualWidth,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      for (int i = 0; i < visibleSections.length; i++) ...[
                        _SectionWrapper(
                          section: visibleSections[i],
                          store: store,
                          isSelected: visibleSections[i].id == selectedSectionId,
                          onTap: () => onSectionTap?.call(visibleSections[i]),
                          onDragUp: () => onMoveSection?.call(visibleSections[i], -1),
                          onDragDown: () => onMoveSection?.call(visibleSections[i], 1),
                          child: _SectionErrorBoundary(
                            child: _buildSectionPreview(visibleSections[i]),
                          ),
                        ),
                        // Add thin line button between sections (not after footer)
                        if (visibleSections[i].type != SectionType.footer && 
                            i < visibleSections.length - 1)
                          _AddSectionLine(onTap: onAddSection),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildSectionPreview(SectionModel section) {
    switch (section.type) {
      case SectionType.header:
        return PreviewHeader(section: section, store: store, deviceMode: deviceMode);
      case SectionType.heroBanner:
        return PreviewHero(section: section, store: store);
      case SectionType.productGrid:
      case SectionType.featuredProducts:
        return PreviewProducts(section: section, store: store);
      case SectionType.aboutSection:
        return PreviewAbout(section: section, store: store);
      case SectionType.testimonials:
        return PreviewTestimonials(section: section, store: store);
      case SectionType.newsletter:
        return PreviewNewsletter(section: section, store: store);
      case SectionType.footer:
        return PreviewFooter(section: section, store: store, deviceMode: deviceMode);
      default:
        return _buildGenericPreview(section);
    }
  }

  Widget _buildGenericPreview(SectionModel section) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      color: Colors.grey[50],
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: const Color(0xFF6366F1).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(section.type.icon, size: 20, color: const Color(0xFF6366F1)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  section.type.displayName,
                  style: TextStyle(
                    color: Colors.grey[800],
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
                Text(
                  'Tap to customize',
                  style: TextStyle(
                    color: Colors.grey[400],
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          Icon(Icons.chevron_right, size: 20, color: Colors.grey[400]),
        ],
      ),
    );
  }
}

/// Wrapper that adds tap overlay, selection border, and interactive handles
class _SectionWrapper extends StatelessWidget {
  final SectionModel section;
  final StoreModel? store;
  final bool isSelected;
  final VoidCallback? onTap;
  final VoidCallback? onDragUp;
  final VoidCallback? onDragDown;
  final Widget child;

  const _SectionWrapper({
    required this.section,
    this.store,
    this.isSelected = false,
    this.onTap,
    this.onDragUp,
    this.onDragDown,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Stack(
        children: [
          child,
          
          // Selection overlay with enhanced controls
          if (isSelected)
            Positioned.fill(
              child: Container(
                decoration: BoxDecoration(
                  border: Border.all(
                    color: const Color(0xFF818CF8),
                    width: 2,
                  ),
                  color: const Color(0xFF6366F1).withValues(alpha: 0.05),
                ),
                child: Column(
                  children: [
                    // Top bar with section name and actions
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
                      decoration: const BoxDecoration(
                        color: Color(0xFF6366F1),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.max,
                        children: [
                          // Drag handle
                          const Icon(Icons.drag_indicator, color: Colors.white70, size: 16),
                          const SizedBox(width: 4),
                          
                          // Section name
                          Text(
                            section.type.displayName,
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 11,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          
                          const Spacer(),
                          
                          // Move up
                          if (section.type != SectionType.header)
                            _MiniActionButton(
                              icon: Icons.arrow_upward,
                              onTap: onDragUp,
                            ),
                          
                          // Move down
                          if (section.type != SectionType.footer)
                            _MiniActionButton(
                              icon: Icons.arrow_downward,
                              onTap: onDragDown,
                            ),
                        ],
                      ),
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

/// Mini action button for section controls
class _MiniActionButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback? onTap;

  const _MiniActionButton({required this.icon, this.onTap});

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(4),
        margin: const EdgeInsets.only(left: 4),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.2),
          borderRadius: BorderRadius.circular(4),
        ),
        child: Icon(icon, color: Colors.white, size: 14),
      ),
    );
  }
}

/// Thin horizontal line with + icon for adding sections
class _AddSectionLine extends StatefulWidget {
  final VoidCallback? onTap;

  const _AddSectionLine({this.onTap});

  @override
  State<_AddSectionLine> createState() => _AddSectionLineState();
}

class _AddSectionLineState extends State<_AddSectionLine> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        widget.onTap?.call();
      },
      onTapDown: (_) => setState(() => _isHovered = true),
      onTapUp: (_) => setState(() => _isHovered = false),
      onTapCancel: () => setState(() => _isHovered = false),
      child: Container(
        height: 20,
        color: Colors.transparent,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Horizontal line
            Container(
              height: 1,
              color: _isHovered ? const Color(0xFF6366F1) : Colors.grey[200],
            ),
            // Plus icon
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                color: _isHovered ? const Color(0xFF6366F1) : Colors.white,
                shape: BoxShape.circle,
                border: Border.all(
                  color: _isHovered ? const Color(0xFF6366F1) : Colors.grey[300]!,
                ),
              ),
              child: Icon(
                Icons.add,
                size: 12,
                color: _isHovered ? Colors.white : Colors.grey[400],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionErrorBoundary extends StatelessWidget {
  final Widget child;

  const _SectionErrorBoundary({required this.child});

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    try {
      return child;
    } catch (e) {
      return _buildErrorWidget();
    }
  }

  Widget _buildErrorWidget() {
    return Container(
      padding: const EdgeInsets.all(16),
      height: 100,
      alignment: Alignment.center,
      color: Colors.red[50],
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, color: Colors.red, size: 24),
          const SizedBox(height: 8),
          Text(
            'Section Error',
            style: TextStyle(color: Colors.red[900], fontSize: 12, fontWeight: FontWeight.bold),
          ),
        ],
      ),
    );
  }
}
