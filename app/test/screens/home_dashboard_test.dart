import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/screens/audits_screen.dart';
import 'package:foodsafe/screens/corrective_actions_screen.dart';
import 'package:foodsafe/screens/expiring_screen.dart';
import 'package:foodsafe/screens/goods_in_form_screen.dart';
import 'package:foodsafe/screens/goods_in_screen.dart';
import 'package:foodsafe/screens/home_shell.dart';
import 'package:foodsafe/screens/more_screen.dart';
import 'package:foodsafe/screens/suppliers_screen.dart';
import 'package:foodsafe/screens/temperature_screen.dart';
import 'package:foodsafe/screens/trace_screen.dart';

import '../fixtures.dart';
import '../helpers.dart';

/// Which tab of the shell's IndexedStack is showing.
int tab(WidgetTester tester) =>
    tester.widget<IndexedStack>(find.byType(IndexedStack)).index!;

void main() {
  group('HomeShell', () {
    testWidgets('phone layout: bottom navigation switches tabs', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const HomeShell(),
        convex: fakeWith(),
        size: const Size(400, 900),
      );
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(find.byType(NavigationRail), findsNothing);
      for (final (label, i) in [
        ('Goods In', 1),
        ('Audits', 2),
        ('Actions', 3),
        ('More', 4),
        ('Home', 0),
      ]) {
        await tester.tap(
          find.descendant(
            of: find.byType(NavigationBar),
            matching: find.text(label),
          ),
        );
        await tester.pumpAndSettle();
        expect(tab(tester), i);
      }
    });

    testWidgets('wide layout: navigation rail', (tester) async {
      await pumpScreen(
        tester,
        const HomeShell(),
        convex: fakeWith(),
        size: const Size(1200, 900),
      );
      expect(find.byType(NavigationRail), findsOneWidget);
      await tester.tap(
        find.descendant(
          of: find.byType(NavigationRail),
          matching: find.text('Audits'),
        ),
      );
      await tester.pumpAndSettle();
      expect(tab(tester), 2);
      for (final s in [
        GoodsInScreen,
        AuditsScreen,
        CorrectiveActionsScreen,
        MoreScreen,
      ]) {
        expect(find.byType(s, skipOffstage: false), findsOneWidget);
      }
    });
  });

  group('Dashboard', () {
    Future<FakeConvex> pumpDash(
      WidgetTester tester,
      Map<String, dynamic> s, {
      Size size = const Size(400, 1400),
    }) => pumpScreen(
      tester,
      const HomeShell(),
      convex: fakeWith({'dashboard:summary': (_) => s}),
      size: size,
    );

    testWidgets('greets the user by first name with business and NZ badge', (
      tester,
    ) async {
      final convex = await pumpDash(tester, summary());
      expect(
        find.textContaining(RegExp(r'^Good (morning|afternoon|evening), Sam$')),
        findsOneWidget,
      );
      expect(find.text('Kai Cafe'), findsOneWidget);
      expect(find.text('🇳🇿 MPI'), findsOneWidget);
      expect(
        convex.callsTo('dashboard:summary').first.args['dayStart'],
        isA<int>(),
      );
    });

    testWidgets('all-good day', (tester) async {
      await pumpDash(tester, summary());
      for (final t in [
        'All accepted',
        'All within limits',
        'No high severity',
        'Nothing expired',
      ]) {
        expect(find.text(t), findsOneWidget);
      }
      expect(find.text('IN PROGRESS'), findsNothing);
    });

    testWidgets('problem day shows warnings, AU badge and in-progress audits', (
      tester,
    ) async {
      await pumpDash(
        tester,
        summary(
          rejections: 1,
          tempIssues: 2,
          openCAs: 3,
          highOpen: 1,
          expiring: 4,
          expired: 2,
          inProgress: 2,
          jurisdiction: 'AU',
        ),
      );
      for (final t in [
        '1 with rejections',
        '2 out of range',
        '1 high severity',
        '2 past use-by!',
        '2 audit(s) in progress',
      ]) {
        expect(find.text(t), findsOneWidget);
      }
      expect(find.text('🇦🇺 FSANZ'), findsOneWidget);
    });

    testWidgets(
      'no temperature checks yet; open CAs without high severity; expiring but none expired',
      (tester) async {
        await pumpDash(tester, summary(temps: 0, openCAs: 2, expiring: 1));
        expect(find.text('None recorded yet'), findsOneWidget);
        expect(find.text('No high severity'), findsOneWidget);
        expect(find.text('Nothing expired'), findsOneWidget);
      },
    );

    testWidgets('KPI cards and in-progress card switch tabs', (tester) async {
      await pumpDash(tester, summary(inProgress: 1));
      await tapOn(tester, find.text('Deliveries'));
      expect(tab(tester), 1);
      await tester.tap(find.text('Home'));
      await tester.pumpAndSettle();
      await tapOn(tester, find.text('Open actions'));
      expect(tab(tester), 3);
      await tester.tap(find.text('Home'));
      await tester.pumpAndSettle();
      await tapOn(tester, find.text('1 audit(s) in progress'));
      expect(tab(tester), 2);
      await tester.tap(find.text('Home'));
      await tester.pumpAndSettle();
      await tapOn(tester, find.text('Start audit'));
      expect(tab(tester), 2);
    });

    for (final (label, screen) in [
      ('Temp checks', TemperatureScreen),
      ('Expiring soon', ExpiringScreen),
      ('Receive goods', GoodsInFormScreen),
      ('Trace / recall', TraceScreen),
      ('Suppliers', SuppliersScreen),
      ('Expiring stock', ExpiringScreen),
    ]) {
      testWidgets('"$label" opens $screen', (tester) async {
        await pumpDash(tester, summary());
        await tapOn(tester, find.text(label));
        expect(find.byType(screen), findsOneWidget);
      });
    }

    testWidgets('"Temperature check" opens the recorder straight away', (
      tester,
    ) async {
      await pumpDash(tester, summary());
      await tapOn(tester, find.text('Temperature check'));
      expect(find.byType(TemperatureScreen), findsOneWidget);
      expect(find.text('Record temperature'), findsOneWidget);
    });

    testWidgets('wide layout uses 4 KPI columns', (tester) async {
      await pumpDash(tester, summary(), size: const Size(1400, 1200));
      final a = tester.getTopLeft(find.text('Deliveries'));
      final b = tester.getTopLeft(find.text('Expiring soon'));
      expect(a.dy, b.dy); // all four KPIs on one row
    });
  });
}
