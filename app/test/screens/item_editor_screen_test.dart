import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/screens/goods_in_form_screen.dart';
import 'package:jampacked/widgets/common.dart';

import '../fixtures.dart';
import '../helpers.dart';

/// Opens the editor from a page; returns the list that receives what it pops with.
Future<List<Map<String, dynamic>?>> openEditor(
  WidgetTester tester, [
  Map<String, dynamic>? initial,
  List<Map<String, dynamic>> locs = const [],
]) async {
  final popped = <Map<String, dynamic>?>[];
  await pumpScreen(
    tester,
    Builder(
      builder: (context) => Scaffold(
        body: TextButton(
          onPressed: () async => popped.add(
            await Navigator.of(context).push<Map<String, dynamic>>(
              MaterialPageRoute(
                builder: (_) =>
                    ItemEditorScreen(initial: initial, settings: settings()),
              ),
            ),
          ),
          child: const Text('open'),
        ),
      ),
    ),
    convex: fakeWith({'locations:list': (_) => locs}),
    size: const Size(800, 2400),
  );
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
  return popped;
}

Finder field(String label) => find.widgetWithText(TextFormField, label);
Future<void> done(WidgetTester tester) => tapOn(tester, find.text('Done'));
Future<void> storage(WidgetTester tester, String label) =>
    tapOn(tester, find.text(label));
IconData? tempIcon(WidgetTester tester) {
  final suffix =
      tester
              .widget<TextField>(
                find.descendant(
                  of: field('Probe temperature °C'),
                  matching: find.byType(TextField),
                ),
              )
              .decoration!
              .suffixIcon
          as Icon?;
  return suffix?.icon;
}

void main() {
  testWidgets('new item: validates product, quantity and temperature', (
    tester,
  ) async {
    final popped = await openEditor(tester);
    expect(find.text('Add item'), findsOneWidget);
    await tester.enterText(field('Quantity'), '0');
    await done(tester);
    expect(find.text('Required'), findsOneWidget);
    expect(find.text('Enter a number'), findsOneWidget);
    expect(
      find.text('Temperature is required for chilled food'),
      findsOneWidget,
    );
    expect(popped, isEmpty);
  });

  testWidgets('live temperature check per storage type', (tester) async {
    await openEditor(tester);
    expect(find.text('Must be ≤ 5°C'), findsOneWidget);
    expect(tempIcon(tester), isNull);
    await tester.enterText(field('Probe temperature °C'), '4');
    await tester.pump();
    expect(tempIcon(tester), Icons.check_circle);
    await tester.enterText(field('Probe temperature °C'), '8');
    await tester.pump();
    expect(tempIcon(tester), Icons.error);
    expect(
      find.textContaining(
        'Temperature out of range. You should reject this item.',
      ),
      findsOneWidget,
    );

    await storage(tester, 'Frozen');
    expect(find.text('Must be frozen hard, ≤ -15°C'), findsOneWidget);
    expect(tempIcon(tester), Icons.error);
    await storage(tester, 'Hot');
    expect(find.text('Must be ≥ 60°C'), findsOneWidget);
    expect(tempIcon(tester), Icons.error);
    await tester.enterText(field('Probe temperature °C'), '65');
    await tester.pump();
    expect(tempIcon(tester), Icons.check_circle);

    await storage(tester, 'Ambient');
    expect(field('Probe temperature °C'), findsNothing);
  });

  testWidgets('accepted item: saves trimmed values and drops empty fields', (
    tester,
  ) async {
    final popped = await openEditor(tester);
    await tester.enterText(field('Product'), ' Butter ');
    await tester.enterText(field('Quantity'), '2.5');
    await tester.enterText(field('Batch / lot code'), ' LOT9 ');
    await tester.enterText(field('Probe temperature °C'), '3');
    await tapOn(tester, find.text('ea'));
    await tester.tap(find.text('kg').last);
    await tester.pumpAndSettle();
    await tapOn(tester, find.widgetWithText(FilterChip, 'milk'));
    await tapOn(tester, find.widgetWithText(FilterChip, 'soy'));
    await tapOn(tester, find.widgetWithText(FilterChip, 'soy'));
    await done(tester);
    expect(popped.single, {
      'productName': 'Butter',
      'quantity': 2.5,
      'unit': 'kg',
      'storageType': 'chilled',
      'packagingOk': true,
      'labelOk': true,
      'allergens': ['milk'],
      'accepted': true,
      'batchCode': 'LOT9',
      'temperatureC': 3.0,
    });
  });

  testWidgets('ambient item has no temperature and no batch when blank', (
    tester,
  ) async {
    final popped = await openEditor(tester);
    await tester.enterText(field('Product'), 'Flour');
    await storage(tester, 'Ambient');
    await done(tester);
    expect(popped.single!.containsKey('temperatureC'), isFalse);
    expect(popped.single!.containsKey('batchCode'), isFalse);
    expect(popped.single!['storageType'], 'ambient');
  });

  testWidgets('problems are listed and pre-fill the rejection reason', (
    tester,
  ) async {
    final popped = await openEditor(tester, {
      'productName': 'Old fish',
      'barcode': '9400001',
      'unit': 'pallet', // unknown unit falls back to "ea"
      'useBy': msAgo(const Duration(days: 2)),
      'temperatureC': 9,
    });
    expect(find.text('Check item'), findsOneWidget);
    expect(find.text('Barcode 9400001'), findsOneWidget);
    expect(find.text('9'), findsOneWidget);
    await tapOn(tester, find.text('Packaging intact, not damaged'));
    await tapOn(
      tester,
      find.text('Labelled correctly (name, date mark, allergens)'),
    );
    expect(
      find.text(
        '⚠ Temperature out of range, Use-by date has passed, Packaging damaged, Label missing or incorrect. You should reject this item.',
      ),
      findsOneWidget,
    );
    await tapOn(tester, find.text('Reject'));
    expect(
      find.text(
        'Temperature out of range, Use-by date has passed, Packaging damaged, Label missing or incorrect',
      ),
      findsOneWidget,
    );
    await tester.enterText(field('Reason for rejection'), ' Smells off ');
    await done(tester);
    expect(popped.single, containsPair('accepted', false));
    expect(popped.single, containsPair('rejectionReason', 'Smells off'));
    expect(popped.single, containsPair('unit', 'pallet'));
  });

  testWidgets('rejecting a fine item requires a reason', (tester) async {
    final popped = await openEditor(tester, {
      'productName': 'Eggs',
      'storageType': 'ambient',
      'rejectionReason': null,
    });
    await tapOn(tester, find.text('Reject'));
    await done(tester);
    expect(find.text('Required'), findsOneWidget);
    expect(popped, isEmpty);
    await tapOn(tester, find.text('Accept'));
    expect(field('Reason for rejection'), findsNothing);
  });

  testWidgets('date pickers set use-by and best-before to 23:59 local', (
    tester,
  ) async {
    final popped = await openEditor(tester, {
      'productName': 'Ham',
      'storageType': 'ambient',
    });
    await tapOn(tester, find.text('Use by'));
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    final useBy = DateTime.now().add(const Duration(days: 3));
    expect(
      find.text('Use by ${fmtDate(useBy.millisecondsSinceEpoch)}'),
      findsOneWidget,
    );

    await tapOn(tester, find.text('Best before'));
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(find.text('Best before'), findsOneWidget);
    await tapOn(tester, find.text('Best before'));
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    expect(find.textContaining('BB '), findsOneWidget);

    // Re-opening starts from the chosen date.
    await tapOn(tester, find.textContaining('Use by '));
    await tester.tap(find.text('OK'));
    await tester.pumpAndSettle();
    await done(tester);
    final saved = fromMs(popped.single!['useBy']);
    expect(
      [saved.year, saved.month, saved.day, saved.hour, saved.minute],
      [useBy.year, useBy.month, useBy.day, 23, 59],
    );
    expect(popped.single!['bestBefore'], isA<int>());
  });

  testWidgets('accepted items can be put away to a location', (tester) async {
    final popped = await openEditor(tester, {
      'productName': 'Milk',
      'storageType': 'ambient',
    }, locations.where((l) => l['active'] == true).toList());
    await tapOn(tester, find.text('Not set'));
    await tapOn(tester, find.text('Chiller 1').last);
    await done(tester);
    expect(popped.single!['locationId'], 'loc1');
  });

  testWidgets('rejected items have no put-away location', (tester) async {
    final popped = await openEditor(tester, {
      'productName': 'Milk',
      'storageType': 'ambient',
      'locationId': 'loc1',
    }, locations.where((l) => l['active'] == true).toList());
    expect(find.text('Put away to'), findsOneWidget);
    await tapOn(tester, find.text('Reject'));
    expect(find.text('Put away to'), findsNothing);
    await tester.enterText(field('Reason for rejection'), 'Damaged');
    await done(tester);
    expect(popped.single!.containsKey('locationId'), isFalse);
  });
}
