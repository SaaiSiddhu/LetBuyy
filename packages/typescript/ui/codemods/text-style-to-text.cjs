'use strict';

const { renameComponent } = require('./common.cjs');

module.exports = function transform(fileInfo) {
    return renameComponent(fileInfo.source, 'TextStyle', 'Text');
};
