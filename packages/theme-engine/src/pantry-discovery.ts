/** Same-response canonical fields preserve unedited filters; only supplied food choices become controls. */
export const PANTRY_FILTERS = `
{% assign pantry_show_pack = false %}
{% assign pantry_pack_value = '' %}
{% for field in collection.discovery_query_fields %}{% if field.key == 'pack_size' %}{% assign pantry_pack_value = field.value %}{% endif %}{% endfor %}
{% if collection.food_filters.enabled and collection.food_filters.pack_sizes.size > 0 %}
  {% if pantry_pack_value == blank %}{% assign pantry_show_pack = true %}{% endif %}
  {% for pack in collection.food_filters.pack_sizes %}{% if pack.value == pantry_pack_value %}{% assign pantry_show_pack = true %}{% endif %}{% endfor %}
{% endif %}
{% assign pantry_sort_options = collection.sort_options | default: collection.food_filters.sort_options %}
<section class="pn-discovery" data-section-id="{{ section.id }}"><div class="pn-wrap pn-section">
<p class="pn-eyebrow">Choose a shelf. Read the details.</p><h1>{{ collection.title | default: section.settings.title | default: 'Pantry products' }}</h1>
{% if collection.description != blank %}<p>{{ collection.description }}</p>{% endif %}
{% if collection.total != nil %}<p class="pn-meta">{{ collection.total }} products</p>{% endif %}
<form class="pn-filters" method="get" action="{{ request.path }}">
{% for field in collection.discovery_query_fields %}
  {% assign pantry_preserve_field = true %}
  {% if field.key == 'page' %}{% assign pantry_preserve_field = false %}
  {% elsif field.key == 'search' and section.settings.showSearch != false %}{% assign pantry_preserve_field = false %}
  {% elsif field.key == 'pack_size' and pantry_show_pack %}{% assign pantry_preserve_field = false %}
  {% elsif field.key == 'sort' and pantry_sort_options.size > 0 %}{% assign pantry_preserve_field = false %}
  {% elsif field.key == 'min_price' or field.key == 'max_price' %}{% if collection.food_filters.enabled %}{% assign pantry_preserve_field = false %}{% endif %}
  {% endif %}
  {% if pantry_preserve_field %}<input type="hidden" name="{{ field.key }}" value="{{ field.value }}">{% endif %}
{% endfor %}
{% if section.settings.showSearch != false %}<label>Search products or ingredients<input type="search" name="search" value="{{ request.query.search }}" placeholder="{{ section.settings.placeholder }}" maxlength="200"></label>{% endif %}
{% if pantry_show_pack %}<label>Pack size<select name="pack_size"><option value="">Any pack size</option>{% for pack in collection.food_filters.pack_sizes %}<option value="{{ pack.value }}"{% if pack.selected or request.query.pack_size == pack.value %} selected{% endif %}>{{ pack.label }}</option>{% endfor %}</select></label>
{% elsif pantry_pack_value != blank %}<p class="pn-meta">The current pack filter is not among the supplied choices. Remove it to choose another pack.</p>{% endif %}
{% if collection.food_filters.enabled %}<label>Minimum price<input name="min_price" type="number" min="0" step="0.01" value="{{ request.query.min_price }}"></label><label>Maximum price<input name="max_price" type="number" min="0" step="0.01" value="{{ request.query.max_price }}"></label>{% endif %}
{% if pantry_sort_options.size > 0 %}<label>Sort<select name="sort">{% for option in pantry_sort_options %}<option value="{{ option.value }}"{% if option.selected or request.query.sort == option.value %} selected{% endif %}>{{ option.label }}</option>{% endfor %}</select></label>{% endif %}
<button class="pn-button" type="submit">Apply</button>
{% for filter in collection.active_filters %}<a class="pn-link" href="{{ filter.clear_url }}" aria-label="Remove {{ filter.label }}">{% if filter.key == 'pack_size' %}Remove pack filter{% else %}Remove {{ filter.label }}{% endif %}</a>{% endfor %}
<a class="pn-link" href="{{ collection.clear_filters_url | default: request.path }}">Clear all filters</a>
</form></div></section>`;

export const PANTRY_PAGINATION = `<nav class="pn-pagination" aria-label="Product pages">{% if collection.pagination.previous_url != blank %}<a class="pn-link" href="{{ collection.pagination.previous_url }}">Previous</a>{% endif %}{% if collection.pagination.page %}<span>Page {{ collection.pagination.page }}</span>{% endif %}{% if collection.pagination.next_url != blank %}<a class="pn-link" href="{{ collection.pagination.next_url }}">Next</a>{% endif %}</nav>`;
