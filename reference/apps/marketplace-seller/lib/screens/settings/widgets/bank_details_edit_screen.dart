// lib/screens/settings/widgets/bank_details_edit_screen.dart
// 🏦 Bank Details Edit Screen - Matching KYC Wizard Implementation

import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../providers/seller_provider.dart';
import '../../../data/bank_data.dart';

class BankDetailsEditScreen extends StatefulWidget {
  const BankDetailsEditScreen({super.key});

  @override
  State<BankDetailsEditScreen> createState() => _BankDetailsEditScreenState();
}

class _BankDetailsEditScreenState extends State<BankDetailsEditScreen> {
  final _formKey = GlobalKey<FormState>();
  
  // Controllers
  late TextEditingController _accountNumberController;
  late TextEditingController _ifscController;
  late TextEditingController _accountHolderController;
  
  // State
  BankInfo? _selectedBank;
  bool _isLoading = false;
  bool _isSaving = false;
  bool _ifscValidated = false;
  String? _ifscBankName;

  @override
  void initState() {
    super.initState();
    final seller = context.read<SellerProvider>().currentSeller;
    
    _accountNumberController = TextEditingController(text: seller?.bankAccountNumber ?? '');
    _ifscController = TextEditingController(text: seller?.bankIfscCode ?? '');
    _accountHolderController = TextEditingController(text: seller?.bankAccountHolderName ?? '');
    
    // Auto-detect bank from existing IFSC
    if (seller?.bankIfscCode != null && seller!.bankIfscCode!.length >= 4) {
      _selectedBank = getBankByIfscPrefix(seller.bankIfscCode!);
      if (_selectedBank != null) {
        _ifscValidated = true;
        _ifscBankName = seller.bankName;
      }
    }
    
    // Add listeners
    _ifscController.addListener(() => setState(() {}));
    _accountNumberController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _accountNumberController.dispose();
    _ifscController.dispose();
    _accountHolderController.dispose();
    super.dispose();
  }

  // ═══════════════════════════════════════════════════════════════════════
  // IFSC VALIDATION
  // ═══════════════════════════════════════════════════════════════════════
  
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

  // ═══════════════════════════════════════════════════════════════════════
  // SAVE BANK DETAILS
  // ═══════════════════════════════════════════════════════════════════════
  
  Future<void> _saveChanges() async {
    if (!_formKey.currentState!.validate()) return;
    
    // Validate required fields
    if (_selectedBank == null) {
      _showError('Please select a bank');
      return;
    }
    
    // Make IFSC validation optional - just check format
    final ifsc = _ifscController.text.toUpperCase().trim();
    if (ifsc.length != 11) {
      _showError('IFSC code must be 11 characters');
      return;
    }
    
    // Warn about account number length but don't block
    final accountLength = _selectedBank!.accountLength;
    final currentLength = _accountNumberController.text.replaceAll(RegExp(r'[^0-9]'), '').length;
    if (currentLength < 9 || currentLength > 18) {
      _showError('Account number must be 9-18 digits');
      return;
    }

    setState(() => _isSaving = true);

    final sellerProvider = context.read<SellerProvider>();
    final success = await sellerProvider.updateBankDetails(
      accountNumber: _accountNumberController.text.trim(),
      ifscCode: ifsc,
      accountHolderName: _accountHolderController.text.trim(),
      bankName: _selectedBank!.name,
    );

    setState(() => _isSaving = false);

    if (!mounted) return;

    if (success) {
      _showSuccess('Bank details updated successfully');
      Navigator.pop(context);
    } else {
      _showError(sellerProvider.error ?? 'Failed to update bank details');
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.error_outline, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: Colors.red,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  void _showSuccess(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(Icons.check_circle, color: Colors.white),
            const SizedBox(width: 12),
            Expanded(child: Text(message)),
          ],
        ),
        backgroundColor: Colors.green,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BUILD UI
  // ═══════════════════════════════════════════════════════════════════════

  @override
  Widget build(BuildContext context) {
    final themeProvider = Provider.of<ThemeProvider>(context);
    final isDark = themeProvider.isDarkMode;
    final theme = Theme.of(context);

    return Scaffold(
      backgroundColor: isDark ? AppColors.backgroundDark : AppColors.background,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        elevation: 0,
        title: Text(
          'Bank Details',
          style: TextStyle(
            color: isDark ? AppColors.textLight : AppColors.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back_rounded,
            color: isDark ? AppColors.textLight : AppColors.textPrimary,
          ),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _buildSecurityInfoCard(isDark),
            const SizedBox(height: 24),
            
            // Bank Selection Dropdown
            _buildSectionTitle('Select Bank', isDark),
            const SizedBox(height: 8),
            _buildBankDropdown(isDark, theme),
            const SizedBox(height: 24),
            
            // IFSC Code with Validator
            _buildSectionTitle('IFSC Code', isDark),
            const SizedBox(height: 8),
            _buildIfscField(isDark, theme),
            const SizedBox(height: 24),
            
            // Account Number with Length Indicator
            _buildSectionTitle('Account Number', isDark),
            const SizedBox(height: 8),
            _buildAccountNumberField(isDark, theme),
            const SizedBox(height: 24),
            
            // Account Holder Name
            _buildSectionTitle('Account Holder Name', isDark),
            const SizedBox(height: 8),
            _buildAccountHolderField(isDark, theme),
            const SizedBox(height: 32),
            
            _buildSaveButton(isDark),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title, bool isDark) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        color: isDark ? Colors.grey[400] : Colors.grey[600],
      ),
    );
  }

  Widget _buildSecurityInfoCard(bool isDark) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.success.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.success.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.verified_user_rounded, color: AppColors.success, size: 24),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Secure & Encrypted',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: isDark ? AppColors.textLight : AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Your bank details are encrypted and stored securely. All payouts will be credited to this account.',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDark ? AppColors.textLightSecondary : AppColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // BANK DROPDOWN
  // ═══════════════════════════════════════════════════════════════════════

  Widget _buildBankDropdown(bool isDark, ThemeData theme) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
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
            size: 24,
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  'Bank',
                  style: TextStyle(
                    color: _selectedBank != null ? theme.colorScheme.primary : Colors.grey[600],
                    fontSize: 12,
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
                            fontSize: 14,
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

  // ═══════════════════════════════════════════════════════════════════════
  // IFSC FIELD WITH VALIDATION
  // ═══════════════════════════════════════════════════════════════════════

  Widget _buildIfscField(bool isDark, ThemeData theme) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: TextFormField(
                controller: _ifscController,
                textCapitalization: TextCapitalization.characters,
                maxLength: 11,
                style: TextStyle(
                  color: isDark ? AppColors.textLight : AppColors.textPrimary,
                  letterSpacing: 1.5,
                ),
                decoration: InputDecoration(
                  labelText: 'IFSC Code',
                  hintText: 'e.g., SBIN0001234',
                  counterText: '',
                  prefixIcon: Icon(
                    Icons.code_rounded,
                    color: _ifscValidated ? Colors.green : (isDark ? AppColors.primaryLight : AppColors.primary),
                  ),
                  filled: true,
                  fillColor: isDark ? AppColors.surfaceDark : AppColors.surface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: isDark ? AppColors.borderDark : AppColors.border,
                    ),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: _ifscValidated ? Colors.green : (isDark ? AppColors.borderDark : AppColors.border),
                    ),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide: BorderSide(
                      color: _ifscValidated ? Colors.green : (isDark ? AppColors.primaryLight : AppColors.primary),
                      width: 2,
                    ),
                  ),
                ),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'IFSC code is required';
                  }
                  if (value.trim().length != 11) {
                    return 'IFSC code must be 11 characters';
                  }
                  return null;
                },
              ),
            ),
            const SizedBox(width: 12),
            // Validate Button
            ElevatedButton(
              onPressed: _ifscController.text.length == 11 && !_isLoading ? _validateIfsc : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: _ifscValidated ? Colors.green : theme.colorScheme.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 18),
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
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.green.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.check_circle, size: 18, color: Colors.green),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    _ifscBankName!,
                    style: const TextStyle(fontSize: 13, color: Colors.green, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ACCOUNT NUMBER FIELD
  // ═══════════════════════════════════════════════════════════════════════

  Widget _buildAccountNumberField(bool isDark, ThemeData theme) {
    final accountLength = _selectedBank?.accountLength ?? 0;
    final currentAccountLength = _accountNumberController.text.replaceAll(RegExp(r'[^0-9]'), '').length;
    final isAccountLengthValid = _selectedBank != null && currentAccountLength == accountLength;
    
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        TextFormField(
          controller: _accountNumberController,
          keyboardType: TextInputType.number,
          maxLength: _selectedBank?.accountLength,
          enabled: _selectedBank != null,
          style: TextStyle(
            color: isDark ? AppColors.textLight : AppColors.textPrimary,
            letterSpacing: 2,
          ),
          decoration: InputDecoration(
            labelText: _selectedBank != null ? 'Account Number ($accountLength digits)' : 'Account Number',
            hintText: _selectedBank != null ? 'Enter $accountLength digit account number' : 'Select a bank first',
            counterText: '',
            prefixIcon: Icon(
              Icons.numbers_rounded,
              color: isAccountLengthValid ? Colors.green : (isDark ? AppColors.primaryLight : AppColors.primary),
            ),
            filled: true,
            fillColor: isDark ? AppColors.surfaceDark : AppColors.surface,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: isDark ? AppColors.borderDark : AppColors.border,
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: isAccountLengthValid ? Colors.green : (isDark ? AppColors.borderDark : AppColors.border),
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: isAccountLengthValid ? Colors.green : (isDark ? AppColors.primaryLight : AppColors.primary),
                width: 2,
              ),
            ),
            disabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: Colors.grey[400]!),
            ),
          ),
          validator: (value) {
            if (value == null || value.trim().isEmpty) {
              return 'Account number is required';
            }
            return null;
          },
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
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ACCOUNT HOLDER NAME
  // ═══════════════════════════════════════════════════════════════════════

  Widget _buildAccountHolderField(bool isDark, ThemeData theme) {
    return TextFormField(
      controller: _accountHolderController,
      textCapitalization: TextCapitalization.words,
      style: TextStyle(
        color: isDark ? AppColors.textLight : AppColors.textPrimary,
      ),
      decoration: InputDecoration(
        labelText: 'Name as per Bank Account',
        hintText: 'Enter account holder name',
        prefixIcon: Icon(
          Icons.person_rounded,
          color: isDark ? AppColors.primaryLight : AppColors.primary,
        ),
        filled: true,
        fillColor: isDark ? AppColors.surfaceDark : AppColors.surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark ? AppColors.borderDark : AppColors.border,
          ),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark ? AppColors.borderDark : AppColors.border,
          ),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(
            color: isDark ? AppColors.primaryLight : AppColors.primary,
            width: 2,
          ),
        ),
      ),
      validator: (value) {
        if (value == null || value.trim().isEmpty) {
          return 'Account holder name is required';
        }
        if (value.trim().length < 3) {
          return 'Enter a valid name';
        }
        return null;
      },
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // IFSC FINDER MODAL
  // ═══════════════════════════════════════════════════════════════════════

  void _showIfscFinderModal(bool isDark, ThemeData theme) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          height: MediaQuery.of(context).size.height * 0.55,
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
                      _buildInstructionRow('1', 'Click the button below to open IFSC finder', isDark, theme),
                      const SizedBox(height: 12),
                      _buildInstructionRow('2', 'Search by bank name, state, and branch', isDark, theme),
                      const SizedBox(height: 12),
                      _buildInstructionRow('3', 'Copy the IFSC code and enter it here', isDark, theme),
                    ],
                  ),
                ),
              ),
              
              const Spacer(),
              
              // Action Buttons
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  children: [
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        onPressed: () async {
                          final url = Uri.parse('https://razorpay.com/ifsc/');
                          if (await canLaunchUrl(url)) {
                            await launchUrl(url, mode: LaunchMode.externalApplication);
                          }
                        },
                        icon: const Icon(Icons.open_in_new),
                        label: const Text('Open IFSC Finder'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: theme.colorScheme.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Close'),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildInstructionRow(String number, String text, bool isDark, ThemeData theme) {
    return Row(
      children: [
        Container(
          width: 24,
          height: 24,
          decoration: BoxDecoration(
            color: theme.colorScheme.primary,
            shape: BoxShape.circle,
          ),
          child: Center(
            child: Text(number, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            text,
            style: TextStyle(color: isDark ? Colors.white : Colors.black87),
          ),
        ),
      ],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // SAVE BUTTON
  // ═══════════════════════════════════════════════════════════════════════

  Widget _buildSaveButton(bool isDark) {
    final canSave = _selectedBank != null && 
                    _ifscController.text.length == 11 && 
                    _accountNumberController.text.length >= 9 &&
                    _accountHolderController.text.isNotEmpty;
    
    return ElevatedButton(
      onPressed: _isSaving || !canSave ? null : _saveChanges,
      style: ElevatedButton.styleFrom(
        backgroundColor: isDark ? AppColors.primaryLight : AppColors.primary,
        foregroundColor: isDark ? AppColors.textPrimary : AppColors.white,
        padding: const EdgeInsets.symmetric(vertical: 16),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
        elevation: 2,
        disabledBackgroundColor: Colors.grey[400],
      ),
      child: _isSaving
          ? const SizedBox(
              height: 20,
              width: 20,
              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
            )
          : Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: const [
                Icon(Icons.save_rounded, size: 20),
                SizedBox(width: 8),
                Text(
                  'Save Bank Details',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ],
            ),
    );
  }
}
