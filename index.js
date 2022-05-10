'use strict';

const bodyparser = require('koa-bodyparser');
const errors = require('./errors');
const http = require('http');
const jsonPatch = require('fast-json-patch');
const Koa = require('koa');
const OptEntCollection = require('@shieldsbetter/sb-optimistic-entities')
const parseIfMatch = require('@shieldsbetter/parse-if-match');
const Router = require('@koa/router');
const SbError = require('@shieldsbetter/sberror2');
const typeIs = require('type-is');

const { fromMongoDoc, toMongoDoc } = require('./utils/mongo-doc-utils');

module.exports = class Relaxation {
    constructor(collection, validate, {
        generateId,
        onUnexpectedError = (() => {}),
        parseUrlId
    } = {}) {
        this.collection = new OptEntCollection(collection);
        this.generateId = generateId || (() => undefined);
        this.onUnexpectedError = onUnexpectedError;
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
                if (e instanceof errors.PreconditionFailed) {
                    ctx.status = 412;
                    ctx.body = 'Precondition failed.';
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

function buildRouter() {
    const router = new Router();

    require('./operations/get-entity')(router, this);
    require('./operations/patch-entity')(router, this);

    router.post('/', bodyparser(), async (ctx, next) => {
        if ('id' in ctx.request.body) {
            throw new errors.InvalidRequest({
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
            throw new errors.InvalidRequest({
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
