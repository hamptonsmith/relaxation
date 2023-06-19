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
const nodeMatchPath = require('node-match-path');
const objectId = require('bson-objectid');
const OptEntCollection = require('@shieldsbetter/sb-optimistic-resources')
const orderingToIndexKeys = require('./utils/ordering-to-index-keys');
const parseIfMatch = require('@shieldsbetter/parse-if-match');
const pathToRegexp = require('path-to-regexp');
const Router = require('@koa/router');
const SbError = require('@shieldsbetter/sberror2');
const typeIs = require('type-is');

const idAlphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
const idEncoder = baseX(idAlphabet);
const defaultGenerateId = (() => idEncoder.encode(crypto.randomBytes(16)));

class Relaxation {
    constructor(collection, validate, opts) {
        Object.assign(this, {
            allowPatchCreate: true,
            allowPutCreate: true,
            beforeMutate: (() => {}),
            beforeRequest: (() => {}),
            fromDb: (x => x),
            generateId: defaultGenerateId,
            log: console.log.bind(console),
            nower: Date.now,
            onUnexpectedError: defaultUnexpectedErrorHandler,
            orderings: {},
            parseUrlId: (x => x),
            populateMissingResource: (x => x),
            preservedKeys: (() => []),
            resourceKindName: 'resource',
            prefix: '',
            toDb: (x => x),
            view: (x => x),

            ...opts
        });

        if (Array.isArray(this.preservedKeys)) {
            const oldPreservedKeys = this.preservedKeys;
            this.preservedKeys = (() => oldPreservedKeys);
        }

        this.collection =
                new OptEntCollection(collection, { nower: this.nower });
        this.validate = validate;

        if (this.prefix !== '' && !this.prefix.startsWith('/')) {
            throw new Error('Prefix must be empty or start with a slash. Got: '
                    + this.prefix);
        }

        if (this.prefix.endsWith('/')) {
            throw new Error(
                    'Prefix must not end with a slash. Got: ' + this.prefix);
        }

        const placeholderNames = pathToRegexp.parse(this.prefix)
                .map(({ name }) => name)
                .filter(name => !!name);
        let i = 0;
        while (placeholderNames.includes(`id${i}`)) {
            i++;
        }

        this.idPlaceholder = `id${i}`;
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

            ctx.request.id = idEncoder.encode(crypto.randomBytes(8));
            ctx.state.relax = this;
            ctx.state.relaxState = {};

            try {
                await next();
            }
            catch (e) {
                ctx.body = {
                    message: e.message,
                    requestId: ctx.request.id
                };

                if (e instanceof errors.InvalidRequest) {
                    ctx.status = 400;
                    ctx.body.code = 'BAD_REQUEST';
                }
                else if (e instanceof errors.NoSuchResource) {
                    ctx.status = 404;
                    ctx.body.code = 'NOT_FOUND';
                }
                else if (e instanceof errors.NotModified) {
                    ctx.status = 304;
                    ctx.set('etag', e.details.eTag);
                }
                else if (e instanceof errors.PreconditionFailed) {
                    ctx.status = 412;
                    ctx.body.code = 'PRECONDITION_FAILED';
                }
                else if (e instanceof errors.UnsupportedContentType) {
                    ctx.status = 415;
                    ctx.body.code = 'UNSUPPORTED_CONTENT_TYPE';
                }
                else if (e instanceof errors.RelaxationClientError) {
                    ctx.status = e.status;
                    ctx.body.code = e.code;

                    if (e.details) {
                        ctx.body.details = e.details;
                    }
                }
                else {
                    if (!(e instanceof errors.ValidationError)) {
                        try {
                            await this.onUnexpectedError(
                                    e, ctx.request.id, ctx.req, this.log);
                        }
                        catch (e2) {
                            e = e2;
                        }
                    }

                    if (e instanceof errors.ValidationError) {
                        ctx.status = 400;
                        ctx.body.code = 'VALIDATION_ERROR';
                        ctx.body.details = e.details;
                    }
                    else {
                        ctx.status = 500;
                        ctx.body.code = 'INTERNAL_ERROR';
                        ctx.body.message = 'Internal server error.';
                    }
                }
            }
        });

        const router = buildRouter.call(this);
        app.use(router.routes());
        app.use(router.allowedMethods());

        return app.callback();
    }

    async listen(...listenArgs) {
        const http = require('http');
        const cb = this.buildRequestListener();

        const httpServer = http.createServer(cb);

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

module.exports = async (collection, validate, opts = {}) => {
    opts = normalizeOpts(opts);

    const [ neededIndexSpecs, unneededIndexNames ] =
            await planIndexes(collection, opts);

    if (neededIndexSpecs.length > 0) {
        await collection.createIndexes(neededIndexSpecs);
    }

    return {
        neededIndexSpecs,
        relaxation: new Relaxation(collection, validate, opts),
        unneededIndexNames
    };
};

module.exports.defaultGenerateId = defaultGenerateId;

function buildRouter() {
    const router = new Router({ prefix: this.prefix });

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

function defaultUnexpectedErrorHandler(e, requestId, req, log) {
    log(`\n===== Unexpected error in request ${requestId} =====\n`);
    log('Request:');
    log('    ' + req.method + ' ' + req.url);
    log();

    for (const [key, value] of Object.entries(req.headers)) {
        log('    ' + key + ': ' + value);
    }

    log();
    log(e);

    while (e.cause) {
        log('\nCaused by: ', e.cause);
        e = e.cause;
    }

    log();
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
