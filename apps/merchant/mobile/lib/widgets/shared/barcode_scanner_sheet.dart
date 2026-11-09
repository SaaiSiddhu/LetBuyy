import 'dart:async';

import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

Future<String?> showBarcodeScannerSheet(
  BuildContext context, {
  String title = 'Scan barcode',
}) => showLetbuyyFormSheet<String>(
  context: context,
  builder: (_) => _BarcodeScannerSheet(title: title),
);

class _BarcodeScannerSheet extends StatefulWidget {
  const _BarcodeScannerSheet({required this.title});
  final String title;
  @override
  State<_BarcodeScannerSheet> createState() => _BarcodeScannerSheetState();
}

class _BarcodeScannerSheetState extends State<_BarcodeScannerSheet> {
  final MobileScannerController _controller = MobileScannerController();
  final _manualController = TextEditingController();
  bool _handled = false, _manualOpen = false, _resumeAfterManual = false;
  bool get _current => mounted && isLetbuyySurfaceCurrent(context);

  @override
  void dispose() {
    _manualController.dispose();
    unawaited(_controller.dispose());
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (!_current || _handled || _manualOpen) return;
    for (final barcode in capture.barcodes) {
      final value = barcode.rawValue?.trim();
      if (value == null || value.isEmpty) continue;
      _handled = true;
      completeLetbuyySurface(context, value);
      return;
    }
  }

  Future<void> _enterManually() async {
    if (!_current || _handled || _manualOpen) return;
    _manualOpen = true;
    _manualController.clear();
    _resumeAfterManual = _controller.value.isRunning;
    try {
      await _controller.stop();
    } catch (_) {
      // Manual entry also works without camera access.
    }
    if (!mounted) return;
    setState(() {});
  }

  void _cancelManual() {
    if (!_current || !_manualOpen || _handled) return;
    FocusScope.of(context).unfocus();
    _manualController.clear();
    setState(() => _manualOpen = false);
    if (_resumeAfterManual && _controller.value.hasCameraPermission) {
      unawaited(_controller.start().catchError((Object _) {}));
    }
  }

  void _useManual(String value) {
    if (!_current || !_manualOpen || _handled) return;
    final code = value.trim();
    if (code.isEmpty) {
      _cancelManual();
      return;
    }
    _handled = true;
    completeLetbuyySurface(context, code);
  }

  Widget _camera() => LetbuyyFormSheet(
    title: widget.title,
    closeLabel: 'Close scanner',
    onClose: () {
      if (_current && !_manualOpen && !_handled)
        completeLetbuyySurface(context);
    },
    actions: [
      Tooltip(
        message: 'Enter barcode manually',
        child: TextButton.icon(
          onPressed: _enterManually,
          icon: const Icon(Icons.keyboard_alt_outlined),
          label: const Text('Enter barcode manually'),
        ),
      ),
    ],
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AspectRatio(
          aspectRatio: 3 / 2,
          child: Stack(
            fit: StackFit.expand,
            children: [
              MobileScanner(
                controller: _controller,
                onDetect: _onDetect,
                errorBuilder: (_, _) => const Center(
                  child: SingleChildScrollView(
                    padding: EdgeInsets.all(16),
                    child: Text(
                      'Camera unavailable. Enter the barcode manually, or allow camera access in Settings.',
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ),
              IgnorePointer(
                child: Center(
                  child: FractionallySizedBox(
                    widthFactor: .75,
                    heightFactor: .6,
                    child: DecoratedBox(
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: Colors.white, width: 3),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        const Text(
          'Align the product barcode inside the frame.',
          textAlign: TextAlign.center,
        ),
      ],
    ),
  );

  Widget _manual() => LetbuyyFormSheet(
    title: 'Enter barcode',
    description: 'Enter the product barcode. Camera scanning is paused.',
    canDismiss: false,
    onDismissAttempt: _cancelManual,
    onClose: _cancelManual,
    actions: [
      TextButton(onPressed: _cancelManual, child: const Text('Cancel')),
      FilledButton(
        onPressed: () => _useManual(_manualController.text),
        child: const Text('Use code'),
      ),
    ],
    child: CustomTextField(
      controller: _manualController,
      label: 'Barcode',
      autofocus: _current,
      textInputAction: TextInputAction.done,
      onSubmitted: _useManual,
    ),
  );

  @override
  Widget build(BuildContext context) => Stack(
    alignment: Alignment.topCenter,
    children: [
      // Retain the actual camera widget/controller while entering text. Replacing
      // it would auto-start it again even after a denied/previously stopped camera.
      Offstage(offstage: _manualOpen, child: _camera()),
      if (_manualOpen) _manual(),
    ],
  );
}
