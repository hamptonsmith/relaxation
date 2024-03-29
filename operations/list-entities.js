'use strict';

const assert = require('assert');
const bs58 = require('bs58');
const errors = require('../errors');
const fieldNames = require('../utils/field-name-utils');
const isMongoObjectId = require('../utils/is-mongo-object-id');
const LinkHeader = require('http-link-header');
const lodash = require('lodash');
const ObjectId = require('bson-objectid');
const orderingToIndexKeys = require('../utils/ordering-to-index-keys');
const util = require('util');
const validator = require('validator');
const view = require('../utils/view');

const { doBeforeRequest } = require('../utils/hook-middleware');
const { fromMongoDoc } = require('../utils/mongo-doc-utils');
const { strongCompare, weakCompare } =
        require('../utils/etag-comparison-utils');

const permittedOrderingValueTypes = ['string', 'number', 'boolean']
        .reduce((a, v) => { a[v] = true; return a; }, {});

const filterOps = {
    '<': 'lt',
    '<=': 'lte',
    '=': 'eq',
    '>=': 'gte',
    '>': 'gt'
};
const orderDirections = { '1': '$gt', '-1': '$lt' };

module.exports = (router, relax) => router.get('/',
        doBeforeRequest, async (ctx, next) => {
    const requestedOrder = ctx.request.query.order || 'created';
    const referenceOrder = requestedOrder.endsWith('-reverse')
            ? requestedOrder.substring(
                    0, requestedOrder.length - '-reverse'.length)
            : requestedOrder;

    const ordering = relax.orderings[referenceOrder];

    const indexKeys = orderingToIndexKeys(
            ordering.fields, requestedOrder.endsWith('-reverse'));
    const indexKeysEntries = Object.entries(indexKeys);

    const after = parseAfter(ctx.request.query.after, indexKeys)
    const filter = parseFilter(ctx.request.query.filter, ordering.filters);

    const mongoQuery = (filter && after)
            ? { $and: [ filter, after ] }
            : (filter || after);

    const first = Math.max(
            0, Math.min(
                Number.parseInt(ctx.request.query.first || '50'),
                500));

    const pagePlusOne = await relax.collection.find(mongoQuery, {
        limit: first + 1,
        sort: indexKeysEntries
    }).toArray();

    const hasMore = pagePlusOne.length > first;

    if (hasMore) {
        const lastInPage = pagePlusOne[first - 1];
        const nextAfter = bs58.encode(Buffer.from(
                JSON.stringify(indexKeysEntries
                    .map(([k]) => valueToCursorElement(lastInPage[k]))),
                'utf8'));

        const nextPageUrl = new URL(ctx.request.href);
        nextPageUrl.searchParams.set('after', nextAfter);

        ctx.append('Link', new LinkHeader().set({
            rel: 'next',
            uri: nextPageUrl.href
        }).toString());
    }

    ctx.status = 200;
    ctx.body = await Promise.all(pagePlusOne.slice(0, first)
            .map(d => fromMongoDoc(
                    d, relax.fromDb, view(ctx), ctx.request.query.fields)));
});

function valueToCursorElement(v) {
    if (v instanceof Date) {
        v = { date: +v };
    }
    else if (isMongoObjectId(v)) {
        v = { oid: '' + v };
    }

    return v;
}

function cursorElementToValue(e) {
    if (e?.date) {
        e = new Date(e.date);
    }
    else if (e?.oid) {
        e = new ObjectId(e.oid);
    }

    return e;
}

function last(a) {
    return a[a.length - 1];
}

function key(o) {
    return Object.keys(o)[0];
}

function value(o) {
    return Object.values(o)[0];
}

function parseAfter(after, indexKeys) {
    if (!after) {
        return;
    }

    indexKeys = Object.entries(indexKeys)
            .map(([key, value]) => ({ [key]: value }));

    const decoded =
            JSON.parse(Buffer.from(bs58.decode(after)).toString('utf8'));

    assert(Array.isArray(decoded));
    assert.equal(decoded.length, indexKeys.length);
    assert(decoded.every(el => el === null
            || (el.date && typeof el.date === 'number')
            || (el.oid && typeof el.oid === 'string')
            || permittedOrderingValueTypes[typeof el]));

    const least = last(indexKeys);
    let result = {
        [key(least)]: {
            [orderDirections[value(least)]]: cursorElementToValue(last(decoded))
        }
    };

    for (let i = indexKeys.length - 2; i >= 0; i--) {
        const orderEl = indexKeys[i];
        const afterValue = cursorElementToValue(decoded[i]);
        result = {
            $or: [
                {
                    [key(orderEl)]: {
                        [orderDirections[value(orderEl)]]: afterValue
                    }
                },
                {
                    $and: [
                        { [key(orderEl)]: { $eq: afterValue } },
                        result
                    ]
                }
            ]
        };
    }

    return result;
}

function parseFilter(filterEntries, filters) {
    if (!filterEntries) {
        return;
    }

    if (!Array.isArray(filterEntries)) {
        filterEntries = [filterEntries];
    }

    const conjuncts = filterEntries
            .map(e => e.split(','))
            .flat()
            .map(rawFilter => {
                let key = '';
                let operator = '';
                let value = '';
                for (const c of rawFilter) {
                    switch (c) {
                        case '<':
                        case '=':
                        case '>': {
                            if (value) {
                                throw new Error(
                                        'Too many operators: ' + rawFilter);
                            }

                            operator += c;
                            break;
                        }
                        default: {
                            if (operator) {
                                value += c;
                            }
                            else {
                                key += c;
                            }
                            break;
                        }
                    }
                }

                if (!operator) {
                    throw new Error('No operator: ' + rawFilter);
                }

                if (!['<', '<=', '=', '>=', '>'].includes(operator)) {
                    throw new Error('Unknown operator: ' + operator);
                }

                key = decodeURIComponent(key);
                value = decodeURIComponent(value);

                const parseValue = lodash.get(filters,
                        [key, 'parseValue'], defaultValueParser);
                const toMongo = lodash.get(filters,
                        [key, 'operators', filterOps[operator], 'toMongo']);

                if (!toMongo) {
                    throw new Error(
                            `No operator "${operator}" for key "${key}".`);
                }

                const mongoQuery = toMongo(parseValue(value));

                return Array.isArray(mongoQuery) ? mongoQuery : [mongoQuery];
            })
            .flat();

    // Some versions of MongoDb are picky about this.
    return conjuncts.length > 1 ? { $and: conjuncts } : conjuncts[0];
}

function defaultValueParser(s) {
    let result;

    if (s === 'null') {
        result = null;
    }
    else if (s === 'true') {
        result = true;
    }
    else if (s === 'false') {
        result = false;
    }
    else if (validator.isISO8601(s)) {
        result = new Date(s);
    }

    // Standard separator chosen because it matches Javascript, not because I'm
    // being USA-centric. ;)
    else if (/^(?:\d*\.)?\d+$/.test(s)) {
        result = Number.parseFloat(s);

        if ('' + result !== s && '' + result !== '0' + s) {
            throw new Error('Unrepresentable number.');
        }
    }
    else {
        result = s;
    }

    return result;
}
