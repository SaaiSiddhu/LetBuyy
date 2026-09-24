// lib/screens/orders/widgets/smart_order_search.dart
// Smart Search Bar with Autocomplete and Quick Filter Chips

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'dart:async';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:letbuyy_ui_kit/letbuyy_ui_kit.dart';

/// Quick filter chip types
enum QuickFilter {
  paid('Paid', Icons.check_circle_rounded, Color(0xFF4CAF50)),
  cod('COD', Icons.payments_rounded, Color(0xFFE53935)),
  shipToday('Ship Today', Icons.local_shipping_rounded, Color(0xFF2196F3)),
  delayed('Delayed', Icons.warning_rounded, Color(0xFFFF9800)),
  rto('RTO', Icons.undo_rounded, Color(0xFFE91E63));

  final String label;
  final IconData icon;
  final Color color;
  const QuickFilter(this.label, this.icon, this.color);
}

/// Search suggestion types
enum SuggestionType { orderId, customer, product, phone }

class SearchSuggestion {
  final String text;
  final String? subtitle;
  final SuggestionType type;
  final String? orderId;

  const SearchSuggestion({
    required this.text,
    this.subtitle,
    required this.type,
    this.orderId,
  });

  IconData get icon {
    switch (type) {
      case SuggestionType.orderId:
        return Icons.receipt_long_rounded;
      case SuggestionType.customer:
        return Icons.person_rounded;
      case SuggestionType.product:
        return Icons.inventory_2_rounded;
      case SuggestionType.phone:
        return Icons.phone_rounded;
    }
  }
}

/// Smart Order Search Widget
class SmartOrderSearch extends StatefulWidget {
  final bool isDark;
  final String? sellerId;
  final Set<QuickFilter> activeFilters;
  final Function(String) onSearchChanged;
  final Function(String) onSearchSubmitted;
  final Function(QuickFilter) onFilterToggled;
  final VoidCallback onAdvancedFilterTap;
  // Sort dropdown props
  final String currentSortLabel;
  final Function(int) onSortChanged;
  // Advanced filters for active chips display
  final int advancedFilterCount;
  final VoidCallback? onClearAdvancedFilters;

  const SmartOrderSearch({
    super.key,
    required this.isDark,
    required this.sellerId,
    required this.activeFilters,
    required this.onSearchChanged,
    required this.onSearchSubmitted,
    required this.onFilterToggled,
    required this.onAdvancedFilterTap,
    this.currentSortLabel = 'Newest',
    required this.onSortChanged,
    this.advancedFilterCount = 0,
    this.onClearAdvancedFilters,
  });

  @override
  State<SmartOrderSearch> createState() => _SmartOrderSearchState();
}

class _SmartOrderSearchState extends State<SmartOrderSearch> {
  final _searchController = TextEditingController();
  final _focusNode = FocusNode();
  final _layerLink = LayerLink();
  
  List<SearchSuggestion> _suggestions = [];
  bool _showSuggestions = false;
  Timer? _debounce;
  OverlayEntry? _overlayEntry;

  // Placeholder animation
  final List<String> _placeholders = [
    'Search by Order ID...',
    'Search by customer name...',
    'Search by product...',
    'Search by phone number...',
  ];
  int _currentPlaceholder = 0;
  Timer? _placeholderTimer;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_onFocusChange);
    _startPlaceholderAnimation();
  }

  void _startPlaceholderAnimation() {
    _placeholderTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (mounted && _searchController.text.isEmpty) {
        setState(() {
          _currentPlaceholder = (_currentPlaceholder + 1) % _placeholders.length;
        });
      }
    });
  }

  void _onFocusChange() {
    if (_focusNode.hasFocus && _suggestions.isNotEmpty) {
      _showOverlay();
    } else {
      _hideOverlay();
    }
  }

  void _onSearchChanged(String query) {
    widget.onSearchChanged(query);
    
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      if (query.length >= 2) {
        _fetchSuggestions(query);
      } else {
        setState(() => _suggestions = []);
        _hideOverlay();
      }
    });
  }

  Future<void> _fetchSuggestions(String query) async {
    if (widget.sellerId == null) return;

    final suggestions = <SearchSuggestion>[];
    final lowerQuery = query.toLowerCase();

    try {
      // Search orders
      final ordersSnap = await FirebaseFirestore.instance
          .collection('orders')
          .where('sellerId', isEqualTo: widget.sellerId)
          .limit(20)
          .get();

      for (final doc in ordersSnap.docs) {
        final data = doc.data();
        final orderId = doc.id;
        final orderNumber = data['orderNumber'] as String? ?? orderId.substring(0, 8);

        // Match order ID
        if (orderNumber.toLowerCase().contains(lowerQuery) ||
            orderId.toLowerCase().contains(lowerQuery)) {
          suggestions.add(SearchSuggestion(
            text: '#${orderNumber.toUpperCase()}',
            subtitle: data['orderStatus'] as String?,
            type: SuggestionType.orderId,
            orderId: orderId,
          ));
        }

        // Match customer name
        final deliveryAddress = data['deliveryAddress'] as Map<String, dynamic>?;
        final customerName = deliveryAddress?['name'] as String? ?? '';
        if (customerName.toLowerCase().contains(lowerQuery)) {
          suggestions.add(SearchSuggestion(
            text: customerName,
            subtitle: '#$orderNumber',
            type: SuggestionType.customer,
            orderId: orderId,
          ));
        }

        // Match phone
        final phone = deliveryAddress?['phone'] as String? ?? '';
        if (phone.contains(query)) {
          suggestions.add(SearchSuggestion(
            text: phone,
            subtitle: customerName,
            type: SuggestionType.phone,
            orderId: orderId,
          ));
        }

        // Match product names
        final items = data['items'] as List<dynamic>? ?? [];
        for (final item in items) {
          final productName = (item as Map<String, dynamic>)['name'] as String? ?? '';
          if (productName.toLowerCase().contains(lowerQuery)) {
            suggestions.add(SearchSuggestion(
              text: productName,
              subtitle: '#$orderNumber',
              type: SuggestionType.product,
              orderId: orderId,
            ));
            break; // One product match per order
          }
        }

        if (suggestions.length >= 8) break;
      }

      // Remove duplicates
      final uniqueSuggestions = <String, SearchSuggestion>{};
      for (final s in suggestions) {
        uniqueSuggestions['${s.type}:${s.text}'] = s;
      }

      setState(() {
        _suggestions = uniqueSuggestions.values.take(6).toList();
      });

      if (_suggestions.isNotEmpty && _focusNode.hasFocus) {
        _showOverlay();
      }
    } catch (e) {
      debugPrint('Search error: $e');
    }
  }

  void _showOverlay() {
    _hideOverlay();
    _overlayEntry = OverlayEntry(
      builder: (context) => _buildSuggestionsOverlay(),
    );
    Overlay.of(context).insert(_overlayEntry!);
    _showSuggestions = true;
  }

  void _hideOverlay() {
    _overlayEntry?.remove();
    _overlayEntry = null;
    _showSuggestions = false;
  }

  Widget _buildSuggestionsOverlay() {
    return Positioned(
      width: MediaQuery.of(context).size.width - 32,
      child: CompositedTransformFollower(
        link: _layerLink,
        showWhenUnlinked: false,
        offset: const Offset(0, 54),
        child: Material(
          elevation: 8,
          borderRadius: BorderRadius.circular(12),
          color: widget.isDark ? const Color(0xFF1E1E2E) : Colors.white,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: _suggestions.map((suggestion) {
                return InkWell(
                  onTap: () {
                    HapticFeedback.selectionClick();
                    _searchController.text = suggestion.text;
                    widget.onSearchSubmitted(suggestion.orderId ?? suggestion.text);
                    _hideOverlay();
                    _focusNode.unfocus();
                  },
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                    child: Row(
                      children: [
                        Icon(
                          suggestion.icon,
                          size: 18,
                          color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                suggestion.text,
                                style: TextStyle(
                                  color: widget.isDark ? Colors.white : Colors.black87,
                                  fontWeight: FontWeight.w500,
                                ),
                              ),
                              if (suggestion.subtitle != null)
                                Text(
                                  suggestion.subtitle!,
                                  style: TextStyle(
                                    color: widget.isDark ? Colors.grey[500] : Colors.grey[600],
                                    fontSize: 12,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        Icon(
                          Icons.north_west_rounded,
                          size: 14,
                          color: Colors.grey[500],
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _placeholderTimer?.cancel();
    _searchController.dispose();
    _focusNode.dispose();
    _hideOverlay();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Search Bar Row
        Row(
          children: [
            // Main Search Field
            Expanded(
              child: CompositedTransformTarget(
                link: _layerLink,
                child: Container(
                  height: 50,
                  decoration: BoxDecoration(
                    color: widget.isDark ? Colors.white.withValues(alpha: 0.08) : Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: _focusNode.hasFocus
                          ? AppColors.primary
                          : (widget.isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.2)),
                      width: _focusNode.hasFocus ? 1.5 : 1,
                    ),
                    boxShadow: [
                      if (!widget.isDark)
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.04),
                          blurRadius: 8,
                          offset: const Offset(0, 2),
                        ),
                    ],
                  ),
                  child: TextField(
                    controller: _searchController,
                    focusNode: _focusNode,
                    style: TextStyle(
                      color: widget.isDark ? Colors.white : Colors.black,
                      fontSize: 14,
                    ),
                    decoration: InputDecoration(
                      hintText: _placeholders[_currentPlaceholder],
                      hintStyle: TextStyle(
                        color: widget.isDark ? Colors.grey[500] : Colors.grey[400],
                        fontSize: 14,
                      ),
                      prefixIcon: Icon(
                        Icons.search_rounded,
                        color: widget.isDark ? Colors.grey[500] : Colors.grey[400],
                      ),
                      suffixIcon: _searchController.text.isNotEmpty
                          ? IconButton(
                              icon: Icon(
                                Icons.close_rounded,
                                color: widget.isDark ? Colors.grey[500] : Colors.grey[600],
                                size: 20,
                              ),
                              onPressed: () {
                                _searchController.clear();
                                widget.onSearchChanged('');
                                _hideOverlay();
                              },
                            )
                          : null,
                      border: InputBorder.none,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    ),
                    onChanged: _onSearchChanged,
                    onSubmitted: (val) {
                      widget.onSearchSubmitted(val);
                      _hideOverlay();
                    },
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8),
            
            // Sort Dropdown (Compact)
            _buildSortDropdown(),
            const SizedBox(width: 8),
            
            // Advanced Filter Button
            _buildActionButton(
              icon: Icons.tune_rounded,
              onTap: widget.onAdvancedFilterTap,
              hasIndicator: widget.advancedFilterCount > 0,
            ),
          ],
        ),
        
        // Quick Filter Chips
        const SizedBox(height: 12),
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            children: QuickFilter.values.map((filter) {
              final isActive = widget.activeFilters.contains(filter);
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: _buildFilterChip(filter, isActive),
              );
            }).toList(),
          ),
        ),
        
        // Active Filters Row (Quick + Advanced)
        if (widget.activeFilters.isNotEmpty || widget.advancedFilterCount > 0) ...[
          const SizedBox(height: 12),
          _buildActiveFiltersRow(),
        ],
      ],
    );
  }

  Widget _buildSortDropdown() {
    final sortOptions = [
      'Newest',
      'Oldest',
      'High → Low',
      'Low → High',
      'A → Z',
      'Z → A',
    ];

    return Container(
      height: 50,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: widget.isDark ? Colors.white.withValues(alpha: 0.08) : Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: widget.isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.2),
        ),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<int>(
          value: sortOptions.indexOf(widget.currentSortLabel),
          icon: Icon(
            Icons.keyboard_arrow_down_rounded,
            color: widget.isDark ? Colors.grey[400] : Colors.grey[600],
            size: 18,
          ),
          dropdownColor: widget.isDark ? const Color(0xFF1E1E2E) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          items: sortOptions.asMap().entries.map((entry) {
            return DropdownMenuItem<int>(
              value: entry.key,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.sort_rounded,
                    size: 14,
                    color: widget.isDark ? Colors.grey[500] : Colors.grey[600],
                  ),
                  const SizedBox(width: 6),
                  Text(
                    entry.value,
                    style: TextStyle(
                      fontSize: 12,
                      color: widget.isDark ? Colors.white : Colors.black87,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            );
          }).toList(),
          onChanged: (index) {
            if (index != null) {
              HapticFeedback.selectionClick();
              widget.onSortChanged(index);
            }
          },
        ),
      ),
    );
  }

  Widget _buildActionButton({
    required IconData icon,
    required VoidCallback onTap,
    bool hasIndicator = false,
  }) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          height: 50,
          width: 50,
          decoration: BoxDecoration(
            color: widget.isDark ? Colors.white.withValues(alpha: 0.08) : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: widget.isDark ? Colors.white.withValues(alpha: 0.1) : Colors.grey.withValues(alpha: 0.2),
            ),
          ),
          child: IconButton(
            icon: Icon(icon, color: widget.isDark ? Colors.white : Colors.grey[800]),
            onPressed: () {
              HapticFeedback.lightImpact();
              onTap();
            },
          ),
        ),
        if (hasIndicator)
          Positioned(
            top: 6,
            right: 6,
            child: Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: AppColors.primary,
                shape: BoxShape.circle,
                border: Border.all(color: widget.isDark ? Colors.black : Colors.white, width: 1.5),
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildFilterChip(QuickFilter filter, bool isActive) {
    return GestureDetector(
      onTap: () {
        HapticFeedback.lightImpact();
        widget.onFilterToggled(filter);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: isActive
              ? filter.color.withValues(alpha: 0.15)
              : (widget.isDark ? Colors.white.withValues(alpha: 0.05) : Colors.grey.withValues(alpha: 0.08)),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(
            color: isActive ? filter.color : Colors.transparent,
            width: 1.5,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              filter.icon,
              size: 16,
              color: isActive ? filter.color : (widget.isDark ? Colors.grey[400] : Colors.grey[600]),
            ),
            const SizedBox(width: 6),
            Text(
              filter.label,
              style: TextStyle(
                color: isActive ? filter.color : (widget.isDark ? Colors.grey[300] : Colors.grey[700]),
                fontSize: 12,
                fontWeight: isActive ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActiveFiltersRow() {
    return Row(
      children: [
        Text(
          'Active: ',
          style: TextStyle(
            color: widget.isDark ? Colors.grey[500] : Colors.grey[600],
            fontSize: 12,
          ),
        ),
        Expanded(
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                // Quick filter chips
                ...widget.activeFilters.map((filter) {
                  return Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: GestureDetector(
                      onTap: () => widget.onFilterToggled(filter),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: filter.color.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              filter.label,
                              style: TextStyle(
                                color: filter.color,
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(Icons.close, size: 12, color: filter.color),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
                // Advanced filters badge
                if (widget.advancedFilterCount > 0)
                  Padding(
                    padding: const EdgeInsets.only(right: 6),
                    child: GestureDetector(
                      onTap: widget.onClearAdvancedFilters ?? widget.onAdvancedFilterTap,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '+${widget.advancedFilterCount} filters',
                              style: TextStyle(
                                color: AppColors.primary,
                                fontSize: 11,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(width: 4),
                            Icon(Icons.close, size: 12, color: AppColors.primary),
                          ],
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        GestureDetector(
          onTap: () {
            // Clear quick filters
            for (final filter in widget.activeFilters.toList()) {
              widget.onFilterToggled(filter);
            }
            // Clear advanced filters
            widget.onClearAdvancedFilters?.call();
          },
          child: Text(
            'Clear All',
            style: TextStyle(
              color: AppColors.primary,
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ],
    );
  }
}
