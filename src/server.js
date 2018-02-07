const http = require('http');
const { RPCError } = require('./errors.js');

const defaultOptions = {
    host: '0.0.0.0',
    port: 6356,
    includeStack: true,
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
        req.on('data', chunk => {
            body += chunk;
        });
        req.on('end', () => {
            req.body = body;
            this.completeRequest(req)
                .then(result => {
                    // If notification, don't return anything
                    if (result === null) {
                        res.end();
                    }
                    if (Array.isArray(result)) {
                        res.end(
                            JSON.stringify(
                                result.filter(result => result != null).map(result => {
                                    if (result instanceof Error) {
                                        return {
                                            jsonrpc: '2.0',
                                            error: {
                                                code: result.rpcErrorID || -32000,
                                                message: result.message,
                                                data: this.getErrorData(result),
                                            },
                                            id: result.rpcRequestID ? result.rpcRequestID : null,
                                        };
                                    }
                                    return { jsonrpc: '2.0', result: result.result, id: result.id };
                                })
                            )
                        );
                    }
                    res.end(JSON.stringify({ jsonrpc: '2.0', result: result.result, id: result.id }));
                })
                .catch(error => {
                    res.end(
                        JSON.stringify({
                            jsonrpc: '2.0',
                            error: {
                                code: error.rpcErrorID || -32000,
                                message: error.message,
                                data: this.getErrorData(error),
                            },
                            id: req.body.id ? req.body.id : null,
                        })
                    );
                });
        });
    }

    completeRequest(req) {
        try {
            return Promise.resolve(this.finishRequest(req));
        } catch (e) {
            return Promise.reject(e);
        }
    }

    finishRequest(req) {
        try {
            req.body = JSON.parse(req.body);
        } catch (e) {
            throw new RPCError(-32700, 'Parse error');
        }

        if (Array.isArray(req.body)) {
            return Promise.all(
                req.body.map(this.handleRPCObject.bind(this)).map(promise => promise.catch(error => error))
            );
        }

        return this.handleRPCObject(req.body);
    }

    handleRPCObject(rpcObject) {
        if (!validateRequest(rpcObject)) {
            return Promise.reject(new RPCError(-32600, 'Invalid Request'));
        }

        const functionName = rpcObject.method;
        const id = rpcObject.id;
        const handler = this.handlers[functionName];
        if (typeof handler !== 'function') {
            return Promise.reject(new RPCError(-32601, 'Method not found', id));
        }

        // Notification
        if (id == null) {
            this.callHandler(handler, rpcObject.params).catch(() => {});
            return Promise.resolve(null);
        }

        return this.callHandler(handler, rpcObject.params).then(result => ({ id, result }));
    }

    callHandler(handler, params) {
        if (!Array.isArray(params)) {
            params = [params];
        }

        try {
            let handlerResult = handler(...params);
            return Promise.resolve(handlerResult);
        } catch (e) {
            return Promise.reject(e);
        }
    }

    getErrorData(error) {
        let object = {};
        Object.getOwnPropertyNames(error).forEach(property => {
            // Message and error id is already included outside of the data object
            if (property === 'message' || property === 'rpcErrorID' || property === 'rpcRequestID') {
                return;
            }

            if (property === 'stack' && !this.options.includeStack) {
                return;
            }

            if (error[property] !== undefined) {
                object[property] = error[property];
            }
        });

        if (Object.keys(object).length === 0) {
            return;
        }
        return object;
    }

    regsiterHandler(name, handler) {
        this.handlers[name] = handler;
    }
}

function validateRequest(data) {
    if (Array.isArray(data)) {
        return true;
    }
    return typeof data.method === 'string' && data.jsonrpc === '2.0' && typeof data.params === 'object';
}

const handler = {
    set: function(server, name, handler) {
        server.regsiterHandler(name, handler);
    },

    get: function(server, name) {
        if (name == 'close') {
            return server.server.close.bind(server.server);
        }
    },
};

function createServer(options) {
    const server = new Server(options);
    return new Proxy(server, handler);
}

module.exports.createServer = createServer;
