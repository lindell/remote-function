const http = require('http');

const defaultOptions = {
    host: '127.0.0.1',
    port: 6356,
};

class Client {
    constructor(userOptions) {
        this.options = Object.assign({}, defaultOptions, userOptions || {});
        this.currentID = 0;
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
        const id = this.currentID;
        this.currentID += 1;

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

            request.on('timeout', () => {
                reject(new Error('Request timeout'));
                request.abort();
            });

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
        throw new Error('Data or Error is not present, this should never happen.');
    }
}

const handler = {
    get(client, name) {
        return (...args) => client.send(name, args);
    },
};

function createClient() {
    const client = new Client();
    return new Proxy(client, handler);
}

module.exports.createClient = createClient;
