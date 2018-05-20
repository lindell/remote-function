const srcp = require('../src');

const remote = srcp.createClient({ host: '127.0.0.1' });

remote
    .divide(12, 0)
    .then(console.log)
    .catch(console.log);
