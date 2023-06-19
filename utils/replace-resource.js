'use strict';

const clone = require('clone');
const errors = require('../errors');
const jsonPointer = require('json-pointer');
const merge = require('deep-extend');

module.exports = async (ctx, newValue, previousValue) => {
	const preservedKeys = (await ctx.state.relax.preservedKeys(
			buildKeys(previousValue), newValue)) || [];
	preservedKeys.push('/id');

	const delta = clone(newValue);
	const previousDict = jsonPointer.dict(previousValue);

	findDeleted(previousValue, newValue, preservedKeys, [], delta);

	const newRepresentation = {};
	for (const key of preservedKeys) {
		if (jsonPointer.has(previousValue, key)) {
			jsonPointer.set(newRepresentation, key,
					jsonPointer.get(previousValue, key));
		}
	}

	return [merge(newRepresentation, newValue), delta];
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

function findDeleted(previous, proposed, preserved, path = [], accum = {}) {
	if (proposed === undefined) {
		const pathPtr = jsonPointer.compile(path);
		if (!preserved.includes(pathPtr)) {
			jsonPointer.set(accum, pathPtr, undefined);
		}
	}
	else if (typeof previous === 'object' && !Array.isArray(previous)) {
		if (typeof proposed === 'object' && !Array.isArray(proposed)) {
			// If proposed has changed from an object, or into an array, then
			// this has been noted elsewhere already and we don't need to
			// descend.

			for (const [key, value] of Object.entries(previous)) {
				path.push(key);
				findDeleted(value, proposed[key], preserved, path, accum);
				path.pop();
			}
		}
	}

	return accum;
}