const fs = require('fs');
const version = require('../server/node_modules/@waves/ride-js').version;
const split = fs.readFileSync('README.md', "utf8").split('\n');
split[1] = `## Ride compiler version ${version}`;
fs.writeFileSync('README.md', split.join('\n'));
