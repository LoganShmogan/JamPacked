import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

/// Returns the first barcode scanned (or typed) via Navigator.pop.
class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});
  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen> {
  bool _done = false;

  void _finish(String code) {
    if (_done) return;
    _done = true;
    Navigator.pop(context, code);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Scan barcode'),
        actions: [
          TextButton(
            onPressed: () async {
              final ctrl = TextEditingController();
              final code = await showDialog<String>(
                context: context,
                builder: (c) => AlertDialog(
                  title: const Text('Enter barcode'),
                  content: TextField(
                    controller: ctrl,
                    autofocus: true,
                    keyboardType: TextInputType.number,
                  ),
                  actions: [
                    TextButton(
                      onPressed: () => Navigator.pop(c),
                      child: const Text('Cancel'),
                    ),
                    FilledButton(
                      onPressed: () => Navigator.pop(c, ctrl.text.trim()),
                      child: const Text('OK'),
                    ),
                  ],
                ),
              );
              if (code != null && code.isNotEmpty) _finish(code);
            },
            child: const Text('Type it', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: Stack(
        children: [
          MobileScanner(
            onDetect: (capture) {
              final code = capture.barcodes.firstOrNull?.rawValue;
              if (code != null) _finish(code);
            },
            errorBuilder: (context, error) => Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Text(
                  'Camera unavailable (${error.errorCode.name}). Use "Type it" instead.',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.white),
                ),
              ),
            ),
          ),
          Center(
            child: Container(
              width: 260,
              height: 160,
              decoration: BoxDecoration(
                border: Border.all(color: const Color(0xFFF26B21), width: 3),
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
