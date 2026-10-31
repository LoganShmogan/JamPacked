import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/main.dart';
import 'package:jampacked/screens/admin_screens.dart';
import 'package:jampacked/screens/business_picker_screen.dart';
import 'package:jampacked/screens/expiring_screen.dart';
import 'package:jampacked/screens/export_screen.dart';
import 'package:jampacked/screens/login_screen.dart';
import 'package:jampacked/screens/more_screen.dart';
import 'package:jampacked/screens/products_screen.dart';
import 'package:jampacked/screens/suppliers_screen.dart';
import 'package:jampacked/screens/temperature_screen.dart';
import 'package:jampacked/screens/trace_screen.dart';
import 'package:jampacked/screens/help_screen.dart';
import 'package:jampacked/screens/insights_screen.dart';
import 'package:jampacked/screens/production_screen.dart';
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

  testWidgets('shows the business being worked in with its programme', (
    tester,
  ) async {
    await pumpScreen(tester, const MoreScreen(), convex: fakeWith());
    expect(find.text('Kai Cafe'), findsOneWidget);
    expect(find.text('NP2'), findsOneWidget);
    expect(find.text('1 business'), findsOneWidget);
  });

  testWidgets('switch business goes back to the picker', (tester) async {
    SharedPreferences.setMockInitialValues({});
    final convex = fakeWith({
      'businesses:mine': (_) => [
        business(),
        business(id: 'b2', name: 'Bakery'),
      ],
    });
    final auth = signedIn(convex);
    await pumpScreen(
      tester,
      const JamPackedApp(),
      convex: convex,
      auth: auth,
      size: const Size(400, 1400),
    );
    await tester.tap(find.text('More'));
    await tester.pumpAndSettle();
    await tapOn(tester, find.text('Switch business'));
    expect(auth.business, isNull);
    expect(find.byType(BusinessPickerScreen), findsOneWidget);
    expect(find.text('Bakery'), findsOneWidget);
  });

  testWidgets('managers see audit trail and members but not settings', (
    tester,
  ) async {
    await pumpScreen(
      tester,
      const MoreScreen(),
      convex: fakeWith(),
      role: 'manager',
    );
    expect(find.text('Audit trail'), findsOneWidget);
    expect(find.text('Members'), findsOneWidget);
    expect(find.text('Business settings'), findsNothing);
  });

  for (final (label, screen) in [
    ('Temperature checks', TemperatureScreen),
    ('Suppliers', SuppliersScreen),
    ('Insights', InsightsScreen),
    ('Help & support', HelpScreen),
    ('Production', ProductionScreen),
    ('Products', ProductsScreen),
    ('Expiring stock', ExpiringScreen),
    ('Trace & recall', TraceScreen),
    ('Audit trail', AuditTrailScreen),
    ('Members', MembersScreen),
    ('Add another business', AddBusinessScreen),
    ('Business settings', SettingsScreen),
    ('Export records', ExportScreen),
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
      const JamPackedApp(),
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
