'use strict';

const fieldNames = require('./field-name-utils');

module.exports = (ordering, reverse) => {
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

        accum[fieldNames.relaxFieldSpecifierToMongo(rawKey)] =
                direction * (reverse ? -1 : 1);

        return accum;
    }, {});

    // Always the final tie-breaker.
    if (!('_id' in result)) {
        result._id = (reverse ? -1 : 1);
    }

    return result;
};
