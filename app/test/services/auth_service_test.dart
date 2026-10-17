import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/services/auth_service.dart';
import 'package:foodsafe/services/convex_client.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../helpers.dart';

const me = {
  '_id': 'u1',
  'name': 'Sam',
  'email': 'sam@example.com',
  'role': 'manager',
};

Future<String?> storedToken() async =>
    (await SharedPreferences.getInstance()).getString('session_token');

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('AppUser', () {
    test('fromJson and role helpers', () {
      final u = AppUser.fromJson(me);
      expect(
        [u.id, u.name, u.email, u.role],
        ['u1', 'Sam', 'sam@example.com', 'manager'],
      );
      expect(u.isManager, isTrue);
      expect(u.isAdmin, isFalse);
      expect(userWith('admin').isManager, isTrue);
      expect(userWith('admin').isAdmin, isTrue);
      expect(userWith('staff').isManager, isFalse);
    });
  });

  group('restore', () {
    test('with no stored token finishes loading signed out', () async {
      final auth = AuthService(FakeConvex());
      var notified = 0;
      auth.addListener(() => notified++);
      await auth.restore();
      expect(auth.loading, isFalse);
      expect(auth.user, isNull);
      expect(notified, 1);
    });

    test('with a valid stored token loads the user', () async {
      SharedPreferences.setMockInitialValues({'session_token': 'tok'});
      final convex = FakeConvex({'auth:me': (_) => me});
      final auth = AuthService(convex);
      await auth.restore();
      expect(auth.user?.name, 'Sam');
      expect(auth.token, 'tok');
      expect(convex.calls.single.args, {'sessionToken': 'tok'});
    });

    test('an expired session clears the stored token', () async {
      SharedPreferences.setMockInitialValues({'session_token': 'old'});
      final auth = AuthService(FakeConvex({'auth:me': (_) => null}));
      await auth.restore();
      expect(auth.user, isNull);
      expect(auth.token, isNull);
      expect(await storedToken(), isNull);
    });

    test('a server error while restoring signs out', () async {
      SharedPreferences.setMockInitialValues({'session_token': 'old'});
      final auth = AuthService(FakeConvex({'auth:me': fails('offline')}));
      await auth.restore();
      expect(auth.user, isNull);
      expect(await storedToken(), isNull);
    });
  });

  group('login / register', () {
    test('login stores the token and loads the user', () async {
      final convex = FakeConvex({
        'auth:login': (_) => {'token': 'new'},
        'auth:me': (_) => me,
      });
      final auth = AuthService(convex);
      await auth.login('sam@example.com', 'pw');
      expect(auth.token, 'new');
      expect(auth.user?.role, 'manager');
      expect(await storedToken(), 'new');
      expect(convex.callsTo('auth:login').single.args, {
        'email': 'sam@example.com',
        'password': 'pw',
      });
    });

    test('register sends name, email and password', () async {
      final convex = FakeConvex({
        'auth:register': (_) => {'token': 'reg'},
        'auth:me': (_) => me,
      });
      await AuthService(convex).register('Sam', 'sam@example.com', 'password1');
      expect(convex.callsTo('auth:register').single.args, {
        'name': 'Sam',
        'email': 'sam@example.com',
        'password': 'password1',
      });
      expect(await storedToken(), 'reg');
    });

    test('login errors propagate', () async {
      final auth = AuthService(
        FakeConvex({'auth:login': fails('Incorrect email or password')}),
      );
      await expectLater(
        auth.login('a@b.c', 'x'),
        throwsA(isA<ConvexException>()),
      );
      expect(auth.user, isNull);
    });
  });

  group('logout', () {
    test('clears state and tells the server', () async {
      SharedPreferences.setMockInitialValues({'session_token': 'tok'});
      final convex = FakeConvex({'auth:logout': (_) => null});
      final auth = signedIn(convex);
      await auth.logout();
      expect(auth.user, isNull);
      expect(auth.token, isNull);
      expect(await storedToken(), isNull);
      expect(convex.callsTo('auth:logout').single.args, {
        'sessionToken': 'tok',
      });
    });

    test('ignores server errors', () async {
      final auth = signedIn(FakeConvex({'auth:logout': fails('offline')}));
      await auth.logout();
      expect(auth.user, isNull);
    });

    test('when already signed out does not call the server', () async {
      final convex = FakeConvex();
      await AuthService(convex).logout();
      expect(convex.calls, isEmpty);
    });
  });
}
