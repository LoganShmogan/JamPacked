import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/screens/corrective_actions_screen.dart';

import '../fixtures.dart';
import '../helpers.dart';

Future<void> showClosedTab(WidgetTester tester) async {
  await tester.tap(find.text('Closed'));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('empty open and closed tabs', (tester) async {
    final convex = await pumpScreen(
      tester,
      const CorrectiveActionsScreen(),
      convex: fakeWith(),
    );
    expect(find.text('Nothing outstanding'), findsOneWidget);
    expect(find.textContaining('appear here automatically'), findsOneWidget);
    await showClosedTab(tester);
    expect(find.text('No closed actions yet'), findsOneWidget);
    expect(
      convex.callsTo('correctiveActions:list').map((c) => c.args['status']),
      containsAll(['open', 'closed']),
    );
  });

  testWidgets('cards show severity, source and resolution', (tester) async {
    await pumpScreen(
      tester,
      const CorrectiveActionsScreen(),
      convex: fakeWith({
        'correctiveActions:list': (a) => a['status'] == 'open'
            ? [
                ca(id: 'a', severity: 'high', source: 'goods_inward'),
                ca(
                  id: 'b',
                  severity: 'medium',
                  source: 'temperature',
                  description: null,
                ),
                ca(id: 'c', severity: 'low', source: 'something_new'),
              ]
            : [ca(id: 'd', status: 'closed', source: 'audit')],
      }),
    );
    expect(find.text('HIGH'), findsOneWidget);
    expect(find.text('MEDIUM'), findsOneWidget);
    expect(find.text('LOW'), findsOneWidget);
    expect(find.text('Goods inwards'), findsOneWidget);
    expect(find.text('Temperature'), findsOneWidget);
    expect(find.text('something_new'), findsOneWidget);
    expect(find.text('Check the stock'), findsNWidgets(2));
    expect(find.text('Close out'), findsNWidgets(3));

    await showClosedTab(tester);
    expect(find.text('Audit'), findsOneWidget);
    expect(find.text('✓ Discarded'), findsOneWidget);
    expect(find.text('Closed by Kim · 6 May 2024, 9:15 AM'), findsOneWidget);
    expect(find.text('Close out'), findsNothing);
  });

  testWidgets('close out needs a resolution', (tester) async {
    final convex = await pumpScreen(
      tester,
      const CorrectiveActionsScreen(),
      convex: fakeWith({
        'correctiveActions:list': (a) => a['status'] == 'open' ? [ca()] : [],
        'correctiveActions:close': (_) => null,
      }),
    );
    await tapOn(tester, find.text('Close out'));
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    await tapOn(tester, find.text('Close out'));
    await answerDialog(tester, '', button: 'Close');
    expect(convex.callsTo('correctiveActions:close'), isEmpty);

    await tapOn(tester, find.text('Close out'));
    expect(
      find.text('e.g. Product discarded, supplier credited'),
      findsOneWidget,
    );
    await answerDialog(tester, 'Binned it', button: 'Close');
    expect(convex.callsTo('correctiveActions:close').single.args, {
      'id': 'c1',
      'resolution': 'Binned it',
      'businessId': 'b1',
      'sessionToken': 'tok',
    });
    expect(find.text('Closed'), findsWidgets);
  });

  testWidgets('raise a manual corrective action', (tester) async {
    final convex = await pumpScreen(
      tester,
      const CorrectiveActionsScreen(),
      convex: fakeWith({'correctiveActions:create': (_) => 'new'}),
    );
    await tester.tap(find.byType(FloatingActionButton));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'What went wrong?'),
      ' Pest sighting ',
    );
    await tester.enterText(
      find.widgetWithText(TextField, 'Details / what was done'),
      ' Called exterminator ',
    );
    await tester.tap(find.text('High'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Raise'));
    await tester.pumpAndSettle();
    expect(convex.callsTo('correctiveActions:create').single.args, {
      'title': 'Pest sighting',
      'description': 'Called exterminator',
      'severity': 'high',
      'businessId': 'b1',
      'sessionToken': 'tok',
    });
    expect(find.text('Corrective action raised'), findsOneWidget);
  });

  testWidgets(
    'raise without details sends no description; dismissing raises nothing',
    (tester) async {
      final convex = await pumpScreen(
        tester,
        const CorrectiveActionsScreen(),
        convex: fakeWith({'correctiveActions:create': (_) => 'new'}),
      );
      await tester.tap(find.byType(FloatingActionButton));
      await tester.pumpAndSettle();
      await tester.tapAt(const Offset(10, 10));
      await tester.pumpAndSettle();
      expect(convex.callsTo('correctiveActions:create'), isEmpty);

      await tester.tap(find.byType(FloatingActionButton));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.widgetWithText(TextField, 'What went wrong?'),
        'Spill',
      );
      await tester.tap(find.text('Raise'));
      await tester.pumpAndSettle();
      expect(
        convex.callsTo('correctiveActions:create').single.args['description'],
        isNull,
      );
      expect(
        convex.callsTo('correctiveActions:create').single.args['severity'],
        'medium',
      );
    },
  );
}
