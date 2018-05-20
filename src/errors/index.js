class RPCError extends Error {
    constructor(rpcErrorID, message, rpcRequestID) {
        super(message);
        this.rpcErrorID = rpcErrorID;
        this.rpcRequestID = rpcRequestID;
        Error.captureStackTrace(this, RPCError);
    }
}

class TimeoutError extends Error {
    constructor(message) {
        super(message);
        Error.captureStackTrace(this, RPCError);
    }
}

class BadServerDataError extends Error {
    constructor(message) {
        super(message);
        Error.captureStackTrace(this, RPCError);
    }
}

module.exports = { RPCError, TimeoutError, BadServerDataError };
