import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/screens/admin_screens.dart';
import 'package:jampacked/theme.dart';

import 'package:shared_preferences/shared_preferences.dart';

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
        'businessId': 'b1',
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
          AppColors.jam,
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

  group('MembersScreen', () {
    final members = {
      'members': [
        user('u1', 'Sam', 'admin'),
        user('u2', 'Kim', 'staff'),
        user('u3', 'Old', 'manager', active: false),
      ],
      'invites': [
        {
          'email': 'new@x.co',
          'role': 'staff',
          'invitedByName': 'Sam',
          'createdAt': t0,
        },
      ],
    };

    testWidgets('managers see roles and invites but cannot change or invite', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const MembersScreen(),
        convex: fakeWith({'businesses:members': (_) => members}),
        role: 'manager',
      );
      expect(find.byType(PopupMenuButton<String>), findsNothing);
      expect(find.text('Invite'), findsNothing);
      expect(find.text('old@x.co · removed'), findsOneWidget);
      expect(find.text('INVITED'), findsOneWidget);
      expect(find.text('new@x.co'), findsOneWidget);
      expect(find.text('Invited by Sam on 6 May 2024'), findsOneWidget);
    });

    testWidgets('no invites section when nobody is pending', (tester) async {
      await pumpScreen(tester, const MembersScreen(), convex: fakeWith());
      expect(find.text('INVITED'), findsNothing);
    });

    testWidgets('admins can change other members but not themselves', (
      tester,
    ) async {
      final convex = await pumpScreen(
        tester,
        const MembersScreen(),
        convex: fakeWith({
          'businesses:members': (_) => members,
          'businesses:updateMember': (_) => null,
        }),
      );
      expect(
        find.byType(PopupMenuButton<String>),
        findsNWidgets(2),
      ); // not for u1 (me)

      await tester.tap(find.text('STAFF').first);
      await tester.pumpAndSettle();
      expect(find.text('Remove from business'), findsOneWidget);
      await tester.tap(find.text('Make manager'));
      await tester.pumpAndSettle();
      expect(convex.callsTo('businesses:updateMember').last.args, {
        'userId': 'u2',
        'role': 'manager',
        'businessId': 'b1',
        'sessionToken': 'tok',
      });
      expect(find.text('Member updated'), findsOneWidget);

      await tester.tap(find.text('MANAGER'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Restore access'));
      await tester.pumpAndSettle();
      expect(convex.callsTo('businesses:updateMember').last.args, {
        'userId': 'u3',
        'active': true,
        'businessId': 'b1',
        'sessionToken': 'tok',
      });
    });

    for (final (added, message) in [
      (true, 'Added to the business'),
      (
        false,
        'Invited. They join when they create an account with that email.',
      ),
    ]) {
      testWidgets('admins invite by email and role (added: $added)', (
        tester,
      ) async {
        final convex = await pumpScreen(
          tester,
          const MembersScreen(),
          convex: fakeWith({
            'businesses:invite': (_) => {'added': added},
          }),
        );
        await tester.tap(find.text('Invite'));
        await tester.pumpAndSettle();
        await tester.enterText(find.byType(TextField), ' kim@x.co ');
        await tester.tap(find.text('staff'));
        await tester.pumpAndSettle();
        await tester.tap(find.text('manager').last);
        await tester.pumpAndSettle();
        await tester.tap(find.widgetWithText(FilledButton, 'Invite'));
        await tester.pumpAndSettle();
        expect(convex.callsTo('businesses:invite').single.args, {
          'email': 'kim@x.co',
          'role': 'manager',
          'businessId': 'b1',
          'sessionToken': 'tok',
        });
        expect(find.text(message), findsOneWidget);
      });
    }

    testWidgets('cancelling or a failed invite sends nothing more', (
      tester,
    ) async {
      final convex = await pumpScreen(
        tester,
        const MembersScreen(),
        convex: fakeWith({
          'businesses:invite': fails('kim@x.co has already been invited'),
        }),
      );
      await tester.tap(find.text('Invite'));
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(convex.callsTo('businesses:invite'), isEmpty);

      await tester.tap(find.text('Invite'));
      await tester.pumpAndSettle();
      await tester.enterText(find.byType(TextField), 'kim@x.co');
      await tester.tap(find.widgetWithText(FilledButton, 'Invite'));
      await tester.pumpAndSettle();
      expect(find.text('kim@x.co has already been invited'), findsOneWidget);
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
      await pickRegion(tester, 'Victoria', label: 'State or territory');

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
        'region': 'Victoria',
        'businessId': 'b1',
        'sessionToken': 'tok',
      });
      expect(find.text('Settings saved'), findsOneWidget);
    });

    testWidgets('shows the saved region; changing country clears it', (
      tester,
    ) async {
      final convex = await pumpScreen(
        tester,
        const SettingsScreen(),
        convex: fakeWith({
          'settings:get': (_) => {...settings(), 'region': 'Otago'},
          'settings:update': (_) => null,
        }),
      );
      expect(find.text('Otago'), findsOneWidget);
      await tapOn(tester, find.text('Save'));
      expect(convex.callsTo('settings:update').last.args['region'], 'Otago');

      await tapOn(tester, find.text('Australia (FSANZ)'));
      expect(find.text('Otago'), findsNothing);
      await tapOn(tester, find.text('Save'));
      expect(
        convex.callsTo('settings:update').last.args.containsKey('region'),
        isFalse,
      );
    });

    testWidgets('archiving goes back to the business picker', (tester) async {
      SharedPreferences.setMockInitialValues({});
      final convex = fakeWith({'businesses:setArchived': (_) => null});
      final auth = signedIn(convex);
      await pumpScreen(
        tester,
        const SettingsScreen(),
        convex: convex,
        auth: auth,
      );
      expect(find.text('Restore this business'), findsNothing);
      await tapOn(tester, find.text('Archive this business'));
      expect(convex.callsTo('businesses:setArchived').single.args, {
        'archived': true,
        'businessId': 'b1',
        'sessionToken': 'tok',
      });
      expect(auth.business, isNull);
      expect(convex.callsTo('businesses:mine'), hasLength(1));
    });

    testWidgets('a failed archive stays put', (tester) async {
      final convex = fakeWith({'businesses:setArchived': fails('Nope')});
      final auth = signedIn(convex);
      await pumpScreen(
        tester,
        const SettingsScreen(),
        convex: convex,
        auth: auth,
      );
      await tapOn(tester, find.text('Archive this business'));
      expect(find.text('Nope'), findsOneWidget);
      expect(auth.business, isNotNull);
    });

    testWidgets('an archived business can be restored', (tester) async {
      final convex = fakeWith({
        'settings:get': (_) => {...settings(), 'archived': true},
        'businesses:setArchived': (_) => null,
      });
      await pumpScreen(tester, const SettingsScreen(), convex: convex);
      await tapOn(tester, find.text('Restore this business'));
      expect(convex.callsTo('businesses:setArchived').single.args, {
        'archived': false,
        'businessId': 'b1',
        'sessionToken': 'tok',
      });
      expect(find.text('Business restored'), findsOneWidget);
      expect(find.text('Archive this business'), findsOneWidget);
      expect(convex.callsTo('businesses:mine'), hasLength(1));
    });

    testWidgets('a failed restore keeps the restore button', (tester) async {
      final convex = fakeWith({
        'settings:get': (_) => {...settings(), 'archived': true},
        'businesses:setArchived': fails('Nope'),
      });
      await pumpScreen(tester, const SettingsScreen(), convex: convex);
      await tapOn(tester, find.text('Restore this business'));
      expect(find.text('Nope'), findsOneWidget);
      expect(find.text('Restore this business'), findsOneWidget);
    });
  });
}
