import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'config.dart';
import 'screens/business_picker_screen.dart';
import 'screens/home_shell.dart';
import 'screens/login_screen.dart';
import 'services/auth_service.dart';
import 'services/convex_client.dart';
import 'theme.dart';

void main() {
  final convex = ConvexClient(convexUrl);
  final auth = AuthService(convex)..restore();
  runApp(
    MultiProvider(
      providers: [
        Provider.value(value: convex),
        ChangeNotifierProvider.value(value: auth),
      ],
      child: const NzSafetyHealthApp(),
    ),
  );
}

class NzSafetyHealthApp extends StatelessWidget {
  const NzSafetyHealthApp({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    return MaterialApp(
      title: 'NZSafetyHealthApp',
      debugShowCheckedModeBanner: false,
      theme: buildTheme(),
      home: auth.loading
          ? const Scaffold(body: Center(child: CircularProgressIndicator()))
          : auth.user == null
          ? const LoginScreen()
          : auth.business == null
          ? const BusinessPickerScreen()
          : HomeShell(key: ValueKey(auth.business!.id)),
    );
  }
}
