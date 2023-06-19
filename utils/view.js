'use strict';

const errors = require('../errors');

module.exports = ctx => {
	return async d => (await ctx.state.relax.view(d, {
		AuthorizationError: errors.AuthorizationError,
		AuthenticationError: errors.AuthenticationError,
		request: ctx.req,
		state: ctx.state.relaxState,
		ValidationError: errors.ValidationError
	})) ?? d;
}