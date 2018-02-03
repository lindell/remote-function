class RPCError extends Error {
    constructor(id, message) {
        super(message);
        this.rpcErrorID = id;
        Error.captureStackTrace(this, RPCError);
    }
}

module.exports.RPCError = RPCError;
