import 'package:flutter/material.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart' as mobile_tokens;
import '../../theme/app_theme_colors.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import '../../models/store_model.dart';
import '../shared/cached_merchant_image.dart';
import '../shared/image_picker_widget.dart';

/// Bottom sheet for editing section settings
class SectionSettingsSheet extends StatefulWidget {
  final SectionModel section;
  final StoreModel? store;
  final ValueChanged<SectionModel> onSave;

  const SectionSettingsSheet({
    super.key,
    required this.section,
    this.store,
    required this.onSave,
  });

  static Future<SectionModel?> show(
    BuildContext context, {
    required SectionModel section,
    StoreModel? store,
  }) async {
    return showModalBottomSheet<SectionModel>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => SectionSettingsSheet(
        section: section,
        store: store,
        onSave: (updated) => Navigator.pop(context, updated),
      ),
    );
  }

  @override
  State<SectionSettingsSheet> createState() => _SectionSettingsSheetState();
}

class _SectionSettingsSheetState extends State<SectionSettingsSheet> {
  late Map<String, dynamic> _settings;
  late AppThemeColors colors;

  @override
  void initState() {
    super.initState();
    _settings = Map.from(widget.section.settings);

    // Migration: Hero Banner to Carousel list
    if (widget.section.type == SectionType.heroBanner) {
      if (_settings['banners'] == null) {
        // If has legacy data, migrate it to first slide
        if (_settings['heading'] != null || _settings['imageUrl'] != null) {
          _settings['banners'] = [
            {
              'imageUrl': _settings['imageUrl'],
              'heading': _settings['heading'],
              'subheading': _settings['subheading'],
              'buttonText': _settings['buttonText'],
              'buttonLink': _settings['buttonLink'],
            },
          ];
        } else {
          _settings['banners'] = [];
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    // 65% height for footer, 90% for others
    final isFooter = widget.section.type == SectionType.footer;
    final heightFactor = isFooter ? 0.65 : 0.9;

    return Container(
      height: MediaQuery.of(context).size.height * heightFactor,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: colors.divider),
      ),
      child: Column(
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

          // Header with navigation
          Container(
            padding: const EdgeInsets.fromLTRB(20, 16, 16, 12),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: colors.divider)),
            ),
            child: Row(
              children: [
                // Section icon
                Container(
                  width: 48,
                  height: 48,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        mobile_tokens.LetbuyyColorTokens.brandPrimary
                            .withValues(alpha: 0.3),
                        const Color(0xFF818CF8).withValues(alpha: 0.1),
                      ],
                    ),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    widget.section.type.icon,
                    color: const Color(0xFF818CF8),
                    size: 24,
                  ),
                ),
                const SizedBox(width: 14),

                // Title
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.section.type.displayName,
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: colors.textPrimary,
                          letterSpacing: -0.3,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Customize this section',
                        style: TextStyle(
                          color: colors.textTertiary,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),

                // Close button
                IconButton(
                  icon: Container(
                    padding: const EdgeInsets.all(6),
                    decoration: BoxDecoration(
                      color: colors.surfaceVariant,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      Icons.close_rounded,
                      color: colors.textSecondary,
                      size: 18,
                    ),
                  ),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),

          // Settings form
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                ..._buildSettingsFields(),
                const SizedBox(height: 40), // Bottom padding
              ],
            ),
          ),

          // Save button
          SafeArea(
            child: Container(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
              decoration: BoxDecoration(
                color: colors.card,
                border: Border(top: BorderSide(color: colors.divider)),
              ),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _save,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: mobile_tokens
                        .LetbuyyColorTokens
                        .brandPrimary, // Indigo accent
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  child: const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.check_rounded, size: 20),
                      SizedBox(width: 8),
                      Text(
                        'Save Changes',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          fontSize: 15,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // --- Preview Logic ---
  Widget _getSectionPreview() {
    switch (widget.section.type) {
      case SectionType.header:
        // ... (Header logic same as before)
        final s = _settings;
        final logoUrl = widget.store?.logoUrl;
        final name = widget.store?.name ?? 'My Store';
        final showLogo = s['showLogo'] != false;
        final showName = s['showName'] != false;
        final showSearch = s['showSearch'] != false;
        final showCart = s['showCart'] != false;
        final logoHeight =
            double.tryParse(s['logoHeight']?.toString() ?? '28') ?? 28.0;

        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: const BoxDecoration(
            color: Colors.white,
            border: Border(bottom: BorderSide(color: Color(0xFFEEEEEE))),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              SizedBox(
                height: 44,
                child: Stack(
                  alignment: Alignment.center,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.menu,
                          size: 24,
                          color: AppColors.textPrimary,
                        ),
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (showSearch) ...[
                              Icon(
                                Icons.search,
                                size: 22,
                                color: AppColors.textPrimary,
                              ),
                              const SizedBox(width: 12),
                            ],
                            if (showCart)
                              Icon(
                                Icons.shopping_bag_outlined,
                                size: 22,
                                color: AppColors.textPrimary,
                              ),
                          ],
                        ),
                      ],
                    ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (showLogo) ...[
                          if (logoUrl != null && logoUrl.isNotEmpty)
                            CachedMerchantImage(
                              imageUrl: logoUrl,
                              height: logoHeight,
                              placeholderBuilder: (_) => const SizedBox(),
                              errorBuilder: (_) => Icon(
                                Icons.store,
                                color: AppColors.primary,
                                size: 24,
                              ),
                            )
                          else
                            Icon(
                              Icons.store,
                              size: 24,
                              color: AppColors.primary,
                            ),
                          if (showName) const SizedBox(width: 8),
                        ],
                        if (showName)
                          Text(
                            name,
                            style: TextStyle(
                              fontWeight: FontWeight.bold,
                              fontSize: 16,
                              color: Colors.black87,
                              letterSpacing: -0.5,
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        );

      case SectionType.heroBanner:
        // Carousel Preview: Show First Banner
        final banners = _settings['banners'] as List?;
        final firstBanner = (banners != null && banners.isNotEmpty)
            ? banners.first
            : null;
        final imageUrl = firstBanner != null ? firstBanner['imageUrl'] : null;
        final heading = firstBanner != null
            ? firstBanner['heading']
            : 'Promotional Banner';
        final subheading = firstBanner != null
            ? firstBanner['subheading']
            : 'Add a slide to customize';
        final buttonText = firstBanner != null
            ? firstBanner['buttonText']
            : 'Shop Now';

        return Container(
          height: 120,
          decoration: BoxDecoration(
            image: imageUrl != null && imageUrl.toString().isNotEmpty
                ? DecorationImage(
                    image: cachedMerchantImageProvider(imageUrl),
                    fit: BoxFit.cover,
                    colorFilter: ColorFilter.mode(
                      Colors.black.withValues(alpha: 0.3),
                      BlendMode.darken,
                    ),
                  )
                : DecorationImage(
                    image: cachedMerchantImageProvider(
                      'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800',
                    ),
                    fit: BoxFit.cover,
                  ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                heading ?? 'Welcome',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  shadows: [Shadow(color: Colors.black45, blurRadius: 4)],
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 4),
              Text(
                subheading ?? '',
                style: TextStyle(color: Colors.white70, fontSize: 10),
                textAlign: TextAlign.center,
              ),
              if (buttonText != null && buttonText.isNotEmpty) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 4,
                  ),
                  color: Colors.white,
                  child: Text(
                    buttonText,
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ],
          ),
        );

      default:
        return Container(
          width: double.infinity,
          height: 80,
          alignment: Alignment.center,
          child: Text(
            'Preview not available for ${widget.section.type.displayName}',
            style: TextStyle(color: Colors.grey, fontSize: 12),
          ),
        );
    }
  }

  List<Widget> _buildSettingsFields() {
    final fields = <Widget>[];

    // Skip section title for footer (uses contactEmail instead)
    if (widget.section.type != SectionType.footer) {
      fields.add(
        _buildTextField(
          label: 'Section Title',
          key: 'title',
          hint: 'Enter section title...',
        ),
      );
      fields.add(const SizedBox(height: 16));
    }

    switch (widget.section.type) {
      case SectionType.header:
        fields.addAll(_buildHeaderSettings());
        break;
      case SectionType.footer:
        fields.addAll(_buildFooterSettings());
        break;
      case SectionType.heroBanner:
        fields.addAll(_buildHeroSettings());
        break;
      case SectionType.productGrid:
        fields.addAll(_buildProductGridSettings());
        break;
      case SectionType.featuredProducts:
        fields.addAll(_buildCollectionSettings());
        break;
      case SectionType.testimonials:
        fields.addAll(_buildTestimonialsSettings());
        break;
      case SectionType.newsletter:
        fields.addAll(_buildNewsletterSettings());
        break;
      default:
        fields.add(
          _buildTextField(
            label: 'Subtitle',
            key: 'subtitle',
            hint: 'Enter subtitle...',
          ),
        );
    }

    return fields;
  }

  // --- MODIFIED HERO SETTINGS (CAROUSEL) ---
  List<Widget> _buildHeroSettings() {
    final banners = (_settings['banners'] as List?) ?? [];

    return [
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Banners',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          TextButton.icon(
            onPressed: banners.length < 5
                ? () => _editBanner(null)
                : null, // Limit 5
            icon: const Icon(Icons.add, size: 16),
            label: Text('Add Slide'),
            style: TextButton.styleFrom(
              // disabledForegroundColor: Colors.grey,
            ),
          ),
        ],
      ),
      const SizedBox(height: 8),
      if (banners.isEmpty)
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.grey[50],
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey[200]!),
          ),
          child: const Center(
            child: Text(
              'No banners added. Add a slide to get started.',
              style: TextStyle(color: Colors.grey),
            ),
          ),
        )
      else
        ReorderableListView(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          children: [
            for (int i = 0; i < banners.length; i++)
              ListTile(
                key: ValueKey('banner_$i'),
                contentPadding: EdgeInsets.zero,
                leading: Container(
                  width: 50,
                  height: 50,
                  decoration: BoxDecoration(
                    color: Colors.grey[200],
                    borderRadius: BorderRadius.circular(8),
                    image: banners[i]['imageUrl'] != null
                        ? DecorationImage(
                            image: cachedMerchantImageProvider(
                              banners[i]['imageUrl'],
                            ),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                  child: banners[i]['imageUrl'] == null
                      ? const Icon(Icons.image, color: Colors.grey)
                      : null,
                ),
                title: Text(
                  banners[i]['heading'] ?? 'Banner ${i + 1}',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
                ),
                subtitle: Text(
                  banners[i]['subheading'] ?? 'No subtitle',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(fontSize: 12),
                ),
                trailing: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(Icons.edit_outlined, size: 20),
                      onPressed: () => _editBanner(i),
                    ),
                    IconButton(
                      icon: const Icon(
                        Icons.delete_outline,
                        size: 20,
                        color: Colors.red,
                      ),
                      onPressed: () {
                        setState(() {
                          banners.removeAt(i);
                          _settings['banners'] = banners;
                        });
                      },
                    ),
                    const Icon(Icons.drag_handle, color: Colors.grey),
                  ],
                ),
              ),
          ],
          onReorder: (oldIndex, newIndex) {
            setState(() {
              if (oldIndex < newIndex) newIndex -= 1;
              final item = banners.removeAt(oldIndex);
              banners.insert(newIndex, item);
              _settings['banners'] = banners;
            });
          },
        ),

      const SizedBox(height: 24),
      _buildDropdown(
        label: 'Height',
        key: 'height',
        options: {
          'small': 'Small (400px)',
          'medium': 'Medium (600px)',
          'large': 'Large (800px)',
          'full': 'Full Screen',
        },
      ),
      const SizedBox(height: 16),
      _buildDropdown(
        label: 'Text Align',
        key: 'textAlign',
        options: {'left': 'Left', 'center': 'Center', 'right': 'Right'},
      ),

      // Carousel Settings
      const SizedBox(height: 24),
      const Divider(),
      const SizedBox(height: 16),
      Text(
        'Carousel Settings',
        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
      ),
      const SizedBox(height: 12),
      _buildSwitch(label: 'Autoplay', key: 'autoplay'),
      const SizedBox(height: 12),
      _buildDropdown(
        label: 'Autoplay Interval',
        key: 'autoplayInterval',
        options: {
          '3000': '3 seconds',
          '5000': '5 seconds',
          '7000': '7 seconds',
          '10000': '10 seconds',
        },
      ),
      const SizedBox(height: 12),
      _buildSwitch(label: 'Show Indicators', key: 'showIndicators'),
      const SizedBox(height: 12),
      _buildSwitch(label: 'Show Arrows', key: 'showArrows'),
      const SizedBox(height: 20),
    ];
  }

  void _editBanner(int? index) async {
    final banners = (_settings['banners'] as List?) ?? [];
    final currentData = index != null ? banners[index] : <String, dynamic>{};

    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _BannerEditSheet(data: currentData),
    );

    if (result != null) {
      if (result['delete'] == true && index != null) {
        setState(() {
          banners.removeAt(index);
          _settings['banners'] = banners;
        });
      } else {
        setState(() {
          if (index != null) {
            banners[index] = result;
          } else {
            banners.add(result);
          }
          _settings['banners'] = banners;
        });
      }
    }
  }

  // ... (Other build methods same as before)
  List<Widget> _buildProductGridSettings() {
    return [
      Text(
        'Layout',
        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
      ),
      const SizedBox(height: 12),

      _buildDropdown(
        label: 'Desktop Columns',
        key: 'columns',
        options: {
          '2': '2 columns',
          '3': '3 columns',
          '4': '4 columns',
          '5': '5 columns',
        },
      ),
      const SizedBox(height: 16),

      _buildDropdown(
        label: 'Mobile Columns',
        key: 'mobileColumns',
        options: {'1': '1 column', '2': '2 columns'},
      ),
      const SizedBox(height: 16),

      _buildDropdown(
        label: 'Aspect Ratio',
        key: 'aspectRatio',
        options: {
          'square': 'Square (1:1)',
          'portrait': 'Portrait (3:4)',
          'landscape': 'Landscape (4:3)',
        },
      ),
      const SizedBox(height: 16),

      Text(
        'Style',
        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
      ),
      const SizedBox(height: 12),

      _buildDropdown(
        label: 'Card Style',
        key: 'cardStyle',
        options: {
          'minimal': 'Minimal',
          'bordered': 'Bordered',
          'shadow': 'Shadow / Elevated',
        },
      ),
      const SizedBox(height: 16),

      Text(
        'Spacing',
        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
      ),
      Slider(
        value: (double.tryParse(_settings['gap']?.toString() ?? '24') ?? 24.0)
            .clamp(8.0, 48.0),
        min: 8,
        max: 48,
        divisions: 5, // 8, 16, 24, 32, 40, 48
        label:
            '${(double.tryParse(_settings['gap']?.toString() ?? '24') ?? 24.0).round()}px',
        activeColor: AppColors.lavender,
        inactiveColor: colors.divider,
        onChanged: (value) {
          setState(() {
            _settings['gap'] = value.round();
          });
        },
      ),
      const SizedBox(height: 16),

      Text(
        'Content',
        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
      ),
      const SizedBox(height: 8),

      _buildDropdown(
        label: 'Max Products',
        key: 'maxProducts',
        options: {
          '4': '4 products',
          '8': '8 products',
          '12': '12 products',
          '16': '16 products',
          '20': '20 products',
        },
      ),
      const SizedBox(height: 16),

      _buildSwitch(label: 'Show Price', key: 'showPrice'),
      _buildSwitch(label: 'Show Rating', key: 'showRating'),
      _buildSwitch(label: 'Show Add to Cart', key: 'showAddToCart'),
    ];
  }

  List<Widget> _buildCollectionSettings() {
    return [
      _buildTextField(
        label: 'Collection Name',
        key: 'collectionName',
        hint: 'Featured Products',
      ),
      const SizedBox(height: 16),
      _buildDropdown(
        label: 'Layout',
        key: 'layout',
        options: {'grid': 'Grid', 'carousel': 'Carousel', 'list': 'List'},
      ),
    ];
  }

  List<Widget> _buildTestimonialsSettings() {
    return [
      _buildSwitch(label: 'Show Rating Stars', key: 'showRating'),
      _buildSwitch(label: 'Show Customer Photo', key: 'showPhoto'),
      _buildDropdown(
        label: 'Layout',
        key: 'layout',
        options: {'carousel': 'Carousel', 'grid': 'Grid'},
      ),
    ];
  }

  List<Widget> _buildNewsletterSettings() {
    return [
      _buildTextField(
        label: 'Heading',
        key: 'heading',
        hint: 'Subscribe to our newsletter',
      ),
      const SizedBox(height: 16),
      _buildTextField(
        label: 'Description',
        key: 'description',
        hint: 'Get updates on new products and sales',
        maxLines: 2,
      ),
      const SizedBox(height: 16),
      _buildTextField(
        label: 'Button Text',
        key: 'buttonText',
        hint: 'Subscribe',
      ),
    ];
  }

  List<Widget> _buildHeaderSettings() {
    return [
      _buildSwitch(label: 'Sticky Header', key: 'sticky'),
      const SizedBox(height: 16),
      Text(
        'Branding',
        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
      ),
      const SizedBox(height: 8),
      _buildSwitch(label: 'Show Logo', key: 'showLogo'),
      _buildSwitch(label: 'Show Store Name', key: 'showName'),
      const SizedBox(height: 8),
      Text(
        'Logo Height',
        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
      ),
      Slider(
        value:
            (double.tryParse(_settings['logoHeight']?.toString() ?? '28') ??
                    28.0)
                .clamp(20.0, 60.0),
        min: 20,
        max: 60,
        divisions: 40,
        label:
            '${(double.tryParse(_settings['logoHeight']?.toString() ?? '28') ?? 28.0).clamp(20.0, 60.0).round()}px',
        activeColor: AppColors.lavender,
        inactiveColor: colors.divider,
        onChanged: (value) {
          setState(() {
            _settings['logoHeight'] = value.round();
          });
        },
      ),

      const SizedBox(height: 16),
      Text(
        'Navigation',
        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
      ),
      const SizedBox(height: 8),
      _buildSwitch(label: 'Show "Home" Link', key: 'showHome'),
      _buildSwitch(label: 'Show "Shop" Link', key: 'showShop'),
      _buildSwitch(label: 'Show "Products" Link', key: 'showProducts'),
      _buildSwitch(label: 'Show "About" Link', key: 'showAbout'),
      _buildSwitch(label: 'Show "Contact" Link', key: 'showContact'),
      const SizedBox(height: 16),
      Text(
        'Icons',
        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
      ),
      const SizedBox(height: 8),
      _buildSwitch(label: 'Show Search Icon', key: 'showSearch'),
      _buildSwitch(label: 'Show Cart Icon', key: 'showCart'),
    ];
  }

  List<Widget> _buildFooterSettings() {
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

    return [
      // Contact Email - using standard text field style
      _buildIconTextField(
        label: 'Contact Email',
        key: 'contactEmail',
        icon: FontAwesomeIcons.envelope,
        hint: 'help@yourstore.com',
      ),

      const SizedBox(height: 16),

      // Show Social Links toggle - using standard switch style
      _buildSwitch(label: 'Show Social Links', key: 'showSocial'),

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

      // Social Link Fields - using standard text field style with icons
      ...socialPlatforms.map(
        (p) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: _buildIconTextField(
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
            const Icon(Icons.info_outline, size: 16, color: Color(0xFF818CF8)),
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
    ];
  }

  /// Icon text field matching standard _buildTextField style
  Widget _buildIconTextField({
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
          onChanged: (value) => setState(() => _settings[key] = value),
        ),
      ],
    );
  }

  Widget _buildTextField({
    required String label,
    required String key,
    String? hint,
    int maxLines = 1,
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
          maxLines: maxLines,
          onChanged: (value) => setState(() => _settings[key] = value),
        ),
      ],
    );
  }

  Widget _buildDropdown({
    required String label,
    required String key,
    required Map<String, String> options,
  }) {
    final currentValue = _settings[key]?.toString();
    final validValue = options.containsKey(currentValue)
        ? currentValue
        : options.keys.first;

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
        DropdownButtonFormField<String>(
          value: validValue,
          dropdownColor: colors.card,
          style: TextStyle(color: colors.textPrimary, fontSize: 15),
          decoration: InputDecoration(
            filled: true,
            fillColor: colors.surfaceVariant,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: colors.divider, width: 1),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 14,
            ),
          ),
          items: options.entries
              .map(
                (e) => DropdownMenuItem(
                  value: e.key,
                  child: Text(
                    e.value,
                    style: TextStyle(color: colors.textPrimary),
                  ),
                ),
              )
              .toList(),
          onChanged: (value) => setState(() => _settings[key] = value),
        ),
      ],
    );
  }

  Widget _buildSwitch({required String label, required String key}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(fontSize: 14, color: colors.textSecondary),
          ),
          Switch(
            value: _settings[key] != false,
            onChanged: (value) => setState(() => _settings[key] = value),
            activeColor: const Color(0xFF818CF8),
            activeTrackColor: mobile_tokens.LetbuyyColorTokens.brandPrimary
                .withValues(alpha: 0.3),
            inactiveThumbColor: colors.textTertiary,
            inactiveTrackColor: colors.divider,
          ),
        ],
      ),
    );
  }

  void _save() {
    final updated = widget.section.copyWith(settings: _settings);
    widget.onSave(updated);
  }
}

class _BannerEditSheet extends StatefulWidget {
  final Map<String, dynamic> data;

  const _BannerEditSheet({required this.data});

  @override
  State<_BannerEditSheet> createState() => _BannerEditSheetState();
}

class _BannerEditSheetState extends State<_BannerEditSheet> {
  late Map<String, dynamic> _data;

  @override
  void initState() {
    super.initState();
    _data = Map.from(widget.data);
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppThemeColors.of(context);
    return Container(
      height: MediaQuery.of(context).size.height * 0.9,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          const SizedBox(height: 12),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey[300],
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Edit Slide',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                IconButton(
                  icon: const Icon(Icons.check, color: AppColors.primary),
                  onPressed: () => Navigator.pop(context, _data),
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.all(20),
              children: [
                ImagePickerWidget(
                  initialUrl: _data['imageUrl'],
                  onChanged: (url) => setState(() => _data['imageUrl'] = url),
                ),
                const SizedBox(height: 24),
                _input('Heading', 'heading', 'Winter Sale'),
                const SizedBox(height: 16),
                _input('Subheading', 'subheading', 'Get 50% off', maxLines: 2),
                const SizedBox(height: 16),
                Row(
                  children: [
                    Expanded(
                      child: _input('Button Text', 'buttonText', 'Shop Now'),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: _input('Button Link', 'buttonLink', '/shop'),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                // Could add color pickers here later
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _input(String label, String key, String hint, {int maxLines = 1}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontWeight: FontWeight.w600,
            fontSize: 13,
            color: Colors.grey,
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          initialValue: _data[key],
          maxLines: maxLines,
          decoration: InputDecoration(
            hintText: hint,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 12,
              vertical: 12,
            ),
          ),
          onChanged: (v) => _data[key] = v,
        ),
      ],
    );
  }
}
