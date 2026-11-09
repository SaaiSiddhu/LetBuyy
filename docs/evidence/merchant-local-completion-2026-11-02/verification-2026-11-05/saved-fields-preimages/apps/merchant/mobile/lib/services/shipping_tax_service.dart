import 'package:flutter/foundation.dart';
import 'package:letbuyy_models/letbuyy_models.dart';

import 'api_client.dart' hide JsonMap;

// Compatibility import surface; contracts have one shared Dart owner.
export 'package:letbuyy_models/letbuyy_models.dart'
    show
        ShippingProfileContract,
        ShippingProfileInput,
        ShippingProfilePatch,
        parseShippingHandlingFeeMinor,
        ShippingSummary,
        ShippingZoneContract,
        ShippingRateContract,
        ShippingZoneInput,
        ShippingRateInput,
        TaxRateContract,
        TaxRateInput;

typedef _SettingsView = ({Object? version, String site, int generation});

class ShippingTaxService extends ChangeNotifier {
  ShippingTaxService({
    required ApiClient api,
    String? Function()? storeIdProvider,
  }) : _api = api,
       _selected = storeIdProvider;
  final ApiClient _api;
  final String? Function()? _selected;
  final Map<String, _SettingsView> _views = {};
  final Set<String> _loading = {};
  int _generation = 0;
  List<ShippingZoneContract> _zones = [];
  List<ShippingRateContract> _rates = [];
  List<TaxRateContract> _taxRates = [];
  List<ShippingProfileContract> _profiles = [];
  bool _visible(String resource) {
    final view = _views[resource];
    return view != null &&
        view.version == _api.captureRequestContext() &&
        (_selected == null || _selected!() == view.site);
  }

  List<ShippingZoneContract> get zones =>
      List.unmodifiable(_visible('zones') ? _zones : <ShippingZoneContract>[]);
  List<ShippingRateContract> get rates =>
      List.unmodifiable(_visible('rates') ? _rates : <ShippingRateContract>[]);
  List<TaxRateContract> get taxRates =>
      List.unmodifiable(_visible('taxes') ? _taxRates : <TaxRateContract>[]);
  List<ShippingProfileContract> get profiles => List.unmodifiable(
    _visible('profiles') ? _profiles : <ShippingProfileContract>[],
  );
  bool get isLoading => _loading.any(_visible);
  static ApiException changed() => const ApiException(
    message: 'Store access changed. Reload settings.',
    statusCode: 409,
    code: 'SESSION_CONTEXT_CHANGED',
  );
  String _siteFor(String resource, String? proposed) {
    final selected = _selected?.call();
    final site =
        selected ?? proposed ?? _views[resource]?.site ?? _views['zones']?.site;
    if (site == null ||
        site.isEmpty ||
        (_selected != null && selected == null) ||
        (proposed != null && proposed != site))
      throw changed();
    return site;
  }

  void _check(Object? version, String site) {
    if (_api.captureRequestContext() != version ||
        (_selected != null && _selected!() != site))
      throw changed();
  }

  void _clear(String resource) {
    switch (resource) {
      case 'zones':
        _zones = [];
      case 'rates':
        _rates = [];
      case 'taxes':
        _taxRates = [];
      case 'profiles':
        _profiles = [];
    }
  }

  void _deny(String site, Object? version) {
    for (final entry in _views.entries.toList()) {
      if (entry.value.site == site && entry.value.version == version) {
        _clear(entry.key);
        _views.remove(entry.key);
        _loading.remove(entry.key);
      }
    }
    notifyListeners();
  }

  JsonMap _scoped(JsonMap raw, String site) {
    void check(Map row) {
      if (row['store_id'] != null && row['store_id'] != site ||
          row['site_id'] != null && row['site_id'] != site)
        throw const ApiException(
          message: 'The settings store could not be confirmed.',
          statusCode: 503,
          code: 'SETTINGS_SCOPE_UNVERIFIED',
        );
    }

    check(raw);
    if (raw['shipping_zones'] is Map) check(raw['shipping_zones'] as Map);
    return {...raw, 'store_id': site};
  }

  ApiRequestOptions _options(Object? version, String site) =>
      ApiRequestOptions(storeId: site, expectedContextVersion: version);
  Future<List<T>> _read<T>(
    String resource,
    String requested,
    Future<List<JsonMap>> Function(ApiRequestOptions) load,
    T Function(JsonMap) parse,
    void Function(List<T>) publish,
  ) async {
    final site = _siteFor(resource, requested),
        view = (
          version: _api.captureRequestContext(),
          site: requested,
          generation: ++_generation,
        );
    _views[resource] = view;
    _clear(resource);
    _loading.add(resource);
    notifyListeners();
    try {
      final rows = await load(_options(view.version, site));
      _check(view.version, site);
      if (_views[resource] != view) throw changed();
      final result = rows
          .map((row) => parse(_scoped(row, site)))
          .toList(growable: false);
      publish(result);
      return result;
    } catch (error) {
      if (error is ApiException &&
          [401, 403, 404].contains(error.statusCode) &&
          _api.captureRequestContext() == view.version)
        _deny(site, view.version);
      rethrow;
    } finally {
      if (_views[resource] == view) {
        _loading.remove(resource);
        notifyListeners();
      }
    }
  }

  Future<T> _command<T>(
    String resource,
    String? proposed,
    Future<JsonMap> Function(ApiRequestOptions) send,
    T Function(JsonMap) parse,
    void Function(T) publish,
  ) async {
    final site = _siteFor(resource, proposed),
        version = _api.captureRequestContext(),
        before = _views[resource];
    try {
      final raw = await send(_options(version, site));
      _check(version, site);
      final result = parse(_scoped(raw, site));
      if (_views[resource] == before) {
        if (before == null ||
            before.version != version ||
            before.site != site) {
          _clear(resource);
          _views[resource] = (
            version: version,
            site: site,
            generation: ++_generation,
          );
        }
        publish(result);
        notifyListeners();
      }
      return result;
    } catch (error) {
      if (error is ApiException &&
          [401, 403, 404].contains(error.statusCode) &&
          _api.captureRequestContext() == version)
        _deny(site, version);
      rethrow;
    }
  }

  Future<ShippingSummary> fetchShipping(String storeId) async {
    final version = _api.captureRequestContext();
    final result = await Future.wait<Object>([
      fetchZones(storeId),
      fetchRates(storeId),
    ]);
    _check(version, storeId);
    return ShippingSummary(
      zones: result[0] as List<ShippingZoneContract>,
      rates: result[1] as List<ShippingRateContract>,
    );
  }

  Future<List<ShippingZoneContract>> fetchZones(String site) => _read(
    'zones',
    site,
    (o) => _api.shipping.zones.list(site, options: o),
    ShippingZoneContract.fromJson,
    (rows) => _zones = rows,
  );
  Future<List<ShippingRateContract>> fetchRates(String site) => _read(
    'rates',
    site,
    (o) => _api.shipping.rates.list(site, options: o),
    ShippingRateContract.fromJson,
    (rows) => _rates = rows,
  );
  Future<List<TaxRateContract>> fetchTaxes(String site) => _read(
    'taxes',
    site,
    (o) => _api.taxes.list(site, options: o),
    TaxRateContract.fromJson,
    (rows) => _taxRates = rows,
  );
  Future<List<ShippingProfileContract>> fetchProfiles(String site) => _read(
    'profiles',
    site,
    (o) => _api.shipping.profiles.list(site, options: o),
    ShippingProfileContract.fromJson,
    (rows) => _profiles = rows,
  );
  Future<ShippingZoneContract> createZone(ShippingZoneInput input) => _command(
    'zones',
    input.storeId,
    (o) => _api.shipping.zones.create(
      input.toJson(includeStoreId: true),
      options: o,
    ),
    ShippingZoneContract.fromJson,
    (row) => _zones = [..._zones, row],
  );
  Future<ShippingZoneContract> updateZone(String id, ShippingZoneInput input) =>
      _command(
        'zones',
        input.storeId,
        (o) => _api.shipping.zones.update(
          id,
          input.toJson(includeStoreId: false),
          options: o,
        ),
        (raw) {
          final row = ShippingZoneContract.fromJson(raw);
          if (row.id != id) throw changed();
          return row;
        },
        (row) => _zones = [..._zones.where((old) => old.id != id), row],
      );
  Future<ShippingRateContract> createRate(ShippingRateInput input) => _command(
    'rates',
    null,
    (o) => _api.shipping.rates.create(input.toJson(), options: o),
    (raw) {
      final row = ShippingRateContract.fromJson(raw);
      if (row.zoneId != input.zoneId) throw changed();
      return row;
    },
    (row) => _rates = [..._rates, row],
  );
  Future<ShippingRateContract> updateRate(String id, ShippingRateInput input) =>
      _command(
        'rates',
        null,
        (o) => _api.shipping.rates.update(
          id,
          input.toJson(forUpdate: true),
          options: o,
        ),
        (raw) {
          final row = ShippingRateContract.fromJson(raw);
          if (row.id != id || row.zoneId != input.zoneId) throw changed();
          return row;
        },
        (row) => _rates = [..._rates.where((old) => old.id != id), row],
      );
  Future<TaxRateContract> createTaxRate(TaxRateInput input) => _command(
    'taxes',
    input.storeId,
    (o) => _api.taxes.create(input.toJson(includeStoreId: true), options: o),
    TaxRateContract.fromJson,
    (row) => _taxRates = [..._taxRates, row],
  );
  Future<TaxRateContract> updateTaxRate(String id, TaxRateInput input) =>
      _command(
        'taxes',
        input.storeId,
        (o) => _api.taxes.update(
          id,
          input.toJson(includeStoreId: false),
          options: o,
        ),
        (raw) {
          final row = TaxRateContract.fromJson(raw);
          if (row.id != id) throw changed();
          return row;
        },
        (row) => _taxRates = [..._taxRates.where((old) => old.id != id), row],
      );
  Future<ShippingProfileContract> createProfile(ShippingProfileInput input) =>
      _command(
        'profiles',
        input.storeId,
        (o) => _api.shipping.profiles.create(input.toJson(), options: o),
        (raw) {
          final row = ShippingProfileContract.fromJson(raw);
          if (row.id != input.id) throw changed();
          return row;
        },
        (row) =>
            _profiles = [..._profiles.where((old) => old.id != row.id), row],
      );
  Future<ShippingProfileContract> updateProfile(
    String site,
    String id,
    ShippingProfilePatch input,
  ) => _command(
    'profiles',
    site,
    (o) => _api.shipping.profiles.update(id, input.toJson(), options: o),
    (raw) {
      final row = ShippingProfileContract.fromJson(raw);
      if (row.id != id) throw changed();
      return row;
    },
    (row) => _profiles = [..._profiles.where((old) => old.id != id), row],
  );
  Future<void> _delete(
    String resource,
    String id,
    Future<JsonMap> Function(ApiRequestOptions) send,
    void Function() publish,
  ) async {
    final site = _siteFor(resource, null),
        version = _api.captureRequestContext(),
        before = _views[resource];
    try {
      final receipt = await send(_options(version, site));
      _check(version, site);
      if (receipt['deleted'] != true)
        throw const ApiException(
          message: 'Deletion could not be confirmed. Reload settings.',
          statusCode: 503,
          code: 'SETTINGS_DELETE_UNVERIFIED',
        );
      if (_views[resource] == before) {
        publish();
        notifyListeners();
      }
    } catch (error) {
      if (error is ApiException &&
          [401, 403, 404].contains(error.statusCode) &&
          _api.captureRequestContext() == version)
        _deny(site, version);
      rethrow;
    }
  }

  Future<void> deleteZone(String id) => _delete(
    'zones',
    id,
    (o) => _api.shipping.zones.remove(id, options: o),
    () {
      _zones = _zones.where((z) => z.id != id).toList();
      _rates = _rates.where((r) => r.zoneId != id).toList();
    },
  );
  Future<void> deleteRate(String id) => _delete(
    'rates',
    id,
    (o) => _api.shipping.rates.remove(id, options: o),
    () => _rates = _rates.where((r) => r.id != id).toList(),
  );
  Future<void> deleteTaxRate(String id) => _delete(
    'taxes',
    id,
    (o) => _api.taxes.remove(id, options: o),
    () => _taxRates = _taxRates.where((r) => r.id != id).toList(),
  );
}
