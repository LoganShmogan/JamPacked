import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/screens/login_screen.dart';
import 'package:jampacked/services/auth_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../fixtures.dart';
import '../helpers.dart';

const me = {'_id': 'u1', 'name': 'Sam', 'email': 'sam@x.co'};

Future<(FakeConvex, AuthService)> pumpLogin(
  WidgetTester tester,
  Map<String, Handler> handlers,
) async {
  SharedPreferences.setMockInitialValues({});
  final convex = FakeConvex({
    'auth:me': (_) => me,
    'businesses:mine': (_) => [business()],
    'businesses:programmes': (_) => programmes,
    ...handlers,
  });
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

  testWidgets('register: account details are validated before moving on', (
    tester,
  ) async {
    final (convex, _) = await pumpLogin(tester, {});
    await tester.tap(find.text('Create an account'));
    await tester.pump();
    expect(
      find.text(
        'Next you will set up your business and choose the programme it follows.',
      ),
      findsOneWidget,
    );
    await tester.enterText(field('Email'), 'sam@x.co');
    await tester.enterText(field('Password'), 'short');
    await tester.tap(find.text('Next'));
    await tester.pump();
    expect(find.text('Required'), findsOneWidget);
    expect(find.text('At least 8 characters'), findsOneWidget);
    expect(convex.calls, isEmpty);

    await tester.tap(find.text('I already have an account'));
    await tester.pump();
    expect(field('Full name'), findsNothing);
  });

  Future<void> fillAccount(WidgetTester tester) async {
    await tester.tap(find.text('Create an account'));
    await tester.pump();
    await tester.enterText(field('Full name'), ' Sam ');
    await tester.enterText(field('Email'), 'sam@x.co');
    await tester.enterText(field('Password'), 'long-enough');
  }

  testWidgets(
    'register: then the business, its programme and sectors, then creates both',
    (tester) async {
      final (convex, auth) = await pumpLogin(tester, {
        'auth:register': (_) => {'token': 'r'},
      });
      await fillAccount(tester);
      await tester.tap(find.text('Next'));
      await tester.pumpAndSettle();
      expect(find.text('Set up your main business'), findsOneWidget);
      expect(find.text('• Sell chilled or frozen foods'), findsOneWidget);

      // Nothing chosen yet.
      await tapOn(tester, find.text('Create account'));
      expect(find.text('Required'), findsOneWidget);
      expect(find.text('Choose a programme'), findsOneWidget);
      expect(convex.callsTo('auth:register'), isEmpty);

      await tester.enterText(
        find.widgetWithText(TextField, 'Business name'),
        ' Kai Cafe ',
      );
      await tapOn(tester, find.text('NP1: National Programme 1'));
      expect(find.text('Transport and distribution'), findsOneWidget);
      await tapOn(tester, find.text('NP2: National Programme 2'));
      expect(find.text('Transport and distribution'), findsNothing);
      await tapOn(tester, find.text('Early Childhood Centre (ECE)'));
      await tapOn(tester, find.text('Bread'));
      await tapOn(tester, find.text('Bread')); // and off again
      await tapOn(tester, find.text('Create account'));
      expect(convex.callsTo('auth:register').single.args, {
        'name': 'Sam',
        'email': 'sam@x.co',
        'password': 'long-enough',
        'business': {
          'name': 'Kai Cafe',
          'programme': 'NP2',
          'sectors': ['ece'],
        },
      });
      expect(auth.user, isNotNull);
      expect(auth.business?.id, 'b1');
    },
  );

  testWidgets('register: custom programme has no sectors; Back keeps details', (
    tester,
  ) async {
    final (convex, _) = await pumpLogin(tester, {
      'auth:register': (_) => {'token': 'r'},
    });
    await fillAccount(tester);
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    await tapOn(tester, find.text('Back'));
    expect(find.text('Sam'), findsNothing); // trimmed on send, raw in field
    expect(find.text(' Sam '), findsOneWidget);
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    await tester.enterText(
      find.widgetWithText(TextField, 'Business name'),
      'Bar',
    );
    await tapOn(tester, find.text('Custom programme'));
    expect(find.text('WHAT DOES YOUR BUSINESS DO?'), findsNothing);
    await tapOn(tester, find.text('Create account'));
    expect(convex.callsTo('auth:register').single.args['business'], {
      'name': 'Bar',
      'programme': 'custom',
      'sectors': <String>[],
    });
  });

  testWidgets('register: invited people skip the business step', (
    tester,
  ) async {
    final (convex, _) = await pumpLogin(tester, {
      'auth:register': (_) => {'token': 'r'},
    });
    await fillAccount(tester);
    await tapOn(
      tester,
      find.text("I've been invited to join an existing business"),
    );
    expect(
      find.text('Use the email address you were invited with.'),
      findsOneWidget,
    );
    await tapOn(tester, find.text('Create account'));
    expect(convex.callsTo('auth:register').single.args, {
      'name': 'Sam',
      'email': 'sam@x.co',
      'password': 'long-enough',
      'business': null, // dropped by the real client
    });
  });

  testWidgets('register: programmes that fail to load can be retried', (
    tester,
  ) async {
    var fail = true;
    await pumpLogin(tester, {
      'businesses:programmes': (_) =>
          fail ? throw fakeError('Cannot reach the server') : programmes,
    });
    await fillAccount(tester);
    await tester.tap(find.text('Next'));
    await tester.pumpAndSettle();
    expect(find.text('Cannot reach the server'), findsOneWidget);
    fail = false;
    await tapOn(tester, find.text('Retry'));
    expect(find.text('NP1: National Programme 1'), findsOneWidget);
  });
}
