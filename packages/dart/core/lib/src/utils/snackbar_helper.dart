// lib/core/utils/snackbar_helper.dart
import 'package:flutter/material.dart';

class _CoreSnackbarColors {
  static const Color success = Color(0xFFA4E500);
  static const Color error = Color(0xFFB02525);
  static const Color warning = Color(0xFFFBBF24);
  static const Color info = Color(0xFF00B3B3);
  static const Color textPrimary = Color(0xFF1A1A2E);
}

class _CoreSnackbarTextStyles {
  static const TextStyle bodyMedium = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.normal,
    color: Color(0xFF1A1A2E),
    height: 1.5,
  );
}

class SnackbarHelper {
  // Small helper: safely get a ScaffoldMessengerState without throwing.
  static ScaffoldMessengerState? _safeMessenger(BuildContext ctx) {
    try {
      // maybeOf may still attempt ancestor lookup on a deactivated context and throw.
      // Wrap in try/catch so we never bubble that to the app.
      return ScaffoldMessenger.maybeOf(ctx);
    } catch (e) {
      // If the context is deactivated or ancestor lookup fails, return null.
      return null;
    }
  }

  static void _showSnackBarSafe(BuildContext context, SnackBar snack) {
    final messenger = _safeMessenger(context);
    if (messenger == null) return;
    try {
      messenger.hideCurrentSnackBar();
      messenger.showSnackBar(snack);
    } catch (_) {
      // swallow any exceptions: don't crash the app for snackbar failures
      // (common when widget tree is being disposed)
    }
  }

  static void showSuccess(BuildContext context, String message) {
    final snack = SnackBar(
      content: Row(
        children: [
          const Icon(Icons.check_circle, color: Colors.white),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: _CoreSnackbarTextStyles.bodyMedium.copyWith(
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
      backgroundColor: _CoreSnackbarColors.success,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
      duration: const Duration(seconds: 3),
    );

    _showSnackBarSafe(context, snack);
  }

  static void showError(BuildContext context, String message) {
    final snack = SnackBar(
      content: Row(
        children: [
          const Icon(Icons.error, color: Colors.white),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: _CoreSnackbarTextStyles.bodyMedium.copyWith(
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
      backgroundColor: _CoreSnackbarColors.error,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
      duration: const Duration(seconds: 4),
    );

    _showSnackBarSafe(context, snack);
  }

  static void showWarning(BuildContext context, String message) {
    final snack = SnackBar(
      content: Row(
        children: [
          const Icon(Icons.warning, color: Colors.black),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: _CoreSnackbarTextStyles.bodyMedium.copyWith(
                color: Colors.black,
              ),
            ),
          ),
        ],
      ),
      backgroundColor: _CoreSnackbarColors.warning,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
      duration: const Duration(seconds: 3),
    );

    _showSnackBarSafe(context, snack);
  }

  static void showInfo(BuildContext context, String message) {
    final snack = SnackBar(
      content: Row(
        children: [
          const Icon(Icons.info, color: Colors.white),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              message,
              style: _CoreSnackbarTextStyles.bodyMedium.copyWith(
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
      backgroundColor: _CoreSnackbarColors.info,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
      duration: const Duration(seconds: 3),
    );

    _showSnackBarSafe(context, snack);
  }

  static void showCustom(
    BuildContext context,
    String message, {
    Color? backgroundColor,
    IconData? icon,
    Color? iconColor,
    Duration duration = const Duration(seconds: 3),
    SnackBarAction? action,
  }) {
    final snack = SnackBar(
      content: Row(
        children: [
          if (icon != null) ...[
            Icon(icon, color: iconColor ?? Colors.white),
            const SizedBox(width: 12),
          ],
          Expanded(
            child: Text(
              message,
              style: _CoreSnackbarTextStyles.bodyMedium.copyWith(
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
      backgroundColor: backgroundColor ?? _CoreSnackbarColors.textPrimary,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
      duration: duration,
      action: action,
    );

    _showSnackBarSafe(context, snack);
  }

  static void showWithAction(
    BuildContext context,
    String message,
    String actionLabel,
    VoidCallback onAction, {
    Color? backgroundColor,
  }) {
    final snack = SnackBar(
      content: Text(
        message,
        style: _CoreSnackbarTextStyles.bodyMedium.copyWith(color: Colors.white),
      ),
      backgroundColor: backgroundColor ?? _CoreSnackbarColors.textPrimary,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
      duration: const Duration(seconds: 4),
      action: SnackBarAction(
        label: actionLabel,
        textColor: Colors.white,
        onPressed: onAction,
      ),
    );

    _showSnackBarSafe(context, snack);
  }

  static void showLoading(BuildContext context, String message) {
    final snack = SnackBar(
      content: Row(
        children: [
          const SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              message,
              style: _CoreSnackbarTextStyles.bodyMedium.copyWith(
                color: Colors.white,
              ),
            ),
          ),
        ],
      ),
      backgroundColor: _CoreSnackbarColors.textPrimary,
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      margin: const EdgeInsets.all(16),
      duration: const Duration(days: 365), // Long duration for loading
    );

    _showSnackBarSafe(context, snack);
  }

  static void hide(BuildContext context) {
    try {
      final messenger = _safeMessenger(context);
      messenger?.hideCurrentSnackBar();
    } catch (_) {
      // ignore
    }
  }

  static void clearAll(BuildContext context) {
    try {
      final messenger = _safeMessenger(context);
      messenger?.clearSnackBars();
    } catch (_) {
      // ignore
    }
  }
}
