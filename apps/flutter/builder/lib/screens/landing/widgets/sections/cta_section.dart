import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class CTASection extends StatefulWidget {
  final bool isMobile;
  const CTASection({super.key, required this.isMobile});

  @override
  State<CTASection> createState() => _CTASectionState();
}

class _CTASectionState extends State<CTASection> with SingleTickerProviderStateMixin {
  late AnimationController _shimmerController;

  // Landing page theme colors
  static const _primaryPurple = Color(0xFF6366F1);
  static const _secondaryPurple = Color(0xFF8B5CF6);
  static const _accentPink = Color(0xFFEC4899);
  static const _accentGreen = Color(0xFF10B981);

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
        horizontal: widget.isMobile ? 16 : 60,
      ),
      // Transparent - unified background shows through from LandingScreen
      child: Container(
        padding: EdgeInsets.all(widget.isMobile ? 28 : 48),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [_primaryPurple, _secondaryPurple, _accentPink],
          ),
          borderRadius: BorderRadius.circular(24),
          boxShadow: [
            BoxShadow(color: _primaryPurple.withValues(alpha: 0.3), blurRadius: 40, offset: const Offset(0, 20)),
          ],
        ),
        child: Stack(
          children: [
            // Decorative elements
            Positioned(
              top: -30,
              right: -30,
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.08),
                ),
              ),
            ),
            Positioned(
              bottom: -40,
              left: -40,
              child: Container(
                width: 150,
                height: 150,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.06),
                ),
              ),
            ),
            // Content
            widget.isMobile ? _buildMobileLayout() : _buildDesktopLayout(),
          ],
        ),
      ),
    ).animate().fadeIn(duration: 500.ms).slideY(begin: 0.05);
  }

  Widget _buildDesktopLayout() {
    return Row(
      children: [
        // Left: Text content
        Expanded(
          flex: 3,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Badge
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 6,
                      height: 6,
                      decoration: BoxDecoration(
                        color: _accentGreen,
                        shape: BoxShape.circle,
                        boxShadow: [BoxShadow(color: _accentGreen.withValues(alpha: 0.5), blurRadius: 6)],
                      ),
                    ),
                    const SizedBox(width: 8),
                    const Text('10,000+ active sellers', style: TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              // Title
              const Text(
                'Ready to Start Selling?',
                style: TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                  letterSpacing: -1,
                  height: 1.1,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'Launch your store in under 5 minutes. Free forever.',
                style: TextStyle(fontSize: 16, color: Colors.white.withValues(alpha: 0.85), height: 1.5),
              ),
              const SizedBox(height: 20),
              // Trust items
              Wrap(
                spacing: 20,
                runSpacing: 10,
                children: [
                  _buildTrustItem(Icons.check_circle_rounded, 'No credit card'),
                  _buildTrustItem(Icons.lock_rounded, 'Secure'),
                  _buildTrustItem(Icons.support_agent_rounded, '24/7 support'),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(width: 40),
        // Right: CTA button
        _buildCTAButton(),
      ],
    );
  }

  Widget _buildMobileLayout() {
    return Column(
      children: [
        // Badge
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.15),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: _accentGreen,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              const Text('10,000+ sellers', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w600)),
            ],
          ),
        ),
        const SizedBox(height: 20),
        // Title
        const Text(
          'Ready to Start Selling?',
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 26,
            fontWeight: FontWeight.w800,
            color: Colors.white,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          'Launch your store in under 5 minutes',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 14, color: Colors.white.withValues(alpha: 0.85)),
        ),
        const SizedBox(height: 24),
        // CTA
        _buildCTAButton(),
        const SizedBox(height: 20),
        // Trust items
        Wrap(
          alignment: WrapAlignment.center,
          spacing: 16,
          runSpacing: 10,
          children: [
            _buildTrustItem(Icons.check_circle_rounded, 'Free'),
            _buildTrustItem(Icons.lock_rounded, 'Secure'),
            _buildTrustItem(Icons.support_agent_rounded, '24/7'),
          ],
        ),
      ],
    );
  }

  Widget _buildCTAButton() {
    return AnimatedBuilder(
      animation: _shimmerController,
      builder: (context, child) {
        return Container(
          padding: EdgeInsets.symmetric(
            horizontal: widget.isMobile ? 28 : 36,
            vertical: widget.isMobile ? 16 : 18,
          ),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(14),
            boxShadow: [
              BoxShadow(color: Colors.white.withValues(alpha: 0.25), blurRadius: 20, offset: const Offset(0, 8)),
            ],
          ),
          child: Stack(
            children: [
              // Shimmer
              Positioned.fill(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(14),
                  child: Transform.translate(
                    offset: Offset((_shimmerController.value - 0.5) * 300, 0),
                    child: Container(
                      width: 80,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [Colors.transparent, _primaryPurple.withValues(alpha: 0.1), Colors.transparent],
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ShaderMask(
                    blendMode: BlendMode.srcIn,
                    shaderCallback: (bounds) => const LinearGradient(
                      colors: [_primaryPurple, _secondaryPurple],
                    ).createShader(bounds),
                    child: Text(
                      'Get Started Free',
                      style: TextStyle(
                        fontSize: widget.isMobile ? 15 : 17,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  const Icon(Icons.arrow_forward_rounded, color: _primaryPurple, size: 20),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildTrustItem(IconData icon, String text) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: Colors.white.withValues(alpha: 0.9), size: 14),
        const SizedBox(width: 6),
        Text(text, style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 12, fontWeight: FontWeight.w500)),
      ],
    );
  }
}
