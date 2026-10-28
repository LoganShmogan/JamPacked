import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/services/auth_service.dart';
import 'package:jampacked/services/convex_client.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../fixtures.dart' as fixtures;
import '../helpers.dart';

const me = {'_id': 'u1', 'name': 'Sam', 'email': 'sam@example.com'};

Future<String?> storedToken() async =>
    (await SharedPreferences.getInstance()).getString('session_token');
Future<String?> storedBusiness() async =>
    (await SharedPreferences.getInstance()).getString('business_today');
String today() => DateTime.now().toIso8601String().substring(0, 10);

/// A client that knows who 'tok' is and which businesses they belong to.
FakeConvex withBusinesses(List<Map<String, dynamic>> list) => FakeConvex({
  'auth:me': (_) => me,
  'auth:login': (_) => {'token': 'tok'},
  'businesses:mine': (_) => list,
});

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('AppUser', () {
    test('fromJson and role helpers', () {
      final u = AppUser.fromJson(me);
      expect(
        [u.id, u.name, u.email, u.role],
        ['u1', 'Sam', 'sam@example.com', ''],
      );
      expect(u.isManager, isFalse);
      final m = u.withRole('manager');
      expect([m.id, m.name, m.role], ['u1', 'Sam', 'manager']);
      expect(m.isManager, isTrue);
      expect(m.isAdmin, isFalse);
      expect(userWith('admin').isManager, isTrue);
      expect(userWith('admin').isAdmin, isTrue);
      expect(userWith('staff').isManager, isFalse);
    });
  });

  group('Business', () {
    test('fromJson with and without optional fields', () {
      final b = Business.fromJson(
        fixtures.business(openCAs: 2, archived: true),
      );
      expect(
        [b.id, b.name, b.programme, b.role],
        ['b1', 'Kai Cafe', 'NP2', 'admin'],
      );
      expect([b.archived, b.isOwner, b.openCorrectiveActions], [true, true, 2]);
      final bare = Business.fromJson({
        '_id': 'b2',
        'name': 'X',
        'programme': 'custom',
        'role': 'staff',
      });
      expect(
        [bare.sectors, bare.archived, bare.isOwner, bare.openCorrectiveActions],
        [<String>[], false, false, 0],
      );
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

    test(
      'with a valid stored token loads the user and their businesses',
      () async {
        SharedPreferences.setMockInitialValues({'session_token': 'tok'});
        final convex = withBusinesses([
          fixtures.business(),
          fixtures.business(id: 'b2', name: 'Bakery', role: 'staff'),
        ]);
        final auth = AuthService(convex);
        await auth.restore();
        expect(auth.user?.name, 'Sam');
        expect(auth.token, 'tok');
        expect(auth.businesses.map((b) => b.name), ['Kai Cafe', 'Bakery']);
        expect(auth.business, isNull); // two to choose from
        expect(convex.callsTo('businesses:mine').single.args, {
          'sessionToken': 'tok',
        });
      },
    );

    test("reopens today's business, but not yesterday's", () async {
      final list = [
        fixtures.business(),
        fixtures.business(id: 'b2', name: 'Bakery', role: 'staff'),
      ];
      SharedPreferences.setMockInitialValues({
        'session_token': 'tok',
        'business_today': 'b2|${today()}',
      });
      final auth = AuthService(withBusinesses(list));
      await auth.restore();
      expect(auth.business?.name, 'Bakery');
      expect(auth.user?.role, 'staff');

      SharedPreferences.setMockInitialValues({
        'session_token': 'tok',
        'business_today': 'b2|2000-01-01',
      });
      final later = AuthService(withBusinesses(list));
      await later.restore();
      expect(later.business, isNull);
    });

    test('picks the only open business automatically', () async {
      SharedPreferences.setMockInitialValues({'session_token': 'tok'});
      final auth = AuthService(
        withBusinesses([
          fixtures.business(),
          fixtures.business(id: 'old', name: 'Old', archived: true),
        ]),
      );
      await auth.restore();
      expect(auth.business?.id, 'b1');
      expect(auth.user?.isAdmin, isTrue);
      expect(await storedBusiness(), 'b1|${today()}');
    });

    test(
      "ignores today's choice when that business has been archived",
      () async {
        SharedPreferences.setMockInitialValues({
          'session_token': 'tok',
          'business_today': 'old|${today()}',
        });
        final auth = AuthService(
          withBusinesses([
            fixtures.business(id: 'old', name: 'Old', archived: true),
            fixtures.business(),
            fixtures.business(id: 'b2', name: 'Bakery'),
          ]),
        );
        await auth.restore();
        expect(auth.business, isNull);
      },
    );

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
    test('login stores the token and loads the user and businesses', () async {
      final convex = FakeConvex({
        'auth:login': (_) => {'token': 'new'},
        'auth:me': (_) => me,
        'businesses:mine': (_) => [fixtures.business(role: 'manager')],
      });
      final auth = AuthService(convex);
      await auth.login('sam@example.com', 'pw');
      expect(auth.token, 'new');
      expect(auth.business?.name, 'Kai Cafe');
      expect(auth.user?.role, 'manager');
      expect(await storedToken(), 'new');
      expect(convex.callsTo('auth:login').single.args, {
        'email': 'sam@example.com',
        'password': 'pw',
      });
    });

    test('register sends the account and main business', () async {
      final convex = FakeConvex({
        'auth:register': (_) => {'token': 'reg'},
        'auth:me': (_) => me,
        'businesses:mine': (_) => [fixtures.business()],
      });
      final b = {'name': 'Kai Cafe', 'programme': 'NP2', 'sectors': <String>[]};
      await AuthService(convex)
          .register('Sam', 'sam@example.com', 'password1', business: b);
      expect(convex.callsTo('auth:register').single.args, {
        'name': 'Sam',
        'email': 'sam@example.com',
        'password': 'password1',
        'business': b,
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

  group('selectBusiness / switchBusiness / loadBusinesses', () {
    test(
      'select sets the role and remembers it for today; switch forgets',
      () async {
        final convex = withBusinesses([
          fixtures.business(),
          fixtures.business(id: 'b2', name: 'Bakery', role: 'staff'),
        ]);
        final auth = signedIn(convex);
        var notified = 0;
        auth.addListener(() => notified++);
        await auth.selectBusiness(Business('b2', 'Bakery', 'NP3', 'staff'));
        expect(auth.business?.id, 'b2');
        expect(auth.user?.role, 'staff');
        expect(await storedBusiness(), 'b2|${today()}');

        await auth.switchBusiness();
        expect(auth.business, isNull);
        expect(auth.user?.role, '');
        expect(await storedBusiness(), isNull);
        expect(auth.businesses, hasLength(2)); // reloaded, but nothing picked
        expect(notified, 3);
      },
    );
  });

  group('logout', () {
    test('clears state and tells the server', () async {
      SharedPreferences.setMockInitialValues({'session_token': 'tok'});
      final convex = FakeConvex({'auth:logout': (_) => null});
      final auth = signedIn(convex);
      await auth.logout();
      expect(auth.user, isNull);
      expect(auth.token, isNull);
      expect(auth.business, isNull);
      expect(auth.businesses, isEmpty);
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
