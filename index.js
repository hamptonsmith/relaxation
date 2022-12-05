'use strict';

const baseX = require('base-x');
const bodyparser = require('koa-bodyparser');
const deepEqual = require('deep-equal');
const clone = require('clone');
const crypto = require('crypto');
const errors = require('./errors');
const fieldNameUtils = require('./utils/field-name-utils');
const http = require('http');
const jsonPatch = require('fast-json-patch');
const Koa = require('koa');
const lodash = require('lodash');
const objectId = require('bson-objectid');
const OptEntCollection = require('@shieldsbetter/sb-optimistic-entities')
const orderingToIndexKeys = require('./utils/ordering-to-index-keys');
const parseIfMatch = require('@shieldsbetter/parse-if-match');
const Router = require('@koa/router');
const SbError = require('@shieldsbetter/sberror2');
const typeIs = require('type-is');

const idAlphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
const idEncoder = baseX(idAlphabet);

class Relaxation {
    constructor(collection, validate, {
        fromDb = (x => x),
        generateId = (() => idEncoder.encode(crypto.randomBytes(16))),
        log = console.log,
        nower,
        onUnexpectedError = (() => {}),
        orderings,
        parseUrlId,
        toDb = (x => x)
    } = {}) {
        this.collection = new OptEntCollection(collection, { nower });
        this.fromDb = fromDb;
        this.generateId = generateId || (() => undefined);
        this.log = log;
        this.onUnexpectedError = onUnexpectedError;
        this.orderings = orderings;
        this.parseUrlId = parseUrlId || (x => x);
        this.toDb = toDb;
        this.validate = validate;
    }

    buildRequestListener() {
        const app = new Koa();

        app.use(async (ctx, next) => {
            if (ctx.get('If-Match')) {
                ctx.request.ifMatch = parseIfMatch(ctx.get('If-Match'));
            }

            if (ctx.get('If-None-Match')) {
                ctx.request.ifNoneMatch =
                        parseIfMatch(ctx.get('If-None-Match'));
            }

            try {
                await next();
            }
            catch (e) {
                if (e instanceof errors.PreconditionFailed) {
                    ctx.status = 412;
                    ctx.body = 'Precondition failed.';
                }
                else if (e instanceof errors.NoSuchEntity) {
                    ctx.status = 404;
                    ctx.body = 'Not found.';
                }
                else if (e instanceof errors.NotModified) {
                    ctx.status = 304;
                    ctx.body = 'Not modified.';
                    ctx.set('etag', e.details.eTag);
                }
                else {
                    ctx.status = 500;
                    ctx.body = 'Internal server error.';

                    await this.onUnexpectedError(e, ctx);
                }
            }
        });

        const router = buildRouter.call(this);

        app.use(router.routes());
        app.use(router.allowedMethods());

        return app.callback();
    }

    async listen({ httpServerOpts = {}, listenArgs = []} = {}) {
        const http = require('http');
        const cb = this.buildRequestListener();

        const httpServer = http.createServer(httpServerOpts, cb);

        await new Promise((resolve, reject) =>
                httpServer.listen(...listenArgs, err => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve();
                    }
                }));

        return httpServer;
    }
}

function normalizeOpts(o) {
    o = clone(o);

    o.orderings = {
        // We always have this one available.
        created: {
            fields: [
                { $createdAt: 1 }
            ]
        },

        ...o.orderings
    };

    for (const ordering of Object.values(o.orderings)) {
        if (!ordering.fields) {
            ordering.fields = [];
        }

        if (!ordering.fields.some(f => Object.keys(f)[0] === 'id')) {
            ordering.fields.push({ id: 1 });
        }

        if (!ordering.filters) {
            ordering.filters = [];
        }

        if (lodash.get(ordering, 'defaultFilters', true)) {
            const ops = [];
            for (const field of ordering.fields) {
                const filterName = Object.keys(field)[0];
                const mongoFieldPath =
                        fieldNameUtils.relaxFieldSpecifierToMongo(filterName);

                function buildFilter(opName) {
                    return [
                        [filterName, 'operators', opName],
                        v => ({ [mongoFieldPath]: { [`$${opName}`]: v }})
                    ];
                }

                for (const defaultOp of ['lte', 'lt', 'eq', 'gt', 'gte']) {
                    ops.push(buildFilter(defaultOp));
                }
            }

            for (const [path, fn] of ops) {
                if (!lodash.has(ordering.filters, [...path, 'toMongo'])) {
                    lodash.set(ordering.filters, [...path, 'toMongo'], fn);
                }
            }
        }
    }

    return o;
}

module.exports = async (collection, validate, opts) => {
    opts = normalizeOpts(opts);

    const [ neededIndexSpecs, unneededIndexNames ] =
            await planIndexes(collection, opts);

    await collection.createIndexes(neededIndexSpecs);

    return {
        neededIndexSpecs,
        relaxation: new Relaxation(collection, validate, opts),
        unneededIndexNames
    };
};

function buildRouter() {
    const router = new Router();

    require('./operations/delete-entity')(router, this);
    require('./operations/get-entity')(router, this);
    require('./operations/patch-entity')(router, this);
    require('./operations/post-entity')(router, this);
    require('./operations/put-entity')(router, this);

    require('./operations/list-entities')(router, this);

    return router;
}

function buildDesiredIndexSpecs(spec, opts) {
    const desiredIndexes = [];
    const suggestedIndexNames = new Map();

    for (const [name, spec] of Object.entries(opts.orderings)) {
        const mongoIndexKey = orderingToIndexKeys(spec.fields, opts)

        // The index spec as it will go to Mongo's `createIndexes()`
        const indexEntry = {
            key: mongoIndexKey
        };

        desiredIndexes.push(indexEntry);
        suggestedIndexNames.set(indexEntry, toMongoIndexName(spec.fields));
    }

    return [desiredIndexes, suggestedIndexNames];
}

/**
 * Two Mongo behaviors are relevant here:
 *
 * 1) Attempts to create a new index with a name that's already in use are
 *    ignored (even if the desired index has a different set of options).
 * 2) If an existing index with a different name "happens" to have the same
 *    options as the desired index, that is an error.
 */
async function planIndexes(collection, opts) {
    let existingIndexes;
    try {
        existingIndexes = await collection.indexes();
    }
    catch (e) {
        if (e.codeName !== 'NamespaceNotFound') {
            const e2 = new Error('Unexpected error: ' + e.message);
            e2.cause = e;
            throw e2;
        }

        // The collection doesn't exist--and so has no indexes!
        existingIndexes = [];
    }
    const [desiredIndexSpecs, suggestedIndexNames] =
            buildDesiredIndexSpecs(opts.orderings, opts);

    const existingIndexesDependedUpon = [];
    const neededIndexSpecs = [];
    for (const desired of desiredIndexSpecs) {

        // The `v` property is a metadata field furnished by Mongo. The `name`
        // property doesn't affect satisfiability. The remaining fields are the
        // same options we use to create the index and thus the ones we care
        // about for determining if there's an existing acceptable index.
        const satisfactoryIndex = existingIndexes.find(
                available => deepEqual(
                        { ...available, v: null, name: null },
                        { ...desired, v: null, name: null }));

        if (satisfactoryIndex) {
            existingIndexesDependedUpon.push(satisfactoryIndex.name);
        }
        else {
            let count = 1;

            function proposedName() {
                let result = suggestedIndexNames.get(desired);

                if (count > 1) {
                    result += ' ' + count;
                }

                return result;
            }

            while (existingIndexes.some(
                    ({ name }) => name === proposedName())) {
                count++;
            }

            neededIndexSpecs.push({
                ...desired,

                name: proposedName()
            });
        }
    }

    const unneededIndexNames = existingIndexes
            .filter(({ name }) => name.startsWith('Relaxation '))
            .filter(({ name }) => !existingIndexesDependedUpon.includes(name));

    return [
        neededIndexSpecs,
        unneededIndexNames
    ];
}

function toMongoIndexName(relaxIndexKeyList) {
    const entryListString = relaxIndexKeyList.map(e =>
            Object.keys(e)[0] + (Object.values(e)[0] === 1 ? '+' : '-'));

    return `Relaxation Order [${entryListString}]`;
}
