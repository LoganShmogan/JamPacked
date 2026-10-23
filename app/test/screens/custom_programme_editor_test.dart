import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/screens/custom_programme_editor.dart';

import '../helpers.dart';

Map<String, dynamic> saved() => {
  '_id': 'cp1',
  'name': 'Our plan',
  'description': 'For the cafe',
  'dailyChilledCheck': true,
  'receivingPrompts': [
    {'key': 'p1', 'text': 'Seal intact'},
  ],
  'recordTypes': [
    {
      'key': 'oil',
      'name': 'Fryer oil',
      'description': 'Check the oil',
      'frequency': 'daily',
      'fields': [
        {
          'key': 'temp',
          'label': 'Temperature',
          'type': 'number',
          'unit': '°C',
          'failIf': {'above': 180, 'message': 'Too hot'},
        },
        {
          'key': 'changed',
          'label': 'Oil changed',
          'type': 'yesno',
          'failIf': {'equals': false, 'message': 'Oil changed: No'},
        },
      ],
    },
  ],
  'templates': [
    {
      'key': 'walk',
      'name': 'Weekly walk',
      'description': 'Walk round',
      'defaultPeriodDays': 7,
      'questions': [
        {'id': 'q1', 'section': 'Kitchen', 'text': 'Clean?', 'type': 'yesno'},
      ],
    },
  ],
};

/// Opens the editor from a page so it can pop; returns the fake client.
Future<FakeConvex> openEditor(
  WidgetTester tester, {
  Map<String, Handler> handlers = const {},
}) async {
  final convex = await pumpScreen(
    tester,
    Scaffold(
      body: Builder(
        builder: (context) => TextButton(
          onPressed: () => Navigator.of(context).push(
            MaterialPageRoute(
              builder: (_) => const CustomProgrammeEditor(id: 'cp1'),
            ),
          ),
          child: const Text('open'),
        ),
      ),
    ),
    convex: FakeConvex({
      'customProgrammes:get': (_) => saved(),
      'customProgrammes:update': (_) => null,
      ...handlers,
    }),
    size: const Size(800, 2400),
  );
  await tapOn(tester, find.text('open'));
  return convex;
}

Map<String, dynamic> lastSave(FakeConvex c) =>
    c.callsTo('customProgrammes:update').last.args;

void main() {
  testWidgets('loads as the user (no business) and saves unchanged', (
    tester,
  ) async {
    final convex = await openEditor(tester);
    expect(convex.callsTo('customProgrammes:get').single.args, {
      'id': 'cp1',
      'sessionToken': 'tok',
    });
    expect(find.text('Seal intact'), findsOneWidget);
    expect(find.text('2 fields · Every day'), findsOneWidget);
    expect(find.text('1 questions · When needed'), findsOneWidget);
    await tapOn(tester, find.text('Save'));
    final args = lastSave(convex);
    expect(args.containsKey('businessId'), isFalse);
    expect(args['name'], 'Our plan');
    expect(args['description'], 'For the cafe');
    expect(args['dailyChilledCheck'], isTrue);
    expect(args['recordTypes'], saved()['recordTypes']);
    expect(find.byType(CustomProgrammeEditor), findsNothing);
    expect(find.text('Programme saved'), findsOneWidget);
  });

  testWidgets('not found, and load errors', (tester) async {
    await openEditor(tester, handlers: {'customProgrammes:get': (_) => null});
    expect(find.text('Programme not found'), findsOneWidget);
  });

  testWidgets('load errors show', (tester) async {
    await openEditor(
      tester,
      handlers: {'customProgrammes:get': fails('offline')},
    );
    expect(find.text('offline'), findsOneWidget);
  });

  testWidgets('a failed save stays open', (tester) async {
    await openEditor(
      tester,
      handlers: {'customProgrammes:update': fails('Records need a name')},
    );
    await tapOn(tester, find.text('Save'));
    expect(find.text('Records need a name'), findsOneWidget);
    expect(find.byType(CustomProgrammeEditor), findsOneWidget);
  });

  testWidgets(
    'edit name, toggle the daily check, add and remove receiving checks',
    (tester) async {
      final convex = await openEditor(tester);
      await tester.enterText(
        find.widgetWithText(TextField, 'Programme name'),
        ' New name ',
      );
      await tapOn(tester, find.text('Daily chilled temperature check'));
      final addButtons = find.widgetWithText(TextButton, 'Add');
      await tapOn(tester, addButtons.at(0));
      await answerDialog(tester, '', button: 'Add'); // empty: nothing added
      await tapOn(tester, addButtons.at(0));
      await tapOn(tester, find.text('Cancel'));
      await tapOn(tester, addButtons.at(0));
      await answerDialog(tester, 'Invoice matches', button: 'Add');
      await tapOn(tester, find.byTooltip('Remove').first);
      await tapOn(tester, find.text('Save'));
      final args = lastSave(convex);
      expect(args['name'], 'New name');
      expect(args['dailyChilledCheck'], isFalse);
      expect((args['receivingPrompts'] as List).map((p) => p['text']), [
        'Invoice matches',
      ]);
    },
  );

  testWidgets('remove a record type and a checklist', (tester) async {
    final convex = await openEditor(tester);
    await tapOn(tester, find.byTooltip('Remove').at(1));
    await tapOn(tester, find.byTooltip('Remove').at(1));
    await tapOn(tester, find.text('Save'));
    expect(lastSave(convex)['recordTypes'], isEmpty);
    expect(lastSave(convex)['templates'], isEmpty);
  });

  group('RecordTypeEditor', () {
    testWidgets('edit an existing record: rules are kept and rebuilt', (
      tester,
    ) async {
      final convex = await openEditor(tester);
      await tapOn(tester, find.text('Fryer oil'));
      expect(find.text('Edit record'), findsOneWidget);
      expect(find.text('180'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Problem below'),
        '150',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Problem above'),
        '',
      );
      await tester.enterText(find.widgetWithText(TextFormField, 'Unit'), ' ');
      await tapOn(tester, find.text('Done'));
      await tapOn(tester, find.text('Save'));
      final fields = lastSave(convex)['recordTypes'][0]['fields'] as List;
      expect(fields[0]['failIf'], {
        'below': 150.0,
        'message': 'Temperature out of limits',
      });
      expect(fields[0]['unit'], isNull);
      expect(fields[1]['failIf'], {
        'equals': false,
        'message': 'Oil changed: No',
      });
    });

    testWidgets('new record: validation, every field type and rule', (
      tester,
    ) async {
      final convex = await openEditor(tester);
      await tapOn(tester, find.widgetWithText(TextButton, 'Add').at(1));
      expect(find.text('New record'), findsOneWidget);
      await tapOn(tester, find.text('Done'));
      expect(find.text('Give the record a name'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextField, 'Name'),
        ' Hand wash ',
      );
      await tester.enterText(
        find.widgetWithText(TextField, 'What to do (shown on the form)'),
        'Check soap',
      );
      await tapOn(tester, find.text('When needed'));
      await tapOn(tester, find.text('Every week').last);
      await tapOn(tester, find.text('Done'));
      expect(find.text('Add at least one field'), findsOneWidget);

      await tapOn(tester, find.text('Add field'));
      await tapOn(tester, find.text('Done'));
      expect(find.text('Every field needs a label'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Field label'),
        'Soap stocked',
      );
      await tapOn(tester, find.text('Required'));
      await tapOn(tester, find.text('Never'));
      await tapOn(tester, find.text('The answer is No').last);

      await tapOn(tester, find.text('Add field'));
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Field label').last,
        'Water temp',
      );
      await tapOn(tester, find.text('Yes / No').last);
      await tapOn(tester, find.text('Number').last);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Problem above'),
        '45',
      );

      await tapOn(tester, find.text('Add field'));
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Field label').last,
        'Notes',
      );
      await tapOn(tester, find.text('Yes / No').last);
      await tapOn(tester, find.text('Text').last);

      await tapOn(tester, find.text('Add field'));
      await tapOn(tester, find.byTooltip('Remove field').last);

      await tapOn(tester, find.text('Done'));
      expect(find.text('3 fields · Every week'), findsOneWidget);
      await tapOn(tester, find.text('Save'));
      final added = (lastSave(convex)['recordTypes'] as List).last;
      expect(added['name'], 'Hand wash');
      expect(added['description'], 'Check soap');
      expect(added['frequency'], 'weekly');
      expect(added['key'], startsWith('r'));
      final fields = added['fields'] as List;
      expect(fields[0], containsPair('required', true));
      expect(fields[0]['failIf'], {
        'equals': false,
        'message': 'Soap stocked: No',
      });
      expect(fields[1]['type'], 'number');
      expect(fields[1]['failIf'], {
        'above': 45.0,
        'message': 'Water temp out of limits',
      });
      expect(fields[2]['type'], 'text');
      expect(fields[2]['failIf'], isNull);
    });

    testWidgets('a yes/no rule can be set back to never', (tester) async {
      final convex = await openEditor(tester);
      await tapOn(tester, find.text('Fryer oil'));
      await tapOn(tester, find.text('The answer is No'));
      await tapOn(tester, find.text('Never').last);
      await tapOn(tester, find.text('Done'));
      await tapOn(tester, find.text('Save'));
      expect(lastSave(convex)['recordTypes'][0]['fields'][1]['failIf'], isNull);
    });

    testWidgets('leaving without Done changes nothing', (tester) async {
      final convex = await openEditor(tester);
      await tapOn(tester, find.text('Fryer oil'));
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tapOn(tester, find.text('Save'));
      expect(lastSave(convex)['recordTypes'], saved()['recordTypes']);
    });
  });

  group('ChecklistEditor', () {
    testWidgets('new checklist: validation, questions, period and sections', (
      tester,
    ) async {
      final convex = await openEditor(tester);
      await tapOn(tester, find.widgetWithText(TextButton, 'Add').at(2));
      expect(find.text('New checklist'), findsOneWidget);
      await tapOn(tester, find.text('Done'));
      expect(find.text('Give the checklist a name'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextField, 'Name'),
        'Close down',
      );
      await tapOn(tester, find.text('Done'));
      expect(find.text('Add at least one question'), findsOneWidget);
      await tapOn(tester, find.text('Add question'));
      await tapOn(tester, find.text('Done'));
      expect(find.text('Every question needs text'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Question'),
        ' Bins out? ',
      );
      await tapOn(tester, find.text('Add question'));
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Question').last,
        'Fridge temp',
      );
      await tester.enterText(
        find.widgetWithText(TextFormField, 'Section').last,
        'Fridges',
      );
      await tapOn(tester, find.text('Yes / No').last);
      await tapOn(tester, find.text('Number').last);
      await tapOn(tester, find.text('Add question'));
      await tapOn(tester, find.byTooltip('Remove question').last);
      await tester.enterText(
        find.widgetWithText(TextField, 'Covers the last ... days'),
        '1',
      );
      await tapOn(tester, find.text('When needed'));
      await tapOn(tester, find.text('Every day').last);
      await tapOn(tester, find.text('Done'));
      await tapOn(tester, find.text('Save'));
      final added = (lastSave(convex)['templates'] as List).last;
      expect(added['name'], 'Close down');
      expect(added['defaultPeriodDays'], 1);
      expect(added['frequency'], 'daily');
      expect(added['questions'], [
        {
          'id': startsWith('q'),
          'section': 'General',
          'text': 'Bins out?',
          'type': 'yesno',
        },
        {
          'id': startsWith('q'),
          'section': 'Fridges',
          'text': 'Fridge temp',
          'type': 'number',
        },
      ]);
    });

    testWidgets('edit an existing checklist; a bad period falls back to 7', (
      tester,
    ) async {
      final convex = await openEditor(tester);
      await tapOn(tester, find.text('Weekly walk'));
      expect(find.text('Edit checklist'), findsOneWidget);
      expect(find.text('Clean?'), findsOneWidget);
      await tester.enterText(
        find.widgetWithText(TextField, 'Covers the last ... days'),
        'x',
      );
      await tapOn(tester, find.text('Done'));
      await tapOn(tester, find.text('Save'));
      final t = (lastSave(convex)['templates'] as List).single;
      expect(t['key'], 'walk');
      expect(t['defaultPeriodDays'], 7);
    });
  });

  test('newKey makes distinct keys with a prefix', () {
    final a = newKey('r');
    expect(a, startsWith('r'));
    expect(newKey('r'), isNot(a));
  });
}
