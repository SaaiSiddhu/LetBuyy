import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class MarqueeSection extends StatefulWidget {
  final bool isMobile;
  const MarqueeSection({super.key, required this.isMobile});

  @override
  State<MarqueeSection> createState() => _MarqueeSectionState();
}

class _MarqueeSectionState extends State<MarqueeSection> with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  static const List<Map<String, dynamic>> row1Stores = [
    {'name': 'StyleKart', 'category': 'Fashion', 'icon': Icons.checkroom_rounded, 'color': Color(0xFF8B5CF6)},
    {'name': 'FreshBasket', 'category': 'Grocery', 'icon': Icons.shopping_basket_rounded, 'color': Color(0xFF10B981)},
    {'name': 'TechZone', 'category': 'Electronics', 'icon': Icons.devices_rounded, 'color': Color(0xFF3B82F6)},
    {'name': 'BeautyBox', 'category': 'Cosmetics', 'icon': Icons.face_rounded, 'color': Color(0xFFEC4899)},
    {'name': 'HomeDecor', 'category': 'Furniture', 'icon': Icons.chair_rounded, 'color': Color(0xFFF59E0B)},
  ];

  static const List<Map<String, dynamic>> row2Stores = [
    {'name': 'PetParadise', 'category': 'Pet Supplies', 'icon': Icons.pets_rounded, 'color': Color(0xFF14B8A6)},
    {'name': 'BookWorm', 'category': 'Books', 'icon': Icons.menu_book_rounded, 'color': Color(0xFF78716C)},
    {'name': 'FitGear', 'category': 'Sports', 'icon': Icons.fitness_center_rounded, 'color': Color(0xFFEF4444)},
    {'name': 'KidsCorner', 'category': 'Toys', 'icon': Icons.toys_rounded, 'color': Color(0xFFFBBF24)},
    {'name': 'JewelCraft', 'category': 'Jewelry', 'icon': Icons.diamond_rounded, 'color': Color(0xFFD4AF37)},
  ];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: const Duration(seconds: 20))..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Background is handled by LandingScreen for unified continuity
    return Padding(
      padding: EdgeInsets.only(
        top: widget.isMobile ? 20 : 30,
        bottom: widget.isMobile ? 30 : 40,
      ),
      child: Column(
        children: [
          // Compact header
          Padding(
            padding: EdgeInsets.symmetric(horizontal: widget.isMobile ? 20 : 60),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                      decoration: BoxDecoration(
                        color: const Color(0xFF6366F1).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle),
                          ),
                          const SizedBox(width: 6),
                          Text('500+ Active Sellers', style: TextStyle(fontSize: widget.isMobile ? 10 : 12, fontWeight: FontWeight.w600, color: const Color(0xFF6366F1))),
                        ],
                      ),
                    ),
                  ],
                ).animate(delay: 300.ms).fadeIn(duration: 500.ms),
                SizedBox(height: widget.isMobile ? 10 : 14),
                Text(
                  'Trusted by Growing Businesses',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontSize: widget.isMobile ? 22 : 32,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                    color: const Color(0xFF0F172A),
                  ),
                ).animate(delay: 400.ms).fadeIn(duration: 500.ms).slideY(begin: 0.1, curve: Curves.easeOut),
              ],
            ),
          ),
          SizedBox(height: widget.isMobile ? 24 : 36),

          // Marquee Rows
          MouseRegion(
            onEnter: (_) => _controller.stop(),
            onExit: (_) => _controller.repeat(),
            child: Column(
              children: [
                _buildMarqueeRow(row1Stores, false),
                SizedBox(height: widget.isMobile ? 12 : 16),
                _buildMarqueeRow(row2Stores, true),
              ],
            ),
          ).animate(delay: 500.ms).fadeIn(duration: 600.ms),

          SizedBox(height: widget.isMobile ? 30 : 40),
          _buildCompactStatsRow(),
        ],
      ),
    );
  }

  /// Compact inline stats row (replaces bulky stats section)
  Widget _buildCompactStatsRow() {
    final stats = [
      {'value': '₹2Cr+', 'label': 'GMV', 'color': const Color(0xFF10B981)},
      {'value': '99.9%', 'label': 'Uptime', 'color': const Color(0xFFF59E0B)},
      {'value': '4.9★', 'label': 'Rating', 'color': const Color(0xFFEC4899)},
    ];

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: widget.isMobile ? 30 : 80),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: stats.map((s) {
          return Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(color: s['color'] as Color, shape: BoxShape.circle),
              ),
              const SizedBox(width: 8),
              Text(s['value'] as String, style: TextStyle(fontSize: widget.isMobile ? 14 : 18, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
              const SizedBox(width: 4),
              Text(s['label'] as String, style: TextStyle(fontSize: widget.isMobile ? 10 : 12, color: const Color(0xFF64748B))),
            ],
          );
        }).toList(),
      ),
    ).animate(delay: 700.ms).fadeIn(duration: 500.ms);
  }

  Widget _buildMarqueeRow(List<Map<String, dynamic>> stores, bool reverse) {
    final itemWidth = widget.isMobile ? 140.0 : 170.0;
    final setWidth = stores.length * itemWidth;
    final allItems = [...stores, ...stores, ...stores, ...stores];

    return SizedBox(
      height: widget.isMobile ? 70 : 85,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, _) {
          double offset = _controller.value * setWidth;
          if (reverse) {
            offset = -offset;
          } else {
            offset = offset - setWidth;
          }

          return ListView.builder(
            scrollDirection: Axis.horizontal,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: allItems.length,
            itemBuilder: (context, index) {
              return Transform.translate(
                offset: Offset(offset, 0),
                child: _buildCard(allItems[index], itemWidth),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildCard(Map<String, dynamic> store, double width) {
    final Color color = store['color'];
    return Container(
      width: width - 10,
      margin: const EdgeInsets.symmetric(horizontal: 5),
      padding: EdgeInsets.all(widget.isMobile ? 8 : 10),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFFE5E7EB)),
        boxShadow: [
          BoxShadow(color: color.withValues(alpha: 0.06), blurRadius: 8, offset: const Offset(0, 2)),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: widget.isMobile ? 28 : 32,
            height: widget.isMobile ? 28 : 32,
            decoration: BoxDecoration(
              gradient: LinearGradient(colors: [color, color.withValues(alpha: 0.8)]),
              borderRadius: BorderRadius.circular(7),
            ),
            child: Icon(store['icon'], color: Colors.white, size: widget.isMobile ? 12 : 14),
          ),
          SizedBox(width: widget.isMobile ? 6 : 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        store['name'],
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(fontSize: widget.isMobile ? 9 : 11, fontWeight: FontWeight.w700, color: const Color(0xFF0F172A)),
                      ),
                    ),
                    const SizedBox(width: 2),
                    Container(
                      padding: const EdgeInsets.all(1),
                      decoration: const BoxDecoration(color: Color(0xFF3B82F6), shape: BoxShape.circle),
                      child: Icon(Icons.check, color: Colors.white, size: widget.isMobile ? 4 : 5),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Container(
                  padding: EdgeInsets.symmetric(horizontal: widget.isMobile ? 3 : 4, vertical: 1),
                  decoration: BoxDecoration(color: color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(3)),
                  child: Text(store['category'], style: TextStyle(fontSize: widget.isMobile ? 6 : 7, fontWeight: FontWeight.w600, color: color)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsSection() {
    final stats = [
      {'value': '500+', 'label': 'Active Sellers', 'icon': Icons.storefront_rounded, 'color': const Color(0xFF6366F1)},
      {'value': '₹2Cr+', 'label': 'GMV Processed', 'icon': Icons.currency_rupee_rounded, 'color': const Color(0xFF10B981)},
      {'value': '99.9%', 'label': 'Uptime', 'icon': Icons.speed_rounded, 'color': const Color(0xFFF59E0B)},
      {'value': '4.9★', 'label': 'App Rating', 'icon': Icons.star_rounded, 'color': const Color(0xFFEC4899)},
    ];

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: widget.isMobile ? 20 : 80),
      child: Container(
        padding: EdgeInsets.all(widget.isMobile ? 20 : 32),
        decoration: BoxDecoration(
          gradient: LinearGradient(colors: [const Color(0xFF6366F1).withValues(alpha: 0.05), const Color(0xFF8B5CF6).withValues(alpha: 0.05)]),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE0E7FF)),
        ),
        child: Wrap(
          alignment: WrapAlignment.spaceAround,
          spacing: 16,
          runSpacing: 16,
          children: stats.map((s) => _buildStatItem(s)).toList(),
        ),
      ),
    ).animate(delay: 400.ms).fadeIn(duration: 600.ms).slideY(begin: 0.1);
  }

  Widget _buildStatItem(Map<String, dynamic> stat) {
    return SizedBox(
      width: widget.isMobile ? 120 : 150,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: EdgeInsets.all(widget.isMobile ? 8 : 10),
            decoration: BoxDecoration(color: (stat['color'] as Color).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
            child: Icon(stat['icon'], color: stat['color'], size: widget.isMobile ? 18 : 22),
          ),
          SizedBox(width: widget.isMobile ? 8 : 10),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(stat['value'], style: TextStyle(fontSize: widget.isMobile ? 16 : 20, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
                Text(stat['label'], overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: widget.isMobile ? 9 : 11, color: const Color(0xFF64748B))),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// Grid pattern painter matching hero section

