import 'package:flutter/material.dart';

import 'audits_screen.dart';
import 'corrective_actions_screen.dart';
import 'dashboard_screen.dart';
import 'goods_in_screen.dart';
import 'more_screen.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({super.key});
  @override
  State<HomeShell> createState() => HomeShellState();

  static HomeShellState of(BuildContext context) =>
      context.findAncestorStateOfType<HomeShellState>()!;
}

class HomeShellState extends State<HomeShell> {
  int index = 0;
  void go(int i) => setState(() => index = i);

  static const _destinations = [
    NavigationDestination(
      icon: Icon(Icons.dashboard_outlined),
      selectedIcon: Icon(Icons.dashboard),
      label: 'Home',
    ),
    NavigationDestination(
      icon: Icon(Icons.local_shipping_outlined),
      selectedIcon: Icon(Icons.local_shipping),
      label: 'Goods In',
    ),
    NavigationDestination(
      icon: Icon(Icons.fact_check_outlined),
      selectedIcon: Icon(Icons.fact_check),
      label: 'Audits',
    ),
    NavigationDestination(
      icon: Icon(Icons.report_problem_outlined),
      selectedIcon: Icon(Icons.report_problem),
      label: 'Actions',
    ),
    NavigationDestination(icon: Icon(Icons.menu), label: 'More'),
  ];

  @override
  Widget build(BuildContext context) {
    final pages = const [
      DashboardScreen(),
      GoodsInScreen(),
      AuditsScreen(),
      CorrectiveActionsScreen(),
      MoreScreen(),
    ];
    final wide = MediaQuery.sizeOf(context).width >= 900;
    final body = IndexedStack(index: index, children: pages);
    if (!wide) {
      return Scaffold(
        body: body,
        bottomNavigationBar: NavigationBar(
          selectedIndex: index,
          onDestinationSelected: go,
          destinations: _destinations,
        ),
      );
    }
    // Web/tablet: side rail instead of bottom bar.
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: index,
            onDestinationSelected: go,
            labelType: NavigationRailLabelType.all,
            leading: const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Icon(
                Icons.verified_user,
                color: Color(0xFFF26B21),
                size: 36,
              ),
            ),
            destinations: [
              for (final d in _destinations)
                NavigationRailDestination(
                  icon: d.icon,
                  selectedIcon: d.selectedIcon,
                  label: Text(d.label),
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
