import 'package:flutter/material.dart';

import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/common.dart';
import 'production_screen.dart';

/// The catalogue: supplies you receive and products you make, each entered once.
class ProductsScreen extends StatefulWidget {
  const ProductsScreen({super.key, this.kind});

  /// Start filtered to 'supply' or 'made'; null shows everything.
  final String? kind;
  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  String _filter = '';
  late String? _kind = widget.kind;

  void _openRecipe(Map p) =>
      Navigator.of(context)
          .push(MaterialPageRoute(builder: (_) => RecipeScreen(product: p)));

  /// What a manager can change about a product.
  Future<void> _actions(Map p) async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      builder: (c) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.menu_book),
              title: Text(p['recipe'] == null ? 'Add a recipe' : 'Recipe'),
              subtitle: const Text('What goes into it, for production'),
              onTap: () => Navigator.pop(c, 'recipe'),
            ),
            ListTile(
              leading: const Icon(Icons.low_priority),
              title: const Text('Reorder level'),
              onTap: () => Navigator.pop(c, 'par'),
            ),
          ],
        ),
      ),
    );
    if (!mounted) return;
    if (choice == 'recipe') _openRecipe(p);
    if (choice == 'par') await _editPar(p);
  }

  /// A product you make: named once, then its recipe.
  Future<void> _newMade() async {
    final name = await promptText(
      context,
      title: 'New product you make',
      label: 'Name',
      confirm: 'Next',
    );
    if (name == null || name.isEmpty || !mounted) return;
    final id = await context.run(
      () => context.m('products:create', {
        'name': name,
        'kind': 'made',
        'storageType': 'chilled',
        'allergens': <String>[],
      }),
    );
    if (id != null && mounted) {
      _openRecipe({'_id': id, 'name': name});
    }
  }

  /// Par level: reorder when available stock falls below it.
  Future<void> _editPar(Map p) async {
    final par = TextEditingController(
      text: p['parLevel'] == null ? '' : fmtNum(p['parLevel']),
    );
    final reorder = TextEditingController(
      text: p['reorderQty'] == null ? '' : fmtNum(p['reorderQty']),
    );
    final ok = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text('Reorder ${p['name']}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: par,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'Par level',
                helperText: 'Warn when stock falls below this',
              ),
            ),
            TextField(
              controller: reorder,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(labelText: 'Usual order qty'),
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
    if (ok != true || !mounted) return;
    await context.run(
      () => context.m('products:update', {
        'id': p['_id'],
        'parLevel': double.tryParse(par.text),
        'reorderQty': double.tryParse(reorder.text),
      }),
      success: 'Saved',
    );
  }

  @override
  Widget build(BuildContext context) {
    final isManager = context.watch<AuthService>().user!.isManager;
    return Scaffold(
      appBar: AppBar(title: const Text('Products')),
      floatingActionButton: isManager
          ? FloatingActionButton.extended(
              onPressed: _newMade,
              icon: const Icon(Icons.add),
              label: const Text('Product you make'),
            )
          : null,
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
            child: Responsive(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    onChanged: (v) => setState(() => _filter = v.toLowerCase()),
                    decoration: const InputDecoration(
                      hintText: 'Search products',
                      prefixIcon: Icon(Icons.search),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 6,
                    children: [
                      for (final (k, label) in [
                        (null, 'All'),
                        ('supply', 'Supplies'),
                        ('made', 'Made here'),
                      ])
                        ChoiceChip(
                          label: Text(label),
                          selected: _kind == k,
                          onSelected: (_) => setState(() => _kind = k),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: QueryBuilder(
              path: 'products:list',
              builder: (context, data) {
                final list = (data as List)
                    .where(
                      (p) =>
                          (p['name'] as String).toLowerCase().contains(
                            _filter,
                          ) &&
                          (_kind == null || (p['kind'] ?? 'supply') == _kind),
                    )
                    .toList();
                if (list.isEmpty) {
                  return EmptyState(
                    icon: Icons.inventory_2,
                    title: 'No products yet',
                    message: _kind == 'made'
                        ? 'Add a product you make and give it a recipe, or make a one-off batch in Production.'
                        : _kind == 'supply'
                        ? 'Supplies are added automatically when you receive goods.'
                        : 'Products are added when you receive goods or make a batch.',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
                  itemCount: list.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 8),
                  itemBuilder: (context, i) {
                    final p = list[i];
                    final allergens = (p['allergens'] as List).cast<String>();
                    final nova = p['novaGroup'];
                    return Responsive(
                      child: Card(
                        clipBehavior: Clip.antiAlias,
                        child: InkWell(
                          onTap: isManager
                              ? () => _actions(p)
                              : p['recipe'] != null
                              ? () => _openRecipe(p)
                              : null,
                          child: Padding(
                            padding: const EdgeInsets.all(14),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(
                                      storageIcons[p['storageType']],
                                      color: AppColors.jam,
                                    ),
                                    const SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        p['name'],
                                        style: const TextStyle(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 15,
                                        ),
                                      ),
                                    ),
                                    if (p['kind'] == 'made')
                                      const Padding(
                                        padding: EdgeInsets.only(right: 6),
                                        child: Pill(
                                          'Made here',
                                          tone: Tone.brand,
                                        ),
                                      ),
                                    if (nova != null)
                                      Pill(
                                        'NOVA ${fmtNum(nova)}',
                                        tone: nova >= 4
                                            ? Tone.bad
                                            : nova >= 3
                                            ? Tone.warn
                                            : Tone.ok,
                                      ),
                                  ],
                                ),
                                if (p['barcode'] != null)
                                  Padding(
                                    padding: const EdgeInsets.only(
                                      top: 4,
                                      left: 34,
                                    ),
                                    child: Text(
                                      p['barcode'],
                                      style: const TextStyle(
                                        color: AppColors.muted,
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                if (allergens.isNotEmpty) ...[
                                  const SizedBox(height: 8),
                                  Wrap(
                                    spacing: 6,
                                    runSpacing: 6,
                                    children: [
                                      for (final a in allergens)
                                        Pill(
                                          a,
                                          tone: Tone.warn,
                                          icon: Icons.warning_amber,
                                        ),
                                    ],
                                  ),
                                ],
                                if (p['recipe'] != null)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 8),
                                    child: Text(
                                      'Recipe: ${(p['recipe']['ingredients'] as List).map((i) => i['productName']).join(', ')}',
                                      style: const TextStyle(
                                        color: AppColors.muted,
                                      ),
                                    ),
                                  ),
                                if (p['parLevel'] != null)
                                  Padding(
                                    padding: const EdgeInsets.only(top: 8),
                                    child: Text(
                                      'Par ${fmtNum(p['parLevel'])}'
                                      '${p['reorderQty'] != null ? ' · order ${fmtNum(p['reorderQty'])}' : ''}',
                                      style: const TextStyle(
                                        color: AppColors.muted,
                                      ),
                                    ),
                                  ),
                              ],
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
}
