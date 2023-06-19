'use strict';

const errors = require('../errors');
const parseId = require('../utils/parse-id');
const util = require('util');
const view = require('../utils/view');

const { doBeforeRequest } = require('../utils/hook-middleware');
const { fromMongoDoc } = require('../utils/mongo-doc-utils');
const { strongCompare, weakCompare } =
        require('../utils/etag-comparison-utils');

module.exports = (router, relax) => router.get(`/:${relax.idPlaceholder}`,
        doBeforeRequest, parseId, async (ctx, next) => {

    const document =
            await relax.collection.findOne({ _id: ctx.state.parsedId });

    if (!document) {
        throw errors.noSuchResource(
                ctx.request.path, { requestedId: ctx.state.parsedId });
    }

    if (ctx.request.ifMatch &&
            !ctx.request.ifMatch.some(strongCompare(document.version_sbor))) {
        throw errors.preconditionFailed(`If-Match ${ctx.get('If-Match')}`);
    }

    if (ctx.request.ifNoneMatch &&
            ctx.request.ifNoneMatch.some(weakCompare(document.version_sbor))) {
        throw errors.notModified({
            eTag: document.version_sbor
        });
    }

    ctx.set('etag', JSON.stringify(document.version_sbor));
    ctx.status = 200;
    ctx.body = await fromMongoDoc(
            document, relax.fromDb, view(ctx), ctx.request.query.fields);
});
