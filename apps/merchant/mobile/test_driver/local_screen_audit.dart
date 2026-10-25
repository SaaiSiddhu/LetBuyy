import 'dart:convert';
import 'dart:io';
import 'package:integration_test/integration_test_driver_extended.dart';

Future<void> main() async {
  final dir = Directory(
    Platform.environment['LETBUYY_SCREEN_AUDIT_DIR'] ??
        '${Directory.systemTemp.path}/letbuyy-screen-audit',
  );
  await dir.create(recursive: true);
  await integrationDriver(
    writeResponseOnFailure: true,
    onScreenshot: (name, bytes, [args]) async {
      await File('${dir.path}/$name.png').writeAsBytes(bytes);
      return true;
    },
    responseDataCallback: (data) async {
      await File(
        '${dir.path}/screens.json',
      ).writeAsString(const JsonEncoder.withIndent('  ').convert(data));
    },
  );
}
