const http = require('http');
const { validateRequest } = require('../util');
const { RPCError } = require('../errors');

const defaultOptions = {
    host: '0.0.0.0',
    port: 6356,
    includeStack: true
};

class Server {
    constructor(userOptions) {
        this.options = Object.assign({}, defaultOptions, userOptions || {});

        this.server = http.createServer(this.handleRequest.bind(this));
        this.server.listen(this.options.port, this.options.host);
        this.handlers = {};
    }

    handleRequest(req, res) {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            req.body = body;
            this.finishRequest(req)
                .then(this.answerRequest(res))
                .catch(this.answerError(res));
        });
    }

    answerRequest(res) {
        return (results) => {
            // If notification, don't return anything
            if (results === null) {
                res.end();
            }
            if (Array.isArray(results)) {
                const response = results
                    .filter(result => result != null)
                    .map(this.createRPCObject.bind(this));

                res.end(JSON.stringify(response));
            }
            res.end(JSON.stringify(this.createRPCObject(results)));
        };
    }

    answerError(res) {
        return (error) => {
            res.end(JSON.stringify(this.createRPCObject(error)));
        };
    }

    finishRequest(req) {
        try {
            req.body = JSON.parse(req.body);
        } catch (e) {
            return Promise.reject(new RPCError(-32700, 'Parse error'));
        }

        if (Array.isArray(req.body)) {
            return Promise.all(req.body
                .map(this.handleRPCObject.bind(this))
                // Since the entire batch request should not fail if one part do,
                // all failing request is converted to resolved promises
                .map(promise => promise.catch(error => error)));
        }

        return this.handleRPCObject(req.body);
    }

    handleRPCObject(rpcObject) {
        if (!validateRequest(rpcObject)) {
            return Promise.reject(new RPCError(-32600, 'Invalid Request'));
        }

        const { id, method } = rpcObject;

        const handler = this.handlers[method];
        if (typeof handler !== 'function') {
            return Promise.reject(new RPCError(-32601, 'Method not found', id));
        }

        // Notification
        if (id == null) {
            this.callHandler(handler, rpcObject.params).catch(() => {});
            return Promise.resolve(null);
        }

        return this.callHandler(handler, rpcObject.params)
            .then(result => ({ id, result }))
            .catch((error) => {
                error.rpcRequestID = id; // eslint-disable-line no-param-reassign
                return Promise.reject(error);
            });
    }

    callHandler(handler, parameters) {
        let params = parameters;
        if (!Array.isArray(params)) {
            params = [params];
        }

        try {
            const handlerResult = handler(...params);
            return Promise.resolve(handlerResult);
        } catch (e) {
            return Promise.reject(e);
        }
    }

    // Gather up all fields that should be included in the "data"
    // part of the error sent to the client
    getErrorData(error) {
        const object = {};
        Object.getOwnPropertyNames(error).forEach((property) => {
            // Message and error id is already included outside of the data object
            if (
                property === 'message' ||
                property === 'rpcErrorID' ||
                property === 'rpcRequestID'
            ) {
                return;
            }

            // Don't include the stack if includeStack is set to false
            if (!this.options.includeStack && property === 'stack') {
                return;
            }

            object[property] = error[property];
        });

        if (Object.keys(object).length === 0) {
            return undefined;
        }

        return object;
    }

    // Convert the data to the format that will be sent backt to the client
    createRPCObject(data) {
        if (data instanceof Error) {
            return {
                jsonrpc: '2.0',
                error: {
                    code: data.rpcErrorID || -32000,
                    message: data.message,
                    data: this.getErrorData(data)
                },
                id: data.rpcRequestID ? data.rpcRequestID : null
            };
        }
        return { jsonrpc: '2.0', result: data.result, id: data.id };
    }

    regsiterHandler(name, handler) {
        this.handlers[name] = handler;
    }

    getHandler(name) {
        return this.handlers[name];
    }
}

const handler = {
    set(server, name, handlerFunction) {
        server.regsiterHandler(name, handlerFunction);
        return true;
    },

    get(server, name) {
        if (name === 'closeServer') {
            return server.server.close.bind(server.server);
        }
        return server.getHandler(name);
    }
};

function createServer(options) {
    const server = new Server(options);
    return new Proxy(server, handler);
}

module.exports.createServer = createServer;
