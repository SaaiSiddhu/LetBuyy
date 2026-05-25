import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import '../../data/landing_content.dart';

class TestimonialsSection extends StatefulWidget {
  final bool isMobile;
  const TestimonialsSection({super.key, required this.isMobile});

  @override
  State<TestimonialsSection> createState() => _TestimonialsSectionState();
}

class _TestimonialsSectionState extends State<TestimonialsSection> {
  final PageController _pageController = PageController(viewportFraction: 0.88);
  int _currentPage = 0;

  // Landing page theme colors
  static const _primaryPurple = Color(0xFF6366F1);
  static const _secondaryPurple = Color(0xFF8B5CF6);
  static const _accentPink = Color(0xFFEC4899);
  static const _accentGreen = Color(0xFF10B981);
  static const _textDark = Color(0xFF0F172A);
  static const _textMuted = Color(0xFF64748B);
  static const _borderLight = Color(0xFFE5E7EB);

  @override
  void dispose() {
    _pageController.dispose();
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
          SizedBox(height: widget.isMobile ? 28 : 36),
          _buildTestimonialCarousel(),
          const SizedBox(height: 24),
          _buildIndicators(),
          SizedBox(height: widget.isMobile ? 32 : 40),
          _buildTrustStats(),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: widget.isMobile ? 8 : 20),
      child: Column(
        children: [
          // Badge
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [_accentPink.withValues(alpha: 0.1), _secondaryPurple.withValues(alpha: 0.05)],
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: _accentPink.withValues(alpha: 0.2)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.favorite_rounded, size: 12, color: _accentPink),
                const SizedBox(width: 8),
                Text('Testimonials', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: _accentPink)),
              ],
            ),
          ).animate().fadeIn(duration: 400.ms).scale(begin: const Offset(0.95, 0.95)),
          const SizedBox(height: 16),
          // Title
          Text(
            'Loved by Sellers',
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
            'See what our community has to say',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: widget.isMobile ? 14 : 16, color: _textMuted),
          ).animate().fadeIn(duration: 400.ms, delay: 200.ms),
        ],
      ),
    );
  }

  Widget _buildTestimonialCarousel() {
    final testimonials = LandingContent.testimonials;
    
    return SizedBox(
      height: widget.isMobile ? 260 : 220,
      child: PageView.builder(
        controller: _pageController,
        onPageChanged: (index) => setState(() => _currentPage = index),
        itemCount: testimonials.length,
        itemBuilder: (context, index) {
          final t = testimonials[index];
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
                    child: _buildTestimonialCard(t, index),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildTestimonialCard(Map<String, dynamic> t, int index) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      padding: EdgeInsets.all(widget.isMobile ? 20 : 28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _borderLight),
        boxShadow: [
          BoxShadow(color: _secondaryPurple.withValues(alpha: 0.08), blurRadius: 24, offset: const Offset(0, 10)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Top row: Avatar + Name + Stars
          Row(
            children: [
              // Avatar
              Container(
                padding: const EdgeInsets.all(2),
                decoration: BoxDecoration(
                  gradient: LinearGradient(colors: [_secondaryPurple, _accentPink]),
                  shape: BoxShape.circle,
                ),
                child: CircleAvatar(
                  radius: widget.isMobile ? 20 : 24,
                  backgroundColor: Colors.white,
                  child: CircleAvatar(
                    radius: widget.isMobile ? 18 : 22,
                    backgroundImage: NetworkImage(t['image']),
                    onBackgroundImageError: (_, __) {},
                    backgroundColor: Colors.grey[200],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // Name and role
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(t['name'], style: TextStyle(fontSize: widget.isMobile ? 14 : 16, fontWeight: FontWeight.w700, color: _textDark)),
                    Row(
                      children: [
                        Icon(Icons.verified_rounded, size: 12, color: _accentGreen),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(t['role'], style: TextStyle(fontSize: widget.isMobile ? 11 : 13, color: _textMuted), overflow: TextOverflow.ellipsis),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              // Stars
              Row(
                children: List.generate(5, (i) => Icon(Icons.star_rounded, size: widget.isMobile ? 14 : 16, color: const Color(0xFFFBBF24))),
              ),
            ],
          ),
          SizedBox(height: widget.isMobile ? 16 : 20),
          // Quote
          Expanded(
            child: Text(
              '"${t['quote']}"',
              style: TextStyle(
                fontSize: widget.isMobile ? 14 : 16,
                color: const Color(0xFF334155),
                height: 1.6,
                fontStyle: FontStyle.italic,
              ),
              maxLines: widget.isMobile ? 4 : 3,
              overflow: TextOverflow.ellipsis,
            ),
          ),
          const SizedBox(height: 12),
          // Quote mark
          Icon(Icons.format_quote_rounded, size: 20, color: _secondaryPurple.withValues(alpha: 0.3)),
        ],
      ),
    );
  }

  Widget _buildIndicators() {
    final testimonials = LandingContent.testimonials;
    
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(testimonials.length, (index) {
        final isActive = index == _currentPage;
        
        return GestureDetector(
          onTap: () => _pageController.animateToPage(index, duration: 300.ms, curve: Curves.easeOut),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            margin: const EdgeInsets.symmetric(horizontal: 4),
            width: isActive ? 24 : 8,
            height: 8,
            decoration: BoxDecoration(
              gradient: isActive ? LinearGradient(colors: [_secondaryPurple, _accentPink]) : null,
              color: isActive ? null : const Color(0xFFE2E8F0),
              borderRadius: BorderRadius.circular(4),
              boxShadow: isActive ? [BoxShadow(color: _secondaryPurple.withValues(alpha: 0.3), blurRadius: 6, offset: const Offset(0, 2))] : null,
            ),
          ),
        );
      }),
    );
  }

  Widget _buildTrustStats() {
    return Container(
      padding: EdgeInsets.all(widget.isMobile ? 20 : 28),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: _borderLight),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.03), blurRadius: 15)],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          _buildStatItem('10,000+', 'Happy Sellers', _primaryPurple),
          _buildDivider(),
          _buildStatItem('4.9/5', 'Rating', const Color(0xFFF59E0B)),
          _buildDivider(),
          _buildStatItem('₹50Cr+', 'Revenue', _accentGreen),
        ],
      ),
    ).animate(delay: 400.ms).fadeIn(duration: 500.ms).slideY(begin: 0.05);
  }

  Widget _buildDivider() {
    return Container(width: 1, height: 40, color: _borderLight);
  }

  Widget _buildStatItem(String value, String label, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: widget.isMobile ? 20 : 28,
            fontWeight: FontWeight.w800,
            color: color,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(fontSize: widget.isMobile ? 11 : 13, color: _textMuted, fontWeight: FontWeight.w500),
        ),
      ],
    );
  }
}
