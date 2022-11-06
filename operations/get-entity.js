'use strict';

const errors = require('../errors');
const util = require('util');

const { fromMongoDoc, toMongoDoc } = require('../utils/mongo-doc-utils');
const { strongCompare, weakCompare } =
        require('../utils/etag-comparison-utils');

module.exports = (router, relax) => router.get('/:id', async (ctx, next) => {
    const parsedId = relax.parseUrlId(ctx.params.id);

    const document = await relax.collection.findOne({ _id: parsedId });

    if (!document) {
        throw errors.noSuchEntity(
                `id ${util.inspect(parsedId)}`, { requestedId: parsedId });
    }

    if (ctx.request.ifMatch &&
            !ctx.request.ifMatch.some(strongCompare(document.version_sboe))) {
        throw errors.preconditionFailed(`If-Match ${ctx.get('If-Match')}`);
    }

    if (ctx.request.ifNoneMatch &&
            ctx.request.ifNoneMatch.some(weakCompare(document.version_sboe))) {
        throw errors.notModified({
            eTag: document.version_sboe
        });
    }

    ctx.set('etag', JSON.stringify(document.version_sboe));
    ctx.status = 200;
    ctx.body = fromMongoDoc(document);
});
