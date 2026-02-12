import 'dart:ui';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

/// Ultra-Premium Floating Navigation Bar
/// Features: Animated gradient border, glassmorphism, morphing animations,
/// hover effects, scroll-reactive design, and premium micro-interactions
class FloatingNavBar extends StatefulWidget {
  final bool isMobile;
  final VoidCallback onGetStarted;
  final ScrollController scrollController;

  const FloatingNavBar({
    super.key,
    required this.isMobile,
    required this.onGetStarted,
    required this.scrollController,
  });

  @override
  State<FloatingNavBar> createState() => _FloatingNavBarState();
}

class _FloatingNavBarState extends State<FloatingNavBar>
    with TickerProviderStateMixin {
  bool _isScrolled = false;
  bool _isHovered = false;
  bool _isButtonHovered = false;
  
  late AnimationController _gradientController;
  late AnimationController _pulseController;
  late AnimationController _glowController;

  @override
  void initState() {
    super.initState();
    widget.scrollController.addListener(_onScroll);
    
    // Animated gradient border controller
    _gradientController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
    
    // Pulse animation for the logo
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
    
    // Glow animation for CTA button
    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    widget.scrollController.removeListener(_onScroll);
    _gradientController.dispose();
    _pulseController.dispose();
    _glowController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!mounted) return;
    final scrolled = widget.scrollController.offset > 50;
    if (scrolled != _isScrolled) {
      setState(() => _isScrolled = scrolled);
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 400),
      curve: Curves.easeOutCubic,
      padding: EdgeInsets.symmetric(
        horizontal: _isScrolled ? (widget.isMobile ? 12 : 24) : 0,
        vertical: _isScrolled ? 14 : 0,
      ),
      child: Center(
        child: MouseRegion(
          onEnter: (_) => setState(() => _isHovered = true),
          onExit: (_) => setState(() => _isHovered = false),
          child: AnimatedBuilder(
            animation: _gradientController,
            builder: (context, child) {
              return Container(
                constraints: const BoxConstraints(maxWidth: 1200),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(_isScrolled ? 100 : 0),
                  gradient: _isScrolled ? _buildAnimatedBorderGradient() : null,
                  boxShadow: _isScrolled ? [
                    // Multi-layer shadow for depth
                    BoxShadow(
                      color: const Color(0xFF6366F1).withValues(alpha: _isHovered ? 0.25 : 0.12),
                      blurRadius: _isHovered ? 40 : 24,
                      offset: const Offset(0, 12),
                      spreadRadius: -4,
                    ),
                    BoxShadow(
                      color: const Color(0xFF8B5CF6).withValues(alpha: _isHovered ? 0.15 : 0.08),
                      blurRadius: _isHovered ? 60 : 40,
                      offset: const Offset(0, 20),
                    ),
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ] : [],
                ),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  margin: EdgeInsets.all(_isScrolled ? 1.5 : 0),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(_isScrolled ? 100 : 0),
                    color: _isScrolled 
                        ? Colors.white.withValues(alpha: _isHovered ? 0.98 : 0.92) 
                        : Colors.transparent,
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(_isScrolled ? 100 : 0),
                    child: BackdropFilter(
                      filter: ImageFilter.blur(
                        sigmaX: _isScrolled ? 20 : 0, 
                        sigmaY: _isScrolled ? 20 : 0,
                      ),
                      child: Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: widget.isMobile ? 18 : 32,
                          vertical: widget.isMobile ? 14 : 18,
                        ),
                        child: Row(
                          children: [
                            _buildPremiumLogo(),
                            const Spacer(),
                            if (!widget.isMobile) _buildNavLinks(),
                            if (!widget.isMobile) const SizedBox(width: 32),
                            _buildPremiumCTAButton(),
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    ).animate().fadeIn(duration: 600.ms).slideY(begin: -0.3, curve: Curves.easeOutCubic);
  }

  /// Creates an animated gradient border that rotates around the navbar
  LinearGradient _buildAnimatedBorderGradient() {
    final angle = _gradientController.value * 2 * math.pi;
    return LinearGradient(
      begin: Alignment(math.cos(angle), math.sin(angle)),
      end: Alignment(math.cos(angle + math.pi), math.sin(angle + math.pi)),
      colors: const [
        Color(0xFF6366F1),
        Color(0xFF8B5CF6),
        Color(0xFFEC4899),
        Color(0xFF8B5CF6),
        Color(0xFF6366F1),
      ],
      stops: const [0.0, 0.25, 0.5, 0.75, 1.0],
    );
  }

  Widget _buildPremiumLogo() {
    return AnimatedBuilder(
      animation: _pulseController,
      builder: (context, child) {
        final pulseValue = 0.95 + (_pulseController.value * 0.05);
        return MouseRegion(
          cursor: SystemMouseCursors.click,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Animated Logo Container with glow
              Transform.scale(
                scale: pulseValue,
                child: Container(
                  width: widget.isMobile ? 44 : 52,
                  height: widget.isMobile ? 44 : 52,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(14),
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        Color(0xFF6366F1),
                        Color(0xFF8B5CF6),
                        Color(0xFFA855F7),
                      ],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF6366F1).withValues(alpha: 0.4 + (_pulseController.value * 0.2)),
                        blurRadius: 16 + (_pulseController.value * 8),
                        offset: const Offset(0, 6),
                      ),
                      BoxShadow(
                        color: const Color(0xFF8B5CF6).withValues(alpha: 0.2),
                        blurRadius: 24,
                        offset: const Offset(0, 12),
                      ),
                    ],
                  ),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Animated rings
                      ...List.generate(2, (i) {
                        return AnimatedBuilder(
                          animation: _pulseController,
                          builder: (context, _) {
                            final ringScale = 1.0 + (i * 0.15) + (_pulseController.value * 0.1);
                            return Transform.scale(
                              scale: ringScale,
                              child: Container(
                                width: widget.isMobile ? 44 : 52,
                                height: widget.isMobile ? 44 : 52,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.15 - (i * 0.05)),
                                    width: 1.5,
                                  ),
                                ),
                              ),
                            );
                          },
                        );
                      }),
                      // App Icon Image with shine effect
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: Image.asset(
                          'assets/icons/app_icon.png',
                          width: widget.isMobile ? 36 : 42,
                          height: widget.isMobile ? 36 : 42,
                          fit: BoxFit.cover,
                          errorBuilder: (context, error, stackTrace) {
                            // Fallback to icon if image fails
                            return ShaderMask(
                              shaderCallback: (bounds) => LinearGradient(
                                begin: Alignment(-1 + (_pulseController.value * 2), -1),
                                end: Alignment(1 + (_pulseController.value * 2), 1),
                                colors: const [
                                  Colors.white,
                                  Color(0xFFE0E7FF),
                                  Colors.white,
                                ],
                              ).createShader(bounds),
                              child: Icon(
                                Icons.store_rounded,
                                color: Colors.white,
                                size: widget.isMobile ? 24 : 28,
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 14),
              // Animated Brand Name
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  ShaderMask(
                    shaderCallback: (bounds) => const LinearGradient(
                      colors: [
                        Color(0xFF0F172A),
                        Color(0xFF334155),
                        Color(0xFF0F172A),
                      ],
                    ).createShader(bounds),
                    child: Text(
                      'LetBuyy',
                      style: TextStyle(
                        fontFamily: 'Urbanist',
                        fontWeight: FontWeight.w900,
                        fontSize: widget.isMobile ? 20 : 26,
                        letterSpacing: -1,
                        color: Colors.white,
                        height: 1.1,
                      ),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          const Color(0xFF6366F1).withValues(alpha: 0.1),
                          const Color(0xFF8B5CF6).withValues(alpha: 0.1),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      'STORE',
                      style: TextStyle(
                        fontFamily: 'Urbanist',
                        fontWeight: FontWeight.w700,
                        fontSize: widget.isMobile ? 9 : 11,
                        letterSpacing: 2,
                        color: const Color(0xFF6366F1),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildNavLinks() {
    final links = ['Features', 'Pricing', 'Testimonials'];
    return Row(
      children: links.map((link) => _NavLinkItem(label: link)).toList(),
    );
  }

  Widget _buildPremiumCTAButton() {
    return MouseRegion(
      onEnter: (_) => setState(() => _isButtonHovered = true),
      onExit: (_) => setState(() => _isButtonHovered = false),
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: widget.onGetStarted,
        child: AnimatedBuilder(
          animation: _glowController,
          builder: (context, child) {
            final glowIntensity = 0.3 + (_glowController.value * 0.2);
            return AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              transform: Matrix4.identity()
                ..translate(0.0, _isButtonHovered ? -2.0 : 0.0)
                ..scale(_isButtonHovered ? 1.02 : 1.0),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(50),
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    const Color(0xFF6366F1),
                    const Color(0xFF8B5CF6),
                    if (_isButtonHovered) const Color(0xFFA855F7),
                  ],
                ),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF6366F1).withValues(alpha: _isButtonHovered ? 0.5 : glowIntensity),
                    blurRadius: _isButtonHovered ? 28 : 20,
                    offset: const Offset(0, 8),
                    spreadRadius: _isButtonHovered ? 2 : 0,
                  ),
                  BoxShadow(
                    color: const Color(0xFF8B5CF6).withValues(alpha: _isButtonHovered ? 0.3 : 0.15),
                    blurRadius: 40,
                    offset: const Offset(0, 16),
                  ),
                ],
              ),
              child: Stack(
                children: [
                  // Shimmer overlay
                  Positioned.fill(
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(50),
                      child: AnimatedBuilder(
                        animation: _gradientController,
                        builder: (context, _) {
                          return ShaderMask(
                            shaderCallback: (bounds) => LinearGradient(
                              begin: Alignment(-2 + (_gradientController.value * 4), 0),
                              end: Alignment(-1 + (_gradientController.value * 4), 0),
                              colors: [
                                Colors.transparent,
                                Colors.white.withValues(alpha: 0.2),
                                Colors.transparent,
                              ],
                            ).createShader(bounds),
                            child: Container(
                              color: Colors.white,
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                  // Button content
                  Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: widget.isMobile ? 20 : 28,
                      vertical: widget.isMobile ? 12 : 16,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          widget.isMobile ? 'Get Started' : 'Create Your Store',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w700,
                            fontSize: widget.isMobile ? 13 : 15,
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(width: 8),
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          transform: Matrix4.identity()
                            ..translate(_isButtonHovered ? 4.0 : 0.0, 0.0),
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Icon(
                              Icons.arrow_forward_rounded,
                              color: Colors.white,
                              size: widget.isMobile ? 14 : 16,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Individual navigation link with hover animation
class _NavLinkItem extends StatefulWidget {
  final String label;
  const _NavLinkItem({required this.label});

  @override
  State<_NavLinkItem> createState() => _NavLinkItemState();
}

class _NavLinkItemState extends State<_NavLinkItem> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      cursor: SystemMouseCursors.click,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            AnimatedDefaultTextStyle(
              duration: const Duration(milliseconds: 200),
              style: TextStyle(
                fontFamily: 'Urbanist',
                fontWeight: _isHovered ? FontWeight.w700 : FontWeight.w500,
                fontSize: 15,
                color: _isHovered ? const Color(0xFF6366F1) : const Color(0xFF475569),
              ),
              child: Text(widget.label),
            ),
            const SizedBox(height: 4),
            AnimatedContainer(
              duration: const Duration(milliseconds: 200),
              height: 2,
              width: _isHovered ? 24 : 0,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF6366F1), Color(0xFF8B5CF6)],
                ),
                borderRadius: BorderRadius.circular(1),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
