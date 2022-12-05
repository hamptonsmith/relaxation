'use strict';

module.exports = o => {
    // MongoDB uses "ObjectId", but bson-objectid uses "ObjectID". :shrug:
    return (o?.__proto__?.constructor?.name || '').toLowerCase() === 'objectid';
};
