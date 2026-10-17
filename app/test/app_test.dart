import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/config.dart';
import 'package:foodsafe/main.dart' as app;
import 'package:foodsafe/screens/home_shell.dart';
import 'package:foodsafe/screens/login_screen.dart';
import 'package:foodsafe/services/auth_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fixtures.dart';
import 'helpers.dart';

void main() {
  test('CONVEX_URL defaults to the local dev backend', () {
    expect(convexUrl, 'http://127.0.0.1:3210');
  });

  testWidgets('main() boots to the sign-in screen when no session is stored', (
    tester,
  ) async {
    SharedPreferences.setMockInitialValues({});
    app.main();
    await tester.pumpAndSettle();
    expect(find.byType(LoginScreen), findsOneWidget);
    expect(find.text('NZSafetyHealthApp'), findsOneWidget);
  });

  group('auth gate', () {
    Future<void> pumpGate(WidgetTester tester, AuthService auth) => pumpScreen(
      tester,
      const app.NzSafetyHealthApp(),
      convex: auth.convex as FakeConvex,
      auth: auth,
    );

    testWidgets('spinner while restoring', (tester) async {
      final auth = AuthService(fakeWith());
      await tester.pumpWidget(
        wrapProviders(auth.convex, auth, const app.NzSafetyHealthApp()),
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      expect(find.byType(LoginScreen), findsNothing);
    });

    testWidgets('login screen when signed out', (tester) async {
      await pumpGate(tester, AuthService(fakeWith())..loading = false);
      expect(find.byType(LoginScreen), findsOneWidget);
    });

    testWidgets('home shell when signed in, swapping back on sign-out', (
      tester,
    ) async {
      final convex = fakeWith({'auth:logout': (_) => null});
      final auth = signedIn(convex);
      await pumpGate(tester, auth);
      expect(find.byType(HomeShell), findsOneWidget);
      SharedPreferences.setMockInitialValues({});
      await auth.logout();
      await tester.pumpAndSettle();
      expect(find.byType(LoginScreen), findsOneWidget);
    });
  });
}
