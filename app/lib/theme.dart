import 'package:flutter/material.dart';

/// Orange & white, in the spirit of NZ food safety (MPI) material.
class AppColors {
  static const orange = Color(0xFFF26B21);
  static const orangeDark = Color(0xFFC94E0E);
  static const orangeLight = Color(0xFFFFF1E8);
  static const ink = Color(0xFF2B2B2B);
  static const muted = Color(0xFF6B6B6B);
  static const border = Color(0xFFEDE6E1);
  static const surface = Color(0xFFFAF8F6);
  static const ok = Color(0xFF2E7D32);
  static const okLight = Color(0xFFE8F5E9);
  static const warn = Color(0xFFB26A00);
  static const warnLight = Color(0xFFFFF4DE);
  static const bad = Color(0xFFC62828);
  static const badLight = Color(0xFFFDECEA);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.orange,
    primary: AppColors.orange,
    onPrimary: Colors.white,
    surface: Colors.white,
    brightness: Brightness.light,
  );
  final border = OutlineInputBorder(
    borderRadius: BorderRadius.circular(12),
    borderSide: const BorderSide(color: AppColors.border),
  );
  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    scaffoldBackgroundColor: AppColors.surface,
    appBarTheme: const AppBarTheme(
      backgroundColor: AppColors.orange,
      foregroundColor: Colors.white,
      elevation: 0,
      centerTitle: false,
      titleTextStyle: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        color: Colors.white,
      ),
    ),
    cardTheme: CardThemeData(
      color: Colors.white,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(14),
        side: const BorderSide(color: AppColors.border),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: Colors.white,
      border: border,
      enabledBorder: border,
      focusedBorder: border.copyWith(
        borderSide: const BorderSide(color: AppColors.orange, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(64, 50),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(64, 50),
        foregroundColor: AppColors.orange,
        side: const BorderSide(color: AppColors.orange),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: AppColors.orange,
      foregroundColor: Colors.white,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: AppColors.orangeLight,
      iconTheme: WidgetStateProperty.resolveWith(
        (s) => IconThemeData(
          color: s.contains(WidgetState.selected)
              ? AppColors.orange
              : AppColors.muted,
        ),
      ),
      labelTextStyle: WidgetStateProperty.resolveWith(
        (s) => TextStyle(
          fontSize: 12,
          fontWeight: s.contains(WidgetState.selected)
              ? FontWeight.w700
              : FontWeight.w500,
          color: s.contains(WidgetState.selected)
              ? AppColors.orange
              : AppColors.muted,
        ),
      ),
    ),
    chipTheme: const ChipThemeData(side: BorderSide(color: AppColors.border)),
    dividerTheme: const DividerThemeData(color: AppColors.border, space: 1),
  );
}
