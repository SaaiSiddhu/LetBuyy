import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

Rect globalSemanticsRect(SemanticsNode node) {
  var rect = node.rect;
  for (
    SemanticsNode? current = node;
    current != null;
    current = current.parent
  ) {
    if (current.transform != null) {
      rect = MatrixUtils.transformRect(current.transform!, rect);
    }
  }
  return rect;
}

/// The recovered KYC form grows after a nested selection sheet closes. This
/// exercises the canonical sheet, inset owner and modal lifetime together.
class RecoverySheetGeometryFixture extends StatefulWidget {
  const RecoverySheetGeometryFixture({super.key});
  @override
  State<RecoverySheetGeometryFixture> createState() => _GeometryState();
}

class _GeometryState extends State<RecoverySheetGeometryFixture> {
  String? file;
  @override
  Widget build(BuildContext context) => LetbuyyEditorScaffold(
    hasChanges: false,
    title: 'Upload verification document',
    actions: OverflowBar(
      alignment: MainAxisAlignment.end,
      children: [
        TextButton(
          onPressed: () => completeLetbuyySurface(context),
          child: const Text('Close'),
        ),
        FilledButton(
          onPressed: file == null
              ? null
              : () {
                  completeLetbuyySurface(context, true);
                },
          child: const Text('Upload document'),
        ),
      ],
    ),
    body: SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Choose a clear photo of your document (JPEG or PNG, under 5 MB). '
            'Upload is private and still requires provider review.',
          ),
          const SizedBox(height: 16),
          LetbuyyChoiceField<String>(
            value: 'bank_proof',
            label: 'Document type',
            choices: const [
              LetbuyyChoice(value: 'bank_proof', label: 'Bank proof'),
            ],
            onChanged: null,
          ),
          const SizedBox(height: 12),
          const TextField(
            enabled: false,
            decoration: InputDecoration(
              labelText: 'Reference',
              helperText: 'Final 2–4 characters',
            ),
            controller: null,
          ),
          OutlinedButton.icon(
            onPressed: () async {
              final use = await showLetbuyyFormSheet<bool>(
                context: context,
                builder: (sheet) => LetbuyyFormSheet(
                  title: 'Review previous file selection',
                  actions: [
                    FilledButton(
                      onPressed: () => completeLetbuyySurface(sheet, true),
                      child: const Text('Use saved file'),
                    ),
                  ],
                  child: const Text('Continue the original private selection.'),
                ),
              );
              if (mounted && use == true) {
                setState(() {
                  file =
                      'image_picker_2A8E44F8-6D80-435B-B6D0-'
                      '8E2F953338A4-14426-00000496ACFB12D8.png';
                });
              }
            },
            icon: const Icon(Icons.upload_file),
            label: Text(file ?? 'Choose document photo'),
          ),
        ],
      ),
    ),
  );
}

void main() {
  for (final scale in [1.0, 2.0]) {
    testWidgets(
      'recovered full-page upload keeps painted and semantic actions aligned at iOS scale $scale',
      (tester) async {
        final semantics = tester.ensureSemantics();
        tester.view.devicePixelRatio = 1;
        tester.view.physicalSize = const Size(402, 874);
        tester.view.padding = const FakeViewPadding(top: 62, bottom: 34);
        tester.view.viewPadding = const FakeViewPadding(top: 62, bottom: 34);
        addTearDown(tester.view.resetDevicePixelRatio);
        addTearDown(tester.view.resetPhysicalSize);
        addTearDown(tester.view.resetPadding);
        addTearDown(tester.view.resetViewPadding);
        final key = GlobalKey<_GeometryState>();
        Object? accepted;
        try {
          await tester.pumpWidget(
            MaterialApp(
              theme: ThemeData(platform: TargetPlatform.iOS),
              builder: (context, child) => MediaQuery(
                data: MediaQuery.of(
                  context,
                ).copyWith(textScaler: TextScaler.linear(scale)),
                child: child!,
              ),
              home: Builder(
                builder: (context) => Scaffold(
                  body: TextButton(
                    onPressed: () async {
                      accepted = await Navigator.of(context).push<bool>(
                        MaterialPageRoute(
                          builder: (_) =>
                              RecoverySheetGeometryFixture(key: key),
                        ),
                      );
                    },
                    child: const Text('Resume upload'),
                  ),
                ),
              ),
            ),
          );
          await tester.tap(find.text('Resume upload'));
          await tester.pumpAndSettle();
          await tester.ensureVisible(find.text('Choose document photo'));
          await tester.tap(find.text('Choose document photo'));
          await tester.pumpAndSettle();
          await tester.ensureVisible(find.text('Use saved file'));
          await tester.tap(find.text('Use saved file'));
          await tester.pumpAndSettle();
          final button = find.widgetWithText(FilledButton, 'Upload document');
          await tester.ensureVisible(button);
          await tester.pumpAndSettle();
          final painted = tester.getRect(button);
          final node = tester.getSemantics(button);
          final actual = globalSemanticsRect(node);
          expect(actual.center.dx, closeTo(painted.center.dx, 1));
          expect(actual.center.dy, closeTo(painted.center.dy, 1));
          expect(actual.height, greaterThanOrEqualTo(44));
          await tester.tapAt(actual.center);
          await tester.pumpAndSettle();
          expect(accepted, isTrue);
          expect(find.text('Resume upload'), findsOneWidget);
          expect(tester.takeException(), isNull);
          await tester.pumpWidget(const SizedBox());
        } finally {
          await tester.pumpWidget(const SizedBox());
          semantics.dispose();
        }
      },
    );
  }
}
