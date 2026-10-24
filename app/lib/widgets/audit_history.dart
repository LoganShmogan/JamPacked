import 'package:flutter/material.dart';

import '../theme.dart';
import 'common.dart';

IconData auditActionIcon(String action) => switch (action) {
  'create' => Icons.add_circle_outline,
  'update' || 'answer' => Icons.edit_outlined,
  'void' => Icons.block,
  'complete' || 'close' => Icons.check_circle_outline,
  'login' => Icons.login,
  'logout' => Icons.logout,
  'login_failed' => Icons.gpp_bad_outlined,
  'refresh' => Icons.sync,
  _ => Icons.history,
};

/// Timeline of audit-log entries: who did what and when.
class AuditHistory extends StatelessWidget {
  const AuditHistory({super.key, required this.entries});
  final List entries;

  @override
  Widget build(BuildContext context) {
    if (entries.isEmpty) {
      return const Text('No history', style: TextStyle(color: AppColors.muted));
    }
    return Card(
      child: Column(
        children: [
          for (var i = 0; i < entries.length; i++) ...[
            if (i > 0) const Divider(height: 1),
            ListTile(
              dense: true,
              leading: Icon(
                auditActionIcon(entries[i]['action']),
                color: AppColors.jam,
              ),
              title: Text(entries[i]['summary']),
              subtitle: Text(
                '${entries[i]['userName']} · ${fmtDateTime(entries[i]['at'])}',
              ),
            ),
          ],
        ],
      ),
    );
  }
}
