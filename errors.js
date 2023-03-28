'use strict';

const SbError = require('@shieldsbetter/sberror2');

class RelaxationClientError extends Error {
    constructor(defaultMessage, ...args) {
        let cause;
        let details;
        let message;

        for (const arg of args) {
            if (arg instanceof Error) {
                cause = arg;
            }
            else if (typeof arg === 'string') {
                message = arg;
            }
            else {
                details = arg;
            }
        }

        super(message ?? defaultMessage);

        if (details) {
            this.details = details;
        }

        if (cause) {
            this.cause = cause;
        }
    }
}

module.exports = {
    AuthenticationError: class extends RelaxationClientError {
        constructor(...args) {
            super('Unauthorized', ...args);
        }

        get status() {
            return 401;
        }

        get code() {
            return 'UNAUTHORIZED';
        }
    },

    AuthorizationError: class extends RelaxationClientError {
        constructor(...args) {
            super('Forbidden', ...args);
        }

        get status() {
            return 403;
        }

        get code() {
            return 'FORBIDDEN';
        }
    },

    InvalidRequest: class extends SbError {
        static messageTemplate = 'Invalid request: {{{reason}}}';
    },

    invalidRequest(reason, details) {
        return new this.InvalidRequest({ reason, ...details });
    },

    NoSuchResource: class extends SbError {
        static messageTemplate = 'No such resource: {{{path}}}';
    },

    noSuchResource(path, details) {
        return new this.NoSuchResource({ path, details });
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

    RelaxationClientError,

    UnexpectedError: class extends SbError {
        static messageTemplate = 'Unexpected error: {{{message}}}';
    },

    unexpectedError(cause) {
        return new this.UnexpectedError(cause, { message: cause.message });
    },

    UnsupportedContentType: class extends SbError {
        static messageTemplate = 'Unsupported media type: for {{{method}}} '
                + 'requests on resources of kind "{{{resourceKind}}}", '
                + 'Content-Type header must be one of [{{{expected}}}], but '
                + 'got {{{actual}}}.'
    },

    unsupportedContentType(method, resourceKind, expected, actual) {
        if (!Array.isArray(expected)) {
            expected = [expected];
        }

        return new this.UnsupportedContentType({
            method, resourceKind, expected, actual
        });
    },

    ValidationError: class extends RelaxationClientError {
        constructor(...args) {
            super('Bad request', ...args);
        }

        get status() {
            return 400;
        }

        get code() {
            return 'BAD_REQUEST';
        }
    }
};
