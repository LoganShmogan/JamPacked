import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/common.dart';

class TemperatureScreen extends StatefulWidget {
  const TemperatureScreen({super.key, this.autoOpen = false});
  final bool autoOpen;
  @override
  State<TemperatureScreen> createState() => _TemperatureScreenState();
}

class _TemperatureScreenState extends State<TemperatureScreen> {
  static const types = {
    'chiller': 'Chiller / fridge',
    'freezer': 'Freezer',
    'hot_hold': 'Hot holding',
    'cooking': 'Cooking (core)',
    'cooling': 'Cooling',
  };

  @override
  void initState() {
    super.initState();
    if (widget.autoOpen) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _record());
    }
  }

  Future<void> _record() async {
    final started = DateTime.now(); // timed for Insights
    final units =
        (await context.run(() => context.q('temperature:units'))) as List? ??
        [];
    if (!mounted) return;
    final name = TextEditingController();
    final temp = TextEditingController();
    final action = TextEditingController();
    var type = 'chiller';
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (c) => StatefulBuilder(
        builder: (c, setState) => Padding(
          padding: EdgeInsets.fromLTRB(
            16,
            16,
            16,
            MediaQuery.viewInsetsOf(c).bottom + 16,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Record temperature',
                style: Theme.of(c).textTheme.titleLarge,
              ),
              if (units.isNotEmpty) ...[
                const SizedBox(height: 10),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: [
                    for (final u in units)
                      ChoiceChip(
                        label: Text(u['unitName']),
                        selected: name.text == u['unitName'],
                        onSelected: (_) => setState(
                          () =>
                              (name.text = u['unitName'], type = u['unitType']),
                        ),
                      ),
                  ],
                ),
              ],
              const SizedBox(height: 10),
              TextField(
                controller: name,
                decoration: const InputDecoration(
                  labelText: 'Unit (e.g. Walk-in chiller)',
                ),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: type,
                decoration: const InputDecoration(labelText: 'Type'),
                items: [
                  for (final e in types.entries)
                    DropdownMenuItem(value: e.key, child: Text(e.value)),
                ],
                onChanged: (v) => setState(() => type = v!),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: temp,
                autofocus: true,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                  signed: true,
                ),
                decoration: const InputDecoration(
                  labelText: 'Temperature °C',
                  prefixIcon: Icon(Icons.thermostat),
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: action,
                decoration: const InputDecoration(
                  labelText: 'Corrective action (if out of range)',
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => Navigator.pop(c, true),
                child: const Text('Save reading'),
              ),
            ],
          ),
        ),
      ),
    );
    if (ok != true || !mounted) return;
    final t = double.tryParse(temp.text);
    if (name.text.trim().isEmpty || t == null) {
      return context.toast('Enter a unit and temperature', error: true);
    }
    final r = await context.run(
      () => context.m('temperature:record', {
        'unitName': name.text.trim(),
        'unitType': type,
        'temperatureC': t,
        'correctiveAction': action.text.trim().isEmpty
            ? null
            : action.text.trim(),
      }),
    );
    if (r != null && mounted) {
      context.recordTask('temperature', started);
      context.toast(
        r['compliant']
            ? 'Recorded: within limits'
            : 'Recorded: OUT OF RANGE, corrective action raised',
        error: !r['compliant'],
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Temperature Checks')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _record,
        icon: const Icon(Icons.thermostat),
        label: const Text('Record'),
      ),
      body: QueryBuilder(
        path: 'temperature:list',
        builder: (context, data) {
          final list = data as List;
          if (list.isEmpty) {
            return const EmptyState(
              icon: Icons.thermostat,
              title: 'No temperature checks yet',
              message: 'Check chillers and freezers at least once a day.',
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
                    leading: CircleAvatar(
                      backgroundColor: l['compliant']
                          ? AppColors.okLight
                          : AppColors.badLight,
                      child: Icon(
                        Icons.thermostat,
                        color: l['compliant'] ? AppColors.ok : AppColors.bad,
                      ),
                    ),
                    title: Text(
                      '${l['unitName']}: ${fmtNum(l['temperatureC'])}°C',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      [
                        '${types[l['unitType']]} · ${l['checkedByName']} · ${fmtDateTime(l['checkedAt'])}',
                        if (l['correctiveAction'] != null)
                          'Action: ${l['correctiveAction']}',
                      ].join('\n'),
                    ),
                    isThreeLine: l['correctiveAction'] != null,
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
