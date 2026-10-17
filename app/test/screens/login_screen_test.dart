import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/screens/login_screen.dart';
import 'package:foodsafe/services/auth_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../helpers.dart';

const me = {'_id': 'u1', 'name': 'Sam', 'email': 'sam@x.co', 'role': 'admin'};

Future<(FakeConvex, AuthService)> pumpLogin(
  WidgetTester tester,
  Map<String, Handler> handlers,
) async {
  SharedPreferences.setMockInitialValues({});
  final convex = FakeConvex({'auth:me': (_) => me, ...handlers});
  final auth = AuthService(convex)..loading = false;
  await pumpScreen(tester, const LoginScreen(), convex: convex, auth: auth);
  return (convex, auth);
}

Finder field(String label) => find.widgetWithText(TextFormField, label);

void main() {
  testWidgets('validates the email before signing in', (tester) async {
    final (convex, _) = await pumpLogin(tester, {});
    await tester.tap(find.text('Sign in'));
    await tester.pump();
    expect(find.text('Enter a valid email'), findsOneWidget);
    expect(convex.calls, isEmpty);
  });

  testWidgets('signs in with trimmed email (button or keyboard submit)', (
    tester,
  ) async {
    final (convex, auth) = await pumpLogin(tester, {
      'auth:login': (_) => {'token': 't'},
    });
    await tester.enterText(field('Email'), ' sam@x.co ');
    await tester.enterText(field('Password'), 'pw');
    await tester.tap(find.text('Sign in'));
    await tester.pumpAndSettle();
    expect(convex.callsTo('auth:login').single.args, {
      'email': 'sam@x.co',
      'password': 'pw',
    });
    expect(auth.user?.name, 'Sam');

    await tester.showKeyboard(field('Password'));
    await tester.testTextInput.receiveAction(TextInputAction.done);
    await tester.pumpAndSettle();
    expect(convex.callsTo('auth:login'), hasLength(2));
  });

  testWidgets('shows a spinner while busy and server errors as a toast', (
    tester,
  ) async {
    final gate = Completer<void>();
    await pumpLogin(tester, {
      'auth:login': (_) async {
        await gate.future;
        throw fakeError('Incorrect email or password');
      },
    });
    await tester.enterText(field('Email'), 'sam@x.co');
    await tester.tap(find.text('Sign in'));
    await tester.pump();
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
    gate.complete();
    await tester.pumpAndSettle();
    expect(find.text('Incorrect email or password'), findsOneWidget);
    expect(find.text('Sign in'), findsOneWidget);
  });

  testWidgets('toggles password visibility', (tester) async {
    await pumpLogin(tester, {});
    TextField pw() => tester.widget<TextField>(
      find.descendant(of: field('Password'), matching: find.byType(TextField)),
    );
    expect(pw().obscureText, isTrue);
    await tester.tap(find.byIcon(Icons.visibility));
    await tester.pump();
    expect(pw().obscureText, isFalse);
    expect(find.byIcon(Icons.visibility_off), findsOneWidget);
  });

  testWidgets(
    'register mode validates name and password length, then registers',
    (tester) async {
      final (convex, auth) = await pumpLogin(tester, {
        'auth:register': (_) => {'token': 'r'},
      });
      await tester.tap(find.text('Create an account'));
      await tester.pump();
      expect(
        find.text('The first account created becomes the business admin.'),
        findsOneWidget,
      );
      await tester.enterText(field('Email'), 'sam@x.co');
      await tester.enterText(field('Password'), 'short');
      await tester.tap(find.text('Create account'));
      await tester.pump();
      expect(find.text('Required'), findsOneWidget);
      expect(find.text('At least 8 characters'), findsOneWidget);

      await tester.enterText(field('Full name'), ' Sam ');
      await tester.enterText(field('Password'), 'long-enough');
      await tester.tap(find.text('Create account'));
      await tester.pumpAndSettle();
      expect(convex.callsTo('auth:register').single.args, {
        'name': 'Sam',
        'email': 'sam@x.co',
        'password': 'long-enough',
      });
      expect(auth.user, isNotNull);

      await tester.tap(find.text('I already have an account'));
      await tester.pump();
      expect(field('Full name'), findsNothing);
    },
  );
}
