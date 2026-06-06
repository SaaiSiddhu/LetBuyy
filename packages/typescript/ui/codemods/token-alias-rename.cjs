'use strict';

const { replaceAll } = require('./common.cjs');

const canonicalTokenReplacements = [
    ['--lb-color-text-primary', '--lb-color-text'],
    ['--lb-color-text-secondary', '--lb-color-text-subdued'],
    ['--lb-color-border-default', '--lb-color-border'],
    ['--lb-color-border-subtle', '--lb-color-border'],
    ['--lb-color-danger', '--lb-color-critical'],
    ['--lb-semantic-focus-ring', '--lb-color-focus-ring'],
    ['--lb-semantic-accent-brand', '--lb-color-primary'],
    ['--lb-semantic-accent-text', '--lb-color-primary-text'],
    ['--lb-semantic-text-primary', '--lb-color-text'],
    ['--lb-semantic-text-secondary', '--lb-color-text-subdued'],
    ['--lb-semantic-text-muted', '--lb-color-text-muted'],
];

module.exports = function transform(fileInfo) {
    return replaceAll(fileInfo.source, canonicalTokenReplacements);
};

module.exports.canonicalTokenReplacements = canonicalTokenReplacements;
