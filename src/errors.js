class RPCError extends Error {
    constructor(rpcErrorID, message, rpcRequestID) {
        super(message);
        this.rpcErrorID = rpcErrorID;
        this.rpcRequestID = rpcRequestID;
        Error.captureStackTrace(this, RPCError);
    }
}

module.exports.RPCError = RPCError;
