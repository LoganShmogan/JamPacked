import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'stock_screen.dart';

const movementLabels = {
  'receive': 'Received',
  'use': 'Used',
  'sell': 'Sold',
  'dispatch': 'Dispatched',
  'waste': 'Wasted',
  'adjust': 'Adjusted',
  'stocktake': 'Stocktake',
  'transfer': 'Moved',
  'hold': 'Put on hold',
  'release': 'Released',
  'void': 'Voided',
};

/// One lot of stock: what's left, where it came from, every movement, and what you can do with it.
class LotDetailScreen extends StatelessWidget {
  const LotDetailScreen({super.key, required this.id});
  final String id;

  /// Asks for a quantity and, depending on [type], a reason or customer, then records it.
  Future<void> _move(BuildContext context, Map lot, String type) async {
    final qty = TextEditingController();
    final note = TextEditingController();
    final noteLabel = switch (type) {
      'dispatch' => 'Customer (business it went to)',
      'waste' => 'Why was it wasted?',
      'adjust' => 'Reason for the adjustment',
      _ => null,
    };
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('${movementLabels[type]} ${lot['productName']}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: qty,
              autofocus: true,
              keyboardType: TextInputType.numberWithOptions(
                decimal: true,
                signed: type == 'adjust',
              ),
              decoration: InputDecoration(
                labelText: type == 'adjust'
                    ? 'Change (+ or -) in ${lot['unit']}'
                    : 'Quantity (${lot['unit']})',
                helperText: '${fmtNum(lot['qtyOnHand'])} on hand',
              ),
            ),
            if (noteLabel != null)
              TextField(
                controller: note,
                decoration: InputDecoration(labelText: noteLabel),
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
    );
    if (ok != true || !context.mounted) return;
    await context.run(
      () => context.m('stock:move', {
        'lotId': id,
        'type': type,
        'qty': double.tryParse(qty.text) ?? 0,
        if (type == 'dispatch') 'customer': note.text,
        if (type == 'waste' || type == 'adjust') 'reason': note.text,
      }),
      success: 'Saved',
    );
  }

  Future<void> _transfer(BuildContext context) async {
    final locations = await context.run(() => context.q('locations:list'));
    if (locations == null || !context.mounted) return;
    final to = await showDialog<String>(
      context: context,
      builder: (c) => SimpleDialog(
        title: const Text('Move to'),
        children: [
          for (final l in locations as List)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(c, l['_id']),
              child: Text(l['name']),
            ),
        ],
      ),
    );
    if (to == null || !context.mounted) return;
    await context.run(
      () => context.m('stock:transfer', {'lotId': id, 'locationId': to}),
      success: 'Moved',
    );
  }

  Future<void> _holdOrRelease(BuildContext context, bool held) async {
    final reason = await promptText(
      context,
      title: held ? 'Release from hold' : 'Put on hold',
      label: held ? 'Why is it safe to use?' : 'Why is it on hold?',
      confirm: held ? 'Release' : 'Hold',
    );
    if (reason == null || !context.mounted) return;
    await context.run(
      () => context.m(held ? 'stock:release' : 'stock:hold', {
        'lotId': id,
        'reason': reason,
      }),
      success: held ? 'Released' : 'On hold',
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().user!;
    return Scaffold(
      appBar: AppBar(title: const Text('Stock')),
      body: QueryBuilder(
        path: 'stock:lot',
        args: {'id': id},
        builder: (context, data) {
          if (data == null) {
            return const EmptyState(
              icon: Icons.search_off,
              title: 'Stock not found',
            );
          }
          final lot = data['lot'] as Map;
          final held = lot['status'] == 'hold';
          final depleted = lot['status'] == 'depleted';
          Widget action(String label, IconData icon, VoidCallback onTap) =>
              OutlinedButton.icon(
                onPressed: onTap,
                icon: Icon(icon),
                label: Text(label),
              );
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Responsive(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.all(16),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    lot['productName'],
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleLarge,
                                  ),
                                ),
                                if (held)
                                  const Pill('ON HOLD', tone: Tone.bad)
                                else if (depleted)
                                  const Pill('USED UP'),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              '${fmtNum(lot['qtyOnHand'])} ${lot['unit']} on hand',
                              style: const TextStyle(
                                fontSize: 22,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            if (held)
                              Padding(
                                padding: const EdgeInsets.only(top: 6),
                                child: Text(
                                  lot['holdReason'],
                                  style: const TextStyle(color: AppColors.bad),
                                ),
                              ),
                            const Divider(height: 24),
                            InfoRow(
                              'Received',
                              '${fmtNum(lot['qtyReceived'])} ${lot['unit']} on ${fmtDate(lot['receivedAt'])}',
                            ),
                            InfoRow('From', lot['supplierName'] ?? '-'),
                            InfoRow('Batch', lot['batchCode'] ?? '-'),
                            InfoRow('Use by', fmtDate(lot['useBy'])),
                            InfoRow('Best before', fmtDate(lot['bestBefore'])),
                            InfoRow('Location', data['locationName'] ?? '-'),
                            InfoRow(
                              'Storage',
                              storageLabels[lot['storageType']]!,
                            ),
                            const SizedBox(height: 4),
                            expiryPill(lot),
                          ],
                        ),
                      ),
                    ),
                    if (!depleted) ...[
                      const SectionTitle('Actions'),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          if (!held) ...[
                            action(
                              'Use',
                              Icons.restaurant,
                              () => _move(context, lot, 'use'),
                            ),
                            action(
                              'Sell',
                              Icons.point_of_sale,
                              () => _move(context, lot, 'sell'),
                            ),
                            action(
                              'Dispatch',
                              Icons.local_shipping,
                              () => _move(context, lot, 'dispatch'),
                            ),
                          ],
                          action(
                            'Waste',
                            Icons.delete_outline,
                            () => _move(context, lot, 'waste'),
                          ),
                          action(
                            'Move',
                            Icons.swap_horiz,
                            () => _transfer(context),
                          ),
                          if (!held)
                            action(
                              'Hold',
                              Icons.block,
                              () => _holdOrRelease(context, false),
                            ),
                          if (held && user.isManager)
                            action(
                              'Release',
                              Icons.lock_open,
                              () => _holdOrRelease(context, true),
                            ),
                          if (user.isManager)
                            action(
                              'Adjust',
                              Icons.tune,
                              () => _move(context, lot, 'adjust'),
                            ),
                        ],
                      ),
                    ],
                    const SectionTitle('History'),
                    for (final m in data['movements'] as List)
                      Card(
                        margin: const EdgeInsets.only(bottom: 6),
                        child: ListTile(
                          dense: true,
                          title: Text(
                            '${movementLabels[m['type']]}'
                            '${m['qty'] == 0 ? '' : ' ${m['qty'] > 0 ? '+' : ''}${fmtNum(m['qty'])} ${lot['unit']}'}'
                            '${m['customer'] != null ? ' to ${m['customer']}' : ''}',
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          subtitle: Text(
                            '${fmtDateTime(m['at'])} · ${m['byName']}'
                            '${m['reason'] != null ? '\n${m['reason']}' : ''}',
                          ),
                          trailing: Text(
                            fmtNum(m['qtyAfter']),
                            style: const TextStyle(color: AppColors.muted),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
