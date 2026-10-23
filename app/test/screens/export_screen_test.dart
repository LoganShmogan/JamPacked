import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/screens/export_screen.dart';
import 'package:share_plus/share_plus.dart';
import 'package:share_plus_platform_interface/share_plus_platform_interface.dart';

import '../fixtures.dart';
import '../helpers.dart';

/// Records what would have been handed to the share sheet / download.
class FakeSharePlatform extends SharePlatform {
  final shared = <ShareParams>[];
  @override
  Future<ShareResult> share(ShareParams params) async {
    shared.add(params);
    return const ShareResult('ok', ShareResultStatus.success);
  }
}

void main() {
  testWidgets('walks every table page by page and shares one JSON file', (
    tester,
  ) async {
    final platform = FakeSharePlatform();
    final convex = await pumpScreen(
      tester,
      ExportScreen(sharer: SharePlus.custom(platform)),
      convex: fakeWith({
        'exportData:manifest': (_) => {
          'business': {'_id': 'b1', 'name': 'Kai Café & Co'},
          'tables': ['deliveries', 'records'],
          'retentionYears': 7,
          'exportedAt': t0,
        },
        'exportData:page': (a) =>
            switch ((a['table'], a['paginationOpts']['cursor'])) {
              ('deliveries', null) => {
                'page': [
                  {'_id': 'd1'},
                ],
                'isDone': false,
                'continueCursor': 'c2',
              },
              ('deliveries', 'c2') => {
                'page': [
                  {'_id': 'd2'},
                ],
                'isDone': true,
                'continueCursor': 'end',
              },
              _ => {'page': [], 'isDone': true, 'continueCursor': 'end'},
            },
      }),
    );
    expect(find.textContaining('kept for 7 years'), findsOneWidget);
    await tapOn(tester, find.text('Export all records (JSON)'));

    expect(
      convex
          .callsTo('exportData:page')
          .map((c) => [c.args['table'], c.args['paginationOpts']['cursor']]),
      [
        ['deliveries', null],
        ['deliveries', 'c2'],
        ['records', null],
      ],
    );
    final params = platform.shared.single;
    expect(params.fileNameOverrides, ['Kai-Caf-Co-records-6-May-2024.json']);
    expect(params.subject, 'Kai Café & Co records');
    final file = params.files!.single;
    expect(file.mimeType, 'application/json');
    final json = jsonDecode(utf8.decode(await file.readAsBytes()));
    expect(json['retentionYears'], 7);
    expect(json['tables'], {
      'deliveries': [
        {'_id': 'd1'},
        {'_id': 'd2'},
      ],
      'records': [],
    });
    expect(
      find.text('Exported Kai-Caf-Co-records-6-May-2024.json'),
      findsOneWidget,
    );
  });

  testWidgets('shows progress and disables the button while exporting', (
    tester,
  ) async {
    final gate = Completer<void>();
    await pumpScreen(
      tester,
      ExportScreen(sharer: SharePlus.custom(FakeSharePlatform())),
      convex: fakeWith({
        'exportData:manifest': (_) => gate.future.then(
          (_) => {
            'business': {'name': 'X'},
            'tables': ['records'],
            'exportedAt': t0,
          },
        ),
        'exportData:page': (_) => {'page': [], 'isDone': true},
      }),
    );
    await tester.tap(find.text('Export all records (JSON)'));
    await tester.pump();
    expect(find.text('Starting…'), findsOneWidget);
    expect(
      tester
          .widget<FilledButton>(
            find.ancestor(
              of: find.text('Export all records (JSON)'),
              matching: find.byWidgetPredicate((w) => w is FilledButton),
            ),
          )
          .onPressed,
      isNull,
    );
    gate.complete();
    await tester.pumpAndSettle();
    expect(find.text('Exported X-records-6-May-2024.json'), findsOneWidget);
  });

  testWidgets('server errors are shown and the export can be retried', (
    tester,
  ) async {
    await pumpScreen(
      tester,
      const ExportScreen(),
      convex: fakeWith({
        'exportData:manifest': fails('This action requires one of: admin'),
      }),
    );
    await tapOn(tester, find.text('Export all records (JSON)'));
    expect(find.text('This action requires one of: admin'), findsOneWidget);
    expect(find.text('Starting…'), findsNothing);
  });

  testWidgets('leaving mid-export stops quietly', (tester) async {
    final gate = Completer<void>();
    final convex = await pumpScreen(
      tester,
      Scaffold(
        body: Builder(
          builder: (context) => TextButton(
            onPressed: () => Navigator.of(context).push(
              MaterialPageRoute(
                builder: (_) =>
                    ExportScreen(sharer: SharePlus.custom(FakeSharePlatform())),
              ),
            ),
            child: const Text('open'),
          ),
        ),
      ),
      convex: fakeWith({
        'exportData:manifest': (_) => gate.future.then(
          (_) => {
            'business': {'name': 'X'},
            'tables': ['records'],
            'exportedAt': t0,
          },
        ),
      }),
    );
    await tapOn(tester, find.text('open'));
    await tester.tap(find.text('Export all records (JSON)'));
    await tester.pump();
    await tester.pageBack();
    await tester.pumpAndSettle();
    gate.complete();
    await tester.pumpAndSettle();
    expect(convex.callsTo('exportData:page'), isEmpty);
  });
}
