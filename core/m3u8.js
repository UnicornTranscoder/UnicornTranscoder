/**
 * Created by drouar_b on 27/04/2017.
 */

const debug = require('debug')('m3u8');
const Transcoder = require('./transcoder');
const universal = require('./universal');
const config = require('../utils/config');

let m3u8 = {};

m3u8.serve = function (req, res) {
    debug('M3U8 ' + req.params.sessionId);
    universal.cache[req.params.sessionId] = new Transcoder(req.params.sessionId, req, res);
};

m3u8.serveChunk = function (req, res) {
    let sessionId = req.params.sessionId;
    debug('Requesting ' + req.params.partId + ' for session ' + sessionId);

    if ((typeof universal.cache[sessionId]) != 'undefined' && universal.cache[sessionId].alive == true) {
        universal.cache[sessionId].getChunk(req.params.partId, () => {
            debug('Serving ' + req.params.partId + ' for session ' + sessionId);
            res.sendFile(config.xdg_cache_home + sessionId + "/media-" + req.params.partId + ".ts");

            universal.updateTimeout(sessionId);
        })
    } else {
        debug(req.params.sessionId + ' not found');
        res.status(404).send('Session not found');
    }
};

m3u8.serveSubtitles = function (req, res) {
    let sessionId = req.params.sessionId;
    debug('Requesting subtitles ' + req.params.partId + ' for session ' + sessionId);

    if ((typeof universal.cache[sessionId]) != 'undefined' && universal.cache[sessionId].alive == true) {
        universal.cache[sessionId].getChunk(req.params.partId, () => {
            debug('Serving subtitles ' + req.params.partId + ' for session ' + sessionId);
            res.sendFile(config.xdg_cache_home + sessionId + "/media-" + req.params.partId + ".vtt");

            universal.updateTimeout(sessionId);
        }, 'sub')
    } else {
        debug(req.params.sessionId + ' not found');
        res.status(404).send('Session not found');
    }
};

module.exports = m3u8;