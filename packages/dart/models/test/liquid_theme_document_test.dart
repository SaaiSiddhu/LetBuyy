import 'dart:convert';
import 'package:flutter_test/flutter_test.dart';
import 'package:letbuyy_models/merchant_contracts.dart';

Map<String, dynamic> fixture(String slug) => {
  'themeId': slug,
  'rendererEngine': 'liquid',
  'unknownRoot': {'retained': true},
  'liquidBundle': {
    'package': {'slug': slug, 'version': '2.1.0'},
    'renderer': {'engine': 'liquid'},
    'sections': {
      'niche-hero': {
        'source': 'Immutable synthetic source; not a renderer fixture.',
      },
    },
    'config': {
      'settings_data': {
        'current': {'primaryColor': '#123456'},
      },
    },
  },
  'templates': {
    'index': {
      'name': 'Home',
      'order': ['hero', 'content'],
      'retainedMeta': 'index',
      'sections': {
        'hero': {
          'type': 'niche-hero',
          'settings': {
            'heading': 'Original',
            'unknown': {'keep': 2},
          },
          'blocks': {
            'one': {
              'type': 'custom-card',
              'settings': {'title': 'Parent'},
              'blocks': {
                'child': {
                  'type': 'badge',
                  'settings': {'label': 'Original badge'},
                },
              },
              'block_order': ['child'],
            },
          },
          'block_order': ['one'],
        },
        'content': {
          'type': 'niche-content',
          'settings': {'copy': 'Retain sibling'},
        },
      },
    },
    'product': {
      'name': 'Product',
      'order': ['detail'],
      'sections': {
        'detail': {
          'type': 'niche-product',
          'settings': {'privateNote': 'Untouched page'},
        },
      },
    },
    'header': {
      'order': ['announcement', 'navigation'],
      'sections': {
        'announcement': {
          'type': 'announcement-bar',
          'settings': {'text': 'Original announcement'},
        },
        'navigation': {
          'type': 'niche-navigation',
          'settings': {'menu': 'menu-1'},
        },
      },
    },
    'footer': {
      'order': ['footer'],
      'sections': {
        'footer': {
          'type': 'niche-footer',
          'settings': {'text': 'Original footer'},
        },
      },
    },
  },
  'settings_data': {
    'current': {'primaryColor': '#123456'},
    'presets': {
      'Original': {'primaryColor': '#123456'},
    },
    'unknownData': true,
  },
  'config': {
    'settings_data': {
      'current': {'primaryColor': '#123456'},
      'retained': 'config-data',
    },
    'retained': 'config',
  },
};
Map<String, dynamic> copy(Map<String, dynamic> v) =>
    Map<String, dynamic>.from(jsonDecode(jsonEncode(v)) as Map);

void main() {
  // These are frontend conservation tests. Actual ten-theme package/API/native
  // journeys remain separate acceptance, never inferred from these fixtures.
  for (final slug in [
    'forge',
    'sense',
    'aura',
    'craft',
    'refresh',
    'ride',
    'dawn',
    'bloom',
    'nova',
    'summit',
  ]) {
    test(
      'retains unknown niche sections, other pages, nested blocks and immutable bundle: $slug',
      () {
        final input = fixture('letbuyy-$slug'), original = copy(input);
        final document = LiquidThemeDocument(input);
        document.setSectionSetting(
          'index',
          'template',
          'hero',
          'heading',
          'Native edit',
        );
        document.setBlockSetting(
          'index',
          'template',
          'hero',
          ['one', 'child'],
          'label',
          'Native badge',
        );
        final saved = document.toConfig('index');
        expect(
          input,
          original,
          reason: 'Caller-owned payload must remain immutable',
        );
        expect(saved['liquidBundle'], original['liquidBundle']);
        expect(
          (saved['templates'] as Map)['product'],
          (original['templates'] as Map)['product'],
        );
        expect(
          (saved['templates'] as Map)['header'],
          (original['templates'] as Map)['header'],
        );
        expect(
          (saved['templates'] as Map)['footer'],
          (original['templates'] as Map)['footer'],
        );
        final sections =
            ((saved['templates'] as Map)['index'] as Map)['sections'] as Map;
        expect((sections['hero'] as Map)['type'], 'niche-hero');
        expect(
          ((sections['hero'] as Map)['settings'] as Map)['heading'],
          'Native edit',
        );
        expect(((sections['hero'] as Map)['settings'] as Map)['unknown'], {
          'keep': 2,
        });
        expect(
          sections['content'],
          (((original['templates'] as Map)['index'] as Map)['sections']
              as Map)['content'],
        );
        final parent =
            ((sections['hero'] as Map)['blocks'] as Map)['one'] as Map;
        expect((parent['settings'] as Map)['title'], 'Parent');
        expect(
          (((parent['blocks'] as Map)['child'] as Map)['settings']
              as Map)['label'],
          'Native badge',
        );
        expect(saved['unknownRoot'], original['unknownRoot']);
        final projection = (saved['sections'] as Map)['template'] as List;
        expect(projection.map((s) => (s as Map)['type']), [
          'niche-hero',
          'niche-content',
        ]);
        expect(document.sections('index', 'header').map((s) => s['id']), [
          'announcement',
          'navigation',
        ]);
      },
    );
  }
  test(
    'settings edits preserve presets, other aliases and unknown saved metadata',
    () {
      final source = fixture('letbuyy-forge'),
          document = LiquidThemeDocument(source);
      document.setThemeSetting('primaryColor', '#abcdef');
      final saved = document.toConfig('index');
      expect((saved['themeSettings'] as Map)['primaryColor'], '#abcdef');
      expect(
        ((saved['settings_data'] as Map)['current'] as Map)['primaryColor'],
        '#abcdef',
      );
      expect(
        ((saved['config'] as Map)['settings_data'] as Map)['retained'],
        'config-data',
      );
      expect(
        (saved['settings_data'] as Map)['presets'],
        (source['settings_data'] as Map)['presets'],
      );
      expect((saved['settings_data'] as Map)['unknownData'], true);
      expect(saved['liquidBundle'], source['liquidBundle']);
    },
  );
  test(
    'reordering and visibility are confined to the selected portable group',
    () {
      final source = fixture('letbuyy-sense'),
          document = LiquidThemeDocument(source);
      document.moveSection('index', 'header', 'navigation', -1);
      document.setVisible('index', 'template', 'hero', false);
      expect(document.sections('index', 'header').map((s) => s['id']), [
        'navigation',
        'announcement',
      ]);
      expect(document.sections('index', 'template').first['visible'], false);
      expect(
        (document.snapshot()['templates'] as Map)['product'],
        (source['templates'] as Map)['product'],
      );
    },
  );
  test(
    'unknown/missing templates and stale block identities refuse without a fallback draft',
    () {
      final document = LiquidThemeDocument(fixture('letbuyy-craft')),
          before = document.snapshot();
      expect(
        () => document.setSectionSetting(
          'missing',
          'template',
          'hero',
          'heading',
          'wrong',
        ),
        throwsFormatException,
      );
      expect(
        () => document.setBlockSetting(
          'index',
          'template',
          'hero',
          ['unknown'],
          'label',
          'wrong',
        ),
        throwsFormatException,
      );
      expect(document.snapshot(), before);
      expect(
        () => LiquidThemeDocument({'templates': {}}),
        throwsFormatException,
      );
    },
  );
}
