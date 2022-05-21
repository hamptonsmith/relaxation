'use strict';

const bodyParser = require('koa-bodyparser');
const errors = require('../errors');

const { strongCompare, weakCompare } =
        require('../utils/etag-comparison-utils');

module.exports = (router, relax) => router.delete('/:id', async (ctx, next) => {
    const parsedId = relax.parseUrlId(ctx.params.id);

    const { value, version } = await relax.collection.deleteOne(
            { _id: parsedId }, {
                confirmDelete: (doc, { version }) => {
                    if (ctx.request.ifMatch &&
                            !ctx.request.ifMatch.some(strongCompare(version))) {
                        throw errors.preconditionFailed(
                                `If-Match ${ctx.get('If-Match')}`);
                    }

                    if (ctx.request.ifNoneMatch &&
                            ctx.request.ifNoneMatch.some(
                                    weakCompare(version))) {
                        throw errors.preconditionFailed(
                                `If-None-Match ${ctx.get('If-None-Match')}`);
                    }

                    return true;
                }
            });

    ctx.status = 204;
});
