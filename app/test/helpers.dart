import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/services/auth_service.dart';
import 'package:jampacked/services/convex_client.dart';
import 'package:jampacked/theme.dart';
import 'package:provider/provider.dart';

typedef Handler = Object? Function(Map<String, dynamic> args);

/// One recorded call to [FakeConvex].
class Call {
  Call(this.kind, this.path, this.args);
  final String kind, path;
  final Map<String, dynamic> args;
  @override
  String toString() => '$kind $path $args';
}

/// In-memory stand-in for [ConvexClient]. Register a [Handler] per function path;
/// a handler returns the value or throws (e.g. a [ConvexException]) to simulate a
/// server error. Mutations and actions bump [changes] just like the real client, so
/// [QueryBuilder]s refetch.
class FakeConvex extends ConvexClient {
  FakeConvex([Map<String, Handler> handlers = const {}])
    : handlers = {...handlers},
      super('http://fake');

  final Map<String, Handler> handlers;
  final List<Call> calls = [];

  /// Calls made to [path], most recent last.
  List<Call> callsTo(String path) =>
      calls.where((c) => c.path == path).toList();

  Future<dynamic> _respond(
    String kind,
    String path,
    Map<String, dynamic> args,
  ) async {
    calls.add(Call(kind, path, args));
    final h = handlers[path];
    if (h == null) throw StateError('FakeConvex: no handler for $path');
    return h(args);
  }

  @override
  Future<dynamic> query(String path, [Map<String, dynamic> args = const {}]) =>
      _respond('query', path, args);

  @override
  Future<dynamic> mutation(
    String path, [
    Map<String, dynamic> args = const {},
  ]) async {
    final r = await _respond('mutation', path, args);
    changes.value++;
    return r;
  }

  @override
  Future<dynamic> action(
    String path, [
    Map<String, dynamic> args = const {},
  ]) async {
    final r = await _respond('action', path, args);
    changes.value++;
    return r;
  }
}

/// The exception the real client throws for a ConvexError with [message].
ConvexException fakeError(String message) => ConvexException(message);

/// Handler that always fails with a server (ConvexError) message.
Handler fails(String message) =>
    (_) => throw ConvexException(message);

AppUser userWith(String role, {String id = 'u1', String name = 'Sam Cook'}) =>
    AppUser(id, name, 'sam@example.com', role);

Business businessWith(
  String role, {
  String id = 'b1',
  String name = 'Kai Cafe',
}) => Business(id, name, 'NP2', role);

/// A signed-in [AuthService] backed by [convex] (no network, no prefs), working in
/// business `b1` with [role].
AuthService signedIn(
  ConvexClient convex, {
  String role = 'admin',
  AppUser? user,
}) {
  final b = businessWith(user?.role ?? role);
  return AuthService(convex)
    ..token = 'tok'
    ..user = user ?? userWith(role)
    ..businesses = [b]
    ..business = b
    ..loading = false;
}

/// [child] inside the app's providers, theme and a [MaterialApp].
Widget wrapProviders(ConvexClient convex, AuthService auth, Widget child) =>
    MultiProvider(
      providers: [
        Provider<ConvexClient>.value(value: convex),
        ChangeNotifierProvider<AuthService>.value(value: auth),
      ],
      child: MaterialApp(theme: buildTheme(), home: child),
    );

/// Pumps [child] inside the app's providers, theme and a [MaterialApp].
Future<FakeConvex> pumpScreen(
  WidgetTester tester,
  Widget child, {
  FakeConvex? convex,
  String role = 'admin',
  AuthService? auth,
  Size size = const Size(800, 2000),
}) async {
  final c = convex ?? FakeConvex();
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  await tester.pumpWidget(
    wrapProviders(c, auth ?? signedIn(c, role: role), child),
  );
  await tester.pumpAndSettle();
  return c;
}

/// Taps the widget found by [finder] (scrolling it into view first) and settles.
Future<void> tapOn(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

/// Fills the (only) dialog text field and presses [button].
Future<void> answerDialog(
  WidgetTester tester,
  String text, {
  String button = 'Save',
}) async {
  await tester.enterText(
    find.descendant(
      of: find.byType(AlertDialog),
      matching: find.byType(TextField),
    ),
    text,
  );
  await tester.tap(find.widgetWithText(FilledButton, button));
  await tester.pumpAndSettle();
}

int msAgo(Duration d) => DateTime.now().subtract(d).millisecondsSinceEpoch;
int msFromNow(Duration d) => DateTime.now().add(d).millisecondsSinceEpoch;
