import 'package:flutter/material.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import '../../../models/store_model.dart';
import 'package:url_launcher/url_launcher.dart';

/// Preview of footer section in website preview
/// Matches storefront dynamic-footer.tsx - responsive for different devices
class PreviewFooter extends StatelessWidget {
  final SectionModel section;
  final StoreModel? store;
  final String deviceMode;

  const PreviewFooter({
    super.key,
    required this.section,
    this.store,
    this.deviceMode = 'phone',
  });

  Color _hexToColor(String hex) {
    hex = hex.replaceAll('#', '');
    if (hex.length == 6) hex = 'FF$hex';
    return Color(int.parse(hex, radix: 16));
  }

  bool get isLaptop => deviceMode == 'laptop';

  @override
  Widget build(BuildContext context) {
    final themeSettings = store?.templateConfig?.themeSettings;
    final settings = section.settings;
    
    // Theme colors
    final primaryColor = _hexToColor(themeSettings?.primaryColor ?? '#6366F1');
    final fontFamily = themeSettings?.fontFamily ?? 'Inter';
    
    // Fixed dark background like storefront
    const footerBg = Color(0xFF0F172A);
    
    // Get social URLs
    final instagramUrl = settings['instagramUrl'] as String? ?? '';
    final facebookUrl = settings['facebookUrl'] as String? ?? '';
    final twitterUrl = settings['twitterUrl'] as String? ?? '';
    final whatsappUrl = settings['whatsappUrl'] as String? ?? '';
    final telegramUrl = settings['telegramUrl'] as String? ?? '';
    final youtubeUrl = settings['youtubeUrl'] as String? ?? '';
    
    final showSocial = settings['showSocial'] != false;
    final contactEmail = settings['contactEmail'] as String? ?? 'help@letbuyy.com';
    
    final storeName = store?.name ?? 'Store';
    final currentYear = DateTime.now().year;

    return Container(
      decoration: const BoxDecoration(color: footerBg),
      child: Column(
        children: [
          // Decorative gradient bar at top
          Container(
            height: 2,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  primaryColor,
                  _hexToColor(themeSettings?.accentColor ?? '#A4E500'),
                  primaryColor,
                ],
              ),
            ),
          ),
          
          // Main content - Different layout for laptop vs mobile/tablet
          if (isLaptop)
            _buildLaptopLayout(
              storeName: storeName,
              primaryColor: primaryColor,
              fontFamily: fontFamily,
              showSocial: showSocial,
              instagramUrl: instagramUrl,
              facebookUrl: facebookUrl,
              twitterUrl: twitterUrl,
              whatsappUrl: whatsappUrl,
              telegramUrl: telegramUrl,
              youtubeUrl: youtubeUrl,
              contactEmail: contactEmail,
              currentYear: currentYear,
            )
          else
            _buildMobileLayout(
              storeName: storeName,
              primaryColor: primaryColor,
              fontFamily: fontFamily,
              showSocial: showSocial,
              instagramUrl: instagramUrl,
              facebookUrl: facebookUrl,
              twitterUrl: twitterUrl,
              whatsappUrl: whatsappUrl,
              telegramUrl: telegramUrl,
              youtubeUrl: youtubeUrl,
              contactEmail: contactEmail,
              currentYear: currentYear,
            ),
        ],
      ),
    );
  }

  /// Laptop layout - 4 columns horizontal
  Widget _buildLaptopLayout({
    required String storeName,
    required Color primaryColor,
    required String fontFamily,
    required bool showSocial,
    required String instagramUrl,
    required String facebookUrl,
    required String twitterUrl,
    required String whatsappUrl,
    required String telegramUrl,
    required String youtubeUrl,
    required String contactEmail,
    required int currentYear,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      child: Column(
        children: [
          // 4-column layout
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Column 1: Store name + Social
              Expanded(
                flex: 2,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      storeName,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: primaryColor,
                        fontFamily: fontFamily,
                      ),
                    ),
                    if (showSocial) ...[
                      const SizedBox(height: 6),
                      Wrap(
                        spacing: 4,
                        runSpacing: 4,
                        children: [
                          if (instagramUrl.isNotEmpty)
                            _buildSocialIconSmall(FontAwesomeIcons.instagram, instagramUrl),
                          if (facebookUrl.isNotEmpty)
                            _buildSocialIconSmall(FontAwesomeIcons.facebookF, facebookUrl),
                          if (twitterUrl.isNotEmpty)
                            _buildSocialIconSmall(FontAwesomeIcons.xTwitter, twitterUrl),
                          if (whatsappUrl.isNotEmpty)
                            _buildSocialIconSmall(FontAwesomeIcons.whatsapp, whatsappUrl),
                          if (telegramUrl.isNotEmpty)
                            _buildSocialIconSmall(FontAwesomeIcons.telegram, telegramUrl),
                          if (youtubeUrl.isNotEmpty)
                            _buildSocialIconSmall(FontAwesomeIcons.youtube, youtubeUrl),
                          // Show placeholder icons if no social links set
                          if (instagramUrl.isEmpty && facebookUrl.isEmpty && twitterUrl.isEmpty) ...[
                            _buildSocialIconSmall(FontAwesomeIcons.instagram, ''),
                            _buildSocialIconSmall(FontAwesomeIcons.facebookF, ''),
                            _buildSocialIconSmall(FontAwesomeIcons.xTwitter, ''),
                            _buildSocialIconSmall(FontAwesomeIcons.whatsapp, ''),
                            _buildSocialIconSmall(FontAwesomeIcons.telegram, ''),
                            _buildSocialIconSmall(FontAwesomeIcons.youtube, ''),
                          ],
                        ],
                      ),
                    ],
                  ],
                ),
              ),
              
              // Column 2: Quick Links
              Expanded(
                flex: 2,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'QUICK LINKS',
                      style: TextStyle(
                        fontSize: 8,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                        letterSpacing: 0.5,
                        fontFamily: fontFamily,
                      ),
                    ),
                    const SizedBox(height: 6),
                    _buildLinkSmall('Home', fontFamily),
                    _buildLinkSmall('Shop', fontFamily),
                    _buildLinkSmall('Cart', fontFamily),
                    _buildLinkSmall('Track Order', fontFamily),
                  ],
                ),
              ),
              
              // Column 3: Policies
              Expanded(
                flex: 2,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'POLICIES',
                      style: TextStyle(
                        fontSize: 8,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                        letterSpacing: 0.5,
                        fontFamily: fontFamily,
                      ),
                    ),
                    const SizedBox(height: 6),
                    _buildLinkSmall('Privacy Policy', fontFamily),
                    _buildLinkSmall('Terms of Service', fontFamily),
                    _buildLinkSmall('Shipping', fontFamily),
                    _buildLinkSmall('Returns & Exchange', fontFamily),
                  ],
                ),
              ),
              
              // Column 4: Contact
              Expanded(
                flex: 2,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'CONTACT',
                      style: TextStyle(
                        fontSize: 8,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                        letterSpacing: 0.5,
                        fontFamily: fontFamily,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        FaIcon(FontAwesomeIcons.envelope, size: 8, color: primaryColor),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            contactEmail,
                            style: TextStyle(
                              fontSize: 8,
                              color: Colors.grey[400],
                              fontFamily: fontFamily,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 10),
          
          // Separator
          Container(
            height: 1,
            color: Colors.grey[800],
          ),
          
          const SizedBox(height: 8),
          
          // Bottom bar - Copyright left, Made with right
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '© $currentYear $storeName. All rights reserved.',
                style: TextStyle(
                  fontSize: 8,
                  color: Colors.grey[500],
                  fontFamily: fontFamily,
                ),
              ),
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'Made with ',
                    style: TextStyle(
                      fontSize: 8,
                      color: Colors.grey[500],
                      fontFamily: fontFamily,
                    ),
                  ),
                  FaIcon(FontAwesomeIcons.solidHeart, size: 7, color: primaryColor),
                  Text(
                    ' by ',
                    style: TextStyle(
                      fontSize: 8,
                      color: Colors.grey[500],
                      fontFamily: fontFamily,
                    ),
                  ),
                  GestureDetector(
                    onTap: () => _launchUrl('https://letbuyy.store'),
                    child: Text(
                      'LetBuyy',
                      style: TextStyle(
                        fontSize: 8,
                        fontWeight: FontWeight.w600,
                        color: primaryColor,
                        fontFamily: fontFamily,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  /// Mobile/Tablet layout - stacked vertical
  Widget _buildMobileLayout({
    required String storeName,
    required Color primaryColor,
    required String fontFamily,
    required bool showSocial,
    required String instagramUrl,
    required String facebookUrl,
    required String twitterUrl,
    required String whatsappUrl,
    required String telegramUrl,
    required String youtubeUrl,
    required String contactEmail,
    required int currentYear,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Store name
          Text(
            storeName,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: primaryColor,
              fontFamily: fontFamily,
            ),
          ),
          
          // Social Icons Row
          if (showSocial) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                if (instagramUrl.isNotEmpty)
                  _buildSocialIcon(FontAwesomeIcons.instagram, instagramUrl),
                if (facebookUrl.isNotEmpty)
                  _buildSocialIcon(FontAwesomeIcons.facebookF, facebookUrl),
                if (twitterUrl.isNotEmpty)
                  _buildSocialIcon(FontAwesomeIcons.xTwitter, twitterUrl),
                if (whatsappUrl.isNotEmpty)
                  _buildSocialIcon(FontAwesomeIcons.whatsapp, whatsappUrl),
                if (telegramUrl.isNotEmpty)
                  _buildSocialIcon(FontAwesomeIcons.telegram, telegramUrl),
                if (youtubeUrl.isNotEmpty)
                  _buildSocialIcon(FontAwesomeIcons.youtube, youtubeUrl),
                // Show placeholder icons if no social links set
                if (instagramUrl.isEmpty && facebookUrl.isEmpty && twitterUrl.isEmpty) ...[
                  _buildSocialIcon(FontAwesomeIcons.instagram, ''),
                  _buildSocialIcon(FontAwesomeIcons.facebookF, ''),
                  _buildSocialIcon(FontAwesomeIcons.xTwitter, ''),
                  _buildSocialIcon(FontAwesomeIcons.whatsapp, ''),
                  _buildSocialIcon(FontAwesomeIcons.telegram, ''),
                  _buildSocialIcon(FontAwesomeIcons.youtube, ''),
                ],
              ],
            ),
          ],
          
          const SizedBox(height: 16),
          
          // Quick Links + Policies in 2 columns
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Quick Links
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'QUICK LINKS',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                        letterSpacing: 0.5,
                        fontFamily: fontFamily,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _buildLink('Home', fontFamily),
                    _buildLink('Shop', fontFamily),
                    _buildLink('Cart', fontFamily),
                    _buildLink('Track Order', fontFamily),
                  ],
                ),
              ),
              
              // Policies
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'POLICIES',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                        color: Colors.white,
                        letterSpacing: 0.5,
                        fontFamily: fontFamily,
                      ),
                    ),
                    const SizedBox(height: 8),
                    _buildLink('Privacy Policy', fontFamily),
                    _buildLink('Terms of Service', fontFamily),
                    _buildLink('Shipping', fontFamily),
                    _buildLink('Returns & Exchange', fontFamily),
                  ],
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 16),
          
          // Contact Section
          Text(
            'CONTACT',
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w600,
              color: Colors.white,
              letterSpacing: 0.5,
              fontFamily: fontFamily,
            ),
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              FaIcon(FontAwesomeIcons.envelope, size: 10, color: primaryColor),
              const SizedBox(width: 6),
              Text(
                contactEmail,
                style: TextStyle(
                  fontSize: 10,
                  color: Colors.grey[400],
                  fontFamily: fontFamily,
                ),
              ),
            ],
          ),
          
          const SizedBox(height: 14),
          
          // Separator
          Container(
            height: 1,
            color: Colors.grey[800],
          ),
          
          const SizedBox(height: 10),
          
          // Copyright centered
          Center(
            child: Text(
              '© $currentYear $storeName. All rights reserved.',
              style: TextStyle(
                fontSize: 9,
                color: Colors.grey[500],
                fontFamily: fontFamily,
              ),
            ),
          ),
          
          const SizedBox(height: 6),
          
          // Made with LetBuyy centered
          Center(
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Made with ',
                  style: TextStyle(
                    fontSize: 9,
                    color: Colors.grey[500],
                    fontFamily: fontFamily,
                  ),
                ),
                FaIcon(FontAwesomeIcons.solidHeart, size: 9, color: primaryColor),
                Text(
                  ' by ',
                  style: TextStyle(
                    fontSize: 9,
                    color: Colors.grey[500],
                    fontFamily: fontFamily,
                  ),
                ),
                GestureDetector(
                  onTap: () => _launchUrl('https://letbuyy.store'),
                  child: Text(
                    'LetBuyy',
                    style: TextStyle(
                      fontSize: 9,
                      fontWeight: FontWeight.w600,
                      color: primaryColor,
                      fontFamily: fontFamily,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLink(String text, String fontFamily) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 5),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 10,
          color: Colors.grey[400],
          fontFamily: fontFamily,
        ),
      ),
    );
  }

  Widget _buildLinkSmall(String text, String fontFamily) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 3),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 8,
          color: Colors.grey[400],
          fontFamily: fontFamily,
        ),
      ),
    );
  }

  Widget _buildSocialIcon(IconData icon, String url) {
    return Padding(
      padding: const EdgeInsets.only(right: 4),
      child: GestureDetector(
        onTap: url.isNotEmpty ? () => _launchUrl(url) : null,
        child: Container(
          width: 22,
          height: 22,
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(5),
            border: Border.all(color: Colors.grey[700]!, width: 0.5),
          ),
          child: Center(
            child: FaIcon(icon, size: 10, color: Colors.grey[400]),
          ),
        ),
      ),
    );
  }

  Widget _buildSocialIconSmall(IconData icon, String url) {
    return GestureDetector(
      onTap: url.isNotEmpty ? () => _launchUrl(url) : null,
      child: Container(
        width: 18,
        height: 18,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(3),
          border: Border.all(color: Colors.grey[700]!, width: 0.5),
        ),
        child: Center(
          child: FaIcon(icon, size: 8, color: Colors.grey[400]),
        ),
      ),
    );
  }

  Future<void> _launchUrl(String url) async {
    if (url.isEmpty) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }
}
