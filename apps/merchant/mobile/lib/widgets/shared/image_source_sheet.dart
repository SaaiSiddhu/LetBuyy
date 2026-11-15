import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

enum MerchantMediaSource { camera, library, files }

/// Native source choice; callers retain their actor/store/upload ownership.
Future<MerchantMediaSource?> showMerchantMediaSourceSheet(
  BuildContext context, {
  required String title,
  bool video = false,
  bool allowFiles = false,
  bool allowCamera = true,
}) async {
  if (!isLetbuyySurfaceCurrent(context)) return null;
  final owner = ModalRoute.of(context);
  final selected = await showLetbuyyFormSheet<MerchantMediaSource>(
    context: context,
    builder: (sheetContext) => LetbuyyFormSheet(
      title: title,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (allowCamera)
            ListTile(
              leading: Icon(
                video ? Icons.videocam_outlined : Icons.photo_camera_outlined,
              ),
              title: Text(video ? 'Record video' : 'Take photo'),
              onTap: () => completeLetbuyySurface(
                sheetContext,
                MerchantMediaSource.camera,
              ),
            ),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: Text(video ? 'Video library' : 'Photo library'),
            onTap: () => completeLetbuyySurface(
              sheetContext,
              MerchantMediaSource.library,
            ),
          ),
          if (allowFiles)
            ListTile(
              leading: const Icon(Icons.folder_open_outlined),
              title: const Text('Files'),
              onTap: () => completeLetbuyySurface(
                sheetContext,
                MerchantMediaSource.files,
              ),
            ),
        ],
      ),
    ),
  );
  if (!context.mounted || owner?.isCurrent != true) return null;
  return selected;
}

/// Existing image callers retain their two native actions and return contract.
Future<ImageSource?> showImageSourceSheet(
  BuildContext context, {
  String title = 'Choose image source',
}) async {
  final result = await showMerchantMediaSourceSheet(context, title: title);
  return switch (result) {
    MerchantMediaSource.camera => ImageSource.camera,
    MerchantMediaSource.library => ImageSource.gallery,
    _ => null,
  };
}
