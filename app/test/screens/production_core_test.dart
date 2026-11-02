// Production as a core use case: the hub (planned batches, harvests), voiding a batch, harvest
// and batch checks on the form, planning, growing areas, recipe checks and the business type.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/screens/areas_screen.dart';
import 'package:jampacked/screens/dashboard_screen.dart';
import 'package:jampacked/screens/home_shell.dart';
import 'package:jampacked/screens/production_screen.dart';
import 'package:jampacked/screens/trace_screen.dart';
import 'package:jampacked/services/auth_service.dart';
import 'package:jampacked/widgets/common.dart';
import 'package:jampacked/widgets/product_picker.dart';

import '../fixtures.dart';
import '../helpers.dart';
import 'production_screen_test.dart' show launch, scones;

/// Signed in to a business of type [op].
AuthService authAs(FakeConvex c, String op, {String role = 'admin'}) {
  final b = Business('b1', 'Green Acres', 'NP1', role, operation: op);
  return AuthService(c)
    ..token = 'tok'
    ..user = userWith(role)
    ..businesses = [b]
    ..business = b
    ..loading = false;
}

final cooking = {
  'key': 'cooking',
  'name': 'Cooking',
  'description': 'Cook it through.',
  'production': 'make',
  'fields': [
    {'key': 'food', 'label': 'Food', 'type': 'text', 'required': true},
    {
      'key': 'coreTempC',
      'label': 'Centre temperature',
      'type': 'number',
      'unit': '°C',
      'required': true,
    },
  ],
};
final harvestCheck = {
  'key': 'harvest_check',
  'name': 'Harvest check',
  'description': 'At harvest.',
  'production': 'harvest',
  'fields': [
    {
      'key': 'clean',
      'label': 'Containers clean?',
      'type': 'yesno',
      'required': true,
    },
  ],
};
final brix = {
  'key': 'brix',
  'name': 'Brix',
  'description': 'Sugar.',
  'production': 'both',
  'fields': [
    {'key': 'b', 'label': 'Brix', 'type': 'number'},
  ],
};
final paddock = {
  '_id': 'a1',
  'name': 'North paddock',
  'kind': 'paddock',
  'active': true,
};

Map<String, dynamic> harvestRun({bool voided = false}) => {
  'run': {
    '_id': 'r1',
    'kind': 'harvest',
    'productName': 'Honey',
    'batchCode': 'P0002',
    'areaName': 'Hives',
    'qty': 20,
    'unit': 'kg',
    'madeAt': t0,
    'madeByName': 'Sam',
    'fromRecipe': false,
    'allergens': <String>[],
    'inputs': [],
    if (voided) ...{
      'voided': true,
      'voidedByName': 'Kim',
      'voidReason': 'Wrong hive',
    },
  },
  'lot': {
    '_id': 'l9',
    'status': 'available',
    'qtyOnHand': 20,
    'dispatched': [],
  },
  'checks': [
    {'recordName': 'Harvest check', 'issues': []},
    {
      'recordName': 'Tutin',
      'issues': ['Honey may not meet the tutin standard'],
    },
  ],
};

void main() {
  group('the hub', () {
    testWidgets('mixed: planned batches, harvests, voided batches', (
      tester,
    ) async {
      final today = localDayStartMs();
      final convex = fakeWith({
        'production:list': (_) => [harvestRun(voided: true)['run']],
        'production:get': (_) => harvestRun(),
        'production:planned': (_) => [
          {
            '_id': 'pl1',
            'kind': 'make',
            'productId': 'p1',
            'productName': 'Scones',
            'qty': 24,
            'unit': 'ea',
            'dueOn': today - 86400000,
            'hasRecipe': true,
            'short': [
              {'productName': 'Flour', 'unit': 'kg', 'short': 2},
            ],
          },
          {
            '_id': 'pl2',
            'kind': 'harvest',
            'productId': 'p3',
            'productName': 'Honey',
            'qty': 20,
            'dueOn': today,
            'areaName': 'Hives',
            'notes': 'Top boxes',
            'short': [],
          },
          {
            '_id': 'pl3',
            'kind': 'make',
            'productId': 'p1',
            'productName': 'Bread',
            'qty': 3,
            'dueOn': today + 3 * 86400000,
            'short': [],
          },
        ],
        'production:cancelPlanned': (_) => null,
        'production:plan': (_) => {
          'ingredients': [],
          'useBy': null,
          'checks': [],
        },
      });
      await pumpScreen(tester, const ProductionScreen(), convex: convex);
      expect(find.text('Production'), findsOneWidget);
      expect(find.textContaining('Overdue'), findsOneWidget);
      expect(find.text('⚠ Flour: 2 kg short'), findsOneWidget);
      expect(find.text('Today · Hives · Top boxes'), findsOneWidget);
      expect(find.text('Honey · 20'), findsOneWidget); // no unit
      expect(find.text('VOIDED'), findsOneWidget);
      expect(find.textContaining('Batch P0002 · Hives · '), findsOneWidget);

      await tapOn(tester, find.byTooltip('Cancel plan').first);
      expect(
        convex.callsTo('production:cancelPlanned').single.args['id'],
        'pl1',
      );

      await tapOn(tester, find.text('Start').first);
      final form = tester.widget<ProductionFormScreen>(
        find.byType(ProductionFormScreen),
      );
      expect(form.planned?['_id'], 'pl1');
      expect(convex.callsTo('production:plan').single.args['qty'], 24);
      await tester.pageBack();
      await tester.pumpAndSettle();

      await tapOn(tester, find.text('Record a harvest'));
      expect(
        tester
            .widget<ProductionFormScreen>(find.byType(ProductionFormScreen))
            .kind,
        'harvest',
      );
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tapOn(tester, find.text('Plan'));
      expect(find.byType(PlanBatchScreen), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tapOn(tester, find.byTooltip('Growing areas'));
      expect(find.byType(AreasScreen), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tapOn(tester, find.text('Honey · 20 kg'));
      expect(find.byType(ProductionRunScreen), findsOneWidget);
    });

    testWidgets('a farm harvests; staff can\'t plan', (tester) async {
      final convex = fakeWith();
      await pumpScreen(
        tester,
        const ProductionScreen(),
        convex: convex,
        auth: authAs(convex, 'farm', role: 'staff'),
      );
      expect(find.text('Harvest'), findsWidgets);
      expect(find.text('Products'), findsOneWidget);
      expect(find.text('RECENT HARVESTS'), findsOneWidget);
      expect(find.textContaining('Nothing harvested yet'), findsOneWidget);
      expect(find.text('Nothing planned.'), findsOneWidget);
      expect(find.text('Plan'), findsNothing);
      expect(find.text('Record a harvest'), findsNothing);
      await tapOn(tester, find.byType(FloatingActionButton));
      expect(
        tester
            .widget<ProductionFormScreen>(find.byType(ProductionFormScreen))
            .kind,
        'harvest',
      );
    });

    testWidgets('a kitchen has no harvests', (tester) async {
      final convex = fakeWith();
      await pumpScreen(
        tester,
        const ProductionScreen(),
        convex: convex,
        auth: authAs(convex, 'kitchen'),
      );
      expect(find.text('Kitchen'), findsOneWidget);
      expect(find.byTooltip('Growing areas'), findsNothing);
      expect(find.text('Record a harvest'), findsNothing);
    });
  });

  group('one batch', () {
    testWidgets('a harvest: where from, its checks, voided', (tester) async {
      await pumpScreen(
        tester,
        const ProductionRunScreen(id: 'r1'),
        convex: fakeWith({'production:get': (_) => harvestRun(voided: true)}),
      );
      expect(find.text('Harvested'), findsOneWidget);
      expect(find.text('Hives'), findsOneWidget);
      expect(find.text('Recipe'), findsNothing);
      expect(find.text('WHAT WENT IN'), findsNothing);
      expect(find.text('Passed'), findsOneWidget);
      expect(
        find.text('Honey may not meet the tutin standard'),
        findsOneWidget,
      );
      expect(find.textContaining('Voided by Kim: Wrong hive'), findsOneWidget);
      expect(find.text('Void this batch'), findsNothing);
    });

    testWidgets('managers void a batch with a reason', (tester) async {
      final convex = fakeWith({
        'production:get': (_) => harvestRun(),
        'production:voidRun': (_) => null,
      });
      await pumpScreen(
        tester,
        const ProductionRunScreen(id: 'r1'),
        convex: convex,
      );
      await tapOn(tester, find.text('Void this batch'));
      await tapOn(tester, find.text('Cancel'));
      expect(convex.callsTo('production:voidRun'), isEmpty);
      await tapOn(tester, find.text('Void this batch'));
      await tester.enterText(find.widgetWithText(TextField, 'Reason'), 'Typo');
      await tapOn(tester, find.text('Void'));
      expect(
        convex.callsTo('production:voidRun').single.args['reason'],
        'Typo',
      );
      expect(
        find.text('Batch voided: its stock has been put back'),
        findsOneWidget,
      );
    });

    testWidgets('staff can\'t void', (tester) async {
      await pumpScreen(
        tester,
        const ProductionRunScreen(id: 'r1'),
        convex: fakeWith({'production:get': (_) => harvestRun()}),
        role: 'staff',
      );
      expect(find.text('Void this batch'), findsNothing);
    });
  });

  group('the form', () {
    testWidgets('a harvest: area, no inputs, and its checks', (tester) async {
      final convex = await launch(
        tester,
        const ProductionFormScreen(kind: 'harvest'),
        fakeWith({
          'areas:list': (_) => [paddock],
          'programmes:current': (_) =>
              programme(records: [pestCheck, cooking, harvestCheck, brix]),
          'products:list': (_) => [],
          'production:create': (_) => 'r1',
        }),
      );
      expect(find.text('Save harvest'), findsOneWidget);
      expect(find.text('Cooking'), findsNothing); // a batch check
      expect(find.text('Pest check'), findsNothing); // not a check
      await tapOn(tester, find.text('Save harvest'));
      expect(find.text('Pick what you harvested'), findsOneWidget);

      await tapOn(tester, find.text('What did you harvest?'));
      expect(find.byType(ProductPickerScreen), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'Lamb');
      await tester.pumpAndSettle();
      await tapOn(tester, find.text('New: Lamb'));
      expect(find.text('New product: grown here'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'How much you harvested'),
        '4',
      );
      await tester.enterText(find.widgetWithText(TextFormField, 'Unit'), 'hd');
      await tapOn(tester, find.text('Save harvest'));
      expect(find.text('Pick where it was harvested'), findsOneWidget);
      await tapOn(
        tester,
        find.widgetWithText(DropdownButtonFormField<String>, 'Harvested from'),
      );
      await tapOn(tester, find.text('North paddock').last);

      await tapOn(tester, find.text('Brix'));
      await tapOn(tester, find.text('Brix').first); // and off again
      await tapOn(tester, find.text('Harvest check'));
      expect(find.text('At harvest.'), findsOneWidget);
      await tapOn(tester, find.text('Save harvest'));
      expect(
        find.text('Harvest check: Containers clean? is required'),
        findsOneWidget,
      );
      await tapOn(tester, find.text('Yes'));
      await tapOn(tester, find.text('Save harvest'));
      final args = convex.callsTo('production:create').single.args;
      expect(args['kind'], 'harvest');
      expect(args['areaId'], 'a1');
      expect(args['inputs'], isEmpty);
      expect(args['checks'], [
        {
          'recordType': 'harvest_check',
          'values': {'clean': true},
        },
      ]);
      expect(find.text('Harvest P0001 recorded'), findsOneWidget);
    });

    testWidgets('no areas yet; an existing product is grown here', (
      tester,
    ) async {
      await launch(
        tester,
        const ProductionFormScreen(kind: 'harvest'),
        fakeWith({
          'products:list': (_) => [
            {'_id': 'p3', 'name': 'Honey', 'unit': 'kg', 'allergens': []},
          ],
        }),
      );
      expect(find.textContaining('Add your paddocks'), findsOneWidget);
      await tapOn(tester, find.text('What did you harvest?'));
      await tapOn(tester, find.text('Honey'));
      expect(find.text('Grown here'), findsOneWidget);
    });

    testWidgets('a recipe\'s checks are required and can\'t be turned off', (
      tester,
    ) async {
      final convex = await launch(
        tester,
        const ProductionFormScreen(),
        fakeWith({
          'programmes:current': (_) => programme(records: [cooking]),
          'products:list': (_) => [
            {
              ...scones,
              'recipe': {
                ...scones['recipe'] as Map,
                'checks': ['cooking'],
              },
            },
          ],
          'production:plan': (_) => {
            'ingredients': [
              {
                'productName': 'Flour',
                'unit': 'kg',
                'short': 0,
                'picks': [
                  {'lotId': 'l1', 'batchCode': 'F1', 'qtyOnHand': 5, 'qty': 2},
                ],
              },
            ],
            'useBy': null,
            'checks': ['cooking'],
          },
          'production:create': (_) => 'r1',
        }),
      );
      await tapOn(tester, find.text('What are you making?'));
      await tapOn(tester, find.text('Scones'));
      expect(find.text('Cooking (the recipe needs this)'), findsOneWidget);
      expect(find.widgetWithText(TextField, 'Food *'), findsNothing);
      expect(
        tester
            .widget<FilterChip>(find.widgetWithText(FilterChip, 'Cooking'))
            .onSelected,
        isNull,
      );
      await tapOn(tester, find.text('Save batch'));
      expect(
        find.text('Cooking: Centre temperature is required'),
        findsOneWidget,
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Centre temperature *'),
        '80',
      );
      await tapOn(tester, find.text('Save batch'));
      expect(convex.callsTo('production:create').single.args['checks'], [
        {
          'recordType': 'cooking',
          'values': {'coreTempC': 80.0},
        },
      ]);
    });

    testWidgets('started from a planned harvest', (tester) async {
      final convex = await launch(
        tester,
        const ProductionFormScreen(
          kind: 'harvest',
          planned: {
            '_id': 'pl2',
            'productId': 'p3',
            'productName': 'Honey',
            'qty': 20,
            'areaId': 'a1',
          },
        ),
        fakeWith({
          'areas:list': (_) => [paddock],
          'production:create': (_) => 'r1',
        }),
      );
      expect(find.text('Honey'), findsOneWidget);
      expect(find.widgetWithText(TextFormField, '20'), findsOneWidget);
      await tester.enterText(find.widgetWithText(TextFormField, 'Unit'), 'kg');
      await tapOn(tester, find.text('Save harvest'));
      final args = convex.callsTo('production:create').single.args;
      expect(args['plannedId'], 'pl2');
      expect(args['areaId'], 'a1');
      expect(args['productId'], 'p3');
    });

    testWidgets('programme and area load errors are ignored', (tester) async {
      await launch(
        tester,
        const ProductionFormScreen(kind: 'harvest'),
        fakeWith({
          'areas:list': fails('offline'),
          'programmes:current': fails('offline'),
        }),
      );
      expect(find.text('CHECKS'), findsNothing);
      expect(find.text('Harvest'), findsOneWidget);
    });
  });

  group('planning', () {
    testWidgets('mixed: plan a harvest from an area on a day', (tester) async {
      final convex = await launch(
        tester,
        const PlanBatchScreen(),
        fakeWith({
          'areas:list': (_) => [paddock],
          'products:list': (_) => [
            {'_id': 'p3', 'name': 'Honey', 'unit': 'kg', 'allergens': []},
          ],
          'production:planBatch': (_) => 'pl1',
        }),
      );
      await tapOn(tester, find.text('Save plan'));
      expect(find.text('Pick what to make'), findsOneWidget);
      await tapOn(tester, find.text('What are you making?'));
      await tapOn(tester, find.text('Honey'));
      await tapOn(tester, find.text('Save plan'));
      expect(find.text('Enter a number'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'How much'),
        '20',
      );
      await tapOn(tester, find.text('Harvest'));
      await tapOn(
        tester,
        find.widgetWithText(DropdownButtonFormField<String>, 'From (optional)'),
      );
      await tapOn(tester, find.text('North paddock').last);
      await tapOn(tester, find.byIcon(Icons.event));
      await tapOn(tester, find.text('OK'));
      await tester.enterText(
        find.widgetWithText(TextField, 'Notes'),
        ' Supers ',
      );
      await tapOn(tester, find.text('Save plan'));
      final args = convex.callsTo('production:planBatch').single.args;
      expect(args['kind'], 'harvest');
      expect(args['areaId'], 'a1');
      expect(args['qty'], 20);
      expect(args['notes'], 'Supers');
      expect(
        args['dueOn'],
        DateUtils.dateOnly(DateTime.now()).millisecondsSinceEpoch,
      );
      expect(find.byType(PlanBatchScreen), findsNothing);
    });

    testWidgets('a kitchen plans batches only; a cancelled date keeps today', (
      tester,
    ) async {
      final convex = fakeWith({
        'products:list': (_) => [scones],
        'production:planBatch': fails('Say how much to make'),
      });
      await pumpScreen(
        tester,
        const PlanBatchScreen(),
        convex: convex,
        auth: authAs(convex, 'kitchen'),
      );
      expect(find.byType(SegmentedButton<String>), findsNothing);
      await tapOn(tester, find.text('What are you making?'));
      await tapOn(tester, find.text('Scones'));
      await tester.enterText(
        find.widgetWithText(TextFormField, 'How much'),
        '1',
      );
      await tapOn(tester, find.byIcon(Icons.event));
      await tapOn(tester, find.text('Cancel'));
      await tapOn(tester, find.text('Save plan'));
      expect(
        convex.callsTo('production:planBatch').single.args['kind'],
        'make',
      );
      expect(find.byType(PlanBatchScreen), findsOneWidget);
    });

    testWidgets('a farm plans harvests by default', (tester) async {
      final convex = fakeWith();
      await pumpScreen(
        tester,
        const PlanBatchScreen(),
        convex: convex,
        auth: authAs(convex, 'farm'),
      );
      expect(find.text('From (optional)'), findsOneWidget);
    });
  });

  group('growing areas', () {
    testWidgets('empty; managers add one', (tester) async {
      final convex = fakeWith({'areas:create': (_) => 'a1'});
      await pumpScreen(tester, const AreasScreen(), convex: convex);
      expect(find.text('No growing areas yet'), findsOneWidget);
      await tapOn(tester, find.text('Add area'));
      await tapOn(tester, find.text('Cancel'));
      expect(convex.callsTo('areas:create'), isEmpty);
      await tapOn(tester, find.text('Add area'));
      await tester.enterText(find.widgetWithText(TextField, 'Name'), ' Hives ');
      await tapOn(tester, find.text('Paddock'));
      await tapOn(tester, find.text('Hives / apiary').last);
      await tester.enterText(find.widgetWithText(TextField, 'Notes'), 'Creek');
      await tapOn(tester, find.text('Save'));
      expect(convex.callsTo('areas:create').single.args, {
        'name': 'Hives',
        'kind': 'hive',
        'notes': 'Creek',
        'businessId': 'b1',
        'sessionToken': 'tok',
      });
    });

    testWidgets('edit and retire an area', (tester) async {
      final convex = fakeWith({
        'areas:list': (_) => [
          {...paddock, 'notes': 'Flat'},
          {'_id': 'a2', 'name': 'Old block', 'kind': 'block', 'active': false},
        ],
        'areas:update': (_) => null,
      });
      await pumpScreen(tester, const AreasScreen(), convex: convex);
      expect(find.text('Paddock · Flat'), findsOneWidget);
      expect(find.text('RETIRED'), findsOneWidget);
      await tapOn(tester, find.text('North paddock'));
      await tapOn(tester, find.byType(Switch));
      await tapOn(tester, find.text('Save'));
      expect(convex.callsTo('areas:update').single.args['active'], false);
    });

    testWidgets('staff only look', (tester) async {
      await pumpScreen(
        tester,
        const AreasScreen(),
        convex: fakeWith({
          'areas:list': (_) => [paddock],
        }),
        role: 'staff',
      );
      expect(find.text('Add area'), findsNothing);
      await tapOn(tester, find.text('North paddock'));
      expect(find.byType(AlertDialog), findsNothing);
    });
  });

  group('recipes', () {
    testWidgets('pick the checks every batch needs', (tester) async {
      final convex = await launch(
        tester,
        RecipeScreen(
          product: {
            ...scones,
            'recipe': {
              ...scones['recipe'] as Map,
              'checks': ['cooking'],
            },
          },
        ),
        fakeWith({
          'programmes:current': (_) => programme(records: [cooking, brix]),
          'products:update': (_) => null,
        }),
      );
      await tapOn(tester, find.text('Cooking'));
      await tapOn(tester, find.text('Brix'));
      await tapOn(tester, find.text('Save recipe'));
      expect(
        (convex.callsTo('products:update').single.args['recipe']
            as Map)['checks'],
        ['brix'],
      );
    });

    testWidgets('staff can\'t change the checks', (tester) async {
      await launch(
        tester,
        RecipeScreen(product: scones),
        fakeWith({
          'programmes:current': (_) => programme(records: [cooking]),
        }),
        role: 'staff',
      );
      expect(
        tester
            .widget<FilterChip>(find.widgetWithText(FilterChip, 'Cooking'))
            .onSelected,
        isNull,
      );
    });
  });

  group('business type', () {
    testWidgets('a farm\'s tab is Harvest', (tester) async {
      final convex = fakeWith();
      await pumpScreen(
        tester,
        const HomeShell(),
        convex: convex,
        auth: authAs(convex, 'farm'),
        size: const Size(1200, 900),
      );
      expect(
        find.descendant(
          of: find.byType(NavigationRail),
          matching: find.text('Harvest'),
        ),
        findsOneWidget,
      );
      await tapOn(
        tester,
        find.descendant(
          of: find.byType(DashboardScreen),
          matching: find.text('Harvest'),
        ),
      );
      expect(
        tester
            .widget<ProductionFormScreen>(find.byType(ProductionFormScreen))
            .kind,
        'harvest',
      );
    });

    testWidgets('retail has no production tab', (tester) async {
      final convex = fakeWith();
      await pumpScreen(
        tester,
        const HomeShell(),
        convex: convex,
        auth: authAs(convex, 'retail'),
        size: const Size(1200, 900),
      );
      expect(
        tester.widget<NavigationRail>(find.byType(NavigationRail)).destinations,
        hasLength(5),
      );
    });

    testWidgets('trace shows where a harvest came from', (tester) async {
      await pumpScreen(
        tester,
        const TraceScreen(),
        convex: fakeWith({
          'production:trace': (_) => [
            {...harvestRun()['run'], 'lot': harvestRun()['lot']},
            {
              ...harvestRun()['run'],
              '_id': 'r2',
              'voided': true,
              'lot': harvestRun()['lot'],
            },
          ],
        }),
      );
      await tester.enterText(find.byType(TextField), 'hives');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      expect(find.textContaining('Harvested 6 May 2024'), findsNWidgets(2));
      expect(find.textContaining('From Hives'), findsNWidgets(2));
      expect(find.text('Harvested'), findsOneWidget);
      expect(find.text('VOID'), findsOneWidget);
    });
  });
}
