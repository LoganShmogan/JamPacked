import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/common.dart';
import 'stock_screen.dart';

/// Where stock is kept. Retired locations stay on old records.
class LocationsScreen extends StatelessWidget {
  const LocationsScreen({super.key});

  Future<void> _edit(BuildContext context, [Map? location]) async {
    final name = TextEditingController(text: location?['name']);
    var kind = (location?['kind'] ?? 'chiller') as String;
    var active = (location?['active'] ?? true) as bool;
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => AlertDialog(
          title: Text(location == null ? 'Add location' : 'Edit location'),
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
                  for (final e in locationKinds.entries)
                    DropdownMenuItem(value: e.key, child: Text(e.value)),
                ],
                onChanged: (v) => set(() => kind = v!),
              ),
              if (location != null)
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
    await context.run(
      () => location == null
          ? context.m('locations:create', {
              'name': name.text.trim(),
              'kind': kind,
            })
          : context.m('locations:update', {
              'id': location['_id'],
              'name': name.text.trim(),
              'kind': kind,
              'active': active,
            }),
      success: 'Saved',
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Locations')),
    floatingActionButton: FloatingActionButton.extended(
      onPressed: () => _edit(context),
      icon: const Icon(Icons.add),
      label: const Text('Add location'),
    ),
    body: QueryBuilder(
      path: 'locations:list',
      args: const {'includeInactive': true},
      builder: (context, data) {
        final list = data as List;
        if (list.isEmpty) {
          return const EmptyState(
            icon: Icons.kitchen,
            title: 'No locations yet',
            message: 'Add your chillers, freezers and dry store so stock can be put away and counted by location.',
          );
        }
        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          itemCount: list.length,
          separatorBuilder: (_, _) => const SizedBox(height: 8),
          itemBuilder: (context, i) {
            final l = list[i];
            return Responsive(
              child: Card(
                child: ListTile(
                  onTap: () => _edit(context, l),
                  leading: const Icon(Icons.kitchen, color: AppColors.orange),
                  title: Text(
                    l['name'],
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      color: l['active'] ? null : AppColors.muted,
                    ),
                  ),
                  subtitle: Text(locationKinds[l['kind']]!),
                  trailing: l['active'] ? null : const Pill('RETIRED'),
                ),
              ),
            );
          },
        );
      },
    ),
  );
}
