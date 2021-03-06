const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const axios = require('axios');
const deepEqual = require('deep-equal');
const express = require('express');

chai.use(chaiAsPromised);
chai.should();

const remoteFunction = require('../src');

let client;
let server;

let expressApp1;
let expressServer1;

let expressApp2;
let expressServer2;

before(() => {
    client = remoteFunction.createClient({ timeout: 500 });

    // Set up a random server to test requests against a bad endpoint
    expressApp1 = express();
    expressApp1.post('/', (req, res) => {
        res.send('random return');
    });
    expressServer1 = expressApp1.listen(5555);

    expressApp2 = express();
    expressApp2.post('/', (req, res) => {
        res.json({ test: 'test' });
    });
    expressServer2 = expressApp2.listen(5556);
});

describe('No server', () => {
    it('Should reject when the sever is not responding', () =>
        client.multiply(3, 4).should.rejectedWith('ECONNREFUSED'));

    it('Should start the server', () => {
        server = remoteFunction.createServer({ includeStack: false });
    });
});

const request = axios.create({
    baseURL: 'http://localhost:6356/',
    timeout: 1000
});

function testAPI(input, output, done) {
    request
        .post('/', input)
        .then((data) => {
            if (deepEqual(data.data, output)) {
                done();
            } else {
                done(new Error(`${JSON.stringify(data.data)}!=${JSON.stringify(output)}`));
            }
        })
        .catch(response => done(new Error(response)));
}

describe('JSON RPC Server test', () => {
    it('rpc call with positional parameters', (done) => {
        server.subtract = (arg1, arg2) => arg1 - arg2;

        testAPI(
            {
                jsonrpc: '2.0',
                method: 'subtract',
                params: [42, 23],
                id: 1
            },
            { jsonrpc: '2.0', result: 19, id: 1 },
            done
        );
    });

    it('rpc call with named parameters', (done) => {
        server.subtract = ({ subtrahend, minuend }) => minuend - subtrahend;

        testAPI(
            {
                jsonrpc: '2.0',
                method: 'subtract',
                params: { subtrahend: 23, minuend: 42 },
                id: 3
            },
            { jsonrpc: '2.0', result: 19, id: 3 },
            done
        );
    });

    it('rpc notification call', (done) => {
        server.update = () =>
            new Promise((resolve) => {
                setTimeout(resolve, 3000);
            });
        testAPI({ jsonrpc: '2.0', method: 'update', params: [1, 2, 3, 4, 5] }, '', done);
    });

    it('rpc call with invalid Request object', (done) => {
        server.subtract = ({ subtrahend, minuend }) => minuend - subtrahend;

        testAPI(
            { jsonrpc: '2.0', method: 1, params: 'bar' },
            { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: null },
            done
        );
    });

    it('rpc call with error in handler function', (done) => {
        server.errorThrower = () => {
            throw new Error('test');
        };

        testAPI(
            {
                jsonrpc: '2.0',
                method: 'errorThrower',
                params: [],
                id: 123
            },
            { jsonrpc: '2.0', error: { code: -32000, message: 'test' }, id: 123 },
            done
        );
    });

    it('rpc batch call', (done) => {
        server.subtract = (arg1, arg2) => arg1 - arg2;

        testAPI(
            [
                {
                    jsonrpc: '2.0',
                    method: 'subtract',
                    params: [2, 1],
                    id: '1'
                },
                {
                    jsonrpc: '2.0',
                    method: 'subtract',
                    params: [4, 2],
                    id: '2'
                }
            ],
            [{ jsonrpc: '2.0', result: 1, id: '1' }, { jsonrpc: '2.0', result: 2, id: '2' }],
            done
        );
    });

    it('rpc batch call', (done) => {
        server.subtract = (arg1, arg2) => arg1 - arg2;
        server.errorThrower = () => {
            throw new Error('test');
        };

        testAPI(
            [
                {
                    jsonrpc: '2.0',
                    method: 'subtract',
                    params: [5, 3],
                    id: '1'
                },
                { jsonrpc: '2.0', method: 'subtract', params: [7] },
                {
                    jsonrpc: '2.0',
                    method: 'subtract',
                    params: [42, 23],
                    id: 2
                },
                { foo: 'boo' },
                {
                    jsonrpc: '2.0',
                    method: 'notexist',
                    params: [42, 23],
                    id: 3
                },
                {
                    jsonrpc: '2.0',
                    method: 'errorThrower',
                    params: [42, 23],
                    id: 4
                },
                {
                    jsonrpc: '2.0',
                    method: 'errorThrower',
                    params: [42, 23],
                    id: null
                }
            ],
            [
                { jsonrpc: '2.0', result: 2, id: '1' },
                { jsonrpc: '2.0', result: 19, id: 2 },
                { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: null },
                { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: 3 },
                { jsonrpc: '2.0', error: { code: -32000, message: 'test' }, id: 4 }
            ],
            done
        );
    });
});

describe('Normal use', () => {
    it('Should resolve', () => {
        server.multiply = (arg1, arg2) => arg1 * arg2;
        return client.multiply(3, 4).should.eventually.equal(12);
    });

    it('Should reject', () => {
        server.throwing = () => {
            throw new Error('testing');
        };
        return client.throwing().should.rejectedWith(Error);
    });
});

describe('Promise use', () => {
    it('Should resolve', () => {
        server.multiplyPromsise = (arg1, arg2) =>
            new Promise((resolve) => {
                setTimeout(() => resolve(arg1 * arg2), 10);
            });
        return client.multiplyPromsise(3, 4).should.eventually.equal(12);
    });

    it('Should reject', () => {
        server.throwingPromise = () =>
            new Promise((resolve, reject) => {
                reject(new Error('testing'));
            });
        return client.throwing().should.rejectedWith(Error);
    });

    it('Works without options', () => {
        const noOptionsClient = remoteFunction.createClient();
        server.add = (a, b) => a + b;
        return noOptionsClient.add(4, 6).should.eventually.equal(10);
    });
});

describe('Errors', () => {
    it('Should timeout', () => {
        server.slow = () =>
            new Promise((resolve) => {
                setTimeout(() => resolve('test'), 4000);
            });
        return client.slow().should.rejectedWith(Error);
    });

    it('Should return data with error', () => {
        server.customError = () => {
            const error = new Error();
            error.test = 'test';
            return Promise.reject(error);
        };
        return client.customError().then(
            () => Promise.reject(new Error('Did not reject')),
            (error) => {
                if (error.test !== 'test') {
                    return Promise.reject(new Error('Did not return custom error data'));
                }
            }
        );
    });

    it('Should error with bad server data', () => {
        const badRequestClient = remoteFunction.createClient({ port: 5555 });
        return badRequestClient.test().should.eventually.rejectedWith('Could not parse');
    });

    it('Should error with incomplete server data', () => {
        const badRequestClient = remoteFunction.createClient({ port: 5556 });
        return badRequestClient
            .test()
            .should.eventually.rejectedWith('Data or Error is not present');
    });
});

describe('Other', () => {
    it('Should be able to retrieve set handlers', () => {
        server.test = () => 'test';
        server.test().should.equal('test');
    });

    it('Should error correctly when wrong parsed', (done) => {
        testAPI(
            'not json',
            { jsonrpc: '2.0', error: { code: -32700, message: 'Parse error' }, id: null },
            done
        );
    });

    it('Should be able to restart server', () => {
        server.closeServer();
        server = remoteFunction.createServer();
        server.add = (a, b) => a + b;
        client.add(5, 3).should.eventually.equal(8);
    });
});

after(() => {
    server.closeServer();
    expressServer1.close();
    expressServer2.close();
});
