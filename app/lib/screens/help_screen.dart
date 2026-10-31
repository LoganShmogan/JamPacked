import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../theme.dart';
import '../widgets/common.dart';

/// Where the guides live. The website's /help/ page reads the same file.
const guidesAsset = 'assets/help/guides.json';

const _guideIcons = {
  'start': Icons.rocket_launch,
  'delivery': Icons.local_shipping,
  'scan': Icons.qr_code_scanner,
  'stock': Icons.inventory_2,
  'production': Icons.soup_kitchen,
  'recipe': Icons.menu_book,
  'temperature': Icons.thermostat,
  'programme': Icons.verified,
  'audit': Icons.fact_check,
  'warning': Icons.report_problem,
  'trace': Icons.manage_search,
  'count': Icons.checklist,
  'supplier': Icons.storefront,
  'insights': Icons.insights,
  'team': Icons.group,
  'export': Icons.download,
};

/// Help & support: how to do each thing in the app, searchable, and how to reach a person.
class HelpScreen extends StatefulWidget {
  const HelpScreen({super.key});
  @override
  State<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends State<HelpScreen> {
  late final Future<Map<String, dynamic>> _guides = DefaultAssetBundle.of(
    context,
  ).loadString(guidesAsset).then((s) => jsonDecode(s));
  String _filter = '';

  bool _matches(Map g) {
    final text = [
      g['title'],
      g['summary'],
      g['where'],
      ...g['steps'],
      ?g['tip'],
    ].join(' ').toLowerCase();
    return _filter.split(' ').every(text.contains);
  }

  Future<void> _copy(String email) async {
    await Clipboard.setData(ClipboardData(text: email));
    if (mounted) context.toast('Email address copied');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Help & support')),
      body: FutureBuilder(
        future: _guides,
        builder: (context, snap) {
          if (!snap.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          final email = snap.data!['supportEmail'] as String;
          final guides = [
            for (final g in snap.data!['guides'])
              if (_matches(g)) g as Map,
          ];
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Responsive(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    TextField(
                      onChanged: (v) =>
                          setState(() => _filter = v.trim().toLowerCase()),
                      decoration: const InputDecoration(
                        hintText: 'How do I...',
                        prefixIcon: Icon(Icons.search),
                      ),
                    ),
                    const SizedBox(height: 12),
                    if (guides.isEmpty)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 24),
                        child: Text(
                          'No guide matches that. Try another word, or ask us below.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: AppColors.muted),
                        ),
                      ),
                    for (final g in guides) _GuideCard(g),
                    const SectionTitle('Still stuck?'),
                    Card(
                      child: ListTile(
                        leading: const Icon(
                          Icons.mail_outline,
                          color: AppColors.jam,
                        ),
                        title: Text(
                          email,
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        subtitle: const Text(
                          'Email us with your business name and what you were trying to do. '
                          'A person in New Zealand will reply.',
                        ),
                        trailing: IconButton(
                          tooltip: 'Copy email address',
                          onPressed: () => _copy(email),
                          icon: const Icon(Icons.copy),
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

class _GuideCard extends StatelessWidget {
  const _GuideCard(this.g);
  final Map g;

  @override
  Widget build(BuildContext context) {
    final steps = (g['steps'] as List).cast<String>();
    return Card(
      clipBehavior: Clip.antiAlias,
      child: ExpansionTile(
        leading: Icon(
          _guideIcons[g['icon']] ?? Icons.help_outline,
          color: AppColors.jam,
        ),
        title: Text(
          g['title'],
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        subtitle: Text(g['summary']),
        childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        expandedCrossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Where: ${g['where']}',
            style: const TextStyle(
              color: AppColors.jamDark,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          for (final (n, step) in steps.indexed)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  CircleAvatar(
                    radius: 11,
                    backgroundColor: AppColors.jamLight,
                    child: Text(
                      '${n + 1}',
                      style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                        color: AppColors.jamDark,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(child: Text(step)),
                ],
              ),
            ),
          if (g['tip'] != null)
            Container(
              margin: const EdgeInsets.only(top: 12),
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: AppColors.jamLight,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text('Tip: ${g['tip']}'),
            ),
        ],
      ),
    );
  }
}
