import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'stat_card.dart';
import 'live_badge.dart';
import 'chart_painter.dart';
import 'floating_card.dart';

/// MacBook Pro mockup with dashboard content
class LaptopMockup extends StatelessWidget {
  final Size size;
  final bool compact;
  
  const LaptopMockup({super.key, required this.size, required this.compact});

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // More responsive: use available width minus padding
        final availableWidth = constraints.maxWidth;
        final w = compact 
            ? (availableWidth - 60).clamp(240.0, 420.0)  // smaller min for narrow screens
            : (availableWidth - 120).clamp(400.0, 640.0); // desktop also responsive
        final h = compact ? w * 0.55 : w * 0.6;
        
        return Center(
          child: SizedBox(
            width: w + 60,
            height: h + 60,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            // Shadow glow
            Positioned.fill(
              child: Container(
                margin: EdgeInsets.all(compact ? 15 : 25), 
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24), 
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF6366F1).withValues(alpha: 0.1), 
                      blurRadius: 100, 
                      spreadRadius: 25,
                    ),
                  ],
                ),
              ),
            ),
            // Laptop body
            Positioned(top: compact ? 10 : 25, child: _buildLaptop(w, h)),
            // Floating Cards with flutter_animate
            Positioned(
              top: 0, 
              right: compact ? 0 : -10, 
              child: FloatingCard(
                icon: Icons.trending_up_rounded, 
                color: const Color(0xFF10B981), 
                value: '+127%', 
                label: 'Revenue', 
                compact: compact,
              ).animate(delay: 1000.ms)
               .fadeIn(duration: 400.ms)
               .slideX(begin: 0.3, curve: Curves.easeOut),
            ),
            if (!compact) Positioned(
              top: 80, 
              left: -20, 
              child: FloatingCard(
                icon: Icons.shopping_bag_rounded, 
                color: const Color(0xFF6366F1), 
                value: '₹1,299', 
                label: 'New Order • Mumbai', 
                wide: true,
              ).animate(delay: 1300.ms)
               .fadeIn(duration: 400.ms)
               .slideX(begin: -0.3, curve: Curves.easeOut),
            ),
            Positioned(
              bottom: compact ? 10 : 50, 
              left: compact ? 0 : -15, 
              child: FloatingCard(
                icon: Icons.receipt_long_rounded, 
                color: const Color(0xFFF59E0B), 
                value: '23', 
                label: 'Orders Today', 
                compact: compact,
              ).animate(delay: 1600.ms)
               .fadeIn(duration: 400.ms)
               .slideX(begin: -0.3, curve: Curves.easeOut),
            ),
            if (!compact) Positioned(
              bottom: 20, 
              right: -10, 
              child: FloatingCard(
                icon: Icons.star_rounded, 
                color: const Color(0xFFEC4899), 
                value: '⭐ 4.8', 
                label: 'New Review',
              ).animate(delay: 1900.ms)
               .fadeIn(duration: 400.ms)
               .slideX(begin: 0.3, curve: Curves.easeOut),
            ),
          ],
        ),
      ),
    );
      },
    );
  }

  Widget _buildLaptop(double w, double h) {
    final bezelWidth = compact ? 4.0 : 6.0;
    final notchWidth = compact ? 50.0 : 70.0;
    final notchHeight = compact ? 16.0 : 22.0;
    
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // MacBook Pro Screen/Lid
        Container(
          width: w,
          height: h,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF2D2D30), Color(0xFF1C1C1E), Color(0xFF171719)],
              stops: [0.0, 0.3, 1.0],
            ),
            borderRadius: BorderRadius.circular(compact ? 14 : 18),
            border: Border.all(color: const Color(0xFF3D3D40), width: 1),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.4), 
                blurRadius: 60, 
                offset: const Offset(0, 30), 
                spreadRadius: 5,
              ),
              BoxShadow(
                color: const Color(0xFF6366F1).withValues(alpha: 0.05), 
                blurRadius: 80, 
                offset: const Offset(0, 20),
              ),
            ],
          ),
          child: Stack(
            children: [
              // Subtle reflection on top edge
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: Container(
                  height: 1,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(compact ? 14 : 18), 
                      topRight: Radius.circular(compact ? 14 : 18),
                    ),
                    gradient: LinearGradient(
                      colors: [Colors.transparent, Colors.white.withValues(alpha: 0.15), Colors.transparent],
                    ),
                  ),
                ),
              ),
              // Screen with bezels
              Positioned(
                top: bezelWidth,
                left: bezelWidth,
                right: bezelWidth,
                bottom: bezelWidth,
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(compact ? 12 : 16),
                  child: Container(
                    decoration: BoxDecoration(
                      color: Colors.black,
                      borderRadius: BorderRadius.circular(compact ? 12 : 16),
                    ),
                    child: Stack(
                      children: [
                        // macOS Menu Bar
                        Positioned(
                          top: 0,
                          left: 0,
                          right: 0,
                          height: notchHeight,
                          child: _buildMenuBar(notchWidth, notchHeight),
                        ),
                        // Screen content
                        Positioned(
                          top: notchHeight,
                          left: 0,
                          right: 0,
                          bottom: 0,
                          child: ClipRRect(
                            borderRadius: BorderRadius.only(
                              bottomLeft: Radius.circular(compact ? 10 : 14),
                              bottomRight: Radius.circular(compact ? 10 : 14),
                            ),
                            child: Container(
                              color: const Color(0xFFFAFBFC),
                              child: Column(
                                children: [
                                  _buildBrowserBar(),
                                  Expanded(child: _buildDashboard()),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        // Hinge
        Container(
          width: w * 0.92,
          height: compact ? 3 : 4,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF2D2D30), Color(0xFF4D4D50), Color(0xFF2D2D30)],
            ),
            borderRadius: BorderRadius.circular(1),
          ),
        ),
        // Base
        Container(
          width: w + (compact ? 16 : 24),
          height: compact ? 10 : 14,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [Color(0xFF3D3D40), Color(0xFF2D2D30), Color(0xFF252527)],
            ),
            borderRadius: BorderRadius.only(
              bottomLeft: Radius.circular(compact ? 8 : 12),
              bottomRight: Radius.circular(compact ? 8 : 12),
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.2), 
                blurRadius: 8, 
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Stack(
            children: [
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  height: compact ? 2 : 3,
                  decoration: BoxDecoration(
                    color: const Color(0xFF1C1C1E),
                    borderRadius: BorderRadius.only(
                      bottomLeft: Radius.circular(compact ? 8 : 12),
                      bottomRight: Radius.circular(compact ? 8 : 12),
                    ),
                  ),
                ),
              ),
              Center(
                child: Container(
                  width: compact ? 60 : 90,
                  height: compact ? 4 : 6,
                  decoration: BoxDecoration(
                    color: const Color(0xFF1C1C1E),
                    borderRadius: BorderRadius.circular(compact ? 2 : 3),
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildMenuBar(double notchWidth, double notchHeight) {
    final c = compact;
    return Container(
      color: const Color(0xFF1C1C1E),
      padding: EdgeInsets.symmetric(horizontal: c ? 8 : 12),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                Icon(Icons.apple, color: Colors.white, size: c ? 12 : 16),
                SizedBox(width: c ? 10 : 16),
                Text('Safari', style: TextStyle(color: Colors.white, fontSize: c ? 9 : 11, fontWeight: FontWeight.w600)),
                SizedBox(width: c ? 10 : 14),
                if (!c) ...[
                  Text('File', style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 11)),
                  const SizedBox(width: 14),
                  Text('Edit', style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 11)),
                  const SizedBox(width: 14),
                  Text('View', style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 11)),
                ],
              ],
            ),
          ),
          // Notch
          Container(
            width: notchWidth,
            height: notchHeight,
            decoration: BoxDecoration(
              color: const Color(0xFF1C1C1E),
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(c ? 10 : 14),
                bottomRight: Radius.circular(c ? 10 : 14),
              ),
            ),
            child: Center(
              child: Container(
                width: c ? 4 : 6,
                height: c ? 4 : 6,
                decoration: BoxDecoration(
                  color: const Color(0xFF3D3D40),
                  shape: BoxShape.circle,
                  border: Border.all(color: const Color(0xFF4D4D50), width: 1),
                ),
              ),
            ),
          ),
          Expanded(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                Icon(Icons.wifi, color: Colors.white, size: c ? 10 : 14),
                SizedBox(width: c ? 6 : 10),
                Icon(Icons.battery_full, color: Colors.white, size: c ? 10 : 14),
                SizedBox(width: c ? 6 : 10),
                Text(c ? '9:41' : 'Sat 9:41 AM', style: TextStyle(color: Colors.white, fontSize: c ? 8 : 11)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBrowserBar() {
    final c = compact;
    return Container(
      height: c ? 22 : 30,
      padding: EdgeInsets.symmetric(horizontal: c ? 8 : 12),
      decoration: const BoxDecoration(
        color: Color(0xFFFFFFFF), 
        border: Border(bottom: BorderSide(color: Color(0xFFE5E7EB))),
      ),
      child: Row(
        children: [
          Row(
            children: [
              Container(width: c ? 7 : 9, height: c ? 7 : 9, decoration: const BoxDecoration(color: Color(0xFFEF4444), shape: BoxShape.circle)),
              SizedBox(width: c ? 4 : 5),
              Container(width: c ? 7 : 9, height: c ? 7 : 9, decoration: const BoxDecoration(color: Color(0xFFFBBF24), shape: BoxShape.circle)),
              SizedBox(width: c ? 4 : 5),
              Container(width: c ? 7 : 9, height: c ? 7 : 9, decoration: const BoxDecoration(color: Color(0xFF22C55E), shape: BoxShape.circle)),
            ],
          ),
          SizedBox(width: c ? 10 : 14),
          Expanded(
            child: Container(
              height: c ? 15 : 20,
              padding: EdgeInsets.symmetric(horizontal: c ? 6 : 10),
              decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(5)),
              child: Row(
                children: [
                  Icon(Icons.lock_rounded, size: c ? 9 : 11, color: const Color(0xFF10B981)),
                  SizedBox(width: c ? 4 : 6),
                  Expanded(
                    child: Text(
                      'mystore.letbuyy.store', 
                      overflow: TextOverflow.ellipsis, 
                      style: TextStyle(fontSize: c ? 8 : 10, color: const Color(0xFF6B7280), fontWeight: FontWeight.w500),
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

  Widget _buildDashboard() {
    final c = compact;
    return Padding(
      padding: EdgeInsets.all(c ? 10 : 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Row(
            children: [
              Container(
                padding: EdgeInsets.all(c ? 6 : 8),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)]),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(Icons.store_rounded, color: Colors.white, size: c ? 14 : 18),
              ),
              SizedBox(width: c ? 10 : 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Analytics Dashboard', overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, fontSize: c ? 11 : 14, color: const Color(0xFF0F172A))),
                    Text('Real-time insights', style: TextStyle(fontSize: c ? 8 : 10, color: const Color(0xFF64748B))),
                  ],
                ),
              ),
              SimpleLiveBadge(compact: c),
            ],
          ).animate(delay: 1200.ms).fadeIn(duration: 500.ms, curve: Curves.easeOut).slideY(begin: 0.1, curve: Curves.easeOut),
          SizedBox(height: c ? 12 : 18),
          // Stats Row
          Row(
            children: [
              Expanded(child: StatCard('₹2.47L', 'This Month', const Color(0xFF10B981), Icons.currency_rupee_rounded, c).animate(delay: 1400.ms).fadeIn(duration: 400.ms).scale(begin: const Offset(0.9, 0.9))),
              SizedBox(width: c ? 8 : 12),
              Expanded(child: StatCard('384', 'Orders', const Color(0xFF6366F1), Icons.shopping_cart_rounded, c).animate(delay: 1550.ms).fadeIn(duration: 400.ms).scale(begin: const Offset(0.9, 0.9))),
              SizedBox(width: c ? 8 : 12),
              Expanded(child: StatCard('4.8', 'Rating', const Color(0xFFF59E0B), Icons.star_rounded, c).animate(delay: 1700.ms).fadeIn(duration: 400.ms).scale(begin: const Offset(0.9, 0.9))),
              SizedBox(width: c ? 8 : 12),
              Expanded(child: StatCard('+127%', 'Growth', const Color(0xFFEC4899), Icons.trending_up_rounded, c).animate(delay: 1850.ms).fadeIn(duration: 400.ms).scale(begin: const Offset(0.9, 0.9))),
            ],
          ),
          SizedBox(height: c ? 12 : 18),
          // Chart Container
          Expanded(
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(c ? 10 : 14),
                border: Border.all(color: const Color(0xFFE5E7EB)),
              ),
              padding: EdgeInsets.all(c ? 10 : 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Flexible(child: Text('Revenue Overview', overflow: TextOverflow.ellipsis, style: TextStyle(fontWeight: FontWeight.w700, fontSize: c ? 10 : 13, color: const Color(0xFF0F172A)))),
                      Container(
                        padding: EdgeInsets.symmetric(horizontal: c ? 6 : 10, vertical: c ? 2 : 5),
                        decoration: BoxDecoration(color: const Color(0xFF6366F1).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
                        child: Text('This Week', style: TextStyle(fontSize: c ? 6 : 9, color: const Color(0xFF6366F1), fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                  SizedBox(height: c ? 6 : 14),
                  Expanded(
                    child: ClipRect(
                      child: CustomPaint(painter: SimpleChartPainter(), size: Size.infinite),
                    ),
                  ),
                ],
              ),
            ).animate(delay: 2000.ms).fadeIn(duration: 500.ms, curve: Curves.easeOut).slideY(begin: 0.08, curve: Curves.easeOut),
          ),
        ],
      ),
    );
  }
}
