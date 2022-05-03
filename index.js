'use strict';

const bodyparser = require('koa-bodyparser');
const http = require('http');
const jsonPatch = require('fast-json-patch');
const Koa = require('koa');
const OptEntCollection = require('@shieldsbetter/sb-optimistic-entities')
const parseIfMatch = require('@shieldsbetter/parse-if-match');
const Router = require('@koa/router');
const SbError = require('@shieldsbetter/sberror2');
const typeIs = require('type-is');

class InvalidRequest extends SbError {
    static messageTemplate = 'Invalid request: {{{reason}}}';
}

class NoSuchEntity extends SbError {
    static messageTemplate = 'No such entity: {{{queryDescription}}}';
}

class NotModified extends SbError {
    static messageTemplate = 'Not modified.';
}

class PreconditionFailed extends SbError {
    static messageTemplate = 'Precondition failed.';
}

class UnexpectedError extends SbError {
    static messageTemplate = 'Unexpected error.';
}

module.exports = class Relaxation {
    constructor(collection, validate, {
        generateId,
        parseUrlId
    } = {}) {
        this.collection = new OptEntCollection(collection);
        this.generateId = generateId || (() => undefined);
        this.parseUrlId = parseUrlId || (x => x);
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
                if (e instanceof PreconditionFailed) {
                    ctx.status = 312;
                    ctx.body = 'Precondition failed.';
                }
                else if (e instanceof NotModified) {
                    ctx.status = 304;
                    ctx.body = 'Not modified.';
                    ctx.set('etag', e.details.eTag);
                }
                else {
                    throw new UnexpectedError(e);
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

function buildRouter() {
    const router = new Router();

    router.get('/:id', async (ctx, next) => {
        const parsedId = this.parseUrlId(ctx.params.id);

        const { value, version } =
                await this.collection.findOneRecord({ _id: parsedId });

        if (!value) {
            throw new NoSuchEntity({
                queryDescription: `id ${util.inspect(parsedId)}`,
                requestedId: parsedId
            });
        }

        // Strong comparison.
        if (ctx.request.ifMatch && !ctx.request.ifMatch.some(({
            eTag,
            star,
            weak
        }) => !weak && (star || eTag === version))) {
            throw new PreconditionFailed();
        }

        // Weak comparison.
        if (ctx.request.ifNoneMatch && ctx.request.ifNoneMatch.some(({
            eTag,
            star
        }) => star || eTag === version)) {
            throw new NotModified({
                eTag: version
            });
        }

        ctx.set('etag', JSON.stringify(version));
        ctx.status = 200;
        ctx.body = fromMongoDoc(value);
    });

    router.patch('/:id', bodyparser(), async (ctx, next) => {
        const parsedId = this.parseUrlId(ctx.params.id);

        let value;
        if (typeIs(ctx.req, ['application/json-patch+json'])) {
            ({ value } = await this.collection.updateOneRecord(
                { _id: parsedId },
                doc => {
                    const newDoc = fromMongoDoc(doc);
                    jsonPatch.applyPatch(newDoc, ctx.request.body);

                    this.validate(newDoc);

                    return toMongoDoc(newDoc);
                }));
        }
        else {
            throw new InvalidRequest({
                reason: 'patch must have Content-Type '
                        + '`application/json-patch+json`'
            });
        }

        ctx.status = 200;
        ctx.body = fromMongoDoc(value);
    });

    router.post('/', bodyparser(), async (ctx, next) => {
        if ('id' in ctx.request.body) {
            throw new InvalidRequest({
                reason: `may not POST entity with an id: ${ctx.request.body.id}`
            });
        }

        this.validate(ctx.request.body);

        const { value, version }  = await this.collection.insertOneRecord(
                toMongoDoc(ctx.request.body));

        ctx.set('ETag', `"${version}"`);
        ctx.status = 200;
        ctx.body = fromMongoDoc(value);
    });

    router.put('/:id', bodyparser(), async (ctx, next) => {
        const parsedId = this.parseUrlId(ctx.params.id);

        if ('id' in ctx.request.body
                && !deepequal(ctx.request.body.id, parsedId)) {
            throw new InvalidRequest({
                reason: `id in body of PUT must be omitted or match id in `
                        + ` path. Path id: ${JSON.stringify(parsedId)}, body `
                        + ` id: ${ctx.request.body.id}`
            });
        }

        ctx.request.body.id = parsedId;

        this.validate(ctx.request.body);

        const { value } = await this.collection.updateOneRecord(
                { _id: parsedId },
                () => toMongoDoc(ctx.request.body),
                { upsert: true });

        ctx.status = 200;
        ctx.body = fromMongoDoc(value);
    });

    return router;
}

function toMongoDoc(entity) {
    const result = Object.fromEntries(Object.entries(entity)
            .map(([key, value]) => [
                key.startsWith('_') ? `_${key}` : key,
                value
            ]));

    if ('id' in result) {
        result._id = result.id;
        delete result.id;
    }

    return result;
}

function fromMongoDoc(doc) {
    return Object.fromEntries(Object.entries(doc)
            .map(([key, value]) => [
                key.startsWith('_') ? key.substring(1) : key,
                value
            ]));
}

function parsePreconditions(pre) {

}
