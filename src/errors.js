class RPCError extends Error {
    constructor(id, message) {
        super(message);
        this.id = id;
        Error.captureStackTrace(this, RPCError);
    }
}

module.exports.RPCError = RPCError;
