const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
chai.should();

const srpc = require('../src');

let client;
let server;

before(function() {
    server = srpc.createServer();
    client = srpc.createClient();
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
