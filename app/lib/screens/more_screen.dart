import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/business_form.dart';
import '../widgets/common.dart';
import 'admin_screens.dart';
import 'corrective_actions_screen.dart';
import 'programme_screen.dart';
import 'business_picker_screen.dart';
import 'expiring_screen.dart';
import 'products_screen.dart';
import 'suppliers_screen.dart';
import 'temperature_screen.dart';
import 'trace_screen.dart';

class MoreScreen extends StatelessWidget {
  const MoreScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final user = auth.user!;
    final business = auth.business!;
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
                const SectionTitle('Business'),
                Card(
                  child: Column(
                    children: [
                      ListTile(
                        leading: const Icon(
                          Icons.storefront,
                          color: AppColors.orange,
                        ),
                        title: Text(
                          business.name,
                          style: const TextStyle(fontWeight: FontWeight.w700),
                        ),
                        subtitle: const Text('Working in today'),
                        trailing: Pill(
                          programmeLabel(business.programme),
                          tone: Tone.brand,
                        ),
                      ),
                      const Divider(),
                      ListTile(
                        leading: const Icon(
                          Icons.swap_horiz,
                          color: AppColors.orange,
                        ),
                        title: const Text(
                          'Switch business',
                          style: TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: Text(
                          '${auth.businesses.length} business${auth.businesses.length == 1 ? '' : 'es'}',
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => context.auth.switchBusiness(),
                      ),
                      const Divider(),
                      tile(
                        Icons.verified,
                        'Programme',
                        'What your programme asks for',
                        const ProgrammeScreen(),
                      ),
                      const Divider(),
                      tile(
                        Icons.add_business,
                        'Add another business',
                        'You will be its admin',
                        const AddBusinessScreen(),
                      ),
                    ],
                  ),
                ),
                const SectionTitle('Records'),
                Card(
                  child: Column(
                    children: [
                      tile(
                        Icons.report_problem,
                        'Corrective actions',
                        'Problems and how they were fixed',
                        const CorrectiveActionsScreen(),
                      ),
                      const Divider(),
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
                          'Members',
                          'Staff, roles & invites',
                          const MembersScreen(),
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
