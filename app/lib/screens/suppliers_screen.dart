import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../theme.dart';
import '../widgets/audit_history.dart';
import '../widgets/common.dart';

class SuppliersScreen extends StatelessWidget {
  const SuppliersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final canEdit = context.watch<AuthService>().user!.isManager;
    return Scaffold(
      appBar: AppBar(title: const Text('Approved Suppliers')),
      floatingActionButton: canEdit
          ? FloatingActionButton(
              onPressed: () => Navigator.of(context).push(
                MaterialPageRoute(builder: (_) => const SupplierFormScreen()),
              ),
              child: const Icon(Icons.add),
            )
          : null,
      body: QueryBuilder(
        path: 'suppliers:list',
        args: const {'includeInactive': true},
        builder: (context, data) {
          final list = data as List;
          if (list.isEmpty) {
            return const EmptyState(
              icon: Icons.storefront,
              title: 'No suppliers yet',
              message: 'Keep a list of approved suppliers. Only buy food from registered businesses.',
            );
          }
          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
            itemCount: list.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, i) {
              final s = list[i];
              return Responsive(
                child: Card(
                  child: ListTile(
                    leading: const CircleAvatar(
                      backgroundColor: AppColors.jamLight,
                      child: Icon(Icons.storefront, color: AppColors.jam),
                    ),
                    title: Text(
                      s['name'],
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    subtitle: Text(
                      [
                        s['contactName'],
                        s['phone'],
                      ].where((x) => x != null).join(' · '),
                    ),
                    trailing: !s['active']
                        ? const Pill('Inactive')
                        : s['approved']
                        ? const Pill('Approved', tone: Tone.ok)
                        : const Pill('Not approved', tone: Tone.warn),
                    onTap: canEdit
                        ? () => Navigator.of(context).push(
                            MaterialPageRoute(
                              builder: (_) => SupplierFormScreen(supplier: s),
                            ),
                          )
                        : null,
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

/// Create or edit a supplier. Pops with the supplier id on create.
class SupplierFormScreen extends StatefulWidget {
  const SupplierFormScreen({super.key, this.supplier});
  final dynamic supplier;
  @override
  State<SupplierFormScreen> createState() => _SupplierFormScreenState();
}

class _SupplierFormScreenState extends State<SupplierFormScreen> {
  final _form = GlobalKey<FormState>();
  late final s = widget.supplier;
  late final _c = {
    for (final k in [
      'name',
      'contactName',
      'phone',
      'email',
      'address',
      'registrationNumber',
      'approvalNotes',
    ])
      k: TextEditingController(text: s?[k]),
  };
  late bool _approved = s?['approved'] ?? true;
  late bool _active = s?['active'] ?? true;

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    final fields = {
      for (final e in _c.entries)
        e.key: e.value.text.trim().isEmpty ? null : e.value.text.trim(),
      'approved': _approved,
    };
    final r = await context.run(
      () => s == null
          ? context.m('suppliers:create', fields)
          : context.m('suppliers:update', {
              ...fields,
              'id': s['_id'],
              'active': _active,
            }),
      success: 'Supplier saved',
    );
    if (mounted && (r != null || s != null)) {
      Navigator.pop(context, s == null ? r : null);
    }
  }

  Widget _field(
    String key,
    String label, {
    TextInputType? type,
    bool required = false,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: TextFormField(
      controller: _c[key],
      keyboardType: type,
      decoration: InputDecoration(labelText: label),
      validator: required ? (v) => v!.trim().isEmpty ? 'Required' : null : null,
    ),
  );

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(s == null ? 'New supplier' : 'Edit supplier')),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: FilledButton(onPressed: _save, child: const Text('Save')),
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
                  _field('name', 'Business name', required: true),
                  _field('contactName', 'Contact person'),
                  _field('phone', 'Phone', type: TextInputType.phone),
                  _field('email', 'Email', type: TextInputType.emailAddress),
                  _field('address', 'Address'),
                  _field(
                    'registrationNumber',
                    'Food business registration no.',
                  ),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Approved supplier'),
                    subtitle: const Text(
                      'Registered, reliable, delivers food safely',
                    ),
                    value: _approved,
                    onChanged: (v) => setState(() => _approved = v),
                  ),
                  _field('approvalNotes', 'Approval notes'),
                  if (s != null) ...[
                    SwitchListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text('Active'),
                      value: _active,
                      onChanged: (v) => setState(() => _active = v),
                    ),
                    const SectionTitle('History'),
                    QueryBuilder(
                      path: 'auditLog:list',
                      args: {'entityType': 'supplier', 'entityId': s['_id']},
                      refreshable: false,
                      builder: (context, e) => AuditHistory(entries: e),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
