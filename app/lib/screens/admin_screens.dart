import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/audit_history.dart';
import '../widgets/common.dart';

/// Full, read-only audit trail of every action in the system.
class AuditTrailScreen extends StatefulWidget {
  const AuditTrailScreen({super.key});
  @override
  State<AuditTrailScreen> createState() => _AuditTrailScreenState();
}

class _AuditTrailScreenState extends State<AuditTrailScreen> {
  String? _type;
  static const types = {
    null: 'All',
    'delivery': 'Goods in',
    'audit': 'Audits',
    'temperatureLog': 'Temperature',
    'correctiveAction': 'Actions',
    'supplier': 'Suppliers',
    'product': 'Products',
    'user': 'Users & sign-ins',
    'settings': 'Settings',
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Audit Trail')),
      body: Column(
        children: [
          SizedBox(
            height: 56,
            child: ListView(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
              children: [
                for (final e in types.entries)
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: ChoiceChip(
                      label: Text(e.value),
                      selected: _type == e.key,
                      onSelected: (_) => setState(() => _type = e.key),
                    ),
                  ),
              ],
            ),
          ),
          Expanded(
            child: QueryBuilder(
              path: 'auditLog:list',
              args: {'entityType': _type, 'limit': 500},
              builder: (context, data) {
                final list = data as List;
                if (list.isEmpty) {
                  return const EmptyState(
                    icon: Icons.history,
                    title: 'No entries',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const Divider(height: 1),
                  itemBuilder: (context, i) {
                    final e = list[i];
                    return Responsive(
                      child: ListTile(
                        tileColor: Colors.white,
                        leading: Icon(
                          auditActionIcon(e['action']),
                          color: e['action'] == 'login_failed'
                              ? AppColors.bad
                              : AppColors.orange,
                        ),
                        title: Text(e['summary']),
                        subtitle: Text(
                          '${e['userName']} · ${fmtDateTime(e['at'])} · ${e['action']}',
                        ),
                        onTap: e['changes'] == null
                            ? null
                            : () => showDialog(
                                context: context,
                                builder: (c) => AlertDialog(
                                  title: const Text('Change details'),
                                  content: SingleChildScrollView(
                                    child: SelectableText(
                                      _pretty(e['changes']),
                                      style: const TextStyle(
                                        fontFamily: 'monospace',
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  String _pretty(dynamic v, [String indent = '']) {
    if (v is Map) {
      return v.entries
          .map(
            (e) =>
                '$indent${e.key}: ${e.value is Map || e.value is List ? '\n${_pretty(e.value, '$indent  ')}' : e.value}',
          )
          .join('\n');
    }
    if (v is List) {
      return v
          .map((x) => '$indent- ${_pretty(x, '$indent  ').trimLeft()}')
          .join('\n');
    }
    return '$indent$v';
  }
}

class UsersScreen extends StatelessWidget {
  const UsersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final me = context.watch<AuthService>().user!;
    return Scaffold(
      appBar: AppBar(title: const Text('Users')),
      body: QueryBuilder(
        path: 'auth:listUsers',
        builder: (context, data) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            const Responsive(
              child: Padding(
                padding: EdgeInsets.only(bottom: 12),
                child: Text(
                  'New staff create their own account from the sign-in screen, then an admin sets their role.',
                  style: TextStyle(color: AppColors.muted),
                ),
              ),
            ),
            for (final u in data as List)
              Responsive(
                child: Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: ListTile(
                    title: Text(
                      u['name'],
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: u['active'] ? null : AppColors.muted,
                      ),
                    ),
                    subtitle: Text(
                      '${u['email']}${u['active'] ? '' : ' · deactivated'}',
                    ),
                    trailing: me.isAdmin && u['_id'] != me.id
                        ? PopupMenuButton<String>(
                            child: Pill(
                              u['role'].toUpperCase(),
                              tone: Tone.brand,
                            ),
                            onSelected: (v) => context.run(
                              () => context.m('auth:updateUser', {
                                'userId': u['_id'],
                                if (v.startsWith('role:'))
                                  'role': v.substring(5),
                                if (v == 'toggle') 'active': !u['active'],
                              }),
                              success: 'User updated',
                            ),
                            itemBuilder: (_) => [
                              for (final r in ['admin', 'manager', 'staff'])
                                PopupMenuItem(
                                  value: 'role:$r',
                                  child: Text('Make $r'),
                                ),
                              PopupMenuItem(
                                value: 'toggle',
                                child: Text(
                                  u['active'] ? 'Deactivate' : 'Reactivate',
                                ),
                              ),
                            ],
                          )
                        : Pill(u['role'].toUpperCase(), tone: Tone.brand),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Business Settings')),
      body: QueryBuilder(
        path: 'settings:get',
        refreshable: false,
        builder: (context, s) =>
            _SettingsForm(initial: Map<String, dynamic>.from(s)),
      ),
    );
  }
}

class _SettingsForm extends StatefulWidget {
  const _SettingsForm({required this.initial});
  final Map<String, dynamic> initial;
  @override
  State<_SettingsForm> createState() => _SettingsFormState();
}

class _SettingsFormState extends State<_SettingsForm> {
  late final s = widget.initial;
  late final _text = {
    for (final k in ['businessName', 'registrationNumber', 'address'])
      k: TextEditingController(text: s[k]),
  };
  late final _num = {
    for (final k in [
      'chilledMaxC',
      'frozenMaxC',
      'hotMinC',
      'expiryWarningDays',
    ])
      k: TextEditingController(text: fmtNum(s[k])),
  };
  late String _jurisdiction = s['jurisdiction'];

  @override
  Widget build(BuildContext context) {
    Widget num(String k, String label) => Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextField(
        controller: _num[k],
        keyboardType: const TextInputType.numberWithOptions(
          decimal: true,
          signed: true,
        ),
        decoration: InputDecoration(labelText: label),
      ),
    );
    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Responsive(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextField(
                controller: _text['businessName'],
                decoration: const InputDecoration(labelText: 'Business name'),
              ),
              const SizedBox(height: 12),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'NZ', label: Text('New Zealand (MPI)')),
                  ButtonSegment(value: 'AU', label: Text('Australia (FSANZ)')),
                ],
                selected: {_jurisdiction},
                onSelectionChanged: (v) =>
                    setState(() => _jurisdiction = v.first),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _text['registrationNumber'],
                decoration: InputDecoration(
                  labelText: _jurisdiction == 'NZ'
                      ? 'FCP / National Programme registration no.'
                      : 'Council food business licence no.',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _text['address'],
                decoration: const InputDecoration(labelText: 'Site address'),
              ),
              const SectionTitle('Temperature limits (°C)'),
              num('chilledMaxC', 'Chilled — maximum (5°C standard)'),
              num('frozenMaxC', 'Frozen — maximum (-15°C typical)'),
              num('hotMinC', 'Hot — minimum (60°C standard)'),
              num('expiryWarningDays', 'Warn this many days before expiry'),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: () => context.run(
                  () => context.m('settings:update', {
                    for (final e in _text.entries) e.key: e.value.text.trim(),
                    for (final e in _num.entries)
                      e.key: double.tryParse(e.value.text),
                    'jurisdiction': _jurisdiction,
                  }),
                  success: 'Settings saved',
                ),
                child: const Text('Save'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
