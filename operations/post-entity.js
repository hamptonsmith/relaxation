'use strict';

const bodyParser = require('koa-bodyparser');
const errors = require('../errors');

const { fromMongoDoc, toMongoDoc } = require('../utils/mongo-doc-utils');

module.exports = (router, relax) => router.post('/', bodyParser(),
        async (ctx, next) => {
    if ('id' in ctx.request.body) {
        throw new errors.InvalidRequest({
            reason: `may not POST entity with an id: ${ctx.request.body.id}`
        });
    }

    const id = await relax.generateId();
    if (id !== undefined) {
        ctx.request.body.id = id;
    }

    relax.validate(ctx.request.body);

    const { document }  = await relax.collection.insertOneRecord(
            toMongoDoc(ctx.request.body, relax.toDb));

    ctx.set('ETag', `"${document.version_sboe}"`);
    ctx.status = 200;
    ctx.body = fromMongoDoc(document, relax.fromDb);
});
