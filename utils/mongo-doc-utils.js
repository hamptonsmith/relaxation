'use strict';

const fieldNameUtils = require('./field-name-utils');
const isMongoObjectId = require('./is-mongo-object-id');

// In Mongo:
//
// {
//      _id: ObjectId('abc'),
//      createdAt_sboe: Date(123),
//      foo: {
//          "%5fid": 'foo'
//      },
//      '%24bazz%5fwaldo': Date(456)
// }
//
// + relaxation.mongoToRecord() = entity record:
//
// {
//     id: 'abc',
//     foo: {
//         _id: 'foo'
//     },
//     '$bazz_waldo': Date(456)
// }
//
// Metafields: {
//     $createdAt: '<ISO 8601>'
// }
//
// + user.fromDb() = raw entity:
//
// {
//     id: 'abc',
//     foo: {
//         _id: 'foo'
//     },
//     '$bazz_waldo': Date(456),
//     'plugh': <something weird they add without a toJSON()>
// }
//
// + jsonify = entity
//
// {
//     id: 'abc',
//     foo: {
//         _id: 'foo'
//     },
//     '$bazz_waldo': '<ISO 8601>'
// }

function mongoToRecord(doc, depth = 0) {
    let result;

    if (doc?.__proto__.constructor.name === 'Object') {
        // An embedded document. Note we can't rely on
        // `doc.constructor === Object` because `constructor` is a perfectly
        // valid userspace key.
        result = Object.fromEntries(Object.entries(doc).map(
                ([key, value]) => [
                    fieldNameUtils.mongoDotSyntaxPathComponentToRelax(
                            key, depth),
                    mongoToRecord(value, depth + 1)
                ])

                // Some things in the mongo doc shouldn't end up in our
                // relaxation record (namely things ending in _sboe)
                .filter(([key]) => key !== null));
    }
    else if (doc?.__proto__.constructor.name === 'Array') {
        result = doc.map(el => mongoToRecord(el, depth + 1));
    }
    else {
        // A primitive, a "special" object like Date or Buffer, or a
        // non-promoted BSON type like Long.
        result = doc;
    }

    return result;
}

function recordToMongo(rec, depth = 0) {
    let result;

    if (typeof rec === 'object') {
        if (rec === null || isMongoy(rec)) {
            result = rec;
        }
        else if (Array.isArray(rec)) {
            result = rec.map(el => recordToMongo(el, depth + 1));
        }
        else {
            result = Object.fromEntries(Object.entries(rec).map(
                    ([key, value]) => [
                        fieldNameUtils.relaxFieldSpecifierComponentToMongo(
                                key, depth),
                        recordToMongo(value, depth + 1)
                    ]));
        }
    }
    else {
        result = rec;
    }

    return result;
}

function jsonify(value, visited = new Set()) {
    let result;

    if (typeof value === 'object') {
        if (visited.has(value)) {
            throw new Error('Circular entity.');
        }

        visited.add(value);

        if (value === null) {
            result = null;
        }
        else if (typeof value.toJSON === 'function') {
            result = value.toJSON();
        }
        else if (Array.isArray(value)) {
            result = value.map(el =>
                    el === undefined ? null : jsonify(el, visited));
        }
        else {
            result = Object.fromEntries(Object.entries(value)
                    .filter(([,subValue]) => subValue !== undefined)
                    .map(([key, subValue]) =>
                            [key, jsonify(subValue, visited)]));
        }

        visited.delete(value);
    }
    else {
        result = value;
    }

    return result;
}

function isMongoy(v) {
    return v instanceof Date
            || isMongoObjectId(v)
            || v instanceof Uint8Array
            || v instanceof RegExp

            // Have to make sure an API user didn't just pass some `_bsontype`
            || (v._bsontype
                && !!Object.getOwnPropertyDescriptor(v, '_bsontype'));
}

module.exports = {
    fromMongoDoc: (doc, fromDb) => jsonify(fromDb(mongoToRecord(doc))),
    toMongoDoc : (ent, toDb) => recordToMongo(toDb(ent))
};
