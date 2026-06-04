import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../components/shimmer_button.dart';
import '../hero/laptop_mockup.dart';

/// Hero Section - Main landing page hero content
/// Refactored for better maintainability - components split into separate files:
/// - laptop_mockup.dart - MacBook mockup with dashboard
/// - stat_card.dart - Individual stat cards
/// - floating_card.dart - Floating notification cards
/// - live_badge.dart - Live indicator badge  
/// - chart_painter.dart - Revenue chart painter
class HeroSection extends StatelessWidget {
  final bool isMobile;
  final VoidCallback onGetStarted;

  const HeroSection({super.key, required this.isMobile, required this.onGetStarted});

  @override
  Widget build(BuildContext context) {
    // Use LayoutBuilder for reactive responsiveness
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final size = MediaQuery.of(context).size;
        
        // Determine layout based on actual available width
        final isNarrow = width < 768;
        final isTablet = width >= 768 && width < 1024;
        final isDesktop = width >= 1024;
        
        final horizontalPadding = isNarrow ? 20.0 : (isTablet ? 40.0 : 80.0);
        
        return SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1400),
              child: Padding(
                padding: EdgeInsets.symmetric(horizontal: horizontalPadding),
                child: isDesktop 
                    ? _buildDesktopLayout(size) 
                    : (isTablet ? _buildTabletLayout(size) : _buildMobileLayout(size)),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildDesktopLayout(Size size) {
    const initDelay = 500;
    return Column(
      children: [
        SizedBox(height: size.height * 0.15),
        _buildHeadline(fontSize: 64, centered: true)
            .animate(delay: Duration(milliseconds: initDelay))
            .fadeIn(duration: 800.ms, curve: Curves.easeOut)
            .slideY(begin: 0.12, curve: Curves.easeOutCubic),
        const SizedBox(height: 20),
        _buildSubheading(centered: true, maxWidth: 600)
            .animate(delay: Duration(milliseconds: initDelay + 300))
            .fadeIn(duration: 600.ms, curve: Curves.easeOut),
        const SizedBox(height: 60),
        LaptopMockup(size: size, compact: false)
            .animate(delay: Duration(milliseconds: initDelay + 500))
            .fadeIn(duration: 1000.ms, curve: Curves.easeOut)
            .slideY(begin: 0.08, curve: Curves.easeOutCubic),
        const SizedBox(height: 40),
        _buildTrustSignals(centered: true)
            .animate(delay: Duration(milliseconds: initDelay + 900))
            .fadeIn(duration: 600.ms, curve: Curves.easeOut),
        const SizedBox(height: 40),
        _buildBottomCTAs()
            .animate(delay: Duration(milliseconds: initDelay + 1100))
            .fadeIn(duration: 600.ms, curve: Curves.easeOut)
            .slideY(begin: 0.1, curve: Curves.easeOut),
        const SizedBox(height: 40),
        _buildTrustElements()
            .animate(delay: Duration(milliseconds: initDelay + 1300))
            .fadeIn(duration: 600.ms, curve: Curves.easeOut),
        const SizedBox(height: 60),
      ],
    );
  }

  Widget _buildTabletLayout(Size size) {
    const initDelay = 500;
    return Column(
      children: [
        SizedBox(height: size.height * 0.10),
        _buildHeadline(fontSize: 48, centered: true)
            .animate(delay: Duration(milliseconds: initDelay))
            .fadeIn(duration: 800.ms, curve: Curves.easeOut)
            .slideY(begin: 0.12, curve: Curves.easeOutCubic),
        const SizedBox(height: 18),
        _buildSubheading(centered: true, maxWidth: 520)
            .animate(delay: Duration(milliseconds: initDelay + 300))
            .fadeIn(duration: 600.ms, curve: Curves.easeOut),
        const SizedBox(height: 50),
        LaptopMockup(size: size, compact: true)
            .animate(delay: Duration(milliseconds: initDelay + 500))
            .fadeIn(duration: 1000.ms, curve: Curves.easeOut)
            .scale(begin: const Offset(0.92, 0.92), curve: Curves.easeOutCubic),
        const SizedBox(height: 36),
        _buildTrustSignals(centered: true)
            .animate(delay: Duration(milliseconds: initDelay + 900))
            .fadeIn(duration: 600.ms, curve: Curves.easeOut),
        const SizedBox(height: 36),
        _buildBottomCTAs()
            .animate(delay: Duration(milliseconds: initDelay + 1100))
            .fadeIn(duration: 600.ms, curve: Curves.easeOut),
        const SizedBox(height: 32),
        _buildTrustElements()
            .animate(delay: Duration(milliseconds: initDelay + 1300))
            .fadeIn(duration: 600.ms, curve: Curves.easeOut),
        const SizedBox(height: 50),
      ],
    );
  }

  Widget _buildMobileLayout(Size size) {
    const initDelay = 500;
    return Column(
      children: [
        const SizedBox(height: 100),
        _buildHeadline(fontSize: 36, centered: true)
            .animate(delay: Duration(milliseconds: initDelay))
            .fadeIn(duration: 800.ms, curve: Curves.easeOut)
            .slideY(begin: 0.15, curve: Curves.easeOutCubic),
        const SizedBox(height: 8),
        _buildSubheading(centered: true, compact: true)
            .animate(delay: Duration(milliseconds: initDelay + 300))
            .fadeIn(duration: 600.ms, curve: Curves.easeOut),
        const SizedBox(height: 16),
        LaptopMockup(size: size, compact: true)
            .animate(delay: Duration(milliseconds: initDelay + 500))
            .fadeIn(duration: 1000.ms, curve: Curves.easeOut)
            .scale(begin: const Offset(0.92, 0.92), curve: Curves.easeOutCubic),
        const SizedBox(height: 12),
        _buildTrustSignals(centered: true, compact: true)
            .animate(delay: Duration(milliseconds: initDelay + 900))
            .fadeIn(duration: 600.ms, curve: Curves.easeOut),
        const SizedBox(height: 16),
        _buildCompactCTAs()
            .animate(delay: Duration(milliseconds: initDelay + 1100))
            .fadeIn(duration: 600.ms, curve: Curves.easeOut)
            .slideY(begin: 0.1, curve: Curves.easeOut),
        const SizedBox(height: 20),
      ],
    );
  }

  // ============================================
  // HEADLINE & SUBHEADING
  // ============================================

  Widget _buildHeadline({required double fontSize, bool centered = false}) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // Scale down font on very narrow screens
        final scaledFontSize = constraints.maxWidth < 350 
            ? fontSize * 0.8 
            : (constraints.maxWidth < 500 ? fontSize * 0.9 : fontSize);
        
        return Column(
          crossAxisAlignment: centered ? CrossAxisAlignment.center : CrossAxisAlignment.start,
          children: [
            FittedBox(
              fit: BoxFit.scaleDown,
              child: Text(
                'Stop Renting.',
                textAlign: centered ? TextAlign.center : TextAlign.left,
                style: TextStyle(
                  fontSize: scaledFontSize,
                  fontWeight: FontWeight.w800,
                  height: 1.1,
                  letterSpacing: -2,
                  color: const Color(0xFF0F172A),
                ),
              ),
            ).animate().fadeIn(duration: 600.ms).slideY(begin: 0.2, curve: Curves.easeOut),
            FittedBox(
              fit: BoxFit.scaleDown,
              child: ShaderMask(
                blendMode: BlendMode.srcIn,
                shaderCallback: (bounds) => const LinearGradient(
                  colors: [Color(0xFF8B5CF6), Color(0xFF7C3AED), Color(0xFFEC4899)],
                ).createShader(Rect.fromLTWH(0, 0, bounds.width, bounds.height)),
                child: Text(
                  'Start Owning.',
                  textAlign: centered ? TextAlign.center : TextAlign.left,
                  style: TextStyle(
                    fontSize: scaledFontSize,
                    fontWeight: FontWeight.w800,
                    height: 1.1,
                    letterSpacing: -2,
                  ),
                ),
              ),
            ).animate(delay: 200.ms).fadeIn(duration: 600.ms).slideY(begin: 0.2, curve: Curves.easeOut),
            SizedBox(height: centered ? 12 : 18),
            Text(
              'Your Store. Your Customers. Your Data.',
              textAlign: centered ? TextAlign.center : TextAlign.left,
              style: TextStyle(
                fontSize: scaledFontSize * 0.35,
                fontWeight: FontWeight.w600,
                height: 1.2,
                letterSpacing: -0.5,
                color: const Color(0xFF64748B),
              ),
            ).animate(delay: 400.ms).fadeIn(duration: 500.ms),
          ],
        );
      },
    );
  }

  Widget _buildSubheading({double? maxWidth, bool centered = false, bool compact = false}) {
    return SizedBox(
      width: maxWidth, 
      child: Text(
        'Break free from marketplace fees and restrictions. Build a store that\'s truly yours.', 
        textAlign: centered ? TextAlign.center : TextAlign.left, 
        style: TextStyle(
          fontSize: compact ? 15 : 18, 
          color: const Color(0xFF64748B), 
          height: 1.5,
        ),
      ),
    );
  }

  // ============================================
  // CTA BUTTONS
  // ============================================

  Widget _buildBottomCTAs({bool stacked = false}) {
    final p = ShimmerButton(text: 'Create Your Store', onPressed: onGetStarted, icon: Icons.arrow_forward_rounded);
    final s = ShimmerButton(text: 'See How It Works', onPressed: () {}, isPrimary: false, icon: Icons.play_arrow_rounded);
    return stacked 
        ? Column(children: [SizedBox(width: double.infinity, child: p), const SizedBox(height: 12), SizedBox(width: double.infinity, child: s)]) 
        : Row(mainAxisAlignment: MainAxisAlignment.center, children: [p, const SizedBox(width: 16), s]);
  }

  Widget _buildCompactCTAs() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        GestureDetector(
          onTap: onGetStarted,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF8B5CF6), Color(0xFF7C3AED)]),
              borderRadius: BorderRadius.circular(30),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF8B5CF6).withValues(alpha: 0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('Create Your Store', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
                SizedBox(width: 6),
                Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 16),
              ],
            ),
          ),
        ),
        const SizedBox(width: 12),
        GestureDetector(
          onTap: () {},
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(30),
              border: Border.all(color: const Color(0xFFE5E7EB)),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.04),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text('How It Works', style: TextStyle(color: Color(0xFF374151), fontWeight: FontWeight.w600, fontSize: 13)),
                SizedBox(width: 4),
                Icon(Icons.play_arrow_rounded, color: Color(0xFF8B5CF6), size: 16),
              ],
            ),
          ),
        ),
      ],
    );
  }

  // ============================================
  // TRUST SIGNALS
  // ============================================

  Widget _buildTrustSignals({bool centered = false, bool compact = false}) {
    return Wrap(
      alignment: centered ? WrapAlignment.center : WrapAlignment.start, 
      spacing: compact ? 16 : 24, 
      runSpacing: compact ? 8 : 12, 
      children: [
        _buildTrustItem(Icons.check_circle_rounded, 'Free to start', const Color(0xFF10B981), compact: compact),
        _buildTrustItem(Icons.money_off_rounded, 'No commission', const Color(0xFF8B5CF6), compact: compact),
        _buildTrustItem(Icons.phone_android_rounded, 'Mobile-first', const Color(0xFF8B5CF6), compact: compact),
      ],
    );
  }

  Widget _buildTrustItem(IconData icon, String text, Color c, {bool compact = false}) {
    return Row(
      mainAxisSize: MainAxisSize.min, 
      children: [
        Container(
          padding: EdgeInsets.all(compact ? 4 : 5), 
          decoration: BoxDecoration(
            color: c.withValues(alpha: 0.1), 
            borderRadius: BorderRadius.circular(compact ? 6 : 8),
          ), 
          child: Icon(icon, size: compact ? 12 : 16, color: c),
        ),
        SizedBox(width: compact ? 5 : 8),
        Text(
          text, 
          style: TextStyle(
            fontSize: compact ? 11 : 14, 
            color: const Color(0xFF475569), 
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildTrustElements() {
    return Wrap(
      alignment: WrapAlignment.center,
      spacing: 32,
      runSpacing: 16,
      children: [
        _buildTrustBadge('500+', 'Indian Sellers'),
        _buildTrustBadge('₹2Cr+', 'Processed'),
        Row(
          mainAxisSize: MainAxisSize.min, 
          children: [
            Container(height: 24, width: 1, color: const Color(0xFFE5E7EB)),
            const SizedBox(width: 24),
            Text('Powered by ', style: TextStyle(fontSize: 12, color: Colors.grey[500])),
            const Text('Razorpay', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
            Text(' • ', style: TextStyle(fontSize: 12, color: Colors.grey[400])),
            const Text('Shiprocket', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF0F172A))),
          ],
        ),
      ],
    );
  }

  Widget _buildTrustBadge(String value, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min, 
      children: [
        Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF8B5CF6))),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(fontSize: 13, color: Colors.grey[600])),
      ],
    );
  }
}
