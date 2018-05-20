const remote = require('../src').createClient({ host: '127.0.0.1' });

async function handleClientRequest() {
    try {
        const result1 = await remote.divide(12, 3);
        console.log(`First result: ${result1}`);

        const result2 = await remote.divide(12, 0);
        console.log(`Second result: ${result2}`);
    } catch (error) {
        console.log(`Catched error: ${error.message}`);
    }
}

handleClientRequest();

// First result: 4
// Catched error: Can't divide by zero.
