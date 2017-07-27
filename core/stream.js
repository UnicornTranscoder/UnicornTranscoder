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
    let transcoder = new Transcoder(req.query.session, req.url);
    req.connection.on("close", stream.connectionClosed.bind(null, transcoder));

    transcoder.getChunk(0, stream.serveChunk.bind(null, req, res, transcoder))
};

stream.serveChunk = function (req, res, transcoder, chunkId) {
    let cwd = config.xdg_cache_home + req.query.session + "/";

    function doWork() {
        if (!req.connection.destroyed) {
            let fileStream = fs.createReadStream(cwd + "chunk-" + utils.pad(chunkId, 5));
            fileStream.pipe(res, {end: false});
            fileStream.on('end', transcoder.getChunk.bind(transcoder, chunkId + 1, stream.serveChunk.bind(null, req, res, transcoder)))
        }
    }
    if (chunkId == -1) {
        if (!req.connection.destroyed) {
            res.end()
        }
    } else if (chunkId == 0) {
        stream.serveHeader(req, res, cwd, doWork);
    }
    else
        doWork()
};

stream.serveSubtitles = function (req, res) {
    res.send('Serve sub')
};


stream.serveHeader = function (req, res, cwd, callback) {
    if (!req.connection.destroyed) {
        res.type(config.video_content_type);
        let fileStream = fs.createReadStream(cwd + "header");
        fileStream.pipe(res, {end: false});
        fileStream.on('end', callback);
    }
};

stream.connectionClosed = function (transcoder) {
    transcoder.killInstance()
};

module.exports = stream;