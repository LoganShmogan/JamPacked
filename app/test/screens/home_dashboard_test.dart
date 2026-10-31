import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/screens/audits_screen.dart';
import 'package:jampacked/screens/corrective_actions_screen.dart';
import 'package:jampacked/screens/dashboard_screen.dart';
import 'package:jampacked/screens/expiring_screen.dart';
import 'package:jampacked/screens/goods_in_form_screen.dart';
import 'package:jampacked/screens/goods_in_screen.dart';
import 'package:jampacked/screens/help_screen.dart';
import 'package:jampacked/screens/home_shell.dart';
import 'package:jampacked/screens/more_screen.dart';
import 'package:jampacked/screens/production_screen.dart';
import 'package:jampacked/screens/programme_screen.dart';
import 'package:jampacked/screens/stock_screen.dart';
import 'package:jampacked/screens/suppliers_screen.dart';
import 'package:jampacked/screens/temperature_screen.dart';
import 'package:jampacked/screens/trace_screen.dart';

import '../fixtures.dart';
import '../helpers.dart';

/// Which tab of the shell's IndexedStack is showing.
int tab(WidgetTester tester) =>
    tester.widget<IndexedStack>(find.byType(IndexedStack)).index!;

void main() {
  test('the greeting follows the time of day', () {
    expect(greetingFor(0), 'Good morning');
    expect(greetingFor(11), 'Good morning');
    expect(greetingFor(12), 'Good afternoon');
    expect(greetingFor(16), 'Good afternoon');
    expect(greetingFor(17), 'Good evening');
    expect(greetingFor(23), 'Good evening');
  });

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
        ('Stock', 2),
        ('Checks', 3),
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
          matching: find.text('Checks'),
        ),
      );
      await tester.pumpAndSettle();
      expect(tab(tester), 3);
      for (final s in [GoodsInScreen, StockScreen, AuditsScreen, MoreScreen]) {
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
      expect(find.text('Kai Cafe · NP2'), findsOneWidget);
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
        'Nothing held',
        'All above par',
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
          onHold: 1,
          lowStock: 3,
          jurisdiction: 'AU',
        ),
      );
      for (final t in [
        '1 with rejections',
        '2 out of range',
        '1 high severity',
        '2 past use-by!',
        '2 audit(s) in progress',
        'Needs a decision',
        'Below par: reorder',
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
      Future<void> home() async {
        await tester.tap(
          find.descendant(
            of: find.byType(NavigationBar),
            matching: find.text('Home'),
          ),
        );
        await tester.pumpAndSettle();
      }

      await tapOn(tester, find.text('Deliveries'));
      expect(tab(tester), 1);
      for (final (label, i) in [
        ('1 audit(s) in progress', 3),
        ('Start audit', 3),
        ('On hand', 2),
        ('On hold', 2),
        ('Low stock', 2),
      ]) {
        await home();
        await tapOn(tester, find.text(label));
        expect(tab(tester), i, reason: label);
      }
      await home();
      await tapOn(
        tester,
        find
            .descendant(
              of: find.byType(Material).hitTestable(),
              matching: find.text('Stock'),
            )
            .first,
      );
      expect(tab(tester), 2);
    });

    for (final (label, screen) in [
      ('Temp checks', TemperatureScreen),
      ('Expiring soon', ExpiringScreen),
      ('Receive goods', GoodsInFormScreen),
      ('Make a batch', ProductionFormScreen),
      ('Trace / recall', TraceScreen),
      ('Suppliers', SuppliersScreen),
      ('Expiring stock', ExpiringScreen),
      ('Open actions', CorrectiveActionsScreen),
    ]) {
      testWidgets('"$label" opens $screen', (tester) async {
        await pumpDash(tester, summary());
        await tapOn(tester, find.text(label));
        expect(find.byType(screen), findsOneWidget);
      });
    }

    testWidgets('the help button opens Help & support', (tester) async {
      await pumpDash(tester, summary());
      await tapOn(tester, find.byTooltip('Help & support'));
      expect(find.byType(HelpScreen), findsOneWidget);
    });

    testWidgets('lists what is due; the Programme link opens the programme', (
      tester,
    ) async {
      await pumpDash(tester, summary());
      expect(find.text('Pest check'), findsOneWidget);
      expect(
        find.text('Check chilled food is at 5°C or lower'),
        findsNothing,
      ); // done
      await tapOn(tester, find.widgetWithText(TextButton, 'Programme'));
      expect(find.byType(ProgrammeScreen), findsOneWidget);
    });

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
