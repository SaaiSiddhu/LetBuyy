// Diagnostic synthetic input calibration only. No API, auth or business proof.
import 'package:flutter/material.dart';

void main() => runApp(const _InputCalibration());

class _InputCalibration extends StatefulWidget {
  const _InputCalibration();
  @override
  State<_InputCalibration> createState() => _InputCalibrationState();
}

class _InputCalibrationState extends State<_InputCalibration> {
  final store = TextEditingController(text: 'Synthetic Alpha');
  final product = TextEditingController(text: 'Synthetic Beta product');
  @override
  void dispose() { store.dispose(); product.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => MaterialApp(home: Scaffold(
    appBar: AppBar(title: const Text('Synthetic input calibration')),
    body: Padding(padding: const EdgeInsets.all(24), child: Column(children: [
      TextField(controller: store, decoration: const InputDecoration(labelText: 'Synthetic store')),
      const SizedBox(height: 24),
      TextField(controller: product, maxLines: null, decoration: const InputDecoration(labelText: 'Synthetic product')),
    ])),
  ));
}
