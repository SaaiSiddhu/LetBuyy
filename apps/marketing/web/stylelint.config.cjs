'use strict';

// Marketing consumes @letbuyy/ui; legacy layout and illustration geometry stay local.
module.exports = {
    extends: ['../../../.stylelintrc.cjs'],
    rules: {
        'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla'],
        'color-named': 'never',
        'property-disallowed-list': ['/^--lb-/'],
        'declaration-property-value-disallowed-list': {
            'font-size': ['/[-\\d.]+px/'],
            'font-weight': ['/^[0-9]+$/'],
            '/^(padding|margin|gap|row-gap|column-gap)(-|$)/': ['/[-\\d.]+px/'],
        },
    },
};
