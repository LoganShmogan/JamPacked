import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/main.dart';
import 'package:foodsafe/screens/admin_screens.dart';
import 'package:foodsafe/screens/expiring_screen.dart';
import 'package:foodsafe/screens/login_screen.dart';
import 'package:foodsafe/screens/more_screen.dart';
import 'package:foodsafe/screens/products_screen.dart';
import 'package:foodsafe/screens/suppliers_screen.dart';
import 'package:foodsafe/screens/temperature_screen.dart';
import 'package:foodsafe/screens/trace_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../fixtures.dart';
import '../helpers.dart';

void main() {
  testWidgets('shows the signed-in user with role badge', (tester) async {
    await pumpScreen(
      tester,
      const MoreScreen(),
      convex: fakeWith(),
      role: 'manager',
    );
    expect(find.text('Sam Cook'), findsOneWidget);
    expect(find.text('sam@example.com'), findsOneWidget);
    expect(find.text('S'), findsOneWidget);
    expect(find.text('MANAGER'), findsOneWidget);
  });

  testWidgets('staff see records only', (tester) async {
    await pumpScreen(
      tester,
      const MoreScreen(),
      convex: fakeWith(),
      role: 'staff',
    );
    expect(find.text('COMPLIANCE'), findsNothing);
    expect(find.text('Audit trail'), findsNothing);
  });

  testWidgets('managers see audit trail and users but not settings', (
    tester,
  ) async {
    await pumpScreen(
      tester,
      const MoreScreen(),
      convex: fakeWith(),
      role: 'manager',
    );
    expect(find.text('Audit trail'), findsOneWidget);
    expect(find.text('Users'), findsOneWidget);
    expect(find.text('Business settings'), findsNothing);
  });

  for (final (label, screen) in [
    ('Temperature checks', TemperatureScreen),
    ('Suppliers', SuppliersScreen),
    ('Products', ProductsScreen),
    ('Expiring stock', ExpiringScreen),
    ('Trace & recall', TraceScreen),
    ('Audit trail', AuditTrailScreen),
    ('Users', UsersScreen),
    ('Business settings', SettingsScreen),
  ]) {
    testWidgets('admin: "$label" opens $screen', (tester) async {
      await pumpScreen(tester, const MoreScreen(), convex: fakeWith());
      await tapOn(tester, find.text(label));
      expect(find.byType(screen), findsOneWidget);
    });
  }

  testWidgets('sign out returns to the sign-in screen', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final convex = fakeWith({'auth:logout': (_) => null});
    final auth = signedIn(convex);
    // Through the real auth gate, which swaps the shell out when the user goes away.
    await pumpScreen(
      tester,
      const NzSafetyHealthApp(),
      convex: convex,
      auth: auth,
      size: const Size(400, 1400),
    );
    await tester.tap(find.text('More'));
    await tester.pumpAndSettle();
    await tapOn(tester, find.text('Sign out'));
    expect(auth.user, isNull);
    expect(convex.callsTo('auth:logout'), hasLength(1));
    expect(find.byType(LoginScreen), findsOneWidget);
  });
}
