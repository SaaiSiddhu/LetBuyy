import 'package:flutter/material.dart';

DateTime _parseDateTime(dynamic value) {
  if (value is DateTime) return value;
  if (value is String) return DateTime.tryParse(value) ?? DateTime.now();
  final dynamicValue = value;
  if (dynamicValue != null &&
      dynamicValue.runtimeType.toString().contains('Timestamp')) {
    try {
      return dynamicValue.toDate() as DateTime;
    } catch (_) {
      return DateTime.now();
    }
  }
  return DateTime.now();
}

enum SectionType {
  // MVP (P0) - Core sections
  header,
  heroBanner,
  productGrid,
  footer,

  // P1 - Enhanced sections
  featuredProducts,
  testimonials,
  aboutSection,

  // Advanced sections
  collectionFilter,
  newsletter,
  instagramFeed,
  faqAccordion,
  videoHero,
  trustBadges,
}

/// Extension to get display properties for section types
extension SectionTypeExtension on SectionType {
  String get displayName {
    switch (this) {
      case SectionType.header:
        return 'Header';
      case SectionType.heroBanner:
        return 'Hero Banner';
      case SectionType.productGrid:
        return 'Product Grid';
      case SectionType.footer:
        return 'Footer';
      case SectionType.featuredProducts:
        return 'Featured Products';
      case SectionType.testimonials:
        return 'Testimonials';
      case SectionType.aboutSection:
        return 'About Section';
      case SectionType.collectionFilter:
        return 'Collection Filter';
      case SectionType.newsletter:
        return 'Newsletter';
      case SectionType.instagramFeed:
        return 'Instagram Feed';
      case SectionType.faqAccordion:
        return 'FAQ';
      case SectionType.videoHero:
        return 'Video Hero';
      case SectionType.trustBadges:
        return 'Trust Badges';
    }
  }

  String get description {
    switch (this) {
      case SectionType.header:
        return 'Navigation bar with logo, menu, and cart';
      case SectionType.heroBanner:
        return 'Full-width banner with heading and CTA';
      case SectionType.productGrid:
        return 'Grid display of selected products';
      case SectionType.footer:
        return 'Footer with links, social, and contact';
      case SectionType.featuredProducts:
        return 'Showcase featured products in carousel';
      case SectionType.testimonials:
        return 'Customer reviews and testimonials';
      case SectionType.aboutSection:
        return 'About your store or brand story';
      case SectionType.collectionFilter:
        return 'Category filter pills for products';
      case SectionType.newsletter:
        return 'Email subscription form';
      case SectionType.instagramFeed:
        return 'Instagram photo gallery';
      case SectionType.faqAccordion:
        return 'Frequently asked questions';
      case SectionType.videoHero:
        return 'Hero section with background video';
      case SectionType.trustBadges:
        return 'Payment, shipping, and security badges';
    }
  }

  String get iconName {
    switch (this) {
      case SectionType.header:
        return 'view_headline';
      case SectionType.heroBanner:
        return 'image';
      case SectionType.productGrid:
        return 'grid_view';
      case SectionType.footer:
        return 'call_to_action';
      case SectionType.featuredProducts:
        return 'star';
      case SectionType.testimonials:
        return 'format_quote';
      case SectionType.aboutSection:
        return 'info';
      case SectionType.collectionFilter:
        return 'filter_list';
      case SectionType.newsletter:
        return 'mail';
      case SectionType.instagramFeed:
        return 'camera_alt';
      case SectionType.faqAccordion:
        return 'help';
      case SectionType.videoHero:
        return 'videocam';
      case SectionType.trustBadges:
        return 'verified_user';
    }
  }

  /// Whether this section type is premium only
  bool get isPremium {
    switch (this) {
      case SectionType.videoHero:
      case SectionType.instagramFeed:
        return true;
      default:
        return false;
    }
  }

  /// Whether this section is required and cannot be deleted
  bool get isRequired {
    switch (this) {
      case SectionType.header:
      case SectionType.footer:
        return true;
      default:
        return false;
    }
  }

  /// Maximum instances allowed per store
  int get maxInstances {
    switch (this) {
      case SectionType.header:
      case SectionType.footer:
        return 1;
      case SectionType.heroBanner:
      case SectionType.videoHero:
        return 2;
      default:
        return 5;
    }
  }

  /// Icon for this section type
  IconData get icon {
    switch (this) {
      case SectionType.header:
        return Icons.view_headline_rounded;
      case SectionType.heroBanner:
        return Icons.image_rounded;
      case SectionType.productGrid:
        return Icons.grid_view_rounded;
      case SectionType.footer:
        return Icons.call_to_action_rounded;
      case SectionType.featuredProducts:
        return Icons.star_rounded;
      case SectionType.testimonials:
        return Icons.format_quote_rounded;
      case SectionType.aboutSection:
        return Icons.info_rounded;
      case SectionType.collectionFilter:
        return Icons.filter_list_rounded;
      case SectionType.newsletter:
        return Icons.mail_rounded;
      case SectionType.instagramFeed:
        return Icons.camera_alt_rounded;
      case SectionType.faqAccordion:
        return Icons.help_rounded;
      case SectionType.videoHero:
        return Icons.videocam_rounded;
      case SectionType.trustBadges:
        return Icons.verified_user_rounded;
    }
  }
}

/// Model representing a section in the store template
class SectionModel {
  final String id;
  final SectionType type;
  final int order;
  final Map<String, dynamic> settings;
  final List<BlockModel> blocks;
  final bool isVisible;
  final DateTime createdAt;
  final DateTime updatedAt;

  const SectionModel({
    required this.id,
    required this.type,
    required this.order,
    this.settings = const {},
    this.blocks = const [],
    this.isVisible = true,
    required this.createdAt,
    required this.updatedAt,
  });

  /// Create from a gateway/template map.
  factory SectionModel.fromMap(Map<String, dynamic> map) {
    String typeStr = map['type'] as String? ?? '';

    // Normalize legacy types
    final typeMap = {
      'hero': 'heroBanner',
      'product_grid': 'productGrid',
      'featured_collection': 'featuredProducts',
    };
    if (typeMap.containsKey(typeStr)) {
      typeStr = typeMap[typeStr]!;
    }

    return SectionModel(
      id: map['id'] as String? ?? '',
      type: SectionType.values.firstWhere(
        (e) => e.name == typeStr,
        orElse: () => SectionType.heroBanner,
      ),
      order: map['order'] as int? ?? 0,
      settings: Map<String, dynamic>.from(map['settings'] as Map? ?? {}),
      blocks:
          (map['blocks'] as List<dynamic>?)
              ?.map(
                (b) => BlockModel.fromMap(Map<String, dynamic>.from(b as Map)),
              )
              .toList() ??
          [],
      isVisible: map['isVisible'] as bool? ?? true,
      createdAt: _parseDateTime(map['createdAt'] ?? map['created_at']),
      updatedAt: _parseDateTime(map['updatedAt'] ?? map['updated_at']),
    );
  }

  /// Convert to a gateway/template map.
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'type': type.name,
      'order': order,
      'settings': settings,
      'blocks': blocks.map((b) => b.toMap()).toList(),
      'isVisible': isVisible,
      'createdAt': createdAt.toIso8601String(),
      'updatedAt': updatedAt.toIso8601String(),
    };
  }

  /// Create a copy with updated fields
  SectionModel copyWith({
    String? id,
    SectionType? type,
    int? order,
    Map<String, dynamic>? settings,
    List<BlockModel>? blocks,
    bool? isVisible,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return SectionModel(
      id: id ?? this.id,
      type: type ?? this.type,
      order: order ?? this.order,
      settings: settings ?? this.settings,
      blocks: blocks ?? this.blocks,
      isVisible: isVisible ?? this.isVisible,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? DateTime.now(),
    );
  }

  /// Update a specific setting value
  SectionModel updateSetting(String key, dynamic value) {
    final newSettings = Map<String, dynamic>.from(settings);
    newSettings[key] = value;
    return copyWith(settings: newSettings);
  }

  /// Add a block to this section
  SectionModel addBlock(BlockModel block) {
    return copyWith(blocks: [...blocks, block]);
  }

  /// Remove a block from this section
  SectionModel removeBlock(String blockId) {
    return copyWith(blocks: blocks.where((b) => b.id != blockId).toList());
  }

  /// Reorder blocks within this section
  SectionModel reorderBlocks(int oldIndex, int newIndex) {
    final newBlocks = List<BlockModel>.from(blocks);
    final block = newBlocks.removeAt(oldIndex);
    newBlocks.insert(newIndex, block);

    // Update order values
    final reorderedBlocks = newBlocks.asMap().entries.map((entry) {
      return entry.value.copyWith(order: entry.key);
    }).toList();

    return copyWith(blocks: reorderedBlocks);
  }

  @override
  String toString() =>
      'SectionModel(id: $id, type: ${type.name}, order: $order)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is SectionModel &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}

/// Enum defining block types that can be used within sections
enum BlockType {
  // Content blocks
  text,
  heading,
  image,
  video,
  button,
  divider,
  spacer,

  // Navigation blocks
  logo,
  navMenu,
  searchBar,
  cartIcon,

  // Product blocks
  productCard,
  productCarousel,

  // Interactive blocks
  socialLink,
  contactInfo,
  faqItem,
  testimonialCard,

  // Form blocks
  emailInput,
  subscribeButton,
}

/// Extension for block type properties
extension BlockTypeExtension on BlockType {
  String get displayName {
    switch (this) {
      case BlockType.text:
        return 'Text';
      case BlockType.heading:
        return 'Heading';
      case BlockType.image:
        return 'Image';
      case BlockType.video:
        return 'Video';
      case BlockType.button:
        return 'Button';
      case BlockType.divider:
        return 'Divider';
      case BlockType.spacer:
        return 'Spacer';
      case BlockType.logo:
        return 'Logo';
      case BlockType.navMenu:
        return 'Navigation Menu';
      case BlockType.searchBar:
        return 'Search Bar';
      case BlockType.cartIcon:
        return 'Cart Icon';
      case BlockType.productCard:
        return 'Product Card';
      case BlockType.productCarousel:
        return 'Product Carousel';
      case BlockType.socialLink:
        return 'Social Link';
      case BlockType.contactInfo:
        return 'Contact Info';
      case BlockType.faqItem:
        return 'FAQ Item';
      case BlockType.testimonialCard:
        return 'Testimonial';
      case BlockType.emailInput:
        return 'Email Input';
      case BlockType.subscribeButton:
        return 'Subscribe Button';
    }
  }

  /// Icon for this block type
  IconData get icon {
    switch (this) {
      case BlockType.text:
        return Icons.text_fields_rounded;
      case BlockType.heading:
        return Icons.title_rounded;
      case BlockType.image:
        return Icons.image_rounded;
      case BlockType.video:
        return Icons.videocam_rounded;
      case BlockType.button:
        return Icons.smart_button_rounded;
      case BlockType.divider:
        return Icons.horizontal_rule_rounded;
      case BlockType.spacer:
        return Icons.space_bar_rounded;
      case BlockType.logo:
        return Icons.branding_watermark_rounded;
      case BlockType.navMenu:
        return Icons.menu_rounded;
      case BlockType.searchBar:
        return Icons.search_rounded;
      case BlockType.cartIcon:
        return Icons.shopping_cart_rounded;
      case BlockType.productCard:
        return Icons.inventory_2_rounded;
      case BlockType.productCarousel:
        return Icons.view_carousel_rounded;
      case BlockType.socialLink:
        return Icons.link_rounded;
      case BlockType.contactInfo:
        return Icons.contact_mail_rounded;
      case BlockType.faqItem:
        return Icons.help_outline_rounded;
      case BlockType.testimonialCard:
        return Icons.rate_review_rounded;
      case BlockType.emailInput:
        return Icons.email_rounded;
      case BlockType.subscribeButton:
        return Icons.send_rounded;
    }
  }
}

class BlockModel {
  final String id;
  final BlockType type;
  final int order;
  final Map<String, dynamic> settings;
  final bool isVisible;

  const BlockModel({
    required this.id,
    required this.type,
    required this.order,
    this.settings = const {},
    this.isVisible = true,
  });

  /// Create from a gateway/template map.
  factory BlockModel.fromMap(Map<String, dynamic> map) {
    return BlockModel(
      id: map['id'] as String? ?? '',
      type: BlockType.values.firstWhere(
        (e) => e.name == (map['type'] as String?),
        orElse: () => BlockType.text,
      ),
      order: map['order'] as int? ?? 0,
      settings: Map<String, dynamic>.from(map['settings'] as Map? ?? {}),
      isVisible: map['isVisible'] as bool? ?? true,
    );
  }

  /// Convert to a gateway/template map.
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'type': type.name,
      'order': order,
      'settings': settings,
      'isVisible': isVisible,
    };
  }

  /// Create a copy with updated fields
  BlockModel copyWith({
    String? id,
    BlockType? type,
    int? order,
    Map<String, dynamic>? settings,
    bool? isVisible,
  }) {
    return BlockModel(
      id: id ?? this.id,
      type: type ?? this.type,
      order: order ?? this.order,
      settings: settings ?? this.settings,
      isVisible: isVisible ?? this.isVisible,
    );
  }

  /// Update a specific setting value
  BlockModel updateSetting(String key, dynamic value) {
    final newSettings = Map<String, dynamic>.from(settings);
    newSettings[key] = value;
    return copyWith(settings: newSettings);
  }

  @override
  String toString() => 'BlockModel(id: $id, type: ${type.name}, order: $order)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is BlockModel && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
