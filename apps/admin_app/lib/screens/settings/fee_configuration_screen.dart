import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import 'package:letbuyy_core/letbuyy_core.dart';

/// Admin screen for configuring platform fees and delivery settings
class FeeConfigurationScreen extends StatefulWidget {
  const FeeConfigurationScreen({super.key});

  @override
  State<FeeConfigurationScreen> createState() => _FeeConfigurationScreenState();
}

class _FeeConfigurationScreenState extends State<FeeConfigurationScreen> {
  final FeeService _feeService = FeeService();
  
  bool _isLoading = true;
  bool _isSaving = false;
  FeeConfigModel _config = FeeConfigModel.defaults;

  // Controllers
  final _platformFeeController = TextEditingController();
  final _deliveryMarkupController = TextEditingController();
  final _codFeeController = TextEditingController();
  final _pgFeeController = TextEditingController();
  final _rtoRefusedController = TextEditingController();
  final _rtoReturnController = TextEditingController();
  final _qualityPenaltyController = TextEditingController();
  final _freeDeliveryThresholdController = TextEditingController();
  final _settlementHoldDaysController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadConfig();
  }

  @override
  void dispose() {
    _platformFeeController.dispose();
    _deliveryMarkupController.dispose();
    _codFeeController.dispose();
    _pgFeeController.dispose();
    _rtoRefusedController.dispose();
    _rtoReturnController.dispose();
    _qualityPenaltyController.dispose();
    _freeDeliveryThresholdController.dispose();
    _settlementHoldDaysController.dispose();
    super.dispose();
  }

  Future<void> _loadConfig() async {
    setState(() => _isLoading = true);
    
    try {
      final config = await _feeService.getFeeConfig(forceRefresh: true);
      _config = config;
      
      // Populate controllers
      _platformFeeController.text = config.platformFee.toStringAsFixed(0);
      _deliveryMarkupController.text = config.deliveryFeeMarkup.toStringAsFixed(0);
      _codFeeController.text = config.codFee.toStringAsFixed(0);
      _pgFeeController.text = config.paymentGatewayFeePercent.toStringAsFixed(1);
      _rtoRefusedController.text = config.rtoRefusedPercent.toStringAsFixed(0);
      _rtoReturnController.text = config.rtoReturnPercent.toStringAsFixed(0);
      _qualityPenaltyController.text = config.qualityPenalty.toStringAsFixed(0);
      _freeDeliveryThresholdController.text = config.freeDeliveryThreshold.toStringAsFixed(0);
      _settlementHoldDaysController.text = config.settlementHoldDays.toString();
    } catch (e) {
      if (mounted) {
        SnackbarHelper.showError(context, 'Failed to load configuration');
      }
    }
    
    if (mounted) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _saveConfig() async {
    setState(() => _isSaving = true);
    
    try {
      final updatedConfig = _config.copyWith(
        platformFee: double.tryParse(_platformFeeController.text) ?? 20.0,
        deliveryFeeMarkup: double.tryParse(_deliveryMarkupController.text) ?? 0.0,
        codFee: double.tryParse(_codFeeController.text) ?? 40.0,
        paymentGatewayFeePercent: double.tryParse(_pgFeeController.text) ?? 2.0,
        rtoRefusedPercent: double.tryParse(_rtoRefusedController.text) ?? 200.0,
        rtoReturnPercent: double.tryParse(_rtoReturnController.text) ?? 100.0,
        qualityPenalty: double.tryParse(_qualityPenaltyController.text) ?? 50.0,
        freeDeliveryThreshold: double.tryParse(_freeDeliveryThresholdController.text) ?? 0.0,
        settlementHoldDays: int.tryParse(_settlementHoldDaysController.text) ?? 7,
      );
      
      final success = await _feeService.saveFeeConfig(
        updatedConfig,
        updatedBy: 'admin', // TODO: Get actual admin ID
      );
      
      if (mounted) {
        if (success) {
          _config = updatedConfig;
          SnackbarHelper.showSuccess(context, 'Configuration saved successfully!');
        } else {
          SnackbarHelper.showError(context, 'Failed to save configuration');
        }
      }
    } catch (e) {
      if (mounted) {
        SnackbarHelper.showError(context, 'Error saving: $e');
      }
    }
    
    if (mounted) {
      setState(() => _isSaving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey.shade50,
      appBar: AppBar(
        title: const Text('Fee Configuration'),
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        actions: [
          if (!_isLoading)
            IconButton(
              onPressed: _loadConfig,
              icon: const Icon(Icons.refresh_rounded),
              tooltip: 'Reload',
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Header Card
                  _buildHeaderCard(),
                  const SizedBox(height: 24),
                  
                  // Order Fees Section
                  _buildSectionHeader('Order Fees', Icons.receipt_long_rounded),
                  const SizedBox(height: 12),
                  _buildSettingsCard([
                    _buildFeeField(
                      controller: _platformFeeController,
                      label: 'Platform Fee (per order)',
                      prefix: '₹',
                      hint: '20',
                      icon: Icons.storefront_rounded,
                      color: const Color(0xFF6366F1),
                      helperText: 'Fixed fee deducted from every order',
                    ),
                    _buildFeeField(
                      controller: _deliveryMarkupController,
                      label: 'Delivery Fee Markup',
                      suffix: '%',
                      hint: '0',
                      icon: Icons.local_shipping_rounded,
                      color: const Color(0xFF10B981),
                      helperText: 'Markup on courier rate (0 = pass-through)',
                    ),
                    _buildFeeField(
                      controller: _codFeeController,
                      label: 'COD Handling Fee',
                      prefix: '₹',
                      hint: '40',
                      icon: Icons.money_rounded,
                      color: const Color(0xFFF59E0B),
                      helperText: 'Charged when customer pays Cash on Delivery',
                    ),
                    _buildFeeField(
                      controller: _pgFeeController,
                      label: 'Payment Gateway Fee',
                      suffix: '%',
                      hint: '2.0',
                      icon: Icons.credit_card_rounded,
                      color: const Color(0xFF8B5CF6),
                      helperText: 'Charged on online payments (Razorpay/UPI)',
                      decimal: true,
                    ),
                  ]),
                  
                  const SizedBox(height: 24),
                  
                  // RTO & Penalty Section
                  _buildSectionHeader('RTO & Penalty Settings', Icons.assignment_return_rounded),
                  const SizedBox(height: 12),
                  _buildSettingsCard([
                    _buildFeeField(
                      controller: _rtoRefusedController,
                      label: 'RTO Fee (Refused Delivery)',
                      suffix: '%',
                      hint: '200',
                      icon: Icons.cancel_rounded,
                      color: const Color(0xFFEF4444),
                      helperText: '% of forward shipping (200% = 2× shipping)',
                    ),
                    _buildFeeField(
                      controller: _rtoReturnController,
                      label: 'RTO Fee (Customer Return)',
                      suffix: '%',
                      hint: '100',
                      icon: Icons.keyboard_return_rounded,
                      color: const Color(0xFFF97316),
                      helperText: '% of forward shipping (100% = 1× shipping)',
                    ),
                    _buildFeeField(
                      controller: _qualityPenaltyController,
                      label: 'Quality Penalty (Defective)',
                      prefix: '₹',
                      hint: '50',
                      icon: Icons.warning_amber_rounded,
                      color: const Color(0xFFDC2626),
                      helperText: 'Extra charge when seller sends defective product',
                    ),
                  ]),
                  
                  const SizedBox(height: 24),
                  
                  // Delivery Settings Section
                  _buildSectionHeader('Delivery Settings', Icons.delivery_dining_rounded),
                  const SizedBox(height: 12),
                  _buildSettingsCard([
                    _buildToggleField(
                      label: 'Free Delivery',
                      subtitle: 'Enable free delivery for qualifying orders',
                      value: _config.freeDeliveryEnabled,
                      onChanged: (value) {
                        setState(() {
                          _config = _config.copyWith(freeDeliveryEnabled: value);
                        });
                      },
                      icon: Icons.local_offer_rounded,
                      color: const Color(0xFF10B981),
                    ),
                    if (_config.freeDeliveryEnabled)
                      _buildFeeField(
                        controller: _freeDeliveryThresholdController,
                        label: 'Free Delivery Threshold',
                        prefix: '₹',
                        hint: '499',
                        icon: Icons.shopping_cart_rounded,
                        color: const Color(0xFF14B8A6),
                        helperText: 'Minimum order value for free delivery (0 = always free)',
                      ),
                    _buildToggleField(
                      label: 'COD Enabled',
                      subtitle: 'Allow Cash on Delivery orders',
                      value: _config.codEnabled,
                      onChanged: (value) {
                        setState(() {
                          _config = _config.copyWith(codEnabled: value);
                        });
                      },
                      icon: Icons.payments_rounded,
                      color: const Color(0xFFF59E0B),
                    ),
                  ]),
                  
                  const SizedBox(height: 24),
                  
                  // Settlement Settings Section
                  _buildSectionHeader('Settlement Settings', Icons.account_balance_rounded),
                  const SizedBox(height: 12),
                  _buildSettingsCard([
                    _buildFeeField(
                      controller: _settlementHoldDaysController,
                      label: 'Settlement Hold Period',
                      suffix: 'days',
                      hint: '7',
                      icon: Icons.schedule_rounded,
                      color: const Color(0xFF6366F1),
                      helperText: 'Days to hold payment after delivery before payout',
                      isInteger: true,
                    ),
                  ]),
                  
                  const SizedBox(height: 32),
                  
                  // Save Button
                  SizedBox(
                    width: double.infinity,
                    height: 56,
                    child: ElevatedButton.icon(
                      onPressed: _isSaving ? null : _saveConfig,
                      icon: _isSaving 
                          ? const SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(
                                strokeWidth: 2,
                                color: Colors.white,
                              ),
                            )
                          : const Icon(Icons.save_rounded),
                      label: Text(_isSaving ? 'Saving...' : 'Save Configuration'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                        textStyle: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  Widget _buildHeaderCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            AppColors.primary,
            AppColors.primary.withValues(alpha: 0.8),
          ],
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.3),
            blurRadius: 15,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(16),
            ),
            child: const Icon(
              Icons.tune_rounded,
              color: Colors.white,
              size: 32,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Platform Fees & Settings',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Configure all fees deducted from seller settlements',
                  style: TextStyle(
                    color: Colors.white.withValues(alpha: 0.9),
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, IconData icon) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: AppColors.primary, size: 20),
        ),
        const SizedBox(width: 12),
        Text(
          title,
          style: AppTextStyles.titleMedium.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildSettingsCard(List<Widget> children) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        children: children.map((child) {
          final index = children.indexOf(child);
          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: child,
              ),
              if (index < children.length - 1)
                Divider(height: 1, color: Colors.grey.shade200),
            ],
          );
        }).toList(),
      ),
    );
  }

  Widget _buildFeeField({
    required TextEditingController controller,
    required String label,
    required String hint,
    required IconData icon,
    required Color color,
    String? prefix,
    String? suffix,
    String? helperText,
    bool decimal = false,
    bool isInteger = false,
  }) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 24),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: AppTextStyles.titleSmall.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              if (helperText != null)
                Text(
                  helperText,
                  style: AppTextStyles.bodySmall.copyWith(
                    color: Colors.grey.shade600,
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(width: 16),
        SizedBox(
          width: 100,
          child: TextField(
            controller: controller,
            keyboardType: TextInputType.numberWithOptions(
              decimal: decimal,
              signed: false,
            ),
            inputFormatters: [
              if (isInteger || (!decimal && suffix == null))
                FilteringTextInputFormatter.digitsOnly,
              if (decimal)
                FilteringTextInputFormatter.allow(RegExp(r'^\d*\.?\d{0,2}')),
            ],
            textAlign: TextAlign.center,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 16,
            ),
            decoration: InputDecoration(
              prefixText: prefix,
              suffixText: suffix,
              hintText: hint,
              contentPadding: const EdgeInsets.symmetric(
                horizontal: 12,
                vertical: 12,
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: Colors.grey.shade300),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(10),
                borderSide: BorderSide(color: color, width: 2),
              ),
              filled: true,
              fillColor: Colors.grey.shade50,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildToggleField({
    required String label,
    required String subtitle,
    required bool value,
    required ValueChanged<bool> onChanged,
    required IconData icon,
    required Color color,
  }) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: color, size: 24),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: AppTextStyles.titleSmall.copyWith(
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                subtitle,
                style: AppTextStyles.bodySmall.copyWith(
                  color: Colors.grey.shade600,
                ),
              ),
            ],
          ),
        ),
        Switch(
          value: value,
          onChanged: onChanged,
          activeThumbColor: color,
        ),
      ],
    );
  }
}
