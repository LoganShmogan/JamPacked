import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/screens/audit_detail_screen.dart';
import 'package:foodsafe/screens/audits_screen.dart';
import 'package:foodsafe/widgets/common.dart';

import '../fixtures.dart';
import '../helpers.dart';

Map<String, dynamic> auditRow(
  String id, {
  String status = 'in_progress',
  num? score,
}) => {
  '_id': id,
  'title': 'Audit $id',
  'status': status,
  'score': score,
  'startedByName': 'Sam',
  'answered': 3,
  'total': 10,
  'completedByName': 'Kim',
  'completedAt': t0,
};

void main() {
  testWidgets('lists templates with their counts', (tester) async {
    await pumpScreen(tester, const AuditsScreen(), convex: fakeWith());
    expect(find.text('Daily Food Safety Check'), findsOneWidget);
    expect(find.text('10 questions'), findsOneWidget);
    expect(find.text('10 auto-filled'), findsOneWidget);
    expect(find.text('Last 7 day(s)'), findsOneWidget);
    expect(find.text('MPI FCP Diary'), findsOneWidget);
  });

  testWidgets('starting a daily audit sends local day start and opens it', (
    tester,
  ) async {
    final convex = await pumpScreen(
      tester,
      const AuditsScreen(),
      convex: fakeWith({'audits:start': (_) => 'a1'}),
    );
    await tester.tap(find.text('Daily Food Safety Check'));
    await tester.pumpAndSettle();
    final args = convex.callsTo('audits:start').single.args;
    expect(args['templateKey'], 'daily_check');
    expect(args['periodStart'], localDayStartMs());
    expect(args['tzOffsetMinutes'], DateTime.now().timeZoneOffset.inMinutes);
    expect(find.byType(AuditDetailScreen), findsOneWidget);
  });

  testWidgets(
    'multi-day audits use the default rolling period; errors stay put',
    (tester) async {
      final convex = await pumpScreen(
        tester,
        const AuditsScreen(),
        convex: fakeWith({'audits:start': fails('Unknown audit template')}),
      );
      await tester.tap(find.text('Goods Receipt'));
      await tester.pumpAndSettle();
      expect(
        convex.callsTo('audits:start').single.args.containsKey('periodStart'),
        isFalse,
      );
      expect(find.text('Unknown audit template'), findsOneWidget);
      expect(find.byType(AuditDetailScreen), findsNothing);
    },
  );

  testWidgets('history: empty state', (tester) async {
    await pumpScreen(tester, const AuditsScreen(), convex: fakeWith());
    await tester.tap(find.text('History'));
    await tester.pumpAndSettle();
    expect(find.text('No audits yet'), findsOneWidget);
  });

  testWidgets('history: progress, score bands, and opening an audit', (
    tester,
  ) async {
    await pumpScreen(
      tester,
      const AuditsScreen(),
      convex: fakeWith({
        'audits:list': (_) => [
          auditRow('a'),
          auditRow('b', status: 'completed', score: 95),
          auditRow('c', status: 'completed', score: 75),
          auditRow('d', status: 'completed', score: 40),
        ],
      }),
    );
    await tester.tap(find.text('History'));
    await tester.pumpAndSettle();
    expect(find.text('In progress'), findsOneWidget);
    expect(find.text('Started by Sam · 3/10 answered'), findsOneWidget);
    expect(
      find.text('Completed by Kim · 6 May 2024, 9:15 AM'),
      findsNWidgets(3),
    );
    for (final s in ['95%', '75%', '40%']) {
      expect(find.text(s), findsOneWidget);
    }
    await tester.tap(find.text('Audit a'));
    await tester.pumpAndSettle();
    expect(
      tester.widget<AuditDetailScreen>(find.byType(AuditDetailScreen)).id,
      'a',
    );
  });
}
