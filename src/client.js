const http = require('http');

const defaultOptions = {
    host: '127.0.0.1',
    port: 6356,
};

class Client {
    constructor(userOptions) {
        this.options = { ...defaultOptions, ...(userOptions || {}) };
    }

    send(name, args) {
        const options = {
            hostname: this.options.host,
            port: this.options.port,
            path: '/' + name,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
        };

        return new Promise(resolve => {
            let request = http.request(options, resp => {
                let data = '';

                resp.on('data', chunk => {
                    data += chunk;
                });

                resp.on('end', () => {
                    const parsedData = JSON.parse(data);
                    resolve(this.finishRequest(parsedData));
                });
            });

            request.write(JSON.stringify(args));
            request.end();
        });
    }

    finishRequest(data) {
        if (data.result) {
            return data.result;
        } else if (data.error) {
            let error = new Error();
            Object.assign(error, data.error);
            return Promise.reject(error);
        }
    }
}

const handler = {
    get: function(client, name) {
        return (...args) => client.send(name, args);
    },
};

function createClient() {
    const client = new Client();
    return new Proxy(client, handler);
}

module.exports.createClient = createClient;
