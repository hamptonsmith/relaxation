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
    id: '_id',
    updatedAt: 'updatedAt_sboe'
};

module.exports = {
    mongoToRelax(m) {
        let relaxFieldName;
        if (reverseAliases[m]) {
            relaxFieldName = reverseAliases[m];
        }
        else if (m.startsWith('__')) {
            relaxFieldName = m.substring(1);
        }
        else if (Object.values(metafields).includes(m)) {
            relaxFieldName = null;
        }
        else {
            relaxFieldName = m.startsWith('$') ? `$${m}` : m;
        }

        return relaxFieldName;
    },
    relaxToMongo(r) {
        let mongoFieldName;
        if (aliases[r]) {
            mongoFieldName = aliases[r];
        }
        else if (r.startsWith('_')) {
            mongoFieldName = `_${r}`;
        }
        else if (r.startsWith('$') && !r.startsWith('$$')) {
            mongoFieldName = metafields[r.substring(1)];

            if (!mongoFieldName) {
                throw new Error('No such metafield: ' + r);
            }
        }
        else {
            mongoFieldName = r.startsWith('$$') ? r.substring(1) : r;
        }

        return mongoFieldName;
    }
};
