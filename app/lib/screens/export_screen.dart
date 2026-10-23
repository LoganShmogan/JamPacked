import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../services/convex_client.dart';
import '../theme.dart';
import '../widgets/common.dart';

/// Admins: download every record this business has, as one JSON file.
class ExportScreen extends StatefulWidget {
  const ExportScreen({super.key, this.sharer});

  /// The share sheet / download to hand the file to (tests pass a fake).
  final SharePlus? sharer;

  @override
  State<ExportScreen> createState() => _ExportScreenState();
}

class _ExportScreenState extends State<ExportScreen> {
  String? _progress;

  Future<void> _export() async {
    setState(() => _progress = 'Starting…');
    try {
      final manifest = await context.q('exportData:manifest');
      final tables = <String, List>{};
      for (final table in manifest['tables'] as List) {
        if (mounted) setState(() => _progress = 'Exporting $table…');
        final rows = tables[table] = [];
        String? cursor;
        do {
          if (!mounted) return;
          final page = await context.q('exportData:page', {
            'table': table,
            'paginationOpts': {'cursor': cursor, 'numItems': 500},
          });
          rows.addAll(page['page']);
          cursor = page['isDone'] ? null : page['continueCursor'];
        } while (cursor != null);
      }
      final business = manifest['business'] as Map;
      final day = fmtDate(manifest['exportedAt']).replaceAll(' ', '-');
      final name =
          '${(business['name'] as String).replaceAll(RegExp(r'[^A-Za-z0-9]+'), '-')}-records-$day.json';
      final json = const JsonEncoder.withIndent('  ')
          .convert({...manifest, 'tables': tables});
      await (widget.sharer ?? SharePlus.instance).share(
        ShareParams(
          files: [
            XFile.fromData(utf8.encode(json), mimeType: 'application/json'),
          ],
          fileNameOverrides: [name],
          subject: '${business['name']} records',
        ),
      );
      if (mounted) setState(() => _progress = 'Exported $name');
    } on ConvexException catch (e) {
      if (mounted) setState(() => _progress = null);
      if (mounted) context.toast(e.message, error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final busy = _progress != null && !_progress!.startsWith('Exported');
    return Scaffold(
      appBar: AppBar(title: const Text('Export records')),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Responsive(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Card(
                  color: AppColors.orangeLight,
                  child: Padding(
                    padding: EdgeInsets.all(14),
                    child: Text(
                      'Records are kept for $retentionYears years and are never deleted: mistakes are voided '
                      'with a reason, and businesses are archived. MPI National Programmes need 4 years.\n\n'
                      'Export a full copy of everything this business has recorded: deliveries, stock, '
                      'temperatures, programme records, audits, corrective actions and the audit trail.',
                      style: TextStyle(color: AppColors.orangeDark),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: busy ? null : _export,
                  icon: const Icon(Icons.download),
                  label: const Text('Export all records (JSON)'),
                ),
                if (_progress != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(_progress!, textAlign: TextAlign.center),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
