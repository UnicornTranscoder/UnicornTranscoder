const fs = require('fs');
const Transcoder = require('./transcoder');
const universal = require('./universal');
const pad = require('../utils/pad');
const sleep = require('../utils/sleep');

class Dash {
    constructor(config) {
        this._config = config;
    }

    async serve(req, res) {
        console.log(req.query.session);
    
        if (universal.cache[req.params.sessionId] !== void(0)) {
            await universal.cache[req.params.sessionId].killInstance();
        }
        universal.cache[req.query.session] = new Transcoder(req.query.session, req, res);
    
        if (req.query['X-Plex-Session-Identifier'] !== void(0)) {
            universal.sessions[req.query['X-Plex-Session-Identifier']] = req.query.session.toString();
        }
        await universal.updateTimeout(req.query.session);
    }
    
    async serveInit(req, res) {
        let sessionId = req.params.sessionId;
        if ((universal.cache[sessionId]) !== void(0) && universal.cache[sessionId].alive === true) {
            const chunkId = await universal.cache[sessionId].getChunk(0, req.params.streamId, true);
            let file = this._config.xdg_cache_home + sessionId + "/init-stream" + req.params.streamId + ".m4s";
            if (chunkId == -2 || (chunkId == -1 && !fs.existsSync(file))) {
                if (!res.headersSent) {
                    res.status(404).send('Callback ' + chunkId);
                }
            } else {
                console.log('Serving init-stream' + req.params.streamId + '.m4s for session ' + sessionId);
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
    
    async serveChunk (req, res) {
        let sessionId = req.params.sessionId;
    
        if ((universal.cache[sessionId]) !== void(0) && universal.cache[sessionId].alive === true) {
            const chunkId = await universal.cache[sessionId].getChunk(parseInt(req.params.partId) + 1, req.params.streamId);
            let file = this._config.xdg_cache_home + sessionId + "/chunk-stream" + req.params.streamId + "-" + pad(parseInt(req.params.partId) + 1, 5) + ".m4s";

            if (chunkId == -2) {
                res.status(404).send('Callback ' + chunkId);
            } else if (chunkId == -1 && !fs.existsSync(file)) {
                console.log('Serving fake chunk-stream' + req.params.streamId + "-" + pad(parseInt(req.params.partId) + 1, 5) + '.m4s for session ' + sessionId);
                res.send('');
            } else {
                console.log('Serving chunk-stream' + req.params.streamId + "-" + pad(parseInt(req.params.partId) + 1, 5) + '.m4s for session ' + sessionId);
                res.sendFile(file);
            }
            await universal.updateTimeout(sessionId);
        } else {
            console.log(req.params.sessionId + ' not found');
    
            universal.cache[sessionId] = new Transcoder(sessionId);
            await universal.updateTimeout(sessionId);

            await sleep(10000);
            res.status(404).send('Restarting session');
        }
    }
}



module.exports = Dash;
