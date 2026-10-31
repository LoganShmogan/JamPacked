// Screenshots of the app for the website (web/public/screenshots/), rendered from demo data with the
// app's real fonts and theme. Not part of the normal test run. Regenerate after changing a screen:
//
//   flutter test screenshots
//
// It always rewrites the images: the demo data is dated relative to today (use-by dates, "made at"
// times, the greeting), so there's nothing stable to compare against.
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jampacked/screens/goods_in_form_screen.dart';
import 'package:jampacked/screens/help_screen.dart';
import 'package:jampacked/screens/home_shell.dart';
import 'package:jampacked/screens/insights_screen.dart';
import 'package:jampacked/screens/production_screen.dart';
import 'package:jampacked/screens/stock_screen.dart';
import 'package:jampacked/screens/trace_screen.dart';
import 'package:jampacked/services/auth_service.dart';
import 'package:jampacked/services/convex_client.dart';
import 'package:jampacked/theme.dart';
import 'package:provider/provider.dart';

import '../test/fixtures.dart';
import '../test/helpers.dart';

const out = '../../web/public/screenshots';
const phone = Size(390, 844);

ByteData _font(String path) =>
    ByteData.sublistView(File(path).readAsBytesSync());

const fallbacks = [
  ('NotoColorEmoji', '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf'),
];

Future<void> loadFonts() async {
  final fonts =
      '${Platform.environment['FLUTTER_ROOT']}/bin/cache/artifacts/material_fonts';
  final roboto = FontLoader('Roboto');
  for (final w in ['Light', 'Regular', 'Medium', 'Bold', 'Black']) {
    roboto.addFont(Future.value(_font('$fonts/Roboto-$w.ttf')));
  }
  await roboto.load();
  await (FontLoader(
    'MaterialIcons',
  )..addFont(Future.value(_font('$fonts/MaterialIcons-Regular.otf')))).load();
  const emoji = '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf';
  if (File(emoji).existsSync()) {
    await (FontLoader(
      'NotoColorEmoji',
    )..addFont(Future.value(_font(emoji)))).load();
  }
}

/// Reads assets (the help guides) straight from disk.
class _FileBundle extends CachingAssetBundle {
  @override
  Future<ByteData> load(String key) async => _font(key);
}

final demo = <String, Handler>{
  ...baseHandlers(),
  'dashboard:summary': (_) => {
    ...summary(
      deliveries: 3,
      temps: 4,
      openCAs: 1,
      expiring: 2,
      stockLines: 23,
      onHold: 1,
      lowStock: 2,
    ),
    'businessName': 'Kai Bakery',
  },
  'locations:list': (_) => locations.where((l) => l['active'] == true).toList(),
  'stock:onHand': (_) => [
    {
      ...lot(
        id: 'l1',
        name: 'Cream 1L',
        useBy: msFromNow(const Duration(days: 1)),
        expiringSoon: true,
        location: 'Chiller 1',
      ),
      'batchCode': 'CR0412',
    },
    {
      ...lot(
        id: 'l2',
        name: 'Butter 500g',
        status: 'hold',
        holdReason: 'Seal damaged',
        location: 'Chiller 1',
      ),
      'batchCode': 'BU7731',
    },
    {
      ...lot(
        id: 'l3',
        name: 'Free-range eggs (dozen)',
        qty: 8,
        useBy: msFromNow(const Duration(days: 12)),
        location: 'Chiller 1',
      ),
      'unit': 'doz',
      'batchCode': 'EG2210',
    },
    {
      ...lot(
        id: 'l4',
        name: 'Flour 10kg',
        qty: 3,
        bestBefore: msFromNow(const Duration(days: 120)),
        location: 'Dry store',
      ),
      'unit': 'bag',
      'batchCode': 'F2611',
      'storageType': 'ambient',
    },
    {
      ...lot(
        id: 'l5',
        name: 'Cheese scones',
        qty: 24,
        useBy: msFromNow(const Duration(days: 2)),
        location: 'Display',
      ),
      'batchCode': 'P0042',
    },
  ],
  'products:list': (_) => [
    {
      '_id': 'p1',
      'name': 'Cheese scones',
      'kind': 'made',
      'unit': 'ea',
      'storageType': 'ambient',
      'allergens': <String>[],
      'recipe': {
        'yieldQty': 24,
        'shelfLifeDays': 2,
        'ingredients': [
          {'productId': 'p2', 'productName': 'Flour', 'qty': 2, 'unit': 'kg'},
          {
            'productId': 'p3',
            'productName': 'Butter',
            'qty': 0.5,
            'unit': 'kg',
          },
          {
            'productId': 'p4',
            'productName': 'Tasty cheese',
            'qty': 0.8,
            'unit': 'kg',
          },
        ],
      },
    },
    {
      '_id': 'p2',
      'name': 'Flour',
      'unit': 'kg',
      'storageType': 'ambient',
      'allergens': ['gluten'],
    },
  ],
  'production:batchCode': (_) => 'P0043',
  'production:plan': (_) => {
    'product': {'_id': 'p1', 'name': 'Cheese scones'},
    'useBy': msFromNow(const Duration(days: 2)),
    'ingredients': [
      {
        'productName': 'Flour',
        'unit': 'kg',
        'need': 2,
        'short': 0,
        'picks': [
          {'lotId': 'f1', 'batchCode': 'F2603', 'qtyOnHand': 1.2, 'qty': 1.2},
          {'lotId': 'f2', 'batchCode': 'F2611', 'qtyOnHand': 10, 'qty': 0.8},
        ],
      },
      {
        'productName': 'Butter',
        'unit': 'kg',
        'need': 0.5,
        'short': 0,
        'picks': [
          {'lotId': 'b1', 'batchCode': 'BU7740', 'qtyOnHand': 4, 'qty': 0.5},
        ],
      },
      {
        'productName': 'Tasty cheese',
        'unit': 'kg',
        'need': 0.8,
        'short': 0.2,
        'picks': [
          {'lotId': 'c1', 'batchCode': 'TC0907', 'qtyOnHand': 0.6, 'qty': 0.6},
        ],
      },
    ],
  },
  'deliveries:trace': (_) => [
    {
      'deliveryId': 'd1',
      'productName': 'Flour 10kg',
      'supplierName': 'Southern Mills',
      'receivedAt': msAgo(const Duration(days: 6)),
      'batchCode': 'F2611',
      'quantity': 4,
      'unit': 'bag',
      'receivedByName': 'Sam',
      'accepted': true,
      'voided': false,
      'lot': {
        '_id': 'l4',
        'status': 'available',
        'qtyOnHand': 3,
        'dispatched': [],
        'usedIn': [
          {'reason': 'Made Cheese scones batch P0042'},
        ],
      },
    },
  ],
  'production:trace': (_) => [
    {
      '_id': 'r1',
      'productName': 'Cheese scones',
      'batchCode': 'P0042',
      'qty': 24,
      'unit': 'ea',
      'madeAt': msAgo(const Duration(days: 1)),
      'madeByName': 'Aroha',
      'inputs': [
        {'productName': 'Flour', 'batchCode': 'F2611'},
        {'productName': 'Butter', 'batchCode': 'BU7740'},
        {'productName': 'Tasty cheese', 'batchCode': 'TC0907'},
      ],
      'lot': {
        '_id': 'l5',
        'status': 'available',
        'qtyOnHand': 12,
        'dispatched': [
          {
            'customer': 'Corner Store',
            'qty': 12,
            'at': msAgo(const Duration(hours: 5)),
          },
        ],
      },
    },
  ],
  'stock:recall': (_) => {'held': 2},
};

/// Pumps [screen] on a phone as Sam, a manager at Kai Bakery, with real fonts and shadows.
Future<void> shoot(WidgetTester tester, Widget screen) async {
  final convex = FakeConvex(demo);
  final auth = signedIn(convex, role: 'manager');
  auth.business = Business('b1', 'Kai Bakery', 'NP2', 'manager');
  tester.view.physicalSize = phone * 2;
  tester.view.devicePixelRatio = 2;
  addTearDown(tester.view.reset);
  debugDisableShadows = false; // real shadows, not test outlines
  // On a phone, styles that don't name a font use the system font; in a test they'd use the
  // placeholder font, so name it.
  final base = buildTheme();
  final theme = base.copyWith(
    textTheme: base.textTheme.apply(
      fontFamilyFallback: [for (final (f, _) in fallbacks) f],
    ),
    appBarTheme: base.appBarTheme.copyWith(
      titleTextStyle: base.appBarTheme.titleTextStyle!.copyWith(
        fontFamily: 'Roboto',
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: base.filledButtonTheme.style!.copyWith(
        textStyle: const WidgetStatePropertyAll(
          TextStyle(
            fontFamily: 'Roboto',
            fontWeight: FontWeight.w700,
            fontSize: 16,
          ),
        ),
      ),
    ),
  );
  await tester.pumpWidget(
    MultiProvider(
      providers: [
        Provider<ConvexClient>.value(value: convex),
        ChangeNotifierProvider<AuthService>.value(value: auth),
      ],
      child: DefaultAssetBundle(
        bundle: _FileBundle(),
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: theme,
          home: screen,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> save(String name) async {
  await expectLater(
    find.byType(MaterialApp),
    matchesGoldenFile('$out/$name.png'),
  );
  debugDisableShadows =
      true; // the test framework checks it's back to its default
}

void main() {
  autoUpdateGoldenFiles = true;
  setUpAll(loadFonts);

  testWidgets('home', (tester) async {
    await shoot(tester, const HomeShell());
    await save('home');
  });

  testWidgets('receive', (tester) async {
    await shoot(
      tester,
      ItemEditorScreen(
        settings: settings(),
        initial: {
          'productName': 'Milk 2L',
          'barcode': '9415007012345',
          'quantity': 12,
          'unit': 'ea',
          'storageType': 'chilled',
          'temperatureC': 3.2,
          'batchCode': 'MK2611',
          'useBy': msFromNow(const Duration(days: 9)),
          'allergens': ['milk'],
          'accepted': true,
        },
      ),
    );
    await save('receive');
  });

  testWidgets('stock', (tester) async {
    await shoot(tester, const StockScreen());
    await save('stock');
  });

  testWidgets('production', (tester) async {
    await shoot(tester, const ProductionFormScreen());
    await tester.tap(find.text('What are you making?'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cheese scones'));
    await tester.pumpAndSettle();
    await save('production');
  });

  testWidgets('trace', (tester) async {
    await shoot(tester, const TraceScreen());
    await tester.enterText(find.byType(TextField), 'F2611');
    await tester.testTextInput.receiveAction(TextInputAction.search);
    await tester.pumpAndSettle();
    await save('trace');
  });

  testWidgets('insights', (tester) async {
    await shoot(tester, const InsightsScreen());
    await tester.drag(find.byType(ListView), const Offset(0, -520));
    await tester.pumpAndSettle();
    await save('insights');
  });

  testWidgets('help', (tester) async {
    await shoot(tester, const HelpScreen());
    await tester.tap(find.text('Make a batch'));
    await tester.pumpAndSettle();
    await save('help');
  });
}
