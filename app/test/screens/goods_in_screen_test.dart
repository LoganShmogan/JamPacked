import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/screens/delivery_detail_screen.dart';
import 'package:foodsafe/screens/goods_in_form_screen.dart';
import 'package:foodsafe/screens/goods_in_screen.dart';
import 'package:foodsafe/widgets/common.dart';

import '../fixtures.dart';
import '../helpers.dart';

Map<String, dynamic> detail({
  bool voided = false,
  Map<String, dynamic> extra = const {},
}) => {
  'delivery': {
    ...delivery(status: 'partial', voided: voided),
    'voidReason': voided ? 'Entered twice' : null,
    'supplierApproved': false,
    'invoiceNumber': 'INV-9',
    'vehicleClean': false,
    'vehicleTempC': 4.5,
    'notes': null,
    ...extra,
  },
  'items': [
    {
      'productName': 'Milk',
      'storageType': 'chilled',
      'accepted': true,
      'quantity': 6,
      'unit': 'ea',
      'temperatureC': 3,
      'temperatureCompliant': true,
      'batchCode': 'B7',
      'useBy': t0,
      'bestBefore': t0,
      'packagingOk': true,
      'labelOk': true,
      'allergens': ['milk'],
    },
    {
      'productName': 'Fish',
      'storageType': 'chilled',
      'accepted': false,
      'quantity': 1,
      'unit': 'kg',
      'temperatureCompliant': false,
      'packagingOk': false,
      'labelOk': false,
      'allergens': [],
      'rejectionReason': 'Warm',
    },
    {
      'productName': 'Pie',
      'storageType': 'hot',
      'accepted': true,
      'quantity': 2,
      'unit': 'ea',
      'temperatureC': 50,
      'temperatureCompliant': false,
      'packagingOk': true,
      'labelOk': true,
      'allergens': [],
    },
  ],
  'history': [
    {
      'action': 'create',
      'summary': 'Goods received',
      'userName': 'Sam',
      'at': t0,
    },
  ],
};

void main() {
  test('toneFor maps delivery status to a pill tone', () {
    expect(GoodsInScreen.toneFor('accepted'), Tone.ok);
    expect(GoodsInScreen.toneFor('partial'), Tone.warn);
    expect(GoodsInScreen.toneFor('rejected'), Tone.bad);
  });

  group('GoodsInScreen', () {
    testWidgets('empty state', (tester) async {
      await pumpScreen(
        tester,
        const GoodsInScreen(),
        convex: fakeWith({'deliveries:list': (_) => []}),
      );
      expect(find.text('No deliveries yet'), findsOneWidget);
    });

    testWidgets('lists deliveries with status, void and temperature flags', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const GoodsInScreen(),
        convex: fakeWith({
          'deliveries:list': (_) => [
            delivery(id: 'a', status: 'accepted'),
            delivery(id: 'b', status: 'partial', tempIssues: 1),
            delivery(id: 'c', status: 'rejected', voided: true),
          ],
        }),
      );
      expect(find.text('ACCEPTED'), findsOneWidget);
      expect(find.text('PARTIAL'), findsOneWidget);
      expect(find.text('VOID'), findsOneWidget);
      expect(find.text('TEMP'), findsOneWidget);
      expect(
        find.text('6 May 2024, 9:15 AM · 2 items · Sam'),
        findsNWidgets(3),
      );
    });

    testWidgets('FAB opens the receive form; tapping a delivery opens it', (
      tester,
    ) async {
      await pumpScreen(tester, const GoodsInScreen(), convex: fakeWith());
      await tester.tap(find.text('Receive goods'));
      await tester.pumpAndSettle();
      expect(find.byType(GoodsInFormScreen), findsOneWidget);
      await tester.pageBack();
      await tester.pumpAndSettle();
      await tester.tap(find.text('Fresh Foods'));
      await tester.pumpAndSettle();
      expect(find.byType(DeliveryDetailScreen), findsOneWidget);
    });
  });

  group('DeliveryDetailScreen', () {
    testWidgets('record not found', (tester) async {
      await pumpScreen(
        tester,
        const DeliveryDetailScreen(id: 'x'),
        convex: fakeWith(),
      );
      expect(find.text('Record not found'), findsOneWidget);
    });

    testWidgets('shows the header, every item check and the history', (
      tester,
    ) async {
      final convex = await pumpScreen(
        tester,
        const DeliveryDetailScreen(id: 'd1'),
        convex: fakeWith({'deliveries:get': (_) => detail()}),
      );
      expect(convex.callsTo('deliveries:get').single.args['id'], 'd1');
      expect(find.text('PARTIAL'), findsOneWidget);
      for (final t in [
        'No (not on approved list)',
        'INV-9',
        '4.5°C',
        'ITEMS (3)',
        '3°C',
        'Batch B7',
        'Use by 6 May 2024',
        'BB 6 May 2024',
        'milk',
        'No temp',
        'Packaging damaged',
        'Label issue',
        'Reason: Warm',
        '50°C',
        'Goods received',
      ]) {
        expect(find.text(t), findsOneWidget, reason: t);
      }
      expect(find.text('Accepted'), findsNWidgets(2));
      expect(find.text('Rejected'), findsOneWidget);
      expect(find.text('No'), findsOneWidget); // vehicle clean
      expect(find.text('-'), findsOneWidget); // notes
      expect(find.text('Void record'), findsOneWidget);
    });

    testWidgets('approved supplier, no invoice or vehicle temp, with notes', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const DeliveryDetailScreen(id: 'd1'),
        convex: fakeWith({
          'deliveries:get': (_) => detail(
            extra: {
              'supplierApproved': true,
              'invoiceNumber': null,
              'vehicleClean': true,
              'vehicleTempC': null,
              'notes': 'Late',
            },
          ),
        }),
      );
      expect(find.text('Yes'), findsNWidgets(2));
      expect(find.text('Late'), findsOneWidget);
      expect(find.text('Vehicle temp'), findsNothing);
    });

    testWidgets('voided records show the reason and cannot be edited', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const DeliveryDetailScreen(id: 'd1'),
        convex: fakeWith({'deliveries:get': (_) => detail(voided: true)}),
      );
      expect(find.text('VOIDED: Entered twice'), findsOneWidget);
      expect(find.text('Edit notes'), findsNothing);
      expect(find.text('Void record'), findsNothing);
    });

    testWidgets('staff can edit notes but not void', (tester) async {
      final convex = await pumpScreen(
        tester,
        const DeliveryDetailScreen(id: 'd1'),
        convex: fakeWith({
          'deliveries:get': (_) => detail(),
          'deliveries:updateNotes': (_) => null,
        }),
        role: 'staff',
      );
      expect(find.text('Void record'), findsNothing);
      await tapOn(tester, find.text('Edit notes'));
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(convex.callsTo('deliveries:updateNotes'), isEmpty);

      await tapOn(tester, find.text('Edit notes'));
      await answerDialog(tester, 'Driver late');
      expect(convex.callsTo('deliveries:updateNotes').single.args, {
        'id': 'd1',
        'notes': 'Driver late',
        'businessId': 'b1',
        'sessionToken': 'tok',
      });
      expect(find.text('Notes saved'), findsOneWidget);
    });

    testWidgets('managers void with a required reason', (tester) async {
      final convex = await pumpScreen(
        tester,
        const DeliveryDetailScreen(id: 'd1'),
        convex: fakeWith({
          'deliveries:get': (_) => detail(),
          'deliveries:voidDelivery': (_) => null,
        }),
        role: 'manager',
      );
      await tapOn(tester, find.text('Void record'));
      expect(find.text('e.g. Entered twice by mistake'), findsOneWidget);
      await answerDialog(tester, '   ', button: 'Void');
      await tapOn(tester, find.text('Void record'));
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();
      expect(convex.callsTo('deliveries:voidDelivery'), isEmpty);

      await tapOn(tester, find.text('Void record'));
      await answerDialog(tester, 'Duplicate', button: 'Void');
      expect(convex.callsTo('deliveries:voidDelivery').single.args, {
        'id': 'd1',
        'reason': 'Duplicate',
        'businessId': 'b1',
        'sessionToken': 'tok',
      });
      expect(find.text('Record voided'), findsOneWidget);
    });
  });
}
