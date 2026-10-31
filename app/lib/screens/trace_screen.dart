import 'package:flutter/material.dart';

import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../widgets/common.dart';
import 'delivery_detail_screen.dart';
import 'production_screen.dart';

/// Traceability one step back (where a product or batch came from) and one step forward
/// (what was made from it, what is left and who it was dispatched to), with a one-tap recall
/// that holds the stock. Batches made here trace back through what went into them.
class TraceScreen extends StatefulWidget {
  const TraceScreen({super.key});
  @override
  State<TraceScreen> createState() => _TraceScreenState();
}

class _TraceScreenState extends State<TraceScreen> {
  final _search = TextEditingController();
  String _term = '';

  Future<void> _recall(List lotIds) async {
    final reason = await promptText(
      context,
      title: 'Recall: put ${lotIds.length} lot(s) on hold',
      label: 'Reason (e.g. supplier recall notice)',
      confirm: 'Hold stock',
    );
    if (reason == null || !mounted) return;
    final res = await context.run(
      () => context.m('stock:recall', {'lotIds': lotIds, 'reason': reason}),
    );
    if (res != null && mounted) {
      context.toast('${res['held']} lot(s) on hold. Corrective action raised');
    }
  }

  void _push(Widget w) =>
      Navigator.of(context).push(MaterialPageRoute(builder: (_) => w));

  static String _dispatched(List d) => d.isEmpty
      ? ''
      : '\nDispatched to ${d.map((d) => '${d['customer']} (${fmtNum(d['qty'])})').join(', ')}';

  Widget _results(List received, List made) {
    if (received.isEmpty && made.isEmpty) {
      return const EmptyState(icon: Icons.search_off, title: 'No matches');
    }
    final holdable = [
      for (final it in [...received, ...made])
        if (it['lot']?['status'] == 'available') it['lot']['_id'],
    ];
    final canRecall =
        context.watch<AuthService>().user!.isManager && holdable.isNotEmpty;
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
      children: [
        if (canRecall)
          Responsive(
            child: FilledButton.icon(
              onPressed: () => _recall(holdable),
              icon: const Icon(Icons.block),
              label: Text(
                'Recall: hold ${holdable.length} lot(s) still in stock',
              ),
            ),
          ),
        if (received.isNotEmpty && made.isNotEmpty)
          const Responsive(child: SectionTitle('Received')),
        for (final it in received) _receivedCard(it),
        if (made.isNotEmpty) const Responsive(child: SectionTitle('Made here')),
        for (final r in made) _madeCard(r),
      ],
    );
  }

  Widget _receivedCard(Map it) {
    final lot = it['lot'];
    final usedIn = (lot?['usedIn'] ?? []) as List;
    return Responsive(
      child: Card(
        child: ListTile(
          onTap: () => _push(DeliveryDetailScreen(id: it['deliveryId'])),
          title: Text(
            it['productName'],
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          subtitle: Text(
            '${it['supplierName']} · ${fmtDateTime(it['receivedAt'])}\n'
            'Batch ${it['batchCode'] ?? '-'} · ${fmtNum(it['quantity'])} ${it['unit']} · by ${it['receivedByName']}'
            '${lot == null ? '' : '\n${fmtNum(lot['qtyOnHand'])} ${it['unit']} still in stock'}'
            '${usedIn.isEmpty ? '' : '\n${usedIn.map((u) => u['reason']).join('; ')}'}'
            '${_dispatched((lot?['dispatched'] ?? []) as List)}',
          ),
          isThreeLine: true,
          trailing: it['voided'] == true
              ? const Pill('VOID')
              : lot?['status'] == 'hold'
              ? const Pill('ON HOLD', tone: Tone.bad)
              : it['accepted']
              ? const Pill('Accepted', tone: Tone.ok)
              : const Pill('Rejected', tone: Tone.bad),
        ),
      ),
    );
  }

  Widget _madeCard(Map r) {
    final lot = r['lot'];
    return Responsive(
      child: Card(
        child: ListTile(
          onTap: () => _push(ProductionRunScreen(id: r['_id'])),
          title: Text(
            r['productName'],
            style: const TextStyle(fontWeight: FontWeight.w700),
          ),
          subtitle: Text(
            'Made ${fmtDateTime(r['madeAt'])} by ${r['madeByName']}\n'
            'Batch ${r['batchCode']} · ${fmtNum(r['qty'])} ${r['unit']}\n'
            'From ${(r['inputs'] as List).map((i) => '${i['productName']} (${i['batchCode'] ?? '-'})').join(', ')}\n'
            '${fmtNum(lot['qtyOnHand'])} ${r['unit']} still in stock'
            '${_dispatched(lot['dispatched'] as List)}',
          ),
          isThreeLine: true,
          trailing: lot['status'] == 'hold'
              ? const Pill('ON HOLD', tone: Tone.bad)
              : const Pill('Made', tone: Tone.brand),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Trace & Recall')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Responsive(
              child: TextField(
                controller: _search,
                textInputAction: TextInputAction.search,
                onSubmitted: (v) => setState(() => _term = v.trim()),
                decoration: InputDecoration(
                  hintText: 'Batch code, product name or barcode',
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: IconButton(
                    icon: const Icon(Icons.arrow_forward),
                    onPressed: () =>
                        setState(() => _term = _search.text.trim()),
                  ),
                ),
              ),
            ),
          ),
          Expanded(
            child: _term.isEmpty
                ? const EmptyState(
                    icon: Icons.manage_search,
                    title: 'Find affected stock',
                    message: 'If a supplier issues a recall, search the batch code to see when it arrived, who received it and how much.',
                  )
                : QueryBuilder(
                    path: 'deliveries:trace',
                    args: {'search': _term},
                    builder: (context, received) => QueryBuilder(
                      path: 'production:trace',
                      args: {'search': _term},
                      builder: (context, made) =>
                          _results(received as List, made as List),
                    ),
                  ),
          ),
        ],
      ),
    );
  }
}
