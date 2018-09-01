const fs = require('fs');
const path = require('path');

module.exports = () => {
    try {
        const data = fs.readFileSync(path.join(process.cwd(), 'config.json'), 'utf8');
        return JSON.parse(data.replace(/^\uFEFF/, ''));
    }
    catch(e) {
        console.error('Configuration file missing');
        process.exit(2);
    }
};
