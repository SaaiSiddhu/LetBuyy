'use strict';

const { renameComponent } = require('./common.cjs');

module.exports = function transform(fileInfo) {
    return [
        ['PageShell', 'Page'],
        ['PageActions', 'PageHeaderActions'],
        ['TableFilterBar', 'FilterBar'],
    ].reduce((source, [from, to]) => renameComponent(source, from, to), fileInfo.source);
};
