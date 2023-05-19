'use strict';

const bodyParser = require('koa-bodyparser');
const errors = require('../errors');
const propagate = require('../utils/propagate');
const validate = require('../utils/validate');

const { doBeforeMutate } = require('../utils/hook-middleware');
const { fromMongoDoc, toMongoDoc } = require('../utils/mongo-doc-utils');

module.exports = (router, relax) => router.post('/', bodyParser(),
        doBeforeMutate, async (ctx, next) => {

    if ('id' in ctx.request.body) {
        throw new errors.InvalidRequest({
            reason: `may not POST entity with an id: ${ctx.request.body.id}`
        });
    }

    const id = await relax.generateId();
    if (id !== undefined) {
        ctx.request.body.id = id;
    }

    await validate(ctx, ctx.request.body, undefined);

    const { document }  = await relax.collection.insertOneRecord(
            toMongoDoc(await propagate(ctx, ctx.request.body, undefined),
                    relax.toDb));

    ctx.set('ETag', `"${document.version_sbor}"`);
    ctx.status = 200;
    ctx.body = fromMongoDoc(document, relax.fromDb,
            ctx.request.headers['response-fields-mapping']);
});
