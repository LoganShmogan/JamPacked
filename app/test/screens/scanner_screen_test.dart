import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/screens/scanner_screen.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../helpers.dart';

/// Opens the scanner from a page and records what it pops with.
Future<List<Object?>> openScanner(WidgetTester tester) async {
  final popped = <Object?>[];
  await pumpScreen(
    tester,
    Builder(
      builder: (context) => Scaffold(
        body: TextButton(
          onPressed: () async => popped.add(
            await Navigator.of(context)
                .push(MaterialPageRoute(builder: (_) => const ScannerScreen())),
          ),
          child: const Text('scan'),
        ),
      ),
    ),
  );
  await tester.tap(find.text('scan'));
  await tester.pumpAndSettle();
  return popped;
}

MobileScanner scanner(WidgetTester tester) =>
    tester.widget<MobileScanner>(find.byType(MobileScanner));

void main() {
  testWidgets('pops with the first detected barcode only once', (tester) async {
    final popped = await openScanner(tester);
    final s = scanner(tester);
    s.onDetect!(const BarcodeCapture()); // nothing decoded yet
    await tester.pumpAndSettle();
    expect(popped, isEmpty);
    s.onDetect!(const BarcodeCapture(barcodes: [Barcode(rawValue: '9400001')]));
    s.onDetect!(const BarcodeCapture(barcodes: [Barcode(rawValue: 'second')]));
    await tester.pumpAndSettle();
    expect(popped, ['9400001']);
  });

  testWidgets('"Type it" lets the user key a barcode in', (tester) async {
    final popped = await openScanner(tester);
    await tester.tap(find.text('Type it'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Type it'));
    await tester.pumpAndSettle();
    await answerDialog(tester, '  ', button: 'OK');
    expect(popped, isEmpty);
    expect(find.byType(ScannerScreen), findsOneWidget);

    await tester.tap(find.text('Type it'));
    await tester.pumpAndSettle();
    await answerDialog(tester, ' 12345678 ', button: 'OK');
    expect(popped, ['12345678']);
  });

  testWidgets('camera errors suggest typing the code instead', (tester) async {
    await openScanner(tester);
    final error = scanner(tester).errorBuilder!(
      tester.element(find.byType(MobileScanner)),
      const MobileScannerException(
        errorCode: MobileScannerErrorCode.permissionDenied,
      ),
    );
    await tester.pumpWidget(MaterialApp(home: Scaffold(body: error)));
    expect(
      find.text(
        'Camera unavailable (permissionDenied). Use "Type it" instead.',
      ),
      findsOneWidget,
    );
  });
}
