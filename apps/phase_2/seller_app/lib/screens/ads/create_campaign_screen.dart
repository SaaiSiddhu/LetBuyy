import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../providers/seller_provider.dart';
import 'widgets/category_selector_widget.dart';
import 'widgets/estimated_results_card.dart';
import 'widgets/reel_picker_widget.dart';

class CreateCampaignScreen extends StatefulWidget {
  const CreateCampaignScreen({super.key});

  @override
  State<CreateCampaignScreen> createState() => _CreateCampaignScreenState();
}

class _CreateCampaignScreenState extends State<CreateCampaignScreen> {
  final _formKey = GlobalKey<FormState>();
  final _nameController = TextEditingController();
  final _dailyBudgetController = TextEditingController(text: '100');
  final _totalBudgetController = TextEditingController(text: '1000');
  final _keywordsController = TextEditingController();

  final AdService _adService = AdService();
  
  int _currentStep = 0;
  CampaignTargetType _targetType = CampaignTargetType.auto;
  AdType _adType = AdType.sponsoredProduct; // Phase 2: Ad type selector
  BillingType _billingType = BillingType.cpc; // Phase 2: CPC/CPV billing
  DateTime _startDate = DateTime.now();
  DateTime? _endDate;
  final List<String> _keywords = [];
  final Map<String, double> _keywordBids = {};
  double _defaultBid = 5.0;
  String? _selectedCategoryId;
  String? _selectedReelId; // Phase 2: Selected reel for Reels Boost
  bool _isSubmitting = false;

  final List<String> _suggestedKeywords = [
    'sale', 'discount', 'new arrival', 'trending', 'bestseller',
    'premium', 'organic', 'handmade', 'limited edition', 'free shipping'
  ];

  @override
  void dispose() {
    _nameController.dispose();
    _dailyBudgetController.dispose();
    _totalBudgetController.dispose();
    _keywordsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded,
              color: isDark ? Colors.white : const Color(0xFF111827)),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Create Campaign',
          style: TextStyle(
            color: isDark ? Colors.white : const Color(0xFF111827),
            fontWeight: FontWeight.w800,
          ),
        ),
      ),
      body: Form(
        key: _formKey,
        child: Stepper(
          currentStep: _currentStep,
          onStepContinue: _onStepContinue,
          onStepCancel: _onStepCancel,
          type: StepperType.vertical,
          controlsBuilder: (context, details) => _buildStepperControls(details, isDark),
          steps: [
            _buildBasicInfoStep(isDark),
            _buildTargetingStep(isDark),
            _buildBudgetStep(isDark),
            _buildReviewStep(isDark),
          ],
        ),
      ),
    );
  }

  // ============================================================
  // STEP 1: BASIC INFO
  // ============================================================
  Step _buildBasicInfoStep(bool isDark) {
    return Step(
      title: Text('Campaign Name', style: _stepTitleStyle(isDark)),
      subtitle: _currentStep > 0 ? Text(_nameController.text) : null,
      isActive: _currentStep >= 0,
      state: _currentStep > 0 ? StepState.complete : StepState.indexed,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Give your campaign a memorable name',
            style: TextStyle(
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 16),
          TextFormField(
            controller: _nameController,
            style: TextStyle(
              color: isDark ? Colors.white : const Color(0xFF111827),
              fontWeight: FontWeight.w600,
            ),
            decoration: _inputDecoration('e.g., Summer Sale Campaign', isDark),
            validator: (v) => v?.isEmpty == true ? 'Name is required' : null,
          ),
        ],
      ),
    );
  }

  // ============================================================
  // STEP 2: TARGETING
  // ============================================================
  Step _buildTargetingStep(bool isDark) {
    return Step(
      title: Text('Campaign Type', style: _stepTitleStyle(isDark)),
      subtitle: _currentStep > 1 ? Text(_adType == AdType.reelsBoost ? 'Reels Boost' : _targetType.name.toUpperCase()) : null,
      isActive: _currentStep >= 1,
      state: _currentStep > 1 ? StepState.complete : StepState.indexed,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Phase 2: Ad Type Selector
          Text(
            'What type of ad campaign?',
            style: TextStyle(
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 12),
          // All 7 Ad Types
          _buildAdTypeOption(AdType.sponsoredProduct, 'Product Ads', 'Promote products in search & category', Icons.shopping_bag_rounded, isDark),
          _buildAdTypeOption(AdType.keywordSearch, 'Keyword Search', 'Target specific search keywords', Icons.search_rounded, isDark),
          _buildAdTypeOption(AdType.categoryBoost, 'Category Boost', 'Premium placement in category pages', Icons.star_rounded, isDark),
          _buildAdTypeOption(AdType.reelsBoost, 'Reels Boost', 'Promote your reels to more viewers', Icons.videocam_rounded, isDark),
          _buildAdTypeOption(AdType.homeBanner, 'Home Banner', 'Banner ad on marketplace homepage', Icons.panorama_rounded, isDark),
          _buildAdTypeOption(AdType.brandStore, 'Brand Store', 'Spotlight your store to shoppers', Icons.store_rounded, isDark),
          _buildAdTypeOption(AdType.retargeting, 'Retargeting', 'Re-engage users who viewed products', Icons.track_changes_rounded, isDark),
          
          // Only show targeting for applicable ad types
          if (_adType != AdType.reelsBoost && 
              _adType != AdType.homeBanner && 
              _adType != AdType.brandStore) ...[
            const SizedBox(height: 24),
            Text(
              'How should your ads be targeted?',
              style: TextStyle(
                color: isDark ? Colors.grey[400] : Colors.grey[600],
                fontSize: 14,
              ),
            ),
            const SizedBox(height: 12),
            // Targeting Options
            _buildTargetingOption(
              CampaignTargetType.auto,
              'Automatic',
              'AI picks best keywords for your products',
              Icons.auto_awesome_rounded,
              isDark,
            ),
            _buildTargetingOption(
              CampaignTargetType.keywords,
              'Keywords',
              'You choose specific search keywords',
              Icons.search_rounded,
              isDark,
            ),
            _buildTargetingOption(
              CampaignTargetType.category,
              'Category',
              'Target a specific product category',
              Icons.category_rounded,
              isDark,
            ),
          ],
          // Keywords Input with Per-Keyword Bidding
          if (_targetType == CampaignTargetType.keywords) ...[
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: Text(
                    'Keywords & Bids',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : const Color(0xFF111827),
                    ),
                  ),
                ),
                // Default bid setter
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Default: ₹',
                        style: TextStyle(
                          fontSize: 11,
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                        ),
                      ),
                      SizedBox(
                        width: 40,
                        child: TextFormField(
                          initialValue: _defaultBid.toStringAsFixed(0),
                          keyboardType: TextInputType.number,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                          decoration: const InputDecoration(
                            border: InputBorder.none,
                            isDense: true,
                            contentPadding: EdgeInsets.zero,
                          ),
                          onChanged: (v) {
                            final val = double.tryParse(v);
                            if (val != null && val >= 3) {
                              setState(() => _defaultBid = val);
                            }
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            TextFormField(
              controller: _keywordsController,
              style: TextStyle(color: isDark ? Colors.white : const Color(0xFF111827)),
              decoration: _inputDecoration('Add keyword and press enter', isDark),
              onFieldSubmitted: (value) {
                if (value.isNotEmpty && !_keywords.contains(value)) {
                  setState(() {
                    _keywords.add(value);
                    _keywordBids[value] = _defaultBid; // Assign default bid
                    _keywordsController.clear();
                  });
                }
              },
            ),
            const SizedBox(height: 12),
            // Keywords with individual bids
            if (_keywords.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.03),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.08),
                  ),
                ),
                child: Column(
                  children: [
                    ..._keywords.map((k) => _buildKeywordBidRow(k, isDark)),
                    // Total estimated spend
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Est. daily clicks (avg):',
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                          ),
                        ),
                        Text(
                          '${(double.tryParse(_dailyBudgetController.text) ?? 100) ~/ (_keywordBids.values.isEmpty ? 5 : (_keywordBids.values.reduce((a, b) => a + b) / _keywordBids.length))} clicks',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            Text(
              'Suggestions:',
              style: TextStyle(
                fontSize: 12,
                color: isDark ? Colors.grey[500] : Colors.grey[600],
              ),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: _suggestedKeywords
                  .where((k) => !_keywords.contains(k))
                  .take(6)
                  .map((k) => GestureDetector(
                    onTap: () => setState(() {
                      _keywords.add(k);
                      _keywordBids[k] = _defaultBid;
                    }),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.withValues(alpha: 0.3)),
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: Text(
                        '+ $k',
                        style: TextStyle(
                          fontSize: 12,
                          color: isDark ? Colors.grey[400] : Colors.grey[600],
                        ),
                      ),
                    ),
                  ))
                  .toList(),
            ),
          ],
          // Category Selector (Enhanced with tree view)
          if (_targetType == CampaignTargetType.category) ...[
            const SizedBox(height: 20),
            Text(
              'Select Target Category',
              style: TextStyle(
                fontWeight: FontWeight.w700,
                color: isDark ? Colors.white : const Color(0xFF111827),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              'Your ads will appear in this category',
              style: TextStyle(
                fontSize: 12,
                color: isDark ? Colors.grey[500] : Colors.grey[600],
              ),
            ),
            const SizedBox(height: 12),
            CategorySelectorWidget(
              selectedCategoryId: _selectedCategoryId,
              showCompetition: true,
              onSelected: (categoryId, categoryPath) {
                setState(() => _selectedCategoryId = categoryId.isEmpty ? null : categoryId);
              },
            ),
          ],
          // Reel Picker for Reels Boost campaigns
          if (_adType == AdType.reelsBoost) ...[
            const SizedBox(height: 20),
            ReelPickerWidget(
              sellerId: context.read<SellerProvider>().sellerId ?? '',
              selectedReelId: _selectedReelId,
              onSelected: (reelId, reelTitle) {
                setState(() => _selectedReelId = reelId);
              },
            ),
          ],
          // Banner Info for Home Banner ads
          if (_adType == AdType.homeBanner) ...[
            const SizedBox(height: 20),
            _buildInfoCard(
              icon: Icons.panorama_rounded,
              title: 'Banner Requirements',
              description: 'Upload a 1200x400 banner image. Your banner will appear on the marketplace homepage.',
              color: const Color(0xFF06B6D4),
              isDark: isDark,
            ),
          ],
          // Brand Store Info
          if (_adType == AdType.brandStore) ...[
            const SizedBox(height: 20),
            _buildInfoCard(
              icon: Icons.store_rounded,
              title: 'Brand Store Spotlight',
              description: 'Your store will be featured in the "Top Stores" section. Make sure your store profile is complete.',
              color: const Color(0xFF8B5CF6),
              isDark: isDark,
            ),
          ],
          // Retargeting Info
          if (_adType == AdType.retargeting) ...[
            const SizedBox(height: 20),
            _buildInfoCard(
              icon: Icons.track_changes_rounded,
              title: 'Retargeting Ads',
              description: 'Your products will be shown to users who previously viewed or wishlisted them.',
              color: const Color(0xFFEF4444),
              isDark: isDark,
            ),
          ],
        ],
      ),
    );
  }

  /// Phase 2: Build ad type option selector
  Widget _buildAdTypeOption(AdType type, String title, String subtitle, IconData icon, bool isDark) {
    final isSelected = _adType == type;
    return GestureDetector(
      onTap: () => setState(() {
        _adType = type;
        // Set billing type based on ad type
        _billingType = type == AdType.reelsBoost ? BillingType.cpv : BillingType.cpc;
        // Set default targeting for ad types
        if (type == AdType.keywordSearch) {
          _targetType = CampaignTargetType.keywords;
        } else if (type == AdType.reelsBoost) {
          _targetType = CampaignTargetType.auto; // Reels don't need targeting
        }
      }),
      child: AnimatedContainer(
        duration: 200.ms,
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary.withValues(alpha: 0.12)
              : (isDark ? Colors.white : Colors.black).withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? AppColors.primary : Colors.transparent,
            width: 2,
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.primary.withValues(alpha: 0.2)
                    : (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Icon(
                icon,
                color: isSelected ? AppColors.primary : (isDark ? Colors.grey[400] : Colors.grey[600]),
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 14,
                      color: isDark ? Colors.white : const Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.grey[500] : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            // Badge for billing type
            if (isSelected)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: type == AdType.reelsBoost ? Colors.purple.withValues(alpha: 0.2) : AppColors.primary.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  type == AdType.reelsBoost ? 'CPV' : 'CPC',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: type == AdType.reelsBoost ? Colors.purple : AppColors.primary,
                  ),
                ),
              ),
            if (isSelected)
              const SizedBox(width: 8),
            if (isSelected)
              Icon(Icons.check_circle, color: AppColors.primary, size: 20)
            else
              Icon(Icons.circle_outlined, color: isDark ? Colors.grey[600] : Colors.grey[400], size: 20),
          ],
        ),
      ),
    );
  }

  // Helper: Info card for specific ad types
  Widget _buildInfoCard({
    required IconData icon,
    required String title,
    required String description,
    required Color color,
    required bool isDark,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: color.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: color,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  description,
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTargetingOption(
    CampaignTargetType type,
    String title,
    String subtitle,
    IconData icon,
    bool isDark,
  ) {
    final isSelected = _targetType == type;
    return GestureDetector(
      onTap: () => setState(() => _targetType = type),
      child: AnimatedContainer(
        duration: 200.ms,
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected
              ? AppColors.primary.withValues(alpha: 0.1)
              : (isDark ? Colors.white : Colors.black).withValues(alpha: 0.03),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? AppColors.primary : Colors.transparent,
            width: 2,
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: isSelected
                    ? AppColors.primary.withValues(alpha: 0.15)
                    : (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(
                icon,
                color: isSelected ? AppColors.primary : (isDark ? Colors.grey[400] : Colors.grey[600]),
                size: 22,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.white : const Color(0xFF111827),
                    ),
                  ),
                  Text(
                    subtitle,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.grey[500] : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            if (isSelected)
              const Icon(Icons.check_circle_rounded, color: AppColors.primary),
          ],
        ),
      ),
    );
  }

  // ============================================================
  // STEP 3: BUDGET
  // ============================================================
  Step _buildBudgetStep(bool isDark) {
    return Step(
      title: Text('Budget', style: _stepTitleStyle(isDark)),
      subtitle: _currentStep > 2 
          ? Text('₹${_dailyBudgetController.text}/day • ₹${_totalBudgetController.text} total')
          : null,
      isActive: _currentStep >= 2,
      state: _currentStep > 2 ? StepState.complete : StepState.indexed,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Set your advertising budget',
            style: TextStyle(
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 20),
          // Daily Budget
          Text(
            'Daily Budget',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : const Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: _dailyBudgetController,
            keyboardType: TextInputType.number,
            style: TextStyle(
              color: isDark ? Colors.white : const Color(0xFF111827),
              fontWeight: FontWeight.w600,
            ),
            decoration: _inputDecoration('₹100', isDark, prefix: '₹'),
            validator: (v) {
              final val = double.tryParse(v ?? '');
              if (val == null || val < 50) return 'Minimum ₹50 daily';
              return null;
            },
          ),
          const SizedBox(height: 20),
          // Total Budget
          Text(
            'Total Budget',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : const Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 8),
          TextFormField(
            controller: _totalBudgetController,
            keyboardType: TextInputType.number,
            style: TextStyle(
              color: isDark ? Colors.white : const Color(0xFF111827),
              fontWeight: FontWeight.w600,
            ),
            decoration: _inputDecoration('₹1000', isDark, prefix: '₹'),
            validator: (v) {
              final val = double.tryParse(v ?? '');
              if (val == null || val < 100) return 'Minimum ₹100 total';
              return null;
            },
          ),
          const SizedBox(height: 20),
          // CPC Range Info Card
          _buildCpcRangeCard(isDark),
          const SizedBox(height: 20),
          // Date Range
          Text(
            'Campaign Duration',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: isDark ? Colors.white : const Color(0xFF111827),
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: _buildDateButton(
                  'Start',
                  _startDate,
                  isDark,
                  () => _pickDate(true),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _buildDateButton(
                  'End (Optional)',
                  _endDate,
                  isDark,
                  () => _pickDate(false),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          // Minimum CPC Note
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.blue.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.blue.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_rounded, color: Colors.blue, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Minimum ₹0.5 per click (CPC). You only pay when someone clicks your ad.',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.blue[300] : Colors.blue[700],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          // Estimated Results Card
          EstimatedResultsCard(
            dailyBudget: double.tryParse(_dailyBudgetController.text) ?? 100,
            cpc: _defaultBid,
            categoryId: _selectedCategoryId,
          ),
        ],
      ),
    );
  }

  Widget _buildDateButton(String label, DateTime? date, bool isDark, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.1),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 11,
                color: isDark ? Colors.grey[500] : Colors.grey[600],
              ),
            ),
            const SizedBox(height: 4),
            Text(
              date != null ? '${date.day}/${date.month}/${date.year}' : 'Select',
              style: TextStyle(
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : const Color(0xFF111827),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ============================================================
  // STEP 4: REVIEW
  // ============================================================
  Step _buildReviewStep(bool isDark) {
    return Step(
      title: Text('Review & Submit', style: _stepTitleStyle(isDark)),
      isActive: _currentStep >= 3,
      state: StepState.indexed,
      content: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Review your campaign details',
            style: TextStyle(
              color: isDark ? Colors.grey[400] : Colors.grey[600],
              fontSize: 14,
            ),
          ),
          const SizedBox(height: 20),
          _buildReviewItem('Campaign Name', _nameController.text, isDark),
          _buildReviewItem('Targeting', _targetType.name.toUpperCase(), isDark),
          if (_targetType == CampaignTargetType.keywords)
            _buildReviewItem('Keywords', _keywords.join(', '), isDark),
          _buildReviewItem('Daily Budget', '₹${_dailyBudgetController.text}', isDark),
          _buildReviewItem('Total Budget', '₹${_totalBudgetController.text}', isDark),
          _buildReviewItem('Start Date', '${_startDate.day}/${_startDate.month}/${_startDate.year}', isDark),
          if (_endDate != null)
            _buildReviewItem('End Date', '${_endDate!.day}/${_endDate!.month}/${_endDate!.year}', isDark),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.orange.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.orange.withValues(alpha: 0.2)),
            ),
            child: Row(
              children: [
                const Icon(Icons.schedule_rounded, color: Colors.orange, size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Your campaign will be reviewed by admin before going live.',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.orange[300] : Colors.orange[700],
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

  Widget _buildReviewItem(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 100,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 13,
                color: isDark ? Colors.grey[500] : Colors.grey[600],
              ),
            ),
          ),
          Expanded(
            child: Text(
              value.isEmpty ? '-' : value,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : const Color(0xFF111827),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ============================================================
  // HELPERS
  // ============================================================

  /// Build a row for each keyword with editable bid
  Widget _buildKeywordBidRow(String keyword, bool isDark) {
    final currentBid = _keywordBids[keyword] ?? _defaultBid;
    final cpcRange = KeywordBidModel.getCpcRange(keyword);
    
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          // Keyword text
          Expanded(
            flex: 3,
            child: Text(
              keyword,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w500,
                color: isDark ? Colors.white : const Color(0xFF111827),
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          // Suggested range hint
          Text(
            '₹${cpcRange['min']!.toStringAsFixed(0)}-${cpcRange['max']!.toStringAsFixed(0)}',
            style: TextStyle(
              fontSize: 10,
              color: isDark ? Colors.grey[600] : Colors.grey[400],
            ),
          ),
          const SizedBox(width: 8),
          // Bid input
          Container(
            width: 70,
            height: 32,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                Text(
                  '₹',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.primary,
                  ),
                ),
                Expanded(
                  child: TextFormField(
                    initialValue: currentBid.toStringAsFixed(0),
                    keyboardType: TextInputType.number,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 13,
                      fontWeight: FontWeight.w700,
                      color: AppColors.primary,
                    ),
                    decoration: const InputDecoration(
                      border: InputBorder.none,
                      isDense: true,
                      contentPadding: EdgeInsets.zero,
                    ),
                    onChanged: (v) {
                      final val = double.tryParse(v);
                      if (val != null && val >= 3) {
                        setState(() => _keywordBids[keyword] = val);
                      }
                    },
                  ),
                ),
              ],
            ),
          ),
          // Delete button
          IconButton(
            icon: Icon(Icons.close, size: 16, color: Colors.grey[500]),
            constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
            padding: EdgeInsets.zero,
            onPressed: () => setState(() {
              _keywords.remove(keyword);
              _keywordBids.remove(keyword);
            }),
          ),
        ],
      ),
    );
  }

  TextStyle _stepTitleStyle(bool isDark) {
    return TextStyle(
      fontWeight: FontWeight.w700,
      color: isDark ? Colors.white : const Color(0xFF111827),
    );
  }

  InputDecoration _inputDecoration(String hint, bool isDark, {String? prefix}) {
    return InputDecoration(
      hintText: hint,
      prefixText: prefix,
      prefixStyle: TextStyle(
        color: isDark ? Colors.white : const Color(0xFF111827),
        fontWeight: FontWeight.w600,
      ),
      filled: true,
      fillColor: (isDark ? Colors.white : Colors.black).withValues(alpha: 0.05),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
    );
  }

  /// CPC Range Card - Shows expected cost per click based on targeting
  Widget _buildCpcRangeCard(bool isDark) {
    // Determine ad type from target type
    final AdType adType = _targetType == CampaignTargetType.keywords 
        ? AdType.keywordSearch 
        : AdType.sponsoredProduct;
    final cpcRange = AdCampaignModel.getCpcRange(adType);
    
    // Competition level indicator
    String competitionLevel;
    Color levelColor;
    if (_targetType == CampaignTargetType.keywords && _keywords.length < 3) {
      competitionLevel = 'Low';
      levelColor = const Color(0xFF10B981);
    } else if (_targetType == CampaignTargetType.auto) {
      competitionLevel = 'Medium';
      levelColor = const Color(0xFFF59E0B);
    } else {
      competitionLevel = 'Varies';
      levelColor = const Color(0xFF6366F1);
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            AppColors.primary.withValues(alpha: 0.1),
            AppColors.primary.withValues(alpha: 0.05),
          ],
        ),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.trending_up_rounded, color: AppColors.primary, size: 20),
              const SizedBox(width: 8),
              Text(
                'Expected Cost Per Click',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: isDark ? Colors.white : const Color(0xFF111827),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _buildCpcPill('Min', '₹${cpcRange['min']!.toStringAsFixed(0)}', const Color(0xFF10B981), isDark),
              const SizedBox(width: 8),
              Container(
                width: 60,
                height: 4,
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFF10B981), Color(0xFFF59E0B), Color(0xFFEF4444)],
                  ),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              _buildCpcPill('Max', '₹${cpcRange['max']!.toStringAsFixed(0)}', const Color(0xFFEF4444), isDark),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: levelColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '$competitionLevel Competition',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: levelColor,
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _targetType == CampaignTargetType.keywords 
                      ? 'You only pay when someone clicks'
                      : 'CPC varies based on demand',
                  style: TextStyle(
                    fontSize: 11,
                    color: isDark ? Colors.grey[500] : Colors.grey[600],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCpcPill(String label, String value, Color color, bool isDark) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        children: [
          Text(
            label,
            style: TextStyle(
              fontSize: 10,
              color: color,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStepperControls(ControlsDetails details, bool isDark) {
    final isLastStep = _currentStep == 3;
    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Row(
        children: [
          if (_currentStep > 0)
            TextButton(
              onPressed: details.onStepCancel,
              child: const Text('Back'),
            ),
          const Spacer(),
          ElevatedButton(
            onPressed: _isSubmitting ? null : details.onStepContinue,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: _isSubmitting
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation(Colors.white),
                    ),
                  )
                : Text(isLastStep ? 'Submit for Review' : 'Continue'),
          ),
        ],
      ),
    );
  }

  void _onStepContinue() async {
    if (_currentStep < 3) {
      if (_currentStep == 0 && !_formKey.currentState!.validate()) return;
      if (_currentStep == 2 && !_formKey.currentState!.validate()) return;
      setState(() => _currentStep++);
    } else {
      await _submitCampaign();
    }
  }

  void _onStepCancel() {
    if (_currentStep > 0) {
      setState(() => _currentStep--);
    }
  }

  Future<void> _pickDate(bool isStart) async {
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart ? _startDate : (_endDate ?? DateTime.now().add(const Duration(days: 30))),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _startDate = picked;
        } else {
          _endDate = picked;
        }
      });
    }
  }

  Future<void> _submitCampaign() async {
    setState(() => _isSubmitting = true);

    try {
      final sellerId = Provider.of<SellerProvider>(context, listen: false).sellerId;
      if (sellerId == null) throw Exception('Not logged in');

      // Check wallet balance before creating campaign
      final wallet = await _adService.getOrCreateAdWallet(sellerId);
      final dailyBudget = double.parse(_dailyBudgetController.text);
      
      if (wallet.balance < dailyBudget) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'Insufficient ad wallet balance. You need at least ₹${dailyBudget.toStringAsFixed(0)} (daily budget). Current balance: ₹${wallet.balance.toStringAsFixed(0)}',
              ),
              backgroundColor: Colors.red,
              duration: const Duration(seconds: 4),
            ),
          );
        }
        return;
      }

      final campaignId = await _adService.createCampaign(
        sellerId: sellerId,
        name: _nameController.text,
        targetType: _targetType,
        adType: _adType,
        billingType: _billingType,
        dailyBudget: dailyBudget,
        totalBudget: double.parse(_totalBudgetController.text),
        bidAmount: _defaultBid,
        startDate: _startDate,
        endDate: _endDate,
        keywords: _targetType == CampaignTargetType.keywords ? _keywords : null,
        categoryId: _targetType == CampaignTargetType.category ? _selectedCategoryId : null,
      );
      
      // For Reels Boost: automatically add the selected reel as an ad product
      if (_adType == AdType.reelsBoost && _selectedReelId != null) {
        await _adService.addProductToCampaign(
          campaignId: campaignId,
          sellerId: sellerId,
          productId: _selectedReelId!, // Reel ID is stored as productId
          bidAmount: _defaultBid,
        );
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✅ Campaign submitted for review!')),
        );
        Navigator.pop(context);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('❌ Error: $e')),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }
}
