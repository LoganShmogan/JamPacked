// Production: the batch list, one batch, making a batch (from a recipe or one-off), picking
// stock to use, and editing a recipe.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/screens/lot_detail_screen.dart';
import 'package:jampacked/screens/production_screen.dart';
import 'package:jampacked/screens/products_screen.dart';
import 'package:jampacked/screens/scanner_screen.dart';
import 'package:jampacked/widgets/product_picker.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../fixtures.dart';
import '../helpers.dart';

Map<String, dynamic> run({
  List<String> allergens = const ['gluten'],
  String status = 'available',
  List dispatched = const [],
  bool full = true,
}) => {
  'run': {
    '_id': 'r1',
    'productName': 'Scones',
    'batchCode': 'P0001',
    'qty': 12,
    'unit': 'ea',
    'madeAt': t0,
    'madeByName': 'Sam',
    'fromRecipe': full,
    'allergens': allergens,
    if (full) ...{'useBy': t0, 'bestBefore': t0, 'notes': 'Golden'},
    'inputs': [
      {
        'lotId': 'l1',
        'productName': 'Flour',
        'batchCode': 'F1',
        'supplierName': 'Mill Co',
        'qty': 2,
        'unit': 'kg',
      },
      {'lotId': 'l2', 'productName': 'Water', 'qty': 1, 'unit': 'L'},
    ],
  },
  'lot': {
    '_id': 'l9',
    'status': status,
    'qtyOnHand': 7,
    'dispatched': dispatched,
  },
};

final scones = {
  '_id': 'p1',
  'name': 'Scones',
  'kind': 'made',
  'unit': 'ea',
  'storageType': 'ambient',
  'allergens': <String>[],
  'recipe': {
    'yieldQty': 12,
    'ingredients': [
      {'productId': 'p2', 'productName': 'Flour', 'qty': 2, 'unit': 'kg'},
    ],
  },
};
final flour = {
  '_id': 'p2',
  'name': 'Flour',
  'unit': 'kg',
  'storageType': 'ambient',
  'allergens': <String>[],
};

Map<String, dynamic> plan({num short = 0}) => {
  'product': {'_id': 'p1', 'name': 'Scones'},
  'useBy': t0,
  'ingredients': [
    {
      'productId': 'p2',
      'productName': 'Flour',
      'unit': 'kg',
      'need': 2,
      'short': short,
      'picks': [
        {'lotId': 'l1', 'batchCode': 'F1', 'qtyOnHand': 5, 'qty': 2},
      ],
    },
  ],
};

/// Opens the product picker from the form and picks [name] (or types it as something new).
Future<void> pickWhat(
  WidgetTester tester,
  String name, {
  bool isNew = false,
}) async {
  await tapOn(tester, find.text('What are you making?'));
  expect(find.byType(ProductPickerScreen), findsOneWidget);
  if (isNew) {
    await tester.enterText(find.byType(TextField), name);
    await tester.pumpAndSettle();
    await tapOn(tester, find.text('New: $name'));
  } else {
    await tapOn(tester, find.text(name));
  }
}

Future<void> detect(WidgetTester tester, String code) async {
  expect(find.byType(ScannerScreen), findsOneWidget);
  tester.widget<MobileScanner>(find.byType(MobileScanner)).onDetect!(
    BarcodeCapture(barcodes: [Barcode(rawValue: code)]),
  );
  await tester.pumpAndSettle();
}

/// Pumps a page with an "open" button that pushes [screen], and opens it, so it can pop.
Future<FakeConvex> launch(
  WidgetTester tester,
  Widget screen,
  FakeConvex convex, {
  String role = 'admin',
}) async {
  await pumpScreen(
    tester,
    Builder(
      builder: (context) => Scaffold(
        body: TextButton(
          onPressed: () =>
              Navigator.of(context)
                  .push(MaterialPageRoute(builder: (_) => screen)),
          child: const Text('open'),
        ),
      ),
    ),
    convex: convex,
    role: role,
  );
  await tapOn(tester, find.text('open'));
  return convex;
}

void main() {
  group('ProductionScreen', () {
    testWidgets('empty state; Make a batch and Recipes open their screens', (
      tester,
    ) async {
      await pumpScreen(tester, const ProductionScreen(), convex: fakeWith());
      expect(find.text('Nothing made yet'), findsOneWidget);
      await tapOn(tester, find.text('Recipes'));
      expect(
        tester.widget<ProductsScreen>(find.byType(ProductsScreen)).kind,
        'made',
      );
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tapOn(tester, find.text('Make a batch'));
      expect(find.byType(ProductionFormScreen), findsOneWidget);
    });

    testWidgets('lists batches; tapping one opens it', (tester) async {
      await pumpScreen(
        tester,
        const ProductionScreen(),
        convex: fakeWith({
          'production:list': (_) => [
            run()['run'],
            {...run()['run'], 'productName': 'Pies'},
          ],
          'production:get': (_) => run(),
        }),
      );
      expect(find.text('Scones · 12 ea'), findsOneWidget);
      expect(find.textContaining('Batch P0001 ·'), findsNWidgets(2));
      await tapOn(tester, find.text('Scones · 12 ea'));
      expect(find.byType(ProductionRunScreen), findsOneWidget);
    });
  });

  group('ProductionRunScreen', () {
    testWidgets('not found', (tester) async {
      await pumpScreen(
        tester,
        const ProductionRunScreen(id: 'r1'),
        convex: fakeWith(),
      );
      expect(find.text('Not found'), findsOneWidget);
    });

    testWidgets('shows what went in and where the batch is now', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const ProductionRunScreen(id: 'r1'),
        convex: fakeWith({
          'production:get': (_) => run(
            status: 'hold',
            dispatched: [
              {'customer': 'Corner Store', 'qty': 5, 'at': t0},
            ],
          ),
        }),
      );
      expect(find.text('P0001'), findsOneWidget);
      expect(find.text('Golden'), findsOneWidget);
      expect(find.text('Yes'), findsOneWidget);
      expect(find.text('CONTAINS'), findsOneWidget);
      expect(find.text('gluten'), findsOneWidget);
      expect(find.text('Batch F1 · Mill Co'), findsOneWidget);
      expect(find.text('Batch -'), findsOneWidget);
      expect(find.text('Dispatched to Corner Store (5)'), findsOneWidget);
      expect(find.text('ON HOLD'), findsOneWidget);
      await tapOn(tester, find.text('Flour · 2 kg'));
      expect(
        tester.widget<LotDetailScreen>(find.byType(LotDetailScreen)).id,
        'l1',
      );
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tapOn(tester, find.text('7 ea in stock'));
      expect(
        tester.widget<LotDetailScreen>(find.byType(LotDetailScreen)).id,
        'l9',
      );
    });

    testWidgets('a one-off batch with no dates, allergens or dispatches', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const ProductionRunScreen(id: 'r1'),
        convex: fakeWith({
          'production:get': (_) => run(allergens: [], full: false),
        }),
      );
      expect(find.text('One-off'), findsOneWidget);
      expect(find.text('Use by'), findsNothing);
      expect(find.text('CONTAINS'), findsNothing);
      expect(find.textContaining('Dispatched'), findsNothing);
    });
  });

  group('ProductionFormScreen', () {
    testWidgets(
      'from a recipe: works out the ingredients and saves the batch',
      (tester) async {
        final convex = await launch(
          tester,
          const ProductionFormScreen(),
          fakeWith({
            'products:list': (_) => [scones, flour],
            'production:plan': (a) => plan(short: a['qty'] > 12 ? 1 : 0),
            'locations:list': (_) => [
              {'_id': 'loc1', 'name': 'Shelf', 'kind': 'dry', 'active': true},
            ],
            'production:create': (_) => 'r1',
          }),
        );
        expect(find.widgetWithText(TextFormField, 'P0001'), findsOneWidget);
        await tapOn(tester, find.text('Save batch'));
        expect(find.text('Pick what you made'), findsOneWidget);

        await pickWhat(tester, 'Scones');
        expect(find.text('From its recipe'), findsOneWidget);
        expect(convex.callsTo('production:plan').single.args['qty'], 12);
        expect(find.text('Batch F1 · 5 on hand'), findsOneWidget);
        expect(find.textContaining('Use by 6 May 2024'), findsOneWidget);

        await tester.enterText(
          find.widgetWithText(TextFormField, 'How much you made'),
          '24',
        );
        await tapOn(tester, find.text('Work out ingredients for this'));
        expect(find.text('⚠ Flour: 1 kg short in stock'), findsOneWidget);
        await tester.enterText(
          find.widgetWithText(TextFormField, 'How much you made'),
          '0',
        );
        await tapOn(tester, find.text('Work out ingredients for this'));
        expect(
          convex.callsTo('production:plan'),
          hasLength(2),
        ); // 0 isn't planned

        await tester.enterText(
          find.widgetWithText(TextFormField, 'How much you made'),
          '12',
        );
        await tester.testTextInput.receiveAction(TextInputAction.done);
        await tester.pumpAndSettle();
        expect(convex.callsTo('production:plan'), hasLength(3));
        await tapOn(
          tester,
          find.widgetWithText(DropdownButtonFormField<String?>, 'Put away to'),
        );
        await tester.tap(find.text('Shelf').last);
        await tester.pumpAndSettle();
        await tester.enterText(
          find.widgetWithText(TextField, 'Notes'),
          ' Golden ',
        );
        await tapOn(tester, find.text('Save batch'));
        expect(convex.callsTo('production:create').single.args, {
          'productId': 'p1',
          'qty': 12.0,
          'unit': 'ea',
          'batchCode': 'P0001',
          'useBy': t0,
          'locationId': 'loc1',
          'fromRecipe': true,
          'notes': 'Golden',
          'inputs': [
            {'lotId': 'l1', 'qty': 2.0},
          ],
          'businessId': 'b1',
          'sessionToken': 'tok',
        });
        expect(find.text('Batch P0001 made'), findsOneWidget);
        expect(find.byType(ProductionFormScreen), findsNothing);
        expect(
          convex.callsTo('analytics:recordTask').single.args['task'],
          'production',
        );
      },
    );

    testWidgets(
      'one-off of something new: pick stock, set storage and use-by',
      (tester) async {
        final convex = await pumpScreen(
          tester,
          const ProductionFormScreen(),
          convex: fakeWith({
            'products:list': (_) => [scones, flour],
            'stock:onHand': (_) => [
              lot(id: 'l1', name: 'Flour'),
              lot(id: 'l2', name: 'Butter', status: 'hold'),
              {...lot(id: 'l3', name: 'Old milk'), 'expired': true},
              {
                ...lot(id: 'l4', name: 'Salt'),
                'barcode': '9400',
                'expiresAt': t0,
                'locationName': 'Pantry',
              },
            ],
            'production:create': fails('Batch P0001 has already been used'),
          }),
        );
        await pickWhat(tester, 'Pizza', isNew: true);
        expect(find.text('New product: one-off batch'), findsOneWidget);
        await tapOn(tester, find.text('Frozen'));
        await tester.enterText(
          find.widgetWithText(TextFormField, 'How much you made'),
          '4',
        );
        await tester.enterText(
          find.widgetWithText(TextFormField, 'Unit'),
          'kg',
        );
        expect(
          find.text('Nothing yet. Add the stock you used.'),
          findsOneWidget,
        );
        await tapOn(tester, find.text('Save batch'));
        expect(find.text('Add what went into it'), findsOneWidget);

        // Held and out-of-date stock isn't offered; search and scan narrow the list.
        await tapOn(tester, find.text('Add from stock'));
        expect(find.text('Butter'), findsNothing);
        expect(find.text('Old milk'), findsNothing);
        expect(
          find.text('Batch B1 · 6 ea · use 6 May 2024 · Pantry'),
          findsOneWidget,
        );
        await tester.enterText(find.byType(TextField), 'zzz');
        await tester.pumpAndSettle();
        expect(find.text('No stock to use'), findsOneWidget);
        await tapOn(tester, find.byTooltip('Scan barcode'));
        await tester.pageBack();
        await tester.pumpAndSettle();
        await tapOn(tester, find.byTooltip('Scan barcode'));
        await detect(tester, '9400');
        expect(find.text('Flour'), findsNothing);
        await tapOn(tester, find.text('Salt'));

        await tapOn(tester, find.text('Add from stock'));
        await tapOn(tester, find.text('Flour'));
        await tapOn(tester, find.text('Add from stock'));
        await tapOn(tester, find.byType(CloseButton));
        expect(find.text('Batch B1 · 6 on hand'), findsNWidgets(2));
        await tapOn(tester, find.byTooltip('Remove').first);
        await tapOn(tester, find.text('Save batch'));
        expect(find.text('Enter a number'), findsOneWidget);
        await tester.enterText(
          find.widgetWithText(TextFormField, 'Used'),
          '1.5',
        );

        await tapOn(tester, find.text('Use by'));
        await tapOn(tester, find.text('OK'));
        expect(find.textContaining('Use by '), findsOneWidget);
        await tapOn(tester, find.textContaining('Use by '));
        await tapOn(tester, find.text('Cancel'));

        await tapOn(tester, find.text('Save batch'));
        final args = convex.callsTo('production:create').single.args;
        expect(args['productName'], 'Pizza');
        expect(args['storageType'], 'frozen');
        expect(args['fromRecipe'], false);
        expect(args['inputs'], [
          {'lotId': 'l1', 'qty': 1.5},
        ]);
        expect(args.containsKey('notes'), isFalse);
        expect(args['useBy'], isA<int>());
        expect(find.text('Batch P0001 has already been used'), findsOneWidget);
        expect(
          convex.callsTo('analytics:recordTask'),
          isEmpty,
        ); // not saved, not timed
        expect(find.byType(ProductionFormScreen), findsOneWidget);
      },
    );

    testWidgets('one-off of a product with no recipe; unit and name required', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const ProductionFormScreen(),
        convex: fakeWith({
          'products:list': (_) => [scones, flour],
          'production:batchCode': fails('offline'),
        }),
      );
      expect(find.widgetWithText(TextFormField, 'P0001'), findsNothing);
      await pickWhat(tester, 'Flour');
      expect(find.text('One-off batch: pick what went in'), findsOneWidget);
      expect(find.text('Storage'), findsNothing);
      await tester.enterText(find.widgetWithText(TextFormField, 'Unit'), ' ');
      await tapOn(tester, find.text('Save batch'));
      expect(find.text('Enter a number'), findsOneWidget);
      expect(find.text('Required'), findsOneWidget);
      // Backing out of the picker keeps what was chosen.
      await tapOn(tester, find.text('Flour'));
      await tapOn(tester, find.byType(CloseButton));
      expect(find.text('Flour'), findsOneWidget);
    });

    testWidgets('a failed plan shows the error and adds nothing', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const ProductionFormScreen(),
        convex: fakeWith({
          'products:list': (_) => [scones],
          'production:plan': fails('Scones has no recipe'),
        }),
      );
      await pickWhat(tester, 'Scones');
      expect(find.text('Scones has no recipe'), findsOneWidget);
      expect(find.text('Nothing yet. Add the stock you used.'), findsOneWidget);
    });
  });

  group('RecipeScreen', () {
    Future<FakeConvex> open(
      WidgetTester tester,
      Map product, {
      String role = 'manager',
      Handler? update,
    }) => launch(
      tester,
      RecipeScreen(product: product),
      fakeWith({
        'products:list': (_) => [scones, flour],
        'products:update': update ?? (_) => null,
      }),
      role: role,
    );

    testWidgets('a new recipe: pick ingredients, check them, save', (
      tester,
    ) async {
      final convex = await open(tester, {'_id': 'p1', 'name': 'Scones'});
      expect(find.text('Recipe: Scones'), findsOneWidget);
      expect(find.textContaining('Pick ingredients'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextFormField, 'Unit'), 'ea');
      await tapOn(tester, find.text('Save recipe'));
      expect(find.text('Add at least one ingredient'), findsOneWidget);

      await tapOn(tester, find.text('Add'));
      await tapOn(tester, find.byType(CloseButton));
      await tapOn(tester, find.text('Add'));
      await tapOn(tester, find.text('Flour'));
      await tapOn(tester, find.text('Save recipe'));
      expect(find.text('Enter a number'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextFormField, 'Qty'), '2');
      await tester.enterText(
        find.widgetWithText(TextFormField, 'One batch makes'),
        '12',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Shelf life (days)'),
        '3',
      );
      await tapOn(tester, find.text('Save recipe'));
      expect(convex.callsTo('products:update').single.args, {
        'id': 'p1',
        'kind': 'made',
        'unit': 'ea',
        'recipe': {
          'yieldQty': 12.0,
          'shelfLifeDays': 3.0,
          'ingredients': [
            {
              'productId': 'p2',
              'productName': 'Flour',
              'qty': 2.0,
              'unit': 'kg',
            },
          ],
        },
        'businessId': 'b1',
        'sessionToken': 'tok',
      });
      expect(find.text('Recipe saved'), findsOneWidget);
      expect(find.byType(RecipeScreen), findsNothing);
    });

    testWidgets('an existing recipe is filled in; removing an ingredient', (
      tester,
    ) async {
      final convex = await open(tester, {
        ...scones,
        'recipe': {...scones['recipe'] as Map, 'shelfLifeDays': 2},
      }, update: fails('Shelf life can\'t be negative'));
      expect(find.widgetWithText(TextFormField, '12'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, '2'), findsNWidgets(2));
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Unit').first,
        ' ',
      );
      await tapOn(tester, find.text('Save recipe'));
      expect(find.text('Required'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Unit').first,
        'ea',
      );
      await tapOn(tester, find.text('Save recipe'));
      expect(convex.callsTo('products:update'), hasLength(1));
      expect(find.text('Shelf life can\'t be negative'), findsOneWidget);
      expect(find.byType(RecipeScreen), findsOneWidget);
      await tapOn(tester, find.byTooltip('Remove'));
      expect(find.text('Flour'), findsNothing);
    });

    testWidgets('staff can read a recipe but not change it', (tester) async {
      await open(tester, scones, role: 'staff');
      expect(find.text('Flour'), findsOneWidget);
      expect(find.text('Save recipe'), findsNothing);
      expect(find.text('Add'), findsNothing);
      expect(find.byTooltip('Remove'), findsNothing);
    });
  });
}
