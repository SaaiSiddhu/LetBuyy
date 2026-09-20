// lib/screens/kyc/kyc_wizard_screen.dart
// 7-Step Enhanced KYC Wizard with ML OCR & Face Verification
// ✨ Professional Redesign matching Admin/Seller Login

import 'dart:async';
import 'dart:convert';
// dart:io removed - not needed on web
import 'dart:ui'; // Added for ImageFilter
import 'dart:math' as math;
import '../../utils/platform_utils.dart';
import 'package:flutter/foundation.dart'; // Added for kIsWeb
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import 'package:geocoding/geocoding.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_animate/flutter_animate.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:file_picker/file_picker.dart';
import 'package:firebase_auth/firebase_auth.dart';

import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
// Make sure this import is correct based on project structure

import '../../providers/seller_provider.dart';
import '../../app/routes.dart';
import '../../data/bank_data.dart';
import '../../data/indian_districts.dart';
import '../../data/business_categories.dart';

class KycWizardScreen extends StatefulWidget {
  final int initialStep;
  
  const KycWizardScreen({super.key, this.initialStep = 0});

  @override
  State<KycWizardScreen> createState() => _KycWizardScreenState();
}

class _KycWizardScreenState extends State<KycWizardScreen> with TickerProviderStateMixin {
  int _currentStep = 0;
  final _imagePicker = ImagePicker();
  bool _isLoading = false;
  bool _isOcrProcessing = false;
  
  // Cloud Functions base URL
  static const String _functionsBaseUrl = 'https://us-central1-letbuy-y.cloudfunctions.net';
  
  // Support email
  static const String _supportEmail = 'saaisiddharth2004@gmail.com';

  // Step names for progress indicator (3 steps total)
  final List<String> _stepNames = ['Business', 'Identity', 'Bank'];

  // ═══════════════════════════════════════════════════════════════
  // CONTROLLERS
  // ═══════════════════════════════════════════════════════════════

  // Step 1: Business Details (NEW - Combined Business + GST + Categories)
  final _businessNameController = TextEditingController();
  String? _businessType;
  final List<String> _businessTypes = ['Individual', 'Sole Proprietorship', 'Partnership', 'Private Limited', 'LLP'];
  bool _hasGstRegistration = false; // GST Yes/No toggle
  String? _primaryCategory;
  String? _primarySubCategory;
  List<String> _availableSubCategories = [];
  String? _detectedGstState; // State from GSTIN

  // Step 2: PAN Card
  final _panNumberController = TextEditingController();
  final _panNameController = TextEditingController();
  final _panFatherNameController = TextEditingController();
  XFile? _panCardImage;
  Uint8List? _panCardImageBytes; // For web compatibility
  bool _panOcrDone = false;
  double _panConfidence = 0;

  // Step 2: Aadhaar
  final _aadhaarNumberController = TextEditingController();
  final _aadhaarNameController = TextEditingController();
  XFile? _aadhaarFrontImage;
  Uint8List? _aadhaarFrontImageBytes; // For web compatibility
  XFile? _aadhaarBackImage;
  Uint8List? _aadhaarBackImageBytes; // For web compatibility
  bool _aadhaarOcrDone = false;
  double _aadhaarConfidence = 0;
  int _nameMatchPercentage = 0;
  String _nameMatchStatus = '';
  bool _nameMatchChecked = false;

  // Step 4: Selfie
  XFile? _selfieImage;
  Uint8List? _selfieImageBytes; // For web compatibility
  final bool _faceVerified = false;
  final bool _faceSubmittedForReview = false;
  // Liveness variables (placeholders for future implementation)
  final bool _livenessCompleted = false; 

  // Note: Business Type & GST moved to Step 1 (Business Details)
  // Keep GST controller for GSTIN input
  final _gstNumberController = TextEditingController();
  XFile? _gstCertificateImage;
  Uint8List? _gstCertificateImageBytes; // For web compatibility
  bool _isGstExempt = false;

  // Step 5: Bank
  final _accountNumberController = TextEditingController();
  final _confirmAccountController = TextEditingController();
  final _ifscController = TextEditingController();
  final _accountHolderController = TextEditingController();
  BankInfo? _selectedBank;
  bool _ifscValidated = false;
  String? _ifscBankName; // Bank name from IFSC validation
  XFile? _cancelledChequeImage;
  Uint8List? _cancelledChequeImageBytes; // For web compatibility
  String? _cancelledChequeFileName; // For PDF file name display
  bool _isChequeUploaded = false; // Track if cheque/passbook is uploaded

  // Step 7: Address
  final _addressLine1Controller = TextEditingController();
  final _addressLine2Controller = TextEditingController();
  final _pincodeController = TextEditingController();
  String? _selectedAddressState; // State dropdown selection
  String? _selectedAddressCity; // City/District dropdown selection
  List<String> _availableAddressCities = []; // Cities for selected state
  XFile? _addressProofImage;
  Uint8List? _addressProofImageBytes; // For web compatibility
  Position? _currentPosition;

  // Animation Controllers
  late AnimationController _bgAnimController;
  late AnimationController _floatController;
  
  // Focus Nodes
  final _panNumberFocus = FocusNode();
  final _panNameFocus = FocusNode();
  // ... (add other focus nodes as needed dynamically or reuse generic logic)

  // Responsive Breakpoints
  static const double _mobileBreakpoint = 600;
  static const double _tabletBreakpoint = 1024;
  static const double _desktopBreakpoint = 1440;

  @override
  void initState() {
    super.initState();
    _currentStep = widget.initialStep.clamp(0, _stepNames.length - 1);
    _initAnimations();
    // Add listener to update verify button state when IFSC changes
    _ifscController.addListener(() {
      if (mounted) setState(() {});
    });
    // Add listeners for account fields to update Continue button state
    _accountNumberController.addListener(() {
      if (mounted) setState(() {});
    });
    _accountHolderController.addListener(() {
      if (mounted) setState(() {});
    });
    // Add listeners for address fields
    _addressLine1Controller.addListener(() {
      if (mounted) setState(() {});
    });
    _pincodeController.addListener(() {
      if (mounted) setState(() {});
    });
    
    // Check for saved KYC progress after frame renders
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _checkForSavedProgress();
    });
  }
  
  /// Pre-fill business name from seller's store name (called in build for reactivity)
  void _prefillBusinessName(SellerProvider sellerProvider) {
    if (_businessNameController.text.isNotEmpty) return; // Already filled
    
    final seller = sellerProvider.currentSeller;
    if (seller == null) return;
    
    // Try storeName first, then fallback to name
    String businessName = seller.storeName;
    if (businessName.isEmpty) {
      businessName = seller.name;
    }
    
    if (businessName.isNotEmpty) {
      // Use addPostFrameCallback to avoid calling setState during build
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && _businessNameController.text.isEmpty) {
          setState(() {
            _businessNameController.text = businessName;
          });
        }
      });
    }
  }
  
  /// Updates the browser URL to reflect the current KYC step (web only)
  void _updateUrlForStep(int step) {
    if (!mounted) return;
    if (kIsWeb) {
      final stepName = AppRoutes.kycStepNames[step];
      final newUrl = '/kyc-wizard/$stepName';
      // Use platform-safe utility to update URL
      try {
        updateBrowserUrl(newUrl);
      } catch (e) {
        debugPrint('URL update failed: $e');
      }
    }
  }
  
  // ═══════════════════════════════════════════════════════════════
  // KYC PROGRESS PERSISTENCE
  // ═══════════════════════════════════════════════════════════════
  
  static const String _kycProgressKey = 'kyc_progress';
  
  /// Save current KYC progress to SharedPreferences
  Future<void> _saveKycProgress() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final progressData = {
        'currentStep': _currentStep,
        // Business Details (Step 1 - NEW)
        'businessName': _businessNameController.text,
        'businessType': _businessType,
        'hasGstRegistration': _hasGstRegistration,
        'primaryCategory': _primaryCategory,
        'primarySubCategory': _primarySubCategory,
        'gstNumber': _gstNumberController.text,
        // PAN (Step 2)
        'panNumber': _panNumberController.text,
        'panName': _panNameController.text,
        'panFatherName': _panFatherNameController.text,
        'panOcrDone': _panOcrDone,
        // Aadhaar
        'aadhaarNumber': _aadhaarNumberController.text,
        'aadhaarName': _aadhaarNameController.text,
        'aadhaarOcrDone': _aadhaarOcrDone,
        // Bank
        'selectedBankCode': _selectedBank?.code,
        'ifscCode': _ifscController.text,
        'ifscValidated': _ifscValidated,
        'ifscBankName': _ifscBankName,
        'accountNumber': _accountNumberController.text,
        'accountHolderName': _accountHolderController.text,
        // Address
        'addressState': _selectedAddressState,
        'addressCity': _selectedAddressCity,
        'addressLine1': _addressLine1Controller.text,
        'addressLine2': _addressLine2Controller.text,
        'pincode': _pincodeController.text,
        'lastSaved': DateTime.now().toIso8601String(),
      };
      await prefs.setString(_kycProgressKey, jsonEncode(progressData));
      debugPrint('💾 KYC progress saved at step $_currentStep');
    } catch (e) {
      debugPrint('Failed to save KYC progress: $e');
    }
  }
  
  /// Load KYC progress from SharedPreferences and check if restore is needed
  Future<void> _checkForSavedProgress() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final progressJson = prefs.getString(_kycProgressKey);
      
      if (progressJson != null && progressJson.isNotEmpty) {
        final progressData = jsonDecode(progressJson) as Map<String, dynamic>;
        final savedStep = progressData['currentStep'] as int? ?? 0;
        
        // Only show restore dialog if progress exists beyond step 0
        if (savedStep > 0 && mounted) {
          _showRestoreDialog(progressData, savedStep);
        }
      }
    } catch (e) {
      debugPrint('Failed to load KYC progress: $e');
    }
  }
  
  /// Restore KYC progress from saved data
  void _restoreProgress(Map<String, dynamic> data) {
    setState(() {
      _currentStep = data['currentStep'] as int? ?? 0;
      
      // Business Details (Step 1 - NEW)
      _businessNameController.text = data['businessName'] as String? ?? '';
      _businessType = data['businessType'] as String?;
      _hasGstRegistration = data['hasGstRegistration'] as bool? ?? false;
      _primaryCategory = data['primaryCategory'] as String?;
      _primarySubCategory = data['primarySubCategory'] as String?;
      if (_primaryCategory != null) {
        _availableSubCategories = getSubCategories(_primaryCategory!);
      }
      _gstNumberController.text = data['gstNumber'] as String? ?? '';
      
      // PAN (Step 2)
      _panNumberController.text = data['panNumber'] as String? ?? '';
      _panNameController.text = data['panName'] as String? ?? '';
      _panFatherNameController.text = data['panFatherName'] as String? ?? '';
      _panOcrDone = data['panOcrDone'] as bool? ?? false;
      
      // Aadhaar
      _aadhaarNumberController.text = data['aadhaarNumber'] as String? ?? '';
      _aadhaarNameController.text = data['aadhaarName'] as String? ?? '';
      _aadhaarOcrDone = data['aadhaarOcrDone'] as bool? ?? false;
      
      // Bank
      final bankCode = data['selectedBankCode'] as String?;
      if (bankCode != null) {
        _selectedBank = indianBanks.firstWhere(
          (b) => b.code == bankCode,
          orElse: () => indianBanks.first,
        );
      }
      _ifscController.text = data['ifscCode'] as String? ?? '';
      _ifscValidated = data['ifscValidated'] as bool? ?? false;
      _ifscBankName = data['ifscBankName'] as String?;
      _accountNumberController.text = data['accountNumber'] as String? ?? '';
      _accountHolderController.text = data['accountHolderName'] as String? ?? '';
      
      // Address
      _selectedAddressState = data['addressState'] as String?;
      _selectedAddressCity = data['addressCity'] as String?;
      if (_selectedAddressState != null) {
        _availableAddressCities = indianDistricts[_selectedAddressState] ?? [];
      }
      _addressLine1Controller.text = data['addressLine1'] as String? ?? '';
      _addressLine2Controller.text = data['addressLine2'] as String? ?? '';
      _pincodeController.text = data['pincode'] as String? ?? '';
    });
    
    _updateUrlForStep(_currentStep);
    _showSuccess('Progress restored! Continue from ${_stepNames[_currentStep]}.');
  }
  
  /// Clear saved KYC progress
  Future<void> _clearKycProgress() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_kycProgressKey);
      debugPrint('🗑️ KYC progress cleared');
    } catch (e) {
      debugPrint('Failed to clear KYC progress: $e');
    }
  }
  
  /// Show dialog to restore or start over
  void _showRestoreDialog(Map<String, dynamic> progressData, int savedStep) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.restore, color: Color(0xFF3B82F6)),
            ),
            const SizedBox(width: 12),
            const Expanded(child: Text('Continue KYC?')),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'You have unsaved progress from your last session.',
              style: TextStyle(color: Colors.grey[600]),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey[100],
                borderRadius: BorderRadius.circular(8),
              ),
              child: Row(
                children: [
                  const Icon(Icons.bookmark, color: Color(0xFF3B82F6)),
                  const SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Last saved at:', style: TextStyle(fontSize: 12, color: Colors.grey)),
                      Text(
                        'Step ${savedStep + 1}: ${_stepNames[savedStep]}',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(context);
              _clearKycProgress();
            },
            child: const Text('Start Over', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(context);
              _restoreProgress(progressData);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF3B82F6),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Continue', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _initAnimations() {
    _bgAnimController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 25),
    )..repeat();

    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 4000),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _bgAnimController.dispose();
    _floatController.dispose();
    _businessNameController.dispose(); // NEW
    _panNumberController.dispose();
    _panNameController.dispose();
    _panFatherNameController.dispose();
    _aadhaarNumberController.dispose();
    _aadhaarNameController.dispose();
    _gstNumberController.dispose();
    _accountNumberController.dispose();
    _confirmAccountController.dispose();
    _ifscController.dispose();
    _accountHolderController.dispose();
    _addressLine1Controller.dispose();
    _addressLine2Controller.dispose();
    _pincodeController.dispose();
    _panNumberFocus.dispose();
    _panNameFocus.dispose();
    super.dispose();
  }

  /// Open email client with support template
  Future<void> _contactSupport() async {
    final sellerProvider = context.read<SellerProvider>();
    final seller = sellerProvider.currentSeller;
    
    final subject = Uri.encodeComponent('KYC Support Request - ${seller?.storeName ?? 'Seller'}');
    final body = Uri.encodeComponent('''
Dear LetBuyy Support Team,

I need help completing my KYC verification.

Seller Details:
- Store Name: ${seller?.storeName ?? 'N/A'}
- Email: ${seller?.email ?? 'N/A'}
- Phone: ${seller?.phone ?? 'N/A'}
- Current Step: ${_stepNames[_currentStep]}

Please assist me with the verification process.

Thank you,
${seller?.storeName ?? 'Seller'}
''');
    
    final emailUri = Uri.parse('mailto:$_supportEmail?subject=$subject&body=$body');
    
    try {
      if (await canLaunchUrl(emailUri)) {
        await launchUrl(emailUri);
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Unable to open email. Contact $_supportEmail'),
              backgroundColor: AppColors.error,
            ),
          );
        }
      }
    } catch (e) {
      debugPrint('Email launch error: $e');
    }
  }

  /// Show logout confirmation dialog
  Future<void> _showLogoutDialog() async {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Icon(Icons.logout_rounded, color: isDark ? Colors.white : Colors.grey[800], size: 24),
            const SizedBox(width: 12),
            Text('Switch Account', style: TextStyle(color: isDark ? Colors.white : Colors.grey[800], fontWeight: FontWeight.w600)),
          ],
        ),
        content: Text(
          'Sign out to switch to a different seller account?',
          style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600]),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text('Cancel', style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600])),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(context);
              await _clearKycProgress(); // Clear saved KYC progress on logout
              await FirebaseAuth.instance.signOut();
              if (mounted) {
                Navigator.pushNamedAndRemoveUntil(context, AppRoutes.login, (route) => false);
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF111827),
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // LOGIC METHODS (OCR & API)
  // ═══════════════════════════════════════════════════════════════

   Future<void> _extractPanDetails() async {
    if (_panCardImage == null) return;
    setState(() => _isOcrProcessing = true);
    try {
      final bytes = await _panCardImage!.readAsBytes();
      final base64Image = base64Encode(bytes);
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/extractPanDetails'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'imageBase64': base64Image,
          'sellerId': context.read<SellerProvider>().currentSeller?.sellerId,
        }),
      );
      final data = jsonDecode(response.body);
      if (data['result']?['success'] == true) {
        final panData = data['result']['data'];
        setState(() {
          _panNumberController.text = panData['panNumber'] ?? '';
          _panNameController.text = panData['name'] ?? '';
          _panFatherNameController.text = panData['fatherName'] ?? '';
          _panOcrDone = true;
          _panConfidence = (data['result']['confidence'] ?? 0.0) * 100;
        });
        _showSuccess('PAN details extracted successfully!');
      } else {
        _showError(data['result']?['message'] ?? 'Failed to extract PAN details');
      }
    } catch (e) {
      _showError('Failed to process PAN card. Please enter manually.');
    } finally {
      if (mounted) setState(() => _isOcrProcessing = false);
    }
  }

  Future<void> _extractAadhaarDetails() async {
    if (_aadhaarFrontImage == null) return;
    setState(() => _isOcrProcessing = true);
    try {
      final bytes = await _aadhaarFrontImage!.readAsBytes();
      final base64Image = base64Encode(bytes);
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/extractAadhaarDetails'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'imageBase64': base64Image,
          'sellerId': context.read<SellerProvider>().currentSeller?.sellerId,
          'side': 'front',
        }),
      );
      final data = jsonDecode(response.body);
      if (data['result']?['success'] == true) {
        final aadhaarData = data['result']['data'];
        setState(() {
          _aadhaarNumberController.text = aadhaarData['aadhaarNumber'] ?? '';
          _aadhaarNameController.text = aadhaarData['name'] ?? '';
          _aadhaarOcrDone = true;
          _aadhaarConfidence = (data['result']['confidence'] ?? 0.0) * 100;
        });
        _showSuccess('Aadhaar details extracted successfully!');
        if (_panNameController.text.isNotEmpty && _aadhaarNameController.text.isNotEmpty) {
          await _verifyNames();
        }
      } else {
        _showError(data['result']?['message'] ?? 'Failed to extract Aadhaar details');
      }
    } catch (e) {
      _showError('Failed to process Aadhaar. Please enter manually.');
    } finally {
      if (mounted) setState(() => _isOcrProcessing = false);
    }
  }

  Future<void> _verifyNames() async {
    if (_panNameController.text.isEmpty || _aadhaarNameController.text.isEmpty) return;
    try {
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/verifyKycNames'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'panName': _panNameController.text,
          'aadhaarName': _aadhaarNameController.text,
          'sellerId': context.read<SellerProvider>().currentSeller?.sellerId,
        }),
      );
      final data = jsonDecode(response.body);
      if (data['result']?['success'] == true) {
        setState(() {
          _nameMatchPercentage = data['result']['similarity'] ?? 0;
          _nameMatchStatus = data['result']['status'] ?? 'unknown';
          _nameMatchChecked = true;
        });
      }
    } catch (e) {
      debugPrint('Name verification error: $e');
    }
  }

  Future<void> _submitKyc() async {
    setState(() => _isLoading = true);
    try {
      final sellerProvider = context.read<SellerProvider>();
      final seller = sellerProvider.currentSeller;
      
      // Prepare base64 images
      String? panImageBase64;
      String? aadhaarFrontBase64;
      String? aadhaarBackBase64;
      String? selfieBase64;
      
      if (_panCardImage != null) {
        panImageBase64 = base64Encode(await _panCardImage!.readAsBytes());
      }
      if (_aadhaarFrontImage != null) {
        aadhaarFrontBase64 = base64Encode(await _aadhaarFrontImage!.readAsBytes());
      }
      if (_aadhaarBackImage != null) {
        aadhaarBackBase64 = base64Encode(await _aadhaarBackImage!.readAsBytes());
      }
      if (_selfieImage != null) {
        selfieBase64 = base64Encode(await _selfieImage!.readAsBytes());
      }
      
      final response = await http.post(
        Uri.parse('$_functionsBaseUrl/submitKycDocuments'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'sellerId': seller?.sellerId,
          'sellerEmail': seller?.email,
          'sellerName': seller?.storeName ?? seller?.name,
          // Business Details (NEW)
          'businessName': _businessNameController.text,
          'businessType': _businessType,
          'hasGstRegistration': _hasGstRegistration,
          'gstNumber': _hasGstRegistration ? _gstNumberController.text : null,
          'primaryCategory': _primaryCategory,
          'primarySubCategory': _primarySubCategory,
          // KYC Documents
          'panImageBase64': panImageBase64,
          'aadhaarFrontBase64': aadhaarFrontBase64,
          'aadhaarBackBase64': aadhaarBackBase64,
          'selfieBase64': selfieBase64,
          'panNumber': _panNumberController.text,
          'panName': _panNameController.text,
          'aadhaarNumber': _aadhaarNumberController.text,
          'aadhaarName': _aadhaarNameController.text,
          // Bank Details
          'bankDetails': {
            'accountNumber': _accountNumberController.text,
            'ifscCode': _ifscController.text,
            'accountHolderName': _accountHolderController.text,
            'bankName': _selectedBank?.name ?? '',
            // Bank proof document (cancelled cheque / passbook)
            'bankProofBase64': _cancelledChequeImageBytes != null 
                ? base64Encode(_cancelledChequeImageBytes!) 
                : null,
            'bankProofFileName': _cancelledChequeFileName,
            'bankProofType': _cancelledChequeFileName?.endsWith('.pdf') == true ? 'pdf' : 'image',
          },
          // Business Address
          'businessAddress': {
            'line1': _addressLine1Controller.text,
            'line2': _addressLine2Controller.text,
            'city': _selectedAddressCity ?? '',
            'state': _selectedAddressState ?? '',
            'pincode': _pincodeController.text,
          },
        }),
      );

      final data = jsonDecode(response.body);
      if (data['result']?['success'] == true) {
        if (!mounted) return;
        await _clearKycProgress(); // Clear saved progress on success
        _showSuccess('KYC submitted successfully!');
        Navigator.pushReplacementNamed(context, AppRoutes.kycStatus);
      } else {
        _showError(data['result']?['message'] ?? 'Failed to submit KYC');
      }
    } catch (e) {
      _showError('Failed to submit KYC. Please try again.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _pickImage(Function(XFile) onPicked, {bool useCamera = false}) async {
    try {
      final XFile? image = await _imagePicker.pickImage(
        source: useCamera ? ImageSource.camera : ImageSource.gallery,
        maxWidth: 1200, maxHeight: 1200, imageQuality: 85,
      );
      if (image != null) onPicked(image);
    } catch (e) {
      _showError('Failed to pick image');
    }
  }
  
  /// Pick bank proof document (cancelled cheque or passbook) - supports image and PDF
  Future<void> _pickBankProof() async {
    // Show bottom sheet to choose between image and PDF
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) {
        final isDark = Theme.of(context).brightness == Brightness.dark;
        return Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1F1F1F) : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[400],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Upload Bank Proof',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Choose cancelled cheque or bank passbook',
                style: TextStyle(
                  fontSize: 13,
                  color: Colors.grey[500],
                ),
              ),
              const SizedBox(height: 24),
              Row(
                children: [
                  // Image option
                  Expanded(
                    child: _buildUploadOption(
                      icon: Icons.image_rounded,
                      label: 'Image',
                      subtitle: 'JPG, PNG',
                      color: const Color(0xFF3B82F6),
                      isDark: isDark,
                      onTap: () async {
                        Navigator.pop(context);
                        await _pickBankProofImage();
                      },
                    ),
                  ),
                  const SizedBox(width: 16),
                  // PDF option
                  Expanded(
                    child: _buildUploadOption(
                      icon: Icons.picture_as_pdf_rounded,
                      label: 'PDF File',
                      subtitle: 'Bank statement',
                      color: const Color(0xFFDC2626),
                      isDark: isDark,
                      onTap: () async {
                        Navigator.pop(context);
                        await _pickBankProofPdf();
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              // Camera option
              SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: () async {
                    Navigator.pop(context);
                    await _pickBankProofCamera();
                  },
                  icon: const Icon(Icons.camera_alt_rounded),
                  label: const Text('Take Photo'),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              SizedBox(height: MediaQuery.of(context).padding.bottom + 8),
            ],
          ),
        );
      },
    );
  }
  
  Widget _buildUploadOption({
    required IconData icon,
    required String label,
    required String subtitle,
    required Color color,
    required bool isDark,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: color.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: color.withValues(alpha: 0.3)),
        ),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.15),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color, size: 28),
            ),
            const SizedBox(height: 12),
            Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isDark ? Colors.white : Colors.black,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 11,
                color: Colors.grey[500],
              ),
            ),
          ],
        ),
      ),
    );
  }
  
  Future<void> _pickBankProofImage() async {
    try {
      final image = await _imagePicker.pickImage(
        source: ImageSource.gallery,
        maxWidth: 1200,
        maxHeight: 1200,
        imageQuality: 85,
      );
      if (image != null) {
        final bytes = await image.readAsBytes();
        setState(() {
          _cancelledChequeImage = image;
          _cancelledChequeImageBytes = bytes;
          _cancelledChequeFileName = image.name;
          _isChequeUploaded = true;
        });
        _showSuccess('Bank proof uploaded successfully');
      }
    } catch (e) {
      _showError('Failed to pick image');
    }
  }
  
  Future<void> _pickBankProofCamera() async {
    try {
      final image = await _imagePicker.pickImage(
        source: ImageSource.camera,
        maxWidth: 1200,
        maxHeight: 1200,
        imageQuality: 85,
      );
      if (image != null) {
        final bytes = await image.readAsBytes();
        setState(() {
          _cancelledChequeImage = image;
          _cancelledChequeImageBytes = bytes;
          _cancelledChequeFileName = image.name;
          _isChequeUploaded = true;
        });
        _showSuccess('Bank proof captured successfully');
      }
    } catch (e) {
      _showError('Failed to capture photo');
    }
  }
  
  Future<void> _pickBankProofPdf() async {
    try {
      final result = await FilePicker.platform.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf'],
        withData: true, // Required for web
      );
      if (result != null && result.files.isNotEmpty) {
        final file = result.files.first;
        if (file.bytes != null) {
          setState(() {
            _cancelledChequeImage = null; // Clear image if PDF is selected
            _cancelledChequeImageBytes = file.bytes;
            _cancelledChequeFileName = file.name;
            _isChequeUploaded = true;
          });
          _showSuccess('PDF uploaded successfully');
        }
      }
    } catch (e) {
      _showError('Failed to pick PDF file');
    }
  }

  Future<void> _getCurrentLocation() async {
    try {
      setState(() => _isLoading = true);
      
      // Check if geolocation is available on web
      if (kIsWeb) {
        // For web, use browser's Geolocation API directly through Geolocator
        final serviceEnabled = await Geolocator.isLocationServiceEnabled();
        if (!serviceEnabled) {
          _showError('Location services are disabled. Please enable them in your browser.');
          return;
        }
      }
      
      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          _showError('Location permission denied');
          return;
        }
      }
      
      if (permission == LocationPermission.deniedForever) {
        _showError('Location permissions permanently denied. Enable in browser settings.');
        return;
      }
      
      // Get position with high accuracy
      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.best, // Use best accuracy
        timeLimit: const Duration(seconds: 15), // Add timeout
      );
      _currentPosition = position;
      
      debugPrint('📍 GPS Coordinates: ${position.latitude}, ${position.longitude}');
      
      // Get placemarks from coordinates
      final placemarks = await placemarkFromCoordinates(
        position.latitude, 
        position.longitude,
      );
      
      if (placemarks.isNotEmpty) {
        // Use the first placemark but check multiple for better data
        final place = placemarks.first;
        
        debugPrint('📍 Placemark data:');
        debugPrint('   street: ${place.street}');
        debugPrint('   subLocality: ${place.subLocality}');
        debugPrint('   locality: ${place.locality}');
        debugPrint('   subAdministrativeArea: ${place.subAdministrativeArea}');
        debugPrint('   administrativeArea: ${place.administrativeArea}');
        debugPrint('   postalCode: ${place.postalCode}');
        
        // Extract address components
        final street = place.street ?? '';
        final subLocality = place.subLocality ?? ''; // Area/neighborhood
        final locality = place.locality ?? ''; // City
        final subAdminArea = place.subAdministrativeArea ?? ''; // District
        final adminArea = place.administrativeArea ?? ''; // State
        final postalCode = place.postalCode ?? '';
        
        // Build address line - combine street + subLocality for full address
        String addressLine = '';
        if (street.isNotEmpty && street != subLocality) {
          addressLine = street;
        }
        if (subLocality.isNotEmpty) {
          if (addressLine.isNotEmpty) {
            addressLine = '$addressLine, $subLocality';
          } else {
            addressLine = subLocality;
          }
        }
        // Add locality if different from subAdminArea (some places have same)
        if (locality.isNotEmpty && locality != subAdminArea && addressLine.isNotEmpty && !addressLine.contains(locality)) {
          addressLine = '$addressLine, $locality';
        }
        
        // Determine district - try multiple fields for best match
        // GPS often returns locality (city) or subAdministrativeArea (district)
        String detectedDistrict = subAdminArea.isNotEmpty ? subAdminArea : locality;
        String detectedState = adminArea;
        
        // Common GPS name variations and taluk-to-district mappings
        // GPS often returns town/taluk names instead of district names
        final districtAliases = <String, String>{
          // City name variations
          'ernakulam': 'Kochi',
          'bangalore': 'Bengaluru Urban',
          'bangalore urban': 'Bengaluru Urban',
          'bangalore rural': 'Bengaluru Rural',
          'bombay': 'Mumbai',
          'madras': 'Chennai',
          'calcutta': 'Kolkata',
          'gurugram': 'Gurgaon',
          'trivandrum': 'Thiruvananthapuram',
          'calicut': 'Kozhikode',
          'cochin': 'Kochi',
          'pondicherry': 'Puducherry',
          'benares': 'Varanasi',
          'tiruchi': 'Tiruchirappalli',
          'trichy': 'Tiruchirappalli',
          
          // Tamil Nadu - Taluks to Districts mapping
          'attur': 'Salem',
          'mettur': 'Salem',
          'omalur': 'Salem',
          'sangagiri': 'Salem',
          'yercaud': 'Salem',
          'edappadi': 'Salem',
          'gangavalli': 'Salem',
          'kadayampatti': 'Salem',
          'valapady': 'Salem',
          'panamarathupatti': 'Salem',
          
          'gobichettipalayam': 'Erode',
          'sathyamangalam': 'Erode',
          'bhavani': 'Erode',
          'perundurai': 'Erode',
          'anthiyur': 'Erode',
          'nambiyur': 'Erode',
          
          'pollachi': 'Coimbatore',
          'mettupalayam': 'Coimbatore',
          'sulur': 'Coimbatore',
          'valparai': 'Coimbatore',
          'annur': 'Coimbatore',
          'kinathukadavu': 'Coimbatore',
          
          'udumalpet': 'Tirupur',
          'palladam': 'Tirupur',
          'dharapuram': 'Tirupur',
          'kangeyam': 'Tirupur',
          'avinashi': 'Tirupur',
          
          'hosur': 'Krishnagiri',
          'denkanikottai': 'Krishnagiri',
          'bargur': 'Krishnagiri',
          'pochampalli': 'Krishnagiri',
          
          'pennagaram': 'Dharmapuri',
          'harur': 'Dharmapuri',
          'pappireddipatti': 'Dharmapuri',
          
          'tiruchengode': 'Namakkal',
          'rasipuram': 'Namakkal',
          'paramathi': 'Namakkal',
          'kolli hills': 'Namakkal',
          'sendamangalam': 'Namakkal',
          
          'kulithalai': 'Karur',
          'krishnarayapuram': 'Karur',
          'aravakurichi': 'Karur',
          
          'ambur': 'Vellore',
          'vaniyambadi': 'Vellore',
          'gudiyattam': 'Vellore',
          'arcot': 'Vellore',
          'katpadi': 'Vellore',
          'thirupattur': 'Vellore',
          'jolarpet': 'Vellore',
          
          'kanchipuram': 'Kanchipuram',
          'sriperumbudur': 'Kanchipuram',
          'tambaram': 'Chennai',
          'chengalpattu': 'Kanchipuram',
          'maraimalai nagar': 'Kanchipuram',
          
          'tindivanam': 'Villupuram',
          'gingee': 'Villupuram',
          'kallakurichi': 'Villupuram',
          'ulundurpet': 'Villupuram',
          
          'panruti': 'Cuddalore',
          'chidambaram': 'Cuddalore',
          'virudhachalam': 'Cuddalore',
          'kattumannarkoil': 'Cuddalore',
          
          'kumbakonam': 'Thanjavur',
          'pattukkottai': 'Thanjavur',
          'orathanadu': 'Thanjavur',
          'papanasam': 'Thanjavur',
          
          'lalgudi': 'Tiruchirappalli',
          'srirangam': 'Tiruchirappalli',
          'musiri': 'Tiruchirappalli',
          'manachanallur': 'Tiruchirappalli',
          'thottiyam': 'Tiruchirappalli',
          
          'palani': 'Dindigul',
          'oddanchatram': 'Dindigul',
          'kodaikanal': 'Dindigul',
          'vedasandur': 'Dindigul',
          'natham': 'Dindigul',
          
          'kovilpatti': 'Thoothukudi',
          'tiruchendur': 'Thoothukudi',
          'srivaikuntam': 'Thoothukudi',
          'kayathar': 'Thoothukudi',
          
          'sankarankovil': 'Tirunelveli',
          'ambasamudram': 'Tirunelveli',
          'tenkasi': 'Tirunelveli',
          'cheranmahadevi': 'Tirunelveli',
          'nanguneri': 'Tirunelveli',
          
          'nagercoil': 'Kanyakumari',
          'thuckalay': 'Kanyakumari',
          'kuzhithurai': 'Kanyakumari',
          'colachel': 'Kanyakumari',
          
          'sivakasi': 'Virudhunagar',
          'aruppukkottai': 'Virudhunagar',
          'rajapalayam': 'Virudhunagar',
          'srivilliputhur': 'Virudhunagar',
          
          'paramakudi': 'Ramanathapuram',
          'rameswaram': 'Ramanathapuram',
          'mandapam': 'Ramanathapuram',
          
          'karaikudi': 'Sivaganga',
          'devakottai': 'Sivaganga',
          'ilayangudi': 'Sivaganga',
          'manamadurai': 'Sivaganga',
          
          'aranthangi': 'Pudukkottai',
          'alangudi': 'Pudukkottai',
          'tirumayam': 'Pudukkottai',
          
          'coonoor': 'Nilgiris',
          'gudalur': 'Nilgiris',
          'kotagiri': 'Nilgiris',
          'ooty': 'Nilgiris',
          'ootacamund': 'Nilgiris',
          'udhagamandalam': 'Nilgiris',
          
          'mayiladuthurai': 'Nagapattinam',
          'sirkazhi': 'Nagapattinam',
          'vedaranyam': 'Nagapattinam',
          
          'nannilam': 'Tiruvarur',
          'mannargudi': 'Tiruvarur',
          'needamangalam': 'Tiruvarur',
          
          'jayamkondam': 'Ariyalur',
          'sendurai': 'Ariyalur',
          
          'kunnam': 'Perambalur',
          'veppanthattai': 'Perambalur',
          
          'periyakulam': 'Theni',
          'bodinayakanur': 'Theni',
          'uthamapalayam': 'Theni',
          'cumbum': 'Theni',
          
          // Karnataka taluks
          'whitefield': 'Bengaluru Urban',
          'electronic city': 'Bengaluru Urban',
          'yelahanka': 'Bengaluru Urban',
          'yeswanthpur': 'Bengaluru Urban',
          
          // Kerala taluks
          'thrikkakara': 'Kochi',
          'aluva': 'Kochi',
          'edappally': 'Kochi',
          'kakkanad': 'Kochi',
          'kalamassery': 'Kochi',
        };
        
        setState(() {
          // Set address line
          if (addressLine.isNotEmpty) {
            _addressLine1Controller.text = addressLine;
          }
          
          // Set pincode
          if (postalCode.isNotEmpty) {
            _pincodeController.text = postalCode;
          }
          
          // Match state with our dropdown options (fuzzy match)
          String? matchedState;
          for (final state in indianDistricts.keys) {
            // Try exact match first
            if (state.toLowerCase() == detectedState.toLowerCase()) {
              matchedState = state;
              break;
            }
            // Try contains match for variations (e.g., "Tamil Nadu" vs "Tamilnadu")
            final normalizedDetected = detectedState.toLowerCase().replaceAll(' ', '').replaceAll('and', '');
            final normalizedState = state.toLowerCase().replaceAll(' ', '').replaceAll('and', '');
            if (normalizedDetected == normalizedState || 
                normalizedDetected.contains(normalizedState) ||
                normalizedState.contains(normalizedDetected)) {
              matchedState = state;
              break;
            }
          }
          
          if (matchedState != null) {
            _selectedAddressState = matchedState;
            _availableAddressCities = indianDistricts[matchedState] ?? [];
            
            // Clean up district name - remove common suffixes
            String cleanDistrict = detectedDistrict
                .replaceAll(RegExp(r'\s*district$', caseSensitive: false), '')
                .replaceAll(RegExp(r'\s*taluk$', caseSensitive: false), '')
                .replaceAll(RegExp(r'\s*mandal$', caseSensitive: false), '')
                .trim();
            
            debugPrint('📍 Trying to match district: "$cleanDistrict" (original: "$detectedDistrict")');
            
            // Check for known aliases first
            final aliasKey = cleanDistrict.toLowerCase();
            if (districtAliases.containsKey(aliasKey)) {
              final aliasValue = districtAliases[aliasKey]!;
              if (_availableAddressCities.contains(aliasValue)) {
                _selectedAddressCity = aliasValue;
                debugPrint('✅ Matched via alias: $aliasValue');
                return;
              }
            }
            
            // Try to match district/city with our dropdown options
            String? matchedCity;
            
            // First pass: exact match
            for (final city in _availableAddressCities) {
              if (city.toLowerCase() == cleanDistrict.toLowerCase()) {
                matchedCity = city;
                break;
              }
            }
            
            // Second pass: fuzzy match with normalization
            if (matchedCity == null) {
              final normalizedDetected = cleanDistrict.toLowerCase().replaceAll(' ', '').replaceAll('-', '');
              for (final city in _availableAddressCities) {
                final normalizedCity = city.toLowerCase().replaceAll(' ', '').replaceAll('-', '');
                // Check if one contains the other (handles "Bengaluru" matching "Bengaluru Urban")
                if (normalizedDetected.contains(normalizedCity) || normalizedCity.contains(normalizedDetected)) {
                  matchedCity = city;
                  break;
                }
              }
            }
            
            // Third pass: try with locality if subAdminArea didn't match
            if (matchedCity == null && locality.isNotEmpty && locality != detectedDistrict) {
              final cleanLocality = locality
                  .replaceAll(RegExp(r'\s*district$', caseSensitive: false), '')
                  .trim();
              debugPrint('📍 Retrying with locality: "$cleanLocality"');
              
              for (final city in _availableAddressCities) {
                if (city.toLowerCase() == cleanLocality.toLowerCase()) {
                  matchedCity = city;
                  break;
                }
                final normalizedLocality = cleanLocality.toLowerCase().replaceAll(' ', '');
                final normalizedCity = city.toLowerCase().replaceAll(' ', '');
                if (normalizedLocality.contains(normalizedCity) || normalizedCity.contains(normalizedLocality)) {
                  matchedCity = city;
                  break;
                }
              }
            }
            
            if (matchedCity != null) {
              _selectedAddressCity = matchedCity;
              debugPrint('✅ Matched district: $matchedCity');
            } else {
              debugPrint('⚠️ Could not match district: $detectedDistrict (cleaned: $cleanDistrict)');
              debugPrint('   Available cities: ${_availableAddressCities.join(", ")}');
            }
          } else {
            debugPrint('⚠️ Could not match state: $detectedState');
          }
        });
        
        // Show success with detected info
        if (_selectedAddressState != null && _selectedAddressCity != null) {
          _showSuccess('Location detected: $_selectedAddressCity, $_selectedAddressState');
        } else if (_selectedAddressState != null) {
          _showSuccess('Location detected in $_selectedAddressState. Please select your district.');
        } else {
          _showSuccess('Address detected. Please verify state and district.');
        }
      } else {
        _showError('Could not determine address from location. Please enter manually.');
      }
    } catch (e) {
      debugPrint('Geolocation error: $e');
      _showError('Failed to get location. Please enter address manually.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message), backgroundColor: AppColors.error, behavior: SnackBarBehavior.floating));
  }

  void _showSuccess(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message), backgroundColor: AppColors.success, behavior: SnackBarBehavior.floating));
  }

  // ═══════════════════════════════════════════════════════════════
  // NAVIGATION & VALIDATION
  // ═══════════════════════════════════════════════════════════════

  bool _validateCurrentStep() {
    // Updated validation for new 3-step order
    switch (_currentStep) {
      case 0: // Business Details + Address
        if (_businessType == null) { _showError('Select business type'); return false; }
        if (_businessNameController.text.trim().isEmpty) { _showError('Enter business name'); return false; }
        if (_hasGstRegistration) {
          if (_gstNumberController.text.isEmpty) { _showError('Enter GSTIN'); return false; }
          if (!validateGstin(_gstNumberController.text.toUpperCase())) { _showError('Invalid GSTIN format'); return false; }
        }
        if (_primaryCategory == null) { _showError('Select business category'); return false; }
        if (_primarySubCategory == null) { _showError('Select sub-category'); return false; }
        // Business Address validation
        if (_addressLine1Controller.text.isEmpty) { _showError('Enter business address'); return false; }
        if (_selectedAddressState == null) { _showError('Select state'); return false; }
        if (_selectedAddressCity == null) { _showError('Select city/district'); return false; }
        final pincode = _pincodeController.text.replaceAll(RegExp(r'[^0-9]'), '');
        if (pincode.length != 6) { _showError('Enter valid 6-digit pincode'); return false; }
        return true;
      case 1: // Identity Verification (PAN + Aadhaar + Selfie)
        if (_panCardImage == null) { _showError('Upload PAN card'); return false; }
        if (_aadhaarFrontImage == null) { _showError('Upload Aadhaar front'); return false; }
        if (_aadhaarBackImage == null) { _showError('Upload Aadhaar back'); return false; }
        if (_panNumberController.text.length != 10) { _showError('Invalid PAN number'); return false; }
        if (_panNameController.text.isEmpty) { _showError('Enter name on PAN'); return false; }
        if (_aadhaarNumberController.text.length != 12) { _showError('Invalid Aadhaar number'); return false; }
        if (_aadhaarNameController.text.isEmpty) { _showError('Enter name on Aadhaar'); return false; }
        // Name match validation - warn but allow if close enough
        if (_nameMatchChecked && _nameMatchPercentage < 50) {
          _showError('Names on PAN and Aadhaar must match');
          return false;
        }
        if (_selfieImage == null) { _showError('Take a selfie for verification'); return false; }
        return true;
      case 2: // Bank
        if (_accountNumberController.text.isEmpty) { _showError('Enter Account No'); return false; }
        if (_ifscController.text.length != 11) { _showError('Invalid IFSC'); return false; }
        return true;
      default: return true;
    }
  }

  void _nextStep() {
    if (_validateCurrentStep()) {
      if (_currentStep < _stepNames.length - 1) {
        setState(() => _currentStep++);
        _updateUrlForStep(_currentStep);
        _saveKycProgress(); // Auto-save progress
      } else {
        _submitKyc();
      }
    }
  }

  void _previousStep() {
    if (_currentStep > 0) {
      setState(() => _currentStep--);
      _updateUrlForStep(_currentStep);
      _saveKycProgress(); // Auto-save progress
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UI BUILDERS
  // ═══════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final size = MediaQuery.of(context).size;
    final screenWidth = size.width;
    
    // Watch seller provider for reactivity
    final sellerProvider = context.watch<SellerProvider>();
    
    // Pre-fill business name from seller data (reactive)
    _prefillBusinessName(sellerProvider);
    
    final isMobile = screenWidth < _mobileBreakpoint;
    final isTablet = screenWidth >= _mobileBreakpoint && screenWidth < _tabletBreakpoint;
    final isDesktop = screenWidth >= _desktopBreakpoint;

    // FontSizes logic matching admin/seller
    final fontSize = isMobile ? _FontSizes.mobile : (isTablet ? _FontSizes.tablet : _FontSizes.desktop);

    // Prevent back navigation on KYC wizard
    return PopScope(
      canPop: false,
      child: Scaffold(
        resizeToAvoidBottomInset: false, // Allow proper keyboard adjustment
        backgroundColor: isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8),
        extendBodyBehindAppBar: true,
        appBar: PreferredSize(
          preferredSize: const Size.fromHeight(70),
          child: ClipRRect(
            child: BackdropFilter(
              filter: MainUtil.blur,
              child: AppBar(
                backgroundColor: (isDark ? const Color(0xFF080B12) : const Color(0xFFF0F4F8)).withValues(alpha: 0.8),
                elevation: 0,
                centerTitle: true,
                automaticallyImplyLeading: false, // Remove default back button
                // Show back arrow only on PAN screen (step 0) for rejected users to go back
                leading: (_currentStep == 0)
                    ? IconButton(
                        icon: Icon(Icons.arrow_back_rounded, color: isDark ? Colors.white : Colors.black, size: 24),
                        onPressed: () => Navigator.pushReplacementNamed(context, AppRoutes.kycRejected),
                        tooltip: 'Back to Status',
                      )
                    : null,
                title: Text(
                  'Complete Verification',
                  style: TextStyle(fontFamily: 'Inter', fontWeight: FontWeight.bold, fontSize: fontSize.title * 0.8, color: isDark ? Colors.white : Colors.black),
                ),
                actions: [
                  IconButton(
                    icon: Icon(Icons.email_outlined, color: isDark ? Colors.white : Colors.black, size: 22),
                    onPressed: _contactSupport,
                    tooltip: 'Contact Support',
                  ),
                  const SizedBox(width: 4),
                  IconButton(
                    icon: Icon(Icons.logout_rounded, color: isDark ? Colors.white70 : Colors.black54, size: 22),
                    onPressed: _showLogoutDialog,
                    tooltip: 'Switch Account',
                  ),
                  const SizedBox(width: 8),
                ],
              ),
            ),
          ),
        ),
      body: Stack(
        children: [
          _buildAnimatedBackground(isDark),
          if (!isMobile) ..._buildFloatingOrbs(isDark, size),
          if (isDesktop) Positioned.fill(child: CustomPaint(painter: _GridPatternPainter(isDark: isDark))),

          SafeArea(
            child: Column(
              children: [
                _buildProgressHeader(isDark, fontSize),
                Expanded(
                  child: SingleChildScrollView(
                    keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                    physics: const BouncingScrollPhysics(),
                    padding: EdgeInsets.all(isMobile ? 20 : 40),
                    child: Center(
                      child: Container(
                        constraints: const BoxConstraints(maxWidth: 800),
                        child: AnimatedSwitcher(
                          duration: 400.ms,
                          child: KeyedSubtree(
                            key: ValueKey(_currentStep),
                            child: _buildCurrentStep(isDark, theme, fontSize),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                _buildFooter(isDark, theme, fontSize),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }

  Widget _buildProgressHeader(bool isDark, _FontSizes fontSize) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Step ${_currentStep + 1} of ${_stepNames.length}', style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontWeight: FontWeight.w500)),
              Text(_stepNames[_currentStep], style: TextStyle(color: isDark ? Colors.white : Colors.black, fontWeight: FontWeight.bold, fontSize: fontSize.body)),
            ],
          ),
          const SizedBox(height: 12),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: (_currentStep + 1) / _stepNames.length,
              backgroundColor: isDark ? Colors.grey[800] : Colors.grey[300],
              valueColor: AlwaysStoppedAnimation<Color>(const Color(0xFF3B82F6)),
              minHeight: 6,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCurrentStep(bool isDark, ThemeData theme, _FontSizes fontSize) {
    return Container(
      padding: EdgeInsets.all(fontSize.inputPadding * 1.5),
      decoration: BoxDecoration(
        color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: isDark ? Colors.white.withValues(alpha: 0.05) : Colors.black.withValues(alpha: 0.05)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.05), blurRadius: 40, offset: const Offset(0, 10))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildStepContent(isDark, theme, fontSize),
        ],
      ),
    ).animate().fadeIn().slideY(begin: 0.1);
  }

  Widget _buildStepContent(bool isDark, ThemeData theme, _FontSizes fontSize) {
    switch (_currentStep) {
      case 0: return _buildBusinessDetailsStep(isDark, theme, fontSize);
      case 1: return _buildIdentityVerificationStep(isDark, theme, fontSize); // NEW combined step
      case 2: return _buildBankStep(isDark, theme, fontSize);
      default: return const SizedBox.shrink();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // STEP BUILDERS
  // ═══════════════════════════════════════════════════════════════

  /// NEW: Identity Verification Step (Step 2)
  /// Combines PAN, Aadhaar, Name Validation, and Selfie into single step
  Widget _buildIdentityVerificationStep(bool isDark, ThemeData theme, _FontSizes fontSize) {
    // Check if all 3 documents are uploaded
    final allDocsUploaded = _panCardImage != null && 
                            _aadhaarFrontImage != null && 
                            _aadhaarBackImage != null;
    
    // Track document upload count
    int uploadedCount = 0;
    if (_panCardImage != null) uploadedCount++;
    if (_aadhaarFrontImage != null) uploadedCount++;
    if (_aadhaarBackImage != null) uploadedCount++;
    
    return Column(
      key: const ValueKey('identity'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        _buildHeader(
          'Identity Verification',
          'Upload your documents for instant KYC verification.',
          Icons.verified_user_outlined,
          isDark,
        ),
        const SizedBox(height: 8),
        
        // Upload progress indicator
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: (allDocsUploaded ? const Color(0xFF10B981) : const Color(0xFF3B82F6)).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: (allDocsUploaded ? const Color(0xFF10B981) : const Color(0xFF3B82F6)).withValues(alpha: 0.3),
            ),
          ),
          child: Row(
            children: [
              Icon(
                allDocsUploaded ? Icons.check_circle : Icons.upload_file_rounded,
                color: allDocsUploaded ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
                size: 20,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  allDocsUploaded 
                      ? 'All documents uploaded! OCR processing...'
                      : 'Upload all 3 documents to continue ($uploadedCount/3)',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                    color: allDocsUploaded ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
                  ),
                ),
              ),
            ],
          ),
        ),
        
        const SizedBox(height: 28),
        
        // ═══════════════════════════════════════════════════════════════
        // SECTION A: PAN CARD
        // ═══════════════════════════════════════════════════════════════
        _buildSectionHeader('PAN Card', Icons.credit_card_rounded, isDark, _panCardImage != null),
        const SizedBox(height: 16),
        
        // Use Row with Expanded to match Aadhaar card sizing
        Row(
          children: [
            Expanded(
              child: _buildImageUploadZone(
                label: 'PAN Card (Front)',
                image: _panCardImage,
                imageBytes: _panCardImageBytes,
                isProcessing: _isOcrProcessing && allDocsUploaded,
                onTap: () => _pickImage((img) async {
                  final bytes = await img.readAsBytes();
                  setState(() {
                    _panCardImage = img;
                    _panCardImageBytes = bytes;
                  });
                  // Trigger OCR only when all docs are uploaded
                  _checkAndTriggerOcr();
                }),
                isDark: isDark,
              ),
            ),
            const SizedBox(width: 12),
            // Empty placeholder to match Aadhaar layout width
            Expanded(
              child: Container(
                height: 160,
                decoration: BoxDecoration(
                  color: isDark ? Colors.black12 : Colors.grey[100],
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isDark ? Colors.grey[800]!.withValues(alpha: 0.3) : Colors.grey[200]!,
                    style: BorderStyle.solid,
                  ),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.info_outline,
                      size: 32,
                      color: isDark ? Colors.grey[700] : Colors.grey[300],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'PAN Back\nnot required',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 11,
                        color: isDark ? Colors.grey[600] : Colors.grey[400],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        
        // PAN fields - editable after OCR or for manual entry
        if (_panCardImage != null) ...[
          const SizedBox(height: 16),
          _buildTextField(
            controller: _panNumberController,
            label: 'PAN Number',
            icon: Icons.numbers,
            isDark: isDark,
            theme: theme,
            fontSize: fontSize,
            textCapitalization: TextCapitalization.characters,
            maxLength: 10,
            enabled: true, // Always editable for manual correction
          ),
          const SizedBox(height: 12),
          _buildTextField(
            controller: _panNameController,
            label: 'Name on PAN',
            icon: Icons.person_outline,
            isDark: isDark,
            theme: theme,
            fontSize: fontSize,
            textCapitalization: TextCapitalization.words,
            enabled: true, // Always editable for manual correction
          ),
        ],
        
        const SizedBox(height: 28),
        
        // ═══════════════════════════════════════════════════════════════
        // SECTION B: AADHAAR CARD
        // ═══════════════════════════════════════════════════════════════
        _buildSectionHeader('Aadhaar Card', Icons.badge_outlined, isDark, 
            _aadhaarFrontImage != null && _aadhaarBackImage != null),
        const SizedBox(height: 16),
        
        Row(
          children: [
            Expanded(
              child: _buildImageUploadZone(
                label: 'Front Side',
                image: _aadhaarFrontImage,
                imageBytes: _aadhaarFrontImageBytes,
                isProcessing: _isOcrProcessing && allDocsUploaded,
                onTap: () => _pickImage((img) async {
                  final bytes = await img.readAsBytes();
                  setState(() {
                    _aadhaarFrontImage = img;
                    _aadhaarFrontImageBytes = bytes;
                  });
                  _checkAndTriggerOcr();
                }),
                isDark: isDark,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildImageUploadZone(
                label: 'Back Side',
                image: _aadhaarBackImage,
                imageBytes: _aadhaarBackImageBytes,
                onTap: () => _pickImage((img) async {
                  final bytes = await img.readAsBytes();
                  setState(() {
                    _aadhaarBackImage = img;
                    _aadhaarBackImageBytes = bytes;
                  });
                  _checkAndTriggerOcr();
                }),
                isDark: isDark,
              ),
            ),
          ],
        ),
        
        // Aadhaar fields - editable after OCR or for manual entry
        if (_aadhaarFrontImage != null && _aadhaarBackImage != null) ...[
          const SizedBox(height: 16),
          _buildTextField(
            controller: _aadhaarNumberController,
            label: 'Aadhaar Number',
            icon: Icons.pin,
            isDark: isDark,
            theme: theme,
            fontSize: fontSize,
            keyboardType: TextInputType.number,
            maxLength: 12,
            enabled: true, // Always editable for manual correction
          ),
          const SizedBox(height: 12),
          _buildTextField(
            controller: _aadhaarNameController,
            label: 'Name on Aadhaar',
            icon: Icons.person_outline,
            isDark: isDark,
            theme: theme,
            fontSize: fontSize,
            textCapitalization: TextCapitalization.words,
            enabled: true, // Always editable for manual correction
          ),
        ],
        
        // ═══════════════════════════════════════════════════════════════
        // SECTION C: NAME VALIDATION
        // ═══════════════════════════════════════════════════════════════
        if (_panNameController.text.isNotEmpty && _aadhaarNameController.text.isNotEmpty) ...[
          const SizedBox(height: 28),
          _buildNameMatchSection(isDark, theme),
        ],
        
        const SizedBox(height: 28),
        
        // ═══════════════════════════════════════════════════════════════
        // SECTION D: SELFIE VERIFICATION
        // ═══════════════════════════════════════════════════════════════
        _buildSectionHeader('Selfie Verification', Icons.face_retouching_natural, isDark, _selfieImage != null),
        const SizedBox(height: 16),
        
        Center(
          child: GestureDetector(
            onTap: () => _pickImage((img) async {
              final bytes = await img.readAsBytes();
              setState(() {
                _selfieImage = img;
                _selfieImageBytes = bytes;
              });
            }, useCamera: true),
            child: Container(
              width: 160,
              height: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: isDark ? Colors.grey[900] : Colors.grey[100],
                border: Border.all(
                  color: _selfieImage != null 
                      ? const Color(0xFF10B981) 
                      : theme.colorScheme.primary.withValues(alpha: 0.5),
                  width: 3,
                ),
                boxShadow: _selfieImage != null ? [
                  BoxShadow(
                    color: const Color(0xFF10B981).withValues(alpha: 0.3),
                    blurRadius: 12,
                    spreadRadius: 2,
                  ),
                ] : null,
              ),
              child: _selfieImage != null && _selfieImageBytes != null
                  ? ClipOval(
                      child: Image.memory(
                        _selfieImageBytes!,
                        fit: BoxFit.cover,
                        width: 160,
                        height: 160,
                      ),
                    )
                  : Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.camera_alt_rounded,
                          size: 48,
                          color: isDark ? Colors.grey[600] : Colors.grey[400],
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Take Selfie',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w500,
                            color: isDark ? Colors.grey[500] : Colors.grey[600],
                          ),
                        ),
                      ],
                    ),
            ),
          ),
        ),
        
        if (_selfieImage != null) ...[
          const SizedBox(height: 12),
          Center(
            child: TextButton.icon(
              onPressed: () => _pickImage((img) async {
                final bytes = await img.readAsBytes();
                setState(() {
                  _selfieImage = img;
                  _selfieImageBytes = bytes;
                });
              }, useCamera: true),
              icon: const Icon(Icons.refresh, size: 18),
              label: const Text('Retake'),
              style: TextButton.styleFrom(
                foregroundColor: isDark ? Colors.grey[400] : Colors.grey[700],
              ),
            ),
          ),
        ],
        
        const SizedBox(height: 24),
      ],
    );
  }
  
  /// Helper: Build section header with icon
  Widget _buildSectionHeader(String title, IconData icon, bool isDark, bool isCompleted) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: (isCompleted ? const Color(0xFF10B981) : const Color(0xFF3B82F6)).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            isCompleted ? Icons.check_circle : icon,
            color: isCompleted ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
            size: 20,
          ),
        ),
        const SizedBox(width: 12),
        Text(
          title,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.white : const Color(0xFF111827),
          ),
        ),
        if (isCompleted) ...[
          const SizedBox(width: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              'Done',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Color(0xFF10B981),
              ),
            ),
          ),
        ],
      ],
    );
  }
  
  /// Helper: Build name match validation section
  Widget _buildNameMatchSection(bool isDark, ThemeData theme) {
    // Calculate name match if not done
    if (!_nameMatchChecked) {
      _calculateNameMatch();
    }
    
    final isMatch = _nameMatchPercentage >= 70;
    final isWarning = _nameMatchPercentage >= 50 && _nameMatchPercentage < 70;
    final isError = _nameMatchPercentage < 50;
    
    Color statusColor = const Color(0xFF10B981);
    IconData statusIcon = Icons.check_circle;
    String statusText = 'Names match!';
    
    if (isWarning) {
      statusColor = const Color(0xFFF59E0B);
      statusIcon = Icons.warning_amber_rounded;
      statusText = 'Partial match - please verify';
    } else if (isError) {
      statusColor = const Color(0xFFDC2626);
      statusIcon = Icons.error_outline;
      statusText = 'Names do not match!';
    }
    
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: statusColor.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: statusColor.withValues(alpha: 0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(statusIcon, color: statusColor, size: 20),
              const SizedBox(width: 8),
              Text(
                'Name Verification',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: statusColor,
                ),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  '$_nameMatchPercentage%',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: statusColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'PAN Name',
                      style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _panNameController.text,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: isDark ? Colors.white : Colors.black,
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: Icon(
                  isMatch ? Icons.link : Icons.link_off,
                  color: statusColor,
                  size: 20,
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      'Aadhaar Name',
                      style: TextStyle(fontSize: 11, color: isDark ? Colors.grey[400] : Colors.grey[600]),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      _aadhaarNameController.text,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: isDark ? Colors.white : Colors.black,
                      ),
                      textAlign: TextAlign.end,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            statusText,
            style: TextStyle(
              fontSize: 12,
              color: statusColor,
              fontWeight: FontWeight.w500,
            ),
          ),
          if (isError) ...[
            const SizedBox(height: 8),
            Text(
              'Please correct the names above to match your documents.',
              style: TextStyle(
                fontSize: 11,
                color: isDark ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
          ],
        ],
      ),
    );
  }
  
  /// Helper: Calculate name match percentage
  void _calculateNameMatch() {
    final panName = _panNameController.text.toLowerCase().trim();
    final aadhaarName = _aadhaarNameController.text.toLowerCase().trim();
    
    if (panName.isEmpty || aadhaarName.isEmpty) {
      _nameMatchPercentage = 0;
      _nameMatchChecked = false;
      return;
    }
    
    // Simple Levenshtein-based similarity
    final panWords = panName.split(' ').where((w) => w.isNotEmpty).toList();
    final aadhaarWords = aadhaarName.split(' ').where((w) => w.isNotEmpty).toList();
    
    int matchedWords = 0;
    for (final pw in panWords) {
      for (final aw in aadhaarWords) {
        if (pw == aw || _isSimilar(pw, aw)) {
          matchedWords++;
          break;
        }
      }
    }
    
    final totalWords = panWords.length > aadhaarWords.length ? panWords.length : aadhaarWords.length;
    _nameMatchPercentage = totalWords > 0 ? ((matchedWords / totalWords) * 100).round() : 0;
    _nameMatchChecked = true;
  }
  
  /// Helper: Check if two words are similar (allowing for minor differences)
  bool _isSimilar(String a, String b) {
    if (a == b) return true;
    if ((a.length - b.length).abs() > 2) return false;
    
    // Check if one contains the other
    if (a.contains(b) || b.contains(a)) return true;
    
    // Simple edit distance check
    int diff = 0;
    final minLen = a.length < b.length ? a.length : b.length;
    for (int i = 0; i < minLen; i++) {
      if (a[i] != b[i]) diff++;
    }
    diff += (a.length - b.length).abs();
    
    return diff <= 2; // Allow up to 2 character differences
  }
  
  /// Helper: Check and trigger OCR when all documents are uploaded
  void _checkAndTriggerOcr() {
    if (_panCardImage != null && _aadhaarFrontImage != null && _aadhaarBackImage != null) {
      // All 3 documents uploaded - trigger OCR
      if (!_panOcrDone) {
        _extractPanDetails();
      }
      if (!_aadhaarOcrDone) {
        _extractAadhaarDetails();
      }
    }
  }

  /// NEW: Business Details Step (Step 1)
  /// Combines Business Type, GST choice, Categories into single step
  Widget _buildBusinessDetailsStep(bool isDark, ThemeData theme, _FontSizes fontSize) {
    final availableCategories = getMainCategories(_hasGstRegistration);
    
    return Column(
      key: const ValueKey('business_details'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildHeader('Business Details', 'Tell us about your business to get started.', Icons.store_mall_directory_outlined, isDark),
        const SizedBox(height: 24),
        
        // Business Type Dropdown
        _buildAddressDropdown(
          value: _businessType,
          items: _businessTypes,
          hint: 'Select Business Type',
          icon: Icons.business_center_outlined,
          isDark: isDark,
          theme: theme,
          fontSize: fontSize,
          onChanged: (val) => setState(() => _businessType = val),
        ),
        const SizedBox(height: 16),
        
        // Business Name (pre-filled from signup, non-editable)
        _buildTextField(
          controller: _businessNameController,
          label: 'Business / Store Name',
          icon: Icons.storefront_outlined,
          isDark: isDark,
          theme: theme,
          fontSize: fontSize,
          textCapitalization: TextCapitalization.words,
          enabled: false, // Non-editable - fetched from signup
        ),
        // Note about the field
        Padding(
          padding: const EdgeInsets.only(top: 6, left: 4),
          child: Row(
            children: [
              Icon(Icons.info_outline, size: 14, color: Colors.grey[500]),
              const SizedBox(width: 6),
              Text(
                'From your registration (cannot be changed here)',
                style: TextStyle(fontSize: 11, color: Colors.grey[500]),
              ),
            ],
          ),
        ),
        
        const SizedBox(height: 28),
        
        // Divider
        Container(height: 1, color: isDark ? Colors.grey[800] : Colors.grey[200]),
        
        const SizedBox(height: 28),
        
        // GST Registration Question
        Text(
          'Do you have GST registration?',
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.white : const Color(0xFF111827),
          ),
        ),
        const SizedBox(height: 16),
        
        // GST Toggle Cards
        Row(
          children: [
            Expanded(
              child: _buildGstOptionCard(
                title: 'Yes, I have GSTIN',
                subtitle: 'Access ALL categories',
                icon: Icons.verified_outlined,
                isSelected: _hasGstRegistration,
                color: const Color(0xFF10B981), // Green
                isDark: isDark,
                onTap: () => setState(() {
                  _hasGstRegistration = true;
                  _primaryCategory = null;
                  _primarySubCategory = null;
                  _availableSubCategories = [];
                }),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildGstOptionCard(
                title: 'No GSTIN',
                subtitle: 'Exempt categories only',
                icon: Icons.info_outline,
                isSelected: !_hasGstRegistration,
                color: const Color(0xFFF59E0B), // Amber
                isDark: isDark,
                onTap: () => setState(() {
                  _hasGstRegistration = false;
                  _primaryCategory = null;
                  _primarySubCategory = null;
                  _availableSubCategories = [];
                  _gstNumberController.clear();
                  _detectedGstState = null;
                }),
              ),
            ),
          ],
        ),
        
        const SizedBox(height: 24),
        
        // GSTIN Input (if Yes)
        if (_hasGstRegistration) ...[
          _buildTextField(
            controller: _gstNumberController,
            label: 'GSTIN Number',
            icon: Icons.receipt_long_rounded,
            isDark: isDark,
            theme: theme,
            fontSize: fontSize,
            textCapitalization: TextCapitalization.characters,
            maxLength: 15,
          ),
          // GSTIN validation feedback
          if (_gstNumberController.text.isNotEmpty) ...[
            const SizedBox(height: 8),
            _buildGstinValidationFeedback(isDark),
          ],
          const SizedBox(height: 16),
        ],
        
        // Limited Access Warning (if No GST)
        if (!_hasGstRegistration) ...[
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFFF59E0B).withValues(alpha: 0.3)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(Icons.warning_amber_rounded, color: Color(0xFFF59E0B), size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Limited Access',
                        style: TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF92400E)),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        'Without GSTIN, you can only sell GST-exempt products as per Indian e-commerce regulations.',
                        style: TextStyle(fontSize: 13, color: const Color(0xFF92400E).withValues(alpha: 0.8)),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],
        
        // Primary Category Dropdown
        _buildAddressDropdown(
          value: _primaryCategory,
          items: availableCategories,
          hint: 'Select Primary Category',
          icon: Icons.category_outlined,
          isDark: isDark,
          theme: theme,
          fontSize: fontSize,
          onChanged: (val) {
            setState(() {
              _primaryCategory = val;
              _primarySubCategory = null;
              _availableSubCategories = getSubCategories(val ?? '');
            });
          },
        ),
        const SizedBox(height: 16),
        
        // Sub-Category Dropdown
        _buildAddressDropdown(
          value: _primarySubCategory,
          items: _availableSubCategories,
          hint: 'Select Sub-Category',
          icon: Icons.sell_outlined,
          isDark: isDark,
          theme: theme,
          fontSize: fontSize,
          onChanged: (val) => setState(() => _primarySubCategory = val),
          enabled: _primaryCategory != null && _availableSubCategories.isNotEmpty,
        ),
        
        const SizedBox(height: 20),
        
        // Info chip
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFF3B82F6).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.info_outline, size: 16, color: Color(0xFF3B82F6)),
              const SizedBox(width: 8),
              Text(
                'You can add more categories later from Seller Dashboard',
                style: TextStyle(fontSize: 12, color: isDark ? Colors.grey[300] : const Color(0xFF3B82F6)),
              ),
            ],
          ),
        ),
        
        const SizedBox(height: 32),
        
        // Divider
        Container(height: 1, color: isDark ? Colors.grey[800] : Colors.grey[200]),
        
        const SizedBox(height: 28),
        
        // ═══════════════════════════════════════════════════════════════
        // BUSINESS ADDRESS SECTION
        // ═══════════════════════════════════════════════════════════════
        
        Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.location_on_outlined, color: Color(0xFF10B981), size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Business Address',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : const Color(0xFF111827),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Where do you ship products from?',
                    style: TextStyle(
                      fontSize: 13,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        
        const SizedBox(height: 24),
        
        // Use Current Location Button
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _isLoading ? null : _getCurrentLocation,
            icon: _isLoading 
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.my_location),
            label: Text(_isLoading ? 'Detecting Location...' : 'Use Current Location'),
            style: OutlinedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 14),
              side: BorderSide(color: theme.colorScheme.primary.withValues(alpha: 0.5)),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
        ),
        const SizedBox(height: 20),
        
        // Address Line 1
        _buildTextField(
          controller: _addressLine1Controller, 
          label: 'Address Line 1 (Street, Area)', 
          icon: Icons.home_outlined, 
          isDark: isDark, 
          theme: theme, 
          fontSize: fontSize,
        ),
        const SizedBox(height: 16),
        
        // State Dropdown
        _buildAddressDropdown(
          value: _selectedAddressState,
          items: indianDistricts.keys.toList()..sort(),
          hint: 'Select State',
          icon: Icons.map_outlined,
          isDark: isDark,
          theme: theme,
          fontSize: fontSize,
          onChanged: (value) {
            setState(() {
              _selectedAddressState = value;
              _selectedAddressCity = null;
              _availableAddressCities = indianDistricts[value] ?? [];
            });
          },
        ),
        const SizedBox(height: 16),
        
        // City/District Dropdown
        _buildAddressDropdown(
          value: _selectedAddressCity,
          items: _availableAddressCities,
          hint: _selectedAddressState == null ? 'Select state first' : 'Select City/District',
          icon: Icons.location_city_outlined,
          isDark: isDark,
          theme: theme,
          fontSize: fontSize,
          enabled: _selectedAddressState != null,
          onChanged: (value) {
            setState(() => _selectedAddressCity = value);
          },
        ),
        const SizedBox(height: 16),
        
        // Pincode with validation indicator
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildTextField(
              controller: _pincodeController, 
              label: 'Pincode (6 digits)', 
              icon: Icons.pin_drop_outlined, 
              isDark: isDark, 
              theme: theme, 
              fontSize: fontSize, 
              keyboardType: TextInputType.number,
              maxLength: 6,
            ),
            const SizedBox(height: 8),
            Builder(
              builder: (context) {
                final pincodeDigits = _pincodeController.text.replaceAll(RegExp(r'[^0-9]'), '');
                final isPincodeValid = pincodeDigits.length == 6;
                return Row(
                  children: [
                    Icon(
                      isPincodeValid ? Icons.check_circle : Icons.info_outline,
                      size: 16,
                      color: isPincodeValid ? Colors.green : Colors.grey[500],
                    ),
                    const SizedBox(width: 8),
                    Text(
                      isPincodeValid ? 'Valid pincode' : '${pincodeDigits.length} / 6 digits',
                      style: TextStyle(
                        fontSize: 12,
                        color: isPincodeValid ? Colors.green : Colors.grey[500],
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                );
              },
            ),
          ],
        ),
      ],
    );
  }

  /// GST Option Card (Yes/No selection)
  Widget _buildGstOptionCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required bool isSelected,
    required Color color,
    required bool isDark,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isSelected 
              ? color.withValues(alpha: 0.1) 
              : (isDark ? const Color(0xFF262626) : const Color(0xFFF9FAFB)),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isSelected ? color : (isDark ? Colors.grey[800]! : Colors.grey[300]!),
            width: isSelected ? 2 : 1,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(icon, color: isSelected ? color : Colors.grey[500], size: 20),
                const Spacer(),
                if (isSelected)
                  Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.check, color: Colors.white, size: 12),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: isSelected 
                    ? (isDark ? Colors.white : const Color(0xFF111827))
                    : (isDark ? Colors.grey[400] : Colors.grey[600]),
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: TextStyle(
                fontSize: 11,
                color: isDark ? Colors.grey[500] : Colors.grey[500],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// GSTIN Validation Feedback
  Widget _buildGstinValidationFeedback(bool isDark) {
    final gstin = _gstNumberController.text.toUpperCase();
    final isValid = validateGstin(gstin);
    final state = getStateFromGstin(gstin);
    
    // Update detected state
    if (isValid && state != null) {
      _detectedGstState = state;
    }
    
    return Row(
      children: [
        Icon(
          isValid ? Icons.check_circle : Icons.error_outline,
          size: 16,
          color: isValid ? Colors.green : Colors.red,
        ),
        const SizedBox(width: 8),
        Text(
          isValid 
              ? (state != null ? 'Valid GSTIN - $state' : 'Valid GSTIN format')
              : 'Invalid GSTIN format (15 characters required)',
          style: TextStyle(
            fontSize: 12,
            color: isValid ? Colors.green : Colors.red,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildPanStep(bool isDark, ThemeData theme, _FontSizes fontSize) {
    return Column(
      key: const ValueKey('pan'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildHeader('PAN Verification', 'Upload your PAN card for instant verification.', Icons.credit_card_rounded, isDark),
        const SizedBox(height: 24),
        _buildImageUploadZone(
          label: 'Upload PAN Card',
          image: _panCardImage,
          isProcessing: _isOcrProcessing,
          onTap: () => _pickImage((img) { setState(() => _panCardImage = img); _extractPanDetails(); }),
          isDark: isDark,
        ),
        const SizedBox(height: 24),
        _buildTextField(controller: _panNumberController, label: 'PAN Number', icon: Icons.numbers, isDark: isDark, theme: theme, fontSize: fontSize, textCapitalization: TextCapitalization.characters, maxLength: 10, enabled: _panOcrDone),
        const SizedBox(height: 16),
        _buildTextField(controller: _panNameController, label: 'Name on PAN', icon: Icons.person_outline, isDark: isDark, theme: theme, fontSize: fontSize, textCapitalization: TextCapitalization.words, enabled: _panOcrDone),
      ],
    );
  }

  Widget _buildAadhaarStep(bool isDark, ThemeData theme, _FontSizes fontSize) {
    return Column(
      key: const ValueKey('aadhaar'),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildHeader('Aadhaar Verification', 'Upload front and back of your Aadhaar.', Icons.badge_outlined, isDark),
        const SizedBox(height: 24),
        Row(
          children: [
            Expanded(
              child: _buildImageUploadZone(label: 'Front Side', image: _aadhaarFrontImage, isProcessing: _isOcrProcessing, onTap: () => _pickImage((img) { setState(() => _aadhaarFrontImage = img); _extractAadhaarDetails(); }), isDark: isDark),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _buildImageUploadZone(label: 'Back Side', image: _aadhaarBackImage, onTap: () => _pickImage((img) => setState(() => _aadhaarBackImage = img)), isDark: isDark),
            ),
          ],
        ),
        const SizedBox(height: 24),
        _buildTextField(controller: _aadhaarNumberController, label: 'Aadhaar Number', icon: Icons.pin, isDark: isDark, theme: theme, fontSize: fontSize, keyboardType: TextInputType.number, maxLength: 12, enabled: _aadhaarOcrDone),
        const SizedBox(height: 16),
        _buildTextField(controller: _aadhaarNameController, label: 'Name on Aadhaar', icon: Icons.person_outline, isDark: isDark, theme: theme, fontSize: fontSize, textCapitalization: TextCapitalization.words, enabled: _aadhaarOcrDone),
      ],
    );
  }

  Widget _buildSelfieStep(bool isDark, ThemeData theme, _FontSizes fontSize) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildHeader('Face Verification', 'Take a selfie to match with your ID.', Icons.face_retouching_natural, isDark),
        const SizedBox(height: 32),
        Center(
          child: GestureDetector(
            onTap: () => _pickImage((img) async {
              final bytes = await img.readAsBytes();
              setState(() {
                _selfieImage = img;
                _selfieImageBytes = bytes;
              });
            }, useCamera: true),
            child: _selfieImage != null
                ? FutureBuilder<Uint8List>(
                    future: _selfieImageBytes != null 
                        ? Future.value(_selfieImageBytes!)
                        : _selfieImage!.readAsBytes(),
                    builder: (context, snapshot) {
                      return Container(
                        width: 200,
                        height: 200,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isDark ? Colors.grey[900] : Colors.grey[100],
                          border: Border.all(color: theme.colorScheme.primary, width: 2),
                          image: snapshot.hasData 
                              ? DecorationImage(image: MemoryImage(snapshot.data!), fit: BoxFit.cover) 
                              : null,
                        ),
                        child: !snapshot.hasData 
                            ? const Center(child: CircularProgressIndicator(strokeWidth: 2))
                            : null,
                      );
                    },
                  )
                : Container(
                    width: 200,
                    height: 200,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: isDark ? Colors.grey[900] : Colors.grey[100],
                      border: Border.all(color: theme.colorScheme.primary, width: 2),
                    ),
                    child: Icon(Icons.camera_alt_rounded, size: 60, color: Colors.grey[400]),
                  ),
          ),
        ),
        const SizedBox(height: 24),
        Center(
          child: TextButton.icon(
            onPressed: () => _pickImage((img) async {
              final bytes = await img.readAsBytes();
              setState(() {
                _selfieImage = img;
                _selfieImageBytes = bytes;
              });
            }, useCamera: true),
            icon: const Icon(Icons.camera_alt),
            label: const Text('Take Photo'),
          ),
        ),
      ],
    );
  }

  Widget _buildBusinessStep(bool isDark, ThemeData theme, _FontSizes fontSize) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildHeader('Business Details', 'Select your business entity type.', Icons.store_mall_directory_outlined, isDark),
        const SizedBox(height: 24),
        ..._businessTypes.map((type) => RadioListTile<String>(
          title: Text(type, style: TextStyle(color: isDark ? Colors.white : Colors.black)),
          value: type,
          groupValue: _businessType,
          onChanged: (val) => setState(() => _businessType = val),
          activeColor: theme.colorScheme.primary,
          contentPadding: EdgeInsets.zero,
        )),
      ],
    );
  }

  Widget _buildGstStep(bool isDark, ThemeData theme, _FontSizes fontSize) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildHeader('GST Details', 'Provide GSTIN if applicable.', Icons.receipt_long_rounded, isDark),
        const SizedBox(height: 24),
        SwitchListTile(
          title: const Text('I am GST Exempt'),
          value: _isGstExempt,
          onChanged: (val) => setState(() => _isGstExempt = val),
          activeThumbColor: theme.colorScheme.primary,
        ),
        if (!_isGstExempt) ...[
          const SizedBox(height: 24),
           _buildTextField(controller: _gstNumberController, label: 'GST Number', icon: Icons.confirmation_number_outlined, isDark: isDark, theme: theme, fontSize: fontSize, textCapitalization: TextCapitalization.characters, maxLength: 15),
        ],
      ],
    );
  }

  Widget _buildBankStep(bool isDark, ThemeData theme, _FontSizes fontSize) {
    final accountLength = _selectedBank?.accountLength ?? 0;
    final currentAccountLength = _accountNumberController.text.replaceAll(RegExp(r'[^0-9]'), '').length;
    final isAccountLengthValid = _selectedBank != null && currentAccountLength == accountLength;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildHeader('Bank Account', 'For receiving payouts.', Icons.account_balance_rounded, isDark),
        const SizedBox(height: 24),
        
        // Bank Selection Dropdown
        _buildBankDropdown(isDark, theme, fontSize),
        const SizedBox(height: 16),
        
        // IFSC Code with Validator
        _buildIfscField(isDark, theme, fontSize),
        const SizedBox(height: 16),
        
        // Account Number with Length Indicator
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildTextField(
              controller: _accountNumberController, 
              label: 'Account Number${_selectedBank != null ? ' ($accountLength digits)' : ''}', 
              icon: Icons.numbers, 
              isDark: isDark, 
              theme: theme, 
              fontSize: fontSize, 
              keyboardType: TextInputType.number,
              maxLength: _selectedBank?.accountLength,
              enabled: _selectedBank != null,
            ),
            if (_selectedBank != null) ...[
              const SizedBox(height: 8),
              Row(
                children: [
                  Icon(
                    isAccountLengthValid ? Icons.check_circle : Icons.info_outline,
                    size: 16,
                    color: isAccountLengthValid ? Colors.green : Colors.grey[500],
                  ),
                  const SizedBox(width: 8),
                  Text(
                    '$currentAccountLength / $accountLength digits',
                    style: TextStyle(
                      fontSize: 12,
                      color: isAccountLengthValid ? Colors.green : Colors.grey[500],
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
        const SizedBox(height: 16),
        
        // Account Holder Name
        _buildTextField(
          controller: _accountHolderController, 
          label: 'Account Holder Name', 
          icon: Icons.person, 
          isDark: isDark, 
          theme: theme, 
          fontSize: fontSize,
          textCapitalization: TextCapitalization.words,
        ),
        
        const SizedBox(height: 28),
        
        // ═══════════════════════════════════════════════════════════════
        // BANK PROOF UPLOAD (Cancelled Cheque / Passbook)
        // ═══════════════════════════════════════════════════════════════
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1A1A1A) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: _isChequeUploaded 
                  ? const Color(0xFF10B981) 
                  : (isDark ? Colors.grey[800]! : Colors.grey[200]!),
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: (_isChequeUploaded ? const Color(0xFF10B981) : const Color(0xFF3B82F6)).withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      _isChequeUploaded ? Icons.check_circle : Icons.receipt_long_rounded,
                      color: _isChequeUploaded ? const Color(0xFF10B981) : const Color(0xFF3B82F6),
                      size: 20,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Bank Proof Document',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: isDark ? Colors.white : const Color(0xFF111827),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          'Cancelled cheque or passbook',
                          style: TextStyle(
                            fontSize: 12,
                            color: Colors.grey[500],
                          ),
                        ),
                      ],
                    ),
                  ),
                  if (_isChequeUploaded) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Text(
                        'Uploaded',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Color(0xFF10B981),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              
              const SizedBox(height: 16),
              
              // Show uploaded file or upload button
              if (_isChequeUploaded && _cancelledChequeImageBytes != null) ...[
                // File preview
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.black26 : Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[200]!),
                  ),
                  child: Row(
                    children: [
                      // Preview image or PDF icon
                      if (_cancelledChequeFileName?.endsWith('.pdf') == true) ...[
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: const Color(0xFFDC2626).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: const Icon(Icons.picture_as_pdf, color: Color(0xFFDC2626), size: 28),
                        ),
                      ] else ...[
                        ClipRRect(
                          borderRadius: BorderRadius.circular(8),
                          child: Image.memory(
                            _cancelledChequeImageBytes!,
                            width: 48,
                            height: 48,
                            fit: BoxFit.cover,
                          ),
                        ),
                      ],
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _cancelledChequeFileName ?? 'Bank Proof',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: isDark ? Colors.white : Colors.black,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${(_cancelledChequeImageBytes!.length / 1024).toStringAsFixed(1)} KB',
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.grey[500],
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Change button
                      IconButton(
                        onPressed: _pickBankProof,
                        icon: Icon(Icons.edit, color: theme.colorScheme.primary, size: 20),
                        tooltip: 'Change',
                      ),
                      // Remove button
                      IconButton(
                        onPressed: () {
                          setState(() {
                            _cancelledChequeImage = null;
                            _cancelledChequeImageBytes = null;
                            _cancelledChequeFileName = null;
                            _isChequeUploaded = false;
                          });
                        },
                        icon: Icon(Icons.delete_outline, color: Colors.red[400], size: 20),
                        tooltip: 'Remove',
                      ),
                    ],
                  ),
                ),
              ] else ...[
                // Upload button
                GestureDetector(
                  onTap: _pickBankProof,
                  child: Container(
                    padding: const EdgeInsets.symmetric(vertical: 20),
                    decoration: BoxDecoration(
                      color: isDark ? Colors.black12 : Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(
                        color: (isDark ? Colors.grey[700]! : Colors.grey[300]!),
                        style: BorderStyle.solid,
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.cloud_upload_outlined,
                          color: theme.colorScheme.primary,
                          size: 24,
                        ),
                        const SizedBox(width: 12),
                        Text(
                          'Upload Cheque / Passbook',
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: theme.colorScheme.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.info_outline, size: 14, color: Colors.grey[500]),
                    const SizedBox(width: 6),
                    Text(
                      'Supports JPG, PNG, PDF (Max 5MB)',
                      style: TextStyle(
                        fontSize: 11,
                        color: Colors.grey[500],
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
  
  Widget _buildBankDropdown(bool isDark, ThemeData theme, _FontSizes fontSize) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: isDark ? const Color(0xFF262626) : const Color(0xFFF9FAFB),
        border: Border.all(
          color: _selectedBank != null 
              ? theme.colorScheme.primary 
              : (isDark ? Colors.grey[800]! : Colors.grey[300]!),
          width: _selectedBank != null ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.account_balance,
            color: _selectedBank != null ? theme.colorScheme.primary : Colors.grey[400],
            size: fontSize.icon,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Select Bank',
                  style: TextStyle(
                    color: _selectedBank != null ? theme.colorScheme.primary : Colors.grey[600],
                    fontSize: fontSize.label,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 4),
                DropdownButtonHideUnderline(
                  child: DropdownButton<BankInfo>(
                    value: _selectedBank,
                    hint: Text(
                      'Choose your bank',
                      style: TextStyle(color: isDark ? Colors.grey[600] : Colors.grey[400]),
                    ),
                    isExpanded: true,
                    isDense: true,
                    icon: Icon(Icons.keyboard_arrow_down, color: Colors.grey[400]),
                    dropdownColor: isDark ? const Color(0xFF262626) : Colors.white,
                    items: indianBanks.map((bank) {
                      return DropdownMenuItem<BankInfo>(
                        value: bank,
                        child: Text(
                          bank.name,
                          style: TextStyle(
                            color: isDark ? Colors.white : Colors.grey[900],
                            fontSize: fontSize.input,
                          ),
                        ),
                      );
                    }).toList(),
                    onChanged: (bank) {
                      setState(() {
                        _selectedBank = bank;
                        _accountNumberController.clear();
                        // Reset IFSC and validation when bank changes
                        _ifscController.clear();
                        _ifscValidated = false;
                        _ifscBankName = null;
                        // Auto-set IFSC prefix if bank selected
                        if (bank != null) {
                          _ifscController.text = '${bank.code}0';
                        }
                      });
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
  
  Widget _buildIfscField(bool isDark, ThemeData theme, _FontSizes fontSize) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: _buildTextField(
                controller: _ifscController,
                label: 'IFSC Code',
                icon: Icons.code,
                isDark: isDark,
                theme: theme,
                fontSize: fontSize,
                textCapitalization: TextCapitalization.characters,
                maxLength: 11,
              ),
            ),
            const SizedBox(width: 8),
            // Validate Button
            ElevatedButton(
              onPressed: _ifscController.text.length == 11 ? _validateIfsc : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: _ifscValidated ? Colors.green : theme.colorScheme.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isLoading
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Icon(_ifscValidated ? Icons.check : Icons.verified_outlined, size: 20),
            ),
          ],
        ),
        const SizedBox(height: 12),
        // Find IFSC Button
        Center(
          child: TextButton.icon(
            onPressed: _selectedBank != null ? () => _showIfscFinderModal(isDark, theme) : null,
            icon: const Icon(Icons.search, size: 18),
            label: const Text('Find IFSC by Branch'),
            style: TextButton.styleFrom(
              foregroundColor: theme.colorScheme.primary,
            ),
          ),
        ),
        if (_ifscValidated && _ifscBankName != null) ...[
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(Icons.check_circle, size: 16, color: Colors.green),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _ifscBankName!,
                  style: const TextStyle(fontSize: 12, color: Colors.green, fontWeight: FontWeight.w500),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
  
  void _showIfscFinderModal(bool isDark, ThemeData theme) {
    // Instead of making hundreds of failed API calls trying to guess IFSC codes,
    // we direct users to an external IFSC finder website and let them enter the code
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          height: MediaQuery.of(context).size.height * 0.5,
          decoration: BoxDecoration(
            color: isDark ? const Color(0xFF1A1A1A) : Colors.white,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // Handle
              Container(
                margin: const EdgeInsets.only(top: 12),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.grey[400],
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              
              // Title
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    Icon(
                      Icons.search,
                      size: 48,
                      color: theme.colorScheme.primary,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Find Your IFSC Code',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white : Colors.black,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Use the official IFSC finder to search for your bank branch code by state, district, and branch name.',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.grey[500], fontSize: 14),
                    ),
                  ],
                ),
              ),
              
              const Spacer(),
              
              // Instructions
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: theme.colorScheme.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              color: theme.colorScheme.primary,
                              shape: BoxShape.circle,
                            ),
                            child: const Center(
                              child: Text('1', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Click the button below to open IFSC finder',
                              style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              color: theme.colorScheme.primary,
                              shape: BoxShape.circle,
                            ),
                            child: const Center(
                              child: Text('2', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Search by bank name, state, and branch',
                              style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          Container(
                            width: 24,
                            height: 24,
                            decoration: BoxDecoration(
                              color: theme.colorScheme.primary,
                              shape: BoxShape.circle,
                            ),
                            child: const Center(
                              child: Text('3', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Copy the IFSC code and paste it here',
                              style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
              
              const SizedBox(height: 20),
              
              // Open Website Button
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: () async {
                      // Open official RBI IFSC finder website
                      final url = Uri.parse('https://www.rbi.org.in/Scripts/IFSCMICRDetails.aspx');
                      if (await canLaunchUrl(url)) {
                        await launchUrl(url, mode: LaunchMode.externalApplication);
                      }
                      Navigator.pop(context);
                    },
                    icon: const Icon(Icons.open_in_new),
                    label: const Text('Open RBI IFSC Finder'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: theme.colorScheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ),
              
              const SizedBox(height: 12),
              
              // Alternative Google Search Button
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () async {
                      // Open Google search for IFSC
                      final bankName = _selectedBank?.name ?? 'bank';
                      final searchQuery = Uri.encodeComponent('$bankName IFSC code finder');
                      final url = Uri.parse('https://www.google.com/search?q=$searchQuery');
                      if (await canLaunchUrl(url)) {
                        await launchUrl(url, mode: LaunchMode.externalApplication);
                      }
                      Navigator.pop(context);
                    },
                    icon: const Icon(Icons.search),
                    label: const Text('Search on Google'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: theme.colorScheme.primary,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      side: BorderSide(color: theme.colorScheme.primary),
                    ),
                  ),
                ),
              ),
              
              const SizedBox(height: 20),
            ],
          ),
        );
      },
    );
  }
  
  Future<void> _validateIfsc() async {
    final ifsc = _ifscController.text.toUpperCase();
    if (ifsc.length != 11) {
      _showError('IFSC code must be 11 characters');
      return;
    }
    
    setState(() => _isLoading = true);
    
    try {
      // Use RazorPay's public IFSC API
      final response = await http.get(
        Uri.parse('https://ifsc.razorpay.com/$ifsc'),
      );
      
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _ifscValidated = true;
          _ifscBankName = '${data['BANK']} - ${data['BRANCH']}, ${data['CITY']}';
          
          // Auto-select bank if it matches
          final bankCode = ifsc.substring(0, 4);
          final matchedBank = getBankByIfscPrefix(bankCode);
          if (matchedBank != null && _selectedBank == null) {
            _selectedBank = matchedBank;
          }
        });
        _showSuccess('IFSC validated successfully!');
      } else {
        setState(() {
          _ifscValidated = false;
          _ifscBankName = null;
        });
        _showError('Invalid IFSC code. Please check and try again.');
      }
    } catch (e) {
      debugPrint('IFSC validation error: $e');
      _showError('Failed to validate IFSC. Please try again.');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Widget _buildAddressStep(bool isDark, ThemeData theme, _FontSizes fontSize) {
    final pincodeDigits = _pincodeController.text.replaceAll(RegExp(r'[^0-9]'), '');
    final isPincodeValid = pincodeDigits.length == 6;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildHeader('Business Address', 'Where do you ship from?', Icons.location_on_outlined, isDark),
        const SizedBox(height: 24),
        
        // Use Current Location Button
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _isLoading ? null : _getCurrentLocation,
            icon: _isLoading 
                ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                : const Icon(Icons.my_location),
            label: Text(_isLoading ? 'Detecting Location...' : 'Use Current Location'),
            style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
          ),
        ),
        const SizedBox(height: 24),
        
        // Address Line 1
        _buildTextField(
          controller: _addressLine1Controller, 
          label: 'Address Line 1', 
          icon: Icons.home, 
          isDark: isDark, 
          theme: theme, 
          fontSize: fontSize,
        ),
        const SizedBox(height: 16),
        
        // State Dropdown
        _buildAddressDropdown(
          value: _selectedAddressState,
          items: indianDistricts.keys.toList()..sort(),
          hint: 'Select State',
          icon: Icons.map,
          isDark: isDark,
          theme: theme,
          fontSize: fontSize,
          onChanged: (value) {
            setState(() {
              _selectedAddressState = value;
              _selectedAddressCity = null;
              _availableAddressCities = indianDistricts[value] ?? [];
            });
          },
        ),
        const SizedBox(height: 16),
        
        // City/District Dropdown
        _buildAddressDropdown(
          value: _selectedAddressCity,
          items: _availableAddressCities,
          hint: _selectedAddressState == null ? 'Select state first' : 'Select City/District',
          icon: Icons.location_city,
          isDark: isDark,
          theme: theme,
          fontSize: fontSize,
          enabled: _selectedAddressState != null,
          onChanged: (value) {
            setState(() => _selectedAddressCity = value);
          },
        ),
        const SizedBox(height: 16),
        
        // Pincode with validation indicator
        Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildTextField(
              controller: _pincodeController, 
              label: 'Pincode (6 digits)', 
              icon: Icons.pin_drop, 
              isDark: isDark, 
              theme: theme, 
              fontSize: fontSize, 
              keyboardType: TextInputType.number,
              maxLength: 6,
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Icon(
                  isPincodeValid ? Icons.check_circle : Icons.info_outline,
                  size: 16,
                  color: isPincodeValid ? Colors.green : Colors.grey[500],
                ),
                const SizedBox(width: 8),
                Text(
                  isPincodeValid ? 'Valid pincode' : '${pincodeDigits.length} / 6 digits',
                  style: TextStyle(
                    fontSize: 12,
                    color: isPincodeValid ? Colors.green : Colors.grey[500],
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
  
  /// Build dropdown for address state/city selection
  Widget _buildAddressDropdown({
    required String? value,
    required List<String> items,
    required String hint,
    required IconData icon,
    required bool isDark,
    required ThemeData theme,
    required _FontSizes fontSize,
    required ValueChanged<String?> onChanged,
    bool enabled = true,
  }) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: (isDark ? const Color(0xFF262626) : const Color(0xFFF9FAFB)).withValues(alpha: enabled ? 1 : 0.5),
        border: Border.all(
          color: value != null 
              ? theme.colorScheme.primary 
              : (isDark ? Colors.grey[800]! : Colors.grey[300]!),
          width: value != null ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          Icon(icon, color: value != null ? theme.colorScheme.primary : Colors.grey[400], size: fontSize.icon),
          const SizedBox(width: 16),
          Expanded(
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String>(
                value: value,
                hint: Text(hint, style: TextStyle(color: isDark ? Colors.grey[600] : Colors.grey[400])),
                isExpanded: true,
                isDense: false,
                icon: Icon(Icons.keyboard_arrow_down, color: enabled ? Colors.grey[400] : Colors.grey[600]),
                dropdownColor: isDark ? const Color(0xFF262626) : Colors.white,
                items: items.map((item) {
                  return DropdownMenuItem<String>(
                    value: item,
                    child: Text(
                      item,
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.grey[900],
                        fontSize: fontSize.input,
                      ),
                    ),
                  );
                }).toList(),
                onChanged: enabled ? onChanged : null,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // WIDGET HELPERS
  // ═══════════════════════════════════════════════════════════════

  Widget _buildHeader(String title, String subtitle, IconData icon, bool isDark) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(color: const Color(0xFF3B82F6).withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: const Color(0xFF3B82F6), size: 28),
        ),
        const SizedBox(height: 16),
        Text(title, style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black)),
        const SizedBox(height: 8),
        Text(subtitle, style: TextStyle(fontSize: 14, color: isDark ? Colors.grey[400] : Colors.grey[600])),
      ],
    );
  }

  Widget _buildImageUploadZone({required String label, XFile? image, Uint8List? imageBytes, bool isProcessing = false, VoidCallback? onTap, required bool isDark}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 160,
        decoration: BoxDecoration(
          color: isDark ? Colors.black26 : Colors.grey[50],
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isDark ? Colors.grey[800]! : Colors.grey[300]!, style: BorderStyle.none),
        ),
        child: Stack(
          alignment: Alignment.center,
          children: [
            if (image != null || imageBytes != null)
              ClipRRect(
                borderRadius: BorderRadius.circular(16), 
                child: imageBytes != null
                    ? Image.memory(imageBytes, width: double.infinity, height: double.infinity, fit: BoxFit.cover)
                    : FutureBuilder<Uint8List>(
                        future: image!.readAsBytes(),
                        builder: (context, snapshot) {
                          if (snapshot.hasData) {
                            return Image.memory(snapshot.data!, width: double.infinity, height: double.infinity, fit: BoxFit.cover);
                          }
                          return const Center(child: CircularProgressIndicator(strokeWidth: 2));
                        },
                      ),
              ),
            
            if (isProcessing)
              Container(color: Colors.black54, child: const Center(child: CircularProgressIndicator())),

            if (image == null && imageBytes == null && !isProcessing)
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.cloud_upload_outlined, size: 32, color: isDark ? Colors.grey[500] : Colors.grey[400]),
                  const SizedBox(height: 12),
                  Text(label, style: TextStyle(color: isDark ? Colors.grey[400] : Colors.grey[600], fontWeight: FontWeight.w500)),
                ],
              ),
            
            if ((image != null || imageBytes != null) && !isProcessing)
              Positioned(
                bottom: 8, right: 8,
                child: CircleAvatar(backgroundColor: Colors.black54, radius: 16, child: const Icon(Icons.edit, size: 16, color: Colors.white)),
              ),
          ],
        ),
      ),
    );
  }


  Widget _buildTextField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    required bool isDark,
    required ThemeData theme,
    required _FontSizes fontSize,
    TextInputType? keyboardType,
    TextCapitalization textCapitalization = TextCapitalization.none,
    int? maxLength,
    FocusNode? focusNode, // Added support for explicit focus node
    bool enabled = true,
  }) {
    return ProfessionalTextField(
      controller: controller,
      focusNode: focusNode,
      label: label,
      icon: icon,
      isDark: isDark,
      theme: theme,
      fontSize: fontSize,
      keyboardType: keyboardType,
      textCapitalization: textCapitalization,
      maxLength: maxLength,
      enabled: enabled,
    );
  }

  bool get _canProceed {
    switch (_currentStep) {
      case 0: // Business Details + Address
        if (_businessType == null) return false;
        if (_businessNameController.text.trim().isEmpty) return false;
        if (_hasGstRegistration) {
          if (_gstNumberController.text.isEmpty) return false;
          if (!validateGstin(_gstNumberController.text.toUpperCase())) return false;
        }
        if (_primaryCategory == null) return false;
        if (_primarySubCategory == null) return false;
        // Business Address validation - Continue only after address is filled
        if (_addressLine1Controller.text.trim().isEmpty) return false;
        if (_selectedAddressState == null) return false;
        if (_selectedAddressCity == null) return false;
        final pincode = _pincodeController.text.replaceAll(RegExp(r'[^0-9]'), '');
        if (pincode.length != 6) return false;
        return true;
      case 1: // Identity Verification (PAN + Aadhaar + Selfie combined)
        // All 3 documents must be uploaded
        if (_panCardImage == null) return false;
        if (_aadhaarFrontImage == null) return false;
        if (_aadhaarBackImage == null) return false;
        // OCR must be done (happens after all 3 uploads)
        if (!_panOcrDone || !_aadhaarOcrDone) return false;
        // PAN and Aadhaar details must be filled
        if (_panNumberController.text.length != 10) return false;
        if (_panNameController.text.isEmpty) return false;
        if (_aadhaarNumberController.text.length != 12) return false;
        if (_aadhaarNameController.text.isEmpty) return false;
        // Names must match reasonably (50% threshold)
        if (_nameMatchChecked && _nameMatchPercentage < 50) return false;
        // Selfie must be taken
        if (_selfieImage == null) return false;
        return true;
      case 2: // Bank
        if (_selectedBank == null) return false;
        if (!_ifscValidated) return false;
        final requiredLength = _selectedBank!.accountLength;
        final accountDigits = _accountNumberController.text.replaceAll(RegExp(r'[^0-9]'), '');
        final hasValidAccountLength = accountDigits.length == requiredLength;
        final hasAccountHolder = _accountHolderController.text.trim().isNotEmpty;
        // Require bank proof (cancelled cheque/passbook) upload
        final hasBankProof = _isChequeUploaded && _cancelledChequeImageBytes != null;
        return hasValidAccountLength && hasAccountHolder && hasBankProof;
      default:
        return true;
    }
  }

  Widget _buildFooter(bool isDark, ThemeData theme, _FontSizes fontSize) {
    return padding(
      padding: const EdgeInsets.all(24),
      child: Row(
        children: [
          if (_currentStep > 0)
            Expanded(
              child: OutlinedButton(
                onPressed: _isLoading ? null : _previousStep,
                style: OutlinedButton.styleFrom(
                  padding: EdgeInsets.symmetric(vertical: fontSize.buttonHeight / 3),
                  side: BorderSide(color: isDark ? Colors.grey[700]! : Colors.grey[300]!),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Text('Back', style: TextStyle(color: isDark ? Colors.white : Colors.black, fontWeight: FontWeight.w600)),
              ),
            ),
          if (_currentStep > 0) const SizedBox(width: 16),
          Expanded(
            flex: 2,
            child: _buildProfessionalButton(
              onPressed: (_isLoading || !_canProceed) ? null : _nextStep,
              isLoading: _isLoading,
              label: _currentStep == _stepNames.length - 1 ? 'Submit KYC' : 'Continue',
              theme: theme,
              fontSize: fontSize,
            ),
          ),
        ],
      ),
    );
  }
  
  Widget padding({required Widget child, required EdgeInsets padding}) => Padding(padding: padding, child: child);

  Widget _buildProfessionalButton({required VoidCallback? onPressed, required bool isLoading, required String label, required ThemeData theme, required _FontSizes fontSize}) {
    return SizedBox(
      height: fontSize.buttonHeight,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: const Color(0xFF111827),
          foregroundColor: Colors.white,
          elevation: 0,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          padding: EdgeInsets.zero,
        ),
        child: isLoading
            ? SizedBox(width: fontSize.icon, height: fontSize.icon, child: const CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation<Color>(Colors.white)))
            : Text(label, style: TextStyle(fontSize: fontSize.button, fontWeight: FontWeight.w600, letterSpacing: 0.2)),
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // BACKGROUND EFFECTS (Reusable)
  // ═══════════════════════════════════════════════════════════════
  Widget _buildAnimatedBackground(bool isDark) {
    return AnimatedBuilder(
      animation: _bgAnimController,
      builder: (context, _) {
        return Container(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              center: Alignment(math.sin(_bgAnimController.value * 2 * math.pi) * 0.5, math.cos(_bgAnimController.value * 2 * math.pi) * 0.5),
              radius: 1.5,
              colors: isDark ? [const Color(0xFF3B82F6).withValues(alpha: 0.15), const Color(0xFF080B12), const Color(0xFF080B12)] : [const Color(0xFF3B82F6).withValues(alpha: 0.1), const Color(0xFFF0F4F8), const Color(0xFFF0F4F8)],
            ),
          ),
        );
      },
    );
  }

  List<Widget> _buildFloatingOrbs(bool isDark, Size size) {
    return [
      Positioned(
        top: -size.height * 0.1, right: -size.width * 0.1,
        child: AnimatedBuilder(
          animation: _floatController,
          builder: (context, _) => Transform.translate(
            offset: Offset(0, _floatController.value * 30),
            child: Container(width: size.width * 0.3, height: size.width * 0.3, decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [const Color(0xFF3B82F6).withValues(alpha: 0.3), Colors.transparent]))),
          ),
        ),
      ),
    ];
  }
}

// ═══════════════════════════════════════════════════════════════
// SHARED UTILS
// ═══════════════════════════════════════════════════════════════

class MainUtil {
  static const bool isWeb = kIsWeb;
  static final imageFilter = ImageFilter.blur(sigmaX: 10, sigmaY: 10);
  static final blur = imageFilter;
}

// ═══════════════════════════════════════════════════════════════
// RESPONSIVE FONT SIZES (COPIED)
// ═══════════════════════════════════════════════════════════════
class _FontSizes {
  final double title;
  final double body;
  final double label;
  final double input;
  final double button;
  final double icon;
  final double inputPadding;
  final double buttonHeight;

  const _FontSizes({required this.title, required this.body, required this.label, required this.input, required this.button, required this.icon, required this.inputPadding, required this.buttonHeight});

  static const mobile = _FontSizes(title: 24, body: 14, label: 13, input: 15, button: 15, icon: 20, inputPadding: 18, buttonHeight: 54);
  static const tablet = _FontSizes(title: 28, body: 15, label: 14, input: 16, button: 16, icon: 22, inputPadding: 20, buttonHeight: 58);
  static const desktop = _FontSizes(title: 32, body: 16, label: 15, input: 17, button: 17, icon: 24, inputPadding: 22, buttonHeight: 64);
}

class _GridPatternPainter extends CustomPainter {
  final bool isDark;
  _GridPatternPainter({this.isDark = false});
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()..color = (isDark ? Colors.white : Colors.grey).withValues(alpha: 0.05)..strokeWidth = 1;
    for (double x = 0; x < size.width; x += 50) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += 50) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }
  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ═══════════════════════════════════════════════════════════════
// PROFESSIONAL TEXT FIELD (STATEFUL)
// ═══════════════════════════════════════════════════════════════
class ProfessionalTextField extends StatefulWidget {
  final TextEditingController controller;
  final FocusNode? focusNode;
  final String label;
  final IconData icon;
  final bool isDark;
  final ThemeData theme;
  final _FontSizes fontSize;
  final TextInputType? keyboardType;
  final TextCapitalization textCapitalization;
  final int? maxLength;
  final bool enabled;

  const ProfessionalTextField({
    super.key,
    required this.controller,
    this.focusNode,
    required this.label,
    required this.icon,
    required this.isDark,
    required this.theme,
    required this.fontSize,
    this.keyboardType,
    this.textCapitalization = TextCapitalization.none,
    this.maxLength,
    this.enabled = true,
  });

  @override
  State<ProfessionalTextField> createState() => _ProfessionalTextFieldState();
}

class _ProfessionalTextFieldState extends State<ProfessionalTextField> {
  late FocusNode _focusNode;
  bool _isFocused = false;

  @override
  void initState() {
    super.initState();
    _focusNode = widget.focusNode ?? FocusNode();
    _focusNode.addListener(_handleFocusChange);
  }

  @override
  void dispose() {
    if (widget.focusNode == null) _focusNode.dispose();
    super.dispose();
  }

  void _handleFocusChange() {
    if (mounted) setState(() => _isFocused = _focusNode.hasFocus);
  }

  @override
  Widget build(BuildContext context) {
    // Opacity for disabled state
    final double opacity = widget.enabled ? 1.0 : 0.6;
    
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeInOut,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        color: (widget.isDark ? const Color(0xFF262626) : const Color(0xFFF9FAFB)).withValues(alpha: widget.enabled ? 1 : 0.5),
        border: Border.all(
          color: _isFocused 
              ? widget.theme.colorScheme.primary 
              : (widget.isDark ? Colors.grey[800]! : Colors.grey[300]!).withValues(alpha: opacity),
          width: _isFocused ? 1.5 : 1,
        ),
        boxShadow: _isFocused ? [
          BoxShadow(
            color: widget.theme.colorScheme.primary.withValues(alpha: 0.1),
            blurRadius: 8,
            spreadRadius: 0,
            offset: const Offset(0, 2),
          ),
        ] : null,
      ),
      child: ClipRect(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // icon
            TweenAnimationBuilder<Color?>(
              duration: const Duration(milliseconds: 200),
              tween: ColorTween(
                begin: Colors.grey[400],
                end: _isFocused ? widget.theme.colorScheme.primary : Colors.grey[400],
              ),
              builder: (context, color, _) {
                return Icon(widget.icon, color: color?.withValues(alpha: opacity), size: widget.fontSize.icon);
              },
            ),
            const SizedBox(width: 16),
            
            Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                AnimatedDefaultTextStyle(
                  duration: const Duration(milliseconds: 200),
                  style: TextStyle(
                    color: (_isFocused ? widget.theme.colorScheme.primary : Colors.grey[600])?.withValues(alpha: opacity),
                    fontSize: widget.fontSize.label,
                    fontWeight: FontWeight.w600,
                    fontFamily: 'Inter',
                  ),
                  child: Text(widget.label),
                ),
                const SizedBox(height: 4),
                TextField(
                  controller: widget.controller,
                  focusNode: _focusNode,
                  keyboardType: widget.keyboardType,
                  textCapitalization: widget.textCapitalization,
                  maxLength: widget.maxLength,
                  enabled: widget.enabled,
                  style: TextStyle(
                    color: (widget.isDark ? Colors.white : Colors.grey[900])?.withValues(alpha: opacity),
                    fontSize: widget.fontSize.input,
                    fontWeight: FontWeight.w600,
                  ),
                  decoration: InputDecoration(
                    isDense: true,
                    filled: false,
                    hoverColor: Colors.transparent,
                    fillColor: Colors.transparent,
                    focusColor: Colors.transparent,
                    contentPadding: EdgeInsets.zero,
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    errorBorder: InputBorder.none,
                    disabledBorder: InputBorder.none,
                    counterText: '',
                    hintText: 'Enter ${widget.label.toLowerCase()}',
                    hintStyle: TextStyle(
                      color: (widget.isDark ? Colors.grey[600] : Colors.grey[400])?.withValues(alpha: opacity),
                      fontWeight: FontWeight.w400,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      ),
    );
  }
}
