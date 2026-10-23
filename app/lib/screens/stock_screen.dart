import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'locations_screen.dart';
import 'lot_detail_screen.dart';
import 'stocktake_screen.dart';

const locationKinds = {
  'chiller': 'Chiller',
  'freezer': 'Freezer',
  'dry': 'Dry store',
  'display': 'Display',
  'other': 'Other',
};

/// Expiry pill for a lot: discard past use-by, warn when close.
Widget expiryPill(Map lot) {
  final exp = lot['useBy'] ?? lot['bestBefore'];
  if (exp == null) return const Pill('No date');
  final isUseBy = lot['useBy'] != null;
  final days = fromMs(exp).difference(DateTime.now()).inHours / 24;
  if (days < 0) {
    return Pill(
      isUseBy ? 'DISCARD' : 'PAST BB',
      tone: isUseBy ? Tone.bad : Tone.warn,
    );
  }
  return Pill(
    '${isUseBy ? 'Use by' : 'BB'} ${fmtDate(exp)}',
    tone: lot['expiringSoon'] == true ? Tone.warn : Tone.neutral,
  );
}

/// Stock tab: what is on hand (first-expiring first), what is running low, and stocktakes.
class StockScreen extends StatelessWidget {
  const StockScreen({super.key});

  void _push(BuildContext context, Widget w) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => w));

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().user!;
    return DefaultTabController(
      length: 3,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Stock'),
          actions: [
            if (user.isManager) ...[
              IconButton(
                tooltip: 'Locations',
                icon: const Icon(Icons.kitchen),
                onPressed: () => _push(context, const LocationsScreen()),
              ),
              IconButton(
                tooltip: 'Add stock',
                icon: const Icon(Icons.add),
                onPressed: () => _push(context, const AddStockScreen()),
              ),
            ],
          ],
          bottom: const TabBar(
            tabs: [
              Tab(text: 'On hand'),
              Tab(text: 'Low stock'),
              Tab(text: 'Stocktakes'),
            ],
          ),
        ),
        body: const TabBarView(
          children: [_OnHandTab(), _LowStockTab(), _StocktakesTab()],
        ),
      ),
    );
  }
}

class _OnHandTab extends StatefulWidget {
  const _OnHandTab();
  @override
  State<_OnHandTab> createState() => _OnHandTabState();
}

class _OnHandTabState extends State<_OnHandTab> {
  String? _location;

  @override
  Widget build(BuildContext context) => Column(
    children: [
      QueryBuilder(
        path: 'locations:list',
        refreshable: false,
        builder: (context, data) => (data as List).isEmpty
            ? const SizedBox(height: 8)
            : SizedBox(
                height: 56,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 6),
                  children: [
                    for (final l in [null, ...data])
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(l == null ? 'All' : l['name']),
                          selected: _location == l?['_id'],
                          onSelected: (_) =>
                              setState(() => _location = l?['_id']),
                        ),
                      ),
                  ],
                ),
              ),
      ),
      Expanded(
        child: QueryBuilder(
          path: 'stock:onHand',
          args: {'locationId': _location},
          builder: (context, data) {
            final list = data as List;
            if (list.isEmpty) {
              return const EmptyState(
                icon: Icons.inventory_2,
                title: 'No stock on hand',
                message:
                    'Accepted goods inwards are added to stock automatically.',
              );
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
              itemCount: list.length,
              separatorBuilder: (_, _) => const SizedBox(height: 8),
              itemBuilder: (context, i) => Responsive(child: LotCard(list[i])),
            );
          },
        ),
      ),
    ],
  );
}

class LotCard extends StatelessWidget {
  const LotCard(this.lot, {super.key});
  final Map lot;

  @override
  Widget build(BuildContext context) {
    final held = lot['status'] == 'hold';
    return Card(
      color: held ? AppColors.badLight : null,
      child: ListTile(
        onTap: () => Navigator.of(context).push(
          MaterialPageRoute(builder: (_) => LotDetailScreen(id: lot['_id'])),
        ),
        leading: Icon(
          storageIcons[lot['storageType']],
          color: AppColors.orange,
        ),
        title: Text(
          lot['productName'],
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Padding(
          padding: const EdgeInsets.only(top: 4),
          child: Wrap(
            spacing: 6,
            runSpacing: 6,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              Text(
                '${fmtNum(lot['qtyOnHand'])} ${lot['unit']}'
                '${lot['batchCode'] != null ? ' · Batch ${lot['batchCode']}' : ''}'
                '${lot['locationName'] != null ? ' · ${lot['locationName']}' : ''}',
              ),
              if (held) const Pill('ON HOLD', tone: Tone.bad),
              expiryPill(lot),
            ],
          ),
        ),
        trailing: const Icon(Icons.chevron_right),
      ),
    );
  }
}

class _LowStockTab extends StatelessWidget {
  const _LowStockTab();

  @override
  Widget build(BuildContext context) => QueryBuilder(
    path: 'stock:lowStock',
    builder: (context, data) {
      final list = data as List;
      if (list.isEmpty) {
        return const EmptyState(
          icon: Icons.check_circle_outline,
          title: 'Nothing below par',
          message: 'Set a par level on a product (More → Products) to be told when to reorder.',
        );
      }
      return ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: list.length,
        separatorBuilder: (_, _) => const SizedBox(height: 8),
        itemBuilder: (context, i) {
          final p = list[i];
          return Responsive(
            child: Card(
              child: ListTile(
                leading: const Icon(Icons.trending_down, color: AppColors.warn),
                title: Text(
                  p['name'],
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                subtitle: Text(
                  '${fmtNum(p['onHand'])} on hand · par ${fmtNum(p['parLevel'])}',
                ),
                trailing: p['reorderQty'] == null
                    ? null
                    : Pill('Order ${fmtNum(p['reorderQty'])}', tone: Tone.warn),
              ),
            ),
          );
        },
      );
    },
  );
}

class _StocktakesTab extends StatelessWidget {
  const _StocktakesTab();

  Future<void> _start(BuildContext context) async {
    final locations = await context.run(() => context.q('locations:list'));
    if (locations == null || !context.mounted) return;
    final choice = await showDialog<String>(
      context: context,
      builder: (c) => SimpleDialog(
        title: const Text('What are you counting?'),
        children: [
          SimpleDialogOption(
            onPressed: () => Navigator.pop(c, ''),
            child: const Text('Everything'),
          ),
          for (final l in locations as List)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(c, l['_id']),
              child: Text(l['name']),
            ),
        ],
      ),
    );
    if (choice == null || !context.mounted) return;
    final id = await context.run(
      () => context.m('stocktakes:start', {
        if (choice.isNotEmpty) 'locationId': choice,
      }),
    );
    if (id != null && context.mounted) {
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => StocktakeScreen(id: id)));
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().user!;
    return Scaffold(
      floatingActionButton: user.isManager
          ? FloatingActionButton.extended(
              heroTag: 'stocktake',
              onPressed: () => _start(context),
              icon: const Icon(Icons.checklist),
              label: const Text('Start stocktake'),
            )
          : null,
      body: QueryBuilder(
        path: 'stocktakes:list',
        builder: (context, data) {
          final list = data as List;
          if (list.isEmpty) {
            return const EmptyState(
              icon: Icons.checklist,
              title: 'No stocktakes yet',
              message: 'Count what is really on hand. Differences are corrected and big ones flagged.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            itemCount: list.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final s = list[i];
              final done = s['status'] == 'completed';
              return Responsive(
                child: Card(
                  child: ListTile(
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => StocktakeScreen(id: s['_id']),
                      ),
                    ),
                    title: Text(
                      s['title'],
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      '${fmtDateTime(s['startedAt'])} · ${s['startedByName']}\n'
                      '${s['counted']}/${s['total']} counted · ${s['variances']} difference(s)',
                    ),
                    isThreeLine: true,
                    trailing: done
                        ? const Pill('Done', tone: Tone.ok)
                        : const Pill('In progress', tone: Tone.warn),
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

/// Opening stock, or anything that arrived without a goods-inwards record.
class AddStockScreen extends StatefulWidget {
  const AddStockScreen({super.key});
  @override
  State<AddStockScreen> createState() => _AddStockScreenState();
}

class _AddStockScreenState extends State<AddStockScreen> {
  final _form = GlobalKey<FormState>();
  final _name = TextEditingController();
  final _qty = TextEditingController();
  final _unit = TextEditingController(text: 'ea');
  final _batch = TextEditingController();
  final _reason = TextEditingController(text: 'Opening stock');
  String _storage = 'chilled';
  String? _location;
  int? _useBy;

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    final nav = Navigator.of(context);
    final id = await context.run(
      () => context.m('stock:addLot', {
        'productName': _name.text.trim(),
        'qty': double.parse(_qty.text),
        'unit': _unit.text.trim(),
        'storageType': _storage,
        'batchCode': _batch.text.trim().isEmpty ? null : _batch.text.trim(),
        'useBy': _useBy,
        'locationId': _location,
        'reason': _reason.text.trim(),
      }),
      success: 'Added to stock',
    );
    if (id != null) nav.pop();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Add stock')),
    body: Form(
      key: _form,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Responsive(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextFormField(
                  controller: _name,
                  decoration: const InputDecoration(labelText: 'Product'),
                  validator: (v) => v!.trim().isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _qty,
                        keyboardType: const TextInputType.numberWithOptions(
                          decimal: true,
                        ),
                        decoration: const InputDecoration(
                          labelText: 'Quantity',
                        ),
                        validator: (v) => (double.tryParse(v!) ?? 0) > 0
                            ? null
                            : 'Enter a number',
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: TextFormField(
                        controller: _unit,
                        decoration: const InputDecoration(labelText: 'Unit'),
                        validator: (v) => v!.trim().isEmpty ? 'Required' : null,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _batch,
                  decoration: const InputDecoration(
                    labelText: 'Batch / lot code',
                  ),
                ),
                const SizedBox(height: 12),
                SegmentedButton<String>(
                  showSelectedIcon: false,
                  segments: [
                    for (final e in storageLabels.entries)
                      ButtonSegment(
                        value: e.key,
                        label: Text(e.value.split(' ').first),
                      ),
                  ],
                  selected: {_storage},
                  onSelectionChanged: (s) => setState(() => _storage = s.first),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  icon: const Icon(Icons.event),
                  label: Text(
                    _useBy == null ? 'Use by' : 'Use by ${fmtDate(_useBy)}',
                  ),
                  onPressed: () async {
                    final now = DateTime.now();
                    final d = await showDatePicker(
                      context: context,
                      firstDate: now.subtract(const Duration(days: 365)),
                      lastDate: now.add(const Duration(days: 365 * 5)),
                      initialDate: now.add(const Duration(days: 3)),
                    );
                    if (d != null) {
                      setState(
                        () => _useBy = DateTime(
                          d.year,
                          d.month,
                          d.day,
                          23,
                          59,
                        ).millisecondsSinceEpoch,
                      );
                    }
                  },
                ),
                const SizedBox(height: 12),
                LocationPicker(
                  value: _location,
                  onChanged: (v) => setState(() => _location = v),
                ),
                const SizedBox(height: 12),
                TextFormField(
                  controller: _reason,
                  decoration: const InputDecoration(
                    labelText: 'Where did it come from?',
                  ),
                  validator: (v) => v!.trim().isEmpty ? 'Required' : null,
                ),
                const SizedBox(height: 16),
                FilledButton(onPressed: _save, child: const Text('Add')),
              ],
            ),
          ),
        ],
      ),
    ),
  );
}

/// Dropdown of the business's stock locations (hidden when there are none).
class LocationPicker extends StatelessWidget {
  const LocationPicker({
    super.key,
    required this.value,
    required this.onChanged,
    this.label = 'Location',
  });
  final String? value;
  final ValueChanged<String?> onChanged;
  final String label;

  @override
  Widget build(BuildContext context) => QueryBuilder(
    path: 'locations:list',
    refreshable: false,
    builder: (context, data) => (data as List).isEmpty
        ? const SizedBox.shrink()
        : DropdownButtonFormField<String?>(
            initialValue: value,
            decoration: InputDecoration(labelText: label),
            items: [
              const DropdownMenuItem(value: null, child: Text('Not set')),
              for (final l in data)
                DropdownMenuItem(value: l['_id'], child: Text(l['name'])),
            ],
            onChanged: onChanged,
          ),
  );
}
