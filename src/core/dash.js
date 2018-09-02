const fs = require('fs');
const path = require('path');
const Transcoder = require('./transcoder');
const pad = require('../utils/pad');
const sleep = require('../utils/sleep');

class Dash {
    constructor(config, universal, websocket) {
        this._config = config;
        this._universal = universal;
        this._ws = websocket;
        this._plexCachePath = path.join(this._config.plex.transcoder, "Cache");
    }

    async serve(req, res) {
        console.log(req.query.session);

        if (this._universal.getCache(req.params.sessionId) !== void (0)) {
            await this._universal.getCache(req.params.sessionId).killInstance();
        }
        this._universal.putCache(req.query.session, new Transcoder(this._config, this._ws, this._universal, req.query.session, req));

        if (req.query['X-Plex-Session-Identifier'] !== void (0)) {
            this._universal.sessions[req.query['X-Plex-Session-Identifier']] = req.query.session.toString();
        }
        await this._universal.updateTimeout(req.query.session);
        res.status(200).json({success: true});
    }

    async serveInit(req, res) {
        let sessionId = req.params.sessionId;
        if (this._universal.getCache(sessionId) !== void (0) && this._universal.getCache(sessionId).alive === true) {
            const chunkId = await this._universal.getCache(sessionId).getChunk(0, req.params.streamId, true);
            const file = path.join(this._plexCachePath, sessionId, `init-stream${req.params.streamId}.m4s`);
            if (chunkId == -2 || (chunkId == -1 && !fs.existsSync(file))) {
                if (!res.headersSent) {
                    res.status(404).send(`Callback ${chunkId}`);
                }
            } else {
                console.log(`Serving init-stream${req.params.streamId}.m4s for session ${sessionId}`);
                res.sendFile(file);
            }
            await this._universal.updateTimeout(sessionId);
        } else {
            console.log(`${sessionId} not found`);

            this._universal.putCache(sessionId, new Transcoder(this._config, this._ws, this._universal, sessionId));
            await this._universal.updateTimeout(sessionId);

            await sleep(10000);
            res.status(404).send('Restarting session');
        }
    }

    async serveChunk(req, res) {
        let sessionId = req.params.sessionId;

        if ((this._universal.getCache(sessionId) !== void (0) && this._universal.getCache(sessionId).alive === true)) {
            const chunkId = await this._universal.getCache(sessionId).getChunk(parseInt(req.params.partId) + 1, req.params.streamId);
            const file = path.join(this._plexCachePath, sessionId, `chunk-stream${req.params.streamId}-${pad(parseInt(req.params.partId) + 1, 5)}.m4s`);

            if (chunkId == -2) {
                res.status(404).send('Callback ' + chunkId);
            } else if (chunkId == -1 && !fs.existsSync(file)) {
                console.log(`Serving fake chunk-stream${req.params.streamId}-${pad(parseInt(req.params.partId) + 1, 5)}.m4s for session ${sessionId}`);
                res.send('');
            } else {
                console.log(`Serving chunk-stream${req.params.streamId}-${pad(parseInt(req.params.partId) + 1, 5)}.m4s for session ${sessionId}`);
                res.sendFile(file);
            }
            await this._universal.updateTimeout(sessionId);
        } else {
            console.log(`${req.params.sessionId} not found`);

            this._universal.putCache(sessionId, new Transcoder(this._config, this._ws, this._universal, sessionId));
            await this._universal.updateTimeout(sessionId);

            await sleep(10000);
            res.status(404).send('Restarting session');
        }
    }
}



module.exports = Dash;
