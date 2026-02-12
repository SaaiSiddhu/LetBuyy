import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class BentoFeaturesSection extends StatefulWidget {
  final bool isMobile;
  const BentoFeaturesSection({super.key, required this.isMobile});

  @override
  State<BentoFeaturesSection> createState() => _BentoFeaturesSectionState();
}

class _BentoFeaturesSectionState extends State<BentoFeaturesSection> {
  final PageController _pageController = PageController(viewportFraction: 0.85);
  int _currentPage = 0;

  // Landing page theme colors
  static const _primaryPurple = Color(0xFF6366F1);
  static const _secondaryPurple = Color(0xFF8B5CF6);
  static const _accentPink = Color(0xFFEC4899);
  static const _accentTeal = Color(0xFF14B8A6);
  static const _textDark = Color(0xFF0F172A);
  static const _textMuted = Color(0xFF64748B);
  static const _borderLight = Color(0xFFE5E7EB);

  final List<Map<String, dynamic>> _features = [
    {
      'icon': Icons.play_circle_rounded,
      'color': const Color(0xFF8B5CF6),
      'title': 'Shoppable Stories',
      'subtitle': 'Turn reels into revenue',
      'highlight': '3x More Sales',
      'points': ['Product tagging', 'One-tap checkout', 'Engagement analytics'],
      'badge': 'Popular',
    },
    {
      'icon': Icons.analytics_rounded,
      'color': const Color(0xFF14B8A6),
      'title': 'Live Analytics',
      'subtitle': 'Real-time insights dashboard',
      'highlight': 'Smart Data',
      'points': ['Revenue tracking', 'Customer insights', 'Sales reports'],
      'badge': 'New',
    },
    {
      'icon': Icons.credit_card_rounded,
      'color': const Color(0xFF10B981),
      'title': 'Instant Payments',
      'subtitle': 'Get paid in 24 hours',
      'highlight': 'Zero Hold',
      'points': ['UPI & Cards', 'COD support', 'Auto-settlement'],
    },
    {
      'icon': Icons.local_shipping_rounded,
      'color': const Color(0xFFF59E0B),
      'title': 'Smart Shipping',
      'subtitle': 'Multi-courier integration',
      'highlight': '5+ Couriers',
      'points': ['Auto labels', 'Live tracking', 'Best rates'],
    },
    {
      'icon': Icons.inventory_2_rounded,
      'color': const Color(0xFFEC4899),
      'title': 'Stock Sync',
      'subtitle': 'Never oversell again',
      'highlight': 'Real-time',
      'points': ['Multi-channel', 'Low alerts', 'Bulk upload'],
    },
    {
      'icon': Icons.campaign_rounded,
      'color': const Color(0xFF6366F1),
      'title': 'Marketing Suite',
      'subtitle': 'Grow your audience',
      'highlight': 'Built-in SEO',
      'points': ['Discount codes', 'Social share', 'Email tools'],
    },
  ];

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(vertical: widget.isMobile ? 40 : 50),
      // Transparent - unified background shows through from LandingScreen
      child: Column(
        children: [
          // Header
          Padding(
            padding: EdgeInsets.symmetric(horizontal: widget.isMobile ? 20 : 60),
            child: _buildHeader(),
          ),
          SizedBox(height: widget.isMobile ? 32 : 40),
          
          // Carousel
          SizedBox(
            height: widget.isMobile ? 340 : 300,
            child: PageView.builder(
              controller: _pageController,
              onPageChanged: (index) => setState(() => _currentPage = index),
              itemCount: _features.length,
              itemBuilder: (context, index) {
                return AnimatedBuilder(
                  animation: _pageController,
                  builder: (context, child) {
                    double value = 1.0;
                    if (_pageController.position.haveDimensions) {
                      value = _pageController.page! - index;
                      value = (1 - (value.abs() * 0.15)).clamp(0.85, 1.0);
                    }
                    return Center(
                      child: Transform.scale(
                        scale: value,
                        child: Opacity(
                          opacity: value.clamp(0.6, 1.0),
                          child: _buildCard(_features[index], index),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
          
          const SizedBox(height: 24),
          
          // Indicators
          _buildIndicators(),
          
          const SizedBox(height: 12),
          
          // Swipe hint
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.swipe, size: 14, color: _textMuted.withValues(alpha: 0.5)),
              const SizedBox(width: 6),
              Text(
                'Swipe to explore',
                style: TextStyle(fontSize: 12, color: _textMuted.withValues(alpha: 0.6), fontWeight: FontWeight.w500),
              ),
            ],
          ).animate().fadeIn(duration: 500.ms, delay: 500.ms),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Column(
      children: [
        // Badge matching hero section style
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [_primaryPurple.withValues(alpha: 0.1), _secondaryPurple.withValues(alpha: 0.08)],
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: _primaryPurple.withValues(alpha: 0.15)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [_primaryPurple, _secondaryPurple]),
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Features',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _primaryPurple),
              ),
            ],
          ),
        ).animate().fadeIn(duration: 400.ms).scale(begin: const Offset(0.95, 0.95)),
        const SizedBox(height: 16),
        // Title
        Text(
          'Everything You Need',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: widget.isMobile ? 28 : 42,
            fontWeight: FontWeight.w800,
            letterSpacing: -1,
            color: _textDark,
            height: 1.1,
          ),
        ).animate().fadeIn(duration: 500.ms, delay: 100.ms).slideY(begin: 0.08),
        const SizedBox(height: 10),
        Text(
          'Powerful tools to grow your business',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: widget.isMobile ? 14 : 16, color: _textMuted),
        ).animate().fadeIn(duration: 400.ms, delay: 200.ms),
      ],
    );
  }

  Widget _buildCard(Map<String, dynamic> feature, int index) {
    final Color color = feature['color'];
    final String? badge = feature['badge'];
    
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      padding: EdgeInsets.all(widget.isMobile ? 24 : 28),
      decoration: BoxDecoration(
        // White card matching hero section floating cards
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: _borderLight),
        boxShadow: [
          // Colored shadow like hero floating cards
          BoxShadow(color: color.withValues(alpha: 0.1), blurRadius: 30, offset: const Offset(0, 15)),
          BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 15, offset: const Offset(0, 5)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top row: Icon + Badge
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Icon container with gradient
              Container(
                width: widget.isMobile ? 52 : 58,
                height: widget.isMobile ? 52 : 58,
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [color, color.withValues(alpha: 0.8)]),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [BoxShadow(color: color.withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 6))],
                ),
                child: Icon(feature['icon'], color: Colors.white, size: widget.isMobile ? 26 : 28),
              ),
              if (badge != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: color.withValues(alpha: 0.2)),
                  ),
                  child: Text(badge, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color)),
                ),
            ],
          ),
          const Spacer(),
          // Highlight chip
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [color.withValues(alpha: 0.1), color.withValues(alpha: 0.05)]),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: color.withValues(alpha: 0.15)),
            ),
            child: Text(
              feature['highlight'],
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color, letterSpacing: 0.3),
            ),
          ),
          const SizedBox(height: 10),
          // Title
          Text(
            feature['title'],
            style: TextStyle(
              fontSize: widget.isMobile ? 22 : 26,
              fontWeight: FontWeight.w800,
              color: _textDark,
              letterSpacing: -0.5,
            ),
          ),
          const SizedBox(height: 4),
          // Subtitle
          Text(
            feature['subtitle'],
            style: TextStyle(fontSize: widget.isMobile ? 14 : 15, color: _textMuted),
          ),
          const SizedBox(height: 14),
          // Feature points
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: (feature['points'] as List<String>).map((point) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFF),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: _borderLight),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.check_circle_rounded, size: 12, color: color),
                    const SizedBox(width: 5),
                    Text(point, style: TextStyle(fontSize: widget.isMobile ? 11 : 12, fontWeight: FontWeight.w600, color: _textDark)),
                  ],
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildIndicators() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(_features.length, (index) {
        final isActive = index == _currentPage;
        
        return GestureDetector(
          onTap: () => _pageController.animateToPage(index, duration: 300.ms, curve: Curves.easeOut),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            margin: const EdgeInsets.symmetric(horizontal: 4),
            width: isActive ? 28 : 8,
            height: 8,
            decoration: BoxDecoration(
              // Purple gradient when active, matching landing theme
              gradient: isActive ? LinearGradient(colors: [_primaryPurple, _secondaryPurple]) : null,
              color: isActive ? null : const Color(0xFFE2E8F0),
              borderRadius: BorderRadius.circular(4),
              boxShadow: isActive ? [BoxShadow(color: _primaryPurple.withValues(alpha: 0.3), blurRadius: 6, offset: const Offset(0, 2))] : null,
            ),
          ),
        );
      }),
    );
  }
}
