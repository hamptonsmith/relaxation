'use strict';

const fieldNames = require('./field-name-utils');

const { toMongoDoc } = require('./mongo-doc-utils');

const orderingMetafields = {
    createdAt: 'createdAt_sboe',
    eTag: 'version_sboe',
    id: '_id',
    updatedAt: 'updatedAt_sboe'
};

module.exports = ordering => {
    const result = ordering.reduce((accum = {}, relaxKeyEntry) => {
        if (Object.keys(relaxKeyEntry).length !== 1) {
            throw new Error('fields entry must contain exactly one key.'
                    + ' Got: ' + util.inspect(val));
        }

        const [ rawKey, direction ] = Object.entries(relaxKeyEntry)[0];

        if (direction !== 1 && direction !== -1) {
            throw new Error(`for index field "${rawKey}", must specify 1 or -1 `
                    + `as a direction. Got: ${util.inspect(direction)}`);
        }

        accum[fieldNames.relaxFieldSpecifierToMongo(rawKey)] = direction;
        
        return accum;
    }, {});

    // Always the final tie-breaker.
    if (!('_id' in result)) {
        result._id = 1;
    }

    return result;
};
