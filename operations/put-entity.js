'use strict';

const bodyParser = require('koa-bodyparser');
const clone = require('clone');
const deepEqual = require('deep-equal');
const errors = require('../errors');
const parseId = require('../utils/parse-id');
const populateMissingResource = require('../utils/populate-missing-resource');
const replaceResource = require('../utils/replace-resource');
const validate = require('../utils/validate');
const view = require('../utils/view');

const { doBeforeMutate, doBeforeRequest } = require('../utils/hook-middleware');
const { fromMongoDoc, toMongoDoc } = require('../utils/mongo-doc-utils');
const { strongCompare, weakCompare } =
        require('../utils/etag-comparison-utils');

module.exports = (router, relax) => router.put(`/:${relax.idPlaceholder}`,
        doBeforeRequest, parseId, doBeforeMutate, bodyParser(),
        async (ctx, next) => {

    if ('id' in ctx.request.body
            && !deepEqual(ctx.request.body.id, ctx.state.parsedId)) {
        throw new errors.InvalidRequest({
            reason: `id in body of PUT must be omitted or match id in `
                    + `path. Path id: ${JSON.stringify(ctx.state.parsedId)}, `
                    + `body id: ${ctx.request.body.id}`
        });
    }

    const { document } = await relax.collection.updateOneRecord(
            { _id: ctx.state.parsedId },
            async document => {
                let oldValue;
                if ('version_sbor' in document) {
                    if (ctx.request.ifMatch &&
                            !ctx.request.ifMatch.some(
                                    strongCompare(document.version_sbor))) {
                        throw errors.preconditionFailed(
                                `If-Match ${ctx.get('If-Match')}`);
                    }

                    if (ctx.request.ifNoneMatch
                                && document.version_sbor !== undefined &&
                            ctx.request.ifNoneMatch.some(
                                    weakCompare(document.version_sbor))) {
                        throw errors.preconditionFailed(
                                `If-None-Match ${ctx.get('If-None-Match')}`);
                    }

                    oldValue = clone(
                            await fromMongoDoc(document, relax.fromDb));
                }
                else {
                    if (!relax.allowPutCreate) {
                        throw new errors.noSuchResource(
                                `${relax.prefix}/${ctx.state.parseId}`);
                    }

                    oldValue = { id: document._id };
                    oldValue = await populateMissingResource(ctx, oldValue);
                }

                const [ newValue, delta ] =
                        await replaceResource(ctx, ctx.request.body, oldValue);

                await validate(ctx, newValue, oldValue, {
                    create: !document.version_sbor,
                    delta
                });

                return toMongoDoc(newValue, relax.toDb);
            },
            { upsert: true });

    ctx.status = 200;
    ctx.body = await fromMongoDoc(document, relax.fromDb, view(ctx),
            ctx.request.headers['response-fields-mapping']);
});
