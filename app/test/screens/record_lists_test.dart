// Read-only list screens: expiring stock, trace & recall, products.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/screens/delivery_detail_screen.dart';
import 'package:jampacked/screens/expiring_screen.dart';
import 'package:jampacked/screens/lot_detail_screen.dart';
import 'package:jampacked/screens/production_screen.dart';
import 'package:jampacked/screens/products_screen.dart';
import 'package:jampacked/screens/trace_screen.dart';

import '../fixtures.dart';
import '../helpers.dart';

void main() {
  group('ExpiringScreen', () {
    testWidgets('empty state', (tester) async {
      await pumpScreen(tester, const ExpiringScreen(), convex: fakeWith());
      expect(find.text('Nothing expiring soon'), findsOneWidget);
    });

    testWidgets('labels past use-by, past best-before, today and days left', (
      tester,
    ) async {
      Map<String, dynamic> it(
        String name,
        int expiresAt, {
        bool useBy = true,
        String? batch,
      }) => {
        'productName': name,
        'expiresAt': expiresAt,
        if (useBy) 'useBy': expiresAt else 'bestBefore': expiresAt,
        'batchCode': batch,
        'storageType': 'chilled',
        '_id': name,
        'receivedAt': t0,
        'qtyOnHand': 2,
        'unit': 'kg',
      };
      await pumpScreen(
        tester,
        const ExpiringScreen(),
        convex: fakeWith({
          'stock:expiring': (_) => [
            it('Old milk', msAgo(const Duration(days: 1)), batch: 'L1'),
            it('Old crackers', msAgo(const Duration(days: 1)), useBy: false),
            it('Ham', msFromNow(const Duration(hours: 5))),
            it('Cheese', msFromNow(const Duration(days: 2, hours: 12))),
          ],
        }),
      );
      expect(find.text('DISCARD'), findsOneWidget);
      expect(find.text('PAST BB'), findsOneWidget);
      expect(find.text('Today'), findsOneWidget);
      expect(find.text('3d'), findsOneWidget);
      expect(find.textContaining('· Batch L1'), findsOneWidget);
      expect(find.textContaining('Best before'), findsOneWidget);
      expect(
        find.textContaining('Received 6 May 2024 · 2 kg on hand'),
        findsNWidgets(4),
      );
      await tapOn(tester, find.text('Ham'));
      expect(find.byType(LotDetailScreen), findsOneWidget);
    });
  });

  group('TraceScreen', () {
    Map<String, dynamic> hit(
      String name, {
      bool accepted = true,
      bool voided = false,
      String? batch = 'LOT1',
    }) => {
      'deliveryId': 'd1',
      'productName': name,
      'supplierName': 'Fresh Foods',
      'receivedAt': t0,
      'batchCode': batch,
      'quantity': 3,
      'unit': 'ea',
      'receivedByName': 'Sam',
      'accepted': accepted,
      'voided': voided,
    };

    testWidgets('prompts for a search, then shows matches with status', (
      tester,
    ) async {
      final convex = fakeWith({
        'deliveries:trace': (a) => a['search'] == 'none'
            ? []
            : [
                hit('Milk'),
                hit('Fish', accepted: false, batch: null),
                hit('Eggs', voided: true),
              ],
      });
      await pumpScreen(tester, const TraceScreen(), convex: convex);
      expect(find.text('Find affected stock'), findsOneWidget);

      await tester.enterText(find.byType(TextField), ' LOT1 ');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      expect(convex.callsTo('deliveries:trace').last.args['search'], 'LOT1');
      expect(find.text('Accepted'), findsOneWidget);
      expect(find.text('Rejected'), findsOneWidget);
      expect(find.text('VOID'), findsOneWidget);
      expect(find.textContaining('Batch - · 3 ea · by Sam'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'none');
      await tester.tap(find.byIcon(Icons.arrow_forward));
      await tester.pumpAndSettle();
      expect(find.text('No matches'), findsOneWidget);
    });

    testWidgets('tapping a match opens the delivery', (tester) async {
      await pumpScreen(
        tester,
        const TraceScreen(),
        convex: fakeWith({
          'deliveries:trace': (_) => [hit('Milk')],
        }),
      );
      await tester.enterText(find.byType(TextField), 'milk');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      await tapOn(tester, find.text('Milk'));
      expect(find.byType(DeliveryDetailScreen), findsOneWidget);
    });

    Map<String, dynamic> stocked(
      String name,
      String status, {
      List dispatched = const [],
    }) => {
      ...hit(name),
      'lot': {
        '_id': 'lot-$name',
        'status': status,
        'qtyOnHand': 2,
        'dispatched': dispatched,
      },
    };

    Future<FakeConvex> search(
      WidgetTester tester, {
      String role = 'admin',
      Handler? recall,
    }) async {
      final convex = await pumpScreen(
        tester,
        const TraceScreen(),
        convex: fakeWith({
          'deliveries:trace': (_) => [
            stocked(
              'Milk',
              'available',
              dispatched: [
                {'customer': 'Cafe Two', 'qty': 1, 'at': t0},
              ],
            ),
            stocked('Cream', 'hold'),
            stocked('Butter', 'available'),
            hit('Fish', accepted: false),
          ],
          'stock:recall':
              recall ?? (_) => {'held': 2, 'correctiveActionId': 'c1'},
        }),
        role: role,
      );
      await tester.enterText(find.byType(TextField), 'LOT1');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      return convex;
    }

    testWidgets('shows stock left, who it went to, and held lots', (
      tester,
    ) async {
      await search(tester, role: 'staff');
      expect(find.textContaining('2 ea still in stock'), findsNWidgets(3));
      expect(find.textContaining('Dispatched to Cafe Two (1)'), findsOneWidget);
      expect(find.text('ON HOLD'), findsOneWidget);
      expect(find.textContaining('Recall:'), findsNothing); // staff
    });

    testWidgets('managers recall: holds the lots still available', (
      tester,
    ) async {
      final convex = await search(tester);
      await tapOn(tester, find.text('Recall: hold 2 lot(s) still in stock'));
      await tapOn(tester, find.text('Cancel'));
      expect(convex.callsTo('stock:recall'), isEmpty);
      await tapOn(tester, find.text('Recall: hold 2 lot(s) still in stock'));
      await answerDialog(tester, 'Supplier recall', button: 'Hold stock');
      expect(convex.callsTo('stock:recall').single.args, {
        'lotIds': ['lot-Milk', 'lot-Butter'],
        'reason': 'Supplier recall',
        'businessId': 'b1',
        'sessionToken': 'tok',
      });
      expect(
        find.text('2 lot(s) on hold. Corrective action raised'),
        findsOneWidget,
      );
    });

    testWidgets('a failed recall shows the error', (tester) async {
      await search(tester, recall: fails('None of that stock is available'));
      await tapOn(tester, find.text('Recall: hold 2 lot(s) still in stock'));
      await answerDialog(tester, 'x', button: 'Hold stock');
      expect(find.text('None of that stock is available'), findsOneWidget);
    });

    Map<String, dynamic> madeHit({String status = 'available'}) => {
      '_id': 'r1',
      'productName': 'Scones',
      'batchCode': 'P0001',
      'qty': 12,
      'unit': 'ea',
      'madeAt': t0,
      'madeByName': 'Sam',
      'inputs': [
        {'productName': 'Flour', 'batchCode': 'LOT1'},
        {'productName': 'Water'},
      ],
      'lot': {
        '_id': 'lot-r1',
        'status': status,
        'qtyOnHand': 7,
        'dispatched': [
          {'customer': 'Corner Store', 'qty': 5, 'at': t0},
        ],
      },
    };

    testWidgets('batches made from it show up, and can be recalled too', (
      tester,
    ) async {
      final convex = await pumpScreen(
        tester,
        const TraceScreen(),
        convex: fakeWith({
          'deliveries:trace': (_) => [
            {
              ...stocked('Flour', 'available'),
              'lot': {
                ...stocked('Flour', 'available')['lot'],
                'usedIn': [
                  {'reason': 'Made Scones batch P0001'},
                ],
              },
            },
          ],
          'production:trace': (_) => [madeHit(), madeHit(status: 'hold')],
          'production:get': (_) => null,
          'stock:recall': (_) => {'held': 2, 'correctiveActionId': 'c1'},
        }),
      );
      await tester.enterText(find.byType(TextField), 'LOT1');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      expect(find.text('RECEIVED'), findsOneWidget);
      expect(find.text('MADE HERE'), findsOneWidget);
      expect(find.textContaining('Made Scones batch P0001'), findsOneWidget);
      expect(
        find.textContaining('From Flour (LOT1), Water (-)'),
        findsNWidgets(2),
      );
      expect(
        find.textContaining('Dispatched to Corner Store (5)'),
        findsNWidgets(2),
      );
      expect(find.text('Made'), findsOneWidget);
      expect(find.text('ON HOLD'), findsOneWidget);
      await tapOn(tester, find.text('Recall: hold 2 lot(s) still in stock'));
      await answerDialog(tester, 'Flour recall', button: 'Hold stock');
      expect(convex.callsTo('stock:recall').single.args['lotIds'], [
        'lot-Flour',
        'lot-r1',
      ]);
      await tapOn(tester, find.text('Scones').first);
      expect(find.byType(ProductionRunScreen), findsOneWidget);
    });

    testWidgets('only made batches: no section headings for received', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const TraceScreen(),
        convex: fakeWith({
          'production:trace': (_) => [madeHit()],
        }),
        role: 'staff',
      );
      await tester.enterText(find.byType(TextField), 'scones');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      expect(find.text('RECEIVED'), findsNothing);
      expect(find.text('MADE HERE'), findsOneWidget);
    });
  });

  group('ProductsScreen', () {
    testWidgets('managers set par levels; staff cannot', (tester) async {
      final list = [
        {
          '_id': 'p1',
          'name': 'Milk',
          'storageType': 'chilled',
          'allergens': <String>[],
          'parLevel': 10,
          'reorderQty': 12,
        },
        {
          '_id': 'p2',
          'name': 'Salt',
          'storageType': 'ambient',
          'allergens': <String>[],
          'parLevel': 2,
        },
      ];
      final convex = await pumpScreen(
        tester,
        const ProductsScreen(),
        convex: fakeWith({
          'products:list': (_) => list,
          'products:update': (_) => null,
        }),
      );
      expect(find.text('Par 10 · order 12'), findsOneWidget);
      expect(find.text('Par 2'), findsOneWidget);
      await tapOn(tester, find.text('Milk'));
      await tapOn(tester, find.text('Reorder level'));
      expect(find.text('Reorder Milk'), findsOneWidget);
      await tapOn(tester, find.text('Cancel'));
      expect(convex.callsTo('products:update'), isEmpty);

      await tapOn(tester, find.text('Salt'));
      await tapOn(tester, find.text('Reorder level'));
      final fields = find.descendant(
        of: find.byType(AlertDialog),
        matching: find.byType(TextField),
      );
      await tester.enterText(fields.first, '5');
      await tester.enterText(fields.last, '20');
      await tapOn(tester, find.text('Save'));
      expect(convex.callsTo('products:update').single.args, {
        'id': 'p2',
        'parLevel': 5.0,
        'reorderQty': 20.0,
        'businessId': 'b1',
        'sessionToken': 'tok',
      });

      await pumpScreen(
        tester,
        const ProductsScreen(),
        convex: fakeWith({'products:list': (_) => list}),
        role: 'staff',
      );
      await tapOn(tester, find.text('Milk'));
      expect(find.text('Reorder level'), findsNothing);
    });

    testWidgets('empty state', (tester) async {
      await pumpScreen(tester, const ProductsScreen(), convex: fakeWith());
      expect(find.text('No products yet'), findsOneWidget);
    });

    testWidgets('shows NOVA, barcode and allergens, and filters by name', (
      tester,
    ) async {
      Map<String, dynamic> p(
        String name, {
        int? nova,
        String? barcode,
        List<String> allergens = const [],
      }) => {
        'name': name,
        'storageType': 'ambient',
        'novaGroup': nova,
        'barcode': barcode,
        'allergens': allergens,
      };
      await pumpScreen(
        tester,
        const ProductsScreen(),
        convex: fakeWith({
          'products:list': (_) => [
            p('Chips', nova: 4, barcode: '9400001', allergens: ['soy']),
            p('Bread', nova: 3),
            p('Apples', nova: 1),
            p('Salt'),
          ],
        }),
      );
      expect(find.text('NOVA 4'), findsOneWidget);
      expect(find.text('NOVA 3'), findsOneWidget);
      expect(find.text('NOVA 1'), findsOneWidget);
      expect(find.text('9400001'), findsOneWidget);
      expect(find.text('soy'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'CHI');
      await tester.pumpAndSettle();
      expect(find.text('Chips'), findsOneWidget);
      expect(find.text('Bread'), findsNothing);
      await tester.enterText(find.byType(TextField), 'zzz');
      await tester.pumpAndSettle();
      expect(find.text('No products yet'), findsOneWidget);
    });

    testWidgets('filters supplies and made products; shows recipes', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const ProductsScreen(),
        convex: fakeWith({
          'products:list': (_) => [
            {
              '_id': 'p1',
              'name': 'Flour',
              'storageType': 'ambient',
              'allergens': <String>[],
            },
            {
              '_id': 'p2',
              'name': 'Scones',
              'kind': 'made',
              'storageType': 'ambient',
              'allergens': <String>[],
              'recipe': {
                'yieldQty': 12,
                'ingredients': [
                  {'productName': 'Flour'},
                  {'productName': 'Butter'},
                ],
              },
            },
          ],
        }),
      );
      expect(find.text('Made here'), findsNWidgets(2)); // chip and pill
      expect(find.text('Recipe: Flour, Butter'), findsOneWidget);
      await tapOn(tester, find.text('Supplies'));
      expect(find.text('Scones'), findsNothing);
      expect(find.text('Flour'), findsOneWidget);
      await tapOn(tester, find.widgetWithText(ChoiceChip, 'Made here'));
      expect(find.text('Flour'), findsNothing);
      await tester.enterText(find.byType(TextField), 'zzz');
      await tester.pumpAndSettle();
      expect(find.textContaining('Add a product you make'), findsOneWidget);
      await tapOn(tester, find.text('Supplies'));
      expect(
        find.textContaining('Supplies are added automatically'),
        findsOneWidget,
      );
      await tapOn(tester, find.text('All'));
      expect(find.textContaining('or make a batch'), findsOneWidget);
    });

    testWidgets('managers open or add a recipe; staff can only read one', (
      tester,
    ) async {
      final list = [
        {
          '_id': 'p1',
          'name': 'Flour',
          'storageType': 'ambient',
          'allergens': <String>[],
        },
        {
          '_id': 'p2',
          'name': 'Scones',
          'storageType': 'ambient',
          'allergens': <String>[],
          'recipe': {'yieldQty': 12, 'ingredients': []},
        },
      ];
      await pumpScreen(
        tester,
        const ProductsScreen(kind: 'supply'),
        convex: fakeWith({'products:list': (_) => list}),
      );
      await tapOn(tester, find.text('Flour'));
      await tapOn(tester, find.text('Add a recipe'));
      expect(find.byType(RecipeScreen), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tapOn(tester, find.text('Scones'));
      await tapOn(tester, find.text('Recipe'));
      expect(find.text('Recipe: Scones'), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tapOn(tester, find.text('Flour'));
      await tester.tapAt(const Offset(5, 5)); // dismiss the sheet
      await tester.pumpAndSettle();
      expect(find.byType(RecipeScreen), findsNothing);

      await pumpScreen(
        tester,
        const ProductsScreen(),
        convex: fakeWith({'products:list': (_) => list}),
        role: 'staff',
      );
      expect(find.text('Product you make'), findsNothing);
      await tapOn(tester, find.text('Flour'));
      expect(find.byType(RecipeScreen), findsNothing);
      await tapOn(tester, find.text('Scones'));
      expect(find.text('Recipe: Scones'), findsOneWidget);
    });

    testWidgets('a new product you make is named, then given a recipe', (
      tester,
    ) async {
      final convex = await pumpScreen(
        tester,
        const ProductsScreen(),
        convex: fakeWith({'products:create': (_) => 'p9'}),
      );
      await tapOn(tester, find.text('Product you make'));
      await tapOn(tester, find.text('Cancel'));
      await tapOn(tester, find.text('Product you make'));
      await answerDialog(tester, ' ', button: 'Next');
      expect(convex.callsTo('products:create'), isEmpty);
      await tapOn(tester, find.text('Product you make'));
      await answerDialog(tester, 'Pie', button: 'Next');
      expect(convex.callsTo('products:create').single.args, {
        'name': 'Pie',
        'kind': 'made',
        'storageType': 'chilled',
        'allergens': <String>[],
        'businessId': 'b1',
        'sessionToken': 'tok',
      });
      expect(find.text('Recipe: Pie'), findsOneWidget);

      convex.handlers['products:create'] = fails('Product name is required');
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tapOn(tester, find.text('Product you make'));
      await answerDialog(tester, 'X', button: 'Next');
      expect(find.text('Product name is required'), findsOneWidget);
      expect(find.byType(RecipeScreen), findsNothing);
    });
  });
}
