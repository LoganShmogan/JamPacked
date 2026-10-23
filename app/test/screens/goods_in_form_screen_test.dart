import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/screens/goods_in_form_screen.dart';
import 'package:foodsafe/screens/scanner_screen.dart';
import 'package:foodsafe/screens/suppliers_screen.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../fixtures.dart';
import '../helpers.dart';

/// Opens the form from a page; returns how many times it popped.
Future<(FakeConvex, List<Object?>)> openForm(
  WidgetTester tester, [
  Map<String, Handler> handlers = const {},
]) async {
  final popped = <Object?>[];
  final convex = await pumpScreen(
    tester,
    Builder(
      builder: (context) => Scaffold(
        body: TextButton(
          onPressed: () async => popped.add(
            await Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const GoodsInFormScreen()),
            ),
          ),
          child: const Text('open'),
        ),
      ),
    ),
    convex: fakeWith({'deliveries:create': (_) => 'd9', ...handlers}),
    size: const Size(800, 2400),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  return (convex, popped);
}

Future<void> chooseSupplier(WidgetTester tester, String label) async {
  await tapOn(tester, find.byType(DropdownButtonFormField<String>));
  await tester.tap(find.text(label).last);
  await tester.pumpAndSettle();
}

/// Adds an accepted ambient item called [name] through the editor.
Future<void> addItem(WidgetTester tester, String name) async {
  await tapOn(tester, find.text('Add item'));
  await tester.enterText(find.widgetWithText(TextFormField, 'Product'), name);
  await tapOn(tester, find.text('Ambient'));
  await tapOn(tester, find.text('Done'));
}

/// Taps Scan and "detects" [code] (or backs out when null).
Future<void> scan(WidgetTester tester, String? code) async {
  await tapOn(tester, find.text('Scan'));
  expect(find.byType(ScannerScreen), findsOneWidget);
  if (code == null) {
    await tester.pageBack();
  } else {
    tester.widget<MobileScanner>(find.byType(MobileScanner)).onDetect!(
      BarcodeCapture(barcodes: [Barcode(rawValue: code)]),
    );
  }
  await tester.pumpAndSettle();
}

void main() {
  test('passes its key through', () {
    final key = UniqueKey();
    expect(GoodsInFormScreen(key: key).key, key);
  });

  testWidgets('shows a spinner until suppliers and settings load', (
    tester,
  ) async {
    final gate = Completer<void>();
    final convex = fakeWith({
      'settings:get': (_) => gate.future.then((_) => settings()),
    });
    tester.view.physicalSize = const Size(800, 1600);
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      wrapProviders(convex, signedIn(convex), const GoodsInFormScreen()),
    );
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    gate.complete();
    await tester.pumpAndSettle();
    expect(find.text('Save delivery (0 items)'), findsOneWidget);
  });

  testWidgets('a load failure keeps the spinner and shows the error', (
    tester,
  ) async {
    final convex = fakeWith({
      'suppliers:list': fails('Cannot reach the server'),
    });
    tester.view.physicalSize = const Size(800, 1600);
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      wrapProviders(convex, signedIn(convex), const GoodsInFormScreen()),
    );
    await tester.pump();
    await tester.pump();
    expect(find.text('Cannot reach the server'), findsOneWidget);
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });

  testWidgets('save needs a supplier and at least one item', (tester) async {
    final (convex, _) = await openForm(tester);
    await tapOn(tester, find.text('Save delivery (0 items)'));
    expect(find.text('Choose a supplier'), findsOneWidget);
    await chooseSupplier(tester, 'Fresh Foods');
    await tapOn(tester, find.text('Save delivery (0 items)'));
    expect(find.text('Add at least one item'), findsOneWidget);
    expect(convex.callsTo('deliveries:create'), isEmpty);
  });

  testWidgets(
    'unapproved suppliers are flagged; suggestions pre-fill the editor',
    (tester) async {
      final (convex, _) = await openForm(tester, {
        'deliveries:suggestionsForSupplier': (a) => a['supplierId'] == 's2'
            ? [
                {
                  'productName': 'Squid',
                  'storageType': 'frozen',
                  'quantity': 2,
                  'unit': 'kg',
                  'allergens': ['mollusc'],
                },
              ]
            : throw fakeError('offline'),
      });
      expect(
        find.text('Shady Co  (not approved)'),
        findsNothing,
      ); // closed dropdown shows nothing yet
      await chooseSupplier(tester, 'Shady Co  (not approved)');
      expect(
        find.textContaining('Not on approved supplier list'),
        findsOneWidget,
      );
      expect(
        convex
            .callsTo('deliveries:suggestionsForSupplier')
            .single
            .args['supplierId'],
        's2',
      );

      await tapOn(tester, find.widgetWithText(ActionChip, 'Squid'));
      expect(find.text('Check item'), findsOneWidget);
      expect(find.text('Must be frozen hard, ≤ -15°C'), findsOneWidget);
      await tester.tap(find.byType(CloseButton));
      await tester.pumpAndSettle();
      expect(
        find.text('ITEMS (0)'),
        findsOneWidget,
      ); // closing the editor adds nothing

      await chooseSupplier(tester, 'Fresh Foods');
      expect(
        find.textContaining('Not on approved supplier list'),
        findsNothing,
      );
      expect(find.widgetWithText(ActionChip, 'Squid'), findsNothing);
    },
  );

  testWidgets('add, edit and delete draft items, then save the delivery', (
    tester,
  ) async {
    final (convex, popped) = await openForm(tester);
    await chooseSupplier(tester, 'Fresh Foods');
    await addItem(tester, 'Flour');
    await tapOn(tester, find.text('Add item'));
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Product'),
      'Milk',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Batch / lot code'),
      'B2',
    );
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Probe temperature °C'),
      '9',
    );
    await tapOn(tester, find.text('Reject'));
    await tapOn(tester, find.text('Done'));
    expect(find.text('ITEMS (2)'), findsOneWidget);
    expect(find.text('1 ea · 9°C · Batch B2'), findsOneWidget);
    expect(find.text('Reject'), findsOneWidget);
    expect(find.text('OK'), findsOneWidget);

    // Edit the first item in place.
    await tapOn(tester, find.text('Flour'));
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Product'),
      'Rice',
    );
    await tapOn(tester, find.text('Done'));
    expect(find.text('Rice'), findsOneWidget);
    expect(find.text('Flour'), findsNothing);

    await addItem(tester, 'Spare');
    await tapOn(tester, find.byIcon(Icons.delete_outline).last);
    expect(find.text('Spare'), findsNothing);

    await tester.enterText(
      find.widgetWithText(TextField, 'Invoice / docket number'),
      ' INV-1 ',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Vehicle temperature °C (optional)'),
      '4',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Anything unusual about this delivery'),
      ' Late ',
    );
    await tapOn(tester, find.text('Delivery vehicle clean & suitable'));
    await tapOn(tester, find.text('Save delivery (2 items)'));
    final args = convex.callsTo('deliveries:create').single.args;
    expect(args['supplierId'], 's1');
    expect(args['invoiceNumber'], 'INV-1');
    expect(args['vehicleClean'], isFalse);
    expect(args['vehicleTempC'], 4.0);
    expect(args['notes'], 'Late');
    expect((args['items'] as List).map((i) => i['productName']), [
      'Rice',
      'Milk',
    ]);
    expect(popped, [null]);
    expect(find.text('Delivery recorded'), findsOneWidget);
  });

  testWidgets(
    'blank optional fields are sent as null; a server error keeps the form',
    (tester) async {
      final (convex, popped) = await openForm(tester, {
        'deliveries:create': fails('Supplier not found'),
      });
      await chooseSupplier(tester, 'Fresh Foods');
      await addItem(tester, 'Flour');
      await tapOn(tester, find.text('Save delivery (1 items)'));
      final args = convex.callsTo('deliveries:create').single.args;
      expect(
        [args['invoiceNumber'], args['vehicleTempC'], args['notes']],
        [null, null, null],
      );
      expect(find.text('Supplier not found'), findsOneWidget);
      expect(popped, isEmpty);
      expect(find.text('Save delivery (1 items)'), findsOneWidget);
    },
  );

  testWidgets('new supplier from the form is loaded and selected', (
    tester,
  ) async {
    final list = [...suppliers];
    final (convex, _) = await openForm(tester, {
      'suppliers:list': (_) => list,
      'suppliers:create': (_) {
        list.add({
          '_id': 's9',
          'name': 'Acme',
          'approved': true,
          'active': true,
        });
        return 's9';
      },
    });
    await tapOn(tester, find.byTooltip('New supplier'));
    await tester.pageBack();
    await tester.pumpAndSettle();
    expect(convex.callsTo('deliveries:suggestionsForSupplier'), isEmpty);

    await tapOn(tester, find.byTooltip('New supplier'));
    expect(find.byType(SupplierFormScreen), findsOneWidget);
    await tester.enterText(
      find.widgetWithText(TextFormField, 'Business name'),
      'Acme',
    );
    await tapOn(tester, find.text('Save'));
    expect(find.text('Acme'), findsOneWidget);
    expect(
      convex
          .callsTo('deliveries:suggestionsForSupplier')
          .single
          .args['supplierId'],
      's9',
    );
  });

  group('scan to add', () {
    testWidgets('cancelling the scanner adds nothing', (tester) async {
      final (convex, _) = await openForm(tester);
      await scan(tester, null);
      expect(find.text('Add item'), findsOneWidget);
      expect(convex.callsTo('products:byBarcode'), isEmpty);
    });

    testWidgets('a known barcode pre-fills from the catalogue', (tester) async {
      final (convex, _) = await openForm(tester, {
        'products:byBarcode': (_) => {
          '_id': 'p1',
          'name': 'Cheddar',
          'storageType': 'chilled',
          'allergens': ['milk'],
        },
      });
      await scan(tester, '9400001');
      expect(find.text('Check item'), findsOneWidget);
      expect(find.text('Cheddar'), findsOneWidget);
      expect(find.text('Barcode 9400001'), findsOneWidget);
      expect(convex.callsTo('products:lookupBarcode'), isEmpty);
    });

    testWidgets('an unknown barcode falls back to Open Food Facts', (
      tester,
    ) async {
      final (convex, _) = await openForm(tester, {
        'products:byBarcode': (_) => null,
        'products:lookupBarcode': (_) => {
          'name': 'Peas',
          'brand': "Wattie's",
          'storageType': 'frozen',
          'allergens': ['milk', 'tree nuts'],
        },
      });
      await scan(tester, '9400002');
      expect(find.text("Wattie's Peas"), findsOneWidget);
      expect(find.text('Must be frozen hard, ≤ -15°C'), findsOneWidget);
      expect(
        tester
            .widget<FilterChip>(find.widgetWithText(FilterChip, 'milk'))
            .selected,
        isTrue,
      );
      expect(convex.callsTo('products:lookupBarcode').single.args, {
        'businessId': 'b1',
        'sessionToken': 'tok',
        'barcode': '9400002',
      });
    });

    testWidgets('Open Food Facts without a brand uses the name alone', (
      tester,
    ) async {
      await openForm(tester, {
        'products:byBarcode': (_) => null,
        'products:lookupBarcode': (_) => {
          'name': 'Peas',
          'brand': null,
          'storageType': 'frozen',
          'allergens': [],
        },
      });
      await scan(tester, '9400003');
      expect(find.text('Peas'), findsOneWidget);
    });

    for (final (label, Handler off) in [
      ('not found', (_) => null),
      (
        'nameless',
        (_) => {'name': '', 'storageType': 'ambient', 'allergens': []},
      ),
    ]) {
      testWidgets(
        'an unrecognised barcode ($label) opens a blank item with the barcode',
        (tester) async {
          await openForm(tester, {
            'products:byBarcode': (_) => null,
            'products:lookupBarcode': off,
          });
          await scan(tester, '123');
          expect(find.text('Add item'), findsWidgets);
          expect(find.text('Barcode 123'), findsOneWidget);
        },
      );
    }

    testWidgets('lookup errors are ignored', (tester) async {
      await openForm(tester, {'products:byBarcode': fails('offline')});
      await scan(tester, '456');
      expect(find.text('Barcode 456'), findsOneWidget);
    });
  });

  group('programme receiving checks', () {
    final prompts = [
      {'key': 'attended', 'text': 'Someone was there', 'guidance': 'Be there'},
      {'key': 'order', 'text': 'Put away in order'},
      {'key': 'allergen', 'text': 'Allergen info on file'},
    ];

    testWidgets('must all be answered; answers (incl. N/A) are sent', (
      tester,
    ) async {
      final (convex, popped) = await openForm(tester, {
        'programmes:current': (_) => programme(prompts: prompts),
      });
      expect(find.text('PROGRAMME CHECKS'), findsOneWidget);
      expect(find.text('Be there'), findsOneWidget);
      await chooseSupplier(tester, 'Fresh Foods');
      await addItem(tester, 'Flour');
      await tapOn(tester, find.textContaining('Save delivery'));
      expect(find.text('Answer the programme checks'), findsOneWidget);
      expect(convex.callsTo('deliveries:create'), isEmpty);

      await tapOn(tester, find.widgetWithText(ChoiceChip, 'Yes').at(0));
      await tapOn(tester, find.widgetWithText(ChoiceChip, 'No').at(1));
      await tapOn(tester, find.widgetWithText(ChoiceChip, 'N/A').at(2));
      await tapOn(tester, find.textContaining('Save delivery'));
      expect(
        convex.callsTo('deliveries:create').single.args['programmeAnswers'],
        [
          {'key': 'attended', 'value': true},
          {'key': 'order', 'value': false},
          {'key': 'allergen', 'value': null},
        ],
      );
      expect(popped, hasLength(1));
    });

    testWidgets('no programme checks: nothing extra is sent', (tester) async {
      final (convex, _) = await openForm(tester);
      expect(find.text('PROGRAMME CHECKS'), findsNothing);
      await chooseSupplier(tester, 'Fresh Foods');
      await addItem(tester, 'Flour');
      await tapOn(tester, find.textContaining('Save delivery'));
      expect(
        convex
            .callsTo('deliveries:create')
            .single
            .args
            .containsKey('programmeAnswers'),
        isFalse,
      );
    });
  });
}
