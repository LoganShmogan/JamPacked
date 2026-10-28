import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/screens/audit_detail_screen.dart';
import 'package:jampacked/screens/custom_programme_editor.dart';
import 'package:jampacked/screens/programme_screen.dart';
import 'package:jampacked/screens/records_screen.dart';
import 'package:jampacked/screens/temperature_screen.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../fixtures.dart';
import '../helpers.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('ProgrammeScreen', () {
    testWidgets(
      'shows sectors, due items, records, receiving checks and checklists',
      (tester) async {
        await pumpScreen(
          tester,
          const ProgrammeScreen(),
          convex: fakeWith({
            'programmes:current': (_) => programme(
              sectorLabels: ['Bread'],
              prompts: [
                {
                  'key': 'a',
                  'text': 'Someone was there',
                  'guidance': 'Be there',
                },
                {'key': 'b', 'text': 'Put away in order'},
              ],
              records: [
                pestCheck,
                {
                  ...pestCheck,
                  'key': 'x',
                  'name': 'Training',
                  'frequency': null,
                },
              ],
            ),
          }),
          role: 'staff',
        );
        expect(find.text('National Programme 2'), findsOneWidget);
        expect(find.text('Bread'), findsOneWidget);
        expect(find.text('Change programme'), findsNothing); // staff
        expect(
          find.text('Check chilled food is at 5°C or lower'),
          findsOneWidget,
        );
        expect(find.textContaining('last 6 May 2024'), findsOneWidget);
        expect(find.textContaining('never done'), findsNWidgets(2));
        expect(find.text('Done'), findsOneWidget);
        expect(find.text('Due'), findsNWidgets(2));
        expect(find.text('Every week'), findsOneWidget);
        expect(find.text('When it happens'), findsOneWidget);
        expect(find.text('Be there'), findsOneWidget);
        expect(find.text('18 questions · Every month'), findsOneWidget);

        await tapOn(tester, find.text('Training'));
        expect(find.byType(RecordsScreen), findsOneWidget);
      },
    );

    testWidgets('due items open what they need', (tester) async {
      final convex = await pumpScreen(
        tester,
        const ProgrammeScreen(),
        convex: fakeWith({
          'audits:start': (_) => 'a1',
          'temperature:record': (_) => null,
        }),
      );
      await tapOn(tester, find.text('Pest check').first);
      expect(find.byType(RecordFormScreen), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tapOn(tester, find.text('Check chilled food is at 5°C or lower'));
      expect(find.byType(TemperatureScreen), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tapOn(tester, find.text('NP2 self-check').first);
      expect(
        convex.callsTo('audits:start').single.args['templateKey'],
        'np2_self_check',
      );
      expect(find.byType(AuditDetailScreen), findsOneWidget);
    });

    testWidgets('checklists start an audit; empty sections are hidden', (
      tester,
    ) async {
      final convex = await pumpScreen(
        tester,
        const ProgrammeScreen(),
        convex: fakeWith({
          'programmes:current': (_) => programme(records: [], schedule: []),
          'audits:start': (_) => 'a1',
        }),
      );
      expect(find.text('DUE'), findsNothing);
      expect(find.text('RECORDS'), findsNothing);
      expect(find.text('ASKED AT GOODS INWARDS'), findsNothing);
      await tapOn(tester, find.byIcon(Icons.play_arrow));
      expect(convex.callsTo('audits:start'), hasLength(1));
    });

    testWidgets('everything done shows a single all-clear', (tester) async {
      await pumpScreen(
        tester,
        const DueList(programme: {}, onlyDue: true),
        convex: fakeWith({'programmes:due': (_) => due(allDone: true)}),
      );
      expect(find.text('Everything is up to date'), findsOneWidget);
    });

    testWidgets('admins change programme and sectors', (tester) async {
      final convex = await pumpScreen(
        tester,
        const ProgrammeScreen(),
        convex: fakeWith({
          'businesses:programmes': (_) => programmes,
          'settings:update': (_) => null,
        }),
      );
      await tapOn(tester, find.text('Change programme'));
      expect(find.byType(ChangeProgrammeScreen), findsOneWidget);
      expect(find.text('Business name'), findsNothing);
      await tapOn(tester, find.text('Bread'));
      await tapOn(tester, find.text('Save'));
      expect(convex.callsTo('settings:update').single.args, {
        'programme': 'NP2',
        'sectors': ['bread'],
        'businessId': 'b1',
        'sessionToken': 'tok',
      });
      expect(convex.callsTo('businesses:mine'), hasLength(1));
      expect(find.byType(ChangeProgrammeScreen), findsNothing);
    });

    testWidgets('a failed programme change stays on the form', (tester) async {
      await pumpScreen(
        tester,
        const ChangeProgrammeScreen(programme: 'NP2', sectors: ['ece']),
        convex: fakeWith({
          'businesses:programmes': (_) => programmes,
          'settings:update': fails('Not a NP2 sector'),
        }),
      );
      await tapOn(tester, find.text('Save'));
      expect(find.text('Not a NP2 sector'), findsOneWidget);
      expect(find.byType(ChangeProgrammeScreen), findsOneWidget);
    });
  });

  group('ProgrammeScreen: custom', () {
    testWidgets('staff wait for an admin to set it up', (tester) async {
      await pumpScreen(
        tester,
        const ProgrammeScreen(),
        convex: fakeWith({
          'programmes:current': (_) =>
              programme(key: 'custom', records: [], schedule: []),
        }),
        role: 'staff',
      );
      expect(find.textContaining('has not set up'), findsOneWidget);
    });

    testWidgets('admins build one blank or from a copy', (tester) async {
      final convex = await pumpScreen(
        tester,
        const ProgrammeScreen(),
        convex: fakeWith({
          'programmes:current': (_) =>
              programme(key: 'custom', records: [], schedule: []),
          'customProgrammes:create': (_) => 'cp1',
          'customProgrammes:get': (_) => null,
        }),
      );
      expect(find.text('Build your programme'), findsOneWidget);
      expect(find.text('OR USE ONE YOU HAVE BUILT'), findsNothing);

      await tapOn(tester, find.text('Copy NP3'));
      await tapOn(tester, find.text('Cancel'));
      expect(convex.callsTo('customProgrammes:create'), isEmpty);

      await tapOn(tester, find.text('Copy NP3'));
      await answerDialog(tester, 'Our plan', button: 'Create');
      expect(convex.callsTo('customProgrammes:create').single.args, {
        'name': 'Our plan',
        'copyFrom': 'NP3',
        'businessId': 'b1',
        'sessionToken': 'tok',
      });
      expect(find.byType(CustomProgrammeEditor), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();

      await tapOn(tester, find.text('Start blank'));
      await answerDialog(tester, 'Blank', button: 'Create');
      expect(
        convex.callsTo('customProgrammes:create').last.args['copyFrom'],
        isNull,
      );
    });

    testWidgets('a failed create stays put', (tester) async {
      await pumpScreen(
        tester,
        const ProgrammeScreen(),
        convex: fakeWith({
          'programmes:current': (_) => programme(key: 'custom', records: []),
          'customProgrammes:create': fails('Give your programme a name'),
        }),
      );
      await tapOn(tester, find.text('Start blank'));
      await answerDialog(tester, '', button: 'Create');
      expect(find.text('Give your programme a name'), findsOneWidget);
      expect(find.byType(CustomProgrammeEditor), findsNothing);
    });

    testWidgets('or reuse one they have already built', (tester) async {
      final convex = await pumpScreen(
        tester,
        const ProgrammeScreen(),
        convex: fakeWith({
          'programmes:current': (_) => programme(key: 'custom', records: []),
          'customProgrammes:mine': (_) => [
            {
              '_id': 'cp9',
              'name': 'Cafe plan',
              'records': 3,
              'checklists': 1,
              'usedBy': ['Kai Cafe'],
            },
            {
              '_id': 'cp8',
              'name': 'Unused',
              'records': 0,
              'checklists': 0,
              'usedBy': [],
            },
          ],
          'customProgrammes:useForBusiness': (_) => null,
        }),
      );
      expect(
        convex.callsTo('customProgrammes:mine').single.args,
        {'sessionToken': 'tok'}, // the user's programmes, not the business's
      );
      expect(
        find.text('3 records · 1 checklists · used by Kai Cafe'),
        findsOneWidget,
      );
      expect(find.text('0 records · 0 checklists'), findsOneWidget);
      await tapOn(tester, find.text('Cafe plan'));
      expect(
        convex.callsTo('customProgrammes:useForBusiness').single.args['id'],
        'cp9',
      );
      expect(find.text('Now following Cafe plan'), findsOneWidget);
    });

    testWidgets('the owner can edit it; others cannot', (tester) async {
      await pumpScreen(
        tester,
        const ProgrammeScreen(),
        convex: fakeWith({
          'programmes:current': (_) => programme(
            key: 'custom',
            customProgrammeId: 'cp1',
            ownsProgramme: true,
          ),
          'customProgrammes:get': (_) => null,
        }),
      );
      expect(find.text('Our plan'), findsOneWidget);
      expect(find.text('Build your programme'), findsNothing);
      await tapOn(tester, find.text('Edit programme'));
      expect(find.byType(CustomProgrammeEditor), findsOneWidget);
    });

    testWidgets('someone else\'s programme cannot be edited here', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const ProgrammeScreen(),
        convex: fakeWith({
          'programmes:current': (_) =>
              programme(key: 'custom', customProgrammeId: 'cp1'),
        }),
      );
      expect(find.text('Edit programme'), findsNothing);
    });
  });

  group('RecordsScreen', () {
    final records = [
      {
        '_id': 'r1',
        'at': t0,
        'byName': 'Kim',
        'values': {'area': 'Kitchen', 'found': true, 'count': 2, 'next': t0},
        'issues': ['Pests found'],
        'voided': false,
      },
      {
        '_id': 'r2',
        'at': t0,
        'byName': 'Sam',
        'values': {'area': 'Store', 'found': false},
        'issues': [],
        'voided': true,
        'voidReason': 'Duplicate',
      },
    ];

    testWidgets('lists records with values, issues and voids', (tester) async {
      final convex = await pumpScreen(
        tester,
        RecordsScreen(type: pestCheck),
        convex: fakeWith({
          'records:list': (_) => records,
          'records:voidRecord': (_) => null,
        }),
      );
      expect(
        convex.callsTo('records:list').single.args['recordType'],
        'pest_check',
      );
      expect(find.text('Look for pests.'), findsOneWidget);
      expect(find.text('Kitchen'), findsOneWidget);
      expect(find.text('Yes'), findsOneWidget);
      expect(find.text('No'), findsOneWidget);
      expect(find.text('2 traps'), findsOneWidget);
      expect(find.text('6 May 2024'), findsOneWidget);
      expect(find.text('-'), findsNWidgets(2));
      expect(find.text('Pests found'), findsOneWidget);
      expect(find.text('VOID'), findsOneWidget);
      expect(find.text('Voided: Duplicate'), findsOneWidget);
      expect(find.text('Kept until 6 May 2031'), findsNWidgets(2));

      await tapOn(tester, find.byTooltip('Void'));
      await tapOn(tester, find.text('Cancel'));
      expect(convex.callsTo('records:voidRecord'), isEmpty);
      await tapOn(tester, find.byTooltip('Void'));
      await answerDialog(tester, 'Wrong area', button: 'Void');
      expect(
        convex.callsTo('records:voidRecord').single.args['reason'],
        'Wrong area',
      );
      expect(find.text('Record voided'), findsOneWidget);

      await tapOn(tester, find.text('Add record'));
      expect(find.byType(RecordFormScreen), findsOneWidget);
    });

    testWidgets('empty; staff cannot void', (tester) async {
      await pumpScreen(
        tester,
        RecordsScreen(type: pestCheck),
        convex: fakeWith(),
        role: 'staff',
      );
      expect(find.text('Nothing recorded yet.'), findsOneWidget);
      await pumpScreen(
        tester,
        RecordsScreen(type: pestCheck),
        convex: fakeWith({'records:list': (_) => records}),
        role: 'staff',
      );
      expect(find.byTooltip('Void'), findsNothing);
    });
  });

  group('RecordFormScreen', () {
    Future<FakeConvex> pumpForm(WidgetTester tester, {Handler? create}) =>
        pumpScreen(
          tester,
          Scaffold(
            body: Builder(
              builder: (context) => TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => RecordFormScreen(type: pestCheck),
                  ),
                ),
                child: const Text('open'),
              ),
            ),
          ),
          convex: fakeWith({'records:create': create ?? (_) => 'r1'}),
        ).then((c) async {
          await tapOn(tester, find.text('open'));
          return c;
        });

    testWidgets('requires required fields, then saves every kind of answer', (
      tester,
    ) async {
      final convex = await pumpForm(tester);
      expect(find.text('Areas checked *'), findsOneWidget);
      await tapOn(tester, find.text('Save record'));
      expect(find.text('Areas checked is required'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextField, 'Areas checked *'),
        ' Kitchen ',
      );
      await tapOn(tester, find.text('Save record'));
      expect(find.text('Signs of pests found? is required'), findsOneWidget);

      await tapOn(tester, find.text('Yes'));
      await tester.enterText(find.widgetWithText(TextField, 'Traps'), '3');
      await tapOn(tester, find.text('Next visit'));
      await tapOn(tester, find.text('Cancel'));
      expect(find.text('Next visit'), findsOneWidget);
      await tapOn(tester, find.text('Next visit'));
      await tapOn(tester, find.text('OK'));
      expect(find.textContaining('Next visit: '), findsOneWidget);
      await tapOn(tester, find.text('Save record'));
      final args = convex.callsTo('records:create').single.args;
      expect(args['recordType'], 'pest_check');
      expect(args['values'], containsPair('area', 'Kitchen'));
      expect(args['values'], containsPair('found', true));
      expect(args['values'], containsPair('count', 3.0));
      expect(args['values']['next'], isA<int>());
      expect(find.byType(RecordFormScreen), findsNothing);
      expect(find.text('Pest check saved'), findsOneWidget);
    });

    testWidgets('server errors keep the form open', (tester) async {
      await pumpForm(
        tester,
        create: fails('Your programme doesn\'t have that kind of record'),
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'Areas checked *'),
        'K',
      );
      await tapOn(tester, find.text('No'));
      await tapOn(tester, find.text('Save record'));
      expect(find.textContaining("doesn't have that kind"), findsOneWidget);
      expect(find.byType(RecordFormScreen), findsOneWidget);
    });
  });
}
