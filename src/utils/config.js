const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const readFilep = promisify(fs.readFile);

module.exports = async() => {
    try {
        const data = await readFilep(path.join(process.cwd(), 'config.json'), 'utf8');
        return JSON.parse(data.replace(/^\uFEFF/, ''));
    }
    catch(e) {
        console.error('Configuration file missing');
        process.exit(2);
    }
};
