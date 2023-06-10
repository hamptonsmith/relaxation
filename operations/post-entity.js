'use strict';

const bodyParser = require('koa-bodyparser');
const clone = require('clone');
const errors = require('../errors');
const populateMissingResource = require('../utils/populate-missing-resource');
const propagate = require('../utils/propagate');
const replaceResource = require('../utils/replace-resource');
const validate = require('../utils/validate');

const { doBeforeMutate, doBeforeRequest } = require('../utils/hook-middleware');
const { fromMongoDoc, toMongoDoc } = require('../utils/mongo-doc-utils');

module.exports = (router, relax) => router.post('/', doBeforeRequest,
        bodyParser(), doBeforeMutate, async (ctx, next) => {

    if ('id' in ctx.request.body) {
        throw new errors.InvalidRequest({
            reason: `may not POST entity with an id: ${ctx.request.body.id}`
        });
    }

    const id = await relax.generateId();
    if (id !== undefined) {
        ctx.request.body.id = id;
    }

    let oldValue = { ...(id !== undefined ? { id } : {}) };
    oldValue = await populateMissingResource(ctx, oldValue);

    const newValue = await replaceResource(ctx, ctx.request.body, oldValue);

    await validate(ctx, newValue, oldValue, { create: true });

    const { document }  = await relax.collection.insertOneRecord(
            toMongoDoc(await propagate(ctx, newValue, oldValue), relax.toDb));

    ctx.set('ETag', `"${document.version_sbor}"`);
    ctx.status = 200;
    ctx.body = fromMongoDoc(document, relax.fromDb,
            ctx.request.headers['response-fields-mapping']);
});
