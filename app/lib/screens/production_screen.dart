import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/common.dart';
import '../widgets/product_picker.dart';
import 'lot_detail_screen.dart';
import 'products_screen.dart';
import 'scanner_screen.dart';
import 'stock_screen.dart';

/// Production: batches made here from stock on hand, newest first.
class ProductionScreen extends StatelessWidget {
  const ProductionScreen({super.key});

  @override
  Widget build(BuildContext context) {
    void push(Widget w) =>
        Navigator.of(context).push(MaterialPageRoute(builder: (_) => w));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Production'),
        actions: [
          TextButton.icon(
            onPressed: () => push(const ProductsScreen(kind: 'made')),
            icon: const Icon(Icons.menu_book),
            label: const Text('Recipes'),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => push(const ProductionFormScreen()),
        icon: const Icon(Icons.add),
        label: const Text('Make a batch'),
      ),
      body: QueryBuilder(
        path: 'production:list',
        builder: (context, data) {
          final list = data as List;
          if (list.isEmpty) {
            return const EmptyState(
              icon: Icons.soup_kitchen,
              title: 'Nothing made yet',
              message:
                  'Record a batch and the ingredients come out of stock, the batch goes in, '
                  'and it traces back to every supplier batch that went into it.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            itemCount: list.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final r = list[i];
              return Responsive(
                child: Card(
                  child: ListTile(
                    leading: const Icon(
                      Icons.soup_kitchen,
                      color: AppColors.jam,
                    ),
                    title: Text(
                      '${r['productName']} · ${fmtNum(r['qty'])} ${r['unit']}',
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      'Batch ${r['batchCode']} · ${fmtDateTime(r['madeAt'])} · by ${r['madeByName']}',
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => push(ProductionRunScreen(id: r['_id'])),
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

/// One batch: what went in (back to the supplier batches), and where it is now.
class ProductionRunScreen extends StatelessWidget {
  const ProductionRunScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Batch')),
      body: QueryBuilder(
        path: 'production:get',
        args: {'id': id},
        builder: (context, data) {
          if (data == null) {
            return const EmptyState(icon: Icons.search_off, title: 'Not found');
          }
          final r = data['run'];
          final lot = data['lot'];
          final allergens = (r['allergens'] as List).cast<String>();
          final dispatched = lot['dispatched'] as List;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Responsive(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      r['productName'],
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    InfoRow('Batch', r['batchCode']),
                    InfoRow('Made', '${fmtNum(r['qty'])} ${r['unit']}'),
                    InfoRow(
                      'When',
                      '${fmtDateTime(r['madeAt'])} by ${r['madeByName']}',
                    ),
                    if (r['useBy'] != null)
                      InfoRow('Use by', fmtDate(r['useBy'])),
                    if (r['bestBefore'] != null)
                      InfoRow('Best before', fmtDate(r['bestBefore'])),
                    InfoRow('Recipe', r['fromRecipe'] ? 'Yes' : 'One-off'),
                    if (r['notes'] != null) InfoRow('Notes', r['notes']),
                    if (allergens.isNotEmpty) ...[
                      const SectionTitle('Contains'),
                      Wrap(
                        spacing: 6,
                        runSpacing: 6,
                        children: [
                          for (final a in allergens)
                            Pill(a, tone: Tone.warn, icon: Icons.warning_amber),
                        ],
                      ),
                    ],
                    const SectionTitle('What went in'),
                    for (final i in r['inputs'])
                      Card(
                        child: ListTile(
                          title: Text(
                            '${i['productName']} · ${fmtNum(i['qty'])} ${i['unit']}',
                          ),
                          subtitle: Text(
                            [
                              'Batch ${i['batchCode'] ?? '-'}',
                              ?i['supplierName'],
                            ].join(' · '),
                          ),
                          trailing: const Icon(Icons.chevron_right),
                          onTap: () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => LotDetailScreen(id: i['lotId']),
                            ),
                          ),
                        ),
                      ),
                    const SectionTitle('Where it is now'),
                    Card(
                      child: ListTile(
                        title: Text(
                          '${fmtNum(lot['qtyOnHand'])} ${r['unit']} in stock',
                        ),
                        subtitle: dispatched.isEmpty
                            ? null
                            : Text(
                                'Dispatched to ${dispatched.map((d) => '${d['customer']} (${fmtNum(d['qty'])})').join(', ')}',
                              ),
                        trailing: lot['status'] == 'hold'
                            ? const Pill('ON HOLD', tone: Tone.bad)
                            : const Icon(Icons.chevron_right),
                        onTap: () => Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => LotDetailScreen(id: lot['_id']),
                          ),
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

/// One thing that went into a batch: the lot it came from and how much.
class _Input {
  _Input(this.lot, num? qty)
    : qty = TextEditingController(text: qty == null ? '' : fmtNum(qty));
  final Map lot;
  final TextEditingController qty;
}

/// Make a batch: pick what you're making (its recipe fills in the ingredients, first expiring
/// first) or make something one-off from whatever stock you pick.
class ProductionFormScreen extends StatefulWidget {
  const ProductionFormScreen({super.key});
  @override
  State<ProductionFormScreen> createState() => _ProductionFormScreenState();
}

class _ProductionFormScreenState extends State<ProductionFormScreen> {
  final _form = GlobalKey<FormState>();
  Map<String, dynamic>? _product;
  final _qty = TextEditingController();
  final _unit = TextEditingController();
  final _batch = TextEditingController();
  final _notes = TextEditingController();
  final List<_Input> _inputs = [];
  List<String> _short = [];
  bool _fromRecipe = false;
  int? _useBy;
  String _storage = 'chilled';
  String? _locationId;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    context.q('production:batchCode').then((c) {
      if (mounted && _batch.text.isEmpty) _batch.text = c;
    }, onError: (_) {});
  }

  Future<void> _pickProduct() async {
    final p = await pickProduct(
      context,
      title: 'What are you making?',
      allowNew: true,
    );
    if (p == null || !mounted) return;
    setState(() {
      _product = p;
      _unit.text = p['unit'] ?? _unit.text;
      _storage = p['storageType'] ?? _storage;
      _fromRecipe = p['recipe'] != null;
      _inputs.clear();
      _short = [];
      _useBy = null;
      if (_fromRecipe) _qty.text = fmtNum(p['recipe']['yieldQty']);
    });
    if (_fromRecipe) await _plan();
  }

  /// Fills the ingredients in from the recipe for the quantity being made.
  Future<void> _plan() async {
    final qty = double.tryParse(_qty.text) ?? 0;
    if (qty <= 0) return;
    final plan = await context.run(
      () => context.q('production:plan', {
        'productId': _product!['_id'],
        'qty': qty,
      }),
    );
    if (plan == null || !mounted) return;
    setState(() {
      _inputs
        ..clear()
        ..addAll([
          for (final ing in plan['ingredients'])
            for (final pick in ing['picks'])
              _Input({
                ...pick,
                '_id': pick['lotId'],
                'productName': ing['productName'],
                'unit': ing['unit'],
              }, pick['qty']),
        ]);
      _short = [
        for (final ing in plan['ingredients'])
          if (ing['short'] > 0)
            '${ing['productName']}: ${fmtNum(ing['short'])} ${ing['unit']} short',
      ];
      _useBy = plan['useBy'];
    });
  }

  Future<void> _addInput() async {
    final lot = await Navigator.of(context).push<Map>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => const LotPickerScreen(),
      ),
    );
    if (lot != null) setState(() => _inputs.add(_Input(lot, null)));
  }

  Future<void> _pickUseBy() async {
    final now = DateTime.now();
    final d = await showDatePicker(
      context: context,
      firstDate: now.subtract(const Duration(days: 1)),
      lastDate: now.add(const Duration(days: 365 * 3)),
      initialDate: _useBy == null
          ? now.add(const Duration(days: 3))
          : fromMs(_useBy!),
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
  }

  Future<void> _save() async {
    if (_product == null) {
      context.toast('Pick what you made', error: true);
      return;
    }
    if (!_form.currentState!.validate()) return;
    if (_inputs.isEmpty) {
      context.toast('Add what went into it', error: true);
      return;
    }
    setState(() => _saving = true);
    final id = await context.run(
      () => context.m('production:create', {
        if (_product!['_id'] != null)
          'productId': _product!['_id']
        else ...{
          'productName': _product!['name'],
          'storageType': _storage,
        },
        'qty': double.parse(_qty.text),
        'unit': _unit.text.trim(),
        'batchCode': _batch.text.trim(),
        'useBy': ?_useBy,
        'locationId': ?_locationId,
        'fromRecipe': _fromRecipe,
        if (_notes.text.trim().isNotEmpty) 'notes': _notes.text.trim(),
        'inputs': [
          for (final i in _inputs)
            {'lotId': i.lot['_id'], 'qty': double.parse(i.qty.text)},
        ],
      }),
      success: 'Batch ${_batch.text.trim()} made',
    );
    if (!mounted) return;
    setState(() => _saving = false);
    if (id != null) Navigator.pop(context, id);
  }

  String? _positive(String? v) =>
      (double.tryParse(v!) ?? 0) > 0 ? null : 'Enter a number';

  @override
  Widget build(BuildContext context) {
    final p = _product;
    return Scaffold(
      appBar: AppBar(title: const Text('Make a batch')),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(
            onPressed: _saving ? null : _save,
            child: const Text('Save batch'),
          ),
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
                  Card(
                    child: ListTile(
                      leading: const Icon(
                        Icons.soup_kitchen,
                        color: AppColors.jam,
                      ),
                      title: Text(
                        p == null ? 'What are you making?' : p['name'],
                        style: const TextStyle(fontWeight: FontWeight.w700),
                      ),
                      subtitle: Text(
                        p == null
                            ? 'Search or scan your catalogue, or name something new'
                            : _fromRecipe
                            ? 'From its recipe'
                            : p['_id'] == null
                            ? 'New product: one-off batch'
                            : 'One-off batch: pick what went in',
                      ),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: _pickProduct,
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
                            labelText: 'How much you made',
                          ),
                          validator: _positive,
                          onFieldSubmitted: (_) => _fromRecipe ? _plan() : null,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _unit,
                          decoration: const InputDecoration(
                            labelText: 'Unit',
                            hintText: 'ea, kg, tray...',
                          ),
                          validator: (v) =>
                              v!.trim().isEmpty ? 'Required' : null,
                        ),
                      ),
                    ],
                  ),
                  if (_fromRecipe)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton.icon(
                        onPressed: _plan,
                        icon: const Icon(Icons.refresh),
                        label: const Text('Work out ingredients for this'),
                      ),
                    ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _batch,
                    decoration: const InputDecoration(
                      labelText: 'Batch code',
                      helperText: 'Filled in for you; put it on the label',
                    ),
                  ),
                  if (p != null && p['_id'] == null) ...[
                    const SectionTitle('Storage'),
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
                      selected: {_storage},
                      onSelectionChanged: (s) =>
                          setState(() => _storage = s.first),
                    ),
                  ],
                  const SizedBox(height: 12),
                  OutlinedButton.icon(
                    onPressed: _pickUseBy,
                    icon: const Icon(Icons.event),
                    label: Text(
                      _useBy == null ? 'Use by' : 'Use by ${fmtDate(_useBy)}',
                    ),
                  ),
                  const SizedBox(height: 12),
                  LocationPicker(
                    label: 'Put away to',
                    value: _locationId,
                    onChanged: (v) => _locationId = v,
                  ),
                  SectionTitle(
                    'What went in',
                    trailing: TextButton.icon(
                      onPressed: _addInput,
                      icon: const Icon(Icons.add),
                      label: const Text('Add from stock'),
                    ),
                  ),
                  for (final s in _short)
                    Card(
                      color: AppColors.badLight,
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Text(
                          '⚠ $s in stock',
                          style: const TextStyle(
                            color: AppColors.bad,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    ),
                  if (_inputs.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8),
                      child: Text(
                        'Nothing yet. Add the stock you used.',
                        style: TextStyle(color: AppColors.muted),
                      ),
                    ),
                  for (final (n, i) in _inputs.indexed)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(14, 8, 4, 8),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    i.lot['productName'],
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                  Text(
                                    'Batch ${i.lot['batchCode'] ?? '-'} · ${fmtNum(i.lot['qtyOnHand'])} on hand',
                                    style: const TextStyle(
                                      color: AppColors.muted,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            SizedBox(
                              width: 110,
                              child: TextFormField(
                                controller: i.qty,
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                      decimal: true,
                                    ),
                                decoration: InputDecoration(
                                  labelText: 'Used',
                                  suffixText: i.lot['unit'],
                                ),
                                validator: _positive,
                              ),
                            ),
                            IconButton(
                              tooltip: 'Remove',
                              onPressed: () =>
                                  setState(() => _inputs.removeAt(n)),
                              icon: const Icon(Icons.close),
                            ),
                          ],
                        ),
                      ),
                    ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _notes,
                    decoration: const InputDecoration(labelText: 'Notes'),
                  ),
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

/// Picks a lot of stock that can go into food now: searched by product, batch or barcode, or scanned.
class LotPickerScreen extends StatefulWidget {
  const LotPickerScreen({super.key});
  @override
  State<LotPickerScreen> createState() => _LotPickerScreenState();
}

class _LotPickerScreenState extends State<LotPickerScreen> {
  final _search = TextEditingController();

  Future<void> _scan() async {
    final code = await Navigator.of(context)
        .push<String>(MaterialPageRoute(builder: (_) => const ScannerScreen()));
    if (code != null) setState(() => _search.text = code);
  }

  @override
  Widget build(BuildContext context) {
    final term = _search.text.trim().toLowerCase();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Add from stock'),
        actions: [
          IconButton(
            tooltip: 'Scan barcode',
            onPressed: _scan,
            icon: const Icon(Icons.qr_code_scanner),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Responsive(
              child: TextField(
                controller: _search,
                autofocus: true,
                onChanged: (_) => setState(() {}),
                decoration: const InputDecoration(
                  hintText: 'Product, batch code or barcode',
                  prefixIcon: Icon(Icons.search),
                ),
              ),
            ),
          ),
          Expanded(
            child: QueryBuilder(
              path: 'stock:onHand',
              refreshable: false,
              builder: (context, data) {
                final list = [
                  for (final l in data as List)
                    if (l['status'] == 'available' &&
                        l['expired'] != true &&
                        [
                          l['productName'],
                          l['batchCode'],
                          l['barcode'],
                        ].any((s) => (s ?? '').toLowerCase().contains(term)))
                      l,
                ];
                if (list.isEmpty) {
                  return const EmptyState(
                    icon: Icons.search_off,
                    title: 'No stock to use',
                    message: 'Held and out-of-date stock can\'t go into food.',
                  );
                }
                return ListView(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  children: [
                    for (final l in list)
                      Responsive(
                        child: Card(
                          child: ListTile(
                            title: Text(
                              l['productName'],
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            subtitle: Text(
                              [
                                'Batch ${l['batchCode'] ?? '-'}',
                                '${fmtNum(l['qtyOnHand'])} ${l['unit']}',
                                if (l['expiresAt'] != null)
                                  'use ${fmtDate(l['expiresAt'])}',
                                ?l['locationName'],
                              ].join(' · '),
                            ),
                            onTap: () => Navigator.pop(context, l),
                          ),
                        ),
                      ),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// One ingredient line in a recipe being edited.
class _Ingredient {
  _Ingredient(this.productId, this.productName, num? qty, String? unit)
    : qty = TextEditingController(text: qty == null ? '' : fmtNum(qty)),
      unit = TextEditingController(text: unit ?? '');
  final String productId, productName;
  final TextEditingController qty, unit;
}

/// A product's recipe, entered once: what one batch makes and what goes into it.
class RecipeScreen extends StatefulWidget {
  const RecipeScreen({super.key, required this.product});
  final Map product;
  @override
  State<RecipeScreen> createState() => _RecipeScreenState();
}

class _RecipeScreenState extends State<RecipeScreen> {
  final _form = GlobalKey<FormState>();
  late final Map? _r = widget.product['recipe'];
  late final _yield = TextEditingController(text: fmtNum(_r?['yieldQty'] ?? 1));
  late final _unit = TextEditingController(text: widget.product['unit']);
  late final _shelf = TextEditingController(
    text: _r?['shelfLifeDays'] == null ? '' : fmtNum(_r!['shelfLifeDays']),
  );
  late final List<_Ingredient> _ingredients = [
    for (final i in _r?['ingredients'] ?? [])
      _Ingredient(i['productId'], i['productName'], i['qty'], i['unit']),
  ];

  Future<void> _add() async {
    final p = await pickProduct(context, title: 'Add an ingredient');
    if (p == null) return;
    setState(
      () => _ingredients.add(_Ingredient(p['_id'], p['name'], null, p['unit'])),
    );
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    if (_ingredients.isEmpty) {
      context.toast('Add at least one ingredient', error: true);
      return;
    }
    final ok = await context.run(
      () => context
          .m('products:update', {
            'id': widget.product['_id'],
            'kind': 'made',
            'unit': _unit.text.trim(),
            'recipe': {
              'yieldQty': double.parse(_yield.text),
              if (_shelf.text.trim().isNotEmpty)
                'shelfLifeDays': double.parse(_shelf.text),
              'ingredients': [
                for (final i in _ingredients)
                  {
                    'productId': i.productId,
                    'productName': i.productName,
                    'qty': double.parse(i.qty.text),
                    'unit': i.unit.text.trim(),
                  },
              ],
            },
          })
          .then((_) => true),
      success: 'Recipe saved',
    );
    if (ok == true && mounted) Navigator.pop(context, true);
  }

  String? _positive(String? v) =>
      (double.tryParse(v!) ?? 0) > 0 ? null : 'Enter a number';
  String? _required(String? v) => v!.trim().isEmpty ? 'Required' : null;

  @override
  Widget build(BuildContext context) {
    final canEdit = context.watch<AuthService>().user!.isManager;
    return Scaffold(
      appBar: AppBar(title: Text('Recipe: ${widget.product['name']}')),
      bottomNavigationBar: canEdit
          ? SafeArea(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                child: FilledButton(
                  onPressed: _save,
                  child: const Text('Save recipe'),
                ),
              ),
            )
          : null,
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Responsive(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextFormField(
                          controller: _yield,
                          keyboardType: const TextInputType.numberWithOptions(
                            decimal: true,
                          ),
                          decoration: const InputDecoration(
                            labelText: 'One batch makes',
                          ),
                          validator: _positive,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextFormField(
                          controller: _unit,
                          decoration: const InputDecoration(
                            labelText: 'Unit',
                            hintText: 'ea, kg, tray...',
                          ),
                          validator: _required,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: _shelf,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Shelf life (days)',
                      helperText: 'Sets the use-by on each batch',
                    ),
                  ),
                  SectionTitle(
                    'Ingredients',
                    trailing: canEdit
                        ? TextButton.icon(
                            onPressed: _add,
                            icon: const Icon(Icons.add),
                            label: const Text('Add'),
                          )
                        : null,
                  ),
                  if (_ingredients.isEmpty)
                    const Text(
                      'Pick ingredients from your catalogue: supplies you receive or things you make.',
                      style: TextStyle(color: AppColors.muted),
                    ),
                  for (final (n, i) in _ingredients.indexed)
                    Card(
                      child: Padding(
                        padding: const EdgeInsets.fromLTRB(14, 8, 4, 8),
                        child: Row(
                          children: [
                            Expanded(
                              child: Text(
                                i.productName,
                                style: const TextStyle(
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                            SizedBox(
                              width: 80,
                              child: TextFormField(
                                controller: i.qty,
                                keyboardType:
                                    const TextInputType.numberWithOptions(
                                      decimal: true,
                                    ),
                                decoration: const InputDecoration(
                                  labelText: 'Qty',
                                ),
                                validator: _positive,
                              ),
                            ),
                            const SizedBox(width: 8),
                            SizedBox(
                              width: 70,
                              child: TextFormField(
                                controller: i.unit,
                                decoration: const InputDecoration(
                                  labelText: 'Unit',
                                ),
                                validator: _required,
                              ),
                            ),
                            if (canEdit)
                              IconButton(
                                tooltip: 'Remove',
                                onPressed: () =>
                                    setState(() => _ingredients.removeAt(n)),
                                icon: const Icon(Icons.close),
                              ),
                          ],
                        ),
                      ),
                    ),
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
