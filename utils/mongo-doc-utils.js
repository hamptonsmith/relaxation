'use strict';

const fieldNameUtils = require('./field-name-utils');

module.exports = {
    fromMongoDoc(doc) {
        return Object.fromEntries(Object.entries(doc)
                .map(([key, value]) => [
                    fieldNameUtils.mongoToRelax(key),
                    value
                ])

                // Some mongo fields (e.g., createdAt_sboe) shouldn't be
                // returned as part of the entry value
                .filter(([key, value]) => key !== null));
    },

    toMongoDoc(entity) {
        return Object.fromEntries(Object.entries(entity)
                .map(([key, value]) => [
                    fieldNameUtils.relaxToMongo(key),
                    value
                ]));
    }
};
