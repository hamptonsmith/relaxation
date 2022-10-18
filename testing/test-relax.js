'use strict';

const axios = require('axios');
const buildRelaxation = require('../index');
const http = require('http');

const { MongoClient } = require('mongodb');

module.exports = async (
    t, validate, { constructorOpts = {}, listenOpts = {} } = {}
) => {
    constructorOpts = {
        log: t.log.bind(t),
        onUnexpectedError: e => { t.fail(e.stack); },

        ...constructorOpts
    };

    const testId = buildTestId();

    const mongoClient = new MongoClient(process.env.MONGO_CONNECT_STRING);
    await mongoClient.connect();

    const collection = mongoClient.db('testdb').collection(testId);

    const { relaxation } =
            await buildRelaxation(collection, validate, constructorOpts);
    const httpServer = await relaxation.listen(listenOpts);

    const port = httpServer.address().port;

    t.teardown(() => new Promise((resolve, reject) =>
            httpServer.close(err => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            }))
            .then(() => collection.drop()));

    return axios.create({
        baseURL: 'http://localhost:' + port
    });
};

function buildTestId() {
    let result = '';
    let alpha = 'abcdefghjkmnpqrstuvwxyz23456789';
    while (result.length < 10) {
        result += alpha.charAt(Math.floor(Math.random() * alpha.length));
    }

    return result;
}
