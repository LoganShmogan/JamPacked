// Sample server responses shaped like the Convex functions return them.
import 'helpers.dart';

final t0 = DateTime(2024, 5, 6, 9, 15).millisecondsSinceEpoch;

Map<String, dynamic> settings({String jurisdiction = 'NZ'}) => {
  'businessName': 'Kai Cafe',
  'jurisdiction': jurisdiction,
  'registrationNumber': 'FCP-1',
  'address': '1 Main St',
  'chilledMaxC': 5,
  'frozenMaxC': -15,
  'hotMinC': 60,
  'expiryWarningDays': 3,
};

Map<String, dynamic> summary({
  int deliveries = 2,
  int rejections = 0,
  int temps = 3,
  int tempIssues = 0,
  int openCAs = 0,
  int highOpen = 0,
  int expiring = 0,
  int expired = 0,
  int inProgress = 0,
  String jurisdiction = 'NZ',
}) => {
  'businessName': 'Kai Cafe',
  'jurisdiction': jurisdiction,
  'deliveriesToday': deliveries,
  'rejectionsToday': rejections,
  'tempChecksToday': temps,
  'tempIssuesToday': tempIssues,
  'openCorrectiveActions': openCAs,
  'highSeverityOpen': highOpen,
  'expiringSoon': expiring,
  'expired': expired,
  'inProgressAudits': inProgress,
};

final suppliers = [
  {
    '_id': 's1',
    'name': 'Fresh Foods',
    'contactName': 'Jo',
    'phone': '021 555',
    'approved': true,
    'active': true,
  },
  {'_id': 's2', 'name': 'Shady Co', 'approved': false, 'active': true},
  {'_id': 's3', 'name': 'Gone Ltd', 'approved': true, 'active': false},
];

Map<String, dynamic> delivery({
  String id = 'd1',
  String status = 'accepted',
  bool voided = false,
  int tempIssues = 0,
}) => {
  '_id': id,
  'supplierName': 'Fresh Foods',
  'receivedAt': t0,
  'itemCount': 2,
  'receivedByName': 'Sam',
  'status': status,
  'voided': voided,
  'tempIssues': tempIssues,
};

final templates = [
  {
    'key': 'daily_check',
    'name': 'Daily Food Safety Check',
    'description': 'Opening/closing checks',
    'standardRef': 'MPI FCP Diary',
    'defaultPeriodDays': 1,
    'questionCount': 10,
    'autoFillCount': 5,
  },
  {
    'key': 'goods_receipt',
    'name': 'Goods Receipt',
    'description': 'Deliveries',
    'standardRef': 'FSANZ 3.2.2',
    'defaultPeriodDays': 7,
    'questionCount': 11,
    'autoFillCount': 10,
  },
];

Map<String, dynamic> ca({
  String id = 'c1',
  String severity = 'high',
  String source = 'goods_inward',
  String status = 'open',
  String? description = 'Check the stock',
}) => {
  '_id': id,
  'title': 'Warm milk',
  'description': description,
  'severity': severity,
  'source': source,
  'status': status,
  'raisedByName': 'Sam',
  'raisedAt': t0,
  if (status == 'closed') ...{
    'resolution': 'Discarded',
    'closedByName': 'Kim',
    'closedAt': t0,
  },
};

/// Handlers for every query a screen might make, so navigation never hits a gap.
Map<String, Handler> baseHandlers() => {
  'dashboard:summary': (_) => summary(),
  'deliveries:list': (_) => [delivery()],
  'deliveries:get': (_) => null,
  'deliveries:expiring': (_) => [],
  'deliveries:trace': (_) => [],
  'deliveries:suggestionsForSupplier': (_) => [],
  'audits:templates': (_) => templates,
  'audits:list': (_) => [],
  'audits:get': (_) => null,
  'correctiveActions:list': (_) => [],
  'settings:get': (_) => settings(),
  'suppliers:list': (_) => suppliers,
  'products:list': (_) => [],
  'temperature:list': (_) => [],
  'temperature:units': (_) => [],
  'auditLog:list': (_) => [],
  'auth:listUsers': (_) => [],
};

FakeConvex fakeWith([Map<String, Handler> overrides = const {}]) =>
    FakeConvex({...baseHandlers(), ...overrides});
