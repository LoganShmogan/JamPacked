import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/screens/business_picker_screen.dart';
import 'package:foodsafe/services/auth_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../fixtures.dart';
import '../helpers.dart';

/// Signed in, no business chosen yet, with [list] as their businesses.
AuthService picking(FakeConvex convex, List<Map<String, dynamic>> list) =>
    signedIn(convex)
      ..business = null
      ..businesses = [for (final b in list) Business.fromJson(b)];

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('lists businesses with programme, role and open actions', (
    tester,
  ) async {
    final list = [
      business(openCAs: 2),
      business(id: 'b2', name: 'Bakery', role: 'staff', openCAs: 1),
    ];
    final convex = fakeWith();
    final auth = picking(convex, list);
    await pumpScreen(
      tester,
      const BusinessPickerScreen(),
      convex: convex,
      auth: auth,
    );
    expect(
      find.text('Hi Sam, which business are you working in today?'),
      findsOneWidget,
    );
    expect(find.text('NP2'), findsNWidgets(2));
    expect(find.text('STAFF'), findsOneWidget);
    expect(find.text('2 open actions'), findsOneWidget);
    expect(find.text('1 open action'), findsOneWidget);
    expect(find.textContaining('Show archived'), findsNothing);

    await tester.tap(find.text('Bakery'));
    await tester.pumpAndSettle();
    expect(auth.business?.id, 'b2');
    expect(auth.user?.role, 'staff');
  });

  testWidgets('archived businesses are hidden until asked for', (tester) async {
    final convex = fakeWith();
    await pumpScreen(
      tester,
      const BusinessPickerScreen(),
      convex: convex,
      auth: picking(convex, [
        business(),
        business(id: 'b2', name: 'Old Shop', archived: true),
      ]),
    );
    expect(find.text('Old Shop'), findsNothing);
    await tapOn(tester, find.text('Show archived (1)'));
    expect(find.text('Old Shop'), findsOneWidget);
    expect(find.text('ARCHIVED'), findsOneWidget);
    await tapOn(tester, find.text('Hide archived'));
    expect(find.text('Old Shop'), findsNothing);
  });

  testWidgets('no businesses yet explains what to do', (tester) async {
    final convex = fakeWith();
    await pumpScreen(
      tester,
      const BusinessPickerScreen(),
      convex: convex,
      auth: picking(convex, []),
    );
    expect(find.textContaining('not part of any business yet'), findsOneWidget);
  });

  testWidgets('pull to refresh reloads, showing errors', (tester) async {
    var fail = false;
    final convex = fakeWith({
      'businesses:mine': (_) => fail
          ? throw fakeError('Cannot reach the server')
          : [business(), business(id: 'b2', name: 'New One')],
    });
    await pumpScreen(
      tester,
      const BusinessPickerScreen(),
      convex: convex,
      auth: picking(convex, [business()]),
    );
    Future<void> pull() async {
      await tester
          .widget<RefreshIndicator>(find.byType(RefreshIndicator))
          .onRefresh();
      await tester.pumpAndSettle();
    }

    await pull();
    expect(find.text('New One'), findsOneWidget);
    fail = true;
    await pull();
    expect(find.text('Cannot reach the server'), findsOneWidget);
    fail = false;
    await pull();
    expect(find.text('Cannot reach the server'), findsNothing);
  });

  testWidgets('sign out from the picker', (tester) async {
    final convex = fakeWith({'auth:logout': (_) => null});
    final auth = picking(convex, [business()]);
    await pumpScreen(
      tester,
      const BusinessPickerScreen(),
      convex: convex,
      auth: auth,
    );
    await tester.tap(find.byTooltip('Sign out'));
    await tester.pumpAndSettle();
    expect(auth.user, isNull);
  });

  group('AddBusinessScreen', () {
    testWidgets('creates the business and opens it', (tester) async {
      final convex = fakeWith({
        'businesses:create': (_) => 'b2',
        'businesses:mine': (_) => [
          business(),
          business(id: 'b2', name: 'Bakery'),
        ],
      });
      final auth = picking(convex, [business()]);
      await pumpScreen(
        tester,
        const BusinessPickerScreen(),
        convex: convex,
        auth: auth,
      );
      await tester.tap(find.text('Add business'));
      await tester.pumpAndSettle();
      expect(find.byType(AddBusinessScreen), findsOneWidget);

      await tapOn(tester, find.text('Create business'));
      expect(find.text('Choose a programme'), findsOneWidget);
      expect(convex.callsTo('businesses:create'), isEmpty);

      await tester.enterText(
        find.widgetWithText(TextField, 'Business name'),
        'Bakery',
      );
      await tapOn(tester, find.text('NP2: National Programme 2'));
      await tapOn(tester, find.text('Bread'));
      await tapOn(tester, find.text('Create business'));
      expect(convex.callsTo('businesses:create').single.args, {
        'name': 'Bakery',
        'programme': 'NP2',
        'sectors': ['bread'],
        'sessionToken': 'tok',
      });
      expect(find.byType(AddBusinessScreen), findsNothing);
      expect(auth.business?.id, 'b2');
    });

    testWidgets('a server error keeps the form open', (tester) async {
      final gate = Completer<void>();
      final convex = fakeWith({
        'businesses:create': (_) async {
          await gate.future;
          throw fakeError('Business name is required');
        },
      });
      await pumpScreen(tester, const AddBusinessScreen(), convex: convex);
      await tester.enterText(
        find.widgetWithText(TextField, 'Business name'),
        'X',
      );
      await tapOn(tester, find.text('Custom programme'));
      await tester.tap(find.text('Create business'));
      await tester.pump();
      expect(
        tester
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'Create business'),
            )
            .onPressed,
        isNull,
      );
      gate.complete();
      await tester.pumpAndSettle();
      expect(find.text('Business name is required'), findsOneWidget);
      expect(find.byType(AddBusinessScreen), findsOneWidget);
    });
  });
}
