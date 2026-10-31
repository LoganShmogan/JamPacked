import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/screens/temperature_screen.dart';

import '../fixtures.dart';
import '../helpers.dart';

Finder sheetField(String label) => find.widgetWithText(TextField, label);

Future<void> openRecorder(WidgetTester tester) async {
  await tester.tap(find.text('Record'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('empty state', (tester) async {
    await pumpScreen(tester, const TemperatureScreen(), convex: fakeWith());
    expect(find.text('No temperature checks yet'), findsOneWidget);
  });

  testWidgets('lists readings with compliance and corrective actions', (
    tester,
  ) async {
    await pumpScreen(
      tester,
      const TemperatureScreen(),
      convex: fakeWith({
        'temperature:list': (_) => [
          {
            'unitName': 'Walk-in',
            'unitType': 'chiller',
            'temperatureC': 3,
            'compliant': true,
            'checkedByName': 'Sam',
            'checkedAt': t0,
          },
          {
            'unitName': 'Bain',
            'unitType': 'hot_hold',
            'temperatureC': 52.5,
            'compliant': false,
            'checkedByName': 'Kim',
            'checkedAt': t0,
            'correctiveAction': 'Reheated',
          },
        ],
      }),
    );
    expect(find.text('Walk-in: 3°C'), findsOneWidget);
    expect(find.text('Bain: 52.5°C'), findsOneWidget);
    expect(find.textContaining('Chiller / fridge · Sam'), findsOneWidget);
    expect(find.textContaining('Action: Reheated'), findsOneWidget);
  });

  testWidgets('records a reading picked from a known unit', (tester) async {
    final convex = await pumpScreen(
      tester,
      const TemperatureScreen(),
      convex: fakeWith({
        'temperature:units': (_) => [
          {'unitName': 'Freezer 1', 'unitType': 'freezer'},
        ],
        'temperature:record': (_) => {'id': 't1', 'compliant': true},
      }),
    );
    await openRecorder(tester);
    await tester.tap(find.widgetWithText(ChoiceChip, 'Freezer 1'));
    await tester.pumpAndSettle();
    expect(tester.widget<ChoiceChip>(find.byType(ChoiceChip)).selected, isTrue);
    await tester.enterText(sheetField('Temperature °C'), '-18');
    await tester.tap(find.text('Save reading'));
    await tester.pumpAndSettle();
    expect(convex.callsTo('temperature:record').single.args, {
      'unitName': 'Freezer 1',
      'unitType': 'freezer',
      'temperatureC': -18.0,
      'correctiveAction': null,
      'businessId': 'b1',
      'sessionToken': 'tok',
    });
    expect(find.text('Recorded: within limits'), findsOneWidget);
    // Timed for Insights; there's no handler, so the call fails, and that never gets in the way.
    final timing = convex.callsTo('analytics:recordTask').single.args;
    expect(timing['task'], 'temperature');
    expect(timing['durationMs'], isA<int>());
  });

  testWidgets('out-of-range reading with type picked from the dropdown', (
    tester,
  ) async {
    final convex = await pumpScreen(
      tester,
      const TemperatureScreen(),
      convex: fakeWith({
        'temperature:record': (_) => {'id': 't1', 'compliant': false},
      }),
    );
    await openRecorder(tester);
    expect(find.byType(ChoiceChip), findsNothing);
    await tester.enterText(sheetField('Unit (e.g. Walk-in chiller)'), ' Oven ');
    await tester.tap(find.text('Chiller / fridge'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cooking (core)').last);
    await tester.pumpAndSettle();
    await tester.enterText(sheetField('Temperature °C'), '60');
    await tester.enterText(
      sheetField('Corrective action (if out of range)'),
      ' Cooked longer ',
    );
    await tester.tap(find.text('Save reading'));
    await tester.pumpAndSettle();
    expect(
      convex.callsTo('temperature:record').single.args,
      containsPair('unitType', 'cooking'),
    );
    expect(
      convex.callsTo('temperature:record').single.args,
      containsPair('unitName', 'Oven'),
    );
    expect(
      convex.callsTo('temperature:record').single.args,
      containsPair('correctiveAction', 'Cooked longer'),
    );
    expect(
      find.text('Recorded: OUT OF RANGE, corrective action raised'),
      findsOneWidget,
    );
  });

  testWidgets('missing unit or temperature is rejected locally', (
    tester,
  ) async {
    final convex = await pumpScreen(
      tester,
      const TemperatureScreen(),
      convex: fakeWith(),
    );
    await openRecorder(tester);
    await tester.enterText(sheetField('Temperature °C'), 'abc');
    await tester.tap(find.text('Save reading'));
    await tester.pumpAndSettle();
    expect(find.text('Enter a unit and temperature'), findsOneWidget);
    expect(convex.callsTo('temperature:record'), isEmpty);
  });

  testWidgets(
    'server rejection shows the error; dismissing the sheet saves nothing',
    (tester) async {
      final convex = await pumpScreen(
        tester,
        const TemperatureScreen(),
        convex: fakeWith({
          'temperature:units': fails('offline'),
          'temperature:record': fails(
            'Out of range. Record what you did about it (corrective action)',
          ),
        }),
      );
      await openRecorder(tester);
      expect(
        find.text('Record temperature'),
        findsOneWidget,
      ); // still opens without known units
      await tester.enterText(sheetField('Unit (e.g. Walk-in chiller)'), 'C1');
      await tester.enterText(sheetField('Temperature °C'), '9');
      await tester.tap(find.text('Save reading'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Out of range.'), findsOneWidget);

      await openRecorder(tester);
      await tester.tapAt(const Offset(10, 10)); // tap the barrier
      await tester.pumpAndSettle();
      expect(find.text('Record temperature'), findsNothing);
      expect(convex.callsTo('temperature:record'), hasLength(1));
    },
  );

  testWidgets('autoOpen shows the recorder on first frame', (tester) async {
    await pumpScreen(
      tester,
      const TemperatureScreen(autoOpen: true),
      convex: fakeWith(),
    );
    expect(find.text('Record temperature'), findsOneWidget);
  });

  testWidgets('leaving before units load does not open the sheet', (
    tester,
  ) async {
    final convex = fakeWith({
      'temperature:units': (_) =>
          Future.delayed(const Duration(seconds: 1), () => []),
    });
    await pumpScreen(tester, const TemperatureScreen(), convex: convex);
    await tester.tap(find.text('Record'));
    await tester.pump();
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('Record temperature'), findsNothing);
  });
}
