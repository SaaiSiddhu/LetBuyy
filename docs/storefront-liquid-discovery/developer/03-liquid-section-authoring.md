# Liquid Section Authoring Guide

A Liquid section file is a `.liquid` file stored in `sections/` inside a `LiquidThemePackageBundle`.
It consists of a Liquid HTML template body followed by a mandatory `{% schema %}` / `{% endschema %}`
block.

## File layout

```
sections/hero-banner.liquid
```

```liquid
{%- comment -%}Section key must match the filename stem (hero-banner){%- endcomment -%}
<section data-section-id="{{ section.id }}" class="lb-hero">
  <h1>{{ section.settings.heading | escape }}</h1>
  {% if section.settings.show_button %}
    <a href="{{ section.settings.button_url | escape }}" class="lb-btn">
      {{ section.settings.button_label | escape }}
    </a>
  {% endif %}
</section>

{% schema %}
{
  "name": "Hero Banner",
  "settings": [
    { "id": "heading",      "type": "text",     "label": "Heading",       "default": "Welcome" },
    { "id": "button_label", "type": "text",     "label": "Button label",  "default": "Shop now" },
    { "id": "button_url",   "type": "url",      "label": "Button URL" },
    { "id": "show_button",  "type": "checkbox", "label": "Show button",   "default": true }
  ],
  "blocks": [],
  "presets": [{ "name": "Hero Banner" }],
  "enabled_on":  { "templates": ["*"] },
  "disabled_on": { "templates": [] }
}
{% endschema %}
```

## Key rules

### 1. Section key === filename stem

The key used in `LiquidThemePackageBundle.sections` must equal the filename stem
(no extension). The Zod schema enforces this via `liquidFileTypeFromPath(section.path)`.

Correct:
```json
{ "hero-banner": { "path": "sections/hero-banner.liquid", ... } }
```

Wrong:
```json
{ "heroBanner": { "path": "sections/hero-banner.liquid", ... } }
```

### 2. `{% schema %}` block is required

Every section must have exactly one `{% schema %}` / `{% endschema %}` pair.
The Zod schema checks for it; `lintThemeBundle` flags its absence as a `missing-schema-block` error.

### 3. Forbidden tags

The following tags are **stripped by DOMPurify** at render time and are **rejected by the Zod
schema** at parse time and **flagged as errors** by the linter:

| Tag | Rule |
|-----|------|
| `<script>` | `forbidden-tag` |
| `<embed>` | `forbidden-tag` |
| `<object>` | `forbidden-tag` |
| `<base>` | `forbidden-tag` |

Additionally, the Zod source validator (before DOMPurify) also rejects:
- `javascript:` URIs
- `data:text/html` URIs
- `{% include %}` (use sections + blocks instead)
- `{% layout %}` (layout is handled by `layout/theme.liquid`)
- `{% render %}` (not supported in this tier)

### 4. No inline `style=` attributes

`style=` attributes are stripped by DOMPurify and flagged as `forbidden-style-attr` errors
by the linter. Use class-based styling with `@letbuyy/ui` design tokens (`--lb-*`) instead.

### 5. Always escape user data

Use the `| escape` filter on any value that could contain user input:

```liquid
{{ section.settings.heading | escape }}
{{ product.title | escape }}
```

### 6. `section.settings.*` must be declared in the schema

`lintThemeBundle` warns when `{{ section.settings.X }}` appears in the source but `X` is not
declared in `schema.settings`. This is a best-effort heuristic; false positives are possible
for dynamic access patterns.

## Schema field types

The `ThemeLiquidSchemaSettingFieldSchema` accepts these `type` values (from `theme-bundle.ts`):
`text`, `textarea`, `number`, `checkbox`, `radio`, `select`, `url`, `color`, `image_picker`,
`range`, `richtext`, `html`, `font_picker`, `collection`, `product`, `blog`, `page`, `link_list`,
`header`, `paragraph`.

## Blocks

Blocks are optional content units within a section. They appear inside a `{% for block in section.blocks %}` loop.

```liquid
{% for block in section.blocks %}
  <div class="lb-block" {{ block.shopify_attributes }}>
    {{ block.settings.text | escape }}
  </div>
{% endfor %}
```

In the schema, declare accepted block types under `"blocks"`:

```json
"blocks": [
  {
    "type": "text",
    "name": "Text",
    "settings": [
      { "id": "text", "type": "text", "label": "Text", "default": "Write something" }
    ]
  }
]
```

## Parity coverage

The `THEME_LIQUID_PORTABLE_SECTION_PARITY` map (in `theme-governance.ts`) tracks which
React section types have corresponding Liquid implementations. Currently 20 entries.

The `createLiquidParitySectionFiles()` function (in `theme-bundle.ts`) returns the 23
kebab-case parity section files included in the Urban Kicks fixture.

Section types in neither `BUILT_IN_SECTION_SCHEMAS` (camelCase React) nor the parity set
are flagged as `unknown-section-type` warnings by the linter — this is fine for private or
theme-specific sections.
