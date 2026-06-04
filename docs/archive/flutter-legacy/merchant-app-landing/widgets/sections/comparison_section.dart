import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class ComparisonSection extends StatefulWidget {
  final bool isMobile;
  const ComparisonSection({super.key, required this.isMobile});

  @override
  State<ComparisonSection> createState() => _ComparisonSectionState();
}

class _ComparisonSectionState extends State<ComparisonSection> with SingleTickerProviderStateMixin {
  late AnimationController _shimmerController;
  int _hoveredRow = -1;

  // Landing page theme colors
  static const _primaryPurple = Color(0xFF8B5CF6);
  static const _secondaryPurple = Color(0xFF8B5CF6);
  static const _accentGreen = Color(0xFF10B981);
  static const _accentRed = Color(0xFFEF4444);
  static const _textDark = Color(0xFF0F172A);
  static const _textMuted = Color(0xFF64748B);
  static const _borderLight = Color(0xFFE5E7EB);

  final List<Map<String, dynamic>> _comparisonData = [
    {
      'feature': 'Setup Time',
      'letbuyy': '5 minutes',
      'letbuyyType': 'highlight',
      'marketplace': '2-4 weeks',
      'marketplaceType': 'warning',
      'traditional': '1-3 months',
      'traditionalType': 'danger',
    },
    {
      'feature': 'Commission',
      'letbuyy': '0%',
      'letbuyyType': 'highlight',
      'marketplace': '15-30%',
      'marketplaceType': 'danger',
      'traditional': '5-15%',
      'traditionalType': 'warning',
    },
    {
      'feature': 'Monthly Cost',
      'letbuyy': 'Free to start',
      'letbuyyType': 'highlight',
      'marketplace': 'Free*',
      'marketplaceType': 'neutral',
      'traditional': '₹2,000+/mo',
      'traditionalType': 'danger',
    },
    {
      'feature': 'Video Commerce',
      'letbuyy': 'Built-in',
      'letbuyyType': 'check',
      'marketplace': 'None',
      'marketplaceType': 'cross',
      'traditional': 'None',
      'traditionalType': 'cross',
    },
    {
      'feature': 'Reel Store',
      'letbuyy': 'Native',
      'letbuyyType': 'check',
      'marketplace': 'No',
      'marketplaceType': 'cross',
      'traditional': 'No',
      'traditionalType': 'cross',
    },
    {
      'feature': 'Custom Domain',
      'letbuyy': 'Free',
      'letbuyyType': 'highlight',
      'marketplace': '₹500+/yr',
      'marketplaceType': 'warning',
      'traditional': '₹1,000+/yr',
      'traditionalType': 'danger',
    },
    {
      'feature': 'Mobile App',
      'letbuyy': 'Included',
      'letbuyyType': 'check',
      'marketplace': 'Limited',
      'marketplaceType': 'warning',
      'traditional': 'Extra ₹₹',
      'traditionalType': 'danger',
    },
    {
      'feature': 'Payment Settlement',
      'letbuyy': '24-48 hrs',
      'letbuyyType': 'highlight',
      'marketplace': '7-14 days',
      'marketplaceType': 'warning',
      'traditional': '3-5 days',
      'traditionalType': 'neutral',
    },
    {
      'feature': 'Customer Data',
      'letbuyy': 'You own it',
      'letbuyyType': 'check',
      'marketplace': 'Platform owns',
      'marketplaceType': 'cross',
      'traditional': 'You own',
      'traditionalType': 'check',
    },
    {
      'feature': 'Support',
      'letbuyy': '24/7 Chat',
      'letbuyyType': 'highlight',
      'marketplace': 'Email only',
      'marketplaceType': 'warning',
      'traditional': 'Ticketing',
      'traditionalType': 'neutral',
    },
    {
      'feature': 'Analytics',
      'letbuyy': 'Advanced',
      'letbuyyType': 'check',
      'marketplace': 'Basic',
      'marketplaceType': 'neutral',
      'traditional': 'Limited',
      'traditionalType': 'warning',
    },
  ];

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 2),
    )..repeat();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(
        vertical: widget.isMobile ? 50 : 70,
        horizontal: widget.isMobile ? 12 : 40,
      ),
      // Transparent - unified background shows through from LandingScreen
      child: Column(
        children: [
          _buildHeader(),
          SizedBox(height: widget.isMobile ? 32 : 48),
          _buildComparisonTable(),
          SizedBox(height: widget.isMobile ? 40 : 56),
          _buildBottomLine(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: widget.isMobile ? 8 : 40),
      child: Column(
        children: [
          // Badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [_primaryPurple.withValues(alpha: 0.1), _secondaryPurple.withValues(alpha: 0.05)],
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _primaryPurple.withValues(alpha: 0.2)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.compare_arrows_rounded, size: 14, color: _primaryPurple),
                const SizedBox(width: 8),
                Text('Compare', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _primaryPurple)),
              ],
            ),
          ).animate().fadeIn(duration: 400.ms).scale(begin: const Offset(0.95, 0.95)),
          const SizedBox(height: 16),
          // Title
          Text(
            'Why Choose LetBuyy?',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: widget.isMobile ? 28 : 44,
              fontWeight: FontWeight.w800,
              letterSpacing: -1,
              color: _textDark,
              height: 1.1,
            ),
          ).animate().fadeIn(duration: 500.ms, delay: 100.ms).slideY(begin: 0.08),
          const SizedBox(height: 12),
          Text(
            'See how we stack up against the alternatives',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: widget.isMobile ? 14 : 16, color: _textMuted),
          ).animate().fadeIn(duration: 400.ms, delay: 200.ms),
        ],
      ),
    );
  }

  Widget _buildComparisonTable() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _borderLight),
        boxShadow: [
          BoxShadow(color: _primaryPurple.withValues(alpha: 0.06), blurRadius: 30, offset: const Offset(0, 15)),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(20),
        child: Column(
          children: [
            // Header Row
            _buildTableHeader(),
            // Data Rows
            ..._comparisonData.asMap().entries.map((entry) {
              final index = entry.key;
              final data = entry.value;
              return _buildTableRow(data, index);
            }),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 500.ms, delay: 300.ms).slideY(begin: 0.05);
  }

  Widget _buildTableHeader() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [const Color(0xFFF8FAFF), const Color(0xFFEEF2FF)],
        ),
        border: Border(bottom: BorderSide(color: _borderLight)),
      ),
      child: Row(
        children: [
          // Feature column
          Expanded(
            flex: widget.isMobile ? 3 : 2,
            child: Container(
              padding: EdgeInsets.all(widget.isMobile ? 12 : 16),
              child: Text(
                'Feature',
                style: TextStyle(fontSize: widget.isMobile ? 11 : 13, fontWeight: FontWeight.w700, color: _textMuted),
              ),
            ),
          ),
          // LetBuyy column with ribbon
          Expanded(
            flex: widget.isMobile ? 3 : 2,
            child: Container(
              padding: EdgeInsets.symmetric(vertical: widget.isMobile ? 10 : 14, horizontal: widget.isMobile ? 8 : 12),
              decoration: BoxDecoration(
                gradient: LinearGradient(colors: [_primaryPurple.withValues(alpha: 0.1), _secondaryPurple.withValues(alpha: 0.05)]),
                border: Border(
                  left: BorderSide(color: _primaryPurple, width: 3),
                ),
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [_primaryPurple, _secondaryPurple]),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text('BEST', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 1)),
                  ),
                  const SizedBox(height: 4),
                  Text('LetBuyy', style: TextStyle(fontSize: widget.isMobile ? 12 : 14, fontWeight: FontWeight.w800, color: _primaryPurple)),
                ],
              ),
            ),
          ),
          // Marketplaces column
          Expanded(
            flex: widget.isMobile ? 3 : 2,
            child: Container(
              padding: EdgeInsets.all(widget.isMobile ? 12 : 16),
              child: Text(
                'Marketplaces',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: widget.isMobile ? 11 : 13, fontWeight: FontWeight.w600, color: _textMuted),
              ),
            ),
          ),
          // Traditional column
          Expanded(
            flex: widget.isMobile ? 3 : 2,
            child: Container(
              padding: EdgeInsets.all(widget.isMobile ? 12 : 16),
              child: Text(
                'Traditional',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: widget.isMobile ? 11 : 13, fontWeight: FontWeight.w600, color: _textMuted),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTableRow(Map<String, dynamic> data, int index) {
    final isHovered = _hoveredRow == index;
    
    return MouseRegion(
      onEnter: (_) => setState(() => _hoveredRow = index),
      onExit: (_) => setState(() => _hoveredRow = -1),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          color: isHovered ? const Color(0xFFF8FAFF) : Colors.white,
          border: Border(bottom: BorderSide(color: _borderLight.withValues(alpha: 0.5))),
        ),
        child: Row(
          children: [
            // Feature name
            Expanded(
              flex: widget.isMobile ? 3 : 2,
              child: Container(
                padding: EdgeInsets.all(widget.isMobile ? 12 : 16),
                child: Text(
                  data['feature'],
                  style: TextStyle(fontSize: widget.isMobile ? 12 : 14, fontWeight: FontWeight.w600, color: _textDark),
                ),
              ),
            ),
            // LetBuyy value
            Expanded(
              flex: widget.isMobile ? 3 : 2,
              child: Container(
                padding: EdgeInsets.symmetric(vertical: widget.isMobile ? 10 : 14, horizontal: widget.isMobile ? 8 : 12),
                decoration: BoxDecoration(
                  color: _accentGreen.withValues(alpha: 0.05),
                  border: Border(left: BorderSide(color: _primaryPurple.withValues(alpha: 0.3), width: 3)),
                ),
                child: _buildCell(data['letbuyy'], data['letbuyyType'], isLetbuyy: true),
              ),
            ),
            // Marketplace value
            Expanded(
              flex: widget.isMobile ? 3 : 2,
              child: Container(
                padding: EdgeInsets.all(widget.isMobile ? 12 : 16),
                child: _buildCell(data['marketplace'], data['marketplaceType']),
              ),
            ),
            // Traditional value
            Expanded(
              flex: widget.isMobile ? 3 : 2,
              child: Container(
                padding: EdgeInsets.all(widget.isMobile ? 12 : 16),
                child: _buildCell(data['traditional'], data['traditionalType']),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCell(String value, String type, {bool isLetbuyy = false}) {
    switch (type) {
      case 'highlight':
        return Container(
          padding: EdgeInsets.symmetric(horizontal: widget.isMobile ? 6 : 10, vertical: 4),
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: [_accentGreen.withValues(alpha: 0.15), _accentGreen.withValues(alpha: 0.08)]),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: _accentGreen.withValues(alpha: 0.2)),
          ),
          child: Text(
            value,
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: widget.isMobile ? 11 : 13, fontWeight: FontWeight.w700, color: _accentGreen),
          ),
        );
      case 'check':
        return Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.check_circle_rounded, size: widget.isMobile ? 14 : 16, color: _accentGreen),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                value,
                style: TextStyle(fontSize: widget.isMobile ? 11 : 13, fontWeight: FontWeight.w600, color: _accentGreen),
              ),
            ),
          ],
        );
      case 'cross':
        return Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cancel_rounded, size: widget.isMobile ? 14 : 16, color: _accentRed.withValues(alpha: 0.7)),
            const SizedBox(width: 4),
            Flexible(
              child: Text(
                value,
                style: TextStyle(fontSize: widget.isMobile ? 11 : 13, fontWeight: FontWeight.w500, color: _accentRed.withValues(alpha: 0.8)),
              ),
            ),
          ],
        );
      case 'danger':
        return Text(
          value,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: widget.isMobile ? 11 : 13, fontWeight: FontWeight.w500, color: _accentRed.withValues(alpha: 0.8)),
        );
      case 'warning':
        return Text(
          value,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: widget.isMobile ? 11 : 13, fontWeight: FontWeight.w500, color: const Color(0xFFF59E0B)),
        );
      default:
        return Text(
          value,
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: widget.isMobile ? 11 : 13, fontWeight: FontWeight.w500, color: _textMuted),
        );
    }
  }

  Widget _buildBottomLine() {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: widget.isMobile ? 8 : 40),
      child: Column(
        children: [
          // Savings highlight
          Container(
            padding: EdgeInsets.all(widget.isMobile ? 20 : 28),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [_accentGreen.withValues(alpha: 0.1), _accentGreen.withValues(alpha: 0.05)],
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _accentGreen.withValues(alpha: 0.2)),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.savings_rounded, size: widget.isMobile ? 28 : 36, color: _accentGreen),
                SizedBox(width: widget.isMobile ? 12 : 20),
                Flexible(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Save up to ₹50,000/year',
                        style: TextStyle(
                          fontSize: widget.isMobile ? 18 : 24,
                          fontWeight: FontWeight.w800,
                          color: _textDark,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'compared to traditional e-commerce solutions',
                        style: TextStyle(fontSize: widget.isMobile ? 13 : 15, color: _textMuted),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ).animate().fadeIn(duration: 500.ms, delay: 400.ms),
          SizedBox(height: widget.isMobile ? 24 : 32),
          // CTA with shimmer
          AnimatedBuilder(
            animation: _shimmerController,
            builder: (context, child) {
              return Container(
                padding: EdgeInsets.symmetric(horizontal: widget.isMobile ? 28 : 40, vertical: widget.isMobile ? 16 : 20),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [_primaryPurple, _secondaryPurple],
                  ),
                  borderRadius: BorderRadius.circular(16),
                  boxShadow: [
                    BoxShadow(color: _primaryPurple.withValues(alpha: 0.35), blurRadius: 20, offset: const Offset(0, 8)),
                  ],
                ),
                child: Stack(
                  children: [
                    // Shimmer overlay
                    Positioned.fill(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(16),
                        child: Transform.translate(
                          offset: Offset((_shimmerController.value - 0.5) * 400, 0),
                          child: Container(
                            width: 100,
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                colors: [Colors.transparent, Colors.white.withValues(alpha: 0.2), Colors.transparent],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'Start Selling Free',
                          style: TextStyle(fontSize: widget.isMobile ? 15 : 18, fontWeight: FontWeight.w700, color: Colors.white),
                        ),
                        const SizedBox(width: 10),
                        Icon(Icons.arrow_forward_rounded, color: Colors.white, size: widget.isMobile ? 18 : 22),
                      ],
                    ),
                  ],
                ),
              );
            },
          ).animate().fadeIn(duration: 500.ms, delay: 500.ms).scale(begin: const Offset(0.95, 0.95)),
        ],
      ),
    );
  }
}
