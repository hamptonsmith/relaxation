'use strict';

const axios = require('axios');
const fakeMongoDbClient = require('@shieldsbetter/sb-optimistic-entities/testing/fake-mongo-db-client');
const http = require('http');
const Relax = require('../index');

module.exports = async (
    t, validate, { constructorOpts = {}, listenOpts = {} } = {}
) => {
    const collection =
            fakeMongoDbClient(t.log.bind(t)).collection('TestCollection');
    const relax = new Relax(collection, validate, constructorOpts);
    const httpServer = await relax.listen(listenOpts);

    const port = httpServer.address().port;

    t.teardown(() => new Promise((resolve, reject) =>
            httpServer.close(err => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            })));

    return axios.create({
        baseURL: 'http://localhost:' + port
    });
};
