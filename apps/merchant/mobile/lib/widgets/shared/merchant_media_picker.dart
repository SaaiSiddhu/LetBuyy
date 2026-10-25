import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

/// Native cancellation is silent; denied or unavailable sources remain retryable.
Future<XFile?> pickMerchantMedia(
  BuildContext context, {
  required ImageSource source,
  required Future<XFile?> Function() pick,
}) async {
  if (!context.mounted) return null;
  try {
    final file = await pick();
    return context.mounted ? file : null;
  } catch (error) {
    if (!context.mounted) return null;
    final name = source == ImageSource.camera ? 'camera' : 'photo library';
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          'Could not open $name. Check its permission in Settings, then try again.',
        ),
        duration: const Duration(seconds: 8),
      ),
    );
    debugPrint('Merchant media picker failed: ${error.runtimeType}');
    return null;
  }
}
