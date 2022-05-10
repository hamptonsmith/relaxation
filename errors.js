'use strict';

const SbError = require('@shieldsbetter/sberror2');

module.exports = {
    InvalidRequest: class extends SbError {
        static messageTemplate = 'Invalid request: {{{reason}}}';
    },

    invalidRequest(reason, details) {
        return new this.InvalidRequest({ reason, ...details });
    },

    NoSuchEntity: class extends SbError {
        static messageTemplate = 'No such {{{kind}}}: {{{description}}}';
    },

    noSuchEntity(kind, description, details) {
        return new this.NoSuchEntity({ kind, description, ...details });
    },

    NotModified: class extends SbError {
        static messageTemplate = 'Not modified.';
    },

    notModified(details) {
        return new this.NotModified(details);
    },

    PreconditionFailed: class extends SbError {
        static messageTemplate = 'Precondition failed: {{{description}}}';
    },

    preconditionFailed(description, details, cause) {
        return new this.PreconditionFailed({ description, ...details }, cause);
    },

    UnexpectedError: class extends SbError {
        static messageTemplate = 'Unexpected error: {{{message}}}';
    },

    unexpectedError(cause) {
        return new this.UnexpectedError(cause, { message: cause.message });
    }
};
