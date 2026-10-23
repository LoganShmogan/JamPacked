import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/audit_history.dart';
import '../widgets/common.dart';
import 'goods_in_screen.dart';

class DeliveryDetailScreen extends StatelessWidget {
  const DeliveryDetailScreen({super.key, required this.id});
  final String id;

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthService>().user!;
    return Scaffold(
      appBar: AppBar(title: const Text('Delivery record')),
      body: QueryBuilder(
        path: 'deliveries:get',
        args: {'id': id},
        builder: (context, data) {
          if (data == null) {
            return const EmptyState(
              icon: Icons.search_off,
              title: 'Record not found',
            );
          }
          final d = data['delivery'];
          final items = data['items'] as List;
          final voided = d['voided'] == true;
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Responsive(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (voided)
                      Card(
                        color: AppColors.badLight,
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Text(
                            'VOIDED: ${d['voidReason']}',
                            style: const TextStyle(
                              color: AppColors.bad,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                      ),
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
                                    d['supplierName'],
                                    style: const TextStyle(
                                      fontSize: 20,
                                      fontWeight: FontWeight.w800,
                                    ),
                                  ),
                                ),
                                Pill(
                                  d['status'].toString().toUpperCase(),
                                  tone: GoodsInScreen.toneFor(d['status']),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            InfoRow('Received', fmtDateTime(d['receivedAt'])),
                            InfoRow('Received by', d['receivedByName']),
                            InfoRow(
                              'Supplier approved',
                              d['supplierApproved']
                                  ? 'Yes'
                                  : 'No (not on approved list)',
                            ),
                            InfoRow(
                              'Invoice / docket',
                              d['invoiceNumber'] ?? '-',
                            ),
                            InfoRow(
                              'Vehicle clean',
                              d['vehicleClean'] ? 'Yes' : 'No',
                            ),
                            if (d['vehicleTempC'] != null)
                              InfoRow(
                                'Vehicle temp',
                                '${fmtNum(d['vehicleTempC'])}°C',
                              ),
                            InfoRow('Notes', d['notes'] ?? '-'),
                          ],
                        ),
                      ),
                    ),
                    if (d['programmeAnswers'] != null) ...[
                      const SectionTitle('Programme checks'),
                      Card(
                        child: Column(
                          children: [
                            for (final a in d['programmeAnswers'])
                              ListTile(
                                dense: true,
                                title: Text(a['text']),
                                trailing: switch (a['value']) {
                                  true => const Pill('Yes', tone: Tone.ok),
                                  false => const Pill('No', tone: Tone.bad),
                                  _ => const Pill('N/A'),
                                },
                              ),
                          ],
                        ),
                      ),
                    ],
                    SectionTitle('Items (${items.length})'),
                    for (final i in items) ...[
                      _ItemCard(item: i),
                      const SizedBox(height: 8),
                    ],
                    if (!voided) ...[
                      const SizedBox(height: 8),
                      OutlinedButton.icon(
                        icon: const Icon(Icons.edit_note),
                        label: const Text('Edit notes'),
                        onPressed: () async {
                          final notes = await promptText(
                            context,
                            title: 'Delivery notes',
                            label: 'Notes',
                          );
                          if (notes == null || !context.mounted) return;
                          await context.run(
                            () => context.m('deliveries:updateNotes', {
                              'id': id,
                              'notes': notes,
                            }),
                            success: 'Notes saved',
                          );
                        },
                      ),
                      if (user.isManager) ...[
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: AppColors.bad,
                            side: const BorderSide(color: AppColors.bad),
                          ),
                          icon: const Icon(Icons.block),
                          label: const Text('Void record'),
                          onPressed: () async {
                            final reason = await promptText(
                              context,
                              title: 'Void this delivery?',
                              label: 'Reason (required)',
                              confirm: 'Void',
                              hint: 'e.g. Entered twice by mistake',
                            );
                            if (reason == null ||
                                reason.isEmpty ||
                                !context.mounted) {
                              return;
                            }
                            await context.run(
                              () => context.m('deliveries:voidDelivery', {
                                'id': id,
                                'reason': reason,
                              }),
                              success: 'Record voided',
                            );
                          },
                        ),
                      ],
                    ],
                    const SectionTitle('Record history'),
                    AuditHistory(entries: data['history']),
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

class _ItemCard extends StatelessWidget {
  const _ItemCard({required this.item});
  final dynamic item;
  @override
  Widget build(BuildContext context) {
    final tc = item['temperatureCompliant'];
    final allergens = (item['allergens'] as List).cast<String>();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  storageIcons[item['storageType']],
                  color: AppColors.orange,
                  size: 20,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    item['productName'],
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 16,
                    ),
                  ),
                ),
                item['accepted']
                    ? const Pill('Accepted', tone: Tone.ok)
                    : const Pill('Rejected', tone: Tone.bad),
              ],
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                Pill('${fmtNum(item['quantity'])} ${item['unit']}'),
                if (item['temperatureC'] != null)
                  Pill(
                    '${fmtNum(item['temperatureC'])}°C',
                    tone: tc == false ? Tone.bad : Tone.ok,
                    icon: Icons.thermostat,
                  ),
                if (tc == false && item['temperatureC'] == null)
                  const Pill('No temp', tone: Tone.bad),
                if (item['batchCode'] != null)
                  Pill('Batch ${item['batchCode']}'),
                if (item['useBy'] != null)
                  Pill('Use by ${fmtDate(item['useBy'])}', tone: Tone.brand),
                if (item['bestBefore'] != null)
                  Pill('BB ${fmtDate(item['bestBefore'])}'),
                if (item['packagingOk'] == false)
                  const Pill('Packaging damaged', tone: Tone.bad),
                if (item['labelOk'] == false)
                  const Pill('Label issue', tone: Tone.bad),
                for (final a in allergens)
                  Pill(a, tone: Tone.warn, icon: Icons.warning_amber),
              ],
            ),
            if (item['rejectionReason'] != null) ...[
              const SizedBox(height: 8),
              Text(
                'Reason: ${item['rejectionReason']}',
                style: const TextStyle(color: AppColors.bad),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
