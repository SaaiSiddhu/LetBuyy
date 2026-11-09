import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Selects an existing native picker action. Callers retain media/upload scope.
Future<ImageSource?> showImageSourceSheet(
  BuildContext context, {
  String title = 'Choose image source',
}) async {
  if (!isLetbuyySurfaceCurrent(context)) return null;
  final owner = ModalRoute.of(context);
  final selected = await showLetbuyyFormSheet<ImageSource>(
    context: context,
    builder: (sheetContext) => LetbuyyFormSheet(
      title: title,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined),
            title: const Text('Take photo'),
            onTap: () =>
                completeLetbuyySurface(sheetContext, ImageSource.camera),
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: const Text('Photo library'),
            onTap: () =>
                completeLetbuyySurface(sheetContext, ImageSource.gallery),
          ),
        ],
      ),
    ),
  );
  if (!context.mounted || owner?.isCurrent != true) return null;
  return selected;
}
