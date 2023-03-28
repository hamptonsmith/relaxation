'use strict';

const axios = require('axios');
const buildRelaxation = require('../index');
const http = require('http');

const { MongoClient } = require('mongodb');

module.exports = async (
    t, validate, { constructorOpts = {} } = {}
) => {
    constructorOpts = {
        log: t.log.bind(t),
        onUnexpectedError: e => {
            let output = e.stack;
            while (e.cause) {
                output += '\n\nCaused by: ' + e.cause.stack;
                e = e.cause;
            }
            t.fail(output);
        },

        ...constructorOpts
    };

    const testId = buildTestId();

    const mongoClient = new MongoClient(process.env.MONGO_CONNECT_STRING);
    await mongoClient.connect();

    const collection = mongoClient.db('testdb').collection(testId);

    const { relaxation } =
            await buildRelaxation(collection, validate, constructorOpts);
    const httpServer = await relaxation.listen(0);

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

    const result = axios.create({
        baseURL: 'http://localhost:' + port
    });

    result.relaxation = relaxation;

    return result;
};

function buildTestId() {
    let result = '';
    let alpha = 'abcdefghjkmnpqrstuvwxyz23456789';
    while (result.length < 10) {
        result += alpha.charAt(Math.floor(Math.random() * alpha.length));
    }

    return result;
}
