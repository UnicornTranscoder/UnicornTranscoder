const fs = require('fs');
const Transcoder = require('./transcoder');
const universal = require('./universal');
const proxy = require('./proxy');
const loadConfig = require('../utils/config');

const config = loadConfig();
let m3u8 = {};

m3u8.serve = function (req, res) {
    console.log('M3U8 ' + req.params.sessionId);

    if (typeof universal.cache[req.params.sessionId] !== 'undefined')
        universal.cache[req.params.sessionId].killInstance();

    universal.cache[req.params.sessionId] = new Transcoder(req.params.sessionId, req, res);

    universal.updateTimeout(req.params.sessionId);
};

m3u8.serveChunk = function (req, res) {
    let sessionId = req.params.sessionId;
    console.log('Requesting ' + req.params.partId + ' for session ' + sessionId);

    if ((typeof universal.cache[sessionId]) !== 'undefined' && universal.cache[sessionId].alive === true) {
        universal.cache[sessionId].getChunk(req.params.partId, (chunkId) => {
            let file = config.xdg_cache_home + sessionId + "/media-" + req.params.partId + ".ts";

            if (chunkId == -2) {
                if (!res.headersSent)
                    res.status(404).send('Callback ' + chunkId);
            } else if (chunkId == -1 && !fs.existsSync(file)) {
                console.log('Serving fake ' + req.params.partId + ' for session ' + sessionId);
                res.sendFile(config.plex_ressources + 'Resources/empty.ts');
            } else {
                console.log('Serving ' + req.params.partId + ' for session ' + sessionId);
                res.sendFile(file);
            }
        });
        universal.updateTimeout(sessionId);
    } else {
        console.log(sessionId + ' not found');

        universal.cache[sessionId] = new Transcoder(sessionId);
        universal.updateTimeout(sessionId);

        setTimeout(() => {
            res.status(404).send('Restarting session');
        }, 10000);}
};

m3u8.serveSubtitles = function (req, res) {
    let sessionId = req.params.sessionId;
    console.log('Requesting subtitles ' + req.params.partId + ' for session ' + sessionId);

    if ((typeof universal.cache[sessionId]) !== 'undefined' && universal.cache[sessionId].alive === true) {
        universal.cache[sessionId].getChunk(req.params.partId, (chunkId) => {
            let file = config.xdg_cache_home + sessionId + "/media-" + req.params.partId + ".vtt";

            if (chunkId == -2) {
                if (!res.headersSent)
                    res.status(404).send('Callback ' + chunkId);
            } else if (chunkId == -1 && !fs.existsSync(file)) {
                console.log('Serving fake subtitles ' + req.params.partId + ' for session ' + sessionId);
                res.sendFile(config.plex_ressources + 'Resources/empty.vtt');
            } else {
                console.log('Serving subtitles ' + req.params.partId + ' for session ' + sessionId);
                res.sendFile(file);
            }
        }, 'sub');
        universal.updateTimeout(sessionId);
    } else {
        console.log(sessionId + ' not found');

        universal.cache[sessionId] = new Transcoder(sessionId);
        universal.updateTimeout(sessionId);

        setTimeout(() => {
            res.status(404).send('Restarting session');
        }, 10000);
    }
};

m3u8.saveSession = function (req, res) {
    if (typeof req.query['X-Plex-Session-Identifier'] != 'undefined') {
        universal.sessions[req.query['X-Plex-Session-Identifier']] = req.query.session.toString();
    }
    proxy(req, res);
};

module.exports = m3u8;