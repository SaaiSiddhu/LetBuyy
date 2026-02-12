import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

class FooterSection extends StatefulWidget {
  final bool isMobile;
  const FooterSection({super.key, this.isMobile = false});

  @override
  State<FooterSection> createState() => _FooterSectionState();
}

class _FooterSectionState extends State<FooterSection> {
  int _hoveredLink = -1;
  int _hoveredSocial = -1;

  // Landing page theme colors
  static const _primaryPurple = Color(0xFF6366F1);
  static const _secondaryPurple = Color(0xFF8B5CF6);
  static const _accentPink = Color(0xFFEC4899);
  static const _textMuted = Color(0xFF94A3B8);

  static const _quickLinks = ['Features', 'Pricing', 'FAQ', 'Blog', 'Contact'];
  static const _legalLinks = ['Privacy', 'Terms', 'Cookies'];

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final isMobile = widget.isMobile || screenWidth < 768;

    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
        ),
      ),
      child: Column(
        children: [
          // Main footer
          Padding(
            padding: EdgeInsets.symmetric(
              vertical: isMobile ? 40 : 50,
              horizontal: isMobile ? 20 : 60,
            ),
            child: isMobile ? _buildMobileLayout() : _buildDesktopLayout(),
          ),
          // Bottom bar
          _buildBottomBar(isMobile),
        ],
      ),
    );
  }

  Widget _buildDesktopLayout() {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Brand
        Expanded(flex: 3, child: _buildBrand()),
        const SizedBox(width: 60),
        // Quick links
        Expanded(flex: 2, child: _buildQuickLinks()),
        // Social + App
        Expanded(flex: 2, child: _buildSocialColumn()),
      ],
    );
  }

  Widget _buildMobileLayout() {
    return Column(
      children: [
        _buildBrand(centered: true),
        const SizedBox(height: 32),
        _buildQuickLinks(centered: true),
        const SizedBox(height: 32),
        _buildSocialColumn(centered: true),
      ],
    );
  }

  Widget _buildBrand({bool centered = false}) {
    return Column(
      crossAxisAlignment: centered ? CrossAxisAlignment.center : CrossAxisAlignment.start,
      children: [
        // Logo with app icon
        Row(
          mainAxisSize: centered ? MainAxisSize.min : MainAxisSize.max,
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                gradient: const LinearGradient(colors: [_primaryPurple, _secondaryPurple]),
                borderRadius: BorderRadius.circular(12),
                boxShadow: [BoxShadow(color: _primaryPurple.withValues(alpha: 0.4), blurRadius: 16, offset: const Offset(0, 6))],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: Image.asset(
                  'assets/icons/app_icon.png',
                  width: 28,
                  height: 28,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const Icon(Icons.store_rounded, color: Colors.white, size: 24),
                ),
              ),
            ),
            const SizedBox(width: 12),
            const Text(
              'LetBuyy',
              style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800, letterSpacing: -0.5),
            ),
          ],
        ).animate().fadeIn(duration: 400.ms),
        const SizedBox(height: 16),
        // Tagline
        Text(
          'The modern commerce platform for Indian sellers.',
          textAlign: centered ? TextAlign.center : TextAlign.left,
          style: TextStyle(color: _textMuted, fontSize: 14, height: 1.5),
        ).animate(delay: 100.ms).fadeIn(),
      ],
    );
  }

  Widget _buildQuickLinks({bool centered = false}) {
    return Column(
      crossAxisAlignment: centered ? CrossAxisAlignment.center : CrossAxisAlignment.start,
      children: [
        Text(
          'Quick Links',
          style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 13, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 16),
        Wrap(
          spacing: 20,
          runSpacing: 12,
          alignment: centered ? WrapAlignment.center : WrapAlignment.start,
          children: _quickLinks.asMap().entries.map((entry) {
            final index = entry.key;
            final link = entry.value;
            final isHovered = _hoveredLink == index;

            return MouseRegion(
              onEnter: (_) => setState(() => _hoveredLink = index),
              onExit: (_) => setState(() => _hoveredLink = -1),
              cursor: SystemMouseCursors.click,
              child: AnimatedDefaultTextStyle(
                duration: const Duration(milliseconds: 150),
                style: TextStyle(
                  color: isHovered ? _secondaryPurple : _textMuted,
                  fontSize: 13,
                  fontWeight: isHovered ? FontWeight.w600 : FontWeight.w400,
                ),
                child: Text(link),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildSocialColumn({bool centered = false}) {
    return Column(
      crossAxisAlignment: centered ? CrossAxisAlignment.center : CrossAxisAlignment.start,
      children: [
        Text(
          'Connect',
          style: TextStyle(color: Colors.white.withValues(alpha: 0.9), fontSize: 13, fontWeight: FontWeight.w700),
        ),
        const SizedBox(height: 16),
        // Social icons
        Row(
          mainAxisSize: centered ? MainAxisSize.min : MainAxisSize.max,
          children: [
            _buildSocialIcon(Icons.language, 0),
            _buildSocialIcon(Icons.facebook_outlined, 1),
            _buildSocialIcon(Icons.camera_alt_outlined, 2),
            _buildSocialIcon(Icons.code, 3),
          ],
        ),
        const SizedBox(height: 20),
        // App badges
        Row(
          mainAxisSize: centered ? MainAxisSize.min : MainAxisSize.max,
          children: [
            _buildAppBadge('App Store', Icons.apple),
            const SizedBox(width: 10),
            _buildAppBadge('Play Store', Icons.android),
          ],
        ),
      ],
    );
  }

  Widget _buildSocialIcon(IconData icon, int index) {
    final isHovered = _hoveredSocial == index;
    
    return MouseRegion(
      onEnter: (_) => setState(() => _hoveredSocial = index),
      onExit: (_) => setState(() => _hoveredSocial = -1),
      cursor: SystemMouseCursors.click,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 150),
        margin: const EdgeInsets.only(right: 10),
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          gradient: isHovered ? const LinearGradient(colors: [_primaryPurple, _secondaryPurple]) : null,
          color: isHovered ? null : Colors.white.withValues(alpha: 0.08),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: isHovered ? Colors.transparent : Colors.white.withValues(alpha: 0.1)),
        ),
        child: Icon(icon, color: Colors.white.withValues(alpha: isHovered ? 1 : 0.6), size: 16),
      ),
    );
  }

  Widget _buildAppBadge(String store, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white.withValues(alpha: 0.8), size: 16),
          const SizedBox(width: 8),
          Text(store, style: TextStyle(color: Colors.white.withValues(alpha: 0.8), fontSize: 11, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildBottomBar(bool isMobile) {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.symmetric(vertical: 20, horizontal: isMobile ? 20 : 60),
      decoration: BoxDecoration(
        border: Border(top: BorderSide(color: Colors.white.withValues(alpha: 0.06))),
      ),
      child: isMobile
          ? Column(
              children: [
                _buildCopyright(),
                const SizedBox(height: 12),
                _buildLegalLinksRow(),
              ],
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildCopyright(),
                _buildLegalLinksRow(),
              ],
            ),
    );
  }

  Widget _buildCopyright() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          '© 2025 LetBuyy · Made with ',
          style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12),
        ),
        const Icon(Icons.favorite_rounded, color: _accentPink, size: 12),
        Text(
          ' in India',
          style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12),
        ),
      ],
    );
  }

  Widget _buildLegalLinksRow() {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: _legalLinks.map((link) {
        return Padding(
          padding: const EdgeInsets.only(left: 16),
          child: Text(
            link,
            style: TextStyle(color: Colors.white.withValues(alpha: 0.4), fontSize: 12),
          ),
        );
      }).toList(),
    );
  }
}
