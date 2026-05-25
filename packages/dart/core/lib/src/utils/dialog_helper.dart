import 'package:flutter/material.dart';

class _CoreDialogColors {
  static const Color primary = Color(0xFF00B3B3);
  static const Color success = Color(0xFFA4E500);
  static const Color error = Color(0xFFB02525);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color textSecondary = Color(0xFF4A5568);
}

class _CoreDialogTextStyles {
  static const TextStyle headlineMedium = TextStyle(
    fontSize: 20,
    fontWeight: FontWeight.w600,
    color: Color(0xFF1A1A2E),
    height: 1.3,
  );

  static const TextStyle bodyMedium = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.normal,
    color: Color(0xFF1A1A2E),
    height: 1.5,
  );

  static const TextStyle buttonMedium = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.5,
  );
}

class DialogHelper {
  // Show confirmation dialog
  static Future<bool?> showConfirmation(
    BuildContext context, {
    required String title,
    required String message,
    String confirmText = 'Confirm',
    String cancelText = 'Cancel',
    Color? confirmColor,
    bool isDangerous = false,
  }) async {
    return showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(title, style: _CoreDialogTextStyles.headlineMedium),
        content: Text(message, style: _CoreDialogTextStyles.bodyMedium),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: Text(
              cancelText,
              style: _CoreDialogTextStyles.buttonMedium.copyWith(
                color: _CoreDialogColors.textSecondary,
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: isDangerous
                  ? _CoreDialogColors.error
                  : (confirmColor ?? _CoreDialogColors.primary),
            ),
            child: Text(confirmText),
          ),
        ],
      ),
    );
  }

  // Show delete confirmation
  static Future<bool?> showDeleteConfirmation(
    BuildContext context, {
    required String itemName,
    String title = 'Delete Confirmation',
  }) async {
    return showConfirmation(
      context,
      title: title,
      message:
          'Are you sure you want to delete "$itemName"? This action cannot be undone.',
      confirmText: 'Delete',
      cancelText: 'Cancel',
      isDangerous: true,
    );
  }

  // Show info dialog
  static Future<void> showInfo(
    BuildContext context, {
    required String title,
    required String message,
    String buttonText = 'OK',
  }) async {
    return showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(title, style: _CoreDialogTextStyles.headlineMedium),
        content: Text(message, style: _CoreDialogTextStyles.bodyMedium),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(buttonText),
          ),
        ],
      ),
    );
  }

  // Show error dialog
  static Future<void> showError(
    BuildContext context, {
    String title = 'Error',
    required String message,
    String buttonText = 'OK',
  }) async {
    return showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(Icons.error, color: _CoreDialogColors.error, size: 28),
            const SizedBox(width: 12),
            Text(
              title,
              style: _CoreDialogTextStyles.headlineMedium.copyWith(
                color: _CoreDialogColors.error,
              ),
            ),
          ],
        ),
        content: Text(message, style: _CoreDialogTextStyles.bodyMedium),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(),
            style: ElevatedButton.styleFrom(
              backgroundColor: _CoreDialogColors.error,
            ),
            child: Text(buttonText),
          ),
        ],
      ),
    );
  }

  // Show success dialog
  static Future<void> showSuccess(
    BuildContext context, {
    String title = 'Success',
    required String message,
    String buttonText = 'OK',
  }) async {
    return showDialog(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(
              Icons.check_circle,
              color: _CoreDialogColors.success,
              size: 28,
            ),
            const SizedBox(width: 12),
            Text(
              title,
              style: _CoreDialogTextStyles.headlineMedium.copyWith(
                color: _CoreDialogColors.success,
              ),
            ),
          ],
        ),
        content: Text(message, style: _CoreDialogTextStyles.bodyMedium),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.of(context).pop(),
            style: ElevatedButton.styleFrom(
              backgroundColor: _CoreDialogColors.success,
            ),
            child: Text(buttonText),
          ),
        ],
      ),
    );
  }

  // Show loading dialog
  static void showLoading(
    BuildContext context, {
    String message = 'Loading...',
  }) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => PopScope(
        canPop: false,
        child: AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const CircularProgressIndicator(),
              const SizedBox(height: 16),
              Text(
                message,
                style: _CoreDialogTextStyles.bodyMedium,
                textAlign: TextAlign.center,
              ),
            ],
          ),
        ),
      ),
    );
  }

  // Hide loading dialog
  static void hideLoading(BuildContext context) {
    Navigator.of(context, rootNavigator: true).pop();
  }

  // Show input dialog
  static Future<String?> showInput(
    BuildContext context, {
    required String title,
    String? hint,
    String? initialValue,
    String confirmText = 'OK',
    String cancelText = 'Cancel',
    TextInputType keyboardType = TextInputType.text,
    int? maxLength,
    String? Function(String?)? validator,
  }) async {
    final controller = TextEditingController(text: initialValue);
    final formKey = GlobalKey<FormState>();

    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(title, style: _CoreDialogTextStyles.headlineMedium),
        content: Form(
          key: formKey,
          child: TextFormField(
            controller: controller,
            autofocus: true,
            keyboardType: keyboardType,
            maxLength: maxLength,
            decoration: InputDecoration(hintText: hint, counterText: ''),
            validator: validator,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text(
              cancelText,
              style: _CoreDialogTextStyles.buttonMedium.copyWith(
                color: _CoreDialogColors.textSecondary,
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              if (formKey.currentState?.validate() ?? false) {
                Navigator.of(context).pop(controller.text);
              }
            },
            child: Text(confirmText),
          ),
        ],
      ),
    );
  }

  // Show choice dialog (radio buttons)
  static Future<int?> showChoice(
    BuildContext context, {
    required String title,
    required List<String> options,
    int? selectedIndex,
  }) async {
    return showDialog<int>(
      context: context,
      builder: (context) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text(title, style: _CoreDialogTextStyles.headlineMedium),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: options.asMap().entries.map((entry) {
            return RadioListTile<int>(
              title: Text(entry.value),
              value: entry.key,
              groupValue: selectedIndex,
              onChanged: (value) {
                Navigator.of(context).pop(value);
              },
            );
          }).toList(),
        ),
      ),
    );
  }

  // Show bottom sheet dialog
  static Future<T?> showBottomSheet<T>(
    BuildContext context, {
    required Widget child,
    bool isDismissible = true,
    bool enableDrag = true,
  }) async {
    return showModalBottomSheet<T>(
      context: context,
      isDismissible: isDismissible,
      enableDrag: enableDrag,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => Container(
        decoration: const BoxDecoration(
          color: _CoreDialogColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        child: child,
      ),
    );
  }

  // Show custom dialog
  static Future<T?> showCustom<T>(
    BuildContext context, {
    required Widget child,
    bool barrierDismissible = true,
  }) async {
    return showDialog<T>(
      context: context,
      barrierDismissible: barrierDismissible,
      builder: (context) => child,
    );
  }
}
