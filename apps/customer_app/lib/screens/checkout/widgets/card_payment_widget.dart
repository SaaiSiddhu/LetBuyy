// ============================================================
// CARD PAYMENT WIDGET
// Custom card input UI with validation and formatting
// ============================================================

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_services/letbuyy_services.dart';

/// Card Payment Widget - Premium card input form
class CardPaymentWidget extends StatefulWidget {
  final CustomCheckoutService checkoutService;
  final String userName;
  final String userEmail;
  final String userPhone;
  final bool isOrderCreated;

  const CardPaymentWidget({
    super.key,
    required this.checkoutService,
    required this.userName,
    required this.userEmail,
    required this.userPhone,
    required this.isOrderCreated,
  });

  @override
  State<CardPaymentWidget> createState() => _CardPaymentWidgetState();
}

class _CardPaymentWidgetState extends State<CardPaymentWidget> {
  final _formKey = GlobalKey<FormState>();

  final TextEditingController _cardNumberController = TextEditingController();
  final TextEditingController _expiryController = TextEditingController();
  final TextEditingController _cvvController = TextEditingController();
  final TextEditingController _nameController = TextEditingController();

  final FocusNode _cardFocus = FocusNode();
  final FocusNode _expiryFocus = FocusNode();
  final FocusNode _cvvFocus = FocusNode();
  final FocusNode _nameFocus = FocusNode();

  bool _saveCard = false;
  bool _isPaying = false;
  String _cardType = '';
  List<SavedCard> _savedCards = [];
  bool _loadingSavedCards = true;
  String? _selectedSavedCardId;

  @override
  void initState() {
    super.initState();
    _loadSavedCards();
    _cardNumberController.addListener(_detectCardType);
  }

  @override
  void dispose() {
    _cardNumberController.dispose();
    _expiryController.dispose();
    _cvvController.dispose();
    _nameController.dispose();
    _cardFocus.dispose();
    _expiryFocus.dispose();
    _cvvFocus.dispose();
    _nameFocus.dispose();
    super.dispose();
  }

  Future<void> _loadSavedCards() async {
    final cards = await widget.checkoutService.getSavedCards();
    if (mounted) {
      setState(() {
        _savedCards = cards;
        _loadingSavedCards = false;
      });
    }
  }

  void _detectCardType() {
    final number = _cardNumberController.text.replaceAll(' ', '');
    String type = '';

    if (number.startsWith('4')) {
      type = 'visa';
    } else if (number.startsWith('5') || 
               (number.length >= 2 && int.tryParse(number.substring(0, 2)) != null &&
                int.parse(number.substring(0, 2)) >= 51 && 
                int.parse(number.substring(0, 2)) <= 55)) {
      type = 'mastercard';
    } else if (number.startsWith('34') || number.startsWith('37')) {
      type = 'amex';
    } else if (number.startsWith('6') || number.startsWith('81') || number.startsWith('82')) {
      type = 'rupay';
    }

    if (type != _cardType) {
      setState(() => _cardType = type);
    }
  }

  bool _validateLuhn(String number) {
    final digits = number.replaceAll(' ', '');
    if (digits.length < 13 || digits.length > 19) return false;

    int sum = 0;
    bool alternate = false;

    for (int i = digits.length - 1; i >= 0; i--) {
      int n = int.parse(digits[i]);
      if (alternate) {
        n *= 2;
        if (n > 9) n -= 9;
      }
      sum += n;
      alternate = !alternate;
    }

    return sum % 10 == 0;
  }

  Future<void> _payWithCard() async {
    if (!_formKey.currentState!.validate() || !widget.isOrderCreated) return;

    final cardNumber = _cardNumberController.text.replaceAll(' ', '');
    if (!_validateLuhn(cardNumber)) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Invalid card number'),
          backgroundColor: AppColors.error,
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    setState(() => _isPaying = true);
    HapticFeedback.mediumImpact();

    final expiry = _expiryController.text.split('/');
    final expiryMonth = expiry[0].padLeft(2, '0');
    final expiryYear = expiry.length > 1 ? expiry[1] : '';

    await widget.checkoutService.payWithCard(
      cardNumber: cardNumber,
      expiryMonth: expiryMonth,
      expiryYear: expiryYear.length == 2 ? '20$expiryYear' : expiryYear,
      cvv: _cvvController.text,
      cardholderName: _nameController.text.trim(),
      userName: widget.userName,
      userEmail: widget.userEmail,
      userPhone: widget.userPhone,
      saveCard: _saveCard,
    );

    if (mounted) {
      setState(() => _isPaying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Provider.of<ThemeProvider>(context).isDarkMode;
    final accentColor = isDark ? AppColors.primaryLight : AppColors.primary;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Saved Cards Section
          if (_savedCards.isNotEmpty) ...[
            _buildSectionTitle('Saved Cards', Icons.credit_score_rounded, isDark),
            const SizedBox(height: 12),
            _buildSavedCards(isDark, accentColor),
            const SizedBox(height: 24),
            _buildDividerWithText('OR ADD NEW CARD', isDark),
            const SizedBox(height: 24),
          ],

          // New Card Form
          _buildSectionTitle('Card Details', Icons.credit_card_rounded, isDark),
          const SizedBox(height: 16),
          _buildCardForm(isDark, accentColor),

          const SizedBox(height: 20),

          // Save card checkbox
          _buildSaveCardOption(isDark, accentColor),

          const SizedBox(height: 24),

          // Pay button
          _buildPayButton(isDark, accentColor),

          const SizedBox(height: 20),

          // Security badges
          _buildSecurityBadges(isDark),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title, IconData icon, bool isDark) {
    return Row(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: (isDark ? Colors.white : AppColors.primary).withValues(alpha: 0.1),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(
            icon,
            size: 18,
            color: isDark ? Colors.white70 : AppColors.primary,
          ),
        ),
        const SizedBox(width: 12),
        Text(
          title,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: isDark ? Colors.white : Colors.black87,
          ),
        ),
      ],
    );
  }

  Widget _buildSavedCards(bool isDark, Color accentColor) {
    if (_loadingSavedCards) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(20),
          child: CircularProgressIndicator(strokeWidth: 2),
        ),
      );
    }

    return Column(
      children: _savedCards.map((card) {
        final isSelected = _selectedSavedCardId == card.id;

        return GestureDetector(
          onTap: () {
            setState(() {
              _selectedSavedCardId = isSelected ? null : card.id;
            });
            HapticFeedback.selectionClick();
          },
          child: Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: isSelected
                  ? accentColor.withValues(alpha: 0.1)
                  : (isDark ? Colors.grey[850] : Colors.grey[50]),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: isSelected
                    ? accentColor
                    : (isDark ? Colors.grey[800]! : Colors.grey[200]!),
                width: isSelected ? 2 : 1,
              ),
            ),
            child: Row(
              children: [
                // Card icon
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: _getCardColor(card.network).withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(
                    _getCardIcon(card.network),
                    size: 24,
                    color: _getCardColor(card.network),
                  ),
                ),
                const SizedBox(width: 14),

                // Card info
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '•••• •••• •••• ${card.last4}',
                        style: TextStyle(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: isDark ? Colors.white : Colors.black87,
                          letterSpacing: 1,
                        ),
                      ),
                      if (card.cardholderName != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          card.cardholderName!,
                          style: TextStyle(
                            fontSize: 12,
                            color: isDark ? Colors.grey[400] : Colors.grey[600],
                          ),
                        ),
                      ],
                    ],
                  ),
                ),

                // Network badge
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: isDark ? Colors.grey[800] : Colors.grey[100],
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    card.network.toUpperCase(),
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: isDark ? Colors.grey[300] : Colors.grey[700],
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }

  Widget _buildDividerWithText(String text, bool isDark) {
    return Row(
      children: [
        Expanded(
          child: Divider(
            color: isDark ? Colors.grey[700] : Colors.grey[300],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Text(
            text,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: isDark ? Colors.grey[500] : Colors.grey[500],
              letterSpacing: 0.5,
            ),
          ),
        ),
        Expanded(
          child: Divider(
            color: isDark ? Colors.grey[700] : Colors.grey[300],
          ),
        ),
      ],
    );
  }

  Widget _buildCardForm(bool isDark, Color accentColor) {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          // Card Number
          _buildInputField(
            controller: _cardNumberController,
            focusNode: _cardFocus,
            label: 'Card Number',
            hint: '1234 5678 9012 3456',
            icon: _getCardIcon(_cardType),
            iconColor: _cardType.isNotEmpty ? _getCardColor(_cardType) : null,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              _CardNumberFormatter(),
            ],
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Card number is required';
              }
              if (value.replaceAll(' ', '').length < 13) {
                return 'Invalid card number';
              }
              return null;
            },
            onFieldSubmitted: (_) => _expiryFocus.requestFocus(),
            isDark: isDark,
            accentColor: accentColor,
          ),

          const SizedBox(height: 16),

          // Expiry and CVV row
          Row(
            children: [
              // Expiry
              Expanded(
                child: _buildInputField(
                  controller: _expiryController,
                  focusNode: _expiryFocus,
                  label: 'Expiry',
                  hint: 'MM/YY',
                  icon: Icons.calendar_today_rounded,
                  keyboardType: TextInputType.number,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    _ExpiryFormatter(),
                  ],
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Required';
                    }
                    if (!value.contains('/') || value.length < 5) {
                      return 'MM/YY';
                    }
                    return null;
                  },
                  onFieldSubmitted: (_) => _cvvFocus.requestFocus(),
                  isDark: isDark,
                  accentColor: accentColor,
                ),
              ),
              const SizedBox(width: 16),

              // CVV
              Expanded(
                child: _buildInputField(
                  controller: _cvvController,
                  focusNode: _cvvFocus,
                  label: 'CVV',
                  hint: '•••',
                  icon: Icons.lock_outline_rounded,
                  keyboardType: TextInputType.number,
                  obscureText: true,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(4),
                  ],
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Required';
                    }
                    if (value.length < 3) {
                      return 'Invalid';
                    }
                    return null;
                  },
                  onFieldSubmitted: (_) => _nameFocus.requestFocus(),
                  isDark: isDark,
                  accentColor: accentColor,
                ),
              ),
            ],
          ),

          const SizedBox(height: 16),

          // Name on card
          _buildInputField(
            controller: _nameController,
            focusNode: _nameFocus,
            label: 'Name on Card',
            hint: 'John Doe',
            icon: Icons.person_outline_rounded,
            textCapitalization: TextCapitalization.words,
            validator: (value) {
              if (value == null || value.isEmpty) {
                return 'Name is required';
              }
              return null;
            },
            onFieldSubmitted: (_) => _payWithCard(),
            isDark: isDark,
            accentColor: accentColor,
          ),
        ],
      ),
    );
  }

  Widget _buildInputField({
    required TextEditingController controller,
    required FocusNode focusNode,
    required String label,
    required String hint,
    required IconData icon,
    Color? iconColor,
    TextInputType? keyboardType,
    bool obscureText = false,
    List<TextInputFormatter>? inputFormatters,
    String? Function(String?)? validator,
    void Function(String)? onFieldSubmitted,
    TextCapitalization textCapitalization = TextCapitalization.none,
    required bool isDark,
    required Color accentColor,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.grey[400] : Colors.grey[600],
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          focusNode: focusNode,
          keyboardType: keyboardType,
          obscureText: obscureText,
          inputFormatters: inputFormatters,
          textCapitalization: textCapitalization,
          style: TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.white : Colors.black87,
          ),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: TextStyle(
              color: isDark ? Colors.grey[600] : Colors.grey[400],
              fontWeight: FontWeight.w500,
            ),
            prefixIcon: Icon(
              icon,
              size: 20,
              color: iconColor ?? (isDark ? Colors.grey[500] : Colors.grey[500]),
            ),
            filled: true,
            fillColor: isDark ? Colors.grey[850] : Colors.grey[50],
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: isDark ? Colors.grey[700]! : Colors.grey[300]!,
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: accentColor, width: 2),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: AppColors.error),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 14,
            ),
          ),
          validator: validator,
          onFieldSubmitted: onFieldSubmitted,
        ),
      ],
    );
  }

  Widget _buildSaveCardOption(bool isDark, Color accentColor) {
    return GestureDetector(
      onTap: () {
        setState(() => _saveCard = !_saveCard);
        HapticFeedback.selectionClick();
      },
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: _saveCard
              ? accentColor.withValues(alpha: 0.1)
              : (isDark ? Colors.grey[850] : Colors.grey[50]),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: _saveCard
                ? accentColor
                : (isDark ? Colors.grey[800]! : Colors.grey[200]!),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 22,
              height: 22,
              decoration: BoxDecoration(
                color: _saveCard ? accentColor : Colors.transparent,
                borderRadius: BorderRadius.circular(6),
                border: Border.all(
                  color: _saveCard
                      ? accentColor
                      : (isDark ? Colors.grey[600]! : Colors.grey[400]!),
                  width: 2,
                ),
              ),
              child: _saveCard
                  ? const Icon(Icons.check, size: 14, color: Colors.white)
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Save card for future payments',
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: isDark ? Colors.white : Colors.black87,
                    ),
                  ),
                  Text(
                    'Securely store card for faster checkout',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.grey[500] : Colors.grey[600],
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.security_rounded,
              size: 18,
              color: isDark ? Colors.grey[500] : Colors.grey[400],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPayButton(bool isDark, Color accentColor) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: _isPaying ? null : _payWithCard,
        style: ElevatedButton.styleFrom(
          backgroundColor: accentColor,
          foregroundColor: Colors.white,
          disabledBackgroundColor: accentColor.withValues(alpha: 0.5),
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          elevation: 0,
        ),
        child: _isPaying
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation(Colors.white),
                ),
              )
            : const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.lock_rounded, size: 20),
                  SizedBox(width: 10),
                  Text(
                    'Pay Securely',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
              ),
      ),
    );
  }

  Widget _buildSecurityBadges(bool isDark) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _buildBadge('PCI DSS', Icons.verified_user_rounded, Colors.green, isDark),
        const SizedBox(width: 16),
        _buildBadge('256-bit SSL', Icons.https_rounded, Colors.blue, isDark),
        const SizedBox(width: 16),
        _buildBadge('Razorpay', Icons.payment_rounded, Colors.purple, isDark),
      ],
    );
  }

  Widget _buildBadge(String label, IconData icon, Color color, bool isDark) {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: color.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Icon(icon, size: 18, color: color),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w600,
            color: isDark ? Colors.grey[400] : Colors.grey[600],
          ),
        ),
      ],
    );
  }

  IconData _getCardIcon(String network) {
    switch (network.toLowerCase()) {
      case 'visa':
        return Icons.credit_card;
      case 'mastercard':
        return Icons.credit_card;
      case 'amex':
        return Icons.credit_card;
      case 'rupay':
        return Icons.credit_card;
      default:
        return Icons.credit_card_outlined;
    }
  }

  Color _getCardColor(String network) {
    switch (network.toLowerCase()) {
      case 'visa':
        return Colors.blue.shade700;
      case 'mastercard':
        return Colors.orange.shade700;
      case 'amex':
        return Colors.blue.shade900;
      case 'rupay':
        return Colors.green.shade700;
      default:
        return Colors.grey;
    }
  }
}

// ============================================================
// INPUT FORMATTERS
// ============================================================

/// Formats card number with spaces every 4 digits
class _CardNumberFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final text = newValue.text.replaceAll(' ', '');
    final buffer = StringBuffer();

    for (int i = 0; i < text.length && i < 16; i++) {
      if (i > 0 && i % 4 == 0) {
        buffer.write(' ');
      }
      buffer.write(text[i]);
    }

    return TextEditingValue(
      text: buffer.toString(),
      selection: TextSelection.collapsed(offset: buffer.length),
    );
  }
}

/// Formats expiry date as MM/YY
class _ExpiryFormatter extends TextInputFormatter {
  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final text = newValue.text.replaceAll('/', '');
    final buffer = StringBuffer();

    for (int i = 0; i < text.length && i < 4; i++) {
      if (i == 2) {
        buffer.write('/');
      }
      buffer.write(text[i]);
    }

    return TextEditingValue(
      text: buffer.toString(),
      selection: TextSelection.collapsed(offset: buffer.length),
    );
  }
}
