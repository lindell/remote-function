const http = require('http');
const { TimeoutError, BadServerDataError } = require('../errors');
const { generateID } = require('../util');

const defaultOptions = {
    host: '127.0.0.1',
    port: 6356,
    path: '/',
    connectTimeout: 0,
    responseTimeout: 0
};

class Client {
    constructor(userOptions) {
        this.options = Object.assign({}, defaultOptions, userOptions || {});
        this.options.headers = Object.assign({ 'Content-Type': 'application/json' }, this.options.headers || {});
        this.options.method = 'POST';
        if (this.options.timeout != null) {
            this.options.responseTimeout = this.options.timeout;
        }
        this.options.timeout = this.options.connectTimeout || this.options.timeout || undefined;
    }

    send(name, params) {
        return new Promise((resolve, reject) => {
            const request = http.request(this.options, (resp) => {
                const data = [];

                resp.on('data', (chunk) => {
                    data.push(chunk);
                });

                resp.on('end', () => {
                    try {
                        const parsedData = JSON.parse(data.join(''));
                        resolve(this.finishRequest(parsedData));
                    } catch (e) {
                        reject(new BadServerDataError('Could not parse the response from the server'));
                    }
                });
            });

            request.on('error', reject);

            if (this.options.responseTimeout > 0) {
                request.on('socket', (socket) => {
                    socket.on('connect', () => {
                        setTimeout(() => {
                            reject(new TimeoutError('Request timed out'));
                            request.abort();
                        }, this.options.responseTimeout);
                    });
                });
            }

            request.write(JSON.stringify({
                jsonrpc: '2.0',
                method: name,
                params,
                id: generateID()
            }));
            request.end();
        });
    }

    finishRequest(data) {
        if (data && 'result' in data) {
            return data.result;
        } else if (data && data.error) {
            const error = new Error(data.error.message);
            if (data.error.data) {
                Object.assign(error, data.error.data);
            }
            return Promise.reject(error);
        }
        return Promise.reject(new Error('Data or Error is not present, the server did not send correct information back'));
    }
}

const handler = {
    get(client, name) {
        return (...args) => client.send(name, args);
    }
};

function createClient(options) {
    const client = new Client(options);
    return new Proxy(client, handler);
}

module.exports.createClient = createClient;
