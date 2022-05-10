'use strict';

const errors = require('../errors');
const util = require('util');

const { fromMongoDoc, toMongoDoc } = require('../utils/mongo-doc-utils');
const { strongCompare, weakCompare } =
        require('../utils/etag-comparison-utils');

module.exports = (router, relax) => router.get('/:id', async (ctx, next) => {
    const parsedId = relax.parseUrlId(ctx.params.id);

    const { value, version } =
            await relax.collection.findOneRecord({ _id: parsedId });

    if (!value) {
        throw errors.noSuchEntity(
                `id ${util.inspect(parsedId)}`, { requestedId: parsedId });
    }

    if (ctx.request.ifMatch &&
            !ctx.request.ifMatch.some(strongCompare(version))) {
        throw errors.preconditionFailed(`If-Match ${ctx.get('If-Match')}`);
    }

    if (ctx.request.ifNoneMatch &&
            ctx.request.ifNoneMatch.some(weakCompare(version))) {
        throw errors.notModified({
            eTag: version
        });
    }

    ctx.set('etag', JSON.stringify(version));
    ctx.status = 200;
    ctx.body = fromMongoDoc(value);
});
