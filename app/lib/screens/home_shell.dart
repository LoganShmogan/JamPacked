import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../widgets/common.dart';
import 'audits_screen.dart';
import 'dashboard_screen.dart';
import 'goods_in_screen.dart';
import 'more_screen.dart';
import 'production_screen.dart';
import 'stock_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => HomeShellState();

  static HomeShellState of(BuildContext context) =>
      context.findAncestorStateOfType<HomeShellState>()!;
}

/// A main nav tab: its key (for [HomeShellState.go]), icons, label and page.
typedef _Tab = (String, IconData, IconData, String, Widget);

class HomeShellState extends State<HomeShell> {
  String tab = 'home';

  /// Switches to the tab with [key] ('home', 'goodsIn', 'production', 'stock', 'checks', 'more').
  void go(String key) => setState(() => tab = key);

  @override
  Widget build(BuildContext context) {
    final b = context.watch<AuthService>().business!;
    final tabs = <_Tab>[
      (
        'home',
        Icons.dashboard_outlined,
        Icons.dashboard,
        'Home',
        const DashboardScreen(),
      ),
      (
        'goodsIn',
        Icons.local_shipping_outlined,
        Icons.local_shipping,
        'Goods In',
        const GoodsInScreen(),
      ),
      if (b.producing)
        (
          'production',
          b.operation == 'farm'
              ? Icons.agriculture_outlined
              : Icons.soup_kitchen_outlined,
          b.operation == 'farm' ? Icons.agriculture : Icons.soup_kitchen,
          b.productionLabel,
          const ProductionScreen(),
        ),
      (
        'stock',
        Icons.inventory_2_outlined,
        Icons.inventory_2,
        'Stock',
        const StockScreen(),
      ),
      (
        'checks',
        Icons.fact_check_outlined,
        Icons.fact_check,
        'Checks',
        const AuditsScreen(),
      ),
      ('more', Icons.menu, Icons.menu, 'More', const MoreScreen()),
    ];
    // A tab that's gone (the business changed type) falls back to Home.
    final index = tabs.indexWhere((t) => t.$1 == tab).clamp(0, tabs.length);
    void select(int i) => go(tabs[i].$1);
    final body = IndexedStack(
      index: index,
      children: [for (final t in tabs) t.$5],
    );
    if (MediaQuery.sizeOf(context).width < 900) {
      return Scaffold(
        body: body,
        bottomNavigationBar: NavigationBar(
          selectedIndex: index,
          onDestinationSelected: select,
          labelBehavior: tabs.length > 5
              ? NavigationDestinationLabelBehavior.onlyShowSelected
              : null,
          destinations: [
            for (final t in tabs)
              NavigationDestination(
                icon: Icon(t.$2),
                selectedIcon: Icon(t.$3),
                label: t.$4,
              ),
          ],
        ),
      );
    }
    // Web/tablet: side rail instead of bottom bar.
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: index,
            onDestinationSelected: select,
            labelType: NavigationRailLabelType.all,
            leading: const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: AppLogo(size: 44),
            ),
            destinations: [
              for (final t in tabs)
                NavigationRailDestination(
                  icon: Icon(t.$2),
                  selectedIcon: Icon(t.$3),
                  label: Text(t.$4),
                ),
            ],
          ),
          const VerticalDivider(width: 1),
          Expanded(child: body),
        ],
      ),
    );
  }
}
