'use strict';

module.exports = {
    strongCompare(v) {
        return ({ eTag, star, weak }) =>
                star || (!weak && eTag === v);
    },

    weakCompare(v) {
        return ({ eTag, star }) => star || eTag === v;
    }
};
