import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/common.dart';

const areaKinds = {
  'paddock': 'Paddock',
  'block': 'Block or bed',
  'glasshouse': 'Glasshouse or tunnel',
  'orchard': 'Orchard',
  'hive': 'Hives / apiary',
  'herd': 'Herd or flock',
  'other': 'Other',
};

/// Where a farm grows or raises what it harvests. Retired areas stay on old harvests.
class AreasScreen extends StatelessWidget {
  const AreasScreen({super.key});

  Future<void> _edit(BuildContext context, [Map? area]) async {
    final name = TextEditingController(text: area?['name']);
    final notes = TextEditingController(text: area?['notes']);
    var kind = (area?['kind'] ?? 'paddock') as String;
    var active = (area?['active'] ?? true) as bool;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => AlertDialog(
          title: Text(area == null ? 'Add growing area' : 'Edit growing area'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: name,
                autofocus: true,
                decoration: const InputDecoration(labelText: 'Name'),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: kind,
                decoration: const InputDecoration(labelText: 'Type'),
                items: [
                  for (final e in areaKinds.entries)
                    DropdownMenuItem(value: e.key, child: Text(e.value)),
                ],
                onChanged: (v) => set(() => kind = v!),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: notes,
                decoration: const InputDecoration(labelText: 'Notes'),
              ),
              if (area != null)
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('In use'),
                  value: active,
                  onChanged: (v) => set(() => active = v),
                ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Cancel'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
    if (ok != true || !context.mounted) return;
    final fields = {
      'name': name.text.trim(),
      'kind': kind,
      'notes': notes.text.trim(),
    };
    await context.run(
      () => area == null
          ? context.m('areas:create', fields)
          : context.m('areas:update', {
              'id': area['_id'],
              ...fields,
              'active': active,
            }),
      success: 'Saved',
    );
  }

  @override
  Widget build(BuildContext context) {
    final manager = context.watch<AuthService>().user!.isManager;
    return Scaffold(
      appBar: AppBar(title: const Text('Growing areas')),
      floatingActionButton: manager
          ? FloatingActionButton.extended(
              onPressed: () => _edit(context),
              icon: const Icon(Icons.add),
              label: const Text('Add area'),
            )
          : null,
      body: QueryBuilder(
        path: 'areas:list',
        args: const {'includeInactive': true},
        builder: (context, data) {
          final list = data as List;
          if (list.isEmpty) {
            return const EmptyState(
              icon: Icons.grass,
              title: 'No growing areas yet',
              message: 'Add your paddocks, blocks, glasshouses or hives so each harvest traces back to where it was grown.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            itemCount: list.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final a = list[i];
              return Responsive(
                child: Card(
                  child: ListTile(
                    onTap: manager ? () => _edit(context, a) : null,
                    leading: const Icon(Icons.grass, color: AppColors.jam),
                    title: Text(
                      a['name'],
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: a['active'] ? null : AppColors.muted,
                      ),
                    ),
                    subtitle: Text(
                      [areaKinds[a['kind']]!, ?a['notes']].join(' · '),
                    ),
                    trailing: a['active'] ? null : const Pill('RETIRED'),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
