'use strict';

const jsonPointer = require('json-pointer');
const lodash = require('lodash');

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

function getByRelaxSpecifier(doc, ent, r) {
    const path = Array.isArray(r) ? r : splitRelaxFieldSpecifierComponents(r);

    let result;
    if (path.length === 0) {
        result = ent;
    }
    else if (path.some(c => c.startsWith('$') && !c.startsWith('$$'))) {
        result = lodash.get(doc, path.map(relaxFieldSpecifierComponentToMongo));
    }
    else {
        result = lodash.get(ent,
                path.map(c => c.startsWith('$') ? c.substring(1) : c));
    }

    return result;
}

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
        result = relaxDocKeyComponentToMongo(
                c.startsWith('$') ? c.substring(1) : c, depth);
    }

    return result;
}

function relaxFieldSpecifierToMongo(r) {
    return splitRelaxFieldSpecifierComponents(r)
            .map(relaxFieldSpecifierComponentToMongo)
            .join('.');
}

function splitRelaxFieldSpecifierComponents(r) {
    let result;
    if (r.startsWith('/')) {
        result = jsonPointer.parse(r);
    }
    else {
        result = r.split('.');

        if (result.length > 1) {
            if (result[0] === '') {
                result.shift();
            }

            if (result[result.length - 1] === '') {
                result.pop();
            }
        }
    }

    return result;
}

module.exports = {
    getByRelaxSpecifier,
    mongoDotSyntaxPathComponentToRelax,
    relaxDocKeyComponentToMongo,
    relaxFieldSpecifierComponentToMongo,
    relaxFieldSpecifierToMongo,
    splitRelaxFieldSpecifierComponents
};
