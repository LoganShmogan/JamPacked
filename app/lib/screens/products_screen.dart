import 'package:flutter/material.dart';

import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/common.dart';

class ProductsScreen extends StatefulWidget {
  const ProductsScreen({super.key});
  @override
  State<ProductsScreen> createState() => _ProductsScreenState();
}

class _ProductsScreenState extends State<ProductsScreen> {
  String _filter = '';

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
    return Scaffold(
      appBar: AppBar(title: const Text('Products')),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Responsive(
              child: TextField(
                onChanged: (v) => setState(() => _filter = v.toLowerCase()),
                decoration: const InputDecoration(
                  hintText: 'Search products',
                  prefixIcon: Icon(Icons.search),
                ),
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
                          (p['name'] as String).toLowerCase().contains(_filter),
                    )
                    .toList();
                if (list.isEmpty) {
                  return const EmptyState(
                    icon: Icons.inventory_2,
                    title: 'No products yet',
                    message: 'Products are added automatically when you receive goods.',
                  );
                }
                return ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
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
                          onTap: context.watch<AuthService>().user!.isManager
                              ? () => _editPar(p)
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
                                      color: AppColors.orange,
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
