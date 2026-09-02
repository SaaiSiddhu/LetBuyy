// lib/screens/user/home/widgets/web_footer.dart
// Premium footer with glassmorphism, gradient styling, and trust badges

import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

class WebFooter extends StatelessWidget {
  const WebFooter({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [
            Color(0xFF0F172A),
            Color(0xFF020617),
          ],
        ),
      ),
      child: Column(
        children: [
          // Trust Badges Section
          _buildTrustBadges(),
          
          // Newsletter Section
          _buildNewsletterSection(),
          
          // Main Footer Links with glassmorphic cards
          _buildMainFooterContent(context),
          
          // Bottom Bar (Copyright)
          _buildBottomBar(),
        ],
      ),
    );
  }

  Widget _buildTrustBadges() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 32),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: Colors.white.withValues(alpha: 0.06),
            width: 1,
          ),
        ),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1400),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 60),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceEvenly,
              children: [
                _buildTrustBadge(
                  icon: Icons.verified_user_rounded,
                  title: 'Secure Payments',
                  subtitle: '256-bit SSL encryption',
                ),
                _buildTrustBadge(
                  icon: Icons.local_shipping_rounded,
                  title: 'Fast Delivery',
                  subtitle: 'Free shipping over ₹499',
                ),
                _buildTrustBadge(
                  icon: Icons.replay_rounded,
                  title: 'Easy Returns',
                  subtitle: '7-day return policy',
                ),
                _buildTrustBadge(
                  icon: Icons.support_agent_rounded,
                  title: '24/7 Support',
                  subtitle: 'Always here to help',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTrustBadge({
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                AppColors.primary.withValues(alpha: 0.2),
                AppColors.primaryLight.withValues(alpha: 0.1),
              ],
            ),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: AppColors.primary.withValues(alpha: 0.3),
              width: 1,
            ),
          ),
          child: Icon(icon, color: AppColors.primaryLight, size: 24),
        ),
        const SizedBox(width: 14),
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              subtitle,
              style: TextStyle(
                color: Colors.white.withValues(alpha: 0.5),
                fontSize: 12,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildNewsletterSection() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 40),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: Colors.white.withValues(alpha: 0.06),
            width: 1,
          ),
        ),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1400),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 60),
            child: Row(
              children: [
                // Left side - Newsletter info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              gradient: AppColors.primaryGradient,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.mail_rounded, color: Colors.white, size: 20),
                          ),
                          const SizedBox(width: 14),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Subscribe to our Newsletter',
                                style: TextStyle(
                                  color: Colors.white,
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              Text(
                                'Get exclusive offers and updates',
                                style: TextStyle(
                                  color: Colors.white.withValues(alpha: 0.6),
                                  fontSize: 13,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                
                // Right side - Email input
                Container(
                  width: 420,
                  height: 52,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.06),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.1),
                      width: 1,
                    ),
                  ),
                  child: Row(
                    children: [
                      const Expanded(
                        child: Padding(
                          padding: EdgeInsets.only(left: 18),
                          child: TextField(
                            style: TextStyle(color: Colors.white, fontSize: 14),
                            decoration: InputDecoration(
                              hintText: 'Enter your email address',
                              hintStyle: TextStyle(color: Colors.white38, fontSize: 14),
                              border: InputBorder.none,
                            ),
                          ),
                        ),
                      ),
                      Container(
                        height: 52,
                        padding: const EdgeInsets.symmetric(horizontal: 24),
                        decoration: BoxDecoration(
                          gradient: AppColors.primaryGradient,
                          borderRadius: const BorderRadius.only(
                            topRight: Radius.circular(11),
                            bottomRight: Radius.circular(11),
                          ),
                        ),
                        child: const Center(
                          child: Text(
                            'Subscribe',
                            style: TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMainFooterContent(BuildContext context) {
    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 1400),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 60, vertical: 48),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildGlassmorphicColumn(
                title: 'Get to Know Us',
                links: ['About Us', 'Careers', 'Blog', 'Seller Stories'],
              ),
              _buildGlassmorphicColumn(
                title: 'Let Us Help You',
                links: ['Your Account', 'Your Orders', 'Shipping & Delivery', 'Returns & Refunds', 'Help Center'],
              ),
              _buildGlassmorphicColumn(
                title: 'Make Money with Us',
                links: ['Sell on LetBuyy', 'Become an Affiliate', 'Advertise Products', 'Partner with Us'],
              ),
              _buildGlassmorphicColumn(
                title: 'Our Policies',
                links: ['Privacy Policy', 'Terms & Conditions', 'Cookie Policy', 'Security'],
              ),
              _buildSocialColumn(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGlassmorphicColumn({required String title, required List<String> links}) {
    return Flexible(
      child: Container(
        padding: const EdgeInsets.all(20),
        margin: const EdgeInsets.only(right: 16),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.06),
            width: 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.3,
              ),
            ),
            const SizedBox(height: 16),
            ...links.map((link) => _buildFooterLink(link)),
          ],
        ),
      ),
    );
  }

  Widget _buildFooterLink(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: _HoverableLink(text: text),
    );
  }

  Widget _buildSocialColumn() {
    return Flexible(
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.06),
            width: 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Connect with Us',
              style: TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                _SocialIconButton(icon: FontAwesomeIcons.facebook),
                _SocialIconButton(icon: FontAwesomeIcons.xTwitter),
                _SocialIconButton(icon: FontAwesomeIcons.instagram),
                _SocialIconButton(icon: FontAwesomeIcons.youtube),
              ],
            ),
            const SizedBox(height: 24),
            const Text(
              'Download Our App',
              style: TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 14),
            Row(
              children: [
                _buildAppStoreButton(
                  icon: Icons.apple,
                  store: 'App Store',
                  subtitle: 'Download on the',
                ),
                const SizedBox(width: 10),
                _buildAppStoreButton(
                  icon: FontAwesomeIcons.googlePlay,
                  store: 'Google Play',
                  subtitle: 'GET IT ON',
                  useFaIcon: true,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAppStoreButton({
    required dynamic icon,
    required String store,
    required String subtitle,
    bool useFaIcon = false,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(
          color: Colors.white.withValues(alpha: 0.15),
          width: 1,
        ),
      ),
      child: Row(
        children: [
          useFaIcon 
              ? FaIcon(icon, color: Colors.white, size: 22)
              : Icon(icon, color: Colors.white, size: 26),
          const SizedBox(width: 10),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                subtitle,
                style: TextStyle(
                  color: Colors.white.withValues(alpha: 0.6),
                  fontSize: 9,
                ),
              ),
              Text(
                store,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            const Color(0xFF020617),
            Colors.black.withValues(alpha: 0.9),
          ],
        ),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 1400),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 60),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        gradient: AppColors.primaryGradient,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: const Text(
                        'LetBuyy',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                    const SizedBox(width: 16),
                    Text(
                      '© 2025, LetBuyy.com, Inc. All rights reserved.',
                      style: TextStyle(
                        fontSize: 12,
                        color: Colors.white.withValues(alpha: 0.4),
                      ),
                    ),
                  ],
                ),
                Row(
                  children: [
                    _buildPaymentIcon(Icons.credit_card_rounded),
                    _buildPaymentIcon(FontAwesomeIcons.ccVisa, isFa: true),
                    _buildPaymentIcon(FontAwesomeIcons.ccMastercard, isFa: true),
                    _buildPaymentIcon(FontAwesomeIcons.ccPaypal, isFa: true),
                    _buildPaymentIcon(FontAwesomeIcons.googlePay, isFa: true),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPaymentIcon(dynamic icon, {bool isFa = false}) {
    return Padding(
      padding: const EdgeInsets.only(left: 12),
      child: isFa
          ? FaIcon(icon, color: Colors.white.withValues(alpha: 0.4), size: 20)
          : Icon(icon, color: Colors.white.withValues(alpha: 0.4), size: 22),
    );
  }
}

// Hoverable Link Widget
class _HoverableLink extends StatefulWidget {
  final String text;
  const _HoverableLink({required this.text});

  @override
  State<_HoverableLink> createState() => _HoverableLinkState();
}

class _HoverableLinkState extends State<_HoverableLink> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: GestureDetector(
        onTap: () {},
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          child: Text(
            widget.text,
            style: TextStyle(
              color: _isHovered ? AppColors.primaryLight : Colors.white.withValues(alpha: 0.55),
              fontSize: 13,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

// Social Icon Button with hover effect
class _SocialIconButton extends StatefulWidget {
  final IconData icon;
  const _SocialIconButton({required this.icon});

  @override
  State<_SocialIconButton> createState() => _SocialIconButtonState();
}

class _SocialIconButtonState extends State<_SocialIconButton> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(right: 10),
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        onEnter: (_) => setState(() => _isHovered = true),
        onExit: (_) => setState(() => _isHovered = false),
        child: GestureDetector(
          onTap: () {},
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: _isHovered
                  ? AppColors.primary.withValues(alpha: 0.2)
                  : Colors.white.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(
                color: _isHovered
                    ? AppColors.primary.withValues(alpha: 0.4)
                    : Colors.white.withValues(alpha: 0.1),
                width: 1,
              ),
              boxShadow: _isHovered
                  ? [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.2),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      ),
                    ]
                  : null,
            ),
            child: FaIcon(
              widget.icon,
              color: _isHovered ? AppColors.primaryLight : Colors.white.withValues(alpha: 0.6),
              size: 18,
            ),
          ),
        ),
      ),
    );
  }
}