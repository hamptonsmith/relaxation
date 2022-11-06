'use strict';

const bodyParser = require('koa-bodyparser');
const deepEqual = require('deep-equal');
const errors = require('../errors');

const { fromMongoDoc, toMongoDoc } = require('../utils/mongo-doc-utils');
const { strongCompare, weakCompare } =
        require('../utils/etag-comparison-utils');

module.exports = (router, relax) => router.put('/:id', bodyParser(),
        async (ctx, next) => {
    const parsedId = relax.parseUrlId(ctx.params.id);

    if ('id' in ctx.request.body
            && !deepEqual(ctx.request.body.id, parsedId)) {
        throw new errors.InvalidRequest({
            reason: `id in body of PUT must be omitted or match id in `
                    + ` path. Path id: ${JSON.stringify(parsedId)}, body `
                    + ` id: ${ctx.request.body.id}`
        });
    }

    relax.validate(ctx.request.body);

    const { document } = await relax.collection.updateOneRecord(
            { _id: parsedId },
            document => {
                if (ctx.request.ifMatch &&
                        !ctx.request.ifMatch.some(
                                strongCompare(document.version_sboe))) {
                    throw errors.preconditionFailed(
                            `If-Match ${ctx.get('If-Match')}`);
                }

                if (ctx.request.ifNoneMatch
                            && document.version_sboe !== undefined &&
                        ctx.request.ifNoneMatch.some(
                                weakCompare(document.version_sboe))) {
                    throw errors.preconditionFailed(
                            `If-None-Match ${ctx.get('If-None-Match')}`);
                }

                return toMongoDoc(ctx.request.body);
            },
            { upsert: true });

    ctx.status = 200;
    ctx.body = fromMongoDoc(document);
});
