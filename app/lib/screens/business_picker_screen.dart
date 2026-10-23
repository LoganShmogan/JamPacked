import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/auth_service.dart';
import '../services/convex_client.dart';
import '../theme.dart';
import '../widgets/business_form.dart';
import '../widgets/common.dart';

/// After signing in: every business you belong to. Pick the one you're working in today.
class BusinessPickerScreen extends StatefulWidget {
  const BusinessPickerScreen({super.key});
  @override
  State<BusinessPickerScreen> createState() => _BusinessPickerScreenState();
}

class _BusinessPickerScreenState extends State<BusinessPickerScreen> {
  bool _showArchived = false;
  String? _error;

  Future<void> _refresh() async {
    try {
      await context.auth.loadBusinesses();
      if (mounted) setState(() => _error = null);
    } on ConvexException catch (e) {
      if (mounted) setState(() => _error = e.message);
    }
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final archived = auth.businesses.where((b) => b.archived).toList();
    final shown = auth.businesses
        .where((b) => _showArchived || !b.archived)
        .toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('Your businesses'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            icon: const Icon(Icons.logout),
            onPressed: () => auth.logout(),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => Navigator.of(context)
            .push(MaterialPageRoute(builder: (_) => const AddBusinessScreen())),
        icon: const Icon(Icons.add_business),
        label: const Text('Add business'),
      ),
      body: RefreshIndicator(
        color: AppColors.orange,
        onRefresh: _refresh,
        child: ListView(
          // Always scrollable so pull-to-refresh works with only a few businesses.
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
          children: [
            Responsive(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Hi ${(auth.user?.name ?? '').split(' ').first}, which business are you working in today?',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 12),
                  if (_error != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        _error!,
                        style: const TextStyle(color: AppColors.bad),
                      ),
                    ),
                  if (shown.isEmpty)
                    const Padding(
                      padding: EdgeInsets.all(24),
                      child: Text(
                        'You are not part of any business yet. Add your own, or ask a manager to invite you.',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: AppColors.muted),
                      ),
                    ),
                  for (final b in shown) _BusinessCard(b),
                  if (archived.isNotEmpty)
                    TextButton(
                      onPressed: () =>
                          setState(() => _showArchived = !_showArchived),
                      child: Text(
                        _showArchived
                            ? 'Hide archived'
                            : 'Show archived (${archived.length})',
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BusinessCard extends StatelessWidget {
  const _BusinessCard(this.b);
  final Business b;

  @override
  Widget build(BuildContext context) => Card(
    margin: const EdgeInsets.only(bottom: 10),
    child: ListTile(
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      leading: CircleAvatar(
        backgroundColor: b.archived ? AppColors.border : AppColors.orange,
        child: Text(
          b.name[0].toUpperCase(),
          style: const TextStyle(color: Colors.white),
        ),
      ),
      title: Text(b.name, style: const TextStyle(fontWeight: FontWeight.w700)),
      subtitle: Padding(
        padding: const EdgeInsets.only(top: 6),
        child: Wrap(
          spacing: 6,
          runSpacing: 6,
          children: [
            Pill(programmeLabel(b.programme), tone: Tone.brand),
            Pill(b.role.toUpperCase()),
            if (b.openCorrectiveActions > 0)
              Pill(
                '${b.openCorrectiveActions} open action${b.openCorrectiveActions == 1 ? '' : 's'}',
                tone: Tone.warn,
              ),
            if (b.archived) const Pill('ARCHIVED'),
          ],
        ),
      ),
      trailing: const Icon(Icons.chevron_right),
      onTap: () => context.auth.selectBusiness(b),
    ),
  );
}

/// Add another business you own. You become its admin and it opens straight away.
class AddBusinessScreen extends StatefulWidget {
  const AddBusinessScreen({super.key});
  @override
  State<AddBusinessScreen> createState() => _AddBusinessScreenState();
}

class _AddBusinessScreenState extends State<AddBusinessScreen> {
  final _form = GlobalKey<BusinessFormState>();
  bool _busy = false;

  Future<void> _create() async {
    final business = _form.currentState!.collect();
    if (business == null) return;
    setState(() => _busy = true);
    final auth = context.auth;
    final nav = Navigator.of(context);
    final id = await context.run(
      () => context.convex.mutation('businesses:create', {
        ...business,
        'sessionToken': auth.token,
      }),
    );
    if (id == null) {
      if (mounted) setState(() => _busy = false);
      return;
    }
    await auth.loadBusinesses();
    nav.popUntil((r) => r.isFirst);
    await auth.selectBusiness(auth.businesses.firstWhere((b) => b.id == id));
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Add business')),
    body: ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Responsive(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              BusinessForm(key: _form),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: _busy ? null : _create,
                child: const Text('Create business'),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}
