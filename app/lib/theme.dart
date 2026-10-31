import 'package:flutter/material.dart';

/// Jam & white, from the JamPacked logo: jam red, the cream jar background and the mustard lid.
/// [jam] is a shade deeper than the logo's red (0xFFE06665) so white text on it stays readable.
class AppColors {
  static const jam = Color(0xFFC94A4E);
  static const jamDark = Color(0xFFA8323A);
  static const jamLight = Color(0xFFFFF0E0);
  static const ink = Color(0xFF2B2B2B);
  static const muted = Color(0xFF6B6B6B);
  static const border = Color(0xFFEDE6E1);
  static const surface = Color(0xFFFAF8F6);
  static const ok = Color(0xFF2E7D32);
  static const okLight = Color(0xFFE8F5E9);
  static const warn = Color(0xFF8A6800); // mustard, from the lid
  static const warnLight = Color(0xFFFFF3D6);
  static const bad = Color(0xFFC62828);
  static const badLight = Color(0xFFFDECEA);
}

ThemeData buildTheme() {
  final scheme = ColorScheme.fromSeed(
    seedColor: AppColors.jam,
    primary: AppColors.jam,
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
      backgroundColor: AppColors.jam,
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
        borderSide: const BorderSide(color: AppColors.jam, width: 2),
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
        foregroundColor: AppColors.jam,
        side: const BorderSide(color: AppColors.jam),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    ),
    floatingActionButtonTheme: const FloatingActionButtonThemeData(
      backgroundColor: AppColors.jam,
      foregroundColor: Colors.white,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: Colors.white,
      indicatorColor: AppColors.jamLight,
      iconTheme: WidgetStateProperty.resolveWith(
        (s) => IconThemeData(
          color: s.contains(WidgetState.selected)
              ? AppColors.jam
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
              ? AppColors.jam
              : AppColors.muted,
        ),
      ),
    ),
    chipTheme: const ChipThemeData(side: BorderSide(color: AppColors.border)),
    // Tab bars sit under the jam-coloured app bar, so their labels and indicator are white.
    tabBarTheme: const TabBarThemeData(
      labelColor: Colors.white,
      unselectedLabelColor: Colors.white70,
      indicatorColor: Colors.white,
      dividerColor: Colors.transparent,
    ),
    dividerTheme: const DividerThemeData(color: AppColors.border, space: 1),
  );
}
