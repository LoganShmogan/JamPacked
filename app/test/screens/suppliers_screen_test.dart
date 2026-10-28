import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/screens/suppliers_screen.dart';

import '../fixtures.dart';
import '../helpers.dart';

/// Pushes [form] from a launcher page and records what it pops with.
class _Launcher extends StatelessWidget {
  const _Launcher(this.form, this.result);
  final Widget form;
  final List<Object?> result;
  @override
  Widget build(BuildContext context) => Scaffold(
    body: TextButton(
      onPressed: () async => result.add(
        await Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => form)),
      ),
      child: const Text('open'),
    ),
  );
}

Finder field(String label) => find.widgetWithText(TextFormField, label);

void main() {
  group('SuppliersScreen', () {
    test('passes its key through', () {
      final key = UniqueKey();
      expect(SuppliersScreen(key: key).key, key);
    });

    testWidgets('empty state', (tester) async {
      await pumpScreen(
        tester,
        const SuppliersScreen(),
        convex: fakeWith({'suppliers:list': (_) => []}),
      );
      expect(find.text('No suppliers yet'), findsOneWidget);
    });

    testWidgets('lists suppliers (including inactive) with status pills', (
      tester,
    ) async {
      final convex = await pumpScreen(
        tester,
        const SuppliersScreen(),
        convex: fakeWith(),
      );
      expect(
        convex.callsTo('suppliers:list').single.args['includeInactive'],
        isTrue,
      );
      expect(find.text('Jo · 021 555'), findsOneWidget);
      expect(find.text('Approved'), findsOneWidget);
      expect(find.text('Not approved'), findsOneWidget);
      expect(find.text('Inactive'), findsOneWidget);
    });

    testWidgets('staff can view but not add or edit', (tester) async {
      await pumpScreen(
        tester,
        const SuppliersScreen(),
        convex: fakeWith(),
        role: 'staff',
      );
      expect(find.byType(FloatingActionButton), findsNothing);
      await tester.tap(find.text('Fresh Foods'));
      await tester.pumpAndSettle();
      expect(find.byType(SupplierFormScreen), findsNothing);
    });

    testWidgets('managers can add and edit', (tester) async {
      await pumpScreen(
        tester,
        const SuppliersScreen(),
        convex: fakeWith(),
        role: 'manager',
      );
      await tester.tap(find.byType(FloatingActionButton));
      await tester.pumpAndSettle();
      expect(find.text('New supplier'), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Fresh Foods'));
      await tester.pumpAndSettle();
      expect(find.text('Edit supplier'), findsOneWidget);
    });
  });

  group('SupplierFormScreen', () {
    testWidgets(
      'new supplier: requires a name, sends trimmed fields and pops with the id',
      (tester) async {
        final popped = <Object?>[];
        final convex = await pumpScreen(
          tester,
          _Launcher(const SupplierFormScreen(), popped),
          convex: fakeWith({'suppliers:create': (_) => 'new-id'}),
        );
        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();
        expect(find.text('Active'), findsNothing); // only when editing

        await tester.tap(find.text('Save'));
        await tester.pumpAndSettle();
        expect(find.text('Required'), findsOneWidget);
        expect(convex.callsTo('suppliers:create'), isEmpty);

        await tester.enterText(field('Business name'), ' Acme ');
        await tester.enterText(field('Phone'), '09 123');
        await tester.tap(find.text('Approved supplier'));
        await tester.tap(find.text('Save'));
        await tester.pumpAndSettle();
        expect(convex.callsTo('suppliers:create').single.args, {
          'name': 'Acme',
          'contactName': null,
          'phone': '09 123',
          'email': null,
          'address': null,
          'registrationNumber': null,
          'approvalNotes': null,
          'approved': false,
          'businessId': 'b1',
          'sessionToken': 'tok',
        });
        expect(popped, ['new-id']);
        expect(find.text('Supplier saved'), findsOneWidget);
      },
    );

    testWidgets('new supplier: a server error keeps the form open', (
      tester,
    ) async {
      final popped = <Object?>[];
      await pumpScreen(
        tester,
        _Launcher(const SupplierFormScreen(), popped),
        convex: fakeWith({
          'suppliers:create': fails('Supplier name is required'),
        }),
      );
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      await tester.enterText(field('Business name'), 'Acme');
      await tester.tap(find.text('Save'));
      await tester.pumpAndSettle();
      expect(popped, isEmpty);
      expect(find.text('Supplier name is required'), findsOneWidget);
    });

    testWidgets(
      'edit supplier: prefilled, shows history, saves id and active flag',
      (tester) async {
        final popped = <Object?>[];
        final convex = await pumpScreen(
          tester,
          _Launcher(SupplierFormScreen(supplier: suppliers[0]), popped),
          convex: fakeWith({
            'suppliers:update': (_) => null,
            'auditLog:list': (_) => [
              {
                'action': 'create',
                'summary': 'Added supplier Fresh Foods',
                'userName': 'Sam',
                'at': t0,
              },
            ],
          }),
        );
        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();
        expect(find.text('Edit supplier'), findsOneWidget);
        expect(find.text('Added supplier Fresh Foods'), findsOneWidget);
        expect(convex.callsTo('auditLog:list').single.args, {
          'entityType': 'supplier',
          'entityId': 's1',
          'businessId': 'b1',
          'sessionToken': 'tok',
        });
        await tester.tap(find.text('Active'));
        await tester.pump();
        await tester.tap(find.text('Save'));
        await tester.pumpAndSettle();
        final args = convex.callsTo('suppliers:update').single.args;
        expect(args['id'], 's1');
        expect(args['name'], 'Fresh Foods');
        expect(args['contactName'], 'Jo');
        expect(args['active'], isFalse);
        expect(args['approved'], isTrue);
        expect(popped, [null]);
      },
    );
  });
}
