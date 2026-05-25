import 'package:flutter/material.dart';

/// Pre-built store theme model
class StoreThemeModel {
  final String id;
  final String name;
  final String description;
  final String category;
  final String previewImageUrl;
  
  // Default colors
  final String primaryColor;
  final String secondaryColor;
  final String accentColor;
  
  // Typography
  final String fontFamily;
  
  // Availability
  final bool isPremium;
  
  // Features
  final List<String> features;
  final List<String> bestFor;

  const StoreThemeModel({
    required this.id,
    required this.name,
    required this.description,
    required this.category,
    required this.previewImageUrl,
    required this.primaryColor,
    required this.secondaryColor,
    required this.accentColor,
    required this.fontFamily,
    this.isPremium = false,
    this.features = const [],
    this.bestFor = const [],
  });

  /// Convert hex color to Color
  Color get primaryColorValue => _hexToColor(primaryColor);
  Color get secondaryColorValue => _hexToColor(secondaryColor);
  Color get accentColorValue => _hexToColor(accentColor);

  Color _hexToColor(String hex) {
    final buffer = StringBuffer();
    if (hex.length == 6 || hex.length == 7) buffer.write('ff');
    buffer.write(hex.replaceFirst('#', ''));
    return Color(int.parse(buffer.toString(), radix: 16));
  }

  /// Create from JSON map
  factory StoreThemeModel.fromJson(Map<String, dynamic> data, {String? id}) {
    return StoreThemeModel(
      id: id ?? data['id'] ?? '',
      name: data['name'] ?? '',
      description: data['description'] ?? '',
      category: data['category'] ?? '',
      previewImageUrl: data['previewImageUrl'] ?? data['preview_image_url'] ?? '',
      primaryColor: data['defaultColors']?['primary'] ?? data['default_colors']?['primary'] ?? '#000000',
      secondaryColor: data['defaultColors']?['secondary'] ?? data['default_colors']?['secondary'] ?? '#FFFFFF',
      accentColor: data['defaultColors']?['accent'] ?? data['default_colors']?['accent'] ?? '#E5E5E5',
      fontFamily: data['defaultFont'] ?? data['default_font'] ?? 'Inter',
      isPremium: data['isPremium'] ?? data['is_premium'] ?? false,
      features: List<String>.from(data['features'] ?? []),
      bestFor: List<String>.from(data['bestFor'] ?? data['best_for'] ?? []),
    );
  }

  /// Convert to JSON map
  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'description': description,
      'category': category,
      'preview_image_url': previewImageUrl,
      'default_colors': {
        'primary': primaryColor,
        'secondary': secondaryColor,
        'accent': accentColor,
      },
      'default_font': fontFamily,
      'is_premium': isPremium,
      'features': features,
      'best_for': bestFor,
    };
  }

  /// Pre-built themes
  static List<StoreThemeModel> get defaultThemes => [
    // 1. Minimal Modern
    const StoreThemeModel(
      id: 'minimal_modern',
      name: 'Minimal Modern',
      description: 'Clean, minimalist design with lots of whitespace',
      category: 'fashion',
      previewImageUrl: 'assets/images/templates/minimal_preview.png',
      primaryColor: '#000000',
      secondaryColor: '#FFFFFF',
      accentColor: '#E5E5E5',
      fontFamily: 'Inter',
      isPremium: false,
      features: [
        'Sticky transparent header',
        'Grid product layout',
        'Smooth scroll animations',
        'Floating cart button',
      ],
      bestFor: ['Fashion', 'Lifestyle', 'Premium'],
    ),
    
    // 2. Vibrant Bold
    const StoreThemeModel(
      id: 'vibrant_bold',
      name: 'Vibrant Bold',
      description: 'Colorful, energetic design with playful animations',
      category: 'kids',
      previewImageUrl: 'assets/images/templates/vibrant_preview.png',
      primaryColor: '#FF6B6B',
      secondaryColor: '#4ECDC4',
      accentColor: '#FFE66D',
      fontFamily: 'Poppins',
      isPremium: false,
      features: [
        'Animated gradient hero',
        'Card-based layout',
        'Category pills with icons',
        'Playful micro-animations',
      ],
      bestFor: ['Kids', 'Toys', 'Accessories', 'Fun items'],
    ),
    
    // 3. Natural Organic
    const StoreThemeModel(
      id: 'natural_organic',
      name: 'Natural Organic',
      description: 'Earthy, eco-friendly design with natural textures',
      category: 'wellness',
      previewImageUrl: 'assets/images/templates/organic_preview.png',
      primaryColor: '#2D5016',
      secondaryColor: '#F5F1EB',
      accentColor: '#8B7355',
      fontFamily: 'Lora',
      isPremium: false,
      features: [
        'Nature decorative elements',
        'Soft rounded corners',
        'Testimonial carousel',
        'Eco-friendly badges',
      ],
      bestFor: ['Organic', 'Wellness', 'Health', 'Natural'],
    ),
    
    // 4. Tech Elite
    const StoreThemeModel(
      id: 'tech_elite',
      name: 'Tech Elite',
      description: 'Dark mode, futuristic design with neon accents',
      category: 'tech',
      previewImageUrl: 'assets/images/templates/tech_preview.png',
      primaryColor: '#0A0A0F',
      secondaryColor: '#1A1A2E',
      accentColor: '#00D9FF',
      fontFamily: 'Space Grotesk',
      isPremium: false,
      features: [
        'Dark theme',
        'Glassmorphism cards',
        'Neon glow effects',
        'Spec comparison tables',
      ],
      bestFor: ['Electronics', 'Gadgets', 'Tech accessories'],
    ),
    
    // 5. Luxury Premium
    const StoreThemeModel(
      id: 'luxury_premium',
      name: 'Luxury Premium',
      description: 'Elegant, sophisticated design with gold accents',
      category: 'luxury',
      previewImageUrl: 'assets/images/templates/luxury_preview.png',
      primaryColor: '#1C1C1C',
      secondaryColor: '#F8F5F0',
      accentColor: '#D4AF37',
      fontFamily: 'Playfair Display',
      isPremium: false,
      features: [
        'Full-screen hero',
        'Gold accents',
        'Elegant serif typography',
        'Parallax scrolling',
      ],
      bestFor: ['Jewelry', 'Watches', 'Luxury goods'],
    ),
    
    // 6. Sunset Gradient
    const StoreThemeModel(
      id: 'sunset_gradient',
      name: 'Sunset Gradient',
      description: 'Warm gradient tones with a cozy, inviting feel',
      category: 'lifestyle',
      previewImageUrl: 'assets/images/templates/sunset_preview.png',
      primaryColor: '#FF6B35',
      secondaryColor: '#F7931A',
      accentColor: '#FFD700',
      fontFamily: 'Nunito',
      isPremium: false,
      features: [
        'Warm gradient backgrounds',
        'Soft shadows',
        'Rounded corners everywhere',
        'Inviting product cards',
      ],
      bestFor: ['Food', 'Home decor', 'Handmade', 'Artisan'],
    ),
    
    // 7. Ocean Breeze
    const StoreThemeModel(
      id: 'ocean_breeze',
      name: 'Ocean Breeze',
      description: 'Calming ocean-inspired blues and teals',
      category: 'lifestyle',
      previewImageUrl: 'assets/images/templates/ocean_preview.png',
      primaryColor: '#0077B6',
      secondaryColor: '#00B4D8',
      accentColor: '#90E0EF',
      fontFamily: 'Open Sans',
      isPremium: false,
      features: [
        'Wave-inspired design',
        'Cool color palette',
        'Airy product layout',
        'Relaxing animations',
      ],
      bestFor: ['Skincare', 'Beach wear', 'Wellness', 'Spa'],
    ),
    
    // 8. Midnight Purple
    const StoreThemeModel(
      id: 'midnight_purple',
      name: 'Midnight Purple',
      description: 'Deep purple gradients with a mystical vibe',
      category: 'creative',
      previewImageUrl: 'assets/images/templates/midnight_preview.png',
      primaryColor: '#6366F1',
      secondaryColor: '#8B5CF6',
      accentColor: '#EC4899',
      fontFamily: 'DM Sans',
      isPremium: false,
      features: [
        'Dark gradient backgrounds',
        'Glowing accent elements',
        'Bold typography',
        'Modern card layout',
      ],
      bestFor: ['Digital products', 'Creative', 'Art', 'Design'],
    ),
    
    // 9. Fresh Mint
    const StoreThemeModel(
      id: 'fresh_mint',
      name: 'Fresh Mint',
      description: 'Clean green and white for a fresh, modern look',
      category: 'health',
      previewImageUrl: 'assets/images/templates/mint_preview.png',
      primaryColor: '#10B981',
      secondaryColor: '#34D399',
      accentColor: '#F0FDF4',
      fontFamily: 'Outfit',
      isPremium: false,
      features: [
        'Fresh green accents',
        'Clean white backgrounds',
        'Health-focused design',
        'Trust badges',
      ],
      bestFor: ['Health', 'Supplements', 'Organic food', 'Fitness'],
    ),
    
    // 10. Royal Rose
    const StoreThemeModel(
      id: 'royal_rose',
      name: 'Royal Rose',
      description: 'Elegant pink and rose gold for feminine elegance',
      category: 'beauty',
      previewImageUrl: 'assets/images/templates/rose_preview.png',
      primaryColor: '#EC4899',
      secondaryColor: '#F472B6',
      accentColor: '#FDF2F8',
      fontFamily: 'Montserrat',
      isPremium: false,
      features: [
        'Rose gold accents',
        'Soft pink gradients',
        'Elegant typography',
        'Beautiful product showcase',
      ],
      bestFor: ['Beauty', 'Cosmetics', 'Fashion', 'Bridal'],
    ),
  ];
}
