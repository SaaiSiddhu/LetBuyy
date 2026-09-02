// lib/widgets/common/custom_text_field.dart

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../themes/app_colors.dart';
import '../themes/app_text_styles.dart';

/// A professional, high-performance text field strictly aligned with AppColors.
/// Features internal state management for focus, error, and success visual feedback.
class CustomTextField extends StatefulWidget {
  final TextEditingController? controller;
  final String? label;
  final String? hint;
  final String? initialValue;
  final String? helperText;
  final IconData? prefixIcon;
  final Widget? suffixIcon;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final bool obscureText;
  final bool readOnly;
  final bool enabled;
  final bool autofocus;
  final bool enableSuggestions;
  final bool autocorrect;
  final int? maxLines;
  final int? minLines;
  final int? maxLength;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final void Function(String)? onSubmitted;
  final void Function()? onTap;
  final void Function()? onEditingComplete;
  final List<TextInputFormatter>? inputFormatters;
  final TextCapitalization textCapitalization;
  final FocusNode? focusNode;
  final EdgeInsetsGeometry? contentPadding;
  final Color? fillColor;
  final bool showLabel;
  final bool showSuccessState;
  final TextAlign textAlign;
  final String? errorText;
  final bool isGlass;

  const CustomTextField({
    super.key,
    this.controller,
    this.label,
    this.hint,
    this.initialValue,
    this.helperText,
    this.prefixIcon,
    this.suffixIcon,
    this.keyboardType,
    this.textInputAction,
    this.obscureText = false,
    this.readOnly = false,
    this.enabled = true,
    this.autofocus = false,
    this.enableSuggestions = true,
    this.autocorrect = true,
    this.maxLines = 1,
    this.minLines,
    this.maxLength,
    this.validator,
    this.onChanged,
    this.onSubmitted,
    this.onTap,
    this.onEditingComplete,
    this.inputFormatters,
    this.textCapitalization = TextCapitalization.none,
    this.focusNode,
    this.contentPadding,
    this.fillColor,
    this.showLabel = true,
    this.showSuccessState = false,
    this.textAlign = TextAlign.start,
    this.errorText,
    this.isGlass = false,
  });

  @override
  State<CustomTextField> createState() => _CustomTextFieldState();
}

class _CustomTextFieldState extends State<CustomTextField> {
  late FocusNode _focusNode;
  bool _isFocused = false;
  bool _isValid = false;
  String? _internalError;

  @override
  void initState() {
    super.initState();
    _focusNode = widget.focusNode ?? FocusNode();
    _focusNode.addListener(_handleFocusChange);

    // Listen to controller to update success state dynamically
    if (widget.controller != null) {
      widget.controller!.addListener(_validateInternal);
    }
  }

  @override
  void dispose() {
    if (widget.focusNode == null) {
      _focusNode.dispose();
    } else {
      _focusNode.removeListener(_handleFocusChange);
    }
    if (widget.controller != null) {
      widget.controller!.removeListener(_validateInternal);
    }
    super.dispose();
  }

  void _handleFocusChange() {
    if (mounted) {
      setState(() {
        _isFocused = _focusNode.hasFocus;
      });
    }
  }

  void _validateInternal() {
    // Only run logic if we have a validator
    if (widget.validator == null || widget.controller == null) return;

    final text = widget.controller!.text;
    
    // Reset state if empty
    if (text.isEmpty) {
      if (_isValid) setState(() => _isValid = false);
      return;
    }

    // Check validation
    final error = widget.validator!(text);
    final newIsValid = error == null;

    if (_isValid != newIsValid) {
      setState(() {
        _isValid = newIsValid;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Determine current error state (External or Internal)
    final hasError = widget.errorText != null || _internalError != null;
    
    // --- Color Logic based on AppColors ---
    Color getBorderColor() {
      if (hasError) return AppColors.error;
      if (_isFocused) return AppColors.primary;
      if (widget.showSuccessState && _isValid) return AppColors.success.withValues(alpha: 0.6);
      return AppColors.border; // Default subtle border
    }

    Color getIconColor() {
      if (hasError) return AppColors.error;
      if (_isFocused) return AppColors.primary;
      if (widget.showSuccessState && _isValid) return AppColors.success;
      return AppColors.textSecondary; // Muted Teal
    }


    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        // 1. Floating Header Label
        if (widget.showLabel && widget.label != null) ...[
          Padding(
            padding: const EdgeInsets.only(left: 2, bottom: 6),
            child: Text(
              widget.label!,
              style: AppTextStyles.labelLarge.copyWith(
                fontWeight: FontWeight.w600,
                color: hasError 
                    ? AppColors.error 
                    : _isFocused 
                        ? AppColors.primary 
                        : AppColors.textPrimary,
              ),
            ),
          ),
        ],

        // 2. The Input Field
        TextFormField(
          controller: widget.controller,
          initialValue: widget.initialValue,
          focusNode: _focusNode,
          autofocus: widget.autofocus,
          enabled: widget.enabled,
          readOnly: widget.readOnly,
          obscureText: widget.obscureText,
          keyboardType: widget.keyboardType,
          textInputAction: widget.textInputAction,
          textCapitalization: widget.textCapitalization,
          maxLines: widget.maxLines,
          minLines: widget.minLines,
          maxLength: widget.maxLength,
          inputFormatters: widget.inputFormatters,
          enableSuggestions: widget.enableSuggestions,
          autocorrect: widget.autocorrect,
          textAlign: widget.textAlign,
          
          // Typography
          style: AppTextStyles.bodyLarge.copyWith(
            fontWeight: FontWeight.w500,
            color: widget.enabled ? AppColors.textPrimary : AppColors.textDisabled,
          ),
          cursorColor: AppColors.primary,
          
          // Decoration
            decoration: InputDecoration(
            hintText: widget.hint,
            helperText: widget.helperText,
            errorText: widget.errorText, // Passed from parent
            filled: true,
            fillColor: widget.isGlass
                ? (Theme.of(context).brightness == Brightness.dark
                    ? AppColors.surfaceGlassDark
                    : AppColors.surfaceGlass)
                : (widget.fillColor ?? (widget.enabled ? AppColors.surface : AppColors.background)),
            
            // Spacing
            contentPadding: widget.contentPadding ?? 
                const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            
            // Icons
            prefixIcon: widget.prefixIcon != null
                ? Icon(widget.prefixIcon, color: getIconColor(), size: 22)
                : null,
            
            suffixIcon: widget.suffixIcon ?? (widget.showSuccessState && _isValid && !hasError
                ? const Icon(Icons.check_circle_rounded, color: AppColors.success, size: 22)
                : null),

            // Border Styles
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: widget.isGlass ? BorderSide.none : const BorderSide(color: AppColors.border),
            ),
            
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: widget.isGlass
                  ? BorderSide(color: Colors.white.withValues(alpha: 0.1), width: 1.0)
                  : BorderSide(
                      color: getBorderColor(),
                      width: 1.0,
                    ),
            ),
            
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(
                color: AppColors.primary,
                width: 1.5,
              ),
            ),
            
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.error, width: 1.0),
            ),
            
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: AppColors.error, width: 1.5),
            ),
            
            disabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: widget.isGlass 
                  ? BorderSide.none
                  : const BorderSide(color: AppColors.borderLight),
            ),
            
            // Text Styles within Input
            hintStyle: AppTextStyles.bodyMedium.copyWith(
              color: widget.isGlass 
                   ? (Theme.of(context).brightness == Brightness.dark ? Colors.white60 : Colors.black54)
                   : AppColors.textHint,
            ),
            helperStyle: AppTextStyles.labelSmall.copyWith(
              color: AppColors.textSecondary,
            ),
            errorStyle: AppTextStyles.labelSmall.copyWith(
              color: AppColors.error,
              fontWeight: FontWeight.w500,
            ),
          ),
          
          // Validation Hook
          validator: (value) {
            final error = widget.validator?.call(value);
            // Update internal state safely
            if (_internalError != error) {
              WidgetsBinding.instance.addPostFrameCallback((_) {
                if (mounted) setState(() => _internalError = error);
              });
            }
            return error;
          },
          
          onChanged: (val) {
             widget.onChanged?.call(val);
             if (_internalError != null) {
               setState(() => _internalError = null);
             }
          },
          onFieldSubmitted: widget.onSubmitted,
          onTap: widget.onTap,
          onEditingComplete: widget.onEditingComplete,
        ),
      ],
    );
  }
}

// ========================================
// PRE-CONFIGURED VARIANTS
// ========================================

class EmailTextField extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode? focusNode;
  final TextInputAction textInputAction;
  final bool enabled;

  const EmailTextField({
    super.key,
    required this.controller,
    this.focusNode,
    this.textInputAction = TextInputAction.next,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    return CustomTextField(
      controller: controller,
      label: 'Email Address',
      hint: 'name@example.com',
      prefixIcon: Icons.email_outlined,
      keyboardType: TextInputType.emailAddress,
      textInputAction: textInputAction,
      focusNode: focusNode,
      enabled: enabled,
      // Standard email regex validation
      validator: (value) {
        if (value == null || value.isEmpty) return 'Email address is required';
        final emailRegex = RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$');
        if (!emailRegex.hasMatch(value)) {
          return 'Please enter a valid email address';
        }
        return null;
      },
    );
  }
}

class PasswordTextField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final String hint;
  final FocusNode? focusNode;
  final TextInputAction textInputAction;
  final String? Function(String?)? validator;
  final bool enabled;

  const PasswordTextField({
    super.key,
    required this.controller,
    this.label = 'Password',
    this.hint = '••••••••',
    this.focusNode,
    this.textInputAction = TextInputAction.done,
    this.validator,
    this.enabled = true,
  });

  @override
  State<PasswordTextField> createState() => _PasswordTextFieldState();
}

class _PasswordTextFieldState extends State<PasswordTextField> {
  bool _obscure = true;

  @override
  Widget build(BuildContext context) {
    return CustomTextField(
      controller: widget.controller,
      label: widget.label,
      hint: widget.hint,
      enabled: widget.enabled,
      prefixIcon: Icons.lock_outline_rounded,
      obscureText: _obscure,
      focusNode: widget.focusNode,
      textInputAction: widget.textInputAction,
      validator: widget.validator,
      maxLines: 1,
      suffixIcon: IconButton(
        icon: Icon(
          _obscure ? Icons.visibility_outlined : Icons.visibility_off_outlined,
          color: _obscure ? AppColors.textHint : AppColors.primary,
          size: 20,
        ),
        onPressed: () => setState(() => _obscure = !_obscure),
      ),
    );
  }
}