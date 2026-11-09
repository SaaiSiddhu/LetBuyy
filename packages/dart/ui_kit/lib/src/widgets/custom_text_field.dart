// lib/widgets/common/custom_text_field.dart

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../tokens/letbuyy_tokens.dart';

/// Native editing with the host's theme, persistent labels and validation.
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
  final Iterable<String>? autofillHints;
  final AutovalidateMode autovalidateMode;

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
    this.autofillHints,
    this.autovalidateMode = AutovalidateMode.disabled,
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
  void didUpdateWidget(CustomTextField oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.focusNode != widget.focusNode) {
      _focusNode.removeListener(_handleFocusChange);
      if (oldWidget.focusNode == null) _focusNode.dispose();
      _focusNode = widget.focusNode ?? FocusNode();
      _focusNode.addListener(_handleFocusChange);
      _isFocused = _focusNode.hasFocus;
    }
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller?.removeListener(_validateInternal);
      widget.controller?.addListener(_validateInternal);
      _isValid = false;
      _internalError = null;
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
    final theme = Theme.of(context), scheme = theme.colorScheme;
    final hasError = widget.errorText != null || _internalError != null;
    final success = theme.brightness == Brightness.dark
        ? LetbuyyPrimitiveTokens.green500
        : LetbuyyPrimitiveTokens.green700;
    final accent = theme.brightness == Brightness.dark
        ? LetbuyyColorTokens.primaryTextDark
        : LetbuyyColorTokens.primaryTextLight;
    final iconColor = hasError
        ? scheme.error
        : _isFocused
        ? accent
        : widget.showSuccessState && _isValid
        ? success
        : scheme.onSurfaceVariant;
    final radius = BorderRadius.circular(LetbuyyRadiusTokens.lg * 1.0);
    Widget supportingCopy(String text, {required bool error}) => Text(
      text,
      softWrap: true,
      overflow: TextOverflow.visible,
      style: theme.textTheme.bodySmall?.copyWith(
        color: error ? scheme.error : scheme.onSurfaceVariant,
      ),
    );
    // Keep the native input target inside this field. Otherwise Flutter may
    // merge preceding record copy into its unfocused accessibility rectangle.
    return Semantics(
      container: true,
      child: TextFormField(
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
        autofillHints: widget.autofillHints,
        autovalidateMode: widget.autovalidateMode,
        autocorrect: widget.autocorrect,
        textAlign: widget.textAlign,
        // Widget error presentation preserves native FormField validation and its
        // precedence over an explicit caption, without InputDecorator ellipsis.
        errorBuilder: (_, error) => supportingCopy(error, error: true),
        style: theme.textTheme.bodyLarge?.copyWith(color: scheme.onSurface),
        cursorColor: accent,
        decoration: InputDecoration(
          labelText: widget.showLabel ? widget.label : null,
          floatingLabelBehavior: FloatingLabelBehavior.always,
          floatingLabelStyle: TextStyle(
            color: hasError ? scheme.error : accent,
          ),
          hintText: widget.hint,
          helper: widget.helperText == null
              ? null
              : supportingCopy(widget.helperText!, error: false),
          error: widget.errorText == null
              ? null
              : supportingCopy(widget.errorText!, error: true),
          filled: true,
          fillColor:
              widget.fillColor ??
              (widget.isGlass
                  ? scheme.surface.withValues(alpha: 0.8)
                  : scheme.surface),
          contentPadding:
              widget.contentPadding ??
              const EdgeInsets.all(LetbuyySpacingTokens.space16),
          prefixIcon: widget.prefixIcon == null
              ? null
              : Icon(widget.prefixIcon, color: iconColor),
          suffixIcon:
              widget.suffixIcon ??
              (widget.showSuccessState && _isValid && !hasError
                  ? Icon(Icons.check_circle_rounded, color: success)
                  : null),
          border: OutlineInputBorder(borderRadius: radius),
          enabledBorder: OutlineInputBorder(
            borderRadius: radius,
            borderSide: BorderSide(color: scheme.outline),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: radius,
            borderSide: BorderSide(color: accent, width: 2),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: radius,
            borderSide: BorderSide(color: scheme.error),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: radius,
            borderSide: BorderSide(color: scheme.error, width: 2),
          ),
          disabledBorder: OutlineInputBorder(
            borderRadius: radius,
            borderSide: BorderSide(color: scheme.outlineVariant),
          ),
          hintStyle: theme.textTheme.bodyMedium?.copyWith(
            color: scheme.onSurfaceVariant,
          ),
          helperStyle: theme.textTheme.bodySmall?.copyWith(
            color: scheme.onSurfaceVariant,
          ),
          errorStyle: theme.textTheme.bodySmall?.copyWith(color: scheme.error),
        ),
        validator: (value) {
          final error = widget.validator?.call(value);
          if (_internalError != error) {
            WidgetsBinding.instance.addPostFrameCallback((_) {
              if (mounted) setState(() => _internalError = error);
            });
          }
          return error;
        },
        onChanged: (value) {
          widget.onChanged?.call(value);
          if (_internalError != null) setState(() => _internalError = null);
        },
        onFieldSubmitted: widget.onSubmitted,
        onTap: widget.onTap,
        onEditingComplete: widget.onEditingComplete,
      ),
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
          color: Theme.of(context).colorScheme.onSurfaceVariant,
          size: 20,
        ),
        onPressed: () => setState(() => _obscure = !_obscure),
      ),
    );
  }
}
