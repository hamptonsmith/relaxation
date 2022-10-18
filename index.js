'use strict';

const bodyparser = require('koa-bodyparser');
const deepEqual = require('deep-equal');
const errors = require('./errors');
const http = require('http');
const jsonPatch = require('fast-json-patch');
const Koa = require('koa');
const objectId = require("bson-objectid");
const OptEntCollection = require('@shieldsbetter/sb-optimistic-entities')
const parseIfMatch = require('@shieldsbetter/parse-if-match');
const Router = require('@koa/router');
const SbError = require('@shieldsbetter/sberror2');
const typeIs = require('type-is');

const { fromMongoDoc, toMongoDoc } = require('./utils/mongo-doc-utils');

const indexMetafields = {
    createdAt: 'createdAt',
    eTag: 'version',
    updatedAt: 'updatedAt'
};

class Relaxation {
    constructor(collection, validate, {
        generateId,
        log = console.log,
        onUnexpectedError = (() => {}),
        parseUrlId
    } = {}) {
        this.collection = new OptEntCollection(collection);
        this.generateId = generateId || (() => undefined);
        this.log = log;
        this.onUnexpectedError = onUnexpectedError;
        this.parseUrlId = parseUrlId || (x => objectId(x));
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

module.exports = async (collection, validate, opts) => {
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

    const orderings = {

        // We always have this one available.
        created: {
            fields: [
                { $createdAt: 1 }
            ]
        },

        ...spec
    };

    for (const [name, spec] of Object.entries(orderings)) {
        const mongoIndexKey = toMongoIndexKey(spec.fields, opts)

        // Always the final tie-breaker.
        if (!('id' in mongoIndexKey)) {
            mongoIndexKey.id = 1;
        }

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

function toMongoIndexKey(relaxIndexKeyList, opts) {
    return relaxIndexKeyList.reduce((accum = {}, relaxKeyEntry) => {
        if (Object.keys(relaxKeyEntry).length !== 1) {
            throw new Error('fields entry must contain exactly one key.'
                    + ' Got: ' + util.inspect(val));
        }

        const rawKey = Object.keys(relaxKeyEntry)[0];
        const direction = relaxKeyEntry[rawKey];

        if (direction !== 1 && direction !== -1) {
            throw new Error(`for index field "${rawKey}", must specify 1 or -1 `
                    + `as a direction. Got: ${util.inspect(direction)}`);
        }

        let mongoFieldName;
        if (rawKey.startsWith('$') && !rawKey.startsWith('$$')) {
            mongoFieldName = indexMetafields[rawKey.substring(1)];

            if (!mongoFieldName) {
                throw new Error('No such metafield: ' + rawKey);
            }
        }
        else {
            const escapedRawKey =
                    rawKey.startsWith('$$') ? rawKey.substring(1) : rawKey;

            // Take the user's keyspec, and run it first through our own
            // `toMongoDoc()` (to, for example, ensure that if they said "id"
            // we'll correctly remap that to SbOptEnt's "_id"), then run it
            // through SbOptEnt's `translateIndexKey()` to make sure we're
            // targeting SbOptEnt-prefixed fields.
            mongoFieldName = Object.keys(
                    SbOptimisticEntityCollection.translateIndexKey(toMongoDoc({
                        [escapedRawKey]: relaxKeyEntry[rawKey]
                    })))[0];
        }

        accum[mongoFieldName] = relaxKeyEntry[rawKey];
        return accum;
    }, {});
}

function toMongoIndexName(relaxIndexKeyList) {
    const entryListString = relaxIndexKeyList.map(e =>
            Object.keys(e)[0] + (Object.values(e)[0] === 1 ? '+' : '-'));

    return `Relaxation Order [${entryListString}]`;
}
