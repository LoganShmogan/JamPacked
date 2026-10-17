// Read-only list screens: expiring stock, trace & recall, products.
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:foodsafe/screens/delivery_detail_screen.dart';
import 'package:foodsafe/screens/expiring_screen.dart';
import 'package:foodsafe/screens/products_screen.dart';
import 'package:foodsafe/screens/trace_screen.dart';

import '../fixtures.dart';
import '../helpers.dart';

void main() {
  group('ExpiringScreen', () {
    testWidgets('empty state', (tester) async {
      await pumpScreen(tester, const ExpiringScreen(), convex: fakeWith());
      expect(find.text('Nothing expiring soon'), findsOneWidget);
    });

    testWidgets('labels past use-by, past best-before, today and days left', (
      tester,
    ) async {
      Map<String, dynamic> it(
        String name,
        int expiresAt, {
        bool useBy = true,
        String? batch,
      }) => {
        'productName': name,
        'expiresAt': expiresAt,
        if (useBy) 'useBy': expiresAt else 'bestBefore': expiresAt,
        'batchCode': batch,
        'storageType': 'chilled',
        'receivedAt': t0,
        'quantity': 2,
        'unit': 'kg',
      };
      await pumpScreen(
        tester,
        const ExpiringScreen(),
        convex: fakeWith({
          'deliveries:expiring': (_) => [
            it('Old milk', msAgo(const Duration(days: 1)), batch: 'L1'),
            it('Old crackers', msAgo(const Duration(days: 1)), useBy: false),
            it('Ham', msFromNow(const Duration(hours: 5))),
            it('Cheese', msFromNow(const Duration(days: 2, hours: 12))),
          ],
        }),
      );
      expect(find.text('DISCARD'), findsOneWidget);
      expect(find.text('PAST BB'), findsOneWidget);
      expect(find.text('Today'), findsOneWidget);
      expect(find.text('3d'), findsOneWidget);
      expect(find.textContaining('· Batch L1'), findsOneWidget);
      expect(find.textContaining('Best before'), findsOneWidget);
      expect(
        find.textContaining('Received 6 May 2024 · 2 kg'),
        findsNWidgets(4),
      );
    });
  });

  group('TraceScreen', () {
    Map<String, dynamic> hit(
      String name, {
      bool accepted = true,
      bool voided = false,
      String? batch = 'LOT1',
    }) => {
      'deliveryId': 'd1',
      'productName': name,
      'supplierName': 'Fresh Foods',
      'receivedAt': t0,
      'batchCode': batch,
      'quantity': 3,
      'unit': 'ea',
      'receivedByName': 'Sam',
      'accepted': accepted,
      'voided': voided,
    };

    testWidgets('prompts for a search, then shows matches with status', (
      tester,
    ) async {
      final convex = fakeWith({
        'deliveries:trace': (a) => a['search'] == 'none'
            ? []
            : [
                hit('Milk'),
                hit('Fish', accepted: false, batch: null),
                hit('Eggs', voided: true),
              ],
      });
      await pumpScreen(tester, const TraceScreen(), convex: convex);
      expect(find.text('Find affected stock'), findsOneWidget);

      await tester.enterText(find.byType(TextField), ' LOT1 ');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      expect(convex.callsTo('deliveries:trace').last.args['search'], 'LOT1');
      expect(find.text('Accepted'), findsOneWidget);
      expect(find.text('Rejected'), findsOneWidget);
      expect(find.text('VOID'), findsOneWidget);
      expect(find.textContaining('Batch - · 3 ea · by Sam'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'none');
      await tester.tap(find.byIcon(Icons.arrow_forward));
      await tester.pumpAndSettle();
      expect(find.text('No matches'), findsOneWidget);
    });

    testWidgets('tapping a match opens the delivery', (tester) async {
      await pumpScreen(
        tester,
        const TraceScreen(),
        convex: fakeWith({
          'deliveries:trace': (_) => [hit('Milk')],
        }),
      );
      await tester.enterText(find.byType(TextField), 'milk');
      await tester.testTextInput.receiveAction(TextInputAction.search);
      await tester.pumpAndSettle();
      await tapOn(tester, find.text('Milk'));
      expect(find.byType(DeliveryDetailScreen), findsOneWidget);
    });
  });

  group('ProductsScreen', () {
    testWidgets('empty state', (tester) async {
      await pumpScreen(tester, const ProductsScreen(), convex: fakeWith());
      expect(find.text('No products yet'), findsOneWidget);
    });

    testWidgets('shows NOVA, barcode and allergens, and filters by name', (
      tester,
    ) async {
      Map<String, dynamic> p(
        String name, {
        int? nova,
        String? barcode,
        List<String> allergens = const [],
      }) => {
        'name': name,
        'storageType': 'ambient',
        'novaGroup': nova,
        'barcode': barcode,
        'allergens': allergens,
      };
      await pumpScreen(
        tester,
        const ProductsScreen(),
        convex: fakeWith({
          'products:list': (_) => [
            p('Chips', nova: 4, barcode: '9400001', allergens: ['soy']),
            p('Bread', nova: 3),
            p('Apples', nova: 1),
            p('Salt'),
          ],
        }),
      );
      expect(find.text('NOVA 4'), findsOneWidget);
      expect(find.text('NOVA 3'), findsOneWidget);
      expect(find.text('NOVA 1'), findsOneWidget);
      expect(find.text('9400001'), findsOneWidget);
      expect(find.text('soy'), findsOneWidget);

      await tester.enterText(find.byType(TextField), 'CHI');
      await tester.pumpAndSettle();
      expect(find.text('Chips'), findsOneWidget);
      expect(find.text('Bread'), findsNothing);
      await tester.enterText(find.byType(TextField), 'zzz');
      await tester.pumpAndSettle();
      expect(find.text('No products yet'), findsOneWidget);
    });
  });
}
