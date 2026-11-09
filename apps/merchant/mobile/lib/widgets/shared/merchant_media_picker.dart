import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:letbuyy_models/letbuyy_models.dart' show PublicMediaUpload;
import 'package:provider/provider.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import '../../services/native_media_selection.dart';
import '../../services/api_client.dart' show ApiException, JsonMap;
import '../../services/security_command_store.dart'
    show MerchantSecurityContext;

enum _SelectionChoice { keep, discard, use }

Future<bool> reviewMerchantMediaSelection(
  BuildContext context,
  NativeMediaSelection selection,
  String purpose,
) async {
  final choice = await showLetbuyyFormSheet<_SelectionChoice>(
    context: context,
    builder: (sheetContext) => AnimatedBuilder(
      animation: selection,
      builder: (context, _) => LetbuyyFormSheet(
        title: 'Review previous file selection',
        actions: [
          TextButton(
            onPressed: () =>
                completeLetbuyySurface(sheetContext, _SelectionChoice.keep),
            child: const Text('Keep for later'),
          ),
          if (selection.belongsToCurrentOwner)
            TextButton(
              onPressed: () => completeLetbuyySurface(
                sheetContext,
                _SelectionChoice.discard,
              ),
              child: const Text('Discard selection'),
            ),
          if (selection.canRecover && selection.purpose == purpose)
            FilledButton(
              onPressed: () =>
                  completeLetbuyySurface(sheetContext, _SelectionChoice.use),
              child: const Text('Use saved file'),
            ),
        ],
        child: Text(
          !selection.belongsToCurrentOwner
              ? 'Return to the account and store that started this selection. Its file will not be used here.'
              : selection.purpose != purpose
              ? 'Return to the original upload purpose to use this selection, or discard it before choosing another file.'
              : selection.canRecover
              ? 'Continue with the saved file for this account, store and upload purpose. Using it continues the original upload request.'
              : 'The interrupted picker did not return a usable file. Discard this selection, then choose the original file again.',
        ),
      ),
    ),
  );
  if (!context.mounted) return false;
  if (choice == _SelectionChoice.discard) await selection.discard();
  return choice == _SelectionChoice.use;
}

/// Native cancellation is silent; denied or unavailable sources remain retryable.
Future<XFile?> pickMerchantMedia(
  BuildContext context, {
  required ImageSource source,
  required String purpose,
  required Future<XFile?> Function() pick,
  String kind = 'image',
  bool imagePickerSource = true,
  int maxBytes = PublicMediaUpload.imageLimitBytes,
  JsonMap draft = const {},
  NativeMediaSelection? selection,
  MerchantSecurityContext? expectedContext,
  String? sourceLabel,
}) async {
  if (!context.mounted) return null;
  try {
    final recovery = selection ?? context.read<NativeMediaSelection>();
    final owner = expectedContext ?? recovery.captureContext();
    await recovery.initialize();
    recovery.requireContext(owner);
    if (!context.mounted) return null;
    final XFile? file;
    if (recovery.hasSelection) {
      if (!await reviewMerchantMediaSelection(context, recovery, purpose))
        return null;
      recovery.requireContext(owner);
      file = await recovery.recover(purpose);
    } else {
      file = await recovery.pick(
        purpose: purpose,
        kind: kind,
        imagePickerSource: imagePickerSource,
        maxBytes: maxBytes,
        draft: draft,
        pick: pick,
      );
    }
    recovery.requireContext(owner);
    return context.mounted ? file : null;
  } catch (error) {
    if (!context.mounted) return null;
    final name =
        sourceLabel ??
        (source == ImageSource.camera ? 'camera' : 'photo library');
    final unavailableCamera =
        source == ImageSource.camera &&
        error is PlatformException &&
        ['no_available_camera', 'camera_unavailable'].contains(error.code);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          error is ApiException && error.code == 'NATIVE_SELECTION_PENDING'
              ? error.message
              : unavailableCamera
              ? 'Camera is unavailable on this device. Choose media from the library instead.'
              : sourceLabel == 'files'
              ? 'Could not open files. Check the file provider, then try again.'
              : 'Could not open $name. Check its permission in Settings, then try again.',
        ),
        duration: const Duration(seconds: 8),
      ),
    );
    debugPrint('Merchant media picker failed: ${error.runtimeType}');
    return null;
  }
}
