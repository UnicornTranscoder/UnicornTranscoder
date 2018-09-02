const fs = require('fs');
const Transcoder = require('./transcoder');
const universal = require('./universal');
const proxy = require('./proxy');
const sleep = require('../utils/sleep');

class M3U8 {
    constructor(config) {
        this._config = config;
    }

    async serve(req, res) {
        console.log('M3U8 ' + req.params.sessionId);
        if (universal.cache[req.params.sessionId] !== void(0)) {
            await universal.cache[req.params.sessionId].killInstance();
        }
        universal.cache[req.params.sessionId] = new Transcoder(req.params.sessionId, req, res);
        await universal.updateTimeout(req.params.sessionId);
    }

    async serveChunk(req, res) {
        let sessionId = req.params.sessionId;
        console.log('Requesting ' + req.params.partId + ' for session ' + sessionId);
    
        if ((universal.cache[sessionId]) !== void(0) && universal.cache[sessionId].alive === true) {
            const chunkId = await universal.cache[sessionId].getChunk(req.params.partId);
            let file = this._config.xdg_cache_home + sessionId + "/media-" + req.params.partId + ".ts";
            if (chunkId == -2) {
                if (!res.headersSent) {
                    res.status(404).send('Callback ' + chunkId);
                }
            } else if (chunkId == -1 && !fs.existsSync(file)) {
                console.log('Serving fake ' + req.params.partId + ' for session ' + sessionId);
                res.sendFile(this._config.plex_ressources + 'Resources/empty.ts');
            } else {
                console.log('Serving ' + req.params.partId + ' for session ' + sessionId);
                res.sendFile(file);
            }
            await universal.updateTimeout(sessionId);
        } else {
            console.log(sessionId + ' not found');

            universal.cache[sessionId] = new Transcoder(sessionId);
            await universal.updateTimeout(sessionId);

            await sleep(10000);
            res.status(404).send('Restarting session');
        }
    }

    async serveSubtitles(req, res) {
        let sessionId = req.params.sessionId;
        console.log('Requesting subtitles ' + req.params.partId + ' for session ' + sessionId);
    
        if ((universal.cache[sessionId]) !== void(0) && universal.cache[sessionId].alive === true) {
            const chunkId = await universal.cache[sessionId].getChunk(req.params.partId, 'sub');
            let file = this._config.xdg_cache_home + sessionId + "/media-" + req.params.partId + ".vtt";
            if (chunkId == -2) {
                if (!res.headersSent) {
                    res.status(404).send('Callback ' + chunkId);
                }
            } else if (chunkId == -1 && !fs.existsSync(file)) {
                console.log('Serving fake subtitles ' + req.params.partId + ' for session ' + sessionId);
                res.sendFile(this._config.plex_ressources + 'Resources/empty.vtt');
            } else {
                console.log('Serving subtitles ' + req.params.partId + ' for session ' + sessionId);
                res.sendFile(file);
            }
            await universal.updateTimeout(sessionId);
        } else {
            console.log(sessionId + ' not found');
    
            universal.cache[sessionId] = new Transcoder(sessionId);
            await universal.updateTimeout(sessionId);
    
            await sleep(10000);
            res.status(404).send('Restarting session');
        }
    }

    saveSession(req, res) {
        if (req.query['X-Plex-Session-Identifier'] !== void(0)) {
            universal.sessions[req.query['X-Plex-Session-Identifier']] = req.query.session.toString();
        }
        proxy(req, res);
    }
}

module.exports = M3U8;