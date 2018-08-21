# Remote Function
[![Build Status](https://travis-ci.org/lindell/remote-function.svg?branch=master)](https://travis-ci.org/lindell/remote-function)
[![Coverage Status](https://coveralls.io/repos/github/lindell/remote-function/badge.svg?branch=master)](https://coveralls.io/github/lindell/remote-function?branch=master)

Remote Function is a library for making remote procedure calls in an intuitive way. Just declare functions on the server and call them from the client, that's it! If the function errors, the error will seamlessly be transferred to the calling client. This is done via [JSON RPC 2.0](http://www.jsonrpc.org/specification) which makes it possible to use with other clients. It has _no dependencies_ and works by utilizing [Proxies](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy) that was introduced with ES6.

## Install

```
npm install remote-function
```

## Example

#### Server

Initiate a server, then just define your function on the server object.

```javascript
const server = require('remote-function').createServer();

server.divide = (arg1, arg2) => {
    if (arg2 === 0) {
        throw new Error("Can't divide by zero.");
    }
    return arg1 / arg2;
};
```

#### Client

Define where the server is located when creating a client. Then you can just call the function that is defined at the server and you get a promise that returns what the server function will return. If you are on _>=Node 8.0.0_, you can use it with `await` if you are within an `async` function.

```javascript
const remote = require('remote-function').createClient({ host: '127.0.0.1' });

const result = await remote.divide(12, 3);
console.log(result); // 4
```

If an error is thrown on the server:
```javascript
try {
    const result = await remote.divide(12, 0);
    console.log(result); // Will not be reached
} catch (error) {
    // Get the error thrown on the server, including stacktrace
}
```

## Options

#### Server

| Option         | Default     | Description                                  |
| -------------- | ----------- | -------------------------------------------- |
| `host`         | `"0.0.0.0"` | The host that the server listen on           |
| `port`         | `6356`      | The port that the server listen on           |
| `includeStack` | `true`      | Should errors include the server stacktrace? |

#### Client

| Option            | Default                     | Description                         |
| ----------------- | --------------------------- | ----------------------------------- |
| `host`            | `"127.0.0.1"` | The host that the server listens on |
| `port`            | `6356`        | The port that the server listens on |
| `headers`         | `{}`          | Additional request headers          |
| `connectTimeout`  | `0`           | The socket connection timeout       |
| `responseTimeout` | `0`           | The response wait timeout           |

`createClient` also supports options from [http.request()](https://nodejs.org/api/http.html#http_http_request_options_callback). For example, you can set `headers` to add extra headers to http request, or `auth` if you need Basic Authentication. You cannot change http request _method_.
