import 'package:flutter/material.dart';
import 'package:letbuyy_marketplace_services/letbuyy_marketplace_services.dart';

// C2 corrective (Firebase SDK removal pass, 27 September 2026 review finding 5): this provider
// used to also hold a DatabaseService and a searchProducts() method that ran a real Firestore
// query -- but grepped every real caller (mobile_search_screen.dart's `_submitSearch`, the only
// one anywhere) and every reader of the fields that query populated (searchResults/hasResults/
// searchQuery/isSearching/error): zero. mobile_search_screen.dart derives what it actually shows
// entirely from ProductProvider.products, filtered locally (_updateResults) -- it called
// searchProducts() only for this class's OTHER, genuinely used behavior, recording the query to
// local search history. The Firestore call itself always failed silently (no Firebase app) and
// its result went nowhere; removed rather than fixed, since there was no real behavior to preserve.
class SearchProvider with ChangeNotifier {
  List<String> _searchHistory = [];

  List<String> get searchHistory => _searchHistory;
  bool get hasHistory => _searchHistory.isNotEmpty;

  SearchProvider() {
    _loadSearchHistory();
  }

  // Load search history
  void _loadSearchHistory() {
    _searchHistory = SharedPreferencesService.getSearchHistory();
    notifyListeners();
  }

  // Records a submitted query to search history. Named to match its one real caller
  // (mobile_search_screen.dart's `_submitSearch`) rather than renaming that call site too.
  Future<void> searchProducts(String query) async {
    if (query.isEmpty) return;
    await _addToHistory(query);
  }

  // Add query to search history
  Future<void> _addToHistory(String query) async {
    await SharedPreferencesService.addSearchQuery(query);
    _searchHistory = SharedPreferencesService.getSearchHistory();
    notifyListeners();
  }

  // Clear search history
  Future<void> clearHistory() async {
    await SharedPreferencesService.clearSearchHistory();
    _searchHistory = [];
    notifyListeners();
  }

  // Remove item from history
  Future<void> removeFromHistory(String query) async {
    _searchHistory.remove(query);
    await SharedPreferencesService.setStringList(
      'search_history',
      _searchHistory,
    );
    notifyListeners();
  }
}
