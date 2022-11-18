'use strict';

const jsonPointer = require('json-pointer');

const aliases = {
    id: '_id'
};

const reverseAliases = Object.fromEntries(
        Object.entries(aliases).map(([k, v]) => [v, k]));

const metafields = {
    createdAt: 'createdAt_sboe',
    eTag: 'version_sboe',
    updatedAt: 'updatedAt_sboe'
};

function mongoDotSyntaxPathComponentToRelax(c, depth) {
    return Object.values(metafields).includes(c) ? null
            : (depth === 0 && c === '_id') ? 'id'
            : decodeURIComponent(c);
}

function relaxDocKeyComponentToMongo(c, depth) {
    return (depth === 0 && c === 'id')
            ? '_id'
            : encodeURIComponent(c).replace(/_/g, '%5f');
}

function relaxFieldSpecifierComponentToMongo(c, depth) {
    let result;

    if (c.startsWith('$') && !c.startsWith('$$')) {
        result = metafields[c.substring(1)];

        if (!result) {
            throw new Error('No such metafield: ' + c);
        }
        else if (depth !== 0) {
            throw new Error('Metafield ' + c + ' invalid except at the '
                    + 'top level.');
        }
    }
    else {
        result = relaxDocKeyComponentToMongo(c, depth);
    }

    return result;
}

function relaxFieldSpecifierToMongo(r) {
    return (r.startsWith('/') ? jsonPointer.parse(r) : r.split('.'))
            .map(relaxFieldSpecifierComponentToMongo)
            .join('.');
}

module.exports = {
    mongoDotSyntaxPathComponentToRelax,
    relaxDocKeyComponentToMongo,
    relaxFieldSpecifierComponentToMongo,
    relaxFieldSpecifierToMongo
};
