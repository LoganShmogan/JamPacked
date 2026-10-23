import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'convex_client.dart';

class AppUser {
  AppUser(this.id, this.name, this.email, this.role);
  factory AppUser.fromJson(Map<String, dynamic> j) =>
      AppUser(j['_id'], j['name'], j['email'], j['role'] ?? '');
  final String id, name, email;

  /// Role in the business being worked in ('' until one is chosen).
  final String role;
  bool get isManager => role == 'admin' || role == 'manager';
  bool get isAdmin => role == 'admin';
  AppUser withRole(String role) => AppUser(id, name, email, role);
}

/// A business the user belongs to, as listed by `businesses:mine`.
class Business {
  Business(
    this.id,
    this.name,
    this.programme,
    this.role, {
    this.sectors = const [],
    this.archived = false,
    this.isOwner = false,
    this.openCorrectiveActions = 0,
  });
  factory Business.fromJson(Map<String, dynamic> j) => Business(
    j['_id'],
    j['name'],
    j['programme'],
    j['role'],
    sectors: List<String>.from(j['sectors'] ?? const []),
    archived: j['archived'] ?? false,
    isOwner: j['isOwner'] ?? false,
    openCorrectiveActions: j['openCorrectiveActions'] ?? 0,
  );
  final String id, name, programme, role;
  final List<String> sectors;
  final bool archived, isOwner;
  final int openCorrectiveActions;
}

String _today() => DateTime.now().toIso8601String().substring(0, 10);

/// Development auth: local accounts with PBKDF2-hashed passwords stored in Convex.
/// When moving to Clerk, replace login/register with Clerk sign-in and pass the Clerk JWT
/// to Convex (ctx.auth) instead of [token]; screens only depend on [user] and [token].
///
/// After signing in the user picks which of their [businesses] they're working in today;
/// that choice is remembered until the end of the day (or until they switch).
class AuthService extends ChangeNotifier {
  AuthService(this.convex);
  final ConvexClient convex;
  static const _key = 'session_token';
  static const _businessKey = 'business_today';

  String? token;
  AppUser? user;
  bool loading = true;
  List<Business> businesses = [];
  Business? business;

  Future<void> restore() async {
    final prefs = await SharedPreferences.getInstance();
    token = prefs.getString(_key);
    if (token != null) {
      try {
        final me = await convex.query('auth:me', {'sessionToken': token});
        user = me == null ? null : AppUser.fromJson(me);
        if (user != null) await loadBusinesses(autoPick: true);
      } catch (_) {
        user = null;
      }
      if (user == null) {
        token = null;
        await prefs.remove(_key);
      }
    }
    loading = false;
    notifyListeners();
  }

  Future<void> login(String email, String password) => _start(
    convex.action('auth:login', {'email': email, 'password': password}),
  );

  /// [business] is the main business to create (name, programme, sectors...);
  /// null for someone joining a business that invited them.
  Future<void> register(
    String name,
    String email,
    String password, {
    Map<String, dynamic>? business,
  }) => _start(
    convex.action('auth:register', {
      'name': name,
      'email': email,
      'password': password,
      'business': business,
    }),
  );

  Future<void> _start(Future<dynamic> call) async {
    final res = await call;
    token = res['token'];
    final me = await convex.query('auth:me', {'sessionToken': token});
    user = AppUser.fromJson(me);
    (await SharedPreferences.getInstance()).setString(_key, token!);
    await loadBusinesses(autoPick: true);
    notifyListeners();
  }

  /// Refreshes [businesses]. With [autoPick], reopens today's choice, or the only
  /// business when there is just one.
  Future<void> loadBusinesses({bool autoPick = false}) async {
    final list = await convex.query('businesses:mine', {'sessionToken': token});
    businesses = [for (final b in list as List) Business.fromJson(b)];
    if (!autoPick) {
      notifyListeners();
      return;
    }
    final saved = (await SharedPreferences.getInstance())
        .getString(_businessKey)
        ?.split('|');
    final open = businesses.where((b) => !b.archived).toList();
    final today = saved != null && saved.last == _today()
        ? open.where((b) => b.id == saved.first).firstOrNull
        : null;
    final pick = today ?? (open.length == 1 ? open.single : null);
    if (pick != null) await selectBusiness(pick);
  }

  /// Work in [b] for the rest of today.
  Future<void> selectBusiness(Business b) async {
    business = b;
    user = user!.withRole(b.role);
    (await SharedPreferences.getInstance()).setString(
      _businessKey,
      '${b.id}|${_today()}',
    );
    notifyListeners();
  }

  /// Reloads the business list and the current business (after its settings change).
  Future<void> refreshCurrent() async {
    await loadBusinesses();
    final b = businesses.where((x) => x.id == business?.id).firstOrNull;
    if (b != null) await selectBusiness(b);
  }

  /// Back to the business picker.
  Future<void> switchBusiness() async {
    business = null;
    user = user?.withRole('');
    (await SharedPreferences.getInstance()).remove(_businessKey);
    notifyListeners();
    await loadBusinesses();
  }

  Future<void> logout() async {
    final t = token;
    token = null;
    user = null;
    business = null;
    businesses = [];
    final prefs = await SharedPreferences.getInstance();
    prefs.remove(_key);
    prefs.remove(_businessKey);
    notifyListeners();
    if (t != null) {
      try {
        await convex.mutation('auth:logout', {'sessionToken': t});
      } catch (_) {}
    }
  }
}
