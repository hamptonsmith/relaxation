'use strict';

const bodyParser = require('koa-bodyparser');
const errors = require('../errors');
const parseId = require('../utils/parse-id');

const { doBeforeMutate, doBeforeRequest } = require('../utils/hook-middleware');
const { strongCompare, weakCompare } =
        require('../utils/etag-comparison-utils');

module.exports = (router, relax) => router.delete(`/:${relax.idPlaceholder}`,
        doBeforeRequest, parseId, doBeforeMutate, async (ctx, next) => {

    await relax.collection.deleteOneRecord(
            { _id: ctx.state.parsedId },
            {
                confirmDelete: (doc) => {
                    if (ctx.request.ifMatch && !ctx.request.ifMatch.some(
                            strongCompare(doc.version_sbor))) {
                        throw errors.preconditionFailed(
                                `If-Match ${ctx.get('If-Match')}`);
                    }

                    if (ctx.request.ifNoneMatch &&
                            ctx.request.ifNoneMatch.some(
                                    weakCompare(doc.version_sbor))) {
                        throw errors.preconditionFailed(
                                `If-None-Match ${ctx.get('If-None-Match')}`);
                    }

                    return true;
                }
            });

    ctx.status = 204;
});