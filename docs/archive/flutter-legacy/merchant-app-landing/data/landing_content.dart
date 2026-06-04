import 'package:flutter/material.dart';

class LandingContent {
  static const String navLogo = 'LetBuyy';
  
  static const List<String> navLinks = ['Features', 'How it Works', 'Pricing', 'Testimonials'];

  static const String heroBadge = '🚀 v2.0 is now live';
  static const String heroHeadline1 = 'Your Store.';
  static const String heroHeadline2 = 'Your Brand.';
  static const String heroHeadline3 = 'Your Empire.';
  static const String heroSubtext = 'The all-in-one platform for modern sellers. Create a beautiful, mobile-friendly online store without writing a single line of code.';
  
  static const List<String> trustedBrands = [
    'Store 1', 'Fashion Hub', 'Tech Kart', 'Organic Life', 'Urban Trends', 'Luxe Living', 'Daily Needs'
  ];

  static const List<Map<String, dynamic>> features = [
    {
      'title': 'Video Commerce',
      'desc': 'Engage customers with shoppable videos and reels.',
      'icon': Icons.play_circle_fill_rounded,
      'size': 'large',
      'color': Color(0xFF8B5CF6),
    },
    {
      'title': 'Mobile First',
      'desc': 'Your store looks perfect on every device automatically.',
      'icon': Icons.phone_iphone_rounded,
      'size': 'medium',
      'color': Color(0xFF8B5CF6),
    },
    {
      'title': 'Analytics',
      'desc': 'Real-time growth insights.',
      'icon': Icons.bar_chart_rounded,
      'size': 'small',
      'color': Color(0xFF06B6D4),
    },
    {
      'title': 'Payments',
      'desc': 'UPI, Cards, COD supported.',
      'icon': Icons.credit_card_rounded,
      'size': 'small',
      'color': Color(0xFF10B981),
    },
    {
      'title': 'Global',
      'desc': 'Sell to anyone, anywhere.',
      'icon': Icons.public_rounded,
      'size': 'small',
      'color': Color(0xFFF59E0B),
    },
    {
      'title': 'Support',
      'desc': '24/7 Priority help.',
      'icon': Icons.support_agent_rounded,
      'size': 'small',
      'color': Color(0xFFEC4899),
    },
  ];

  static const List<Map<String, dynamic>> pricing = [
    {
      'tier': 'Free',
      'price_monthly': '₹0',
      'price_yearly': '₹0',
      'desc': 'Perfect for testing ideas',
      'features': ['10 Products', '1 Store', 'Basic Themes', 'LetBuyy Branding'],
      'is_popular': false,
    },
    {
      'tier': 'Pro',
      'price_monthly': '₹499',
      'price_yearly': '₹399',
      'desc': 'For serious sellers',
      'features': ['Unlimited Products', '3 Stores', 'Custom Domain', 'No Branding', 'Analytics'],
      'is_popular': true,
    },
    {
      'tier': 'Max',
      'price_monthly': '₹1999',
      'price_yearly': '₹1599',
      'desc': 'For scaling brands',
      'features': ['Everything in Pro', 'Unlimited Stores', 'Priority Support', 'White-label', 'API Access'],
      'is_popular': false,
    },
  ];
  
  static const List<Map<String, dynamic>> testimonials = [
    {
      'name': 'Priya Sharma',
      'role': 'Fashion Store Owner',
      'image': 'https://randomuser.me/api/portraits/women/44.jpg',
      'quote': 'LetBuyy transformed my small business into a brand. The video feature is a game changer!',
    },
    {
      'name': 'Rahul Verma',
      'role': 'Electronics Seller',
      'image': 'https://randomuser.me/api/portraits/men/32.jpg',
      'quote': 'The best platform specific for Indian market. UPI payments work flawlessly.',
    },
     {
      'name': 'Anita Desai',
      'role': 'Home Decor',
      'image': 'https://randomuser.me/api/portraits/women/68.jpg',
      'quote': 'Support is amazing. I set up my store in 10 minutes and got my first order the same day.',
    },
  ];
}
