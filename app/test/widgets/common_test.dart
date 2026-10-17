import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/services/auth_service.dart';
import 'package:foodsafe/services/convex_client.dart';
import 'package:foodsafe/theme.dart';
import 'package:foodsafe/widgets/common.dart';

import '../helpers.dart';

/// Exposes a [BuildContext] under the app providers for testing the extension.
class _Probe extends StatelessWidget {
  const _Probe(this.onBuild);
  final void Function(BuildContext) onBuild;
  @override
  Widget build(BuildContext context) {
    onBuild(context);
    return const Scaffold(body: SizedBox());
  }
}

void main() {
  group('formatters', () {
    test('fmtNum', () {
      expect(fmtNum(null), '-');
      expect(fmtNum(3), '3');
      expect(fmtNum(3.0), '3');
      expect(fmtNum(2.25), '2.3');
      expect(fmtNum(-15), '-15');
    });

    test('fmtDate / fmtDateTime / fromMs', () {
      final ms = DateTime(2024, 3, 5, 14, 7).millisecondsSinceEpoch;
      expect(fromMs(ms), DateTime(2024, 3, 5, 14, 7));
      expect(fromMs(ms.toDouble()), DateTime(2024, 3, 5, 14, 7));
      expect(fmtDate(ms), '5 Mar 2024');
      expect(fmtDateTime(ms), '5 Mar 2024, 2:07 PM');
      expect(fmtDate(null), '-');
      expect(fmtDateTime(null), '-');
    });

    test('localDayStartMs is local midnight today', () {
      final d = DateTime.fromMillisecondsSinceEpoch(localDayStartMs());
      final now = DateTime.now();
      expect(
        [d.year, d.month, d.day, d.hour, d.minute],
        [now.year, now.month, now.day, 0, 0],
      );
    });

    test('constants cover every storage type and the 21 PEAL allergens', () {
      expect(storageLabels.keys, storageIcons.keys);
      expect(storageLabels.keys, ['chilled', 'frozen', 'hot', 'ambient']);
      expect(allergenList, hasLength(21));
    });
  });

  group('AppContext', () {
    testWidgets('q/m/a add the session token; convex/auth/token getters', (
      tester,
    ) async {
      late BuildContext ctx;
      final convex = await pumpScreen(
        tester,
        _Probe((c) => ctx = c),
        convex: FakeConvex({
          'x:q': (a) => 'q',
          'x:m': (a) => 'm',
          'x:a': (a) => 'a',
        }),
      );
      expect(ctx.convex, same(convex));
      expect(ctx.auth.user?.name, 'Sam Cook');
      expect(ctx.token, 'tok');
      expect(await ctx.q('x:q', {'id': 1}), 'q');
      expect(await ctx.m('x:m'), 'm');
      expect(await ctx.a('x:a'), 'a');
      expect(convex.calls.map((c) => c.args), [
        {'id': 1, 'sessionToken': 'tok'},
        {'sessionToken': 'tok'},
        {'sessionToken': 'tok'},
      ]);
    });

    testWidgets('token is empty when signed out', (tester) async {
      late BuildContext ctx;
      final convex = FakeConvex();
      await pumpScreen(
        tester,
        _Probe((c) => ctx = c),
        convex: convex,
        auth: signedIn(convex)..token = null,
      );
      expect(ctx.token, '');
    });

    testWidgets('run returns the result and shows the success toast', (
      tester,
    ) async {
      late BuildContext ctx;
      await pumpScreen(tester, _Probe((c) => ctx = c));
      expect(await ctx.run(() async => 7, success: 'Saved'), 7);
      await tester.pump();
      expect(find.text('Saved'), findsOneWidget);
      expect(
        tester.widget<SnackBar>(find.byType(SnackBar)).backgroundColor,
        AppColors.ink,
      );
    });

    testWidgets('run without a success message shows nothing', (tester) async {
      late BuildContext ctx;
      await pumpScreen(tester, _Probe((c) => ctx = c));
      expect(await ctx.run(() async => 'x'), 'x');
      await tester.pump();
      expect(find.byType(SnackBar), findsNothing);
    });

    testWidgets('run shows server errors in red and returns null', (
      tester,
    ) async {
      late BuildContext ctx;
      await pumpScreen(tester, _Probe((c) => ctx = c));
      expect(
        await ctx.run<int>(() async => throw ConvexException('Nope')),
        isNull,
      );
      await tester.pump();
      expect(find.text('Nope'), findsOneWidget);
      expect(
        tester.widget<SnackBar>(find.byType(SnackBar)).backgroundColor,
        AppColors.bad,
      );
    });
  });

  group('QueryBuilder', () {
    Widget qb({
      String path = 'p:list',
      Map<String, dynamic> args = const {},
      bool refreshable = true,
    }) => Scaffold(
      body: QueryBuilder(
        path: path,
        args: args,
        refreshable: refreshable,
        builder: (context, data) => ListView(children: [Text('data: $data')]),
      ),
    );

    testWidgets('shows a spinner, then the data inside a RefreshIndicator', (
      tester,
    ) async {
      final convex = FakeConvex({'p:list': (a) => 'hello ${a['n']}'});
      await pumpScreen(tester, qb(args: {'n': 1}), convex: convex);
      expect(find.text('data: hello 1'), findsOneWidget);
      expect(find.byType(RefreshIndicator), findsOneWidget);
      expect(convex.calls.single.args, {'n': 1, 'sessionToken': 'tok'});
    });

    testWidgets('spinner is visible before the first response', (tester) async {
      final convex = FakeConvex({'p:list': (a) => 'x'});
      tester.view.physicalSize = const Size(800, 1200);
      addTearDown(tester.view.reset);
      await tester.pumpWidget(Container());
      final auth = signedIn(convex);
      await tester.pumpWidget(_wrap(convex, auth, qb()));
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.pumpAndSettle();
      expect(find.text('data: x'), findsOneWidget);
    });

    testWidgets('non-refreshable builders are not wrapped', (tester) async {
      await pumpScreen(
        tester,
        qb(refreshable: false),
        convex: FakeConvex({'p:list': (_) => 1}),
      );
      expect(find.byType(RefreshIndicator), findsNothing);
    });

    testWidgets('refetches after any mutation and on pull-to-refresh', (
      tester,
    ) async {
      var n = 0;
      final convex = FakeConvex({'p:list': (_) => ++n, 'x:m': (_) => null});
      await pumpScreen(tester, qb(), convex: convex);
      expect(find.text('data: 1'), findsOneWidget);
      await convex.mutation('x:m');
      await tester.pumpAndSettle();
      expect(find.text('data: 2'), findsOneWidget);
      // Pull-to-refresh calls the same loader.
      await tester
          .widget<RefreshIndicator>(find.byType(RefreshIndicator))
          .onRefresh();
      await tester.pumpAndSettle();
      expect(find.text('data: 3'), findsOneWidget);
    });

    testWidgets('refetches when path or args change, but not otherwise', (
      tester,
    ) async {
      final convex = FakeConvex({
        'p:list': (a) => 'list ${a['k']}',
        'p:other': (a) => 'other',
      });
      final auth = signedIn(convex);
      await tester.pumpWidget(_wrap(convex, auth, qb(args: {'k': 1})));
      await tester.pumpAndSettle();
      await tester.pumpWidget(_wrap(convex, auth, qb(args: {'k': 1})));
      await tester.pumpAndSettle();
      expect(convex.calls, hasLength(1));
      await tester.pumpWidget(_wrap(convex, auth, qb(args: {'k': 2})));
      await tester.pumpAndSettle();
      expect(find.text('data: list 2'), findsOneWidget);
      await tester.pumpWidget(
        _wrap(convex, auth, qb(path: 'p:other', args: {'k': 2})),
      );
      await tester.pumpAndSettle();
      expect(find.text('data: other'), findsOneWidget);
      expect(convex.calls, hasLength(3));
    });

    testWidgets('shows the error with a working Retry button', (tester) async {
      var fail = true;
      final convex = FakeConvex({
        'p:list': (_) =>
            fail ? throw ConvexException('Cannot reach the server') : 'ok',
      });
      await pumpScreen(tester, qb(), convex: convex);
      expect(find.text('Cannot reach the server'), findsOneWidget);
      expect(find.byIcon(Icons.cloud_off), findsOneWidget);
      fail = false;
      await tester.tap(find.text('Retry'));
      await tester.pumpAndSettle();
      expect(find.text('data: ok'), findsOneWidget);
    });

    testWidgets('keeps showing stale data if a refetch fails', (tester) async {
      var fail = false;
      final convex = FakeConvex({
        'p:list': (_) => fail ? throw ConvexException('offline') : 'cached',
        'x:m': (_) => null,
      });
      await pumpScreen(tester, qb(), convex: convex);
      fail = true;
      await convex.mutation('x:m');
      await tester.pumpAndSettle();
      expect(find.text('data: cached'), findsOneWidget);
      expect(find.text('offline'), findsNothing);
    });

    testWidgets('stops listening and ignores late responses after dispose', (
      tester,
    ) async {
      final convex = FakeConvex({'p:list': (_) => 'x', 'x:m': (_) => null});
      final auth = signedIn(convex);
      await tester.pumpWidget(_wrap(convex, auth, qb()));
      // Dispose before the first response lands.
      await tester.pumpWidget(_wrap(convex, auth, const SizedBox()));
      await tester.pumpAndSettle();
      await convex.mutation('x:m');
      await tester.pumpAndSettle();
      expect(convex.callsTo('p:list'), hasLength(1));
    });
  });

  group('small widgets', () {
    testWidgets('Pill renders every tone with an optional icon', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const Scaffold(
          body: Column(
            children: [
              Pill('ok', tone: Tone.ok, icon: Icons.check),
              Pill('warn', tone: Tone.warn),
              Pill('bad', tone: Tone.bad),
              Pill('brand', tone: Tone.brand),
              Pill('neutral'),
            ],
          ),
        ),
      );
      Color colorOf(String text) =>
          tester.widget<Text>(find.text(text)).style!.color!;
      expect(colorOf('ok'), AppColors.ok);
      expect(colorOf('warn'), AppColors.warn);
      expect(colorOf('bad'), AppColors.bad);
      expect(colorOf('brand'), AppColors.orangeDark);
      expect(colorOf('neutral'), AppColors.muted);
      expect(find.byIcon(Icons.check), findsOneWidget);
    });

    testWidgets('SectionTitle, EmptyState, InfoRow and Responsive', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        Scaffold(
          body: Column(
            children: [
              const SectionTitle('Today', trailing: Icon(Icons.star)),
              const SectionTitle('Plain'),
              const InfoRow('Label', 'Value'),
              const Responsive(
                maxWidth: 100,
                child: SizedBox(key: Key('r'), width: 500, height: 10),
              ),
              const Expanded(
                child: EmptyState(
                  icon: Icons.inbox,
                  title: 'Empty',
                  message: 'Nothing here',
                ),
              ),
              const Expanded(
                child: EmptyState(icon: Icons.inbox, title: 'Bare'),
              ),
            ],
          ),
        ),
      );
      expect(find.text('TODAY'), findsOneWidget);
      expect(find.byIcon(Icons.star), findsOneWidget);
      expect(find.text('PLAIN'), findsOneWidget);
      expect(find.text('Label'), findsOneWidget);
      expect(find.text('Value'), findsOneWidget);
      expect(tester.getSize(find.byKey(const Key('r'))).width, 100);
      expect(find.text('Nothing here'), findsOneWidget);
      expect(find.text('Bare'), findsOneWidget);
    });

    testWidgets('promptText returns trimmed text, or null on cancel', (
      tester,
    ) async {
      late BuildContext ctx;
      await pumpScreen(tester, _Probe((c) => ctx = c));
      var result = promptText(
        ctx,
        title: 'Why?',
        label: 'Reason',
        hint: 'Because',
        confirm: 'Go',
      );
      await tester.pumpAndSettle();
      expect(find.text('Why?'), findsOneWidget);
      expect(find.text('Because'), findsOneWidget);
      await answerDialog(tester, '  typed  ', button: 'Go');
      expect(await result, 'typed');

      result = promptText(ctx, title: 'Again');
      await tester.pumpAndSettle();
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(await result, isNull);
    });
  });
}

Widget _wrap(FakeConvex convex, AuthService auth, Widget child) =>
    wrapProviders(convex, auth, child);
