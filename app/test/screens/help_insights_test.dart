// Help & support (guides from assets/help/guides.json, search, contact) and Insights (business numbers,
// task times, period picker, formatting).
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/screens/help_screen.dart';
import 'package:jampacked/screens/insights_screen.dart';

import '../fixtures.dart';
import '../helpers.dart';

/// Reads assets straight from disk, so each test loads the real guides file (rootBundle caches its
/// first load across tests, and a later test would wait on it forever).
class _FileBundle extends CachingAssetBundle {
  @override
  Future<ByteData> load(String key) async =>
      ByteData.sublistView(File(key).readAsBytesSync());
}

Widget help() =>
    DefaultAssetBundle(bundle: _FileBundle(), child: const HelpScreen());

void main() {
  group('guides.json', () {
    final file = jsonDecode(File(guidesAsset).readAsStringSync());

    test(
      'every guide is complete, with a unique id and a known icon or none',
      () {
        final guides = (file['guides'] as List).cast<Map>();
        expect(guides.length, greaterThanOrEqualTo(10));
        expect(guides.map((g) => g['id']).toSet(), hasLength(guides.length));
        for (final g in guides) {
          for (final k in ['id', 'title', 'icon', 'summary', 'where']) {
            expect(g[k], isA<String>(), reason: '${g['id']}: $k');
          }
          expect(g['steps'], isNotEmpty, reason: g['id']);
        }
        expect(file['supportEmail'], contains('@'));
      },
    );
  });

  group('HelpScreen', () {
    testWidgets('lists the guides; one opens to show where, steps and a tip', (
      tester,
    ) async {
      await pumpScreen(tester, help(), convex: fakeWith());
      expect(find.text('Help & support'), findsOneWidget);
      expect(find.text('Receive a delivery'), findsOneWidget);
      expect(find.text('Make a batch'), findsOneWidget);
      await tapOn(tester, find.text('Receive a delivery'));
      expect(
        find.text('Where: Goods In tab, or Home › Receive goods'),
        findsOneWidget,
      );
      expect(find.text('1'), findsOneWidget);
      expect(find.textContaining('Tip: JamPacked warns you'), findsOneWidget);
      // A guide with no tip shows none.
      await tapOn(tester, find.text('Add a recipe'));
      expect(find.textContaining('Tip:'), findsOneWidget);
    });

    testWidgets('search narrows the guides by every word typed', (
      tester,
    ) async {
      await pumpScreen(tester, help(), convex: fakeWith());
      await tester.enterText(find.byType(TextField), 'Recall HOLD');
      await tester.pumpAndSettle();
      expect(find.text('Trace and recall'), findsOneWidget);
      expect(find.text('Receive a delivery'), findsNothing);
      await tester.enterText(find.byType(TextField), 'zebra');
      await tester.pumpAndSettle();
      expect(find.textContaining('No guide matches that'), findsOneWidget);
      expect(find.text('STILL STUCK?'), findsOneWidget);
    });

    testWidgets('the support email can be copied', (tester) async {
      String? copied;
      tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
        SystemChannels.platform,
        (call) async {
          if (call.method == 'Clipboard.setData') {
            copied = (call.arguments as Map)['text'];
          }
          return null;
        },
      );
      addTearDown(
        () => tester.binding.defaultBinaryMessenger.setMockMethodCallHandler(
          SystemChannels.platform,
          null,
        ),
      );
      await pumpScreen(tester, help(), convex: fakeWith());
      expect(find.text('contact@savepoint.co.nz'), findsOneWidget);
      await tapOn(tester, find.byTooltip('Copy email address'));
      expect(copied, 'contact@savepoint.co.nz');
      expect(find.text('Email address copied'), findsOneWidget);
    });

    testWidgets('shows a spinner until the guides load', (tester) async {
      final convex = fakeWith();
      await tester.pumpWidget(
        wrapProviders(convex, signedIn(convex), help()),
      );
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.pumpAndSettle();
      expect(find.byType(CircularProgressIndicator), findsNothing);
    });
  });

  group('InsightsScreen', () {
    testWidgets('business numbers, task times and a period picker', (
      tester,
    ) async {
      final convex = await pumpScreen(
        tester,
        const InsightsScreen(),
        convex: fakeWith({
          'analytics:insights': (a) =>
              insights(days: a['days'], empty: a['days'] == 7),
        }),
      );
      expect(convex.callsTo('analytics:insights').last.args['days'], 30);
      expect(find.text('LAST 30 DAYS'), findsOneWidget);
      expect(find.text('40 items'), findsOneWidget);
      expect(find.text('5% of items'), findsOneWidget);
      expect(find.text('95% in range'), findsOneWidget);
      expect(find.text('4 closed, typically in 30 h'), findsOneWidget);
      expect(find.text('Receiving goods'), findsOneWidget);
      expect(find.text('4 min 32 s'), findsOneWidget); // business
      expect(find.text('4 min 1 s'), findsOneWidget); // you
      expect(find.text('12 timed, 5 by you'), findsOneWidget);
      expect(find.text('Not timed yet'), findsOneWidget);
      expect(find.textContaining('nobody is compared'), findsOneWidget);

      await tapOn(tester, find.text('7 days'));
      expect(convex.callsTo('analytics:insights').last.args['days'], 7);
      expect(find.text('LAST 7 DAYS'), findsOneWidget);
      expect(find.text('items'), findsNothing);
      expect(find.text('0 closed'), findsOneWidget);
      expect(find.text('Not timed yet'), findsNWidgets(4));
    });
  });

  test('fmtDuration', () {
    expect(fmtDuration(null), '-');
    expect(fmtDuration(45_400), '45 s');
    expect(fmtDuration(180_000), '3 min');
    expect(fmtDuration(200_000), '3 min 20 s');
    expect(fmtDuration(12 * 60_000 + 30_000), '12 min');
    expect(fmtDuration(2 * 3_600_000), '2 h');
    expect(fmtDuration(3_900_000), '1 h 5 min');
  });

  test('fmtHours', () {
    expect(fmtHours(0.5), 'under an hour');
    expect(fmtHours(30.4), '30 h');
    expect(fmtHours(72), '3 days');
  });
}
