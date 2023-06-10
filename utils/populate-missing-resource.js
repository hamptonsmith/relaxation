'use strict';

const errors = require('../errors');

module.exports = async (ctx, record) => {
	return await ctx.state.relax.populateMissingResource(record, {
		AuthorizationError: errors.AuthorizationError,
		AuthenticationError: errors.AuthenticationError,
		request: ctx.req,
		state: ctx.state.relaxState,
		ValidationError: errors.ValidationError
	}) ?? record;
};