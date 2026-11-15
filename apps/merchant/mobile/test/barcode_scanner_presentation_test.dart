import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';
import 'package:letbuyy_store/theme/store_theme.dart';
import 'package:letbuyy_store/widgets/shared/barcode_scanner_sheet.dart';

// Platform fixture only. These tests do not establish camera or OS permission acceptance.
class _Camera extends MobileScannerPlatform {
  _Camera({this.denied = false});
  final bool denied;
  int starts = 0, stops = 0;
  final stream = StreamController<BarcodeCapture>.broadcast();
  @override
  Stream<BarcodeCapture?> get barcodesStream => stream.stream;
  @override
  Stream<TorchState> get torchStateStream =>
      Stream.value(TorchState.unavailable);
  @override
  Stream<double> get zoomScaleStateStream => Stream.value(1);
  @override
  Future<MobileScannerViewAttributes> start(StartOptions options) async {
    starts++;
    if (denied)
      throw const MobileScannerException(
        errorCode: MobileScannerErrorCode.permissionDenied,
      );
    return const MobileScannerViewAttributes(
      cameraDirection: CameraFacing.back,
      currentTorchMode: TorchState.unavailable,
      size: Size(640, 480),
      numberOfCameras: 1,
    );
  }

  @override
  Future<void> stop() async {
    stops++;
  }

  @override
  Widget buildCameraView() => const ColoredBox(color: Colors.black);
  @override
  Future<void> updateScanWindow(Rect? window) async {}
  @override
  Future<void> dispose() async {
    if (!stream.isClosed) await stream.close();
  }
}

class _Routes extends NavigatorObserver {
  int pushes = 0;
  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    pushes++;
  }
}

class _Result {
  int completions = 0;
  String? value;
  final routes = _Routes();
}

Future<_Result> mount(
  WidgetTester tester,
  _Camera camera, {
  bool dark = false,
  double scale = 1,
}) async {
  final original = MobileScannerPlatform.instance;
  MobileScannerPlatform.instance = camera;
  tester.view.physicalSize = const Size(320, 640);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  addTearDown(() async {
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    MobileScannerPlatform.instance = original;
    await camera.dispose();
  });
  final result = _Result();
  await tester.pumpWidget(
    MaterialApp(
      theme: dark ? StoreTheme.dark() : StoreTheme.light(),
      navigatorObservers: [result.routes],
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(textScaler: TextScaler.linear(scale)),
        child: child!,
      ),
      home: Scaffold(
        body: Builder(
          builder: (context) => TextButton(
            onPressed: () async {
              result.value = await showBarcodeScannerSheet(context);
              result.completions++;
            },
            child: const Text('Open scanner'),
          ),
        ),
      ),
    ),
  );
  await tester.tap(find.text('Open scanner'));
  await tester.pumpAndSettle();
  return result;
}

void main() {
  setUpAll(initializeLetbuyyTypography);
  testWidgets('late camera detection cannot read disposed scanner context', (
    tester,
  ) async {
    final result = await mount(tester, _Camera());
    final detect = tester
        .widget<MobileScanner>(find.byType(MobileScanner))
        .onDetect!;
    await tester.tap(find.byTooltip('Close scanner'));
    await tester.pumpAndSettle();
    detect(
      const BarcodeCapture(barcodes: [Barcode(rawValue: 'late-private-code')]),
    );
    await tester.pumpAndSettle();
    expect(result.completions, 1);
    expect(result.value, isNull);
    expect(find.text('Open scanner'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
  for (final dark in [false, true]) {
    testWidgets(
      'manual entry keeps one scanner route, Back resumes and repeated input returns once dark=$dark',
      (tester) async {
        final camera = _Camera();
        final result = await mount(tester, camera, dark: dark, scale: 2.4);
        expect(camera.starts, 1);
        final pushes = result.routes.pushes;
        await tester.tap(find.byTooltip('Enter barcode manually'));
        await tester.pumpAndSettle();
        expect(
          result.routes.pushes,
          pushes,
          reason: 'Manual editing belongs to the current scanner surface.',
        );
        expect(camera.stops, 1);
        await tester.enterText(find.byType(TextField), '  EXACT-001  ');
        tester.view.viewInsets = const FakeViewPadding(bottom: 240);
        addTearDown(tester.view.resetViewInsets);
        await tester.pumpAndSettle();
        expect(tester.takeException(), isNull);
        await tester.binding.handlePopRoute();
        await tester.pumpAndSettle();
        tester.view.resetViewInsets();
        await tester.pumpAndSettle();
        expect(result.completions, 0);
        expect(camera.starts, 2);
        await tester.tap(find.byTooltip('Enter barcode manually'));
        await tester.pumpAndSettle();
        expect(
          tester.widget<TextField>(find.byType(TextField)).controller!.text,
          isEmpty,
        );
        await tester.enterText(find.byType(TextField), '  EXACT-001  ');
        final submit = tester
            .widget<TextField>(find.byType(TextField))
            .onSubmitted!;
        submit('  EXACT-001  ');
        submit('  EXACT-001  ');
        await tester.pumpAndSettle();
        expect(result.value, 'EXACT-001');
        expect(result.completions, 1);
        expect(tester.takeException(), isNull);
      },
    );
  }
  testWidgets(
    'cancelled manual input never requests camera again after permission denial',
    (tester) async {
      final camera = _Camera(denied: true);
      final result = await mount(tester, camera);
      expect(camera.starts, 1);
      await tester.tap(find.byTooltip('Enter barcode manually'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(camera.starts, 1);
      expect(result.completions, 0);
      expect(find.textContaining('Camera unavailable'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );
}
