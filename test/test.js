const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const axios = require('axios');
const deepEqual = require('deep-equal');

chai.use(chaiAsPromised);
chai.should();

const srpc = require('../src');

let client;
let server;

before(() => {
    client = srpc.createClient({ timeout: 500 });
});

describe('No server', () => {
    it('Should reject when the sever is not responding', () =>
        client.multiply(3, 4).should.rejectedWith('ECONNREFUSED'));

    it('Should start the server', () => {
        server = srpc.createServer({ includeStack: false });
    });
});

const request = axios.create({
    baseURL: 'http://localhost:6356/',
    timeout: 1000,
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
                id: 1,
            },
            { jsonrpc: '2.0', result: 19, id: 1 },
            done,
        );
    });

    it('rpc call with named parameters', (done) => {
        server.subtract = ({ subtrahend, minuend }) => minuend - subtrahend;

        testAPI(
            {
                jsonrpc: '2.0',
                method: 'subtract',
                params: { subtrahend: 23, minuend: 42 },
                id: 3,
            },
            { jsonrpc: '2.0', result: 19, id: 3 },
            done,
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
            done,
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
                id: 123,
            },
            { jsonrpc: '2.0', error: { code: -32000, message: 'test' }, id: 123 },
            done,
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
                    id: '1',
                },
                {
                    jsonrpc: '2.0',
                    method: 'subtract',
                    params: [4, 2],
                    id: '2',
                },
            ],
            [{ jsonrpc: '2.0', result: 1, id: '1' }, { jsonrpc: '2.0', result: 2, id: '2' }],
            done,
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
                    id: '1',
                },
                { jsonrpc: '2.0', method: 'subtract', params: [7] },
                {
                    jsonrpc: '2.0',
                    method: 'subtract',
                    params: [42, 23],
                    id: 2,
                },
                { foo: 'boo' },
                {
                    jsonrpc: '2.0',
                    method: 'notexist',
                    params: [42, 23],
                    id: 3,
                },
                {
                    jsonrpc: '2.0',
                    method: 'errorThrower',
                    params: [42, 23],
                    id: 4,
                },
            ],
            [
                { jsonrpc: '2.0', result: 2, id: '1' },
                { jsonrpc: '2.0', result: 19, id: 2 },
                { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: null },
                { jsonrpc: '2.0', error: { code: -32601, message: 'Method not found' }, id: 3 },
                { jsonrpc: '2.0', error: { code: -32000, message: 'test' }, id: 4 },
            ],
            done,
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
            },
        );
    });
});

after(() => {
    server.close();
});
