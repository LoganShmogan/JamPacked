import 'package:flutter/material.dart';

import '../screens/scanner_screen.dart';
import '../theme.dart';
import 'common.dart';

/// Opens the catalogue to pick a product by searching or scanning its barcode, so anything
/// entered once never has to be typed again. Returns the product, or with [allowNew] a
/// `{'name': ...}` map (no `_id`) for something not in the catalogue yet.
Future<Map<String, dynamic>?> pickProduct(
  BuildContext context, {
  String title = 'Pick a product',
  bool allowNew = false,
}) => Navigator.of(context).push<Map<String, dynamic>>(
  MaterialPageRoute(
    fullscreenDialog: true,
    builder: (_) => ProductPickerScreen(title: title, allowNew: allowNew),
  ),
);

class ProductPickerScreen extends StatefulWidget {
  const ProductPickerScreen({
    super.key,
    required this.title,
    this.allowNew = false,
  });
  final String title;
  final bool allowNew;
  @override
  State<ProductPickerScreen> createState() => _ProductPickerScreenState();
}

class _ProductPickerScreenState extends State<ProductPickerScreen> {
  String _filter = '';

  Future<void> _scan() async {
    final code = await Navigator.of(context)
        .push<String>(MaterialPageRoute(builder: (_) => const ScannerScreen()));
    if (code == null || !mounted) return;
    final p = await context.run(
      () => context.q('products:byBarcode', {'barcode': code}),
    );
    if (!mounted) return;
    if (p == null) {
      context.toast('Barcode $code is not in your catalogue yet');
      return;
    }
    Navigator.pop(context, Map<String, dynamic>.from(p));
  }

  @override
  Widget build(BuildContext context) {
    final typed = _filter.trim();
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.title),
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
                autofocus: true,
                onChanged: (v) => setState(() => _filter = v),
                decoration: const InputDecoration(
                  hintText: 'Search by name, brand or barcode',
                  prefixIcon: Icon(Icons.search),
                ),
              ),
            ),
          ),
          Expanded(
            child: QueryBuilder(
              path: 'products:list',
              refreshable: false,
              builder: (context, data) {
                final term = typed.toLowerCase();
                final list = [
                  for (final p in data as List)
                    if ([
                      p['name'],
                      p['brand'],
                      p['barcode'],
                    ].any((s) => (s ?? '').toLowerCase().contains(term)))
                      Map<String, dynamic>.from(p),
                ];
                final exact = list.any(
                  (p) => (p['name'] as String).toLowerCase() == term,
                );
                final offerNew = widget.allowNew && typed.isNotEmpty && !exact;
                if (list.isEmpty && !offerNew) {
                  return const EmptyState(
                    icon: Icons.search_off,
                    title: 'Nothing found',
                    message: 'Products are added when you receive goods or make something.',
                  );
                }
                return ListView(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                  children: [
                    if (offerNew)
                      Responsive(
                        child: Card(
                          child: ListTile(
                            leading: const Icon(
                              Icons.add,
                              color: AppColors.jam,
                            ),
                            title: Text('New: $typed'),
                            subtitle: const Text('Add it to your catalogue'),
                            onTap: () =>
                                Navigator.pop(context, {'name': typed}),
                          ),
                        ),
                      ),
                    for (final p in list)
                      Responsive(
                        child: Card(
                          child: ListTile(
                            leading: Icon(
                              storageIcons[p['storageType']],
                              color: AppColors.jam,
                            ),
                            title: Text(
                              p['name'],
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            subtitle: Text(
                              [
                                if (p['kind'] == 'made') 'Made here',
                                ?p['brand'],
                                ?p['barcode'],
                                ?p['unit'],
                              ].join(' · '),
                            ),
                            onTap: () => Navigator.pop(context, p),
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
