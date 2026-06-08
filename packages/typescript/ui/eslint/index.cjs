'use strict';

const HEX_COLOR_PATTERN = /(^|[^\w-])#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])/;
const RGB_HSL_COLOR_PATTERN = /\b(?:rgba?|hsla?)\(/;
// Tailwind built-in palette utilities that bypass the --lb-* token system.
const TAILWIND_DEFAULT_COLOR_PATTERN = /\b(?:bg|text|border|ring|ring-offset|divide|outline|fill|stroke|from|via|to|placeholder|caret|accent|decoration|shadow)-(?:white|black|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)(?:-(?:50|100|200|300|400|500|600|700|800|900|950))?\b/;
const RAW_ELEMENT_REPLACEMENTS = {
    button: 'Button',
    input: 'Input',
    table: 'Table',
};
// Form controls + native dialog the design system supersedes. Reported by a
// separate (warn-level) rule so consuming apps that pin no-raw-elements to
// `error` do not break until they opt in / migrate.
const RAW_FORM_CONTROL_REPLACEMENTS = {
    select: 'Select',
    textarea: 'Textarea',
    dialog: 'Modal',
};

function getJsxName(node) {
    if (!node || !node.name) return undefined;
    if (node.name.type === 'JSXIdentifier') return node.name.name;
    return undefined;
}

function reportRawElement(context, node, rawName, replacements, messageId) {
    const replacement = replacements[rawName];
    context.report({
        node,
        messageId,
        data: { rawName, replacement },
        suggest: [
            {
                desc: `Replace <${rawName}> with <${replacement}> from @letbuyy/ui.`,
                fix(fixer) {
                    return fixer.replaceText(node.name, replacement);
                },
            },
        ],
    });
}

const noRawElements = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Prefer @letbuyy/ui primitives over raw interactive/table elements.',
            recommended: true,
        },
        hasSuggestions: true,
        messages: {
            rawElement: 'Use @letbuyy/ui {{ replacement }} instead of raw <{{ rawName }}> to preserve tokens, focus states, and a11y defaults.',
        },
        schema: [],
    },
    create(context) {
        return {
            JSXOpeningElement(node) {
                const rawName = getJsxName(node);
                if (rawName && Object.prototype.hasOwnProperty.call(RAW_ELEMENT_REPLACEMENTS, rawName)) {
                    reportRawElement(context, node, rawName, RAW_ELEMENT_REPLACEMENTS, 'rawElement');
                }
            },
        };
    },
};

const noRawFormControls = {
    meta: {
        type: 'suggestion',
        docs: {
            description: 'Prefer @letbuyy/ui form controls over raw <select>/<textarea>/<dialog>.',
            recommended: true,
        },
        hasSuggestions: true,
        messages: {
            rawFormControl: 'Use @letbuyy/ui {{ replacement }} instead of raw <{{ rawName }}> to preserve tokens, focus states, labels, and a11y defaults.',
        },
        schema: [],
    },
    create(context) {
        return {
            JSXOpeningElement(node) {
                const rawName = getJsxName(node);
                if (rawName && Object.prototype.hasOwnProperty.call(RAW_FORM_CONTROL_REPLACEMENTS, rawName)) {
                    reportRawElement(context, node, rawName, RAW_FORM_CONTROL_REPLACEMENTS, 'rawFormControl');
                }
            },
        };
    },
};

function makeColorRule(pattern, messageId, message, description) {
    return {
        meta: {
            type: 'problem',
            docs: { description, recommended: true },
            messages: { [messageId]: message },
            schema: [],
        },
        create(context) {
            function inspectValue(node, value) {
                if (typeof value === 'string' && pattern.test(value)) {
                    context.report({ node, messageId });
                }
            }
            return {
                Literal(node) {
                    inspectValue(node, node.value);
                },
                TemplateElement(node) {
                    inspectValue(node, node.value && (node.value.cooked || node.value.raw));
                },
                JSXText(node) {
                    inspectValue(node, node.value);
                },
            };
        },
    };
}

const noHardcodedHex = makeColorRule(
    HEX_COLOR_PATTERN,
    'hardcodedHex',
    'Use a @letbuyy/ui token or --lb-* CSS variable instead of a hardcoded hex color.',
    'Prefer @letbuyy/ui CSS variables and token exports over hardcoded hex colors.',
);

const noRawColorFunctions = makeColorRule(
    RGB_HSL_COLOR_PATTERN,
    'rawColorFunction',
    'Use a @letbuyy/ui token or --lb-* CSS variable instead of a raw rgb()/hsl() color.',
    'Prefer @letbuyy/ui CSS variables and token exports over raw rgb()/hsl() colors.',
);

const noTailwindDefaultColor = makeColorRule(
    TAILWIND_DEFAULT_COLOR_PATTERN,
    'tailwindDefaultColor',
    'Use a token-backed utility (e.g. bg-[var(--lb-color-surface)]) instead of a Tailwind default-palette color class; default-palette colors bypass --lb-* tokens and do not theme.',
    'Prefer @letbuyy/ui token utilities over Tailwind default-palette color classes.',
);

module.exports = {
    rules: {
        'no-raw-elements': noRawElements,
        'no-hardcoded-hex': noHardcodedHex,
        'no-raw-form-controls': noRawFormControls,
        'no-raw-color-functions': noRawColorFunctions,
        'no-tailwind-default-color': noTailwindDefaultColor,
    },
    configs: {
        recommended: {
            plugins: ['@letbuyy/ui'],
            rules: {
                '@letbuyy/ui/no-raw-elements': 'error',
                '@letbuyy/ui/no-hardcoded-hex': 'error',
                '@letbuyy/ui/no-raw-form-controls': 'warn',
                '@letbuyy/ui/no-raw-color-functions': 'warn',
                '@letbuyy/ui/no-tailwind-default-color': 'warn',
            },
        },
    },
};
