'use strict';

const bodyParser = require('koa-bodyparser');
const clone = require('clone');
const errors = require('../errors');
const jsonPatch = require('fast-json-patch');
const parseId = require('../utils/parse-id');
const populateMissingResource = require('../utils/populate-missing-resource');
const propagate = require('../utils/propagate');
const typeIs = require('type-is');
const util = require('util');
const validate = require('../utils/validate');

const { doBeforeMutate, doBeforeRequest } = require('../utils/hook-middleware');
const { fromMongoDoc, toMongoDoc } = require('../utils/mongo-doc-utils');
const { strongCompare, weakCompare } =
        require('../utils/etag-comparison-utils');

module.exports = (router, relax) => router.patch(`/:${relax.idPlaceholder}`,
            doBeforeRequest, parseId, doBeforeMutate, bodyParser(),
            async (ctx, next) => {

    const inferredBodyType = inferBodyType(ctx);

    if (!typeIs.is(inferredBodyType, ['application/json-patch+json'])) {
        throw errors.unsupportedContentType('PATCH', relax.resourceKindName,
                ['application/json-patch+json'],
                ctx.request.get('content-type') || '<missing>');
    }

    let document;
    try {
        ({ document } = await relax.collection.updateOneRecord(
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

                        if (ctx.request.ifNoneMatch &&
                                ctx.request.ifNoneMatch.some(
                                        weakCompare(document.version_sbor))) {
                            throw errors.preconditionFailed(
                                    `If-None-Match ${ctx.get('If-None-Match')}`);
                        }

                        oldValue = clone(fromMongoDoc(document, relax.fromDb));
                    }
                    else {
                        oldValue = { id: document._id };
                        oldValue = await populateMissingResource(ctx, oldValue);
                    }

                    const newDoc = fromMongoDoc(document, relax.fromDb);

                    jsonPatch.applyPatch(newDoc, ctx.request.body);
                    await validate(ctx, newDoc, oldValue, {
                        create: !document.version_sbor
                    });

                    return toMongoDoc(await propagate(ctx, newDoc, oldValue),
                            relax.toDb);
                },
                {
                    upsert: !ctx.request.ifMatch
                }));
    }
    catch (e) {
        if (e instanceof errors.PreconditionFailed) {
            throw errors.preconditionFailed(e.message, null, e);
        }

        throw errors.unexpectedError(e);
    }

    if (document === null) {
        throw errors.noSuchResource(
                ctx.request.path, { requestedId: ctx.state.parsedId });
    }
    else {
        ctx.status = 200;
        ctx.body = fromMongoDoc(document, relax.fromDb,
                ctx.request.headers['response-fields-mapping']);
    }
});

function inferBodyType(ctx) {
    let type = ctx.get('content-type');

    if (typeIs.is(type, 'application/json')) {
        type = Array.isArray(ctx.request.body) ? 'application/json-patch+json'
                : 'application/merge-patch+json';
    }

    return type;
}