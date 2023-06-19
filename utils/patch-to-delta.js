'use strict';

const clone = require('clone');
const jsonPatch = require('fast-json-patch');
const jsonPointer = require('json-pointer');

module.exports = (original, patches) => {
	const patchedOriginal = clone(original);
	jsonPatch.applyPatch(patchedOriginal, patches);

	const delta = {};

	for (const patch of patches) {
		switch (patch.op) {

			// These operations affect only their path.
			case 'add':
			case 'remove':
			case 'replace':
			case 'copy': {
				copyChange(patch.path, patchedOriginal, delta);
				break;
			}

			// Move affects both its `from` and its path.
			case 'move': {
				copyChange(patch.from, patchedOriginal, delta);
				copyChange(patch.path, patchedOriginal, delta);
				break;
			}

			// Test affects nothing.
			case 'test': {
				break;
			}

			default: {
				throw new Error('Unexpected op: ' + patch.op);
			}
		}
	}

	return delta;
};

function copyChange(pathPtr, from, to) {
	const pathRemaining = jsonPointer.parse(pathPtr);
	const pathSoFar = [];

	let done;
	while (!done && pathRemaining.length > 0) {
		const next = pathRemaining.shift();
		from = from[next];
		pathSoFar.push(next);

		if (typeof from !== 'object' || Array.isArray(from)) {
			done = true;
		}
	}

	jsonPointer.set(to, jsonPointer.compile(pathSoFar), from);
}