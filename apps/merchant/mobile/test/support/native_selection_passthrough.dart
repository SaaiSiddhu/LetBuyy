import 'package:image_picker/image_picker.dart';
import 'package:letbuyy_store/services/native_media_selection.dart';
import 'package:letbuyy_store/services/api_client.dart';

/// UI permission/cancellation fixtures isolate the native-selection boundary.
/// Real encrypted persistence, scope/byte checks and death recovery are covered
/// by native_media_selection_test and the owned native runtime journeys.
class NativeSelectionPassthrough extends NativeMediaSelection {
  NativeSelectionPassthrough()
    : super(
        contextProvider: () =>
            (actorId: 'synthetic-owner', storeId: 'synthetic-site', version: 1),
      );
  @override
  Future<void> initialize() async {}
  @override
  Future<XFile?> pick({
    required String purpose,
    required String kind,
    required int maxBytes,
    required Future<XFile?> Function() pick,
    bool imagePickerSource = true,
    JsonMap draft = const {},
  }) => pick();
  @override
  String? keyForFile(XFile file) => null;
  @override
  String? claimUpload(XFile file) => null;
  @override
  String? operationKeyForFile(XFile file, String operation) => null;
  @override
  JsonMap draftForFile(XFile file) => const {};
  @override
  Future<void> bindInput(XFile file, JsonMap input) async {}
}
