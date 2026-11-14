'use strict';

const cssFiles = [
    'apps/**/src/**/*.css',
    'packages/**/src/**/*.css',
];

module.exports = {
    extends: ['stylelint-config-standard'],
    ignoreFiles: [
        '**/node_modules/**',
        '**/.next/**',
        '**/.turbo/**',
        '**/dist/**',
        '**/build/**',
        '**/coverage/**',
        '**/*token*.css',
        '**/letbuyy-tokens*.css',
    ],
    rules: {
        'alpha-value-notation': null,
        'at-rule-no-unknown': [
            true,
            {
                ignoreAtRules: ['custom-variant', 'plugin', 'source', 'tailwind', 'theme'],
            },
        ],
        'at-rule-empty-line-before': null,
        'color-function-alias-notation': null,
        'color-function-notation': null,
        'comment-empty-line-before': null,
        'custom-property-pattern': null,
        'custom-property-empty-line-before': null,
        'declaration-empty-line-before': null,
        'declaration-block-no-redundant-longhand-properties': null,
        'declaration-block-single-line-max-declarations': null,
        'declaration-property-value-keyword-no-deprecated': null,
        'font-family-name-quotes': null,
        'hue-degree-notation': null,
        'import-notation': null,
        'keyframes-name-pattern': null,
        'length-zero-no-unit': null,
        'media-feature-range-notation': null,
        'no-descending-specificity': null,
        'no-duplicate-selectors': null,
        'property-no-deprecated': null,
        'property-no-vendor-prefix': null,
        'rule-empty-line-before': null,
        'selector-class-pattern': null,
        'selector-id-pattern': null,
        'selector-not-notation': null,
        'shorthand-property-no-redundant-values': null,
        'value-keyword-case': null,
    },
    overrides: [
        {
            files: cssFiles,
            rules: {
                'declaration-property-value-no-unknown': [
                    true,
                    {
                        ignoreProperties: {
                            '/.*/': [
                                '/var\\(--/',
                                '/theme\\(/',
                            ],
                        },
                    },
                ],
            },
        },
    ],
};
