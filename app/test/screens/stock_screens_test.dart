import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/screens/locations_screen.dart';
import 'package:foodsafe/screens/lot_detail_screen.dart';
import 'package:foodsafe/screens/stock_screen.dart';
import 'package:foodsafe/screens/stocktake_screen.dart';

import '../fixtures.dart';
import '../helpers.dart';

final activeLocations = locations.where((l) => l['active'] == true).toList();

void main() {
  group('StockScreen: on hand', () {
    testWidgets('empty state; staff get no manager actions', (tester) async {
      await pumpScreen(
        tester,
        const StockScreen(),
        convex: fakeWith(),
        role: 'staff',
      );
      expect(find.text('No stock on hand'), findsOneWidget);
      expect(find.byTooltip('Add stock'), findsNothing);
      expect(find.byTooltip('Locations'), findsNothing);
      expect(find.byType(ChoiceChip), findsNothing); // no locations yet
    });

    testWidgets(
      'lists lots with hold, expiry and location; filters by location',
      (tester) async {
        final convex = await pumpScreen(
          tester,
          const StockScreen(),
          convex: fakeWith({
            'locations:list': (_) => activeLocations,
            'stock:onHand': (a) => a['locationId'] == 'loc1'
                ? [lot(name: 'Cold one', location: 'Chiller 1')]
                : [
                    lot(useBy: msAgo(const Duration(days: 1))),
                    lot(
                      id: 'l2',
                      name: 'Crackers',
                      bestBefore: msAgo(const Duration(days: 1)),
                    ),
                    lot(
                      id: 'l3',
                      name: 'Ham',
                      status: 'hold',
                      useBy: msFromNow(const Duration(days: 2)),
                      expiringSoon: true,
                    ),
                    lot(
                      id: 'l4',
                      name: 'Jam',
                      bestBefore: msFromNow(const Duration(days: 90)),
                    ),
                    lot(id: 'l5', name: 'Salt'),
                  ],
          }),
        );
        expect(find.text('DISCARD'), findsOneWidget);
        expect(find.text('PAST BB'), findsOneWidget);
        expect(find.text('ON HOLD'), findsOneWidget);
        expect(find.textContaining('Use by'), findsOneWidget);
        expect(find.textContaining('BB '), findsOneWidget);
        expect(find.text('No date'), findsOneWidget);
        expect(find.text('6 ea · Batch B1'), findsNWidgets(5));

        await tapOn(tester, find.text('Chiller 1'));
        expect(convex.callsTo('stock:onHand').last.args['locationId'], 'loc1');
        expect(find.text('6 ea · Batch B1 · Chiller 1'), findsOneWidget);
        await tapOn(tester, find.text('All'));
        expect(convex.callsTo('stock:onHand').last.args['locationId'], isNull);

        await tapOn(tester, find.text('Ham'));
        expect(find.byType(LotDetailScreen), findsOneWidget);
      },
    );

    testWidgets('managers reach locations and add stock', (tester) async {
      await pumpScreen(tester, const StockScreen(), convex: fakeWith());
      await tapOn(tester, find.byTooltip('Locations'));
      expect(find.byType(LocationsScreen), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tapOn(tester, find.byTooltip('Add stock'));
      expect(find.byType(AddStockScreen), findsOneWidget);
    });
  });

  group('StockScreen: low stock & stocktakes', () {
    testWidgets('low stock lists products below par', (tester) async {
      await pumpScreen(
        tester,
        const StockScreen(),
        convex: fakeWith({
          'stock:lowStock': (_) => [
            {
              'productId': 'p1',
              'name': 'Milk',
              'parLevel': 10,
              'onHand': 4,
              'reorderQty': 12,
            },
            {'productId': 'p2', 'name': 'Eggs', 'parLevel': 6, 'onHand': 0},
          ],
        }),
      );
      await tapOn(tester, find.text('Low stock'));
      expect(find.text('4 on hand · par 10'), findsOneWidget);
      expect(find.text('Order 12'), findsOneWidget);
      expect(find.text('0 on hand · par 6'), findsOneWidget);
    });

    testWidgets('low stock empty state', (tester) async {
      await pumpScreen(tester, const StockScreen(), convex: fakeWith());
      await tapOn(tester, find.text('Low stock'));
      expect(find.text('Nothing below par'), findsOneWidget);
    });

    testWidgets('stocktakes list; staff cannot start one', (tester) async {
      await pumpScreen(
        tester,
        const StockScreen(),
        convex: fakeWith({
          'stocktakes:list': (_) => [
            {
              '_id': 's1',
              'title': 'Stocktake',
              'status': 'completed',
              'startedAt': t0,
              'startedByName': 'Kim',
              'counted': 3,
              'total': 3,
              'variances': 1,
            },
            {
              '_id': 's2',
              'title': 'Stocktake: Freezer',
              'status': 'in_progress',
              'startedAt': t0,
              'startedByName': 'Kim',
              'counted': 0,
              'total': 2,
              'variances': 0,
            },
          ],
        }),
        role: 'staff',
      );
      await tapOn(tester, find.text('Stocktakes'));
      expect(find.text('Done'), findsOneWidget);
      expect(find.text('In progress'), findsOneWidget);
      expect(
        find.textContaining('3/3 counted · 1 difference(s)'),
        findsOneWidget,
      );
      expect(find.text('Start stocktake'), findsNothing);
      await tapOn(tester, find.text('Stocktake: Freezer'));
      expect(find.byType(StocktakeScreen), findsOneWidget);
    });

    testWidgets('start a stocktake of one location, or everything', (
      tester,
    ) async {
      final convex = await pumpScreen(
        tester,
        const StockScreen(),
        convex: fakeWith({
          'locations:list': (_) => activeLocations,
          'stocktakes:start': (_) => 's9',
        }),
      );
      await tapOn(tester, find.text('Stocktakes'));
      expect(find.text('No stocktakes yet'), findsOneWidget);

      await tapOn(tester, find.text('Start stocktake'));
      await tapOn(tester, find.text('Chiller 1').last);
      expect(
        convex.callsTo('stocktakes:start').last.args['locationId'],
        'loc1',
      );
      expect(find.byType(StocktakeScreen), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();

      await tapOn(tester, find.text('Start stocktake'));
      await tapOn(tester, find.text('Everything'));
      expect(
        convex.callsTo('stocktakes:start').last.args.containsKey('locationId'),
        isFalse,
      );
      await tester.pageBack();
      await tester.pumpAndSettle();

      // Dismissing the choice starts nothing.
      await tapOn(tester, find.text('Start stocktake'));
      await tester.tapAt(const Offset(5, 5));
      await tester.pumpAndSettle();
      expect(convex.callsTo('stocktakes:start'), hasLength(2));
    });

    testWidgets('start errors show and stay on the list', (tester) async {
      final convex = await pumpScreen(
        tester,
        const StockScreen(),
        convex: fakeWith({
          'stocktakes:start': fails('There is no stock on hand to count'),
        }),
      );
      await tapOn(tester, find.text('Stocktakes'));
      await tapOn(tester, find.text('Start stocktake'));
      await tapOn(tester, find.text('Everything'));
      expect(find.text('There is no stock on hand to count'), findsOneWidget);
      expect(find.byType(StocktakeScreen), findsNothing);
      expect(convex.callsTo('stocktakes:start'), hasLength(1));
    });

    testWidgets('locations failing to load stops the start', (tester) async {
      final convex = await pumpScreen(
        tester,
        const StockScreen(),
        convex: fakeWith({'stocktakes:start': (_) => 's1'}),
      );
      await tapOn(tester, find.text('Stocktakes'));
      convex.handlers['locations:list'] = fails('offline');
      await tapOn(tester, find.text('Start stocktake'));
      expect(find.text('offline'), findsOneWidget);
      expect(find.byType(SimpleDialog), findsNothing);
      expect(convex.callsTo('stocktakes:start'), isEmpty);
    });
  });

  group('AddStockScreen', () {
    testWidgets('validates, then adds with location and use-by', (
      tester,
    ) async {
      final convex = await pumpScreen(
        tester,
        Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () => Navigator.of(
                context,
              ).push(MaterialPageRoute(builder: (_) => const AddStockScreen())),
              child: const Text('open'),
            ),
          ),
        ),
        convex: fakeWith({
          'locations:list': (_) => activeLocations,
          'stock:addLot': (_) => 'l9',
        }),
      );
      await tapOn(tester, find.text('open'));
      await tester.enterText(find.widgetWithText(TextFormField, 'Unit'), '');
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Where did it come from?'),
        '',
      );
      await tapOn(tester, find.text('Add'));
      expect(find.text('Required'), findsNWidgets(3));
      expect(find.text('Enter a number'), findsOneWidget);

      await tester.enterText(
        find.widgetWithText(TextFormField, 'Product'),
        ' Flour ',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Quantity'),
        '20',
      );
      await tester.enterText(find.widgetWithText(TextFormField, 'Unit'), 'kg');
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Where did it come from?'),
        'Opening stock',
      );
      await tapOn(tester, find.text('Ambient'));
      await tapOn(tester, find.text('Use by'));
      await tapOn(tester, find.text('OK'));
      expect(find.textContaining('Use by '), findsOneWidget);
      await tapOn(tester, find.text('Not set'));
      await tapOn(tester, find.text('Chiller 1').last);
      await tapOn(tester, find.text('Add'));
      final args = convex.callsTo('stock:addLot').single.args;
      expect(args, containsPair('productName', 'Flour'));
      expect(args, containsPair('qty', 20.0));
      expect(args, containsPair('unit', 'kg'));
      expect(args, containsPair('storageType', 'ambient'));
      expect(args, containsPair('locationId', 'loc1'));
      expect(args, containsPair('batchCode', null));
      expect(args['useBy'], isA<int>());
      expect(find.byType(AddStockScreen), findsNothing);
      expect(find.text('Added to stock'), findsOneWidget);
    });

    testWidgets(
      'batch is sent; cancelling the date keeps it unset; errors stay',
      (tester) async {
        final convex = await pumpScreen(
          tester,
          const AddStockScreen(),
          convex: fakeWith({
            'stock:addLot': fails('Quantity must be more than 0'),
          }),
        );
        await tester.enterText(
          find.widgetWithText(TextFormField, 'Product'),
          'X',
        );
        await tester.enterText(
          find.widgetWithText(TextFormField, 'Quantity'),
          '1',
        );
        await tester.enterText(
          find.widgetWithText(TextFormField, 'Batch / lot code'),
          'L7',
        );
        await tapOn(tester, find.text('Use by'));
        await tapOn(tester, find.text('Cancel'));
        expect(find.text('Use by'), findsOneWidget);
        await tapOn(tester, find.text('Add'));
        expect(convex.callsTo('stock:addLot').single.args['batchCode'], 'L7');
        expect(find.text('Quantity must be more than 0'), findsOneWidget);
        expect(find.byType(AddStockScreen), findsOneWidget);
      },
    );
  });

  group('LotDetailScreen', () {
    Map<String, dynamic> detail(Map<String, dynamic> l) => {
      'lot': l,
      'locationName': 'Chiller 1',
      'movements': [
        {
          'type': 'dispatch',
          'qty': -2,
          'qtyAfter': 4,
          'customer': 'Cafe Two',
          'at': t0,
          'byName': 'Sam',
        },
        {
          'type': 'hold',
          'qty': 0,
          'qtyAfter': 6,
          'reason': 'Check seal',
          'at': t0,
          'byName': 'Sam',
        },
        {'type': 'receive', 'qty': 6, 'qtyAfter': 6, 'at': t0, 'byName': 'Sam'},
      ],
    };

    Future<FakeConvex> pumpLot(
      WidgetTester tester,
      Map<String, dynamic> l, {
      String role = 'admin',
      Map<String, Handler> extra = const {},
    }) => pumpScreen(
      tester,
      const LotDetailScreen(id: 'l1'),
      convex: fakeWith({
        'stock:lot': (_) => detail(l),
        'locations:list': (_) => activeLocations,
        'stock:move': (_) => null,
        'stock:transfer': (_) => null,
        'stock:hold': (_) => null,
        'stock:release': (_) => null,
        ...extra,
      }),
      role: role,
    );

    testWidgets('not found', (tester) async {
      await pumpScreen(
        tester,
        const LotDetailScreen(id: 'x'),
        convex: fakeWith(),
      );
      expect(find.text('Stock not found'), findsOneWidget);
    });

    testWidgets('shows details and history', (tester) async {
      await pumpLot(
        tester,
        lot(qty: 4, useBy: msFromNow(const Duration(days: 9))),
      );
      expect(find.text('4 ea on hand'), findsOneWidget);
      expect(find.text('6 ea on 6 May 2024'), findsOneWidget);
      expect(find.text('Fresh Foods'), findsOneWidget);
      expect(find.text('Chiller 1'), findsOneWidget);
      expect(find.text('Dispatched -2 ea to Cafe Two'), findsOneWidget);
      expect(find.text('Put on hold'), findsOneWidget);
      expect(find.textContaining('Check seal'), findsOneWidget);
      expect(find.text('Received +6 ea'), findsOneWidget);
    });

    for (final (button, type, note, noteKey) in [
      ('Use', 'use', null, null),
      ('Sell', 'sell', null, null),
      ('Dispatch', 'dispatch', 'Cafe Two', 'customer'),
      ('Waste', 'waste', 'Dropped', 'reason'),
      ('Adjust', 'adjust', 'Miscount', 'reason'),
    ]) {
      testWidgets('$button records a $type movement', (tester) async {
        final convex = await pumpLot(tester, lot());
        await tapOn(tester, find.widgetWithText(OutlinedButton, button));
        final fields = find.descendant(
          of: find.byType(AlertDialog),
          matching: find.byType(TextField),
        );
        await tester.enterText(fields.first, type == 'adjust' ? '-1' : '2');
        if (note != null) await tester.enterText(fields.last, note);
        await tapOn(tester, find.text('Save'));
        expect(convex.callsTo('stock:move').single.args, {
          'lotId': 'l1',
          'type': type,
          'qty': type == 'adjust' ? -1.0 : 2.0,
          'businessId': 'b1',
          'sessionToken': 'tok',
          ?noteKey: note,
        });
      });
    }

    testWidgets('cancelling a movement sends nothing; bad numbers send 0', (
      tester,
    ) async {
      final convex = await pumpLot(tester, lot());
      await tapOn(tester, find.widgetWithText(OutlinedButton, 'Use'));
      await tapOn(tester, find.text('Cancel'));
      expect(convex.callsTo('stock:move'), isEmpty);
      await tapOn(tester, find.widgetWithText(OutlinedButton, 'Use'));
      await tapOn(tester, find.text('Save'));
      expect(convex.callsTo('stock:move').single.args['qty'], 0);
    });

    testWidgets('move to another location', (tester) async {
      final convex = await pumpLot(tester, lot());
      await tapOn(tester, find.widgetWithText(OutlinedButton, 'Move'));
      await tapOn(tester, find.text('Chiller 1').last);
      expect(
        convex.callsTo('stock:transfer').single.args['locationId'],
        'loc1',
      );
      expect(find.text('Moved'), findsOneWidget);
    });

    testWidgets('move: dismissed or failed location list does nothing', (
      tester,
    ) async {
      final convex = await pumpLot(tester, lot());
      await tapOn(tester, find.widgetWithText(OutlinedButton, 'Move'));
      await tester.tapAt(const Offset(5, 5));
      await tester.pumpAndSettle();
      convex.handlers['locations:list'] = fails('offline');
      await tapOn(tester, find.widgetWithText(OutlinedButton, 'Move'));
      expect(find.text('offline'), findsOneWidget);
      expect(convex.callsTo('stock:transfer'), isEmpty);
    });

    testWidgets('hold with a reason; staff see no adjust', (tester) async {
      final convex = await pumpLot(tester, lot(), role: 'staff');
      expect(find.widgetWithText(OutlinedButton, 'Adjust'), findsNothing);
      await tapOn(tester, find.widgetWithText(OutlinedButton, 'Hold'));
      await answerDialog(tester, 'Swollen', button: 'Hold');
      expect(convex.callsTo('stock:hold').single.args['reason'], 'Swollen');
      expect(find.text('On hold'), findsOneWidget);
    });

    testWidgets('held stock: only waste/move; managers release', (
      tester,
    ) async {
      final convex = await pumpLot(
        tester,
        lot(status: 'hold', holdReason: 'Recall: R1'),
      );
      expect(find.text('ON HOLD'), findsOneWidget);
      expect(find.text('Recall: R1'), findsOneWidget);
      for (final b in ['Use', 'Sell', 'Dispatch', 'Hold']) {
        expect(find.widgetWithText(OutlinedButton, b), findsNothing);
      }
      await tapOn(tester, find.widgetWithText(OutlinedButton, 'Release'));
      await tapOn(tester, find.text('Cancel'));
      expect(convex.callsTo('stock:release'), isEmpty);
      await tapOn(tester, find.widgetWithText(OutlinedButton, 'Release'));
      await answerDialog(tester, 'Supplier OK', button: 'Release');
      expect(
        convex.callsTo('stock:release').single.args['reason'],
        'Supplier OK',
      );
      expect(find.text('Released'), findsOneWidget);
    });

    testWidgets('staff cannot release held stock', (tester) async {
      await pumpLot(
        tester,
        lot(status: 'hold', holdReason: 'x'),
        role: 'staff',
      );
      expect(find.widgetWithText(OutlinedButton, 'Release'), findsNothing);
    });

    testWidgets('used-up stock has no actions', (tester) async {
      await pumpLot(tester, lot(status: 'depleted', qty: 0));
      expect(find.text('USED UP'), findsOneWidget);
      expect(find.text('ACTIONS'), findsNothing);
    });
  });

  group('StocktakeScreen', () {
    Map<String, dynamic> st({String status = 'in_progress'}) => {
      '_id': 's1',
      'title': 'Stocktake: Freezer',
      'status': status,
      'startedAt': t0,
      'startedByName': 'Kim',
      'completedAt': t0,
      'completedByName': 'Sam',
      'lines': [
        {
          'lotId': 'l1',
          'productName': 'Peas',
          'batchCode': 'P1',
          'unit': 'kg',
          'expected': 10,
          'counted': 8,
        },
        {
          'lotId': 'l2',
          'productName': 'Ice',
          'unit': 'bag',
          'expected': 4,
          'counted': 4,
        },
        {
          'lotId': 'l3',
          'productName': 'Fish',
          'unit': 'kg',
          'expected': 2,
          'counted': null,
        },
      ],
    };

    testWidgets('not found', (tester) async {
      await pumpScreen(
        tester,
        const StocktakeScreen(id: 'x'),
        convex: fakeWith(),
      );
      expect(find.text('Stocktake not found'), findsOneWidget);
    });

    testWidgets('counts lines and completes', (tester) async {
      final convex = await pumpScreen(
        tester,
        const StocktakeScreen(id: 's1'),
        convex: fakeWith({
          'stocktakes:get': (_) => st(),
          'stocktakes:count': (_) => null,
          'stocktakes:complete': (_) => null,
        }),
      );
      expect(find.textContaining('Started 6 May 2024'), findsOneWidget);
      expect(find.text('Expected 10 kg · Batch P1'), findsOneWidget);
      expect(find.text('-2 kg'), findsOneWidget);
      expect(find.text('Complete (1 left to count)'), findsOneWidget);

      final fish = find.byKey(const ValueKey('count-l3'));
      await tester.enterText(fish, 'x');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();
      expect(convex.callsTo('stocktakes:count'), isEmpty);
      await tester.enterText(fish, '2.5');
      await tester.testTextInput.receiveAction(TextInputAction.done);
      await tester.pumpAndSettle();
      expect(convex.callsTo('stocktakes:count').single.args, {
        'id': 's1',
        'lotId': 'l3',
        'counted': 2.5,
        'businessId': 'b1',
        'sessionToken': 'tok',
      });

      await tapOn(tester, find.text('Complete (1 left to count)'));
      expect(convex.callsTo('stocktakes:complete'), hasLength(1));
      expect(find.text('Stocktake complete. Stock corrected'), findsOneWidget);
    });

    testWidgets('completed stocktakes are read-only; staff cannot complete', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const StocktakeScreen(id: 's1'),
        convex: fakeWith({'stocktakes:get': (_) => st(status: 'completed')}),
      );
      expect(find.textContaining('Completed 6 May 2024'), findsOneWidget);
      expect(find.byType(TextFormField), findsNothing);
      expect(find.text('8'), findsOneWidget);
      expect(find.textContaining('Complete ('), findsNothing);
    });

    testWidgets(
      'all counted shows the plain complete button; staff have none',
      (tester) async {
        final s = st();
        (s['lines'] as List).removeLast();
        await pumpScreen(
          tester,
          const StocktakeScreen(id: 's1'),
          convex: fakeWith({'stocktakes:get': (_) => s}),
        );
        expect(find.text('Complete stocktake'), findsOneWidget);
        await pumpScreen(
          tester,
          const StocktakeScreen(id: 's1'),
          convex: fakeWith({'stocktakes:get': (_) => s}),
          role: 'staff',
        );
        expect(find.text('Complete stocktake'), findsNothing);
      },
    );
  });

  group('LocationsScreen', () {
    testWidgets('empty state', (tester) async {
      await pumpScreen(tester, const LocationsScreen(), convex: fakeWith());
      expect(find.text('No locations yet'), findsOneWidget);
    });

    testWidgets('lists all including retired; add and edit', (tester) async {
      final convex = await pumpScreen(
        tester,
        const LocationsScreen(),
        convex: fakeWith({
          'locations:list': (_) => locations,
          'locations:create': (_) => 'loc3',
          'locations:update': (_) => null,
        }),
      );
      expect(
        convex.callsTo('locations:list').first.args['includeInactive'],
        isTrue,
      );
      expect(find.text('RETIRED'), findsOneWidget);
      expect(find.text('Dry store'), findsOneWidget);

      await tapOn(tester, find.text('Add location'));
      await tester.enterText(find.byType(TextField), ' Freezer 2 ');
      await tapOn(tester, find.text('Chiller').last);
      await tapOn(tester, find.text('Freezer').last);
      await tapOn(tester, find.text('Save'));
      expect(convex.callsTo('locations:create').single.args, {
        'name': 'Freezer 2',
        'kind': 'freezer',
        'businessId': 'b1',
        'sessionToken': 'tok',
      });

      await tapOn(tester, find.text('Old shelf'));
      await tapOn(tester, find.text('In use'));
      await tapOn(tester, find.text('Save'));
      expect(convex.callsTo('locations:update').single.args, {
        'id': 'loc2',
        'name': 'Old shelf',
        'kind': 'dry',
        'active': true,
        'businessId': 'b1',
        'sessionToken': 'tok',
      });

      await tapOn(tester, find.text('Chiller 1'));
      await tapOn(tester, find.text('Cancel'));
      expect(convex.callsTo('locations:update'), hasLength(1));
    });
  });
}
