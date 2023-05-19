'use strict';

const errors = require('../errors');

module.exports = async (ctx, newValue, previousValue) => {
	return await ctx.state.relax.propagate(newValue, {
		AuthorizationError: errors.AuthorizationError,
		AuthenticationError: errors.AuthenticationError,
		previousValue,
		request: ctx.req,
		ValidationError: errors.ValidationError
	}) ?? newValue;
};