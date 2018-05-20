const http = require('http');
const { TimeoutError } = require('../errors');
const { gererateID } = require('../util');

const defaultOptions = {
    host: '127.0.0.1',
    port: 6356,
    timeout: 0,
};

class Client {
    constructor(userOptions) {
        this.options = Object.assign({}, defaultOptions, userOptions || {});
    }

    send(name, params) {
        const options = {
            hostname: this.options.host,
            port: this.options.port,
            path: '/',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        };
        const id = gererateID();

        return new Promise((resolve, reject) => {
            const request = http.request(options, (resp) => {
                let data = '';

                resp.on('data', (chunk) => {
                    data += chunk;
                });

                resp.on('end', () => {
                    const parsedData = JSON.parse(data);
                    resolve(this.finishRequest(parsedData));
                });
            });

            request.on('error', (e) => {
                reject(e);
            });

            if (this.options.timeout > 0) {
                request.on('socket', (socket) => {
                    socket.on('connect', () => {
                        setTimeout(() => {
                            reject(new TimeoutError('Request timed out'));
                            request.abort();
                        }, this.options.timeout);
                    });
                });
            }

            request.write(JSON.stringify({
                jsonrpc: '2.0',
                method: name,
                params,
                id,
            }));
            request.end();
        });
    }

    finishRequest(data) {
        if (data.result) {
            return data.result;
        } else if (data.error) {
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
    },
};

function createClient(options) {
    const client = new Client(options);
    return new Proxy(client, handler);
}

module.exports.createClient = createClient;
