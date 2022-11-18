'use strict';

const fieldNameUtils = require('./field-name-utils');

function fromMongoDoc(doc, depth = 0) {
    let result;

    // MongoDB uses "ObjectId", but bson-objectid uses "ObjectID". :shrug:
    if ((doc?.__proto__?.constructor?.name || '')
            .toLowerCase() === 'objectid') {
        result = doc;
    }
    else if (typeof doc?.toJSON === 'function') {
        result = doc.toJSON();
    }
    else if (Array.isArray(doc)) {
        result = doc.map(el => fromMongoDoc(el, depth + 1));
    }
    else if (typeof doc === 'object' && doc !== null) {
        result = Object.fromEntries(Object.entries(doc).map(
                ([key, value]) => [
                    fieldNameUtils.mongoDotSyntaxPathComponentToRelax(
                            key, depth),
                    fromMongoDoc(value, depth + 1)
                ])

                // Some things in the mongo doc shouldn't end up in our
                // relaxation entity.
                .filter(([key]) => key !== null));
    }
    else {
        result = doc;
    }

    return result;
}

function toMongoDoc(entity, depth = 0) {
    let result;

    // MongoDB uses "ObjectId", but bson-objectid uses "ObjectID". :shrug:
    if ((entity?.__proto__?.constructor?.name || '')
            .toLowerCase() === 'objectid') {
        result = entity;
    }
    else if (Array.isArray(entity)) {
        result = entity.map(el => toMongoDoc(el, depth + 1));
    }
    else if (typeof entity === 'object' && entity !== null) {
        result = Object.fromEntries(Object.entries(entity).map(
                ([key, value]) => [
                    fieldNameUtils.relaxDocKeyComponentToMongo(key, depth),
                    toMongoDoc(value, depth + 1)
                ]));
    }
    else {
        result = entity;
    }

    return result;
}

module.exports = { fromMongoDoc, toMongoDoc };
