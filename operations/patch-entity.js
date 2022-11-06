'use strict';

const bodyParser = require('koa-bodyparser');
const errors = require('../errors');
const jsonPatch = require('fast-json-patch');
const typeIs = require('type-is');
const util = require('util');

const { fromMongoDoc, toMongoDoc } = require('../utils/mongo-doc-utils');
const { strongCompare, weakCompare } =
        require('../utils/etag-comparison-utils');

module.exports = (router, relax) => router.patch('/:id',
        bodyParser(), async (ctx, next) => {
    const parsedId = relax.parseUrlId(ctx.params.id);

    if (!typeIs(ctx.req, ['application/json-patch+json'])) {
        throw errors.invalidRequest('patch must have Content-Type '
                + '`application/json-patch+json`');
    }

    let document;
    try {
        ({ document } = await relax.collection.updateOneRecord(
                { _id: parsedId },
                document => {
                    if (ctx.request.ifMatch &&
                            !ctx.request.ifMatch.some(
                                    strongCompare(document.version_sboe))) {
                        throw errors.preconditionFailed(
                                `If-Match ${ctx.get('If-Match')}`);
                    }

                    if (ctx.request.ifNoneMatch &&
                            ctx.request.ifNoneMatch.some(
                                    weakCompare(document.version_sboe))) {
                        throw errors.preconditionFailed(
                                `If-None-Match ${ctx.get('If-None-Match')}`);
                    }

                    const newDoc = fromMongoDoc(document);
                    jsonPatch.applyPatch(newDoc, ctx.request.body);

                    relax.validate(newDoc);

                    return toMongoDoc(newDoc);
                }));
    }
    catch (e) {
        if (e instanceof errors.PreconditionFailed) {
            throw errors.preconditionFailed(e.message, null, e);
        }

        throw errors.unexpectedError(e);
    }

    ctx.status = 200;
    ctx.body = fromMongoDoc(document);
});
