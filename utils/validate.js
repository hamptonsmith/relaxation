'use strict';

const errors = require('../errors');

module.exports = async (ctx, newValue, previousValue, extras) => {
	await ctx.state.relax.validate(newValue, {
		AuthorizationError: errors.AuthorizationError,
		AuthenticationError: errors.AuthenticationError,
		previousValue,
		request: ctx.req,
		state: ctx.state.relaxState,
		ValidationError: errors.ValidationError,

		...extras
	});
};