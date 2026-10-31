// Picking from the catalogue by search or barcode, so a product is only ever typed once.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/screens/scanner_screen.dart';
import 'package:jampacked/widgets/product_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../fixtures.dart';
import '../helpers.dart';

final catalogue = [
  {
    '_id': 'p1',
    'name': 'Milk 2L',
    'brand': 'Anchor',
    'barcode': '9400001',
    'unit': 'ea',
    'storageType': 'chilled',
  },
  {'_id': 'p2', 'name': 'Scones', 'kind': 'made', 'storageType': 'ambient'},
];

/// Opens the picker; returns the list that receives what it pops with.
Future<(List<Map?>, FakeConvex)> openPicker(
  WidgetTester tester, {
  bool allowNew = false,
  Handler? byBarcode,
}) async {
  final popped = <Map?>[];
  final convex = await pumpScreen(
    tester,
    Builder(
      builder: (context) => Scaffold(
        body: TextButton(
          onPressed: () async =>
              popped.add(await pickProduct(context, allowNew: allowNew)),
          child: const Text('open'),
        ),
      ),
    ),
    convex: fakeWith({
      'products:list': (_) => catalogue,
      'products:byBarcode': byBarcode ?? (_) => null,
    }),
  );
  await tapOn(tester, find.text('open'));
  return (popped, convex);
}

Future<void> scan(WidgetTester tester, String code) async {
  await tapOn(tester, find.byTooltip('Scan barcode'));
  expect(find.byType(ScannerScreen), findsOneWidget);
  tester.widget<MobileScanner>(find.byType(MobileScanner)).onDetect!(
    BarcodeCapture(barcodes: [Barcode(rawValue: code)]),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('searches by name, brand or barcode and returns the pick', (
    tester,
  ) async {
    final (popped, _) = await openPicker(tester);
    expect(find.text('Pick a product'), findsOneWidget);
    expect(find.text('Anchor · 9400001 · ea'), findsOneWidget);
    expect(find.text('Made here'), findsOneWidget);
    for (final term in ['anchor', '94000', 'MILK']) {
      await tester.enterText(find.byType(TextField), term);
      await tester.pumpAndSettle();
      expect(find.text('Scones'), findsNothing);
      expect(find.text('Milk 2L'), findsOneWidget);
    }
    await tester.enterText(find.byType(TextField), 'zzz');
    await tester.pumpAndSettle();
    expect(find.text('Nothing found'), findsOneWidget);
    expect(find.textContaining('New:'), findsNothing);
    await tester.enterText(find.byType(TextField), 'scones');
    await tester.pumpAndSettle();
    await tapOn(tester, find.text('Scones'));
    expect(popped.single!['_id'], 'p2');
  });

  testWidgets('with allowNew, offers a typed name that is not there yet', (
    tester,
  ) async {
    final (popped, _) = await openPicker(tester, allowNew: true);
    expect(find.textContaining('New:'), findsNothing); // nothing typed
    await tester.enterText(find.byType(TextField), 'Scones');
    await tester.pumpAndSettle();
    expect(
      find.textContaining('New:'),
      findsNothing,
    ); // already in the catalogue
    await tester.enterText(find.byType(TextField), ' Pie ');
    await tester.pumpAndSettle();
    expect(find.text('Add it to your catalogue'), findsOneWidget);
    await tapOn(tester, find.text('New: Pie'));
    expect(popped.single, {'name': 'Pie'});
  });

  testWidgets('scanning finds the product, or says it is not there', (
    tester,
  ) async {
    final (popped, convex) = await openPicker(
      tester,
      byBarcode: (a) => a['barcode'] == '9400001' ? catalogue.first : null,
    );
    await tapOn(tester, find.byTooltip('Scan barcode'));
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(convex.callsTo('products:byBarcode'), isEmpty);
    await scan(tester, '123');
    expect(
      find.text('Barcode 123 is not in your catalogue yet'),
      findsOneWidget,
    );
    expect(popped, isEmpty);
    await scan(tester, '9400001');
    expect(popped.single!['name'], 'Milk 2L');
  });
}
