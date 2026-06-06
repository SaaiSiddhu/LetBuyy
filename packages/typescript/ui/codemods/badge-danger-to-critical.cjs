'use strict';

module.exports = function transform(fileInfo) {
    return fileInfo.source
        .replace(/\bvariant=(["'])danger\1/g, 'variant=$1critical$1')
        .replace(/\bvariant=\{(["'])danger\1\}/g, 'variant={$1critical$1}');
};
