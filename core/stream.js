/**
 * Created by drouar_b on 27/04/2017.
 */

const fs = require('fs');
const debug = require('debug')('stream');
const Transcoder = require('./transcoder');
const config = require('../utils/config');
const universal = require('./universal');
const utils = require('../utils/utils');

let stream = {};

stream.serve = function(req, res) {
    debug('Stream ' + req.query.session.toString());

    if (typeof universal.cache[req.query.session] == 'undefined') {
        universal.cache[req.query.session] = new Transcoder(req.query.session, req.url);
    }

    req.connection.on("close", stream.connectionClosed.bind(null, universal.cache[req.query.session]));
    universal.cache[req.query.session].getChunk(0, stream.serveChunk.bind(null, req, res, universal.cache[req.query.session]))
};

stream.serveChunk = function (req, res, transcoder, chunkId) {
    let cwd = config.xdg_cache_home + req.query.session + "/";

    function doWork() {
        if (!req.connection.destroyed) {
            universal.updateTimeout(req.query.session);

            let fileStream = fs.createReadStream(cwd + "chunk-" + utils.pad(chunkId, 5));
            fileStream.pipe(res, {end: false});
            fileStream.on('end', transcoder.getChunk.bind(transcoder, chunkId + 1, stream.serveChunk.bind(null, req, res, transcoder)))
        }
    }
    if (chunkId == -1) {
        if (!req.connection.destroyed) {
            res.end();
            debug(req.query.session + ' end');
        }
    } else if (chunkId == 0) {
        stream.serveHeader(req, res, cwd, false, doWork);
    }
    else
        doWork()
};

stream.serveHeader = function (req, res, cwd, subtitle, callback) {
    if (!req.connection.destroyed) {
        debug('Serving ' + (subtitle ? ' subtitles ' :  '') + req.query.session);
        res.type((subtitle ? config.subtitles_content_type : config.video_content_type));
        let fileStream = fs.createReadStream(cwd + (subtitle ? 'sub-' : '') + 'header');
        fileStream.pipe(res, {end: false});
        fileStream.on('end', callback);
    }
};


stream.serveSubtitles = function (req, res) {
    if (typeof universal.cache[req.query.session] != 'undefined') {
        debug('Subtitles ' + req.query.session.toString());
        universal.cache[req.query.session].getChunk(0, stream.serveSubtitleChunk.bind(null, req, res, universal.cache[req.query.session]), 'sub')
    } else {
        res.status(404).send('Invalid session')
    }
};

stream.serveSubtitleChunk = function (req, res, transcoder, chunkId) {
    let cwd = config.xdg_cache_home + req.query.session + "/";

    function doWork() {
        if (!req.connection.destroyed) {
            universal.updateTimeout(req.query.session);

            let fileStream = fs.createReadStream(cwd + "sub-chunk-" + utils.pad(chunkId, 5));
            fileStream.pipe(res, {end: false});
            fileStream.on('end', transcoder.getChunk.bind(transcoder, chunkId + 1, stream.serveSubtitleChunk.bind(null, req, res, transcoder), 'sub'))
        }
    }
    if (chunkId == -1) {
        if (!req.connection.destroyed) {
            res.end();
            debug(req.query.session + ' subtitles end');
        }
    } else if (chunkId == 0) {
        stream.serveHeader(req, res, cwd, true, doWork);
    }
    else
        doWork()
};

stream.connectionClosed = function (transcoder) {
    debug(transcoder.sessionId + ' connection closed');
    //transcoder.killInstance()
};

module.exports = stream;