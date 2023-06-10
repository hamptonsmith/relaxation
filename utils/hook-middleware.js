'use strict';

const errors = require('../errors');

module.exports = {
	doBeforeMutate: async (ctx, next) => {
		await ctx.state.relax.beforeMutate(ctx.request.method,
				ctx.state.parsedId, ctx.req,
				{
					AuthorizationError: errors.AuthorizationError,
					AuthenticationError: errors.AuthenticationError,
					state: ctx.state.relaxState,
					ValidationError: errors.ValidationError
				});

		await next();
	},
	doBeforeRequest: async (ctx, next) => {
		await ctx.state.relax.beforeRequest({
					host: ctx.request.host,
					method: ctx.request.method,
					port: ctx.request.port,
					path: ctx.request.path,
					protocol: ctx.request.protocol,
					query: ctx.request.query
				},
				ctx.req,
				{
					AuthorizationError: errors.AuthorizationError,
					AuthenticationError: errors.AuthenticationError,
					state: ctx.state.relaxState,
					ValidationError: errors.ValidationError
				});

		await next();
	}
};