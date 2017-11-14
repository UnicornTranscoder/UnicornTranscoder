/**
 * Created by drouar_b on 27/04/2017.
 */

const debug = require('debug')('m3u8');
const fs = require('fs');
const Transcoder = require('./transcoder');
const universal = require('./universal');
const proxy = require('./proxy');
const config = require('../utils/config');

let m3u8 = {};

m3u8.serve = function (req, res) {
    debug('M3U8 ' + req.params.sessionId);

    if (typeof universal.cache[req.params.sessionId] == 'undefined')
        universal.cache[req.params.sessionId].killInstance();

    universal.cache[req.params.sessionId] = new Transcoder(req.params.sessionId, req, res);
};

m3u8.serveChunk = function (req, res) {
    let sessionId = req.params.sessionId;
    debug('Requesting ' + req.params.partId + ' for session ' + sessionId);

    if ((typeof universal.cache[sessionId]) != 'undefined' && universal.cache[sessionId].alive == true) {
        universal.cache[sessionId].getChunk(req.params.partId, (chunkId) => {
            let file = config.xdg_cache_home + sessionId + "/media-" + req.params.partId + ".ts";

            if (chunkId == -1 && !fs.existsSync(file)) {
                debug('Serving fake ' + req.params.partId + ' for session ' + sessionId);
                res.sendFile(config.plex_ressources + 'Resources/empty.ts');
            } else {
                debug('Serving ' + req.params.partId + ' for session ' + sessionId);
                res.sendFile(file);
            }
        });
        universal.updateTimeout(sessionId);
    } else {
        debug(req.params.sessionId + ' not found');
        res.status(404).send('Session not found');
    }
};

m3u8.serveSubtitles = function (req, res) {
    let sessionId = req.params.sessionId;
    debug('Requesting subtitles ' + req.params.partId + ' for session ' + sessionId);

    if ((typeof universal.cache[sessionId]) != 'undefined' && universal.cache[sessionId].alive == true) {
        universal.cache[sessionId].getChunk(req.params.partId, (chunkId) => {
            let file = config.xdg_cache_home + sessionId + "/media-" + req.params.partId + ".vtt";

            if (chunkId == -1 && !fs.existsSync(file)) {
                debug('Serving fake subtitles ' + req.params.partId + ' for session ' + sessionId);
                res.sendFile(config.plex_ressources + 'Resources/empty.vtt');
            } else {
                debug('Serving subtitles ' + req.params.partId + ' for session ' + sessionId);
                res.sendFile(file);
            }
        }, 'sub');
        universal.updateTimeout(sessionId);
    } else {
        debug(req.params.sessionId + ' not found');
        res.status(404).send('Session not found');
    }
};

m3u8.saveSession = function (req, res) {
    if (typeof req.query['X-Plex-Session-Identifier'] != 'undefined') {
        universal.sessions[req.query['X-Plex-Session-Identifier']] = req.query.session.toString();
    }
    proxy(req, res);
};

module.exports = m3u8;