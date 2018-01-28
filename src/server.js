var http = require('http');

const defaultOptions = {
    host: '0.0.0.0',
    port: 6356,
    includeStack: true,
};

class Server {
    constructor(userOptions) {
        this.options = { ...defaultOptions, ...(userOptions || {}) };

        this.server = http.createServer(this.handleRequest.bind(this));
        this.server.listen(this.options.port, this.options.host);
        this.handlers = {};
    }

    handleRequest(req, res) {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
        });
        req.on('end', () => {
            req.body = JSON.parse(body);
            this.finishRequest(req, res);
        });
    }

    finishRequest(req, res) {
        const functionName = req.url.split('/', 2)[1];
        const handler = this.handlers[functionName];

        this.handleFunctionCall(handler, req.body)
            .then(result => {
                res.write(JSON.stringify({ result }));
                res.end();
            })
            .catch(error => {
                res.write(JSON.stringify({ error: this.errorToObject(error) }));
                res.end();
            });
    }

    handleFunctionCall(handler, params) {
        try {
            let handlerResult = handler(...params);
            return Promise.resolve(handlerResult);
        } catch (e) {
            return Promise.reject(e);
        }
    }

    errorToObject(error) {
        let object = {};
        Object.getOwnPropertyNames(error).forEach(property => {
            console.log(this.includeStack);
            if (property === 'stack' && !this.options.includeStack) {
                return;
            }

            object[property] = error[property];
        });
        return object;
    }

    regsiterHandler(name, handler) {
        this.handlers[name] = handler;
    }
}

const handler = {
    set: function(server, name, handler) {
        server.regsiterHandler(name, handler);
    },
};

function createServer() {
    const server = new Server();
    return new Proxy(server, handler);
}

module.exports.createServer = createServer;
