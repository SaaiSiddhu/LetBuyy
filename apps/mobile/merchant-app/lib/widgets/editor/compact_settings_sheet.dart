import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import '../../theme/app_theme_colors.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import '../../models/store_model.dart';
import '../shared/cached_merchant_image.dart';

/// Compact settings sheet that slides up from bottom
/// Shows quick-edit fields for the selected section
class CompactSettingsSheet extends StatefulWidget {
  final SectionModel section;
  final StoreModel? store;
  final ValueChanged<SectionModel> onUpdate;
  final VoidCallback? onExpand;
  final VoidCallback? onClose;
  final VoidCallback? onDelete;
  final VoidCallback? onToggleVisibility;

  const CompactSettingsSheet({
    super.key,
    required this.section,
    this.store,
    required this.onUpdate,
    this.onExpand,
    this.onClose,
    this.onDelete,
    this.onToggleVisibility,
  });

  @override
  State<CompactSettingsSheet> createState() => _CompactSettingsSheetState();
}

class _CompactSettingsSheetState extends State<CompactSettingsSheet> {
  late Map<String, dynamic> _settings;
  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _settings = Map.from(widget.section.settings);
  }

  @override
  void didUpdateWidget(CompactSettingsSheet oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.section.id != widget.section.id) {
      _settings = Map.from(widget.section.settings);
    }
  }

  void _updateSetting(String key, dynamic value) {
    setState(() {
      _settings[key] = value;
    });
    widget.onUpdate(widget.section.copyWith(settings: _settings));
  }

  /// Convert hex color string to Color
  Color _hexToColor(String hex) {
    hex = hex.replaceAll('#', '');
    if (hex.length == 6) hex = 'FF$hex';
    return Color(int.parse(hex, radix: 16));
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    final isHeader = widget.section.type == SectionType.header;
    final isFooter = widget.section.type == SectionType.footer;
    final isUnifiedSheet = isHeader || isFooter; // Both use unified full sheet

    // Height: 85% for both header and footer, accounting for keyboard
    final keyboardHeight = MediaQuery.of(context).viewInsets.bottom;
    final availableHeight = MediaQuery.of(context).size.height - keyboardHeight;
    final sheetHeight = (isHeader || isFooter) ? availableHeight * 0.85 : null;

    return Container(
      height: sheetHeight,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: colors.divider),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.3),
            blurRadius: 30,
            offset: const Offset(0, -10),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: isUnifiedSheet ? MainAxisSize.max : MainAxisSize.min,
        children: [
          // Handle
          Container(
            margin: const EdgeInsets.only(top: 12),
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: colors.textTertiary,
              borderRadius: BorderRadius.circular(2),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 12, 8),
            child: Row(
              children: [
                // Section icon
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: mobile_tokens.LetbuyyColorTokens.brandPrimary
                        .withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    widget.section.type.icon,
                    color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),

                // Title
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isHeader
                            ? 'Header Settings'
                            : isFooter
                            ? 'Footer Settings'
                            : widget.section.type.displayName,
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                          color: colors.textPrimary,
                        ),
                      ),
                      Text(
                        widget.section.isVisible ? 'Visible' : 'Hidden',
                        style: TextStyle(
                          fontSize: 12,
                          color: widget.section.isVisible
                              ? colors.success
                              : colors.textTertiary,
                        ),
                      ),
                    ],
                  ),
                ),

                // Expand button only for non-unified sheets
                if (!isUnifiedSheet)
                  IconButton(
                    icon: Icon(
                      Icons.open_in_full_rounded,
                      color: colors.textSecondary,
                      size: 20,
                    ),
                    onPressed: widget.onExpand,
                    tooltip: 'Expand',
                  ),

                IconButton(
                  icon: Icon(
                    Icons.close_rounded,
                    color: colors.textSecondary,
                    size: 20,
                  ),
                  onPressed: widget.onClose,
                ),
              ],
            ),
          ),

          const Divider(color: Color(0xFF334155), height: 1),

          // Sticky Preview Bar for Header (above scrollable content)
          if (isHeader) _buildHeaderPreviewBar(),

          // Sticky Preview Bar for Footer (25% screen with live preview)
          if (isFooter) _buildFooterPreviewBar(),

          // Content - scrollable for unified sheets, regular for others
          if (isHeader)
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: const EdgeInsets.all(20),
                child: _buildHeaderSettingsContent(),
              ),
            )
          else if (isFooter)
            Expanded(
              child: SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                padding: EdgeInsets.fromLTRB(
                  20,
                  20,
                  20,
                  20 + MediaQuery.of(context).viewInsets.bottom,
                ),
                child: _buildFooterSettingsContent(),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.all(20),
              child: _buildQuickSettings(),
            ),

          // Action buttons (only for non-unified sheets)
          if (!isUnifiedSheet)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 20),
              child: Row(
                children: [
                  Expanded(
                    child: _ActionButton(
                      icon: widget.section.isVisible
                          ? Icons.visibility_outlined
                          : Icons.visibility_off_outlined,
                      label: widget.section.isVisible ? 'Hide' : 'Show',
                      onTap: widget.onToggleVisibility,
                    ),
                  ),
                  const SizedBox(width: 12),
                  if (!widget.section.type.isRequired)
                    Expanded(
                      child: _ActionButton(
                        icon: Icons.delete_outline_rounded,
                        label: 'Delete',
                        isDestructive: true,
                        onTap: widget.onDelete,
                      ),
                    ),
                ],
              ),
            ),

          // Safe area
          SizedBox(height: MediaQuery.of(context).padding.bottom),
        ],
      ),
    );
  }

  Widget _buildQuickSettings() {
    switch (widget.section.type) {
      case SectionType.header:
        return const SizedBox.shrink(); // Header uses _buildHeaderSettingsContent instead
      case SectionType.heroBanner:
        return _buildHeroQuickSettings();
      case SectionType.productGrid:
      case SectionType.featuredProducts:
        return _buildProductsQuickSettings();
      case SectionType.aboutSection:
        return _buildAboutQuickSettings();
      case SectionType.footer:
        return _buildFooterQuickSettings();
      default:
        return _buildGenericSettings();
    }
  }

  Widget _buildFooterQuickSettings() {
    // Quick settings version (not used since footer now uses unified sheet)
    final contactEmail = _settings['contactEmail'] as String? ?? '';
    return _SettingsField(
      label: 'Contact Email',
      value: contactEmail,
      onChanged: (val) => _updateSetting('contactEmail', val),
    );
  }

  /// Sticky footer preview bar - exact match to device preview, fixed (no scroll)
  Widget _buildFooterPreviewBar() {
    final contactEmail = _settings['contactEmail']?.toString() ?? '';
    final showSocial = _settings['showSocial'] != false;
    final storeName = widget.store?.name ?? 'Store Name';

    // Get theme colors from store's themeSettings
    final themeSettings = widget.store?.templateConfig?.themeSettings;
    final primaryColor = _hexToColor(themeSettings?.primaryColor ?? '#8B5CF6');
    final accentColor = _hexToColor(themeSettings?.accentColor ?? '#A4E500');

    // Collect active social links
    final activeSocials = <IconData>[];
    if ((_settings['instagramUrl']?.toString() ?? '').isNotEmpty)
      activeSocials.add(FontAwesomeIcons.instagram);
    if ((_settings['facebookUrl']?.toString() ?? '').isNotEmpty)
      activeSocials.add(FontAwesomeIcons.facebookF);
    if ((_settings['twitterUrl']?.toString() ?? '').isNotEmpty)
      activeSocials.add(FontAwesomeIcons.xTwitter);
    if ((_settings['whatsappUrl']?.toString() ?? '').isNotEmpty)
      activeSocials.add(FontAwesomeIcons.whatsapp);
    if ((_settings['telegramUrl']?.toString() ?? '').isNotEmpty)
      activeSocials.add(FontAwesomeIcons.telegram);
    if ((_settings['youtubeUrl']?.toString() ?? '').isNotEmpty)
      activeSocials.add(FontAwesomeIcons.youtube);

    final hasSocials = showSocial && activeSocials.isNotEmpty;

    return ConstrainedBox(
      constraints: const BoxConstraints(
        maxHeight: 180,
      ), // Fixed max height to prevent overflow
      child: Container(
        decoration: const BoxDecoration(
          color: Color(0xFF0f172a),
          border: Border(bottom: BorderSide(color: Color(0xFF334155))),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Top gradient accent
            Container(
              height: 3,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [primaryColor, accentColor, primaryColor],
                ),
              ),
            ),

            // Main content - scrollable to fit
            Flexible(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(10),
                physics: const ClampingScrollPhysics(),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Store Name
                    Text(
                      storeName,
                      style: TextStyle(
                        color: primaryColor,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),

                    const SizedBox(height: 8),

                    // Social Icons Row (horizontal, below store name) - compact
                    if (hasSocials)
                      Row(
                        children: activeSocials
                            .map(
                              (icon) => Container(
                                width: 18,
                                height: 18,
                                margin: const EdgeInsets.only(right: 3),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF1E293B),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Center(
                                  child: FaIcon(
                                    icon,
                                    size: 8,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            )
                            .toList(),
                      ),

                    if (hasSocials) const SizedBox(height: 12),

                    // Two Column Layout: Quick Links + Policies
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
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 4),
                              ...['Home', 'Shop', 'Cart', 'Track Order'].map(
                                (t) => Padding(
                                  padding: const EdgeInsets.only(bottom: 2),
                                  child: Text(
                                    t,
                                    style: TextStyle(
                                      color: Color(0xFF94A3B8),
                                      fontSize: 9,
                                    ),
                                  ),
                                ),
                              ),
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
                                  color: Colors.white,
                                  fontSize: 9,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 4),
                              ...[
                                'Privacy Policy',
                                'Terms of Service',
                                'Shipping',
                                'Returns & Exchange',
                              ].map(
                                (t) => Padding(
                                  padding: const EdgeInsets.only(bottom: 2),
                                  child: Text(
                                    t,
                                    style: TextStyle(
                                      color: Color(0xFF94A3B8),
                                      fontSize: 9,
                                    ),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 10),

                    // Contact Section
                    Text(
                      'CONTACT',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 9,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        FaIcon(
                          FontAwesomeIcons.envelope,
                          size: 10,
                          color: primaryColor,
                        ),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            contactEmail.isNotEmpty
                                ? contactEmail
                                : 'No email set',
                            style: TextStyle(
                              color: contactEmail.isNotEmpty
                                  ? const Color(0xFF94A3B8)
                                  : const Color(0xFF475569),
                              fontSize: 9,
                              fontStyle: contactEmail.isEmpty
                                  ? FontStyle.italic
                                  : FontStyle.normal,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ), // Close Flexible
            // Bottom bar - copyright (outside scrollable area)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: Color(0xFF1E293B))),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '© ${DateTime.now().year} $storeName',
                    style: TextStyle(color: Color(0xFF64748B), fontSize: 8),
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Made with ',
                        style: TextStyle(color: Color(0xFF64748B), fontSize: 8),
                      ),
                      Icon(Icons.favorite, size: 8, color: primaryColor),
                      Text(
                        ' LetBuyy',
                        style: TextStyle(
                          color: primaryColor,
                          fontSize: 8,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// Footer settings content (unified full sheet like header)
  Widget _buildFooterSettingsContent() {
    // Social platform definitions matching storefront keys
    final socialPlatforms = [
      {
        'key': 'instagramUrl',
        'label': 'Instagram',
        'icon': FontAwesomeIcons.instagram,
        'hint': 'instagram.com/yourstore',
      },
      {
        'key': 'facebookUrl',
        'label': 'Facebook',
        'icon': FontAwesomeIcons.facebookF,
        'hint': 'facebook.com/yourstore',
      },
      {
        'key': 'twitterUrl',
        'label': 'X (Twitter)',
        'icon': FontAwesomeIcons.xTwitter,
        'hint': 'twitter.com/yourstore',
      },
      {
        'key': 'whatsappUrl',
        'label': 'WhatsApp',
        'icon': FontAwesomeIcons.whatsapp,
        'hint': 'wa.me/919876543210',
      },
      {
        'key': 'telegramUrl',
        'label': 'Telegram',
        'icon': FontAwesomeIcons.telegram,
        'hint': 't.me/yourstore',
      },
      {
        'key': 'youtubeUrl',
        'label': 'YouTube',
        'icon': FontAwesomeIcons.youtube,
        'hint': 'youtube.com/@yourstore',
      },
    ];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Contact Email
        _buildFooterTextField(
          label: 'Contact Email',
          key: 'contactEmail',
          icon: FontAwesomeIcons.envelope,
          hint: 'help@yourstore.com',
        ),

        const SizedBox(height: 16),

        // Show Social Links toggle
        Container(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Show Social Links',
                style: TextStyle(fontSize: 14, color: colors.textSecondary),
              ),
              Switch(
                value: _settings['showSocial'] != false,
                onChanged: (value) =>
                    setState(() => _settings['showSocial'] = value),
                activeColor: const Color(0xFF818CF8),
                activeTrackColor: mobile_tokens.LetbuyyColorTokens.brandPrimary
                    .withValues(alpha: 0.3),
                inactiveThumbColor: colors.textTertiary,
                inactiveTrackColor: colors.divider,
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // Social Links Section Label
        Text(
          'Social Links',
          style: TextStyle(
            fontWeight: FontWeight.w500,
            fontSize: 13,
            color: colors.textSecondary,
          ),
        ),

        const SizedBox(height: 12),

        // Social Link Fields
        ...socialPlatforms.map(
          (p) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _buildFooterTextField(
              key: p['key'] as String,
              label: p['label'] as String,
              icon: p['icon'] as IconData,
              hint: p['hint'] as String,
            ),
          ),
        ),

        const SizedBox(height: 8),

        // Copyright Info
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: colors.surfaceVariant,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: colors.divider),
          ),
          child: Row(
            children: [
              const Icon(
                Icons.info_outline,
                size: 16,
                color: Color(0xFF818CF8),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '© ${DateTime.now().year} {Store Name}  •  Powered by LetBuyy',
                  style: TextStyle(fontSize: 12, color: colors.textSecondary),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(height: 16),
      ],
    );
  }

  /// Icon text field for footer (matching standard style)
  Widget _buildFooterTextField({
    required String key,
    required String label,
    required IconData icon,
    required String hint,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontWeight: FontWeight.w500,
            fontSize: 13,
            color: colors.textSecondary,
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          initialValue: _settings[key]?.toString() ?? '',
          style: TextStyle(color: colors.textPrimary, fontSize: 15),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: colors.textTertiary),
            filled: true,
            fillColor: colors.surfaceVariant,
            prefixIcon: Padding(
              padding: const EdgeInsets.only(left: 14, right: 10),
              child: FaIcon(icon, size: 16, color: const Color(0xFF818CF8)),
            ),
            prefixIconConstraints: const BoxConstraints(
              minWidth: 0,
              minHeight: 0,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: colors.divider, width: 1),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF818CF8), width: 2),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 14,
            ),
          ),
          onChanged: (value) => _updateSetting(key, value),
        ),
      ],
    );
  }

  /// Sticky header preview bar
  Widget _buildHeaderPreviewBar() {
    final logoPlacement = _settings['logoPlacement'] ?? 'left';
    final displayMode = _settings['displayMode'] ?? 'both';
    final logoUrl = _settings['logoUrl'] ?? widget.store?.logoUrl;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: colors.card,
        border: Border(bottom: BorderSide(color: colors.divider)),
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.1),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            const Icon(Icons.menu, size: 20, color: Colors.black54),
            const SizedBox(width: 12),
            if (logoPlacement == 'center') const Spacer(),
            // Logo/Name preview
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (displayMode == 'logo' || displayMode == 'both')
                  if (logoUrl != null)
                    ClipRRect(
                      borderRadius: BorderRadius.circular(4),
                      child: CachedMerchantImage(
                        imageUrl: logoUrl,
                        height: 24,
                        width: 24,
                        fit: BoxFit.cover,
                      ),
                    )
                  else
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade200,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Icon(
                        Icons.image,
                        size: 14,
                        color: Colors.grey,
                      ),
                    ),
                if (displayMode == 'both') const SizedBox(width: 6),
                if (displayMode == 'name' || displayMode == 'both')
                  Text(
                    widget.store?.name ?? 'Store Name',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      color: Colors.black87,
                    ),
                  ),
              ],
            ),
            if (logoPlacement == 'left') const Spacer(),
            if (_settings['showSearch'] == true)
              const Padding(
                padding: EdgeInsets.only(right: 8),
                child: Icon(Icons.search, size: 18, color: Colors.black54),
              ),
            if (_settings['showAccount'] == true)
              const Padding(
                padding: EdgeInsets.only(right: 8),
                child: Icon(
                  Icons.person_outline,
                  size: 18,
                  color: Colors.black54,
                ),
              ),
            if (_settings['showCart'] != false)
              const Icon(
                Icons.shopping_bag_outlined,
                size: 18,
                color: Colors.black54,
              ),
          ],
        ),
      ),
    );
  }

  /// Header settings content (scrollable)
  Widget _buildHeaderSettingsContent() {
    final behavior = _settings['behavior'] ?? 'sticky';
    final logoPlacement = _settings['logoPlacement'] ?? 'left';
    final displayMode = _settings['displayMode'] ?? 'both';
    final logoUrl = _settings['logoUrl'] ?? widget.store?.logoUrl;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Behavior Section
        _buildSectionLabel('Behavior'),
        Container(
          decoration: BoxDecoration(
            color: colors.surfaceVariant,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Column(
            children: [
              _buildBehaviorOption(
                'sticky',
                'Sticky',
                'Always visible at top',
                behavior,
              ),
              _buildBehaviorOption(
                'scroll',
                'Scroll',
                'Scrolls with page',
                behavior,
              ),
              _buildBehaviorOption(
                'hide-on-scroll',
                'Smart Hide',
                'Hides when scrolling down',
                behavior,
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // Logo & Branding Section
        _buildSectionLabel('Logo & Branding'),
        Row(
          children: [
            _buildPlacementButton(
              'left',
              'Left',
              Icons.format_align_left,
              logoPlacement,
              'logoPlacement',
            ),
            const SizedBox(width: 8),
            _buildPlacementButton(
              'center',
              'Center',
              Icons.format_align_center,
              logoPlacement,
              'logoPlacement',
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            _buildPlacementButton(
              'logo',
              'Logo Only',
              Icons.image_outlined,
              displayMode,
              'displayMode',
            ),
            const SizedBox(width: 6),
            _buildPlacementButton(
              'name',
              'Name Only',
              Icons.text_fields,
              displayMode,
              'displayMode',
            ),
            const SizedBox(width: 6),
            _buildPlacementButton(
              'both',
              'Both',
              Icons.view_agenda_outlined,
              displayMode,
              'displayMode',
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Logo Upload Row
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: colors.surfaceVariant,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: colors.divider),
          ),
          child: Row(
            children: [
              // Logo Preview
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: colors.divider),
                  image: logoUrl != null
                      ? DecorationImage(
                          image: cachedMerchantImageProvider(logoUrl),
                          fit: BoxFit.cover,
                        )
                      : null,
                ),
                child: logoUrl == null
                    ? Icon(Icons.image_outlined, color: colors.textTertiary)
                    : null,
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Header Logo',
                      style: TextStyle(
                        fontWeight: FontWeight.w500,
                        color: colors.textPrimary,
                      ),
                    ),
                    Text(
                      'PNG or JPG, max 512px',
                      style: TextStyle(
                        fontSize: 12,
                        color: colors.textSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              OutlinedButton(
                onPressed: widget.onExpand,
                style: OutlinedButton.styleFrom(
                  foregroundColor:
                      mobile_tokens.LetbuyyColorTokens.brandPrimary,
                  side: const BorderSide(
                    color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: Text('Upload'),
              ),
            ],
          ),
        ),

        const SizedBox(height: 20),

        // Header Icons
        _buildSectionLabel('Header Icons'),
        Row(
          children: [
            _buildIconToggle(
              'showSearch',
              Icons.search,
              'Search',
              _settings['showSearch'] ?? true,
            ),
            const SizedBox(width: 8),
            _buildIconToggle(
              'showCart',
              Icons.shopping_bag_outlined,
              'Cart',
              _settings['showCart'] ?? true,
            ),
            const SizedBox(width: 8),
            _buildIconToggle(
              'showAccount',
              Icons.person_outline,
              'Account',
              _settings['showAccount'] ?? false,
            ),
          ],
        ),

        const SizedBox(height: 20),

        // Navigation Section
        _buildSectionLabel('Navigation'),

        // Nav Placement
        Row(
          children: [
            _buildPlacementButton(
              'left',
              'Left Side',
              Icons.format_indent_decrease,
              _settings['navPlacement'] ?? 'right',
              'navPlacement',
            ),
            const SizedBox(width: 8),
            _buildPlacementButton(
              'right',
              'Right Side',
              Icons.format_indent_increase,
              _settings['navPlacement'] ?? 'right',
              'navPlacement',
            ),
          ],
        ),
        const SizedBox(height: 12),

        // Nav Pages Editor
        _buildNavPagesEditor(),

        const SizedBox(height: 24),
      ],
    );
  }

  /// Default nav pages
  static final List<Map<String, dynamic>> _defaultNavPages = [
    {
      'id': 'home',
      'label': 'Home',
      'href': '/',
      'isDefault': true,
      'isVisible': true,
    },
    {
      'id': 'shop',
      'label': 'Shop',
      'href': '/shop',
      'isDefault': true,
      'isVisible': true,
    },
    {
      'id': 'privacy',
      'label': 'Privacy',
      'href': '/privacy',
      'isDefault': true,
      'isVisible': true,
    },
    {
      'id': 'terms',
      'label': 'Terms',
      'href': '/terms',
      'isDefault': true,
      'isVisible': true,
    },
    {
      'id': 'shipping',
      'label': 'Shipping',
      'href': '/shipping',
      'isDefault': true,
      'isVisible': true,
    },
  ];

  Widget _buildNavPagesEditor() {
    final pages = List<Map<String, dynamic>>.from(
      (_settings['navPages'] as List?) ?? _defaultNavPages,
    );

    return Container(
      decoration: BoxDecoration(
        color: colors.surfaceVariant,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.divider),
      ),
      child: Column(
        children: [
          // Pages list
          ...pages.asMap().entries.map((entry) {
            final index = entry.key;
            final page = entry.value;
            return Container(
              decoration: BoxDecoration(
                border: index < pages.length - 1
                    ? Border(bottom: BorderSide(color: colors.divider))
                    : null,
              ),
              child: ListTile(
                leading: Icon(
                  Icons.drag_handle,
                  color: colors.textTertiary,
                  size: 20,
                ),
                title: Text(
                  page['label'] ?? '',
                  style: TextStyle(color: colors.textPrimary, fontSize: 14),
                ),
                subtitle: Text(
                  page['href'] ?? '',
                  style: TextStyle(fontSize: 11, color: colors.textSecondary),
                ),
                trailing: page['isDefault'] == true
                    ? Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 6,
                          vertical: 2,
                        ),
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          'Default',
                          style: TextStyle(
                            fontSize: 9,
                            color: colors.textTertiary,
                          ),
                        ),
                      )
                    : IconButton(
                        icon: const Icon(
                          Icons.delete_outline,
                          color: Color(0xFFEF4444),
                          size: 18,
                        ),
                        onPressed: () => _removePage(index),
                      ),
                dense: true,
                contentPadding: const EdgeInsets.symmetric(horizontal: 12),
              ),
            );
          }),

          // Add page button
          Divider(height: 1, color: colors.divider),
          TextButton.icon(
            onPressed: _addCustomPage,
            icon: const Icon(
              Icons.add,
              color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
              size: 18,
            ),
            label: Text(
              'Add Custom Page',
              style: TextStyle(
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _removePage(int index) {
    final pages = List<Map<String, dynamic>>.from(
      (_settings['navPages'] as List?) ?? _defaultNavPages,
    );
    if (pages[index]['isDefault'] != true) {
      pages.removeAt(index);
      _updateSetting('navPages', pages);
    }
  }

  void _addCustomPage() {
    showDialog(
      context: context,
      builder: (ctx) => _AddPageDialog(
        onAdd: (label, href) {
          final pages = List<Map<String, dynamic>>.from(
            (_settings['navPages'] as List?) ?? _defaultNavPages,
          );
          pages.add({
            'id': DateTime.now().millisecondsSinceEpoch.toString(),
            'label': label,
            'href': href,
            'isDefault': false,
            'isVisible': true,
          });
          _updateSetting('navPages', pages);
        },
      ),
    );
  }

  Widget _buildSectionLabel(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.w600,
          color: colors.textPrimary,
        ),
      ),
    );
  }

  Widget _buildBehaviorOption(
    String value,
    String title,
    String subtitle,
    String currentValue,
  ) {
    final isSelected = currentValue == value;
    return GestureDetector(
      onTap: () {
        HapticFeedback.selectionClick();
        _updateSetting('behavior', value);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected
              ? mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
                  alpha: 0.15,
                )
              : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          children: [
            Icon(
              isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
              color: isSelected
                  ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                  : colors.textTertiary,
              size: 18,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                      color: colors.textPrimary,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(fontSize: 11, color: colors.textSecondary),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPlacementButton(
    String value,
    String label,
    IconData icon,
    String currentValue,
    String key,
  ) {
    final isSelected = currentValue == value;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          _updateSetting(key, value);
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected
                ? mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
                    alpha: 0.15,
                  )
                : colors.surfaceVariant,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isSelected
                  ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                  : colors.divider,
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                color: isSelected
                    ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                    : colors.textSecondary,
                size: 18,
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                  color: isSelected
                      ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                      : colors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildIconToggle(
    String key,
    IconData icon,
    String label,
    bool isActive,
  ) {
    return Expanded(
      child: GestureDetector(
        onTap: () {
          HapticFeedback.selectionClick();
          _updateSetting(key, !isActive);
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isActive
                ? mobile_tokens.LetbuyyColorTokens.brandPrimary.withValues(
                    alpha: 0.15,
                  )
                : colors.surfaceVariant,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: isActive
                  ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                  : colors.divider,
            ),
          ),
          child: Column(
            children: [
              Icon(
                icon,
                color: isActive
                    ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                    : colors.textSecondary,
                size: 18,
              ),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: isActive ? FontWeight.w600 : FontWeight.normal,
                  color: isActive
                      ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                      : colors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeroQuickSettings() {
    // Get current banner settings
    String heading = '';
    String subheading = '';

    final banners = _settings['banners'] as List?;
    if (banners != null && banners.isNotEmpty) {
      final firstBanner = banners.first as Map<String, dynamic>?;
      heading = firstBanner?['heading'] as String? ?? '';
      subheading = firstBanner?['subheading'] as String? ?? '';
    } else {
      heading = _settings['heading'] as String? ?? '';
      subheading = _settings['subheading'] as String? ?? '';
    }

    return Column(
      children: [
        _SettingsField(
          label: 'Heading',
          value: heading,
          onChanged: (val) => _updateBannerField('heading', val),
        ),
        const SizedBox(height: 16),
        _SettingsField(
          label: 'Subheading',
          value: subheading,
          onChanged: (val) => _updateBannerField('subheading', val),
        ),
      ],
    );
  }

  void _updateBannerField(String field, String value) {
    final banners = List<Map<String, dynamic>>.from(
      (_settings['banners'] as List?) ?? [],
    );

    if (banners.isEmpty) {
      banners.add({field: value});
    } else {
      banners[0] = Map<String, dynamic>.from(banners[0]);
      banners[0][field] = value;
    }

    _updateSetting('banners', banners);
  }

  Widget _buildProductsQuickSettings() {
    // Safe parsing helper
    int parseInt(dynamic value, int defaultValue) {
      if (value is int) return value;
      if (value is String) return int.tryParse(value) ?? defaultValue;
      return defaultValue;
    }

    final title = _settings['title'] as String? ?? '';
    final columns = parseInt(_settings['columns'], 2);

    return Column(
      children: [
        _SettingsField(
          label: 'Section Title',
          value: title,
          onChanged: (val) => _updateSetting('title', val),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Text(
              'Columns: ',
              style: TextStyle(color: colors.textSecondary, fontSize: 14),
            ),
            const SizedBox(width: 12),
            _ColumnSelector(
              value: columns,
              onChanged: (val) => _updateSetting('columns', val),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildAboutQuickSettings() {
    final title = _settings['title'] as String? ?? '';
    final content = _settings['content'] as String? ?? '';

    return Column(
      children: [
        _SettingsField(
          label: 'Title',
          value: title,
          onChanged: (val) => _updateSetting('title', val),
        ),
        const SizedBox(height: 16),
        _SettingsField(
          label: 'Content',
          value: content,
          maxLines: 3,
          onChanged: (val) => _updateSetting('content', val),
        ),
      ],
    );
  }

  Widget _buildGenericSettings() {
    final title = _settings['title'] as String? ?? '';

    return _SettingsField(
      label: 'Section Title',
      value: title,
      onChanged: (val) => _updateSetting('title', val),
    );
  }
}

class _SettingsField extends StatefulWidget {
  final String label;
  final String value;
  final int maxLines;
  final ValueChanged<String> onChanged;

  const _SettingsField({
    required this.label,
    required this.value,
    this.maxLines = 1,
    required this.onChanged,
  });

  @override
  State<_SettingsField> createState() => _SettingsFieldState();
}

class _SettingsFieldState extends State<_SettingsField> {
  late TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(text: widget.value);
  }

  @override
  void didUpdateWidget(_SettingsField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value && _controller.text != widget.value) {
      _controller.text = widget.value;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          widget.label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: colors.textSecondary,
          ),
        ),
        const SizedBox(height: 8),
        TextField(
          controller: _controller,
          maxLines: widget.maxLines,
          style: TextStyle(color: colors.textPrimary, fontSize: 14),
          decoration: InputDecoration(
            filled: true,
            fillColor: colors.surfaceVariant,
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 12,
            ),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(
                color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                width: 2,
              ),
            ),
          ),
          onChanged: widget.onChanged,
        ),
      ],
    );
  }
}

class _ColumnSelector extends StatelessWidget {
  final int value;
  final ValueChanged<int> onChanged;

  const _ColumnSelector({required this.value, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Row(
      children: [2, 3, 4].map((cols) {
        final isSelected = value == cols;
        return GestureDetector(
          onTap: () {
            HapticFeedback.lightImpact();
            onChanged(cols);
          },
          child: Container(
            margin: const EdgeInsets.only(right: 8),
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: isSelected
                  ? mobile_tokens.LetbuyyColorTokens.brandPrimary
                  : colors.surfaceVariant,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(
                '$cols',
                style: TextStyle(
                  color: isSelected ? Colors.white : colors.textSecondary,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _ActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final bool isDestructive;
  final VoidCallback? onTap;

  const _ActionButton({
    required this.icon,
    required this.label,
    this.isDestructive = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        onTap?.call();
      },
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: colors.surfaceVariant,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 18,
              color: isDestructive ? colors.error : colors.textSecondary,
            ),
            const SizedBox(width: 8),
            Text(
              label,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: isDestructive ? colors.error : colors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Dialog for adding custom nav pages
class _AddPageDialog extends StatefulWidget {
  final Function(String label, String href) onAdd;

  const _AddPageDialog({required this.onAdd});

  @override
  State<_AddPageDialog> createState() => _AddPageDialogState();
}

class _AddPageDialogState extends State<_AddPageDialog> {
  final _labelController = TextEditingController();
  final _hrefController = TextEditingController(text: '/');

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return AlertDialog(
      backgroundColor: colors.card,
      title: Text(
        'Add Custom Page',
        style: TextStyle(color: colors.textPrimary),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TextField(
            controller: _labelController,
            decoration: InputDecoration(
              labelText: 'Page Label',
              hintText: 'e.g., About Us',
              labelStyle: TextStyle(color: colors.textSecondary),
              hintStyle: TextStyle(color: colors.textTertiary),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: colors.divider),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(
                  color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ),
            ),
            style: TextStyle(color: colors.textPrimary),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _hrefController,
            decoration: InputDecoration(
              labelText: 'URL Path',
              hintText: '/about-us',
              labelStyle: TextStyle(color: colors.textSecondary),
              hintStyle: TextStyle(color: colors.textTertiary),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: colors.divider),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(
                  color: mobile_tokens.LetbuyyColorTokens.brandPrimary,
                ),
              ),
            ),
            style: TextStyle(color: colors.textPrimary),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: Text('Cancel', style: TextStyle(color: colors.textSecondary)),
        ),
        ElevatedButton(
          onPressed: () {
            if (_labelController.text.isNotEmpty) {
              widget.onAdd(_labelController.text, _hrefController.text);
              Navigator.pop(context);
            }
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: mobile_tokens.LetbuyyColorTokens.brandPrimary,
            foregroundColor: Colors.white,
          ),
          child: Text('Add'),
        ),
      ],
    );
  }

  @override
  void dispose() {
    _labelController.dispose();
    _hrefController.dispose();
    super.dispose();
  }
}
