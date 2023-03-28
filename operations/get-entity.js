'use strict';

const errors = require('../errors');
const parseId = require('../utils/parse-id');
const util = require('util');

const { fromMongoDoc } = require('../utils/mongo-doc-utils');
const { strongCompare, weakCompare } =
        require('../utils/etag-comparison-utils');

module.exports = (router, relax) => router.get(`/:${relax.idPlaceholder}`,
        parseId, async (ctx, next) => {

    const document =
            await relax.collection.findOne({ _id: ctx.state.parsedId });

    if (!document) {
        throw errors.noSuchResource(
                ctx.request.path, { requestedId: ctx.state.parsedId });
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
    ctx.body = fromMongoDoc(document, relax.fromDb, ctx.request.query.fields);
});
