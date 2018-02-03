const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const axios = require('axios');
const deepEqual = require('deep-equal');

chai.use(chaiAsPromised);
chai.should();

const srpc = require('../src');

let client;
let server;

before(function() {
    client = srpc.createClient();
});

describe('No server', function() {
    it('Should reject when the sever is not responding', function() {
        return client.multiply(3, 4).should.rejectedWith('ECONNREFUSED');
    });

    it('Should start the server', function() {
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
        .then(data => {
            if (deepEqual(data.data, output)) {
                done();
            } else {
                done(new Error(JSON.stringify(data.data) + '!=' + JSON.stringify(output)));
            }
        })
        .catch(response => done(new Error(response)));
}

describe('JSON RPC Server test', function() {
    it('rpc call with positional parameters', function(done) {
        server.subtract = (arg1, arg2) => arg1 - arg2;

        testAPI(
            { jsonrpc: '2.0', method: 'subtract', params: [42, 23], id: 1 },
            { jsonrpc: '2.0', result: 19, id: 1 },
            done
        );
    });

    it('rpc call with named parameters', function(done) {
        server.subtract = ({ subtrahend, minuend }) => minuend - subtrahend;

        testAPI(
            { jsonrpc: '2.0', method: 'subtract', params: { subtrahend: 23, minuend: 42 }, id: 3 },
            { jsonrpc: '2.0', result: 19, id: 3 },
            done
        );
    });

    it('rpc notification call', function(done) {
        server.update = () => {
            return new Promise(resolve => {
                setTimeout(resolve, 3000);
            });
        };
        testAPI({ jsonrpc: '2.0', method: 'update', params: [1, 2, 3, 4, 5] }, '', done);
    });

    it('rpc call with invalid Request object', function(done) {
        server.subtract = ({ subtrahend, minuend }) => minuend - subtrahend;

        testAPI(
            { jsonrpc: '2.0', method: 1, params: 'bar' },
            { jsonrpc: '2.0', error: { code: -32600, message: 'Invalid Request' }, id: null },
            done
        );
    });

    it('rpc call with error in handler function', function(done) {
        server.errorThrower = () => {
            throw new Error('test');
        };

        testAPI(
            { jsonrpc: '2.0', method: 'errorThrower', params: [], id: 123 },
            { jsonrpc: '2.0', error: { code: -32000, message: 'test' }, id: 123 },
            done
        );
    });
});

describe('Normal use', function() {
    it('Should resolve', function() {
        server.multiply = (arg1, arg2) => arg1 * arg2;
        return client.multiply(3, 4).should.eventually.equal(12);
    });

    it('Should reject', function() {
        server.throwing = () => {
            throw new Error('testing');
        };
        return client.throwing().should.rejectedWith(Error);
    });
});

describe('Promise use', function() {
    it('Should resolve', function() {
        server.multiplyPromsise = (arg1, arg2) => {
            return new Promise(resolve => {
                setTimeout(() => resolve(arg1 * arg2), 10);
            });
        };
        return client.multiplyPromsise(3, 4).should.eventually.equal(12);
    });

    it('Should reject', function() {
        server.throwingPromise = (arg1, arg2) => {
            return new Promise((resolve, reject) => {
                reject(new Error('testing'));
            });
        };
        return client.throwing().should.rejectedWith(Error);
    });
});

after(function() {
    server.close();
});
