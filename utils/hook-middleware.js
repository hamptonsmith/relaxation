'use strict';

const errors = require('../errors');

module.exports = {
	doBeforeMutate: async (ctx, next) => {
		await ctx.state.relax.beforeMutate(ctx.request.method,
				ctx.state.parsedId, ctx.req,
				{
					AuthorizationError: errors.AuthorizationError,
					AuthenticationError: errors.AuthenticationError,
					ValidationError: errors.ValidationError
				});

		await next();
	}
};