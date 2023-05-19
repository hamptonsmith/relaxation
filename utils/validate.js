'use strict';

const errors = require('../errors');

module.exports = async (ctx, newValue, previousValue) => {
	await ctx.state.relax.validate(newValue, {
		AuthorizationError: errors.AuthorizationError,
		AuthenticationError: errors.AuthenticationError,
		previousValue,
		request: ctx.req,
		ValidationError: errors.ValidationError
	});
};