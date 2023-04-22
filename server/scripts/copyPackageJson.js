const fs = require('fs')
const path = require('path')
const packageObj = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json')))
const updatedPackageObj = {
    ...packageObj,
    main: 'index.js',
    types: 'index.d.ts',
    bin: {
        'ride-language-server': 'main.js',
    },
    scripts: undefined,
    private: undefined
}
fs.writeFileSync(path.join(__dirname, '..', 'out', 'package.json'), JSON.stringify(updatedPackageObj, null, 4))

