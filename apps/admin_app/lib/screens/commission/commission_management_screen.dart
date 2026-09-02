// Commission Management Screen
// Admin screen for managing commission settings, tiers, and categories

import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:flutter_animate/flutter_animate.dart';

class CommissionManagementScreen extends StatefulWidget {
  const CommissionManagementScreen({super.key});

  @override
  State<CommissionManagementScreen> createState() => _CommissionManagementScreenState();
}

class _CommissionManagementScreenState extends State<CommissionManagementScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  CommissionSettingsModel? _settings;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _loadSettings();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadSettings() async {
    setState(() => _isLoading = true);
    try {
      final doc = await FirebaseFirestore.instance
          .doc('settings/commission')
          .get();
      
      if (doc.exists) {
        _settings = CommissionSettingsModel.fromMap(doc.data()!);
      } else {
        _settings = const CommissionSettingsModel();
      }
    } catch (e) {
      debugPrint('Error loading settings: $e');
      _settings = const CommissionSettingsModel();
    }
    setState(() => _isLoading = false);
  }

  Future<void> _saveSettings() async {
    if (_settings == null) return;
    
    try {
      await FirebaseFirestore.instance
          .doc('settings/commission')
          .set(_settings!.toMap());
      
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Row(
              children: [
                Icon(Icons.check_circle, color: Colors.white),
                SizedBox(width: 12),
                Text('Settings saved successfully'),
              ],
            ),
            backgroundColor: AppColors.success,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Error: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      body: _isLoading
          ? Center(child: CircularProgressIndicator(color: AppColors.primary))
          : Column(
              children: [
                _buildHeader(isDark),
                _buildTabs(isDark),
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildGlobalSettingsTab(isDark),
                      _buildTierConfigTab(isDark),
                      _buildCategoryCommissionTab(isDark),
                      _buildSellerOverridesTab(isDark),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildHeader(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.primary, AppColors.secondary],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(
                Icons.percent_rounded,
                color: Colors.white,
                size: 28,
              ),
            ),
            const SizedBox(width: 16),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Commission Management',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Configure commissions, tiers & seller rates',
                    style: TextStyle(
                      color: Colors.white70,
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            ),
            ElevatedButton.icon(
              onPressed: _saveSettings,
              icon: const Icon(Icons.save_rounded),
              label: const Text('Save All'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppColors.primary,
                padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTabs(bool isDark) {
    return Container(
      color: isDark ? AppColors.surfaceDark : Colors.white,
      child: TabBar(
        controller: _tabController,
        labelColor: AppColors.primary,
        unselectedLabelColor: isDark ? Colors.grey[400] : Colors.grey[600],
        indicatorColor: AppColors.primary,
        indicatorWeight: 3,
        tabs: const [
          Tab(icon: Icon(Icons.settings), text: 'Global'),
          Tab(icon: Icon(Icons.military_tech), text: 'Tiers'),
          Tab(icon: Icon(Icons.category), text: 'Categories'),
          Tab(icon: Icon(Icons.person_outline), text: 'Sellers'),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 1: GLOBAL SETTINGS
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildGlobalSettingsTab(bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildSettingsCard(
            isDark,
            title: 'General Settings',
            icon: Icons.tune_rounded,
            children: [
              _buildNumberField(
                label: 'Hold Days',
                value: _settings?.holdDays.toDouble() ?? 7,
                suffix: 'days',
                hint: 'Days to hold payment after delivery',
                onChanged: (v) => setState(() {
                  _settings = _settings?.copyWith(holdDays: v.toInt());
                }),
              ),
              const SizedBox(height: 16),
              _buildNumberField(
                label: 'Default Ad Discount',
                value: _settings?.defaultAdDiscount ?? 4.0,
                suffix: '%',
                hint: 'Commission discount for ad orders',
                onChanged: (v) => setState(() {
                  _settings = _settings?.copyWith(defaultAdDiscount: v);
                }),
              ),
            ],
          ).animate().fadeIn().slideX(begin: -0.1),
          const SizedBox(height: 24),
          _buildSettingsCard(
            isDark,
            title: 'Commission Limits',
            icon: Icons.trending_up_rounded,
            children: [
              Row(
                children: [
                  Expanded(
                    child: _buildNumberField(
                      label: 'Minimum',
                      value: _settings?.minCommission ?? 0,
                      suffix: '%',
                      onChanged: (v) => setState(() {
                        _settings = _settings?.copyWith(minCommission: v);
                      }),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _buildNumberField(
                      label: 'Maximum',
                      value: _settings?.maxCommission ?? 10,
                      suffix: '%',
                      onChanged: (v) => setState(() {
                        _settings = _settings?.copyWith(maxCommission: v);
                      }),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              _buildNumberField(
                label: 'Default Category Commission',
                value: _settings?.defaultPercent ?? 5,
                suffix: '%',
                hint: 'Used when category has no commission set',
                onChanged: (v) => setState(() {
                  _settings = _settings?.copyWith(defaultPercent: v);
                }),
              ),
            ],
          ).animate(delay: 100.ms).fadeIn().slideX(begin: -0.1),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 2: TIER CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildTierConfigTab(bool isDark) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        children: [
          _buildTierCard(isDark, 'New Seller', Icons.fiber_new_rounded,
              _settings?.newSellerTier, Colors.orange, (config) {
            setState(() {
              _settings = _settings?.copyWith(newSellerTier: config);
            });
          }).animate().fadeIn().slideY(begin: 0.1),
          const SizedBox(height: 16),
          _buildTierCard(isDark, 'Standard', Icons.verified_user_outlined,
              _settings?.standardTier, Colors.blue, (config) {
            setState(() {
              _settings = _settings?.copyWith(standardTier: config);
            });
          }).animate(delay: 100.ms).fadeIn().slideY(begin: 0.1),
          const SizedBox(height: 16),
          _buildTierCard(isDark, 'Verified', Icons.verified_rounded,
              _settings?.verifiedTier, AppColors.success, (config) {
            setState(() {
              _settings = _settings?.copyWith(verifiedTier: config);
            });
          }).animate(delay: 200.ms).fadeIn().slideY(begin: 0.1),
          const SizedBox(height: 16),
          _buildTierCard(isDark, 'Premium', Icons.workspace_premium_rounded,
              _settings?.premiumTier, Colors.purple, (config) {
            setState(() {
              _settings = _settings?.copyWith(premiumTier: config);
            });
          }).animate(delay: 300.ms).fadeIn().slideY(begin: 0.1),
        ],
      ),
    );
  }

  Widget _buildTierCard(
    bool isDark,
    String name,
    IconData icon,
    TierConfig? config,
    Color color,
    Function(TierConfig) onChanged,
  ) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withValues(alpha: 0.3), width: 2),
        boxShadow: [
          BoxShadow(
            color: color.withValues(alpha: 0.1),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, color: color, size: 24),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  name,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: (config?.modifier ?? 0) > 0
                      ? Colors.red.withValues(alpha: 0.1)
                      : (config?.modifier ?? 0) < 0
                          ? AppColors.success.withValues(alpha: 0.1)
                          : Colors.grey.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  '${(config?.modifier ?? 0) >= 0 ? '+' : ''}${config?.modifier ?? 0}%',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: (config?.modifier ?? 0) > 0
                        ? Colors.red
                        : (config?.modifier ?? 0) < 0
                            ? AppColors.success
                            : Colors.grey,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildNumberField(
                  label: 'Max Revenue',
                  value: config?.maxRevenue.isFinite == true
                      ? config!.maxRevenue
                      : 0,
                  prefix: '₹',
                  hint: '0 = unlimited',
                  onChanged: (v) {
                    onChanged(TierConfig(
                      maxRevenue: v == 0 ? double.infinity : v,
                      modifier: config?.modifier ?? 0,
                    ));
                  },
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _buildNumberField(
                  label: 'Modifier',
                  value: config?.modifier ?? 0,
                  suffix: '%',
                  allowNegative: true,
                  onChanged: (v) {
                    onChanged(TierConfig(
                      maxRevenue: config?.maxRevenue ?? double.infinity,
                      modifier: v,
                    ));
                  },
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 3: CATEGORY COMMISSION
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildCategoryCommissionTab(bool isDark) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('categories')
          .orderBy('level')
          .orderBy('displayOrder')
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return Center(child: CircularProgressIndicator(color: AppColors.primary));
        }

        final categories = snapshot.data!.docs
            .map((doc) => CategoryModel.fromMap(doc.data() as Map<String, dynamic>, doc.id))
            .toList();

        // Build tree structure
        final mainCategories = categories.where((c) => c.parentId == null).toList();

        return ListView.builder(
          padding: const EdgeInsets.all(16),
          itemCount: mainCategories.length,
          itemBuilder: (context, index) {
            return _buildCategoryTree(
              isDark,
              mainCategories[index],
              categories,
              0,
            ).animate(delay: (index * 50).ms).fadeIn().slideX(begin: -0.05);
          },
        );
      },
    );
  }

  Widget _buildCategoryTree(
    bool isDark,
    CategoryModel category,
    List<CategoryModel> allCategories,
    int depth,
  ) {
    final children = allCategories.where((c) => c.parentId == category.id).toList();
    final hasCommission = category.commission.percent != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: EdgeInsets.only(left: depth * 24.0, bottom: 8),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: isDark ? AppColors.surfaceDark : Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: hasCommission
                  ? AppColors.primary.withValues(alpha: 0.3)
                  : (isDark ? AppColors.borderDark : AppColors.border),
            ),
          ),
          child: Row(
            children: [
              if (depth > 0)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Icon(
                    Icons.subdirectory_arrow_right,
                    size: 16,
                    color: Colors.grey,
                  ),
                ),
              Expanded(
                child: Text(
                  category.name,
                  style: TextStyle(
                    fontWeight: depth == 0 ? FontWeight.bold : FontWeight.w500,
                    color: isDark ? Colors.white : Colors.black87,
                  ),
                ),
              ),
              if (hasCommission)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    '${category.commission.percent}%',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: AppColors.primary,
                    ),
                  ),
                )
              else
                Text(
                  '(inherits)',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              const SizedBox(width: 8),
              IconButton(
                icon: Icon(Icons.edit, size: 18, color: AppColors.primary),
                onPressed: () => _showCategoryCommissionDialog(category),
                tooltip: 'Edit Commission',
              ),
            ],
          ),
        ),
        ...children.map((child) => _buildCategoryTree(isDark, child, allCategories, depth + 1)),
      ],
    );
  }

  void _showCategoryCommissionDialog(CategoryModel category) {
    double? percent = category.commission.percent;
    double? adDiscount = category.commission.adDiscount;
    bool inherit = category.commission.inheritFromParent;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDialogState) {
          return AlertDialog(
            title: Text('Edit: ${category.name}'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                SwitchListTile(
                  title: const Text('Inherit from Parent'),
                  value: inherit,
                  onChanged: (v) => setDialogState(() => inherit = v),
                ),
                if (!inherit) ...[
                  const SizedBox(height: 16),
                  TextField(
                    decoration: const InputDecoration(
                      labelText: 'Commission %',
                      border: OutlineInputBorder(),
                    ),
                    keyboardType: TextInputType.number,
                    controller: TextEditingController(text: percent?.toString() ?? ''),
                    onChanged: (v) => percent = double.tryParse(v),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    decoration: const InputDecoration(
                      labelText: 'Ad Discount %',
                      border: OutlineInputBorder(),
                      hintText: 'Leave empty to use global',
                    ),
                    keyboardType: TextInputType.number,
                    controller: TextEditingController(text: adDiscount?.toString() ?? ''),
                    onChanged: (v) => adDiscount = double.tryParse(v),
                  ),
                ],
              ],
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () async {
                  await FirebaseFirestore.instance
                      .collection('categories')
                      .doc(category.id)
                      .update({
                    'commission': {
                      'percent': inherit ? null : percent,
                      'adDiscount': inherit ? null : adDiscount,
                      'inheritFromParent': inherit,
                    },
                  });
                  if (ctx.mounted) Navigator.pop(ctx);
                },
                child: const Text('Save'),
              ),
            ],
          );
        },
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TAB 4: SELLER OVERRIDES
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildSellerOverridesTab(bool isDark) {
    return StreamBuilder<QuerySnapshot>(
      stream: FirebaseFirestore.instance
          .collection('sellers')
          .where('commission.customOverride', isNull: false)
          .snapshots(),
      builder: (context, snapshot) {
        if (!snapshot.hasData) {
          return Center(child: CircularProgressIndicator(color: AppColors.primary));
        }

        final sellers = snapshot.data!.docs;

        if (sellers.isEmpty) {
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.person_outline, size: 64, color: Colors.grey),
                const SizedBox(height: 16),
                Text(
                  'No seller overrides',
                  style: TextStyle(fontSize: 18, color: Colors.grey),
                ),
                const SizedBox(height: 8),
                ElevatedButton.icon(
                  onPressed: _showAddSellerOverrideDialog,
                  icon: const Icon(Icons.add),
                  label: const Text('Add Override'),
                ),
              ],
            ),
          );
        }

        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  ElevatedButton.icon(
                    onPressed: _showAddSellerOverrideDialog,
                    icon: const Icon(Icons.add),
                    label: const Text('Add Override'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                itemCount: sellers.length,
                itemBuilder: (context, index) {
                  final data = sellers[index].data() as Map<String, dynamic>;
                  final sellerId = sellers[index].id;
                  final storeName = data['storeName'] ?? 'Unknown';
                  final override = data['commission']?['customOverride'];

                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    child: ListTile(
                      leading: CircleAvatar(
                        backgroundColor: AppColors.primary.withValues(alpha: 0.1),
                        child: Icon(Icons.store, color: AppColors.primary),
                      ),
                      title: Text(storeName),
                      subtitle: Text('ID: $sellerId'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                            decoration: BoxDecoration(
                              color: AppColors.warning.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              '$override%',
                              style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: AppColors.warning,
                              ),
                            ),
                          ),
                          IconButton(
                            icon: const Icon(Icons.delete_outline, color: Colors.red),
                            onPressed: () => _removeSellerOverride(sellerId),
                          ),
                        ],
                      ),
                    ),
                  ).animate(delay: (index * 50).ms).fadeIn();
                },
              ),
            ),
          ],
        );
      },
    );
  }

  void _showAddSellerOverrideDialog() {
    String sellerId = '';
    double? override;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Seller Override'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              decoration: const InputDecoration(
                labelText: 'Seller ID',
                border: OutlineInputBorder(),
              ),
              onChanged: (v) => sellerId = v,
            ),
            const SizedBox(height: 16),
            TextField(
              decoration: const InputDecoration(
                labelText: 'Commission Override %',
                border: OutlineInputBorder(),
              ),
              keyboardType: TextInputType.number,
              onChanged: (v) => override = double.tryParse(v),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () async {
              if (sellerId.isNotEmpty && override != null) {
                await FirebaseFirestore.instance
                    .collection('sellers')
                    .doc(sellerId)
                    .update({
                  'commission.customOverride': override,
                });
                if (ctx.mounted) Navigator.pop(ctx);
              }
            },
            child: const Text('Add'),
          ),
        ],
      ),
    );
  }

  Future<void> _removeSellerOverride(String sellerId) async {
    await FirebaseFirestore.instance
        .collection('sellers')
        .doc(sellerId)
        .update({
      'commission.customOverride': FieldValue.delete(),
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPER WIDGETS
  // ═══════════════════════════════════════════════════════════════════════════
  Widget _buildSettingsCard(
    bool isDark, {
    required String title,
    required IconData icon,
    required List<Widget> children,
  }) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.surfaceDark : Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: AppColors.shadowLight,
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: AppColors.primary),
              const SizedBox(width: 12),
              Text(
                title,
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          ...children,
        ],
      ),
    );
  }

  Widget _buildNumberField({
    required String label,
    required double value,
    String? prefix,
    String? suffix,
    String? hint,
    bool allowNegative = false,
    required Function(double) onChanged,
  }) {
    return TextField(
      decoration: InputDecoration(
        labelText: label,
        helperText: hint,
        prefixText: prefix,
        suffixText: suffix,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      keyboardType: TextInputType.numberWithOptions(
        decimal: true,
        signed: allowNegative,
      ),
      controller: TextEditingController(text: value.toString()),
      onChanged: (v) {
        final parsed = double.tryParse(v);
        if (parsed != null) onChanged(parsed);
      },
    );
  }
}
