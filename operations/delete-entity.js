'use strict';

const bodyParser = require('koa-bodyparser');
const errors = require('../errors');

const { strongCompare, weakCompare } =
        require('../utils/etag-comparison-utils');

module.exports = (router, relax) => router.delete('/:id', async (ctx, next) => {
    const parsedId = relax.parseUrlId(ctx.params.id);

    await relax.collection.deleteOneRecord(
            { _id: parsedId },
            {
                confirmDelete: (doc) => {
                    if (ctx.request.ifMatch && !ctx.request.ifMatch.some(
                            strongCompare(doc.version_sboe))) {
                        throw errors.preconditionFailed(
                                `If-Match ${ctx.get('If-Match')}`);
                    }

                    if (ctx.request.ifNoneMatch &&
                            ctx.request.ifNoneMatch.some(
                                    weakCompare(doc.version_sboe))) {
                        throw errors.preconditionFailed(
                                `If-None-Match ${ctx.get('If-None-Match')}`);
                    }

                    return true;
                }
            });

    ctx.status = 204;
});
