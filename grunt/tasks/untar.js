const path = require('path');
const tar = require('tar');
const zlib = require('zlib');
const lzma = require('lzma-native');
const fs = require('fs');

module.exports = (grunt) => {
    grunt.registerMultiTask('untar', 'Extract a tar archive', function() {
        Object.keys(this.data.files).forEach((dest) => {
            const src = this.data.files[dest];

            let done = this.async();
            const decompressor = path.extname(src) === '.xz' ? lzma.createDecompressor() : zlib.createGunzip();
            fs.createReadStream(src).pipe(decompressor).pipe(tar.x({cwd: dest}).on('end', () => {
                done()
            }));
        })
    })
};