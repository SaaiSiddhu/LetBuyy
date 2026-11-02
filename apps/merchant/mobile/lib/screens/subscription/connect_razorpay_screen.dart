import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:provider/provider.dart';
import 'package:uuid/uuid.dart';
import '../../app/store_context.dart';
import 'package:letbuyy_models/letbuyy_models.dart';
import '../../services/subscription_service.dart';

import '../../models/store_model.dart';
import '../../theme/app_theme_colors.dart';

/// Connect Own Razorpay Screen (Professional Plan Only)
/// Allows sellers to connect their own Razorpay account
class ConnectRazorpayScreen extends StatefulWidget {
  const ConnectRazorpayScreen({super.key});

  @override
  State<ConnectRazorpayScreen> createState() => _ConnectRazorpayScreenState();
}

class _ConnectRazorpayScreenState extends State<ConnectRazorpayScreen> {
  final _formKey = GlobalKey<FormState>();
  final _keyIdController = TextEditingController();
  final _keySecretController = TextEditingController();

  final bool _testMode = true;
  bool _isLoading = false;
  bool _isConnecting = false;
  bool _isConnected = false;
  bool _obscureSecret = true;
  late AppThemeColors colors;

  StoreModel? _store;
  PaymentConfigModel? _paymentConfig;
  int _loadVersion = 0;
  String? _saveKey;
  String? _saveFingerprint;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _keyIdController.dispose();
    _keySecretController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    final version = ++_loadVersion;
    final stores = context.read<StoreContext>();
    final epoch = stores.requestContextVersion;
    setState(() => _isLoading = true);
    try {
      final subscriptionService = context.read<SubscriptionService>();

      final store = await stores.ensureSelectedStore();
      if (store != null) {
        final config = await subscriptionService.getPaymentConfigModel(
          store.id,
        );
        if (!mounted || version != _loadVersion || stores.requestContextVersion != epoch || stores.selectedStoreId != store.id) return;
        setState(() {
          _store = store;
          _paymentConfig = config;
          _isConnected =
              config?.mode == PaymentMode.ownAccount &&
              config?.verified == true;
        });
      }
    } finally {
      if (mounted && version == _loadVersion) setState(() => _isLoading = false);
    }
  }

  Future<void> _connectRazorpay() async {
    if (_isConnecting || !_formKey.currentState!.validate()) return;
    final store = _store;
    final stores = context.read<StoreContext>();
    final epoch = stores.requestContextVersion;
    if (store == null || stores.selectedStoreId != store.id) return;

    setState(() => _isConnecting = true);
    HapticFeedback.mediumImpact();

    try {
      final subscriptionService = context.read<SubscriptionService>();
      final fingerprint = '$epoch:${store.id}:${_keyIdController.text}:${_keySecretController.text}:${_paymentConfig?.revision}';
      if (_saveFingerprint != fingerprint) { _saveFingerprint = fingerprint; _saveKey = const Uuid().v4(); }
      final response = await subscriptionService.connectOwnRazorpay(
        storeId: store.id,
        keyId: _keyIdController.text.trim(),
        keySecret: _keySecretController.text.trim(),
        testMode: _testMode,
        idempotencyKey: _saveKey,
        expectedRevision: _paymentConfig?.revision,
      );
      if (!mounted || stores.requestContextVersion != epoch || stores.selectedStoreId != store.id) return;
      final config = PaymentConfigModel.fromMap(response, store.id);

      setState(() {
        _paymentConfig = config;
        _isConnected = config.mode == PaymentMode.ownAccount && config.verified;
      });

      if (config.canEnableOnline) {
        _keyIdController.clear();
        _keySecretController.clear();
        _saveKey = null; _saveFingerprint = null;
        _showSuccessDialog();
      } else {
        _showError(
          'Keys were saved, but verification did not complete. Re-check the credentials before accepting live payments.',
        );
      }
    } catch (e) {
      if (mounted)
        _showError(
          'Payment settings could not be confirmed. Reload and check the saved connection before retrying.',
        );
    } finally {
      if (mounted) setState(() => _isConnecting = false);
    }
  }

  Future<void> _connectManagedTestPayments() async {
    if (_isConnecting) return;
    final store = _store;
    final stores = context.read<StoreContext>();
    final epoch = stores.requestContextVersion;
    if (store == null || stores.selectedStoreId != store.id) return;
    final fingerprint = '$epoch:${store.id}:managed-sandbox:${_paymentConfig?.revision}';
    if (_saveFingerprint != fingerprint) { _saveFingerprint = fingerprint; _saveKey = const Uuid().v4(); }
    setState(() => _isConnecting = true);
    try {
      final response = await context.read<SubscriptionService>().connectManagedTestPayments(
        storeId: store.id, idempotencyKey: _saveKey!, expectedRevision: _paymentConfig?.revision);
      if (!mounted || stores.requestContextVersion != epoch || stores.selectedStoreId != store.id) return;
      final config = PaymentConfigModel.fromMap(response, store.id);
      setState(() { _paymentConfig = config; _isConnected = false; });
      _saveKey = null; _saveFingerprint = null;
      _keyIdController.clear(); _keySecretController.clear();
      _showSuccessDialog();
    } catch (_) {
      if (mounted && stores.requestContextVersion == epoch && stores.selectedStoreId == store.id) {
        _showError('Test connection could not be confirmed. Reload the saved settings before retrying.');
      }
    } finally { if (mounted) setState(() => _isConnecting = false); }
  }

  void _showSuccessDialog() {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: Colors.green.withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: Icon(Icons.check, color: Colors.green),
            ),
            const SizedBox(width: 12),
            Text(
              'Test connection saved',
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
        content: Text(
          'Your test connection was verified and saved. Online checkout remains off until explicitly enabled. Test payments do not settle to a bank account; business and bank approval are not confirmed.',
          style: TextStyle(color: colors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              Navigator.pop(context);
            },
            child: Text('Done'),
          ),
        ],
      ),
    );
  }

  void _showError(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: Colors.red[700],
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    colors = AppThemeColors.of(context);
    return Scaffold(
      backgroundColor: colors.bgStart,
      body: Container(
        decoration: colors.backgroundGradient,
        child: SafeArea(
          child: _isLoading
              ? const Center(child: CircularProgressIndicator())
              : _buildContent(),
        ),
      ),
    );
  }

  Widget _buildContent() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildHeader(),
          if (_paymentConfig?.managedSandboxAvailable == true) ...[
            const SizedBox(height: 16),
            const Text('LetBuyy test payments: no real money or bank settlement. Enable online checkout separately after connecting.'),
            OutlinedButton.icon(
              onPressed: _isConnecting || _paymentConfig?.mode == PaymentMode.managedSandbox ? null : _connectManagedTestPayments,
              icon: const Icon(Icons.science_outlined),
              label: Text(_paymentConfig?.mode == PaymentMode.managedSandbox ? 'LetBuyy test payments connected' : 'Use LetBuyy test payments'),
            ),
          ],
          const SizedBox(height: 24),
          _buildInfoCard(),
          const SizedBox(height: 24),
          if (_store?.subscriptionPlan != SubscriptionPlan.professional) ...[
            _buildUpgradeRequired(),
          ] else if (_isConnected) ...[
            _buildConnectedCard(),
          ] else ...[
            _buildConnectionForm(),
          ],
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      children: [
        IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back_ios, color: colors.textPrimary),
        ),
        const SizedBox(width: 8),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Connect Razorpay',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: colors.textPrimary,
                ),
              ),
              Text(
                'Use your own payment gateway',
                style: TextStyle(fontSize: 13, color: colors.textSecondary),
              ),
            ],
          ),
        ),
      ],
    ).animate().fadeIn(duration: 300.ms);
  }

  Widget _buildInfoCard() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF2563EB).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFF2563EB).withValues(alpha: 0.3),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: const Color(0xFF2563EB).withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(Icons.info_outline, color: Color(0xFF2563EB)),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Professional Benefit',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: colors.textPrimary,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'LetBuyy charges a 0% transaction fee. Test credentials do not confirm KYC, bank approval or live checkout readiness.',
                  style: TextStyle(fontSize: 12, color: colors.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    ).animate(delay: 100.ms).fadeIn().slideY(begin: 0.1);
  }

  Widget _buildConnectedCard() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.green.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Colors.green,
              shape: BoxShape.circle,
            ),
            child: Icon(Icons.check, color: Colors.white, size: 32),
          ),
          const SizedBox(height: 16),
          Text(
            'Razorpay Connected',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            _paymentConfig?.statusText ?? 'Payment readiness not confirmed',
            style: TextStyle(color: colors.textSecondary),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: _buildStatusItem('Commission', '0%', Colors.green),
              ),
              Expanded(
                child: _buildStatusItem(
                  'Bank',
                  'Not confirmed',
                  colors.textSecondary,
                ),
              ),
            ],
          ),
        ],
      ),
    ).animate(delay: 200.ms).fadeIn().scale(begin: const Offset(0.95, 0.95));
  }

  Widget _buildStatusItem(String label, String value, Color color) {
    return Column(
      children: [
        Text(
          value,
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: color,
          ),
        ),
        Text(
          label,
          style: TextStyle(fontSize: 12, color: colors.textSecondary),
        ),
      ],
    );
  }

  Widget _buildConnectionForm() {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'API Credentials',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Enter your Razorpay API keys from the Dashboard',
            style: TextStyle(fontSize: 13, color: colors.textSecondary),
          ),
          const SizedBox(height: 20),

          // Key ID Field
          _buildInputField(
            controller: _keyIdController,
            label: 'Key ID',
            hint: 'Razorpay key ID',
            validator: (v) {
              if (v == null || v.isEmpty) return 'Key ID is required';
              final expectedPrefix =
                  'rzp'
                  '_';
              if (!v.startsWith('${expectedPrefix}test_'))
                return 'Enter a Razorpay test key';
              return null;
            },
          ),
          const SizedBox(height: 16),

          // Key Secret Field
          _buildInputField(
            controller: _keySecretController,
            label: 'Key Secret',
            hint: 'xxxxxxxxxxxxxxxxxx',
            obscure: _obscureSecret,
            suffixIcon: IconButton(
              icon: Icon(
                _obscureSecret ? Icons.visibility : Icons.visibility_off,
                color: colors.textSecondary,
              ),
              onPressed: () => setState(() => _obscureSecret = !_obscureSecret),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) return 'Key Secret is required';
              if (v.length < 16) return 'Invalid Key Secret';
              return null;
            },
          ),
          const SizedBox(height: 16),

          // Sandbox mode toggle; request field remains test_mode for API compatibility.
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: colors.glassMedium,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Sandbox Mode',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: colors.textPrimary,
                        ),
                      ),
                      Text(
                        'Only sandbox credentials are supported until live onboarding is qualified',
                        style: TextStyle(
                          fontSize: 12,
                          color: colors.textSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                Switch(
                  value: _testMode,
                  onChanged: null,
                  activeColor: const Color(0xFF2563EB),
                ),
              ],
            ),
          ),

          const SizedBox(height: 32),

          // Connect Button
          SizedBox(
            width: double.infinity,
            height: 56,
            child: ElevatedButton(
              onPressed: _isConnecting ? null : _connectRazorpay,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF2563EB),
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: _isConnecting
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    )
                  : Text(
                      'Connect Razorpay',
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 16,
                      ),
                    ),
            ),
          ),

          const SizedBox(height: 16),

          Center(
            child: Text(
              'Your API keys are encrypted and stored securely',
              style: TextStyle(fontSize: 11, color: colors.textSecondary),
            ),
          ),
        ],
      ),
    ).animate(delay: 200.ms).fadeIn().slideY(begin: 0.1);
  }

  Widget _buildInputField({
    required TextEditingController controller,
    required String label,
    required String hint,
    bool obscure = false,
    Widget? suffixIcon,
    String? Function(String?)? validator,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: colors.textPrimary,
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          obscureText: obscure,
          validator: validator,
          style: TextStyle(color: colors.textPrimary),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(color: colors.textSecondary),
            suffixIcon: suffixIcon,
            filled: true,
            fillColor: colors.glassMedium,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: colors.glassMediumBorder),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: colors.glassMediumBorder),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF2563EB)),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.red[400]!),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildUpgradeRequired() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                color: const Color(0xFFF59E0B).withValues(alpha: 0.2),
                shape: BoxShape.circle,
              ),
              child: Text('👑', style: TextStyle(fontSize: 48)),
            ),
            const SizedBox(height: 24),
            Text(
              'Professional Plan Required',
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: colors.textPrimary,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              'Upgrade to Professional to connect your own Razorpay account and pay 0% commission.',
              textAlign: TextAlign.center,
              style: TextStyle(color: colors.textSecondary),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFF59E0B),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                  horizontal: 32,
                  vertical: 16,
                ),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
              ),
              child: Text('View Plans'),
            ),
          ],
        ),
      ),
    );
  }
}
