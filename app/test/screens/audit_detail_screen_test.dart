import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/screens/audit_detail_screen.dart';

import '../fixtures.dart';
import '../helpers.dart';

Map<String, dynamic> q(
  String id,
  String type, {
  String section = 'Deliveries',
  Object? value,
  bool auto = false,
  String? guidance,
  String? evidence,
  String? notes,
  String? by,
}) => {
  'questionId': id,
  'section': section,
  'text': 'Question $id',
  'type': type,
  'value': value,
  'autoFilled': auto,
  'guidance': guidance,
  'evidence': evidence,
  'notes': notes,
  'answeredByName': by,
  'answeredAt': by == null ? null : t0,
};

Map<String, dynamic> audit({
  String status = 'in_progress',
  num? score,
  List? answers,
}) => {
  '_id': 'a1',
  'title': 'Goods Receipt: 1/05/2024 to 7/05/2024',
  'standardRef': 'FSANZ 3.2.2',
  'status': status,
  'score': score,
  'completedByName': 'Kim',
  'completedAt': t0,
  'answers':
      answers ??
      [
        q(
          'q1',
          'yesno',
          value: true,
          auto: true,
          guidance: 'Keep a list',
          evidence: '2 supplier(s), all approved',
        ),
        q('q2', 'yesno', value: false, by: 'Sam', notes: 'Check van'),
        q('q3', 'number', section: 'Stats', value: 4.0),
        q('q4', 'text', section: 'Stats'),
        q('q5', 'yesno', section: 'Stats'),
      ],
};

Future<FakeConvex> pumpAudit(
  WidgetTester tester,
  Map<String, dynamic>? a, [
  Map<String, Handler> extra = const {},
]) => pumpScreen(
  tester,
  const AuditDetailScreen(id: 'a1'),
  convex: fakeWith({
    'audits:get': (_) => a,
    'audits:answer': (_) => null,
    'audits:refreshAutoFill': (_) => null,
    'audits:complete': (_) => null,
    ...extra,
  }),
);

Finder card(String questionId) => find
    .ancestor(
      of: find.text('Question $questionId'),
      matching: find.byType(Card),
    )
    .first;
Finder inCard(String questionId, Finder f) =>
    find.descendant(of: card(questionId), matching: f);

void main() {
  testWidgets('audit not found', (tester) async {
    await pumpAudit(tester, null);
    expect(find.text('Audit not found'), findsOneWidget);
  });

  testWidgets(
    'in-progress audit: header, sections, evidence and answer states',
    (tester) async {
      final convex = await pumpAudit(tester, audit(), {
        'auditLog:list': (_) => [
          {
            'action': 'refresh',
            'summary': 'Refreshed',
            'userName': 'Sam',
            'at': t0,
          },
        ],
      });
      expect(
        find.text('Goods Receipt: 1/05/2024 to 7/05/2024'),
        findsOneWidget,
      );
      expect(find.text('3 of 5 answered'), findsOneWidget);
      expect(
        tester
            .widget<LinearProgressIndicator>(
              find.byType(LinearProgressIndicator),
            )
            .value,
        0.6,
      );
      expect(find.text('DELIVERIES'), findsOneWidget);
      expect(find.text('STATS'), findsOneWidget);
      expect(find.text('Keep a list'), findsOneWidget);
      expect(find.text('2 supplier(s), all approved'), findsOneWidget);
      expect(find.text('Auto-filled'), findsOneWidget);
      expect(
        inCard('q2', find.text('Sam · 6 May 2024, 9:15 AM')),
        findsOneWidget,
      );
      expect(find.text('Note: Check van'), findsOneWidget);
      expect(find.text('4'), findsOneWidget);
      expect(find.text('Tap to answer'), findsOneWidget);
      expect(find.text('Refreshed'), findsOneWidget);
      expect(convex.callsTo('auditLog:list').single.args, {
        'entityType': 'audit',
        'entityId': 'a1',
        'businessId': 'b1',
        'sessionToken': 'tok',
      });
    },
  );

  testWidgets('yes/no answers save immediately', (tester) async {
    final convex = await pumpAudit(tester, audit());
    await tapOn(tester, inCard('q5', find.text('Yes')));
    await tapOn(tester, inCard('q5', find.text('No')));
    expect(
      convex
          .callsTo('audits:answer')
          .map((c) => [c.args['questionId'], c.args['value']]),
      [
        ['q5', true],
        ['q5', false],
      ],
    );
  });

  testWidgets('number and text answers use a prompt; cancel saves nothing', (
    tester,
  ) async {
    final convex = await pumpAudit(tester, audit());
    await tapOn(tester, inCard('q3', find.text('4')));
    await answerDialog(tester, '12.5');
    await tapOn(tester, inCard('q3', find.text('4')));
    await answerDialog(tester, 'about ten');
    await tapOn(tester, find.text('Tap to answer'));
    await answerDialog(tester, 'All fine');
    await tapOn(tester, find.text('Tap to answer'));
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(convex.callsTo('audits:answer').map((c) => c.args['value']), [
      12.5,
      'about ten',
      'All fine',
    ]);
  });

  testWidgets('notes keep the current value', (tester) async {
    final convex = await pumpAudit(tester, audit());
    await tapOn(tester, inCard('q1', find.text('Note')));
    await answerDialog(tester, 'Checked list');
    await tapOn(tester, inCard('q1', find.text('Note')));
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(convex.callsTo('audits:answer').single.args, {
      'id': 'a1',
      'questionId': 'q1',
      'value': true,
      'notes': 'Checked list',
      'businessId': 'b1',
      'sessionToken': 'tok',
    });
  });

  testWidgets('refresh re-runs auto-fill', (tester) async {
    final convex = await pumpAudit(tester, audit());
    await tapOn(tester, find.text('Refresh'));
    expect(convex.callsTo('audits:refreshAutoFill').single.args['id'], 'a1');
    expect(find.text('Auto-filled answers refreshed'), findsOneWidget);
  });

  testWidgets('sign off asks for confirmation', (tester) async {
    final convex = await pumpAudit(tester, audit());
    await tapOn(tester, find.text('Complete & sign off'));
    expect(find.text('Sign off audit?'), findsOneWidget);
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(convex.callsTo('audits:complete'), isEmpty);

    await tapOn(tester, find.text('Complete & sign off'));
    await tester.tap(find.text('Sign off'));
    await tester.pumpAndSettle();
    expect(convex.callsTo('audits:complete').single.args['id'], 'a1');
    expect(find.text('Audit completed'), findsOneWidget);
  });

  testWidgets('completed audits are locked and show the score', (tester) async {
    final convex = await pumpAudit(
      tester,
      audit(status: 'completed', score: 95),
    );
    expect(find.text('Score 95%'), findsOneWidget);
    expect(
      find.text('Completed by Kim on 6 May 2024, 9:15 AM. Locked.'),
      findsOneWidget,
    );
    expect(find.text('Refresh'), findsNothing);
    expect(find.text('Complete & sign off'), findsNothing);
    expect(find.text('Note'), findsNothing);
    await tapOn(tester, inCard('q5', find.text('Yes')));
    await tapOn(tester, find.text('Tap to answer'));
    expect(find.byType(AlertDialog), findsNothing);
    expect(convex.callsTo('audits:answer'), isEmpty);
  });

  testWidgets('low completed score and an audit with no questions', (
    tester,
  ) async {
    await pumpAudit(tester, audit(status: 'completed', score: 60, answers: []));
    expect(find.text('Score 60%'), findsOneWidget);
    expect(find.text('0 of 0 answered'), findsOneWidget);
    expect(
      tester
          .widget<LinearProgressIndicator>(find.byType(LinearProgressIndicator))
          .value,
      0,
    );
  });
}
