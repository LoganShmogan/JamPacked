import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'admin_screens.dart';
import 'expiring_screen.dart';
import 'products_screen.dart';
import 'suppliers_screen.dart';
import 'temperature_screen.dart';
import 'trace_screen.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().user!;
    void push(Widget w) =>
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => w));
    Widget tile(IconData icon, String title, String sub, Widget page) =>
        ListTile(
          leading: Icon(icon, color: AppColors.orange),
          title: Text(
            title,
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          subtitle: Text(sub),
          trailing: const Icon(Icons.chevron_right),
          onTap: () => push(page),
        );
    return Scaffold(
      appBar: AppBar(title: const Text('More')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Responsive(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      backgroundColor: AppColors.orange,
                      child: Text(
                        user.name[0].toUpperCase(),
                        style: const TextStyle(color: Colors.white),
                      ),
                    ),
                    title: Text(
                      user.name,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(user.email),
                    trailing: Pill(user.role.toUpperCase(), tone: Tone.brand),
                  ),
                ),
                const SectionTitle('Records'),
                Card(
                  child: Column(
                    children: [
                      tile(
                        Icons.thermostat,
                        'Temperature checks',
                        'Chillers, freezers, cooking & cooling',
                        const TemperatureScreen(),
                      ),
                      const Divider(),
                      tile(
                        Icons.storefront,
                        'Suppliers',
                        'Approved supplier list',
                        const SuppliersScreen(),
                      ),
                      const Divider(),
                      tile(
                        Icons.inventory_2,
                        'Products',
                        'Catalogue, allergens & barcodes',
                        const ProductsScreen(),
                      ),
                      const Divider(),
                      tile(
                        Icons.event_busy,
                        'Expiring stock',
                        'Use-by and best-before alerts',
                        const ExpiringScreen(),
                      ),
                      const Divider(),
                      tile(
                        Icons.manage_search,
                        'Trace & recall',
                        'Find a batch or product',
                        const TraceScreen(),
                      ),
                    ],
                  ),
                ),
                if (user.isManager) ...[
                  const SectionTitle('Compliance'),
                  Card(
                    child: Column(
                      children: [
                        tile(
                          Icons.history,
                          'Audit trail',
                          'Every action, by whom and when',
                          const AuditTrailScreen(),
                        ),
                        const Divider(),
                        tile(
                          Icons.group,
                          'Users',
                          'Staff accounts & roles',
                          const UsersScreen(),
                        ),
                        if (user.isAdmin) ...[
                          const Divider(),
                          tile(
                            Icons.settings,
                            'Business settings',
                            'NZ/AU, registration, temperature limits',
                            const SettingsScreen(),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                OutlinedButton.icon(
                  onPressed: () => context.auth.logout(),
                  icon: const Icon(Icons.logout),
                  label: const Text('Sign out'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
