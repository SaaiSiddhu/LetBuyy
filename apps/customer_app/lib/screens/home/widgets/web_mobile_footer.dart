import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:letbuyy_marketplace_ui_kit/letbuyy_marketplace_ui_kit.dart';

class WebMobileFooter extends StatelessWidget {
  const WebMobileFooter({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Color(0xFF0F172A),
      ),
      child: Column(
        children: [
          // 1. Trust Badges (Scrollable Row or Grid)
          _buildTrustBadges(context),
          
          // 2. Newsletter (Column)
          _buildNewsletterSection(),
          
          // 3. Links (Expansion Tiles)
          _buildMobileLinks(context),
          
          // 4. Social & Apps
          _buildSocialSection(),

          // 5. Bottom Copyright
          _buildBottomBar(),
        ],
      ),
    );
  }

  Widget _buildTrustBadges(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: Colors.white.withValues(alpha: 0.06))),
      ),
      child: Wrap(
        spacing: 16,
        runSpacing: 16,
        alignment: WrapAlignment.center,
        children: [
          _buildTrustBadge(Icons.verified_user_rounded, 'Secure Payments'),
          _buildTrustBadge(Icons.local_shipping_rounded, 'Fast Delivery'),
          _buildTrustBadge(Icons.replay_rounded, 'Easy Returns'),
          _buildTrustBadge(Icons.support_agent_rounded, '24/7 Support'),
        ],
      ),
    );
  }

  Widget _buildTrustBadge(IconData icon, String title) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, color: AppColors.primaryLight, size: 18),
        const SizedBox(width: 8),
        Text(
          title,
          style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600),
        ),
      ],
    );
  }

  Widget _buildNewsletterSection() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: Colors.white.withValues(alpha: 0.06))),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Subscribe to our Newsletter',
            style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 4),
          Text(
            'Get exclusive offers and updates',
            style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 12),
          ),
          const SizedBox(height: 16),
          // Input
          Container(
            height: 48,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.06),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
            ),
            child: Row(
              children: [
                const Expanded(
                  child: Padding(
                    padding: EdgeInsets.only(left: 16),
                    child: TextField(
                      style: TextStyle(color: Colors.white, fontSize: 14),
                      decoration: InputDecoration(
                        hintText: 'Email address',
                        hintStyle: TextStyle(color: Colors.white38),
                        border: InputBorder.none,
                        isDense: true,
                      ),
                    ),
                  ),
                ),
                Container(
                  height: 48,
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  decoration: BoxDecoration(
                    gradient: AppColors.primaryGradient,
                    borderRadius: const BorderRadius.only(
                      topRight: Radius.circular(7),
                      bottomRight: Radius.circular(7),
                    ),
                  ),
                  child: const Center(
                    child: Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 20),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMobileLinks(BuildContext context) {
    return Column(
      children: [
        _buildExpansionTile(context, 'Get to Know Us', ['About Us', 'Careers', 'Blog', 'Seller Stories']),
        _buildExpansionTile(context, 'Let Us Help You', ['Your Account', 'Orders', 'Shipping', 'Returns', 'Help Center']),
        _buildExpansionTile(context, 'Our Policies', ['Privacy Policy', 'Terms & Conditions', 'Security']),
      ],
    );
  }

  Widget _buildExpansionTile(BuildContext context, String title, List<String> links) {
    return Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        title: Text(
          title,
          style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600),
        ),
        iconColor: Colors.white70,
        collapsedIconColor: Colors.white54,
        children: links
            .map((link) => Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
                  child: Row(
                    children: [
                      Text(link, style: TextStyle(color: Colors.white.withValues(alpha: 0.6), fontSize: 13)),
                    ],
                  ),
                ))
            .toList(),
      ),
    );
  }

  Widget _buildSocialSection() {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _socialIcon(FontAwesomeIcons.facebook),
              _socialIcon(FontAwesomeIcons.xTwitter),
              _socialIcon(FontAwesomeIcons.instagram),
              _socialIcon(FontAwesomeIcons.youtube),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
               _appStoreBtn(Icons.apple, 'App Store'),
               const SizedBox(width: 12),
               _appStoreBtn(FontAwesomeIcons.googlePlay, 'Google Play', isFa: true),
            ],
          ),
        ],
      ),
    );
  }

  Widget _socialIcon(IconData icon) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.08),
        shape: BoxShape.circle,
      ),
      child: FaIcon(icon, color: Colors.white, size: 18),
    );
  }

  Widget _appStoreBtn(dynamic icon, String text, {bool isFa = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.white24),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Row(
        children: [
          if (isFa) FaIcon(icon, color: Colors.white, size: 18) else Icon(icon, color: Colors.white, size: 20),
          const SizedBox(width: 8),
          Text(text, style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }

  Widget _buildBottomBar() {
    return Container(
      padding: const EdgeInsets.all(24),
      color: Colors.black.withValues(alpha: 0.3),
      child: Column(
        children: [
          const Text(
            '© 2025 LetBuyy. All rights reserved.',
            style: TextStyle(color: Colors.white54, fontSize: 12),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _payIcon(Icons.credit_card),
              _payIcon(FontAwesomeIcons.ccVisa, isFa: true),
              _payIcon(FontAwesomeIcons.ccMastercard, isFa: true),
              _payIcon(FontAwesomeIcons.ccPaypal, isFa: true),
            ],
          ),
        ],
      ),
    );
  }

  Widget _payIcon(dynamic icon, {bool isFa = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 6),
      child: isFa
          ? FaIcon(icon, color: Colors.white30, size: 16)
          : Icon(icon, color: Colors.white30, size: 18),
    );
  }
}
