'use strict';

module.exports = {
    fromMongoDoc(doc) {
        const result = Object.fromEntries(Object.entries(doc)
                .map(([key, value]) => [
                    key.startsWith('__') ? key.substring(2) : key,
                    value
                ]));

        if ('_id' in result) {
            result.id = result._id;
            delete result._id;
        }

        return result;
    },

    toMongoDoc(entity) {
        const result = Object.fromEntries(Object.entries(entity)
                .map(([key, value]) => [
                    key.startsWith('_') ? `__${key}` : key,
                    value
                ]));

        if ('id' in result) {
            result._id = result.id;
            delete result.id;
        }

        return result;
    }
};
