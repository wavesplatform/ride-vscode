const path = './syntaxes/ride.tmLanguage.json';
const tmLanguage = require('.' + path);
const fs = require('fs');
const libVersion = 3;
const funcsIndex = tmLanguage.patterns.findIndex(({name}) => name === 'entity.name.function.ride');
const typesIndex = tmLanguage.patterns.findIndex(({name}) => name === 'entity.name.type.ride');

const { getFunctionsDoc, getTypes } = require('../server/node_modules/@waves/ride-js');

tmLanguage.patterns[funcsIndex].match = `\\b(${
    getFunctionsDoc(libVersion)
        .filter(({name}) => ['*', '\\', '/', '%', '+',].indexOf(name) === -1)
        .map(({name}) => name)
        .join('|')
    })\\b`;

tmLanguage.patterns[typesIndex].match = `\\b(${
    getTypes(libVersion).map(({name}) => name).join('|')
    })\\b`;

try {
    fs.unlinkSync(path);
} catch (e) {
}

fs.appendFile(path, (JSON.stringify(tmLanguage, null, 4)), function (err) {
    if (err) throw err;
    console.log('✅ -> tmLanguage were saved to ' + path);
});

