/**
 * Created by drouar_b on 27/04/2017.
 */

let path = require('path');
let fs = require('fs');
let Transcoder = require('./transcoder');
let config = require('../utils/config');
let utils = require('../utils/utils');

let stream = {};

stream.serve = function(req, res) {
    let transcoder = new Transcoder(req.params.sessionId, req.url);
    req.connection.on("close", stream.connectionClosed.bind(null, transcoder));

    transcoder.getChunk(0, stream.serveChunk.bind(null, req, res, transcoder))
};

stream.serveChunk = function (req, res, transcoder, chunkId) {
    let cwd = config.xdg_cache_home + req.params.sessionId + "/";

    function doWork() {
        if (!req.connection.destroyed) {
            let stream = fs.createReadStream(cwd + "chunk-" + utils.pad(chunkId, 5));
            stream.pipe(res, {end: false});
            stream.on('end', transcoder.getChunk(chunkId + 1, stream.serveChunk.bind(null, req, res, transcoder)))
        }
    }
    if (chunkId == -1) {
        if (!req.connection.destroyed) {
            res.end()
        }
    } else if (chunkId == 0)
        stream.serveHeader(req, cwd, "header", doWork);
    else
        doWork()
};

stream.serveSubtitles = function (req, res) {
    res.send('Serve sub')
};


stream.serveHeader = function (req, cwd, header, callback) {
    if (!req.connection.destroyed) {
        let stream = fs.createReadStream(cwd + header);
        stream.pipe(res, {end: false});
        stream.on('end', callback)
    }
};

stream.connectionClosed = function (transcoder) {
    transcoder.kill()
};

module.exports = stream;