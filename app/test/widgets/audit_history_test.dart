import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/widgets/audit_history.dart';

import '../helpers.dart';

void main() {
  test('auditActionIcon maps each action, with a fallback', () {
    expect(auditActionIcon('create'), Icons.add_circle_outline);
    expect(auditActionIcon('update'), Icons.edit_outlined);
    expect(auditActionIcon('answer'), Icons.edit_outlined);
    expect(auditActionIcon('void'), Icons.block);
    expect(auditActionIcon('complete'), Icons.check_circle_outline);
    expect(auditActionIcon('close'), Icons.check_circle_outline);
    expect(auditActionIcon('login'), Icons.login);
    expect(auditActionIcon('logout'), Icons.logout);
    expect(auditActionIcon('login_failed'), Icons.gpp_bad_outlined);
    expect(auditActionIcon('refresh'), Icons.sync);
    expect(auditActionIcon('something-new'), Icons.history);
  });

  testWidgets('shows "No history" when empty', (tester) async {
    await pumpScreen(tester, const Scaffold(body: AuditHistory(entries: [])));
    expect(find.text('No history'), findsOneWidget);
  });

  testWidgets('lists entries with who and when, separated by dividers', (
    tester,
  ) async {
    final at = DateTime(2024, 1, 2, 9, 30).millisecondsSinceEpoch;
    await pumpScreen(
      tester,
      Scaffold(
        body: AuditHistory(
          entries: [
            {
              'action': 'create',
              'summary': 'Created it',
              'userName': 'Ana',
              'at': at,
            },
            {
              'action': 'void',
              'summary': 'Voided it',
              'userName': 'Ben',
              'at': at,
            },
          ],
        ),
      ),
    );
    expect(find.text('Created it'), findsOneWidget);
    expect(find.text('Ana · 2 Jan 2024, 9:30 AM'), findsOneWidget);
    expect(find.byIcon(Icons.block), findsOneWidget);
    expect(find.byType(Divider), findsOneWidget);
  });
}
