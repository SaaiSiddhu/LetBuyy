import 'package:flutter/material.dart';
import '../../app/routes.dart';

// Critical above-the-fold components (load immediately)
import 'widgets/components/floating_nav_bar.dart';
import 'widgets/sections/hero_section.dart';

// Below-fold sections are still imported but built lazily
import 'widgets/components/mesh_background.dart';
import 'widgets/sections/marquee_section.dart';
import 'widgets/sections/bento_features.dart';
import 'widgets/sections/how_it_works_section.dart';
import 'widgets/sections/comparison_section.dart';
import 'widgets/sections/pricing_section.dart';
import 'widgets/sections/testimonials_section.dart';
import 'widgets/sections/cta_section.dart';
import 'widgets/sections/footer_section.dart';

class LandingScreen extends StatefulWidget {
  const LandingScreen({super.key});

  @override
  State<LandingScreen> createState() => _LandingScreenState();
}

class _LandingScreenState extends State<LandingScreen> {
  final ScrollController _scrollController = ScrollController();
  
  // Track if below-fold content should render
  bool _renderBelowFold = false;

  @override
  void initState() {
    super.initState();
    // Defer below-fold rendering to after first frame
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        setState(() => _renderBelowFold = true);
      }
    });
  }

  void _scrollToSection(double offset) {
    _scrollController.animateTo(
      offset, 
      duration: const Duration(milliseconds: 600), 
      curve: Curves.easeOutCubic,
    );
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          final height = constraints.maxHeight;
          final isMobile = width < 768;
          
          return Stack(
            children: [
              // 1. Simple gradient background - fills entire screen
              Positioned.fill(
                child: Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFFF8FAFF), Color(0xFFEEF2FF), Color(0xFFFAF5FF)],
                    ),
                  ),
                ),
              ),
              
              // 2. Animated background (deferred)
              if (_renderBelowFold)
                const Positioned.fill(child: AnimatedMeshBackground()),

              // 3. Scrollable Content - use a simple structure
              CustomScrollView(
                controller: _scrollController,
                slivers: [
                  // Main content - all sections
                  SliverToBoxAdapter(
                    child: Container(
                      width: width, // Takes full viewport width
                      alignment: Alignment.topCenter,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 1400),
                        child: Column(
                          children: [
                            HeroSection(
                              isMobile: isMobile,
                              onGetStarted: () => Navigator.pushNamed(context, AppRoutes.login),
                            ),
                            if (_renderBelowFold) ...[
                              MarqueeSection(isMobile: isMobile),
                              BentoFeaturesSection(isMobile: isMobile),
                              HowItWorksSection(isMobile: isMobile),
                              ComparisonSection(isMobile: isMobile),
                              PricingSection(isMobile: isMobile),
                              TestimonialsSection(isMobile: isMobile),
                              CTASection(isMobile: isMobile),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ),
                  if (_renderBelowFold) ...[
                    SliverToBoxAdapter(child: FooterSection()),
                  ] else
                    // Placeholder while below-fold loads
                    const SliverToBoxAdapter(
                      child: SizedBox(height: 500),
                    ),
                ],
              ),

              // 4. Floating Navigation (always visible at top)
              Positioned(
                top: 0,
                left: 0,
                right: 0,
                child: SafeArea(
                  child: Center(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 1400),
                      child: FloatingNavBar(
                        scrollController: _scrollController,
                        isMobile: isMobile,
                        onGetStarted: () => Navigator.pushNamed(context, AppRoutes.login),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

/// Grid pattern painter for unified background
class _GridPatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFFE2E8F0).withValues(alpha: 0.3)
      ..strokeWidth = 0.5;
    const spacing = 40.0;
    for (double x = 0; x < size.width; x += spacing) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += spacing) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
