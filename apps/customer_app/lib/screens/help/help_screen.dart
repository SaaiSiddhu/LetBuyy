// lib/screens/user/help/help_screen.dart
import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart'; // ✅ ADDED for launching URLs
import 'package:font_awesome_flutter/font_awesome_flutter.dart'; // ✅ ADDED for WhatsApp icon
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import '../../widgets/premium_scaffold.dart';


// ✅ ADDED: Data model for help topics
class _HelpTopic {
  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;
  final List<String> keywords;

  _HelpTopic({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
    required this.keywords,
  });
}

// ✅ ADDED: Data model for FAQ content
class FaqItem {
  final String question;
  final String answer;
  FaqItem({required this.question, required this.answer});
}

class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});

  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> with TickerProviderStateMixin {
  // --- Animation ---
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<Offset> _slideAnimation;

  // ✅ ADDED: State for Search
  final TextEditingController _searchController = TextEditingController();
  List<_HelpTopic> _allTopics = [];
  List<_HelpTopic> _filteredTopics = [];
  String _searchText = '';

  // ✅ ADDED: FAQ Data
  final List<FaqItem> _faqData = [
    FaqItem(
      question: "How do I create an account?",
      answer:
          "You can create an account by clicking on the 'Profile' tab, then selecting 'Login'. From there, you can choose to 'Sign Up' using your email and password or by using a social login like Google.",
    ),
    FaqItem(
      question: "How do I track my order?",
      answer:
          "Go to the 'My Orders' section in your profile. Click on the order you want to track, and then go to the 'Tracking' tab to see the live status of your delivery.",
    ),
    FaqItem(
      question: "How do I cancel an order?",
      answer:
          "You can cancel an order within 1 hour of placing it. Go to 'My Orders', select the order, and in the 'Payment' tab, you will find a 'Cancel Order' button if it is still within the window.",
    ),
  ];

  // ✅ ADDED: Shipping Data
  final List<FaqItem> _shippingData = [
    FaqItem(
      question: "What is your shipping policy?",
      answer:
          "We offer standard shipping (3-5 business days) and express shipping (1-2 business days). Shipping costs are calculated at checkout based on your location and order weight.",
    ),
    FaqItem(
      question: "How do I return a product?",
      answer:
          "You can initiate a return within 7 days of delivery. Go to 'My Orders', select the delivered order, and click 'Request Return'. Please note that items must be in their original condition.",
    ),
    FaqItem(
      question: "How long does a refund take?",
      answer:
          "Once your return is approved and the item is received by our warehouse, the refund will be processed to your original payment method within 5-7 business days.",
    ),
  ];

  // ✅ ADDED: Payment Data
  final List<FaqItem> _paymentData = [
    FaqItem(
      question: "What payment methods do you accept?",
      answer:
          "We accept two main forms of payment: \n1. Cash on Delivery (COD) \n2. Online Payments via Razorpay.",
    ),
    FaqItem(
      question: "What is included in Razorpay?",
      answer:
          "Razorpay is our secure payment gateway that supports all major payment methods, including:\n• UPI (Google Pay, PhonePe, Paytm, etc.)\n• Credit & Debit Cards (Visa, Mastercard, RuPay)\n• Netbanking (all major banks)\n• Wallets (Paytm, Mobikwik, etc.)",
    ),
    FaqItem(
      question: "Is Cash on Delivery (COD) available for all orders?",
      answer:
          "COD availability depends on your pin code and the total order value. You will see the COD option at checkout if it is available for your order.",
    ),
  ];

  @override
  void initState() {
    super.initState();

    _animationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOut),
    );

    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.1),
      end: Offset.zero,
    ).animate(
      CurvedAnimation(parent: _animationController, curve: Curves.easeOutCubic),
    );

    _animationController.forward();

    // ✅ ADDED: Initialize search listener and topics
    _searchController.addListener(_onSearchChanged);
    _initializeHelpTopics();
  }

  // ✅ ADDED: Initialize all help topics here
  void _initializeHelpTopics() {
    _allTopics = [
      // --- Common Topics ---
      _HelpTopic(
        title: "FAQs",
        subtitle: "Find answers to common questions",
        icon: Icons.question_answer_outlined,
        onTap: () => _showHelpContentModal(title: "FAQs", content: _faqData), // ✅ UPDATED
        keywords: [
          'faq',
          'questions',
          'answers',
          'common',
          'track',
          'cancel',
          'account'
        ],
      ),
      _HelpTopic(
        title: "Shipping & Returns",
        subtitle: "Info on delivery and returns",
        icon: Icons.local_shipping_outlined,
        onTap: () => _showHelpContentModal(
            title: "Shipping & Returns", content: _shippingData), // ✅ UPDATED
        keywords: ['shipping', 'returns', 'delivery', 'refund', 'policy', 'how long'],
      ),
      _HelpTopic(
        title: "Payment Options",
        subtitle: "View supported payment methods",
        icon: Icons.payment_outlined,
        onTap: () => _showHelpContentModal(
            title: "Payment Options", content: _paymentData), // ✅ UPDATED
        keywords: ['payment', 'options', 'cod', 'upi', 'card', 'razorpay', 'netbanking', 'wallets'],
      ),
      // --- Contact Us ---
      _HelpTopic(
        title: "Email Support",
        subtitle: "support@letbuyy.in",
        icon: Icons.alternate_email_rounded,
        onTap: () => _showEmailOptions(),
        keywords: [
          'email',
          'support',
          'contact',
          'mail',
          'support@letbuyy.in',
          'saai.siddharth.t@gmail.com'
        ],
      ),
      _HelpTopic(
        title: "Call Center",
        subtitle: "+91 8610787151",
        icon: Icons.phone_outlined,
        onTap: () => _showPhoneOptions(),
        keywords: [
          'call',
          'phone',
          'whatsapp',
          'contact',
          'center',
          '8610787151'
        ],
      ),
      _HelpTopic(
        title: "Privacy Policy",
        subtitle: "Read our terms and conditions",
        icon: Icons.policy_outlined,
        onTap: () => _showNotImplemented(), // You can make this open a modal too
        keywords: ['privacy', 'policy', 'terms', 'conditions', 'legal'],
      ),
    ];
    _filteredTopics = _allTopics;
  }

  // ✅ ADDED: Search filter logic
  void _onSearchChanged() {
    setState(() {
      _searchText = _searchController.text.toLowerCase();
      _filteredTopics = _allTopics.where((topic) {
        final titleMatch = topic.title.toLowerCase().contains(_searchText);
        final subtitleMatch = topic.subtitle.toLowerCase().contains(_searchText);
        final keywordMatch = topic.keywords.any((k) => k.contains(_searchText));
        return titleMatch || subtitleMatch || keywordMatch;
      }).toList();
    });
  }

  @override
  void dispose() {
    _animationController.dispose();
    _searchController.removeListener(_onSearchChanged); // ✅ ADDED
    _searchController.dispose(); // ✅ ADDED
    super.dispose();
  }

  // ============================================
  // ✅ ADDED: URL Launcher Functions
  // ============================================

  Future<void> _launchEmail(String email) async {
    final Uri emailUri = Uri(
      scheme: 'mailto',
      path: email,
      query: 'subject=${Uri.encodeComponent("Help Request - LetBuyy App")}&body=${Uri.encodeComponent("Hello LetBuyy Support,\n\nI need help with:\n\n")}',
    );

    try {
      if (await canLaunchUrl(emailUri)) {
        await launchUrl(emailUri);
      } else {
        _showSnackBar('Could not open email app', isError: true);
      }
    } catch (e) {
      _showSnackBar('Error: $e', isError: true);
    }
  }

  Future<void> _launchPhone(String phoneNumber) async {
    final Uri phoneUri = Uri(scheme: 'tel', path: phoneNumber);
    try {
      if (await canLaunchUrl(phoneUri)) {
        await launchUrl(phoneUri);
      } else {
        _showSnackBar('Could not open dialer', isError: true);
      }
    } catch (e) {
      _showSnackBar('Error: $e', isError: true);
    }
  }

  Future<void> _launchWhatsApp(String phone, String message) async {
    final String url = "https://wa.me/$phone?text=${Uri.encodeComponent(message)}";
    final Uri whatsappUri = Uri.parse(url);
    try {
      if (await canLaunchUrl(whatsappUri)) {
        await launchUrl(whatsappUri, mode: LaunchMode.externalApplication);
      } else {
        _showSnackBar('Could not open WhatsApp', isError: true);
      }
    } catch (e) {
      _showSnackBar('Error: $e', isError: true);
    }
  }

  void _showSnackBar(String message, {bool isError = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            Icon(isError ? Icons.error_rounded : Icons.check_circle, color: AppColors.white, size: 20), // ✅ Fixed
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                message,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
        backgroundColor: isError ? AppColors.error : (Provider.of<ThemeProvider>(context, listen: false).isDarkMode ? AppColors.primaryLight : AppColors.primary), // ✅ Fixed
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        duration: const Duration(seconds: 2),
      ),
    );
  }

  void _showNotImplemented() {
    _showSnackBar('This section is coming soon!');
  }

  // ============================================
  // ✅ ADDED: Contact Modals
  // ============================================

  void _showEmailOptions() {
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => _ContactModal(
        isDark: isDark,
        title: 'Email Support',
        options: [
          _ContactOption(
            icon: Icons.support_agent_rounded,
            title: 'Official Support',
            subtitle: 'support@letbuyy.in',
            onTap: () {
              Navigator.pop(context);
              _launchEmail('support@letbuyy.in');
            },
          ),
          _ContactOption(
            icon: Icons.person_rounded,
            title: 'Developer Contact',
            subtitle: 'saai.siddharth.t@gmail.com',
            onTap: () {
              Navigator.pop(context);
              _launchEmail('saai.siddharth.t@gmail.com');
            },
          ),
        ],
      ),
    );
  }

  void _showPhoneOptions() {
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => _ContactModal(
        isDark: isDark,
        title: 'Contact Support',
        options: [
          _ContactOption(
            icon: Icons.phone_forwarded_rounded,
            title: 'Call Support',
            subtitle: '+91 8610787151',
            onTap: () {
              Navigator.pop(context);
              _launchPhone('+918610787151');
            },
          ),
          _ContactOption(
            icon: FontAwesomeIcons.whatsapp,
            title: 'Chat on WhatsApp',
            subtitle: '+91 8610787151',
            onTap: () {
              Navigator.pop(context);
              _launchWhatsApp('918610787151', 'Hello LetBuyy Support, I need help.');
            },
          ),
        ],
      ),
    );
  }

  // ✅ ADDED: Modal for showing help content
  void _showHelpContentModal({required String title, required List<FaqItem> content}) {
    final isDark = Provider.of<ThemeProvider>(context, listen: false).isDarkMode;
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (context) => _HelpContentModal(
        isDark: isDark,
        title: title,
        content: content,
      ),
    );
  }

  // ============================================
  // WIDGET BUILDERS
  // ============================================

  Widget _buildHeader(bool isDark) {
    final double topPadding = MediaQuery.of(context).padding.top;

    return Container(
      padding: EdgeInsets.fromLTRB(16, 16 + topPadding, 16, 16),
      decoration: BoxDecoration(
        gradient: isDark ? AppColors.primaryGradientDark : AppColors.primaryGradient, // ✅ Fixed
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Container(
            decoration: BoxDecoration(
              color: AppColors.white.withValues(alpha: 0.2), // ✅ Fixed
              borderRadius: BorderRadius.circular(10),
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () {
                  HapticFeedback.lightImpact();
                  Navigator.pop(context);
                },
                borderRadius: BorderRadius.circular(10),
                child: const Padding(
                  padding: EdgeInsets.all(10),
                  child: Icon(Icons.arrow_back_rounded, color: AppColors.white, size: 20), // ✅ Fixed
                ),
              ),
            ),
          ),
          const Text(
            'Help Center',
            style: TextStyle(
              fontSize: 19,
              fontWeight: FontWeight.w900,
              color: AppColors.white, // ✅ Fixed
            ),
          ),
          Container(
            width: 40,
            height: 40,
            decoration: const BoxDecoration(
              color: Colors.transparent,
              shape: BoxShape.circle,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar(bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant, // ✅ Fixed
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border) // ✅ Fixed
      ),
      child: Row(
        children: [
          Icon(Icons.search_rounded, color: isDark ? AppColors.textLightHint : AppColors.textHint, size: 22), // ✅ Fixed
          const SizedBox(width: 12),
          Expanded(
            child: TextField(
              controller: _searchController, // ✅ ADDED
              style: TextStyle(color: isDark ? AppColors.textLight : AppColors.textPrimary), // ✅ Fixed
              decoration: InputDecoration(
                hintText: 'Search for help (e.g., "shipping", "FAQ")',
                hintStyle: TextStyle(color: isDark ? AppColors.textLightHint : AppColors.textHint), // ✅ Fixed
                border: InputBorder.none,
              ),
            ),
          ),
          if (_searchText.isNotEmpty) // ✅ ADDED: Clear button
            GestureDetector(
              onTap: () {
                _searchController.clear();
                HapticFeedback.lightImpact();
              },
              child: Icon(Icons.close_rounded, color: isDark ? AppColors.textLightHint : AppColors.textHint, size: 20),
            )
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(top: 24, bottom: 10, left: 4),
      child: Text(
        title.toUpperCase(),
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w800,
          color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary, // ✅ Fixed
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildHelpTile({
    required IconData icon,
    required String title,
    required String subtitle,
    required bool isDark,
    required VoidCallback onTap,
  }) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary; // ✅ Fixed

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface, // ✅ Fixed
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border, // ✅ Fixed
        ),
        boxShadow: [
          BoxShadow(
            color: isDark ? AppColors.shadowDark : AppColors.shadowLight, // ✅ Fixed
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: accentColor, size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: isDark ? AppColors.textLight : AppColors.textPrimary, // ✅ Fixed
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary, // ✅ Fixed
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 14,
                  color: isDark ? AppColors.textLightHint : AppColors.textHint, // ✅ Fixed
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;

    // ✅ ADDED: Separate lists for UI clarity
    final commonTopics = _filteredTopics.where((t) => t.keywords.contains('faq') || t.keywords.contains('shipping') || t.keywords.contains('payment')).toList();
    final contactTopics = _filteredTopics.where((t) => t.keywords.contains('email') || t.keywords.contains('phone') || t.keywords.contains('policy')).toList();

    return PremiumScaffold(
      // backgroundColor handled by PremiumScaffold
      body: Stack(
        children: [
          Column(
            children: [
              _buildHeader(isDark),
              Expanded(
                child: FadeTransition(
                  opacity: _fadeAnimation,
                  child: SlideTransition(
                    position: _slideAnimation,
                    child: CustomScrollView(
                      physics: const BouncingScrollPhysics(),
                      slivers: [
                        SliverToBoxAdapter(
                          child: Padding(
                            padding: const EdgeInsets.all(16),
                            child: _buildSearchBar(isDark),
                          ),
                        ),

                        // ✅ ADDED: Conditional rendering for search results
                        if (_filteredTopics.isEmpty)
                          SliverToBoxAdapter(
                            child: _buildNoResults(isDark),
                          )
                        else ...[
                          if (commonTopics.isNotEmpty) ...[
                            SliverToBoxAdapter(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                child: _buildSectionTitle("Common Topics", isDark),
                              ),
                            ),
                            SliverList(
                              delegate: SliverChildBuilderDelegate(
                                (context, index) {
                                  final topic = commonTopics[index];
                                  return Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 16),
                                    child: _buildHelpTile(
                                      icon: topic.icon,
                                      title: topic.title,
                                      subtitle: topic.subtitle,
                                      isDark: isDark,
                                      onTap: topic.onTap,
                                    ),
                                  );
                                },
                                childCount: commonTopics.length,
                              ),
                            ),
                          ],
                          if (contactTopics.isNotEmpty) ...[
                             SliverToBoxAdapter(
                              child: Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                child: _buildSectionTitle("Contact Us", isDark),
                              ),
                            ),
                            SliverList(
                              delegate: SliverChildBuilderDelegate(
                                (context, index) {
                                  final topic = contactTopics[index];
                                  return Padding(
                                    padding: const EdgeInsets.symmetric(horizontal: 16),
                                    child: _buildHelpTile(
                                      icon: topic.icon,
                                      title: topic.title,
                                      subtitle: topic.subtitle,
                                      isDark: isDark,
                                      onTap: topic.onTap,
                                    ),
                                  );
                                },
                                childCount: contactTopics.length,
                              ),
                            ),
                          ],
                        ]
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ✅ ADDED: No results widget
  Widget _buildNoResults(bool isDark) {
    return Padding(
      padding: const EdgeInsets.all(32.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.search_off_rounded, size: 64, color: isDark ? AppColors.textLightHint : AppColors.textHint),
          const SizedBox(height: 16),
          Text(
            'No Results Found',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: isDark ? AppColors.textLight : AppColors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'We couldn\'t find any help topics matching "${_searchController.text}".',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }
}


// ============================================
// ✅ ADDED: Contact Option Widgets
// ============================================
class _ContactModal extends StatelessWidget {
  final bool isDark;
  final String title;
  final List<_ContactOption> options;

  const _ContactModal({
    required this.isDark,
    required this.title,
    required this.options,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : AppColors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      padding: const EdgeInsets.all(20),
      child: SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: isDark ? AppColors.borderDark : AppColors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 20),
            Text(
              title,
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: isDark ? AppColors.textLight : AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 20),
            ...options,
          ],
        ),
      ),
    );
  }
}

class _ContactOption extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _ContactOption({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? AppColors.borderDark : AppColors.border,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: accentColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(icon, color: accentColor, size: 22),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w700,
                          color: isDark ? AppColors.textLight : AppColors.textPrimary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        subtitle,
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 14,
                  color: isDark ? AppColors.textLightHint : AppColors.textHint,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

// ============================================
// ✅ ADDED: Help Content Modal Widgets
// ============================================

class _HelpContentModal extends StatelessWidget {
  final bool isDark;
  final String title;
  final List<FaqItem> content;

  const _HelpContentModal({
    required this.isDark,
    required this.title,
    required this.content,
  });

  @override
  Widget build(BuildContext context) {
    return DraggableScrollableSheet(
      expand: false,
      initialChildSize: 0.75,
      minChildSize: 0.5,
      maxChildSize: 0.95,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : AppColors.surface,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                        color: isDark ? AppColors.borderDark : AppColors.border,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                    const SizedBox(height: 20),
                    Text(
                      title,
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: isDark ? AppColors.textLight : AppColors.textPrimary,
                      ),
                    ),
                  ],
                ),
              ),
              Divider(color: isDark ? AppColors.borderDark : AppColors.border, height: 1),
              Expanded(
                child: ListView.builder(
                  controller: scrollController,
                  padding: const EdgeInsets.all(16),
                  itemCount: content.length,
                  itemBuilder: (context, index) {
                    return _FaqTile(
                      item: content[index],
                      isDark: isDark,
                    );
                  },
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _FaqTile extends StatelessWidget {
  final FaqItem item;
  final bool isDark;

  const _FaqTile({required this.item, required this.isDark});

  @override
  Widget build(BuildContext context) {
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;
    
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDarkVariant : AppColors.surfaceVariant.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: isDark ? AppColors.borderDark : AppColors.border),
      ),
      child: ExpansionTile(
        iconColor: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
        collapsedIconColor: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)), // Removes border on expand
        collapsedShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        title: Text(
          item.question,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: isDark ? AppColors.textLight : AppColors.textPrimary,
          ),
        ),
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            child: Text(
              item.answer,
              style: TextStyle(
                fontSize: 13,
                color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                height: 1.6,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}