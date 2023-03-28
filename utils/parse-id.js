'use strict';

module.exports = async function parseId(ctx, next) {
    ctx.state.parsedId = ctx.state.relax.parseUrlId(
            ctx.params[ctx.state.relax.idPlaceholder]);
    await next();
}