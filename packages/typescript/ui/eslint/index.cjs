'use strict';

const HEX_COLOR_PATTERN = /(^|[^\w-])#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])/;
const RAW_ELEMENT_REPLACEMENTS = {
    button: 'Button',
    input: 'Input',
    table: 'Table',
};

function getJsxName(node) {
    if (!node || !node.name) return undefined;
    if (node.name.type === 'JSXIdentifier') return node.name.name;
    return undefined;
}

function reportRawElement(context, node, rawName) {
    const replacement = RAW_ELEMENT_REPLACEMENTS[rawName];
    context.report({
        node,
        messageId: 'rawElement',
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

function reportHex(context, node) {
    context.report({
        node,
        messageId: 'hardcodedHex',
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
                    reportRawElement(context, node, rawName);
                }
            },
        };
    },
};

const noHardcodedHex = {
    meta: {
        type: 'problem',
        docs: {
            description: 'Prefer @letbuyy/ui CSS variables and token exports over hardcoded hex colors.',
            recommended: true,
        },
        messages: {
            hardcodedHex: 'Use a @letbuyy/ui token or --lb-* CSS variable instead of a hardcoded hex color.',
        },
        schema: [],
    },
    create(context) {
        function inspectValue(node, value) {
            if (typeof value === 'string' && HEX_COLOR_PATTERN.test(value)) {
                reportHex(context, node);
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

module.exports = {
    rules: {
        'no-raw-elements': noRawElements,
        'no-hardcoded-hex': noHardcodedHex,
    },
    configs: {
        recommended: {
            plugins: ['@letbuyy/ui'],
            rules: {
                '@letbuyy/ui/no-raw-elements': 'error',
                '@letbuyy/ui/no-hardcoded-hex': 'error',
            },
        },
    },
};
