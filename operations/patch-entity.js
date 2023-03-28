'use strict';

const bodyParser = require('koa-bodyparser');
const errors = require('../errors');
const jsonPatch = require('fast-json-patch');
const parseId = require('../utils/parse-id');
const typeIs = require('type-is');
const util = require('util');

const { doBeforeMutate } = require('../utils/hook-middleware');
const { fromMongoDoc, toMongoDoc } = require('../utils/mongo-doc-utils');
const { strongCompare, weakCompare } =
        require('../utils/etag-comparison-utils');

module.exports = (router, relax) => router.patch(`/:${relax.idPlaceholder}`,
            parseId, doBeforeMutate, bodyParser(), async (ctx, next) => {

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
                document => {
                    if ('version_sboe' in document) {
                        if (ctx.request.ifMatch &&
                                !ctx.request.ifMatch.some(
                                        strongCompare(document.version_sboe))) {
                            throw errors.preconditionFailed(
                                    `If-Match ${ctx.get('If-Match')}`);
                        }

                        if (ctx.request.ifNoneMatch &&
                                ctx.request.ifNoneMatch.some(
                                        weakCompare(document.version_sboe))) {
                            throw errors.preconditionFailed(
                                    `If-None-Match ${ctx.get('If-None-Match')}`);
                        }
                    }
                    else {
                        document = relax.populateBlankResource(document)
                                ?? document;
                    }

                    const newDoc = fromMongoDoc(document, relax.fromDb);

                    jsonPatch.applyPatch(newDoc, ctx.request.body);
                    relax.validate(newDoc, {
                        ValidationError: errors.ValidationError
                    });

                    return toMongoDoc(newDoc, relax.toDb);
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