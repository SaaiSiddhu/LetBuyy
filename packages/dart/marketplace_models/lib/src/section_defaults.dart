import 'package:uuid/uuid.dart';
import 'section_model.dart';

/// Default configurations for all section types
/// These provide starting configurations when a user adds a new section
class SectionDefaults {
  SectionDefaults._();
  
  static const _uuid = Uuid();

  /// Create a new section with default settings for the given type
  static SectionModel createDefault(SectionType type) {
    final now = DateTime.now();
    final id = _uuid.v4();
    
    return SectionModel(
      id: id,
      type: type,
      order: 0,
      settings: _getDefaultSettings(type),
      blocks: _getDefaultBlocks(type),
      isVisible: true,
      createdAt: now,
      updatedAt: now,
    );
  }

  /// Get default settings for a section type
  static Map<String, dynamic> _getDefaultSettings(SectionType type) {
    switch (type) {
      case SectionType.header:
        return HeaderSettings.defaults;
      case SectionType.heroBanner:
        return HeroBannerSettings.defaults;
      case SectionType.productGrid:
        return ProductGridSettings.defaults;
      case SectionType.footer:
        return FooterSettings.defaults;
      case SectionType.featuredProducts:
        return FeaturedProductsSettings.defaults;
      case SectionType.testimonials:
        return TestimonialsSettings.defaults;
      case SectionType.aboutSection:
        return AboutSectionSettings.defaults;
      case SectionType.collectionFilter:
        return CollectionFilterSettings.defaults;
      case SectionType.newsletter:
        return NewsletterSettings.defaults;
      case SectionType.instagramFeed:
        return InstagramFeedSettings.defaults;
      case SectionType.faqAccordion:
        return FaqAccordionSettings.defaults;
      case SectionType.videoHero:
        return VideoHeroSettings.defaults;
      case SectionType.trustBadges:
        return TrustBadgesSettings.defaults;
    }
  }

  /// Get default blocks for a section type
  static List<BlockModel> _getDefaultBlocks(SectionType type) {
    switch (type) {
      case SectionType.header:
        return _createHeaderBlocks();
      case SectionType.footer:
        return _createFooterBlocks();
      case SectionType.faqAccordion:
        return _createFaqBlocks();
      case SectionType.testimonials:
        return _createTestimonialBlocks();
      case SectionType.trustBadges:
        return _createTrustBadgeBlocks();
      default:
        return [];
    }
  }

  static List<BlockModel> _createHeaderBlocks() {
    return [
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.logo,
        order: 0,
        settings: {'size': 'medium', 'position': 'left'},
      ),
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.navMenu,
        order: 1,
        settings: {
          'items': ['Home', 'Products', 'About', 'Contact'],
          'style': 'horizontal',
        },
      ),
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.searchBar,
        order: 2,
        settings: {'placeholder': 'Search products...', 'showIcon': true},
      ),
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.cartIcon,
        order: 3,
        settings: {'showCount': true},
      ),
    ];
  }

  static List<BlockModel> _createFooterBlocks() {
    return [
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.logo,
        order: 0,
        settings: {'size': 'small', 'showTagline': true},
      ),
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.navMenu,
        order: 1,
        settings: {
          'items': ['Privacy Policy', 'Terms of Service', 'Shipping', 'Returns'],
          'style': 'vertical',
          'title': 'Quick Links',
        },
      ),
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.contactInfo,
        order: 2,
        settings: {
          'showEmail': true,
          'showPhone': true,
          'showAddress': true,
          'title': 'Contact Us',
        },
      ),
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.socialLink,
        order: 3,
        settings: {
          'platforms': ['instagram', 'facebook', 'twitter'],
          'style': 'icons',
          'title': 'Follow Us',
        },
      ),
    ];
  }

  static List<BlockModel> _createFaqBlocks() {
    return [
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.faqItem,
        order: 0,
        settings: {
          'question': 'What is your return policy?',
          'answer': 'We offer a 30-day return policy for all products.',
        },
      ),
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.faqItem,
        order: 1,
        settings: {
          'question': 'How long does shipping take?',
          'answer': 'Standard shipping takes 5-7 business days.',
        },
      ),
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.faqItem,
        order: 2,
        settings: {
          'question': 'Do you offer international shipping?',
          'answer': 'Yes, we ship to most countries worldwide.',
        },
      ),
    ];
  }

  static List<BlockModel> _createTestimonialBlocks() {
    return [
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.testimonialCard,
        order: 0,
        settings: {
          'name': 'Customer Name',
          'text': 'Great products and excellent service!',
          'rating': 5,
          'image': '',
        },
      ),
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.testimonialCard,
        order: 1,
        settings: {
          'name': 'Another Customer',
          'text': 'Fast delivery and quality items. Highly recommended!',
          'rating': 5,
          'image': '',
        },
      ),
    ];
  }

  static List<BlockModel> _createTrustBadgeBlocks() {
    return [
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.image,
        order: 0,
        settings: {
          'icon': 'security',
          'label': 'Secure Payments',
          'description': 'SSL encrypted checkout',
        },
      ),
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.image,
        order: 1,
        settings: {
          'icon': 'local_shipping',
          'label': 'Free Shipping',
          'description': 'On orders over ₹500',
        },
      ),
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.image,
        order: 2,
        settings: {
          'icon': 'refresh',
          'label': 'Easy Returns',
          'description': '30-day return policy',
        },
      ),
      BlockModel(
        id: _uuid.v4(),
        type: BlockType.image,
        order: 3,
        settings: {
          'icon': 'support_agent',
          'label': '24/7 Support',
          'description': 'Always here to help',
        },
      ),
    ];
  }
}

/// Settings configuration for Header section
class HeaderSettings {
  static const Map<String, dynamic> defaults = {
    'sticky': true,
    'transparent': false,
    'showSearch': true,
    'showCart': true,
    'showAccount': false,
    'logoPosition': 'left', // left, center, right
    'menuPosition': 'center', // left, center, right
    'height': 'medium', // small, medium, large
    'backgroundColor': null, // null = use theme
    'textColor': null,
  };

  static const Map<String, String> descriptions = {
    'sticky': 'Header stays at top when scrolling',
    'transparent': 'Transparent background on hero',
    'showSearch': 'Show search bar',
    'showCart': 'Show cart icon',
    'showAccount': 'Show account icon',
  };
}

/// Settings configuration for Hero Banner section
class HeroBannerSettings {
  static const Map<String, dynamic> defaults = {
    'image': '',
    'heading': 'Welcome to Our Store',
    'subheading': 'Discover amazing products at great prices',
    'ctaText': 'Shop Now',
    'ctaLink': '/products',
    'ctaStyle': 'primary', // primary, secondary, outline
    'overlay': 0.4, // 0.0 to 1.0
    'overlayColor': '#000000',
    'height': 'full', // full, large, medium, small
    'textAlign': 'center', // left, center, right
    'textPosition': 'center', // top, center, bottom
    'animation': 'fade', // none, fade, slide, zoom
  };

  static const Map<String, String> descriptions = {
    'image': 'Background image for the banner',
    'heading': 'Main heading text',
    'subheading': 'Subtitle under the heading',
    'ctaText': 'Call-to-action button text',
    'ctaLink': 'Button link destination',
    'overlay': 'Dark overlay opacity',
    'height': 'Banner height',
  };
}

/// Settings configuration for Product Grid section
class ProductGridSettings {
  static const Map<String, dynamic> defaults = {
    'title': 'Our Products',
    'subtitle': '',
    'columns': 4, // 2, 3, 4, 5, 6
    'columnsTablet': 3,
    'columnsMobile': 2,
    'rows': 2,
    'showTitle': true,
    'showPrice': true,
    'showRating': true,
    'showAddToCart': true,
    'showQuickView': false,
    'productIds': <String>[], // specific product IDs to show
    'sortBy': 'newest', // newest, price_low, price_high, popular
    'cardStyle': 'standard', // standard, minimal, detailed
    'spacing': 'medium', // small, medium, large
  };

  static const Map<String, String> descriptions = {
    'columns': 'Number of products per row',
    'rows': 'Number of rows to display',
    'showPrice': 'Display product prices',
    'showRating': 'Display star ratings',
    'showAddToCart': 'Show add to cart button',
  };
}

/// Settings configuration for Footer section
class FooterSettings {
  static const Map<String, dynamic> defaults = {
    'columns': 4,
    'showLogo': true,
    'showNewsletter': false,
    'showSocial': true,
    'showPaymentIcons': true,
    'copyrightText': null, // Auto-generates: © {year} {store_name}
    'backgroundColor': null,
    'textColor': null,
    'spacing': 'medium',
    
    // Social Links - URLs (empty = hidden)
    'instagramUrl': '',
    'twitterUrl': '',
    'facebookUrl': '',
    'whatsappUrl': '',
    'telegramUrl': '',
    'youtubeUrl': '',
    
    // Contact
    'contactEmail': '',
  };
}

/// Settings configuration for Featured Products section
class FeaturedProductsSettings {
  static const Map<String, dynamic> defaults = {
    'title': 'Featured Products',
    'subtitle': 'Handpicked items just for you',
    'layout': 'carousel', // carousel, grid
    'productIds': <String>[],
    'autoplay': true,
    'autoplayInterval': 5, // seconds
    'showArrows': true,
    'showDots': true,
    'itemsToShow': 4,
    'itemsToShowTablet': 3,
    'itemsToShowMobile': 1,
  };
}

/// Settings configuration for Testimonials section
class TestimonialsSettings {
  static const Map<String, dynamic> defaults = {
    'title': 'What Our Customers Say',
    'subtitle': '',
    'layout': 'carousel', // carousel, grid, masonry
    'autoplay': true,
    'autoplayInterval': 6,
    'showArrows': true,
    'showDots': true,
    'showRating': true,
    'showImage': true,
    'cardStyle': 'standard', // standard, minimal, quote
  };
}

/// Settings configuration for About Section
class AboutSectionSettings {
  static const Map<String, dynamic> defaults = {
    'heading': 'About Our Store',
    'content': 'Tell your story here. Share what makes your store unique and why customers should shop with you.',
    'image': '',
    'imagePosition': 'right', // left, right
    'showButton': false,
    'buttonText': 'Learn More',
    'buttonLink': '/about',
    'layout': 'side-by-side', // side-by-side, stacked
  };
}

/// Settings configuration for Collection Filter section
class CollectionFilterSettings {
  static const Map<String, dynamic> defaults = {
    'title': 'Shop by Category',
    'showAllOption': true,
    'allOptionText': 'All Products',
    'layout': 'pills', // pills, dropdown, sidebar
    'categoryIds': <String>[],
    'showCount': false,
    'multiSelect': false,
  };
}

/// Settings configuration for Newsletter section
class NewsletterSettings {
  static const Map<String, dynamic> defaults = {
    'heading': 'Subscribe to Our Newsletter',
    'subheading': 'Get updates on new products and exclusive offers',
    'buttonText': 'Subscribe',
    'placeholderText': 'Enter your email',
    'successMessage': 'Thank you for subscribing!',
    'layout': 'inline', // inline, stacked
    'showIcon': true,
    'backgroundColor': null,
  };
}

/// Settings configuration for Instagram Feed section
class InstagramFeedSettings {
  static const Map<String, dynamic> defaults = {
    'title': 'Follow Us on Instagram',
    'username': '',
    'columns': 6,
    'columnsMobile': 3,
    'rows': 1,
    'showOverlay': true,
    'showCaption': false,
    'openInNewTab': true,
  };
}

/// Settings configuration for FAQ Accordion section
class FaqAccordionSettings {
  static const Map<String, dynamic> defaults = {
    'title': 'Frequently Asked Questions',
    'subtitle': '',
    'allowMultiple': false, // allow multiple items open
    'expandFirst': true,
    'showSearch': false,
    'layout': 'standard', // standard, boxed, minimal
  };
}

/// Settings configuration for Video Hero section
class VideoHeroSettings {
  static const Map<String, dynamic> defaults = {
    'videoUrl': '',
    'posterImage': '', // fallback image
    'heading': 'Welcome to Our Store',
    'subheading': '',
    'ctaText': 'Shop Now',
    'ctaLink': '/products',
    'autoplay': true,
    'loop': true,
    'muted': true,
    'overlay': 0.5,
    'textPosition': 'center',
    'showControls': false,
  };
}

/// Settings configuration for Trust Badges section
class TrustBadgesSettings {
  static const Map<String, dynamic> defaults = {
    'title': '',
    'showTitle': false,
    'layout': 'inline', // inline, grid, icons-only
    'columns': 4,
    'columnsMobile': 2,
    'style': 'with-text', // with-text, icons-only
    'size': 'medium', // small, medium, large
  };
}

/// Create a default store template with essential sections
class DefaultStoreTemplate {
  DefaultStoreTemplate._();

  /// Create a minimal store template with header, products, and footer
  static List<SectionModel> createMinimalSections() {
    final now = DateTime.now();
    const uuid = Uuid();
    
    return [
      SectionModel(
        id: uuid.v4(),
        type: SectionType.header,
        order: 0,
        settings: HeaderSettings.defaults,
        blocks: SectionDefaults._createHeaderBlocks(),
        createdAt: now,
        updatedAt: now,
      ),
      SectionModel(
        id: uuid.v4(),
        type: SectionType.productGrid,
        order: 1,
        settings: ProductGridSettings.defaults,
        blocks: [],
        createdAt: now,
        updatedAt: now,
      ),
      SectionModel(
        id: uuid.v4(),
        type: SectionType.footer,
        order: 2,
        settings: FooterSettings.defaults,
        blocks: SectionDefaults._createFooterBlocks(),
        createdAt: now,
        updatedAt: now,
      ),
    ];
  }

  /// Create a full-featured store template
  static List<SectionModel> createFullSections() {
    final now = DateTime.now();
    const uuid = Uuid();
    
    return [
      ...createMinimalSections().take(2), // Header and Hero
      SectionModel(
        id: uuid.v4(),
        type: SectionType.collectionFilter,
        order: 2,
        settings: CollectionFilterSettings.defaults,
        blocks: [],
        createdAt: now,
        updatedAt: now,
      ),
      SectionModel(
        id: uuid.v4(),
        type: SectionType.productGrid,
        order: 3,
        settings: ProductGridSettings.defaults,
        blocks: [],
        createdAt: now,
        updatedAt: now,
      ),
      SectionModel(
        id: uuid.v4(),
        type: SectionType.featuredProducts,
        order: 4,
        settings: FeaturedProductsSettings.defaults,
        blocks: [],
        createdAt: now,
        updatedAt: now,
      ),
      SectionModel(
        id: uuid.v4(),
        type: SectionType.testimonials,
        order: 5,
        settings: TestimonialsSettings.defaults,
        blocks: SectionDefaults._createTestimonialBlocks(),
        createdAt: now,
        updatedAt: now,
      ),
      SectionModel(
        id: uuid.v4(),
        type: SectionType.aboutSection,
        order: 6,
        settings: AboutSectionSettings.defaults,
        blocks: [],
        createdAt: now,
        updatedAt: now,
      ),
      SectionModel(
        id: uuid.v4(),
        type: SectionType.trustBadges,
        order: 7,
        settings: TrustBadgesSettings.defaults,
        blocks: SectionDefaults._createTrustBadgeBlocks(),
        createdAt: now,
        updatedAt: now,
      ),
      SectionModel(
        id: uuid.v4(),
        type: SectionType.newsletter,
        order: 8,
        settings: NewsletterSettings.defaults,
        blocks: [],
        createdAt: now,
        updatedAt: now,
      ),
      ...createMinimalSections().skip(3), // Footer
    ];
  }
}
