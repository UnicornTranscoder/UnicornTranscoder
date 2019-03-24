const ar = require('ar');
const path = require('path');

module.exports = (grunt) => {
    grunt.registerMultiTask('arx', 'Extract a GNU ar archive', function() {
        let archive = new ar.Archive(grunt.file.read(this.data.src, { encoding: null }));
        let files = archive.getFiles();
        files.forEach((file) => {
            grunt.file.write(path.resolve(this.data.dst, file.name()), file.fileData());
        });
    });
};