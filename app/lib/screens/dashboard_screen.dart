import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'expiring_screen.dart';
import 'goods_in_form_screen.dart';
import 'home_shell.dart';
import 'suppliers_screen.dart';
import 'temperature_screen.dart';
import 'trace_screen.dart';

class DashboardScreen extends StatelessWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().user!;
    return Scaffold(
      body: QueryBuilder(
        path: 'dashboard:summary',
        args: {'dayStart': localDayStartMs()},
        builder: (context, d) {
          final shell = HomeShell.of(context);
          void push(Widget w) =>
              Navigator.of(context).push(MaterialPageRoute(builder: (_) => w));
          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: _Header(
                  name: user.name,
                  business: d['businessName'],
                  jurisdiction: d['jurisdiction'],
                ),
              ),
              SliverToBoxAdapter(
                child: Responsive(
                  maxWidth: 900,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SectionTitle('Today'),
                        _KpiGrid(
                          children: [
                            _Kpi(
                              label: 'Deliveries',
                              value: fmtNum(d['deliveriesToday']),
                              sub: d['rejectionsToday'] > 0
                                  ? '${fmtNum(d['rejectionsToday'])} with rejections'
                                  : 'All accepted',
                              tone: d['rejectionsToday'] > 0
                                  ? Tone.warn
                                  : Tone.ok,
                              icon: Icons.local_shipping,
                              onTap: () => shell.go(1),
                            ),
                            _Kpi(
                              label: 'Temp checks',
                              value: fmtNum(d['tempChecksToday']),
                              sub: d['tempChecksToday'] == 0
                                  ? 'None recorded yet'
                                  : d['tempIssuesToday'] > 0
                                  ? '${fmtNum(d['tempIssuesToday'])} out of range'
                                  : 'All within limits',
                              tone:
                                  d['tempChecksToday'] == 0 ||
                                      d['tempIssuesToday'] > 0
                                  ? Tone.bad
                                  : Tone.ok,
                              icon: Icons.thermostat,
                              onTap: () => push(const TemperatureScreen()),
                            ),
                            _Kpi(
                              label: 'Open actions',
                              value: fmtNum(d['openCorrectiveActions']),
                              sub: d['highSeverityOpen'] > 0
                                  ? '${fmtNum(d['highSeverityOpen'])} high severity'
                                  : 'No high severity',
                              tone: d['highSeverityOpen'] > 0
                                  ? Tone.bad
                                  : d['openCorrectiveActions'] > 0
                                  ? Tone.warn
                                  : Tone.ok,
                              icon: Icons.report_problem,
                              onTap: () => shell.go(3),
                            ),
                            _Kpi(
                              label: 'Expiring soon',
                              value: fmtNum(d['expiringSoon']),
                              sub: d['expired'] > 0
                                  ? '${fmtNum(d['expired'])} past use-by!'
                                  : 'Nothing expired',
                              tone: d['expired'] > 0
                                  ? Tone.bad
                                  : d['expiringSoon'] > 0
                                  ? Tone.warn
                                  : Tone.ok,
                              icon: Icons.event_busy,
                              onTap: () => push(const ExpiringScreen()),
                            ),
                          ],
                        ),
                        const SectionTitle('Quick actions'),
                        _TileGrid(
                          tiles: [
                            _Tile(
                              'Receive goods',
                              Icons.add_box,
                              () => push(const GoodsInFormScreen()),
                              primary: true,
                            ),
                            _Tile(
                              'Temperature check',
                              Icons.thermostat,
                              () =>
                                  push(const TemperatureScreen(autoOpen: true)),
                            ),
                            _Tile(
                              'Start audit',
                              Icons.fact_check,
                              () => shell.go(2),
                            ),
                            _Tile(
                              'Trace / recall',
                              Icons.manage_search,
                              () => push(const TraceScreen()),
                            ),
                            _Tile(
                              'Suppliers',
                              Icons.storefront,
                              () => push(const SuppliersScreen()),
                            ),
                            _Tile(
                              'Expiring stock',
                              Icons.event_busy,
                              () => push(const ExpiringScreen()),
                            ),
                          ],
                        ),
                        if (d['inProgressAudits'] > 0) ...[
                          const SectionTitle('In progress'),
                          Card(
                            child: ListTile(
                              leading: const Icon(
                                Icons.pending_actions,
                                color: AppColors.orange,
                              ),
                              title: Text(
                                '${fmtNum(d['inProgressAudits'])} audit(s) in progress',
                              ),
                              trailing: const Icon(Icons.chevron_right),
                              onTap: () => shell.go(2),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.name,
    required this.business,
    required this.jurisdiction,
  });
  final String name, business, jurisdiction;
  @override
  Widget build(BuildContext context) {
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Good morning'
        : hour < 17
        ? 'Good afternoon'
        : 'Good evening';
    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [AppColors.orange, AppColors.orangeDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      padding: EdgeInsets.fromLTRB(
        20,
        MediaQuery.paddingOf(context).top + 20,
        20,
        28,
      ),
      child: Responsive(
        maxWidth: 900,
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$greeting, ${name.split(' ').first}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    business,
                    style: const TextStyle(color: Colors.white70, fontSize: 15),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.white24,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                jurisdiction == 'AU' ? '🇦🇺 FSANZ' : '🇳🇿 MPI',
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _KpiGrid extends StatelessWidget {
  const _KpiGrid({required this.children});
  final List<Widget> children;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, c) {
      final cols = c.maxWidth > 700 ? 4 : 2;
      final w = (c.maxWidth - (cols - 1) * 12) / cols;
      return Wrap(
        spacing: 12,
        runSpacing: 12,
        children: [for (final k in children) SizedBox(width: w, child: k)],
      );
    },
  );
}

class _Kpi extends StatelessWidget {
  const _Kpi({
    required this.label,
    required this.value,
    required this.sub,
    required this.tone,
    required this.icon,
    this.onTap,
  });
  final String label, value, sub;
  final Tone tone;
  final IconData icon;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) {
    final color = switch (tone) {
      Tone.ok => AppColors.ok,
      Tone.warn => AppColors.warn,
      Tone.bad => AppColors.bad,
      _ => AppColors.muted,
    };
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(icon, size: 18, color: AppColors.orange),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      label,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 30,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                sub,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: color,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tile {
  const _Tile(this.label, this.icon, this.onTap, {this.primary = false});
  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final bool primary;
}

class _TileGrid extends StatelessWidget {
  const _TileGrid({required this.tiles});
  final List<_Tile> tiles;
  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, c) {
      final cols = c.maxWidth > 700 ? 6 : 3;
      final w = (c.maxWidth - (cols - 1) * 10) / cols;
      return Wrap(
        spacing: 10,
        runSpacing: 10,
        children: [
          for (final t in tiles)
            SizedBox(
              width: w,
              height: 104,
              child: Material(
                color: t.primary ? AppColors.orange : Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                  side: t.primary
                      ? BorderSide.none
                      : const BorderSide(color: AppColors.border),
                ),
                clipBehavior: Clip.antiAlias,
                child: InkWell(
                  onTap: t.onTap,
                  child: Padding(
                    padding: const EdgeInsets.all(8),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          t.icon,
                          size: 32,
                          color: t.primary ? Colors.white : AppColors.orange,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          t.label,
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          style: TextStyle(
                            fontSize: 12.5,
                            fontWeight: FontWeight.w700,
                            color: t.primary ? Colors.white : AppColors.ink,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
        ],
      );
    },
  );
}
