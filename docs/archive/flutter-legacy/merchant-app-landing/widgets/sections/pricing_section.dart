import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class PricingSection extends StatefulWidget {
  final bool isMobile;
  const PricingSection({super.key, required this.isMobile});

  @override
  State<PricingSection> createState() => _PricingSectionState();
}

class _PricingSectionState extends State<PricingSection> {
  bool _isYearly = true;
  int _hoveredRow = -1;

  // Landing page theme colors
  static const _primaryPurple = Color(0xFF8B5CF6);
  static const _secondaryPurple = Color(0xFF8B5CF6);
  static const _accentGreen = Color(0xFF10B981);
  static const _textDark = Color(0xFF0F172A);
  static const _textMuted = Color(0xFF64748B);
  static const _borderLight = Color(0xFFE5E7EB);

  static const List<Map<String, dynamic>> _plans = [
    {
      'name': 'Starter',
      'monthlyPrice': 0,
      'yearlyPrice': 0,
      'features': {'products': '10', 'domain': false, 'video': false, 'branding': false, 'analytics': 'Basic', 'support': 'Community', 'stores': '1'},
    },
    {
      'name': 'Growth',
      'monthlyPrice': 249,
      'yearlyPrice': 199,
      'features': {'products': '100', 'domain': true, 'video': false, 'branding': false, 'analytics': 'Advanced', 'support': 'Priority', 'stores': '1'},
    },
    {
      'name': 'Pro',
      'monthlyPrice': 499,
      'yearlyPrice': 399,
      'popular': true,
      'features': {'products': '∞', 'domain': true, 'video': true, 'branding': true, 'analytics': 'Pro', 'support': '24/7', 'stores': '3'},
    },
    {
      'name': 'Scale',
      'monthlyPrice': 1499,
      'yearlyPrice': 1199,
      'features': {'products': '∞', 'domain': true, 'video': true, 'branding': true, 'analytics': 'Enterprise', 'support': 'Dedicated', 'stores': '∞'},
    },
  ];

  final List<Map<String, dynamic>> _featureRows = [
    {'key': 'products', 'label': 'Products'},
    {'key': 'domain', 'label': 'Custom Domain'},
    {'key': 'video', 'label': 'Video Commerce'},
    {'key': 'branding', 'label': 'Remove Branding'},
    {'key': 'analytics', 'label': 'Analytics'},
    {'key': 'support', 'label': 'Support'},
    {'key': 'stores', 'label': 'Stores'},
  ];

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
          SizedBox(height: widget.isMobile ? 24 : 32),
          _buildToggle(),
          SizedBox(height: widget.isMobile ? 32 : 40),
          _buildPricingTable(),
          SizedBox(height: widget.isMobile ? 32 : 40),
          _buildTrustLine(),
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
                Icon(Icons.local_offer_rounded, size: 12, color: _primaryPurple),
                const SizedBox(width: 8),
                Text('Pricing', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _primaryPurple)),
              ],
            ),
          ).animate().fadeIn(duration: 400.ms).scale(begin: const Offset(0.95, 0.95)),
          const SizedBox(height: 16),
          // Title
          Text(
            'Simple, Transparent Pricing',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: widget.isMobile ? 28 : 44,
              fontWeight: FontWeight.w800,
              letterSpacing: -1,
              color: _textDark,
              height: 1.1,
            ),
          ).animate().fadeIn(duration: 500.ms, delay: 100.ms).slideY(begin: 0.08),
          const SizedBox(height: 10),
          Text(
            'Start free, scale as you grow',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: widget.isMobile ? 14 : 16, color: _textMuted),
          ).animate().fadeIn(duration: 400.ms, delay: 200.ms),
        ],
      ),
    );
  }

  Widget _buildToggle() {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _borderLight),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 10)],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _buildToggleButton('Monthly', !_isYearly),
          _buildToggleButton('Yearly', _isYearly, badge: 'Save 20%'),
        ],
      ),
    ).animate(delay: 300.ms).fadeIn().scale(begin: const Offset(0.95, 0.95));
  }

  Widget _buildToggleButton(String text, bool isActive, {String? badge}) {
    return GestureDetector(
      onTap: () => setState(() => _isYearly = text == 'Yearly'),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: EdgeInsets.symmetric(horizontal: widget.isMobile ? 16 : 24, vertical: 10),
        decoration: BoxDecoration(
          gradient: isActive ? LinearGradient(colors: [_primaryPurple, _secondaryPurple]) : null,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              text,
              style: TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: widget.isMobile ? 13 : 14,
                color: isActive ? Colors.white : _textMuted,
              ),
            ),
            if (badge != null && isActive) ...[
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(badge, style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildPricingTable() {
    // Mobile: Card-based layout (like the reference image)
    if (widget.isMobile) {
      return _buildMobilePricingCards();
    }
    
    // Desktop/Tablet: Table layout
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
            // Header with prices
            _buildPriceHeader(),
            // Feature rows
            ..._featureRows.asMap().entries.map((entry) {
              final index = entry.key;
              final row = entry.value;
              return _buildFeatureRow(row['key'], row['label'], index);
            }),
            // CTA row
            _buildCTARow(),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 500.ms, delay: 300.ms).slideY(begin: 0.05);
  }

  /// Mobile: Horizontal scrolling cards layout
  Widget _buildMobilePricingCards() {
    return SizedBox(
      height: 440,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 8),
        itemCount: _plans.length,
        itemBuilder: (context, index) {
          final plan = _plans[index];
          final isPopular = plan['popular'] == true;
          final price = _isYearly ? plan['yearlyPrice'] : plan['monthlyPrice'];
          
          return Container(
            width: 260,
            margin: const EdgeInsets.only(right: 16),
            child: _buildPlanCard(plan, isPopular, price),
          ).animate(delay: Duration(milliseconds: 200 + index * 100))
           .fadeIn(duration: 400.ms)
           .slideX(begin: 0.1);
        },
      ),
    );
  }

  /// Individual plan card for mobile
  Widget _buildPlanCard(Map<String, dynamic> plan, bool isPopular, int price) {
    // Define features for each plan
    final List<Map<String, dynamic>> planFeatures = _getPlanFeaturesList(plan);
    
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: isPopular ? _primaryPurple : _borderLight,
          width: isPopular ? 2 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: isPopular 
                ? _primaryPurple.withValues(alpha: 0.12) 
                : Colors.black.withValues(alpha: 0.04),
            blurRadius: isPopular ? 24 : 16,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Popular badge
                if (isPopular)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(colors: [_primaryPurple, _secondaryPurple]),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      'MOST POPULAR',
                      style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 0.5),
                    ),
                  ),
                // Plan name
                Text(
                  plan['name'],
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.w700,
                    color: _textDark,
                  ),
                ),
                const SizedBox(height: 4),
                // Description
                Text(
                  _getPlanDescription(plan['name']),
                  style: TextStyle(fontSize: 12, color: _textMuted),
                ),
                const SizedBox(height: 16),
                // Price
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      price == 0 ? '₹0' : '₹$price',
                      style: TextStyle(
                        fontSize: 36,
                        fontWeight: FontWeight.w800,
                        color: isPopular ? _primaryPurple : _textDark,
                        height: 1,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6, left: 2),
                      child: Text(
                        '/month',
                        style: TextStyle(fontSize: 13, color: _textMuted),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Divider
          Container(height: 1, color: _borderLight),
          // Features list
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: planFeatures.map((feature) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        Container(
                          width: 18,
                          height: 18,
                          decoration: BoxDecoration(
                            color: _accentGreen.withValues(alpha: 0.1),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(Icons.check_rounded, color: _accentGreen, size: 12),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            feature['text'],
                            style: TextStyle(
                              fontSize: 13,
                              color: _textDark,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ),
          // CTA Button
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 14),
              decoration: BoxDecoration(
                gradient: isPopular 
                    ? LinearGradient(colors: [_accentGreen, const Color(0xFF059669)])
                    : null,
                color: isPopular ? null : Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: isPopular ? null : Border.all(color: _borderLight),
                boxShadow: isPopular ? [
                  BoxShadow(color: _accentGreen.withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 4)),
                ] : null,
              ),
              child: Center(
                child: Text(
                  price == 0 ? 'Start Free' : (isPopular ? 'Get Started' : 'Upgrade to ${plan['name']}'),
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: isPopular ? Colors.white : _textDark,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Get feature list for a specific plan
  List<Map<String, dynamic>> _getPlanFeaturesList(Map<String, dynamic> plan) {
    final features = plan['features'] as Map<String, dynamic>;
    final List<Map<String, dynamic>> result = [];
    
    // Products
    result.add({'text': '${features['products']} Products'});
    
    // Stores
    result.add({'text': '${features['stores']} Store${features['stores'] == '1' ? '' : 's'}'});
    
    // Domain
    if (features['domain'] == true) {
      result.add({'text': 'Custom Domain'});
    } else {
      result.add({'text': 'Basic Themes'});
    }
    
    // Branding
    if (features['branding'] == true) {
      result.add({'text': 'No Branding'});
    } else {
      result.add({'text': 'LetBuyy Branding'});
    }
    
    // Video
    if (features['video'] == true) {
      result.add({'text': 'Video Commerce'});
    }
    
    // Analytics
    result.add({'text': '${features['analytics']} Analytics'});
    
    // Support
    result.add({'text': '${features['support']} Support'});
    
    return result;
  }

  /// Get plan description
  String _getPlanDescription(String planName) {
    switch (planName) {
      case 'Starter':
        return 'For beginners testing the platform';
      case 'Growth':
        return 'For small sellers starting sales';
      case 'Pro':
        return 'For serious sellers & brands';
      case 'Scale':
        return 'For agencies & high-volume sellers';
      default:
        return '';
    }
  }

  Widget _buildPriceHeader() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [const Color(0xFFF8FAFF), const Color(0xFFEEF2FF)]),
        border: Border(bottom: BorderSide(color: _borderLight)),
      ),
      child: Row(
        children: [
          // Feature column header
          SizedBox(
            width: widget.isMobile ? 100 : 140,
            child: Container(
              padding: EdgeInsets.all(widget.isMobile ? 12 : 16),
              child: Text('Plan', style: TextStyle(fontSize: widget.isMobile ? 11 : 13, fontWeight: FontWeight.w600, color: _textMuted)),
            ),
          ),
          // Plan columns
          ..._plans.map((plan) {
            final isPopular = plan['popular'] == true;
            final price = _isYearly ? plan['yearlyPrice'] : plan['monthlyPrice'];
            
            return Expanded(
              child: Container(
                padding: EdgeInsets.symmetric(vertical: widget.isMobile ? 16 : 20, horizontal: widget.isMobile ? 8 : 12),
                decoration: BoxDecoration(
                  gradient: isPopular ? LinearGradient(colors: [_primaryPurple.withValues(alpha: 0.08), _secondaryPurple.withValues(alpha: 0.04)]) : null,
                  border: isPopular ? Border(left: BorderSide(color: _primaryPurple, width: 3)) : null,
                ),
                child: Column(
                  children: [
                    if (isPopular)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: [_primaryPurple, _secondaryPurple]),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text('POPULAR', style: TextStyle(fontSize: 8, fontWeight: FontWeight.w800, color: Colors.white, letterSpacing: 1)),
                      ),
                    Text(
                      plan['name'],
                      style: TextStyle(
                        fontSize: widget.isMobile ? 13 : 15,
                        fontWeight: FontWeight.w700,
                        color: isPopular ? _primaryPurple : _textDark,
                      ),
                    ),
                    const SizedBox(height: 6),
                    RichText(
                      text: TextSpan(
                        children: [
                          TextSpan(
                            text: price == 0 ? 'Free' : '₹$price',
                            style: TextStyle(
                              fontSize: widget.isMobile ? 20 : 26,
                              fontWeight: FontWeight.w800,
                              color: isPopular ? _primaryPurple : _textDark,
                            ),
                          ),
                          if (price > 0)
                            TextSpan(
                              text: '/mo',
                              style: TextStyle(fontSize: widget.isMobile ? 11 : 13, color: _textMuted),
                            ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildFeatureRow(String key, String label, int index) {
    final isHovered = _hoveredRow == index;
    
    return MouseRegion(
      onEnter: (_) => setState(() => _hoveredRow = index),
      onExit: (_) => setState(() => _hoveredRow = -1),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        decoration: BoxDecoration(
          color: isHovered ? const Color(0xFFF8FAFF) : (index.isEven ? Colors.white : const Color(0xFFFAFBFC)),
          border: Border(bottom: BorderSide(color: _borderLight.withValues(alpha: 0.5))),
        ),
        child: Row(
          children: [
            // Feature label
            SizedBox(
              width: widget.isMobile ? 100 : 140,
              child: Container(
                padding: EdgeInsets.all(widget.isMobile ? 12 : 16),
                child: Text(label, style: TextStyle(fontSize: widget.isMobile ? 11 : 13, fontWeight: FontWeight.w600, color: _textDark)),
              ),
            ),
            // Plan values
            ..._plans.map((plan) {
              final isPopular = plan['popular'] == true;
              final value = plan['features'][key];
              
              return Expanded(
                child: Container(
                  padding: EdgeInsets.symmetric(vertical: widget.isMobile ? 12 : 14, horizontal: widget.isMobile ? 8 : 12),
                  decoration: BoxDecoration(
                    color: isPopular ? _accentGreen.withValues(alpha: 0.03) : null,
                    border: isPopular ? Border(left: BorderSide(color: _primaryPurple.withValues(alpha: 0.2), width: 3)) : null,
                  ),
                  child: Center(child: _buildCellValue(value, isPopular)),
                ),
              );
            }),
          ],
        ),
      ),
    );
  }

  Widget _buildCellValue(dynamic value, bool isPopular) {
    if (value is bool) {
      if (value) {
        return Container(
          width: widget.isMobile ? 22 : 26,
          height: widget.isMobile ? 22 : 26,
          decoration: BoxDecoration(
            gradient: LinearGradient(colors: [_accentGreen, _accentGreen.withValues(alpha: 0.8)]),
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.check_rounded, color: Colors.white, size: widget.isMobile ? 12 : 14),
        );
      } else {
        return Container(
          width: widget.isMobile ? 22 : 26,
          height: widget.isMobile ? 22 : 26,
          decoration: BoxDecoration(
            color: const Color(0xFFF1F5F9),
            shape: BoxShape.circle,
          ),
          child: Icon(Icons.close_rounded, color: const Color(0xFFCBD5E1), size: widget.isMobile ? 12 : 14),
        );
      }
    } else if (value == '∞') {
      return Text(
        value,
        style: TextStyle(
          fontSize: widget.isMobile ? 18 : 22,
          fontWeight: FontWeight.w800,
          color: isPopular ? _primaryPurple : _accentGreen,
        ),
      );
    } else {
      return Text(
        value.toString(),
        textAlign: TextAlign.center,
        style: TextStyle(
          fontSize: widget.isMobile ? 11 : 13,
          fontWeight: isPopular ? FontWeight.w700 : FontWeight.w500,
          color: isPopular ? _primaryPurple : _textMuted,
        ),
      );
    }
  }

  Widget _buildCTARow() {
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [const Color(0xFFF8FAFF), const Color(0xFFEEF2FF)]),
      ),
      child: Row(
        children: [
          // Empty spacer
          SizedBox(width: widget.isMobile ? 100 : 140),
          // CTA buttons
          ..._plans.map((plan) {
            final isPopular = plan['popular'] == true;
            
            return Expanded(
              child: Container(
                padding: EdgeInsets.all(widget.isMobile ? 12 : 16),
                decoration: BoxDecoration(
                  border: isPopular ? Border(left: BorderSide(color: _primaryPurple.withValues(alpha: 0.2), width: 3)) : null,
                ),
                child: Container(
                  padding: EdgeInsets.symmetric(vertical: widget.isMobile ? 10 : 12),
                  decoration: BoxDecoration(
                    gradient: isPopular ? LinearGradient(colors: [_primaryPurple, _secondaryPurple]) : null,
                    color: isPopular ? null : Colors.white,
                    borderRadius: BorderRadius.circular(10),
                    border: isPopular ? null : Border.all(color: _borderLight),
                    boxShadow: isPopular ? [BoxShadow(color: _primaryPurple.withValues(alpha: 0.3), blurRadius: 12, offset: const Offset(0, 4))] : null,
                  ),
                  child: Center(
                    child: Text(
                      plan['monthlyPrice'] == 0 ? 'Start Free' : 'Get Started',
                      style: TextStyle(
                        fontSize: widget.isMobile ? 11 : 13,
                        fontWeight: FontWeight.w700,
                        color: isPopular ? Colors.white : _textDark,
                      ),
                    ),
                  ),
                ),
              ),
            );
          }),
        ],
      ),
    );
  }

  Widget _buildTrustLine() {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: widget.isMobile ? 8 : 40),
      child: Container(
        padding: EdgeInsets.all(widget.isMobile ? 16 : 24),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: _borderLight),
        ),
        child: Wrap(
          alignment: WrapAlignment.center,
          spacing: widget.isMobile ? 20 : 40,
          runSpacing: 16,
          children: [
            _buildTrustItem(Icons.credit_card_off_rounded, 'No credit card needed'),
            _buildTrustItem(Icons.sync_alt_rounded, 'Cancel anytime'),
            _buildTrustItem(Icons.shield_outlined, '14-day money back'),
          ],
        ),
      ).animate(delay: 400.ms).fadeIn(),
    );
  }

  Widget _buildTrustItem(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(6),
          decoration: BoxDecoration(
            color: _accentGreen.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: _accentGreen, size: widget.isMobile ? 14 : 16),
        ),
        const SizedBox(width: 8),
        Text(text, style: TextStyle(color: _textMuted, fontSize: widget.isMobile ? 12 : 13, fontWeight: FontWeight.w500)),
      ],
    );
  }
}
