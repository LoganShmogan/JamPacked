import 'package:flutter/material.dart';

import '../theme.dart';
import '../widgets/common.dart';
import 'scanner_screen.dart';
import 'suppliers_screen.dart';

/// Goods inwards: record a delivery and check each item on arrival.
class GoodsInFormScreen extends StatefulWidget {
  const GoodsInFormScreen({super.key});
  @override
  State<GoodsInFormScreen> createState() => _GoodsInFormScreenState();
}

class _GoodsInFormScreenState extends State<GoodsInFormScreen> {
  List _suppliers = [];
  Map<String, dynamic>? _settings;
  List _suggestions = [];
  String? _supplierId;
  final _invoice = TextEditingController();
  final _vehicleTemp = TextEditingController();
  final _notes = TextEditingController();
  bool _vehicleClean = true;
  final List<Map<String, dynamic>> _items = [];
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final suppliers = context.q('suppliers:list');
    final settings = context.q('settings:get');
    final r = await context.run(() async => (await suppliers, await settings));
    if (r == null || !mounted) return;
    setState(
      () => (_suppliers = r.$1, _settings = Map<String, dynamic>.from(r.$2)),
    );
  }

  Map<String, dynamic>? get _supplier => _suppliers
      .cast<Map?>()
      .firstWhere((s) => s!['_id'] == _supplierId, orElse: () => null)
      ?.cast<String, dynamic>();

  Future<void> _selectSupplier(String? id) async {
    setState(() => (_supplierId = id, _suggestions = []));
    if (id == null) return;
    final s = await context.run(
      () => context.q('deliveries:suggestionsForSupplier', {'supplierId': id}),
    );
    if (mounted && s != null) setState(() => _suggestions = s);
  }

  Future<void> _addSupplier() async {
    final id = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const SupplierFormScreen()),
    );
    if (id == null) return;
    await _load();
    await _selectSupplier(id);
  }

  Future<void> _editItem({Map<String, dynamic>? initial, int? index}) async {
    final item = await Navigator.of(context).push<Map<String, dynamic>>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) =>
            ItemEditorScreen(initial: initial, settings: _settings!),
      ),
    );
    if (item == null) return;
    setState(() => index == null ? _items.add(item) : _items[index] = item);
  }

  Future<void> _scanAndAdd() async {
    final code = await Navigator.of(context)
        .push<String>(MaterialPageRoute(builder: (_) => const ScannerScreen()));
    if (code == null || !mounted) return;
    final prefill = await _lookup(code);
    if (mounted) await _editItem(initial: prefill);
  }

  /// Our own catalogue first, then Open Food Facts.
  Future<Map<String, dynamic>> _lookup(String code) async {
    final base = <String, dynamic>{'barcode': code};
    try {
      final p = await context.q('products:byBarcode', {'barcode': code});
      if (p != null) {
        return {
          ...base,
          'productId': p['_id'],
          'productName': p['name'],
          'storageType': p['storageType'],
          'allergens': p['allergens'],
        };
      }
      if (!mounted) return base;
      context.toast('Looking up barcode…');
      final off = await context.convex.action('products:lookupBarcode', {
        'sessionToken': context.token,
        'barcode': code,
      });
      if (off != null && (off['name'] as String).isNotEmpty) {
        if (mounted) context.toast('Found: ${off['name']}');
        return {
          ...base,
          'productName': [
            off['brand'],
            off['name'],
          ].where((s) => s != null && s.isNotEmpty).join(' '),
          'storageType': off['storageType'],
          'allergens': (off['allergens'] as List)
              .where(allergenList.contains)
              .toList(),
        };
      }
      if (mounted) context.toast('Barcode not recognised — enter details');
    } catch (_) {}
    return base;
  }

  Future<void> _save() async {
    if (_supplierId == null) {
      return context.toast('Choose a supplier', error: true);
    }
    if (_items.isEmpty) {
      return context.toast('Add at least one item', error: true);
    }
    setState(() => _saving = true);
    final id = await context.run(
      () => context.m('deliveries:create', {
        'supplierId': _supplierId,
        'invoiceNumber': _invoice.text.trim().isEmpty
            ? null
            : _invoice.text.trim(),
        'vehicleClean': _vehicleClean,
        'vehicleTempC': double.tryParse(_vehicleTemp.text),
        'notes': _notes.text.trim().isEmpty ? null : _notes.text.trim(),
        'items': _items,
      }),
      success: 'Delivery recorded',
    );
    if (!mounted) return;
    setState(() => _saving = false);
    if (id != null) Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    if (_settings == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Receive goods')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    final supplier = _supplier;
    return Scaffold(
      appBar: AppBar(title: const Text('Receive goods')),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton.icon(
            onPressed: _saving ? null : _save,
            icon: const Icon(Icons.check),
            label: Text(
              _saving ? 'Saving…' : 'Save delivery (${_items.length} items)',
            ),
          ),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Responsive(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const SectionTitle('Supplier'),
                Row(
                  children: [
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        initialValue: _supplierId,
                        isExpanded: true,
                        decoration: const InputDecoration(
                          labelText: 'Supplier',
                          prefixIcon: Icon(Icons.storefront),
                        ),
                        items: [
                          for (final s in _suppliers)
                            DropdownMenuItem(
                              value: s['_id'] as String,
                              child: Text(
                                '${s['name']}${s['approved'] ? '' : '  (not approved)'}',
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                        ],
                        onChanged: _selectSupplier,
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton.filledTonal(
                      onPressed: _addSupplier,
                      icon: const Icon(Icons.add),
                      tooltip: 'New supplier',
                    ),
                  ],
                ),
                if (supplier != null && supplier['approved'] != true)
                  const Padding(
                    padding: EdgeInsets.only(top: 8),
                    child: Pill(
                      'Not on approved supplier list — a corrective action will be raised',
                      tone: Tone.warn,
                      icon: Icons.warning_amber,
                    ),
                  ),
                const SizedBox(height: 12),
                TextField(
                  controller: _invoice,
                  decoration: const InputDecoration(
                    labelText: 'Invoice / docket number',
                    prefixIcon: Icon(Icons.receipt_long),
                  ),
                ),
                const SizedBox(height: 4),
                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Delivery vehicle clean & suitable'),
                  value: _vehicleClean,
                  onChanged: (v) => setState(() => _vehicleClean = v),
                ),
                TextField(
                  controller: _vehicleTemp,
                  keyboardType: const TextInputType.numberWithOptions(
                    decimal: true,
                    signed: true,
                  ),
                  decoration: const InputDecoration(
                    labelText: 'Vehicle temperature °C (optional)',
                    prefixIcon: Icon(Icons.thermostat),
                  ),
                ),
                SectionTitle('Items (${_items.length})'),
                for (var i = 0; i < _items.length; i++) ...[
                  _DraftItemTile(
                    item: _items[i],
                    onTap: () => _editItem(initial: _items[i], index: i),
                    onDelete: () => setState(() => _items.removeAt(i)),
                  ),
                  const SizedBox(height: 8),
                ],
                Row(
                  children: [
                    Expanded(
                      child: FilledButton.tonalIcon(
                        onPressed: _scanAndAdd,
                        icon: const Icon(Icons.qr_code_scanner),
                        label: const Text('Scan'),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _editItem(),
                        icon: const Icon(Icons.add),
                        label: const Text('Add item'),
                      ),
                    ),
                  ],
                ),
                if (_suggestions.isNotEmpty) ...[
                  const SectionTitle('Usually from this supplier — tap to add'),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final s in _suggestions)
                        ActionChip(
                          avatar: Icon(
                            storageIcons[s['storageType']],
                            size: 18,
                            color: AppColors.orange,
                          ),
                          label: Text(s['productName']),
                          onPressed: () =>
                              _editItem(initial: Map<String, dynamic>.from(s)),
                        ),
                    ],
                  ),
                ],
                const SectionTitle('Notes'),
                TextField(
                  controller: _notes,
                  maxLines: 3,
                  decoration: const InputDecoration(
                    hintText: 'Anything unusual about this delivery',
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DraftItemTile extends StatelessWidget {
  const _DraftItemTile({
    required this.item,
    required this.onTap,
    required this.onDelete,
  });
  final Map<String, dynamic> item;
  final VoidCallback onTap, onDelete;
  @override
  Widget build(BuildContext context) => Card(
    child: ListTile(
      onTap: onTap,
      leading: Icon(storageIcons[item['storageType']], color: AppColors.orange),
      title: Text(
        item['productName'],
        style: const TextStyle(fontWeight: FontWeight.w700),
      ),
      subtitle: Text(
        [
          '${fmtNum(item['quantity'])} ${item['unit']}',
          if (item['temperatureC'] != null) '${fmtNum(item['temperatureC'])}°C',
          if (item['batchCode'] != null) 'Batch ${item['batchCode']}',
        ].join(' · '),
      ),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          item['accepted']
              ? const Pill('OK', tone: Tone.ok)
              : const Pill('Reject', tone: Tone.bad),
          IconButton(
            icon: const Icon(Icons.delete_outline),
            onPressed: onDelete,
          ),
        ],
      ),
    ),
  );
}

/// Full-screen editor for one delivered line item with live compliance checks.
class ItemEditorScreen extends StatefulWidget {
  const ItemEditorScreen({super.key, this.initial, required this.settings});
  final Map<String, dynamic>? initial;
  final Map<String, dynamic> settings;
  @override
  State<ItemEditorScreen> createState() => _ItemEditorScreenState();
}

class _ItemEditorScreenState extends State<ItemEditorScreen> {
  final _form = GlobalKey<FormState>();
  late final Map<String, dynamic> i = {
    'productName': '',
    'quantity': 1,
    'unit': 'ea',
    'storageType': 'chilled',
    'packagingOk': true,
    'labelOk': true,
    'allergens': <String>[],
    'accepted': true,
    ...?widget.initial,
  };
  late final _name = TextEditingController(text: i['productName']);
  late final _batch = TextEditingController(text: i['batchCode']);
  late final _qty = TextEditingController(text: fmtNum(i['quantity']));
  late final _temp = TextEditingController(
    text: i['temperatureC'] == null ? '' : fmtNum(i['temperatureC']),
  );
  late final _reason = TextEditingController(text: i['rejectionReason']);
  late List<String> _allergens = List<String>.from(i['allergens']);

  static const units = [
    'ea',
    'kg',
    'g',
    'L',
    'mL',
    'case',
    'box',
    'tray',
    'bag',
  ];

  /// Mirrors server-side rules in convex/lib/settings.ts.
  bool? get _tempOk {
    final t = double.tryParse(_temp.text);
    final s = widget.settings;
    return switch (i['storageType']) {
      'ambient' => null,
      _ when t == null => null,
      'chilled' => t <= s['chilledMaxC'],
      'frozen' => t <= s['frozenMaxC'],
      _ => t >= s['hotMinC'],
    };
  }

  String get _limitText => switch (i['storageType']) {
    'chilled' => 'Must be ≤ ${fmtNum(widget.settings['chilledMaxC'])}°C',
    'frozen' =>
      'Must be frozen hard, ≤ ${fmtNum(widget.settings['frozenMaxC'])}°C',
    'hot' => 'Must be ≥ ${fmtNum(widget.settings['hotMinC'])}°C',
    _ => 'No temperature check needed',
  };

  bool get _useByPassed =>
      i['useBy'] != null && fromMs(i['useBy']).isBefore(DateTime.now());

  Future<void> _pickDate(String key) async {
    final now = DateTime.now();
    final d = await showDatePicker(
      context: context,
      firstDate: now.subtract(const Duration(days: 365)),
      lastDate: now.add(const Duration(days: 365 * 5)),
      initialDate: i[key] == null
          ? now.add(const Duration(days: 3))
          : fromMs(i[key]),
    );
    if (d != null) {
      setState(
        () => i[key] = DateTime(
          d.year,
          d.month,
          d.day,
          23,
          59,
        ).millisecondsSinceEpoch,
      );
    }
  }

  void _save() {
    if (!_form.currentState!.validate()) return;
    final out = {
      ...i,
      'productName': _name.text.trim(),
      'batchCode': _batch.text.trim().isEmpty ? null : _batch.text.trim(),
      'quantity': double.parse(_qty.text),
      'temperatureC': i['storageType'] == 'ambient'
          ? null
          : double.tryParse(_temp.text),
      'allergens': _allergens,
      'rejectionReason': i['accepted'] ? null : _reason.text.trim(),
    }..removeWhere((k, v) => v == null);
    Navigator.pop(context, out);
  }

  @override
  Widget build(BuildContext context) {
    final tempOk = _tempOk;
    final problems = [
      if (tempOk == false) 'Temperature out of range',
      if (_useByPassed) 'Use-by date has passed',
      if (i['packagingOk'] == false) 'Packaging damaged',
      if (i['labelOk'] == false) 'Label missing or incorrect',
    ];
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.initial?['productName'] != null ? 'Check item' : 'Add item',
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(onPressed: _save, child: const Text('Done')),
        ),
      ),
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
                    textCapitalization: TextCapitalization.sentences,
                    decoration: const InputDecoration(labelText: 'Product'),
                    validator: (v) => v!.trim().isEmpty ? 'Required' : null,
                  ),
                  if (i['barcode'] != null)
                    Padding(
                      padding: const EdgeInsets.only(top: 6, left: 4),
                      child: Text(
                        'Barcode ${i['barcode']}',
                        style: const TextStyle(color: AppColors.muted),
                      ),
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
                        child: DropdownButtonFormField<String>(
                          initialValue: units.contains(i['unit'])
                              ? i['unit']
                              : 'ea',
                          decoration: const InputDecoration(labelText: 'Unit'),
                          items: [
                            for (final u in units)
                              DropdownMenuItem(value: u, child: Text(u)),
                          ],
                          onChanged: (v) => i['unit'] = v,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _batch,
                    decoration: const InputDecoration(
                      labelText: 'Batch / lot code',
                      helperText: 'Needed for traceability & recalls',
                    ),
                  ),
                  const SectionTitle('Storage & temperature'),
                  SegmentedButton<String>(
                    showSelectedIcon: false,
                    segments: [
                      for (final e in storageLabels.entries)
                        ButtonSegment(
                          value: e.key,
                          label: Text(e.value.split(' ').first),
                          icon: Icon(storageIcons[e.key]),
                        ),
                    ],
                    selected: {i['storageType']},
                    onSelectionChanged: (s) =>
                        setState(() => i['storageType'] = s.first),
                  ),
                  const SizedBox(height: 12),
                  if (i['storageType'] != 'ambient')
                    TextFormField(
                      controller: _temp,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                        signed: true,
                      ),
                      onChanged: (_) => setState(() {}),
                      decoration: InputDecoration(
                        labelText: 'Probe temperature °C',
                        helperText: _limitText,
                        prefixIcon: const Icon(Icons.thermostat),
                        suffixIcon: tempOk == null
                            ? null
                            : Icon(
                                tempOk ? Icons.check_circle : Icons.error,
                                color: tempOk ? AppColors.ok : AppColors.bad,
                              ),
                      ),
                      validator: (v) => double.tryParse(v!) == null
                          ? 'Temperature is required for ${i['storageType']} food'
                          : null,
                    ),
                  const SectionTitle('Date marks'),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _pickDate('useBy'),
                          icon: const Icon(Icons.event),
                          label: Text(
                            i['useBy'] == null
                                ? 'Use by'
                                : 'Use by ${fmtDate(i['useBy'])}',
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () => _pickDate('bestBefore'),
                          icon: const Icon(Icons.event_available),
                          label: Text(
                            i['bestBefore'] == null
                                ? 'Best before'
                                : 'BB ${fmtDate(i['bestBefore'])}',
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SectionTitle('Condition'),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Packaging intact, not damaged'),
                    value: i['packagingOk'],
                    onChanged: (v) => setState(() => i['packagingOk'] = v),
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text(
                      'Labelled correctly (name, date mark, allergens)',
                    ),
                    value: i['labelOk'],
                    onChanged: (v) => setState(() => i['labelOk'] = v),
                  ),
                  const SectionTitle('Allergens present'),
                  Wrap(
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final a in allergenList)
                        FilterChip(
                          label: Text(a),
                          selected: _allergens.contains(a),
                          selectedColor: AppColors.warnLight,
                          onSelected: (on) => setState(
                            () => _allergens = on
                                ? [..._allergens, a]
                                : (_allergens..remove(a)),
                          ),
                        ),
                    ],
                  ),
                  const SectionTitle('Decision'),
                  if (problems.isNotEmpty && i['accepted'] == true)
                    Card(
                      color: AppColors.badLight,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(
                          '⚠ ${problems.join(', ')}. You should reject this item.',
                          style: const TextStyle(
                            color: AppColors.bad,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  const SizedBox(height: 8),
                  SegmentedButton<bool>(
                    segments: const [
                      ButtonSegment(
                        value: true,
                        label: Text('Accept'),
                        icon: Icon(Icons.check),
                      ),
                      ButtonSegment(
                        value: false,
                        label: Text('Reject'),
                        icon: Icon(Icons.close),
                      ),
                    ],
                    selected: {i['accepted']},
                    onSelectionChanged: (s) => setState(() {
                      i['accepted'] = s.first;
                      if (!s.first &&
                          _reason.text.isEmpty &&
                          problems.isNotEmpty) {
                        _reason.text = problems.join(', ');
                      }
                    }),
                  ),
                  if (i['accepted'] == false) ...[
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _reason,
                      decoration: const InputDecoration(
                        labelText: 'Reason for rejection',
                      ),
                      validator: (v) => v!.trim().isEmpty ? 'Required' : null,
                    ),
                  ],
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
