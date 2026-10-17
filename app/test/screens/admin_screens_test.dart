import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/screens/admin_screens.dart';
import 'package:foodsafe/theme.dart';

import '../fixtures.dart';
import '../helpers.dart';

Map<String, dynamic> entry(String action, {Object? changes}) => {
  'action': action,
  'summary': 'Did $action',
  'userName': 'Sam',
  'at': t0,
  'changes': changes,
};

Map<String, dynamic> user(
  String id,
  String name,
  String role, {
  bool active = true,
}) => {
  '_id': id,
  'name': name,
  'email': '${name.toLowerCase()}@x.co',
  'role': role,
  'active': active,
};

void main() {
  group('AuditTrailScreen', () {
    testWidgets('empty state', (tester) async {
      await pumpScreen(tester, const AuditTrailScreen(), convex: fakeWith());
      expect(find.text('No entries'), findsOneWidget);
    });

    testWidgets('filter chips change the entity type', (tester) async {
      final convex = await pumpScreen(
        tester,
        const AuditTrailScreen(),
        convex: fakeWith(),
      );
      expect(convex.callsTo('auditLog:list').last.args, {
        'entityType': null,
        'limit': 500,
        'sessionToken': 'tok',
      });
      await tester.tap(find.text('Goods in'));
      await tester.pumpAndSettle();
      expect(
        convex.callsTo('auditLog:list').last.args['entityType'],
        'delivery',
      );
      expect(
        tester
            .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Goods in'))
            .selected,
        isTrue,
      );
    });

    testWidgets(
      'failed sign-ins are red; entries with changes open a pretty-printed diff',
      (tester) async {
        await pumpScreen(
          tester,
          const AuditTrailScreen(),
          convex: fakeWith({
            'auditLog:list': (_) => [
              entry('login_failed'),
              entry(
                'update',
                changes: {
                  'name': {'from': 'A', 'to': 'B'},
                  'items': [
                    {'productName': 'Milk'},
                    'loose',
                  ],
                  'flag': true,
                },
              ),
            ],
          }),
        );
        expect(
          tester.widget<Icon>(find.byIcon(Icons.gpp_bad_outlined)).color,
          AppColors.bad,
        );
        expect(
          tester.widget<Icon>(find.byIcon(Icons.edit_outlined)).color,
          AppColors.orange,
        );
        expect(find.text('Sam · 6 May 2024, 9:15 AM · update'), findsOneWidget);

        await tester.tap(find.text('Did login_failed'));
        await tester.pumpAndSettle();
        expect(find.byType(AlertDialog), findsNothing);

        await tester.tap(find.text('Did update'));
        await tester.pumpAndSettle();
        expect(find.text('Change details'), findsOneWidget);
        expect(
          tester.widget<SelectableText>(find.byType(SelectableText)).data,
          'name: \n  from: A\n  to: B\nitems: \n  - productName: Milk\n  - loose\nflag: true',
        );
      },
    );
  });

  group('UsersScreen', () {
    final users = [
      user('u1', 'Sam', 'admin'),
      user('u2', 'Kim', 'staff'),
      user('u3', 'Old', 'manager', active: false),
    ];

    testWidgets('managers see roles but cannot change them', (tester) async {
      await pumpScreen(
        tester,
        const UsersScreen(),
        convex: fakeWith({'auth:listUsers': (_) => users}),
        role: 'manager',
      );
      expect(find.byType(PopupMenuButton<String>), findsNothing);
      expect(find.text('STAFF'), findsOneWidget);
      expect(find.text('old@x.co · deactivated'), findsOneWidget);
    });

    testWidgets('admins can change other users but not themselves', (
      tester,
    ) async {
      final convex = await pumpScreen(
        tester,
        const UsersScreen(),
        convex: fakeWith({
          'auth:listUsers': (_) => users,
          'auth:updateUser': (_) => null,
        }),
      );
      expect(
        find.byType(PopupMenuButton<String>),
        findsNWidgets(2),
      ); // not for u1 (me)

      await tester.tap(find.text('STAFF'));
      await tester.pumpAndSettle();
      expect(find.text('Deactivate'), findsOneWidget);
      await tester.tap(find.text('Make manager'));
      await tester.pumpAndSettle();
      expect(convex.callsTo('auth:updateUser').last.args, {
        'userId': 'u2',
        'role': 'manager',
        'sessionToken': 'tok',
      });
      expect(find.text('User updated'), findsOneWidget);

      await tester.tap(find.text('MANAGER'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Reactivate'));
      await tester.pumpAndSettle();
      expect(convex.callsTo('auth:updateUser').last.args, {
        'userId': 'u3',
        'active': true,
        'sessionToken': 'tok',
      });
    });
  });

  group('SettingsScreen', () {
    testWidgets('edits and saves business settings', (tester) async {
      final convex = await pumpScreen(
        tester,
        const SettingsScreen(),
        convex: fakeWith({'settings:update': (_) => null}),
      );
      expect(find.text('Kai Cafe'), findsOneWidget);
      expect(
        find.text('FCP / National Programme registration no.'),
        findsOneWidget,
      );
      await tester.tap(find.text('Australia (FSANZ)'));
      await tester.pumpAndSettle();
      expect(find.text('Council food business licence no.'), findsOneWidget);

      await tester.enterText(
        find.widgetWithText(TextField, 'Business name'),
        ' Kai Bar ',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Chilled maximum (5°C standard)'),
        '4.5',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Hot minimum (60°C standard)'),
        '',
      );
      await tapOn(tester, find.text('Save'));
      expect(convex.callsTo('settings:update').single.args, {
        'businessName': 'Kai Bar',
        'registrationNumber': 'FCP-1',
        'address': '1 Main St',
        'chilledMaxC': 4.5,
        'frozenMaxC': -15.0,
        'hotMinC': null,
        'expiryWarningDays': 3.0,
        'jurisdiction': 'AU',
        'sessionToken': 'tok',
      });
      expect(find.text('Settings saved'), findsOneWidget);
    });
  });
}
