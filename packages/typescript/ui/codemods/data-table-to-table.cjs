'use strict';

const { renameComponent } = require('./common.cjs');

function renameDataPropOnTable(source) {
    let output = '';
    let index = 0;

    while (index < source.length) {
        const start = source.indexOf('<Table', index);
        if (start === -1) {
            output += source.slice(index);
            break;
        }

        output += source.slice(index, start);

        let cursor = start;
        let braceDepth = 0;
        let quote = null;

        while (cursor < source.length) {
            const char = source[cursor];
            const previous = source[cursor - 1];

            if (quote) {
                if (char === quote && previous !== '\\') quote = null;
            } else if (char === '"' || char === '\'' || char === '`') {
                quote = char;
            } else if (char === '{') {
                braceDepth += 1;
            } else if (char === '}') {
                braceDepth = Math.max(braceDepth - 1, 0);
            } else if (char === '>' && braceDepth === 0) {
                cursor += 1;
                break;
            }

            cursor += 1;
        }

        output += source.slice(start, cursor).replace(/\bdata=/g, 'rows=');
        index = cursor;
    }

    return output;
}

module.exports = function transform(fileInfo) {
    return renameDataPropOnTable(renameComponent(fileInfo.source, 'DataTable', 'Table'));
};
