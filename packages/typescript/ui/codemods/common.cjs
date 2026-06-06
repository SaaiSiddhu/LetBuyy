'use strict';

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function renameIdentifier(source, from, to) {
    return source.replace(new RegExp(`\\b${escapeRegExp(from)}\\b`, 'g'), to);
}

function dedupeLetbuyyImports(source) {
    return source.replace(/import\s+\{([^}]+)\}\s+from\s+(['"])@letbuyy\/ui\2/g, (match, specifiers, quote) => {
        const seen = new Set();
        const unique = specifiers
            .split(',')
            .map((specifier) => specifier.trim())
            .filter(Boolean)
            .filter((specifier) => {
                if (seen.has(specifier)) return false;
                seen.add(specifier);
                return true;
            });

        return `import { ${unique.join(', ')} } from ${quote}@letbuyy/ui${quote}`;
    });
}

function renameComponent(source, from, to) {
    return dedupeLetbuyyImports(renameIdentifier(source, from, to));
}

function replaceAll(source, replacements) {
    return replacements.reduce((current, [from, to]) => current.split(from).join(to), source);
}

module.exports = {
    dedupeLetbuyyImports,
    renameComponent,
    renameIdentifier,
    replaceAll,
};
