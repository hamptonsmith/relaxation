'use strict';

const errors = require('../errors');
const jsonPointer = require('json-pointer');
const merge = require('deep-extend');

module.exports = async (ctx, newValue, previousValue) => {
	const preservedKeys = (await ctx.state.relax.preservedKeys(
			buildKeys(previousValue), newValue)) || [];
	preservedKeys.push('/id');

	const newRepresentation = {};
	for (const key of preservedKeys) {
		if (jsonPointer.has(previousValue, key)) {
			jsonPointer.set(newRepresentation, key,
					jsonPointer.get(previousValue, key));
		}
	}

	return merge(newRepresentation, newValue);
};

function buildKeys(o, path = [], accum = []) {
	if (typeof o === 'object' && !Array.isArray(o)) {
		for (const [key, value] of Object.entries(o)) {
			path.push(key);
			buildKeys(value, path, accum);
			path.pop();
		}
	}
	else {
		accum.push(jsonPointer.compile(path));
	}

	return accum;
}