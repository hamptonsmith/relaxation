'use strict';

const bodyParser = require('koa-bodyparser');
const clone = require('clone');
const errors = require('../errors');
const populateMissingResource = require('../utils/populate-missing-resource');
const replaceResource = require('../utils/replace-resource');
const validate = require('../utils/validate');
const view = require('../utils/view');

const { doBeforeMutate, doBeforeRequest } = require('../utils/hook-middleware');
const { fromMongoDoc, toMongoDoc } = require('../utils/mongo-doc-utils');
const { defaultGenerateId } = require('../index');

module.exports = (router, relax) => router.post('/', doBeforeRequest,
        bodyParser(), doBeforeMutate, async (ctx, next) => {

    if ('id' in ctx.request.body) {
        throw new errors.InvalidRequest({
            reason: `may not POST entity with an id: ${ctx.request.body.id}`
        });
    }

    const id = await relax.generateId(defaultGenerateId);
    let oldValue = { ...(id !== undefined ? { id } : {}) };
    oldValue = await populateMissingResource(ctx, oldValue);

    const [ newValue, delta ] =
            await replaceResource(ctx, ctx.request.body, oldValue);

    await validate(ctx, newValue, oldValue, { create: true, delta });

    const { document }  = await relax.collection.insertOneRecord(
            toMongoDoc(newValue, relax.toDb));

    ctx.set('ETag', `"${document.version_sbor}"`);
    ctx.status = 200;
    ctx.body = await fromMongoDoc(document, relax.fromDb, view(ctx),
            ctx.request.headers['response-fields-mapping']);
});
